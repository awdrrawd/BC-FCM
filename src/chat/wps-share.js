import { PDB } from '../data/profile-db.js';
import { cfg } from '../core/config.js';
import { T, TH } from '../i18n/i18n.js';
import { warnLimited } from '../core/logger.js';
import { markSeen } from '../data/profile-seen.js';
import { PROFILE_SHARE_PREFIX, buildShareMessages, chunkSizeFor, createShareAssembler } from './wps-protocol.js';
// PROFILESHARE 收發（協定細節與接收端安全限制在 wps-protocol.js）。
// 接收優先序：FCM > LCE > 獨立 WPS；FCM 載入時，其他兩者會讓出接收。

const PROFILE_SHARE_OPEN_MARK = 'PROFILESHARE_OPEN';
const WPS_CACHE_TTL = 30 * 60 * 1000;
const WPS_CACHE_MAX = 32;
const SHARE_GAP_MS = 100;        // 兩塊之間的最小間隔（約每秒 10 則，低於 BC 的 14 則 / 1.2 秒）
const SHARE_RETRY_MS = 50;       // BC 發送佇列非空時的重試間隔
const SHARE_STALL_MS = 10_000;   // 佇列一直不空超過這段時間就放棄這次分享
const _wpsAssembler = createShareAssembler();
const _wpsCache     = new Map();
let _wpsTokenObserver = null;
let _wpsSeq = 0;
let _wpsInFlight = false;        // 同一時間只送一份，避免連按「分享」塞滿 BC 的發送佇列

function wpsSender(data) {
    return Number(data?.Sender ?? data?.SenderMemberNumber) || 0;
}

function isProfileShareMessage(data) {
    return !!data?.Content && data.Content.startsWith(PROFILE_SHARE_PREFIX);
}

// ChatRoomSendLocal 以 HTML 顯示內容，且下方會把 token 換成按鈕：名稱一律跳脫，
// 連方括號也跳脫，避免對方在名稱裡塞出假的 [PROFILESHARE_OPEN …] 標記。
function escapeHtml(value) {
    return String(value).replace(/[&<>"'[\]]/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '[': '&#91;', ']': '&#93;'
    })[char]);
}

function pruneWpsCache(now = Date.now()) {
    for (const [key, entry] of _wpsCache) {
        if (!entry || now - entry.cachedAt > WPS_CACHE_TTL) _wpsCache.delete(key);
    }
    while (_wpsCache.size > WPS_CACHE_MAX) _wpsCache.delete(_wpsCache.keys().next().value);
}

// BC 的單則訊息上限；它可能是頂層 const（不在 globalThis 上），所以兩種都讀。
function bcMaxMessageChars() {
    try {
        if (typeof ServerChatMessageMaxLength !== 'undefined') return Number(ServerChatMessageMaxLength);
    } catch { /* 讀不到就退回 globalThis */ }
    return Number(globalThis.ServerChatMessageMaxLength);
}

function bcSendQueueLength() {
    try {
        if (typeof ServerSendRateLimitQueue !== 'undefined' && Array.isArray(ServerSendRateLimitQueue)) return ServerSendRateLimitQueue.length;
    } catch { /* 選用訊號，讀不到就當作空 */ }
    return 0;
}

const inChatRoom = () => typeof ChatRoomData !== 'undefined' && !!ChatRoomData;

/**
     * 依序送出分塊：BC 發送佇列非空就讓路，塊與塊之間至少隔 SHARE_GAP_MS。
     * 一次把幾十塊全塞進佇列，聊天訊息就得排在它們後面好幾秒。
     * 回傳是否全部送出；離開房間、送出失敗或等待過久則中止並回傳 false。
     */
function sendShareChunks(contents) {
    return new Promise(resolve => {
        let index = 0, waitStart = null;
        const step = () => {
            try {
                if (!inChatRoom()) return resolve(false);
                if (index >= contents.length) return resolve(true);
                if (bcSendQueueLength() > 0) {
                    const now = Date.now();
                    waitStart ??= now;
                    if (now - waitStart > SHARE_STALL_MS) return resolve(false);
                    return void setTimeout(step, SHARE_RETRY_MS);
                }
                waitStart = null;
                ServerSend('ChatRoomChat', { Type: 'Hidden', Content: contents[index++] });
                setTimeout(step, SHARE_GAP_MS);
            } catch (error) { warnLimited('profile share chunk failed', error); resolve(false); }
        };
        step();
    });
}

function localNotice(text) {
    if (typeof ChatRoomSendLocal === 'function') ChatRoomSendLocal(escapeHtml(text), 0);
}

async function wpsShareProfile(memberNumber) {
    if (!inChatRoom() || typeof ServerSend !== 'function') return false;
    if (_wpsInFlight) { localNotice(T('shareBusyMsg')); return false; }
    _wpsInFlight = true;
    try {
        const mn = parseInt(memberNumber);
        if (!Number.isSafeInteger(mn) || mn <= 0) return false;
        const prof = await PDB.get(mn);
        if (!prof?.characterBundle) return false;
        const payload = {
            sharedAt: Date.now(),
            from: {
                memberNumber: Player?.MemberNumber,
                name: (typeof CharacterNickname === 'function' ? CharacterNickname(Player) : null)
                        || Player?.Nickname || Player?.Name || String(Player?.MemberNumber)
            },
            profile: { memberNumber: prof.memberNumber, name: prof.name, lastNick: prof.lastNick, seen: prof.seen, characterBundle: prof.characterBundle }
        };
        const shareId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const built = buildShareMessages(payload, shareId, chunkSizeFor(bcMaxMessageChars()));
        if (built.tooLarge) {
            localNotice(T('shareTooLargeMsg', Math.ceil(built.chars / 1000), Math.floor(built.limit / 1000)));
            return false;
        }
        const displayName = prof.lastNick || prof.name || mn;
        localNotice(T('shareLocalMsg', displayName, mn));
        return await sendShareChunks(built.contents);
    } catch (error) {
        warnLimited('profile share failed', error);
        return false;
    } finally { _wpsInFlight = false; }
}

function wpsHandleMessage(data) {
    if (!isProfileShareMessage(data)) return false;
    try {
        const sender = wpsSender(data);
        const result = _wpsAssembler.accept(sender, data.Content);
        if (result.status !== 'complete') return true;
        // 自己分享的不用再顯示或存一次。
        if (sender === Number(Player?.MemberNumber)) return true;

        const { profile: p, fromName: claimedName } = result.payload;
        // 來源以伺服器附的送出者為準，不採用 payload 自稱的名字。
        const known = typeof ChatRoomCharacter !== 'undefined' ? ChatRoomCharacter.find(c => Number(c?.MemberNumber) === sender) : null;
        const fromName = (known && typeof CharacterNickname === 'function' ? CharacterNickname(known) : null) || claimedName || String(sender);

        // 開啟用的快取鍵由接收端自己產生（不採用對方自訂的 sharedAt）。
        const cacheId = Date.now() * 1000 + (_wpsSeq++ % 1000);
        _wpsCache.set(`${cacheId}:${p.memberNumber}`, { profile: p, cachedAt: Date.now() });
        pruneWpsCache();

        const displayName = p.lastNick || p.name || p.memberNumber;
        const openToken = `[${PROFILE_SHARE_OPEN_MARK} ${cacheId} ${p.memberNumber}]`;
        const seenDate = new Date(p.seen);
        const seenText = `${seenDate.getFullYear()}/${seenDate.getMonth() + 1}/${seenDate.getDate()}`;
        if (typeof ChatRoomSendLocal === 'function') {
            ChatRoomSendLocal(T('shareRecvMsg', escapeHtml(fromName), `${openToken} ${escapeHtml(displayName)} (${p.memberNumber})`, seenText), 0);
        }
        // 只在有啟用儲存（saveMode !== 'off'）時才寫入 DB；未開 Profiles 者仍可透過
        // 記憶體快取＋「開啟」按鈕檢視分享內容，但不落地儲存。
        if (cfg.saveMode !== 'off') void PDB.receiveShared(p);
    } catch (e) { warnLimited('WPS parse error', e); }
    return true;
}

function wpsProcessOpenTokens(element) {
    if (element.dataset.fcmShareProcessed === '1') return;
    const html = element.innerHTML;
    if (!html || !html.includes(PROFILE_SHARE_OPEN_MARK)) return;
    const replaced = html.replace(
        /\[PROFILESHARE_OPEN\s+(\d+)\s+(\d+)\]/g,
        (m, cacheId, memberNumber) => {
            const key = `${cacheId}:${memberNumber}`;
            if (!_wpsCache.has(key)) return m;
            return `<span class="fcmShareOpen" data-key="${key}" style="color:#885CB0;cursor:pointer;user-select:none;">${TH('shareOpen')}</span>`;
        }
    );
    if (replaced !== html) {
        element.innerHTML = replaced;
        element.dataset.fcmShareProcessed = '1';
        element.querySelectorAll('.fcmShareOpen').forEach(el => {
            if (el.dataset.bound) return;
            el.dataset.bound = '1';
            el.onselectstart = () => false;
            el.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); });
            el.addEventListener('click', e => {
                e.preventDefault(); e.stopPropagation();
                const entry = _wpsCache.get(el.dataset.key);
                if (!entry) return;
                const p = entry.profile;
                try {
                    const C = CharacterLoadOnline(JSON.parse(p.characterBundle), p.memberNumber);
                    markSeen(C, p);
                    InformationSheetLoadCharacter(C);
                } catch (error) { warnLimited('WPS shared profile open failed', error); }
                // 檢視恆可（資料已在分享時完整送達、存於記憶體）；僅在啟用儲存時才落地寫入 DB
                if (cfg.saveMode !== 'off') void PDB.receiveShared(p);
            });
        });
    }
}

function observeWpsOpenTokens() {
    if (_wpsTokenObserver || !document.body) return;
    const processTree = node => {
        const element = node instanceof Element ? node : node.parentElement;
        if (!element) return;
        if (element.matches('.ChatMessageLocalMessage')) wpsProcessOpenTokens(element);
        element.querySelectorAll?.('.ChatMessageLocalMessage').forEach(wpsProcessOpenTokens);
        const parentMessage = element.closest?.('.ChatMessageLocalMessage');
        if (parentMessage) wpsProcessOpenTokens(parentMessage);
    };
    document.querySelectorAll('.ChatMessageLocalMessage').forEach(wpsProcessOpenTokens);
    _wpsTokenObserver = new MutationObserver(records => {
        for (const record of records) record.addedNodes.forEach(processTree);
    });
    _wpsTokenObserver.observe(document.body, { childList: true, subtree: true });
}

export { PROFILE_SHARE_PREFIX, isProfileShareMessage, wpsShareProfile, wpsHandleMessage, wpsProcessOpenTokens, observeWpsOpenTokens };

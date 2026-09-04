import { PDB } from '../data/profile-db.js';
import { cfg } from '../core/config.js';
import { T, TH } from '../i18n/i18n.js';
import { warnLimited } from '../core/logger.js';
// ════════════════════════════════════════
//  FCM module: wps-share.js
//  (split from Plugins/liko-FCM.user.js)
// ════════════════════════════════════════

    const WPS_PREFIX    = '[LIKOSHARE]';
    const WPS_OPEN_MARK = 'LIKOSHARE_OPEN';
    const WPS_CHUNK     = 800;
    const WPS_MAX_CHUNKS = 512;
    const WPS_MAX_BYTES = WPS_CHUNK * WPS_MAX_CHUNKS;
    const WPS_MAX_INCOMING = 24;
    const WPS_MAX_PER_SENDER = 4;
    const WPS_INCOMING_TTL = 2 * 60 * 1000;
    const WPS_CACHE_TTL = 30 * 60 * 1000;
    const WPS_CACHE_MAX = 32;
    const _wpsIncoming  = new Map();
    const _wpsCache     = new Map();
    let _wpsTokenObserver = null;
    if (!window.__LIKOSHARE_CACHE__) window.__LIKOSHARE_CACHE__ = _wpsCache;

    function wpsSender(data) {
        return Number(data?.Sender ?? data?.SenderMemberNumber) || 0;
    }

    function pruneWpsState(now = Date.now()) {
        for (const [id, entry] of _wpsIncoming) {
            if (!entry || now - entry.updatedAt > WPS_INCOMING_TTL) _wpsIncoming.delete(id);
        }
        for (const [key, payload] of _wpsCache) {
            const cachedAt = Number(payload?._fcmCachedAt) || Number(payload?.sharedAt) || 0;
            if (!cachedAt || now - cachedAt > WPS_CACHE_TTL) _wpsCache.delete(key);
        }
        while (_wpsCache.size > WPS_CACHE_MAX) _wpsCache.delete(_wpsCache.keys().next().value);
    }

    function validWpsPayload(payload) {
        const profile = payload?.profile;
        return Number.isSafeInteger(Number(payload?.sharedAt))
            && Number.isSafeInteger(Number(profile?.memberNumber))
            && Number(profile.memberNumber) > 0
            && typeof profile.characterBundle === 'string'
            && profile.characterBundle.length <= WPS_MAX_BYTES;
    }
    async function wpsShareProfile(memberNumber) {
        if (!PDB.db || !globalThis.ChatRoomData || typeof globalThis.ServerSend !== 'function') return false;
        const mn = parseInt(memberNumber);
        if (!Number.isSafeInteger(mn) || mn <= 0) return false;
        const prof = await PDB.get(mn);
        if (!prof?.characterBundle) return false;
        const payload = {
            sharedAt: Date.now(),
            from: { memberNumber: Player?.MemberNumber, name: Player?.Nickname || Player?.Name || String(Player?.MemberNumber) },
            profile: { memberNumber: prof.memberNumber, name: prof.name, lastNick: prof.lastNick, seen: prof.seen, characterBundle: prof.characterBundle }
        };
        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
        const shareId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const total = Math.ceil(encoded.length / WPS_CHUNK);
        if (!total || total > WPS_MAX_CHUNKS || encoded.length > WPS_MAX_BYTES) {
            console.warn('🐈‍⬛ [FCM] WPS profile is too large to share safely');
            return false;
        }
        for (let i = 0; i < total; i++) {
            ServerSend('ChatRoomChat', { Type: 'Hidden', Content: `${WPS_PREFIX} ${shareId} ${i+1}/${total} ${encoded.slice(i*WPS_CHUNK, (i+1)*WPS_CHUNK)}` });
        }
        const displayName = prof.lastNick || prof.name || mn;
        if (typeof ChatRoomSendLocal === 'function') ChatRoomSendLocal(T('shareLocalMsg', displayName, mn), 0);
        return true;
    }

    function wpsHandleMessage(data) {
        if (!data?.Content?.startsWith(WPS_PREFIX)) return false;
        try {
            pruneWpsState();
            const parts = data.Content.split(' ');
            const shareId = parts[1];
            const [idx, total] = String(parts[2] || '').split('/').map(Number);
            const chunk = parts.slice(3).join(' ');
            const sender = wpsSender(data);
            if (!/^[a-z0-9-]{6,64}$/i.test(shareId || '')
                || !Number.isSafeInteger(idx) || !Number.isSafeInteger(total)
                || total < 1 || total > WPS_MAX_CHUNKS || idx < 1 || idx > total
                || !chunk || chunk.length > WPS_CHUNK || !/^[A-Za-z0-9+/=]+$/.test(chunk)) return true;
            if (!_wpsIncoming.has(shareId)) {
                const senderEntries = [..._wpsIncoming.values()].filter(entry => entry.sender === sender).length;
                if (_wpsIncoming.size >= WPS_MAX_INCOMING || senderEntries >= WPS_MAX_PER_SENDER) return true;
                _wpsIncoming.set(shareId, { total, sender, chunks: new Array(total), received: 0, bytes: 0, updatedAt: Date.now() });
            }
            const entry = _wpsIncoming.get(shareId);
            if (entry.total !== total || entry.sender !== sender) { _wpsIncoming.delete(shareId); return true; }
            if (entry.chunks[idx - 1] && entry.chunks[idx - 1] !== chunk) { _wpsIncoming.delete(shareId); return true; }
            if (!entry.chunks[idx - 1]) { entry.received++; entry.bytes += chunk.length; }
            if (entry.bytes > WPS_MAX_BYTES) { _wpsIncoming.delete(shareId); return true; }
            entry.chunks[idx - 1] = chunk;
            entry.updatedAt = Date.now();
            if (entry.received === entry.total) {
                _wpsIncoming.delete(shareId);
                const payload = JSON.parse(decodeURIComponent(escape(atob(entry.chunks.join('')))));
                if (!validWpsPayload(payload)) return true;
                const key = `${payload.sharedAt}:${payload.profile.memberNumber}`;
                Object.defineProperty(payload, '_fcmCachedAt', { value: Date.now(), enumerable: false });
                _wpsCache.set(key, payload);
                pruneWpsState();
                if (window.__LIKOSHARE_CACHE__ && window.__LIKOSHARE_CACHE__ !== _wpsCache) window.__LIKOSHARE_CACHE__.set(key, payload);
                const p = payload.profile;
                const from = payload.from || {};
                const fromName = from.name || from.memberNumber || '?';
                const isSelf = from.memberNumber === Player?.MemberNumber;
                const displayName = p.lastNick || p.name || p.memberNumber;
                const openToken = `[${WPS_OPEN_MARK} ${payload.sharedAt} ${p.memberNumber}]`;
                const seenDate = new Date(p.seen);
                const seenText = `${seenDate.getFullYear()}/${seenDate.getMonth()+1}/${seenDate.getDate()}`;
                if (!isSelf && typeof ChatRoomSendLocal === 'function') {
                    ChatRoomSendLocal(T('shareRecvMsg', fromName, `${openToken} ${displayName} (${p.memberNumber})`, seenText), 0);
                }
                // 只在有啟用儲存（saveMode !== 'off'）時才寫入 DB；未開 Profiles 者仍可透過
                // 記憶體快取（_wpsCache）＋下方的「開啟」按鈕檢視分享內容，但不落地儲存。
                if (PDB.db && cfg.saveMode !== 'off') {
                    const tx = PDB.db.transaction('profiles', 'readwrite');
                    const store = tx.objectStore('profiles');
                    const req = store.get(p.memberNumber);
                    req.onsuccess = () => { const local = req.result; if (!local || p.seen > local.seen) store.put(p); };
                }
            }
        } catch(e) { console.warn('🐈‍⬛ [FCM] WPS parse error', e); }
        return true;
    }

    function wpsProcessOpenTokens(element) {
        if (element.dataset.fcmShareProcessed === '1') return;
        const html = element.innerHTML;
        if (!html || !html.includes(WPS_OPEN_MARK)) return;
        const replaced = html.replace(
            /\[LIKOSHARE_OPEN\s+(\d+)\s+(\d+)\]/g,
            (m, sharedAt, memberNumber) => {
                const key = `${sharedAt}:${memberNumber}`;
                const payload = _wpsCache.get(key) || (window.__LIKOSHARE_CACHE__ && window.__LIKOSHARE_CACHE__.get(key));
                if (!payload) return m;
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
                    const payload = _wpsCache.get(el.dataset.key) || (window.__LIKOSHARE_CACHE__ && window.__LIKOSHARE_CACHE__.get(el.dataset.key));
                    if (!payload) return;
                    const p = payload.profile;
                    try { const C = CharacterLoadOnline(JSON.parse(p.characterBundle), p.memberNumber); InformationSheetLoadCharacter(C); } catch (error) { warnLimited('WPS shared profile open failed', error); }
                    // 檢視恆可（資料已在分享時完整送達、存於記憶體）；僅在啟用儲存時才落地寫入 DB
                    if (PDB.db && cfg.saveMode !== 'off') { const tx = PDB.db.transaction('profiles', 'readwrite'); const store = tx.objectStore('profiles'); const req = store.get(p.memberNumber); req.onsuccess = () => { const local = req.result; if (!local || p.seen > local.seen) store.put(p); }; }
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

export { WPS_PREFIX, wpsShareProfile, wpsHandleMessage, wpsProcessOpenTokens, observeWpsOpenTokens };

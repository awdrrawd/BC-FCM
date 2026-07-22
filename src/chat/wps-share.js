import { PDB } from '../data/profile-db.js';
import { cfg } from '../core/config.js';
import { T } from '../i18n/i18n.js';
// ════════════════════════════════════════
//  FCM module: wps-share.js
//  (split from Plugins/liko-FCM.user.js)
// ════════════════════════════════════════

    const WPS_PREFIX    = '[LIKOSHARE]';
    const WPS_OPEN_MARK = 'LIKOSHARE_OPEN';
    const WPS_CHUNK     = 800;
    const _wpsIncoming  = new Map();
    const _wpsCache     = new Map();
    if (!window.__LIKOSHARE_CACHE__) window.__LIKOSHARE_CACHE__ = _wpsCache;
    async function wpsShareProfile(memberNumber) {
        if (!PDB.db) return;
        const mn = parseInt(memberNumber);
        const prof = await PDB.get(mn);
        if (!prof) return;
        const payload = {
            sharedAt: Date.now(),
            from: { memberNumber: Player?.MemberNumber, name: Player?.Nickname || Player?.Name || String(Player?.MemberNumber) },
            profile: { memberNumber: prof.memberNumber, name: prof.name, lastNick: prof.lastNick, seen: prof.seen, characterBundle: prof.characterBundle }
        };
        const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
        const shareId = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const total = Math.ceil(encoded.length / WPS_CHUNK);
        for (let i = 0; i < total; i++) {
            ServerSend('ChatRoomChat', { Type: 'Hidden', Content: `${WPS_PREFIX} ${shareId} ${i+1}/${total} ${encoded.slice(i*WPS_CHUNK, (i+1)*WPS_CHUNK)}` });
        }
        const displayName = prof.lastNick || prof.name || mn;
        if (typeof ChatRoomSendLocal === 'function') ChatRoomSendLocal(T('shareLocalMsg', displayName, mn), 0);
    }

    function wpsHandleMessage(data) {
        if (!data?.Content?.startsWith(WPS_PREFIX)) return false;
        if (window.LikoWPSInstance && window.__LIKOSHARE_CACHE__ !== _wpsCache) return false;
        try {
            const parts = data.Content.split(' ');
            const shareId = parts[1];
            const [idx, total] = parts[2].split('/').map(Number);
            const chunk = parts.slice(3).join(' ');
            if (!_wpsIncoming.has(shareId)) _wpsIncoming.set(shareId, { total, chunks: [] });
            const entry = _wpsIncoming.get(shareId);
            entry.chunks[idx - 1] = chunk;
            if (entry.chunks.filter(Boolean).length === entry.total) {
                _wpsIncoming.delete(shareId);
                const payload = JSON.parse(decodeURIComponent(escape(atob(entry.chunks.join('')))));
                const key = `${payload.sharedAt}:${payload.profile.memberNumber}`;
                _wpsCache.set(key, payload);
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
                setTimeout(() => document.querySelectorAll('.ChatMessageLocalMessage').forEach(wpsProcessOpenTokens), 200);
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
                return `<span class="fcmShareOpen" data-key="${key}" style="color:#885CB0;cursor:pointer;user-select:none;">${T('shareOpen')}</span>`;
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
                    try { const C = CharacterLoadOnline(JSON.parse(p.characterBundle), p.memberNumber); InformationSheetLoadCharacter(C); } catch {}
                    // 檢視恆可（資料已在分享時完整送達、存於記憶體）；僅在啟用儲存時才落地寫入 DB
                    if (PDB.db && cfg.saveMode !== 'off') { const tx = PDB.db.transaction('profiles', 'readwrite'); const store = tx.objectStore('profiles'); const req = store.get(p.memberNumber); req.onsuccess = () => { const local = req.result; if (!local || p.seen > local.seen) store.put(p); }; }
                });
            });
        }
    }

export { WPS_PREFIX, wpsShareProfile, wpsHandleMessage, wpsProcessOpenTokens };

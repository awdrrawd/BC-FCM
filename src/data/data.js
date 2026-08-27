import { T } from '../i18n/i18n.js';
import { profileCache as _pc } from './profile-cache.js';
import { cfg, saveCfg } from '../core/config.js';
// ════════════════════════════════════════
//  FCM module: data.js
//  (split from Plugins/liko-FCM.user.js)
// ════════════════════════════════════════

    let onlineFriends = [];
    // ═══════════════════════════════════════════════════════════
    //  DATA HELPERS
    // ═══════════════════════════════════════════════════════════
    // AFC 戀人清單：優先用 AFC 公開 API（window.Liko.AFC）；退而讀 OnlineSharedSettings.AFC.lovers；
    //  最後才回退舊版 ExtensionSettings.AFC.l（AFC v0.7.0 起戀人已不存於此，僅為相容舊資料）。
    function parseAFC() {
        try {
            const A = window.Liko && window.Liko.AFC;
            if (A && typeof A.getLovers === 'function') {
                return A.getLovers().map(e => ({ MemberNumber: parseInt(e.memberNumber), Name: e.name || '', addedAt: e.startDate || 0 }));
            }
            const shared = Player && Player.OnlineSharedSettings && Player.OnlineSharedSettings.AFC;
            if (shared && Array.isArray(shared.lovers)) {
                return shared.lovers.map(e => ({ MemberNumber: parseInt(e.memberNumber), Name: e.name || '', addedAt: e.startDate || 0 }));
            }
            let afc = Player && Player.ExtensionSettings && Player.ExtensionSettings.AFC;
            if (!afc) return [];
            if (typeof afc === 'string') afc = JSON.parse(afc);
            return (afc.l || []).map(e => ({ MemberNumber: parseInt(e[0]), Name: e[1] || '', addedAt: e[3] || 0 }));
        } catch { return []; }
    }
    function getSubSet() {
        const s = new Set();
        try { const list = Player && Player.SubmissivesList; if (list) { const arr = Array.isArray(list) ? list : (list instanceof Set ? Array.from(list) : []); arr.forEach(x => { const mn = parseInt(typeof x === 'object' ? (x.MemberNumber || x) : x); if (mn) s.add(mn); }); } } catch {}
        try { (ChatRoomCharacter || []).forEach(C => { if (C.Ownership && parseInt(C.Ownership.MemberNumber) === parseInt(Player.MemberNumber)) s.add(parseInt(C.MemberNumber)); }); } catch {}
        return s;
    }
    function getRel(mn) {
        mn = parseInt(mn); if (!Player || mn === parseInt(Player.MemberNumber)) return 'none';
        if (Player.Ownership && parseInt(Player.Ownership.MemberNumber) === mn) return 'owner';
        if (Player.Lovership && Player.Lovership.some(l => parseInt(l.MemberNumber) === mn)) return 'lover';
        if (parseAFC().some(l => parseInt(l.MemberNumber) === mn)) return 'lover';
        if (getSubSet().has(mn)) return 'sub';
        if (Player.FriendNames && Player.FriendNames.has(mn)) return 'friend';
        const _of = onlineFriends.find(f => f.MemberNumber === mn);
        if (_of && _of.Type === 'Friend') return 'friend';
        if (Player.FriendList && Player.FriendList.includes(mn)) return 'contact';
        if (Player.WhiteList && Player.WhiteList.includes(mn)) return 'whitelist';
        if (Player.BlackList && Player.BlackList.includes(mn)) return 'blacklist';
        return 'none';
    }
    function getAllRels(mn) {
        mn = parseInt(mn); if (!Player || mn === parseInt(Player.MemberNumber)) return ['none'];
        const roles = [];
        if (Player.Ownership && parseInt(Player.Ownership.MemberNumber) === mn) roles.push('owner');
        if ((Player.Lovership && Player.Lovership.some(l => parseInt(l.MemberNumber) === mn)) || parseAFC().some(l => parseInt(l.MemberNumber) === mn)) roles.push('lover');
        if (getSubSet().has(mn)) roles.push('sub');
        if (!roles.length && Player.FriendNames && Player.FriendNames.has(mn)) roles.push('friend');
        const _of2 = onlineFriends.find(f => f.MemberNumber === mn);
        if (!roles.length && _of2 && _of2.Type === 'Friend') roles.push('friend');
        if (!roles.length && Player.FriendList && Player.FriendList.includes(mn)) roles.push('contact');
        if (Player.WhiteList && Player.WhiteList.includes(mn)) roles.push('whitelist');
        if (Player.BlackList && Player.BlackList.includes(mn)) roles.push('blacklist');
        try { if (Player.GhostList && Player.GhostList.includes(mn)) roles.push('ghost'); } catch {}
        return roles.length ? roles : ['none'];
    }
    const REL_ORDER = { owner: 0, lover: 1, sub: 2, friend: 3, contact: 4, whitelist: 5, blacklist: 6, none: 7 };

    let showNickname = true;
    // nickOverride: undefined = 依目前的顯示切換(showNickname)；true/false = 強制指定（供搜尋比對用，不受切換影響）
    function getDisplayName(mn, nickOverride) {
        mn = parseInt(mn);
        const useNick = nickOverride !== undefined ? nickOverride : showNickname;
        // 1. 在線角色（房間內）
        const C = ChatRoomCharacter && ChatRoomCharacter.find(c => c.MemberNumber === mn);
        if (C) {
            if (useNick && typeof CharacterNickname === 'function') {
                const n = CharacterNickname(C); if (n) return n;
            }
            return C.Name || `#${mn}`;
        }
        // 2. 線上好友
        const online = onlineFriends.find(f => f.MemberNumber === mn);
        if (online) {
            // 優先檢查快取暱稱
            if (useNick) {
                const cached = _pc[mn];
                if (cached && cached.lastNick) return cached.lastNick;
            }
            if (online.MemberName) return online.MemberName;
        }
        // 3. ★ 對所有離線玩家，先查 _pc 快取的暱稱
        if (useNick) {
            const cached = _pc[mn];
            if (cached && cached.lastNick) return cached.lastNick;
        }
        // 4. fallback：各種關係資料中的名稱
        if (Player.FriendNames && Player.FriendNames.get(mn)) return Player.FriendNames.get(mn);
        const lover = Player.Lovership && Player.Lovership.find(l => parseInt(l.MemberNumber) === mn);
        if (lover && lover.Name) return lover.Name;
        const afc = parseAFC().find(l => l.MemberNumber === mn);
        if (afc && afc.Name) return afc.Name;
        if (Player.Ownership && parseInt(Player.Ownership.MemberNumber) === mn)
            return Player.Ownership.Name || `#${mn}`;
        // 5. 最後用快取的 BC 名稱
        const cached = _pc[mn];
        if (cached) return cached.name || `#${mn}`;
        return `#${mn}`;
    }

    // 搜尋比對：不論目前顯示切換是「名稱」還是「暱稱」，都同時比對 ID／BC 名稱／暱稱三者，
    //  避免「顯示暱稱時搜不到名稱、顯示名稱時搜不到暱稱」的問題。
    function matchesSearch(mn, q) {
        if (!q) return true;
        q = String(q).trim().toLowerCase();
        if (!q) return true;
        if (String(mn).includes(q)) return true;
        if (getDisplayName(mn, true).toLowerCase().includes(q)) return true;
        if (getDisplayName(mn, false).toLowerCase().includes(q)) return true;
        return false;
    }

    function buildFriendList() {
        const seen = new Set(), rows = [], selfMn = parseInt(Player.MemberNumber);
        function add(mn, addedAt) { mn = parseInt(mn); if (!mn || mn === selfMn || seen.has(mn)) return; seen.add(mn); rows.push({ mn, addedAt: addedAt || 0 }); }
        if (Player.Ownership && Player.Ownership.MemberNumber) add(Player.Ownership.MemberNumber, Player.Ownership.Start || 0);
        (Player.Lovership || []).forEach(l => add(l.MemberNumber, l.Start || 0));
        parseAFC().forEach(l => add(l.MemberNumber, l.addedAt));
        try { const list = Player.SubmissivesList; if (list) { const arr = Array.isArray(list) ? list : (list instanceof Set ? Array.from(list) : []); arr.forEach(x => { const mn = typeof x === 'object' ? (x.MemberNumber || 0) : x; add(parseInt(mn), typeof x === 'object' ? (x.Start || 0) : 0); }); } } catch {}
        (ChatRoomCharacter || []).forEach(C => { if (C.Ownership && parseInt(C.Ownership.MemberNumber) === selfMn) add(C.MemberNumber, 0); });
        if (Player.FriendNames) for (const [mn] of Player.FriendNames) add(mn, 0);
        (Player.FriendList || []).forEach(mn => add(mn, 0));
        (Player.WhiteList || []).forEach(mn => add(mn, 0));
        (Player.BlackList || []).forEach(mn => add(mn, 0));
        try { (Player.GhostList || []).forEach(mn => add(mn, 0)); } catch {}
        return rows.filter(r => r.mn !== selfMn).map(r => ({ mn: r.mn, addedAt: r.addedAt, name: getDisplayName(r.mn), rel: getRel(r.mn) }));
    }
    function getZone(mn) {
        mn = parseInt(mn);
        const inRoomC = ChatRoomCharacter && ChatRoomCharacter.find(c => c.MemberNumber === mn);
        if (inRoomC) { const sp = inRoomC.Pronouns || inRoomC.Gender || ''; if (sp === 'M') return T('zoneM'); return T('zoneF'); }
        const f = onlineFriends.find(f => f.MemberNumber === mn);
        if (!f) return null;
        const sp = f.ChatRoomSpace !== undefined ? f.ChatRoomSpace : '';
        if (sp === 'M') return T('zoneM'); if (sp === 'X' || sp === 'B') return T('zoneX'); return T('zoneF');
    }
    function getRoomInfo(mn) {
        mn = parseInt(mn);
        const inRoomC = ChatRoomCharacter && ChatRoomCharacter.find(c => c.MemberNumber === mn);
        if (inRoomC && ChatRoomData) return { name: ChatRoomData.Name, isPrivate: !!(ChatRoomData.Private), isCurrent: true };
        const f = onlineFriends.find(f => f.MemberNumber === mn);
        if (!f) return null;
        // 依 BC ServerFriendInfo：房間人數/上限已隨線上好友資料一併回傳，直接採用可省去額外查詢
        const mc = f.ChatRoomMemberCount ?? null, ml = f.ChatRoomLimit ?? null;
        if (f.ChatRoomName) return { name: f.ChatRoomName, isPrivate: !!(f.Private), isCurrent: false, memberCount: mc, memberLimit: ml };
        if (f.Private) {
            // 私人房伺服器隱藏房名；若對方是 AFC 戀人且已分享房名，改用 AFC 公開 API 取得 → 可顯示並加入
            try {
                const lr = window.Liko && window.Liko.AFC && typeof window.Liko.AFC.getLoverRoom === 'function'
                    ? window.Liko.AFC.getLoverRoom(mn) : null;
                if (lr && lr.ChatRoomName) return { name: lr.ChatRoomName, isPrivate: true, isCurrent: false, memberCount: mc, memberLimit: ml };
            } catch {}
            return { name: null, isPrivate: true, isCurrent: false };
        }
        return null;
    }
    function getRoomPerms(mn) {
        if (!ChatRoomData) return ['visit']; mn = parseInt(mn);
        const p = []; if (ChatRoomData.Admin && ChatRoomData.Admin.includes(mn)) p.push('admin'); if (ChatRoomData.Whitelist && ChatRoomData.Whitelist.includes(mn)) p.push('pass'); if (ChatRoomData.Ban && ChatRoomData.Ban.includes(mn)) p.push('ban'); if (!p.length) p.push('visit'); return p;
    }
    function amAdmin() { return !!(ChatRoomData && ChatRoomData.Admin && ChatRoomData.Admin.includes(Player.MemberNumber)); }
    function inRoomFn(mn) { return !!(ChatRoomCharacter && ChatRoomCharacter.find(c => c.MemberNumber === parseInt(mn))); }
    function isFriendOf(mn) { return !!(Player.FriendList && Player.FriendList.includes(parseInt(mn))); }
    function canBeep(mn) {
        mn = parseInt(mn);
        if (inRoomFn(mn)) return true;
        const rel = getRel(mn);
        if (rel === 'owner' || rel === 'lover' || rel === 'sub') return true;
        const _of = onlineFriends.find(f => f.MemberNumber === mn);
        return !!(_of && _of.Type === 'Friend');
    }

    // ─── Detect current whisper target MN ────────────────────────
    function _getWhisperTargetMN() {
        try {
            // Check input value for /w /whisper /beep commands first —
            // a resolved command target takes priority over a clicked name.
            const el = document.getElementById('InputChat');
            if (el) {
                const v = el.value;
                // Numeric ID: /w 12345 or /beep 12345
                const mNum = v.match(/^\/(w|whisper|beep)\s+(\d+)/i);
                if (mNum) return parseInt(mNum[2]);
                // Name match: /w somename — search in room then online friends
                const mName = v.match(/^\/(w|whisper)\s+(.+)/i);
                if (mName) {
                    const query = mName[2].trim().toLowerCase();
                    if (query) {
                        // Search in current room
                        if (ChatRoomCharacter) {
                            const found = ChatRoomCharacter.find(c => {
                                const nick = (typeof CharacterNickname === 'function' ? CharacterNickname(c) : '') || '';
                                return c.Name.toLowerCase().startsWith(query) || nick.toLowerCase().startsWith(query);
                            });
                            if (found) return found.MemberNumber;
                        }
                        // Search in online friends
                        const ff = onlineFriends.find(f => (f.MemberName||'').toLowerCase().startsWith(query));
                        if (ff) return ff.MemberNumber;
                        // Search in profile cache (names)
                        for (const [mn, p] of Object.entries(_pc)) {
                            if (!p) continue;
                            if ((p.name||'').toLowerCase().startsWith(query) || (p.lastNick||'').toLowerCase().startsWith(query)) return parseInt(mn);
                        }
                    }
                    // Command typed but no name matched yet — fall through to
                    // ChatRoomTargetMemberNumber below instead of forcing null.
                }
            }
            // BC global: set when player clicks on someone in chat.
            // Used as fallback when no /w /whisper /beep command resolved a target.
            if (typeof ChatRoomTargetMemberNumber !== 'undefined' && ChatRoomTargetMemberNumber > 0) return ChatRoomTargetMemberNumber;
        } catch {}
        return null;
    }
    // ── 最愛（個人關係頁星號）：存於 cfg.favorites，隨 cfg 一併持久化 ──
    function isFav(mn) { return (cfg.favorites || []).includes(parseInt(mn)); }
    function toggleFav(mn) {
        mn = parseInt(mn);
        const list = cfg.favorites || (cfg.favorites = []);
        const i = list.indexOf(mn);
        if (i >= 0) list.splice(i, 1); else list.push(mn);
        saveCfg();
        return i < 0;   // true = 現在是最愛
    }
    function setOnlineFriends(v) { onlineFriends = v; }
    function requestOnlineFriends() {
        try {
            if (typeof ServerSend !== 'function') return false;
            ServerSend('AccountQuery', { Query: 'OnlineFriends' });
            return true;
        } catch {
            return false;
        }
    }
    function setShowNickname(v) { showNickname = v; }

export { onlineFriends, setOnlineFriends, requestOnlineFriends, showNickname, setShowNickname, getRel, getAllRels, REL_ORDER, getDisplayName, matchesSearch, buildFriendList, getZone, getRoomInfo, getRoomPerms, amAdmin, inRoomFn, isFriendOf, canBeep, _getWhisperTargetMN, isFav, toggleFav };

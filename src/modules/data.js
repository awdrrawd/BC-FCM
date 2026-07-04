import { T } from './i18n.js';
import { _pc } from './profile-db.js';
// ════════════════════════════════════════
//  FCM module: data.js
//  (split from Plugins/liko-FCM.user.js)
// ════════════════════════════════════════

    let onlineFriends = [];
    // ═══════════════════════════════════════════════════════════
    //  DATA HELPERS
    // ═══════════════════════════════════════════════════════════
    function parseAFC() { try { let afc = Player && Player.ExtensionSettings && Player.ExtensionSettings.AFC; if (!afc) return []; if (typeof afc === 'string') afc = JSON.parse(afc); return (afc.l || []).map(e => ({ MemberNumber: parseInt(e[0]), Name: e[1] || '', addedAt: e[3] || 0 })); } catch { return []; } }
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
    function getDisplayName(mn) {
        mn = parseInt(mn);
        // 1. 在線角色（房間內）
        const C = ChatRoomCharacter && ChatRoomCharacter.find(c => c.MemberNumber === mn);
        if (C) {
            if (showNickname && typeof CharacterNickname === 'function') {
                const n = CharacterNickname(C); if (n) return n;
            }
            return C.Name || `#${mn}`;
        }
        // 2. 線上好友
        const online = onlineFriends.find(f => f.MemberNumber === mn);
        if (online) {
            // 優先檢查快取暱稱
            if (showNickname) {
                const cached = _pc[mn];
                if (cached && cached.lastNick) return cached.lastNick;
            }
            if (online.MemberName) return online.MemberName;
        }
        // 3. ★ 對所有離線玩家，先查 _pc 快取的暱稱
        if (showNickname) {
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
        if (f.ChatRoomName) return { name: f.ChatRoomName, isPrivate: !!(f.Private), isCurrent: false };
        if (f.Private) return { name: null, isPrivate: true, isCurrent: false };
        return null;
    }
    function getRoomName(mn) { const r = getRoomInfo(mn); return r ? r.name : null; }
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
            // BC global: set when player clicks on someone in chat
            if (typeof ChatRoomTargetMemberNumber !== 'undefined' && ChatRoomTargetMemberNumber > 0) return ChatRoomTargetMemberNumber;
            // Check input value for /w /whisper /beep commands
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
                    if (!query) return null;
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
            }
        } catch {}
        return null;
    }
    function setOnlineFriends(v) { onlineFriends = v; }
    function setShowNickname(v) { showNickname = v; }

export { onlineFriends, setOnlineFriends, showNickname, setShowNickname, parseAFC, getSubSet, getRel, getAllRels, REL_ORDER, getDisplayName, buildFriendList, getZone, getRoomInfo, getRoomName, getRoomPerms, amAdmin, inRoomFn, isFriendOf, canBeep, _getWhisperTargetMN };

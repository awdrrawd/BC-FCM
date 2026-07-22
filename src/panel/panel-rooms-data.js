// ════════════════════════════════════════
//  FCM module: panel-rooms-data.js  (split from panel.js)
//  房間搜尋 / 房間資訊快取。被「好友」與「房間搜尋」兩頁共用。
//  _roomResults 由房間搜尋頁寫入，getCachedRoomInfo 會讀取，故以 getter/setter 共享。
// ════════════════════════════════════════

let _roomResults = [];
const _roomCache = new Map();
const _pendingRoomQueries = new Set();

function getRoomResults() { return _roomResults; }
function setRoomResults(v) { _roomResults = v || []; }

function _cacheRooms(rooms) {
    const now = Date.now();
    for (const r of rooms) {
        if (!r.Name) continue;
        const mc = r.MemberCount ?? r.NbMember ?? null;
        const ml = r.MemberLimit ?? r.Limit ?? null;
        const existing = _roomCache.get(r.Name);
        if (!existing || mc !== null || ml !== null) {
            _roomCache.set(r.Name, { MemberCount: mc, MemberLimit: ml, Space: r.Space ?? r.ChatRoomSpace ?? '', ts: now });
        }
    }
}

async function doRoomSearch(query, zone) {
    try {
        const res = await ServerRoomSearch(query || '', { Language: '', Space: zone, Game: '', FullRooms: false });
        if (!res || res.err || !res.value) return [];
        _cacheRooms(res.value);
        return res.value;
    } catch(e) { console.warn('🐈‍⬛ [FCM] doRoomSearch:', e); return []; }
}

async function queryRoomInfo(roomName, space, onUpdate) {
    if (_pendingRoomQueries.has(roomName)) return;
    _pendingRoomQueries.add(roomName);
    try {
        const zones = space !== undefined ? [space, 'X', '', 'M'] : ['X', '', 'M'];
        for (const z of [...new Set(zones)]) {
            try {
                const res = await ServerRoomSearch(roomName, { Language: '', Space: z, Game: '', FullRooms: false });
                if (!res || res.err || !res.value) continue;
                const found = res.value.find(r => r.Name === roomName);
                if (found) { _cacheRooms([found]); if (onUpdate) onUpdate(_roomCache.get(roomName)); break; }
            } catch {}
        }
    } finally { _pendingRoomQueries.delete(roomName); }
}

function getCachedRoomInfo(roomName) {
    const cached = _roomCache.get(roomName); if (cached) return cached;
    const fromResults = _roomResults.find(r => r.Name === roomName);
    if (fromResults) { const mc = fromResults.MemberCount ?? fromResults.NbMember ?? null; const ml = fromResults.MemberLimit ?? fromResults.Limit ?? null; return mc !== null || ml !== null ? { MemberCount: mc, MemberLimit: ml } : null; }
    return null;
}

// 依房名即時查詢並回傳「完整」房間物件（含 Creator/Description/人數等），查不到回傳 null。
//  好友所在房間本身沒有作者/描述資料，點「前往」時用此補齊詳細資訊。
async function fetchRoomFull(roomName, space) {
    const zones = space !== undefined && space !== null ? [space, 'X', '', 'M'] : ['X', '', 'M'];
    for (const z of [...new Set(zones)]) {
        try {
            const res = await ServerRoomSearch(roomName, { Language: '', Space: z, Game: '', FullRooms: false });
            if (!res || res.err || !res.value) continue;
            const found = res.value.find(r => r.Name === roomName);
            if (found) { _cacheRooms(res.value); return found; }
        } catch {}
    }
    return null;
}

export { getRoomResults, setRoomResults, _cacheRooms, doRoomSearch, queryRoomInfo, getCachedRoomInfo, fetchRoomFull };

// ════════════════════════════════════════

import { warnLimited } from '../core/logger.js';
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
            // CHAT 與主面板共用同一份快取；不能只留下人數，否則 CHAT 的房間框
            // 會遺失主面板查詢結果中的描述、建立者與私密狀態。
            _roomCache.set(r.Name, {
                ...existing,
                ...r,
                MemberCount: mc,
                MemberLimit: ml,
                Space: r.Space ?? r.ChatRoomSpace ?? existing?.Space ?? '',
                ts: now,
            });
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
            } catch (error) { warnLimited(`favorite room lookup failed (${roomName})`, error); }
        }
    } finally { _pendingRoomQueries.delete(roomName); }
}

function getCachedRoomInfo(roomName) {
    const cached = _roomCache.get(roomName); if (cached) return cached;
    const fromResults = _roomResults.find(r => r.Name === roomName);
    if (fromResults) {
        const mc = fromResults.MemberCount ?? fromResults.NbMember ?? null;
        const ml = fromResults.MemberLimit ?? fromResults.Limit ?? null;
        return { ...fromResults, MemberCount: mc, MemberLimit: ml };
    }
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
        } catch (error) { warnLimited(`room lookup failed (${roomName})`, error); }
    }
    return null;
}

export { getRoomResults, setRoomResults, doRoomSearch, queryRoomInfo, getCachedRoomInfo, fetchRoomFull };

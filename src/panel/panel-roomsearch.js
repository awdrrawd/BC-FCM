import { attachSearchClear } from '../ui/search-clear.js';
import { T } from '../i18n/i18n.js';
import { onlineFriends } from '../data/data.js';
import { showRoomJoinConfirm, roomInfoFromResult, shareRoomToChat } from '../chat/actions.js';
import { mkBtn } from './panel-widgets.js';
import { getRoomResults, setRoomResults, doRoomSearch } from './panel-rooms-data.js';
import { cfg, saveCfg } from '../core/config.js';
// ════════════════════════════════════════
//  FCM module: panel-roomsearch.js  (split from panel.js)
//  房間搜尋頁。_roomZoneFilter / _roomSearchQ2 / _roomSortMode / _favRooms 為本頁狀態；
//  closePanel 透過 resetRoomSearchQuery 清空搜尋字串。
// ════════════════════════════════════════

let _roomZoneFilter = 'X';
let _roomSearchQ2 = '';
let _favRooms = null;
let _roomSortMode = 'fav';

function saveFavRooms() { cfg.favoriteRooms = [..._favRooms]; saveCfg(); }
function resetRoomSearchQuery() { _roomSearchQ2 = ''; }

async function renderRoomSearch(container) {
    _favRooms ??= new Set(Array.isArray(cfg.favoriteRooms) ? cfg.favoriteRooms : []);
    container.innerHTML = '';
    const wrap = document.createElement('div'); wrap.style.cssText = 'display:flex;flex-direction:column;height:100%;';

    const tb = document.createElement('div'); tb.className = 'fcm-toolbar';
    // (left refresh button removed in v1.3.5 — right side already has one)

    const sw = document.createElement('div'); sw.style.cssText = 'position:relative;display:inline-flex;align-items:center;flex:1;min-width:120px;max-width:200px;';
    const inp = document.createElement('input'); inp.className = 'fcm-search'; inp.placeholder = T('roomSearch2'); inp.value = _roomSearchQ2; inp.style.width = '100%';
    sw.appendChild(inp); tb.appendChild(sw);
    attachSearchClear(inp, { onClear: () => { _roomSearchQ2 = ''; } });

    const srchBtn = mkBtn(T('roomSearchBtn'), 'fcm-btn', () => runSearch());
    srchBtn.style.cssText = 'padding:5px 10px;border-radius:8px;border:1.5px solid #4038a0;background:#1e1635;color:#b098d0;font-size:12px;font-weight:600;cursor:pointer;flex-shrink:0;';
    tb.appendChild(srchBtn);

    const zoneColors = {
        'X': { bg: '#1e1635', active: '#2e2650', label: T('roomMixed') },
        '':  { bg: '#2a1020', active: '#7a2040', label: T('roomFemale') },
        'M': { bg: '#101828', active: '#1a4070', label: T('roomMale') }
    };
    const zoneGroup = document.createElement('div'); zoneGroup.className = 'fcm-zone-filter'; zoneGroup.style.cssText = 'display:flex;gap:3px;';
    Object.entries(zoneColors).forEach(([z, info]) => {
        const b = document.createElement('button'); b.className = 'fcm-zone-filter-btn'; b.setAttribute('data-space', z); b.textContent = info.label;
        const isActive = _roomZoneFilter === z;
        b.classList.toggle('active', isActive);
        b.style.cssText = `padding:5px 10px;border-radius:8px;border:1.5px solid ${isActive ? '#d0b8ff' : '#4038a0'};background:${isActive ? info.active : info.bg};color:${isActive ? '#fff' : '#9070b0'};font-size:12px;font-weight:${isActive ? '700' : '400'};cursor:pointer;white-space:nowrap;`;
        b.addEventListener('click', () => {
            _roomZoneFilter = z;
            zoneGroup.querySelectorAll('[data-space]').forEach(x => {
                const xz = x.getAttribute('data-space'), xi = zoneColors[xz], xa = xz === z;
                x.classList.toggle('active', xa);
                x.style.background = xa ? xi.active : xi.bg; x.style.borderColor = xa ? '#d0b8ff' : '#4038a0';
                x.style.color = xa ? '#fff' : '#9070b0'; x.style.fontWeight = xa ? '700' : '400';
            });
            runSearch();
        });
        zoneGroup.appendChild(b);
    });
    tb.appendChild(zoneGroup);
    tb.appendChild(Object.assign(document.createElement('span'), { className: 'fcm-spacer' }));
    const sLbl = document.createElement('span'); sLbl.className = 'fcm-lbl-sm'; sLbl.textContent = T('sortBy') + ':'; tb.appendChild(sLbl);
    const sortSel = document.createElement('select'); sortSel.className = 'fcm-sel';
    [['fav', T('sortFavFirst')], ['friend', T('sortFriendFirst')], ['name', T('sortNameOnly')]].forEach(([v, l]) => {
        const o = document.createElement('option'); o.value = v; o.textContent = l; if (v === _roomSortMode) o.selected = true; sortSel.appendChild(o);
    });
    sortSel.addEventListener('change', () => { _roomSortMode = sortSel.value; renderResults(); });
    tb.appendChild(sortSel);
    const rBtn = mkBtn('↻', 'fcm-btn', () => runSearch());
    rBtn.style.cssText = 'padding:4px 7px;border-radius:50%;font-size:13px;flex-shrink:0;';
    tb.appendChild(rBtn);
    wrap.appendChild(tb);

    const scroll = document.createElement('div'); scroll.className = 'fcm-scroll fcm-roomsearch-scroll'; scroll.style.cssText = 'flex:1;overflow-y:auto;';
    const countEl = document.createElement('div'); countEl.className = 'fcm-count'; countEl.style.textAlign = 'center';
    wrap.appendChild(scroll); wrap.appendChild(countEl);
    container.appendChild(wrap);

    // Bug fix: stopPropagation on room search input
    inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') runSearch(); });

    async function runSearch() {
        _roomSearchQ2 = inp.value;
        srchBtn.textContent = T('roomSearching'); srchBtn.disabled = true;
        setRoomResults(await doRoomSearch(_roomSearchQ2, _roomZoneFilter));
        srchBtn.textContent = T('roomSearchBtn'); srchBtn.disabled = false;
        renderResults();
    }

    function renderResults() {
        scroll.innerHTML = '';
        const currentRoomName = (typeof ChatRoomData !== 'undefined' && ChatRoomData) ? ChatRoomData.Name : null;
        let list = [...getRoomResults()].sort((a, b) => {
            const aF = _favRooms.has(a.Name) ? 1 : 0, bF = _favRooms.has(b.Name) ? 1 : 0;
            const aFr = onlineFriends.filter(f => f.ChatRoomName === a.Name).length;
            const bFr = onlineFriends.filter(f => f.ChatRoomName === b.Name).length;
            if (_roomSortMode === 'fav') return bF - aF || bFr - aFr || (a.Name||'').localeCompare(b.Name||'');
            if (_roomSortMode === 'friend') return bFr - aFr || bF - aF || (a.Name||'').localeCompare(b.Name||'');
            return (a.Name||'').localeCompare(b.Name||'');
        });
        if (!list.length) {
            const em = document.createElement('div'); em.className = 'fcm-empty'; em.textContent = T('roomSearchEmpty');
            scroll.appendChild(em); countEl.textContent = T('totalRooms', 0); return;
        }
        countEl.textContent = T('totalRooms', list.length);
        list.forEach(room => {
            const isFav = _favRooms.has(room.Name);
            const isCurrent = !!(currentRoomName && room.Name === currentRoomName);
            const friendsHere = onlineFriends.filter(f => f.ChatRoomName === room.Name);
            const mc = room.MemberCount ?? room.NbMember ?? null;
            const ml = room.MemberLimit ?? room.Limit ?? null;
            const cStr = mc !== null ? `(${mc}${ml !== null ? '/'+ml : ''})` : '';
            const card = document.createElement('div'); card.className = 'fcm-room-card';
            // Priority: current room (pink) > fav (gold) > friends (green) > default
            // 不管房間有沒有特別屬性，都給完整外框＋相同 margin，避免「加入」按鈕因為預設房間只有
            // border-bottom 而少了左右邊框寬度，導致每列的按鈕排序（水平位置）跟有色框的房間對不齊。
            let cardBorder, stateCls;
            if (isCurrent) {
                cardBorder = 'border:2px solid #e060a0;border-radius:8px;margin:3px 4px;background:rgba(220,80,140,.08);';
                stateCls = 'fcm-room-current';
            } else if (isFav) {
                cardBorder = 'border:1.5px solid #c8a020;border-radius:8px;margin:3px 4px;background:rgba(200,160,32,.06);';
                stateCls = 'fcm-room-fav';
            } else if (friendsHere.length > 0) {
                cardBorder = 'border:1.5px solid #409060;border-radius:8px;margin:3px 4px;background:rgba(40,128,64,.06);';
                stateCls = 'fcm-room-friend';
            } else {
                cardBorder = 'border:1.5px solid #2a2048;border-radius:8px;margin:3px 4px;background:transparent;';
                stateCls = 'fcm-room-default';
            }
            card.classList.add(stateCls);
            card.style.cssText = `display:flex;align-items:center;gap:10px;padding:10px 12px;transition:background .1s,border-color .1s;${cardBorder}`;
            card.addEventListener('mouseenter', () => { if (!isFav && !friendsHere.length && !isCurrent) card.style.background = '#261a4a'; });
            card.addEventListener('mouseleave', () => { if (!isFav && !friendsHere.length && !isCurrent) card.style.background = ''; });
            // 房間屬性判定（依 BC 原碼：Access/Visibility 非 ["All"] 即上鎖/私人；MapType 判類型）
            const isLocked = !!(room.Access && !(room.Access.length === 1 && room.Access[0] === 'All'));
            const canJoinRoom = room.CanJoin !== false;
            const isPriv = !!(room.Visibility && !(room.Visibility.length === 1 && room.Visibility[0] === 'All'));
            const typeLbl = room.MapType === 'Always' ? T('roomTypeMap') : room.MapType === 'Hybrid' ? T('roomTypeMix') : '';

            const info = document.createElement('div'); info.style.cssText = 'flex:1;min-width:0;';
            const line1 = document.createElement('div'); line1.style.cssText = 'display:flex;align-items:center;gap:5px;flex-wrap:wrap;';
            const favBtn = document.createElement('button');
            favBtn.style.cssText = 'font-size:15px;padding:0 3px;border:none;background:transparent;cursor:pointer;color:' + (isFav ? '#f0d060' : '#5040a0') + ';flex-shrink:0;';
            favBtn.textContent = isFav ? '★' : '☆';
            favBtn.addEventListener('click', e => { e.stopPropagation(); if (_favRooms.has(room.Name)) _favRooms.delete(room.Name); else _favRooms.add(room.Name); saveFavRooms(); renderResults(); });
            line1.appendChild(favBtn);
            // 🔒/🔓：只有上鎖的房間才顯示（依你的權限，可進為🔓、不可進為🔒）
            if (isLocked) { const lk = document.createElement('span'); lk.style.cssText = 'font-size:13px;flex-shrink:0;'; lk.textContent = canJoinRoom ? '🔓' : '🔒'; lk.title = canJoinRoom ? T('roomLockedCanJoin') : T('roomLockedNoAccess'); line1.appendChild(lk); }
            const nm = document.createElement('span'); nm.className = 'fcm-room-name'; nm.style.cssText = 'color:#e8c8ff;font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;'; nm.textContent = room.Name || '?'; nm.title = room.Name; line1.appendChild(nm);
            if (room.Creator) { const cr = document.createElement('span'); cr.className = 'fcm-room-creator'; cr.style.cssText = 'font-size:14px;color:#e8c8ff;font-weight:700;flex-shrink:0;'; cr.textContent = '- ' + room.Creator; line1.appendChild(cr); }
            if (cStr) { const cnt = document.createElement('span'); cnt.className = 'fcm-room-count'; cnt.style.cssText = 'color:#9878b8;font-size:12px;flex-shrink:0;'; cnt.textContent = cStr; line1.appendChild(cnt); }
            // 私人標籤移到人數之後
            if (isPriv) { const priv = document.createElement('span'); priv.style.cssText = 'font-size:11px;background:#2a1048;border:1px solid #8060b0;color:#c090f0;border-radius:6px;padding:2px 7px;flex-shrink:0;'; priv.textContent = T('roomPrivateLabel'); line1.appendChild(priv); }
            if (isCurrent) { const hereBadge = document.createElement('span'); hereBadge.style.cssText = 'font-size:11px;background:#3a0828;border:1px solid #e060a0;color:#ff90c0;border-radius:6px;padding:2px 7px;flex-shrink:0;font-weight:700;'; hereBadge.textContent = T('roomHereBadge'); line1.appendChild(hereBadge); }
            if (friendsHere.length > 0) { const fb = document.createElement('span'); fb.style.cssText = 'font-size:11px;background:#102038;border:1px solid #4080d8;color:#80c8ff;border-radius:6px;padding:2px 7px;flex-shrink:0;'; fb.textContent = `👥${friendsHere.length}: ${friendsHere.map(f => f.MemberName||'#'+f.MemberNumber).join(', ')}`; line1.appendChild(fb); }
            info.appendChild(line1);
            // 第二行：類型標籤（地圖／混合，普通不顯示）＋ 描述
            if (typeLbl || room.Description) {
                const line2 = document.createElement('div'); line2.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:2px;min-width:0;';
                if (typeLbl) { const tg = document.createElement('span'); tg.style.cssText = 'font-size:10px;background:#182a1a;border:1px solid #3a7048;color:#78d090;border-radius:5px;padding:1px 6px;flex-shrink:0;'; tg.textContent = typeLbl; line2.appendChild(tg); }
                if (room.Description) { const desc = document.createElement('span'); desc.className = 'fcm-room-desc'; desc.style.cssText = 'color:#7060a0;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'; desc.textContent = room.Description; line2.appendChild(desc); }
                info.appendChild(line2);
            }
            card.appendChild(info);
            // Join/Re-enter button
            const joinLabel = isCurrent ? T('roomReenter') : T('roomJoin');
            const joinCls   = isCurrent ? 'fcm-btn-orange' : 'fcm-btn-blue';
            // 加入／重新進入都先跳出詳細資訊確認框（房名／作者／人數／資訊）
            const joinBtn = mkBtn(joinLabel, joinCls, () => showRoomJoinConfirm(roomInfoFromResult(room)));
            joinBtn.style.cssText += ';padding:7px 16px;font-size:13px;font-weight:700;flex-shrink:0;';
            const btnRow2 = document.createElement('div'); btnRow2.style.cssText = 'display:flex;flex-direction:row;gap:5px;flex-shrink:0;';
            btnRow2.appendChild(joinBtn);
            // 分享按鈕：僅在聊天室中顯示，把房間資訊發送到聊天室（含 FCM 專屬加入按鈕）
            if (typeof ChatRoomData !== 'undefined' && ChatRoomData) {
                const shareBtn = mkBtn(T('roomShareBtn'), 'fcm-btn-purple', () => shareRoomToChat(room));
                shareBtn.style.cssText += ';padding:7px 16px;font-size:13px;font-weight:700;flex-shrink:0;';
                shareBtn.title = T('roomShareBtn');
                btnRow2.appendChild(shareBtn);
            }
            card.appendChild(btnRow2);
            scroll.appendChild(card);
        });
    }

    if (getRoomResults().length === 0) runSearch(); else renderResults();
}

export { renderRoomSearch, resetRoomSearchQuery };

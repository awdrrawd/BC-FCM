import { cfg } from '../core/config.js';
import { T } from '../i18n/i18n.js';
import { PDB, Snapshot } from '../data/profile-db.js';
import { onlineFriends, showNickname, setShowNickname, getDisplayName, matchesSearch, buildFriendList, getAllRels, REL_ORDER, getZone, getRoomInfo, amAdmin, inRoomFn, isFav } from '../data/data.js';
import { showRoomJoinConfirm, roomInfoFromResult, makeIdCell } from '../chat/actions.js';
import { makeAvEl, makeFavStar, makeRelEl, mkBtn, makeSearchWrap, makeSortSel, makeCountBar, buildMgmtBtns, buildPersonOps, _autoQueueVisible, refreshSnapshotsForList } from './panel-widgets.js';
import { queryRoomInfo, getCachedRoomInfo, fetchRoomFull } from './panel-rooms-data.js';
import { renderCurrent, refreshPanel, getRenderToken } from './panel.js';
// ════════════════════════════════════════
//  FCM module: panel-friends.js  (split from panel.js)
//  好友（個人關係）頁。searchQ / sortMode / filters 為本頁狀態；
//  closePanel 透過 resetFriendsSearch 清空搜尋字串。
// ════════════════════════════════════════

let searchQ = '', sortMode = 'fav';
const filters = { online: true, offline: false, owner: false, lover: false, sub: false, friend: false, whitelist: false, blacklist: false };

function resetFriendsSearch() { searchQ = ''; }

function applyFilters(f) {
    const online = isOnline(f.mn);
    const anyOnline = filters.online || filters.offline;
    if (anyOnline) { if (filters.online && !filters.offline && !online) return false; if (filters.offline && !filters.online && online) return false; }
    const anyRel = filters.owner || filters.lover || filters.sub || filters.friend || filters.whitelist || filters.blacklist;
    if (anyRel) {
        const roles = getAllRels(f.mn);
        const match = (filters.owner && roles.includes('owner')) || (filters.lover && roles.includes('lover')) || (filters.sub && roles.includes('sub'))
        || (filters.friend && (roles.includes('friend') || roles.includes('contact')))
        || (filters.whitelist && roles.includes('whitelist')) || (filters.blacklist && roles.includes('blacklist'));
        if (!match) return false;
    }
    return true;
}
function isOnline(mn) { mn = parseInt(mn); return !!(ChatRoomCharacter && ChatRoomCharacter.some(c => c.MemberNumber === mn)) || !!(onlineFriends.find(f => f.MemberNumber === mn)); }

async function renderFriends(container, _myToken) {
    container.innerHTML = '';
    const toolbar = document.createElement('div'); toolbar.className = 'fcm-toolbar';

    const { wrap: sw, inp: searchInp } = makeSearchWrap(searchQ, T('search'), val => {
        searchQ = val;
    }, 'fcm-search', () => renderCurrent());

    searchInp.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key === 'Enter') renderCurrent();
    });
    toolbar.appendChild(sw);
    const fl = document.createElement('span'); fl.className = 'fcm-lbl-sm'; fl.textContent = T('showOnly') + ':';
    toolbar.appendChild(fl);
    [['online', T('fOnline')], ['offline', T('fOffline')], ['owner', T('fOwner')], ['lover', T('fLover')], ['sub', T('fSub')], ['friend', T('fFriend')], ['whitelist', T('fWhitelist')], ['blacklist', T('fBlacklist')]].forEach(([key, label]) => {
        const b = document.createElement('button'); b.className = 'fcm-ftog' + (filters[key] ? ' on' : ''); b.textContent = label;
        b.addEventListener('click', () => { filters[key] = !filters[key]; b.classList.toggle('on', filters[key]); renderCurrent(); });
        toolbar.appendChild(b);
    });

    toolbar.appendChild(Object.assign(document.createElement('span'), { className: 'fcm-spacer' }));
    const nickBtn = document.createElement('button'); nickBtn.className = 'fcm-nick-tog'; nickBtn.textContent = showNickname ? T('togNick') : T('togName');
    nickBtn.title = showNickname ? T('togNickToBCName') : T('togNickToNick');
    nickBtn.addEventListener('click', () => { setShowNickname(!showNickname); renderCurrent(); });
    toolbar.appendChild(nickBtn);
    const { lbl: sl, sel: sortSel } = makeSortSel(sortMode, [['fav', T('sortFav')], ['rel', T('sortRel')], ['id', T('sortId')], ['name', T('sortName')], ['added', T('sortAdded')]], v => { sortMode = v; renderCurrent(); });
    toolbar.appendChild(sl); toolbar.appendChild(sortSel);
    // 手動刷新：即刻抓最新資料，但有 5 秒冷卻（refreshPanel 回 false = 冷卻中，短暫變灰提示）
    const rBtn = mkBtn('↻', 'fcm-btn', () => {
        if (!refreshPanel()) { rBtn.style.opacity = '0.35'; setTimeout(() => { rBtn.style.opacity = ''; }, 600); }
    });
    rBtn.title = T('btnRefresh'); rBtn.style.cssText = 'padding:4px 7px;border-radius:50%;font-size:13px;flex-shrink:0;';
    toolbar.appendChild(rBtn);
    const avBtn = mkBtn('📸', 'fcm-btn', () => { const curMns = friends.map(f => f.mn); refreshSnapshotsForList(curMns); });
    avBtn.title = T('btnSnapshotTitle');
    avBtn.style.cssText = 'padding:4px 7px;border-radius:50%;font-size:13px;flex-shrink:0;';
    toolbar.appendChild(avBtn);
    container.appendChild(toolbar);

    let friends = buildFriendList();
    if (searchQ.trim()) { const q = searchQ.trim();
                         friends = friends.filter(f => matchesSearch(f.mn, q));
                        }
    friends = friends.filter(applyFilters);
    switch (sortMode) {
        // 關係：關係 > 最愛 > ID
        case 'rel':   friends.sort((a, b) => { const d = REL_ORDER[a.rel] - REL_ORDER[b.rel]; if (d) return d; const fd = (isFav(b.mn) ? 1 : 0) - (isFav(a.mn) ? 1 : 0); return fd || a.mn - b.mn; }); break;
        case 'id':    friends.sort((a, b) => a.mn - b.mn); break;
        case 'name':  friends.sort((a, b) => a.name.localeCompare(b.name)); break;
        case 'added': friends.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)); break;
        // 最愛（預設）：最愛 > 關係 > ID（ID 已是明確順位，不再往下排）
        default:      friends.sort((a, b) => { const fd = (isFav(b.mn) ? 1 : 0) - (isFav(a.mn) ? 1 : 0); if (fd) return fd; const d = REL_ORDER[a.rel] - REL_ORDER[b.rel]; return d || a.mn - b.mn; });
    }
    await PDB.batchGet(friends.map(f => f.mn));
    if (_myToken !== getRenderToken()) return;
    friends.forEach(f => { f.name = getDisplayName(f.mn); });

    const inARoom = !!(typeof ChatRoomData !== 'undefined' && ChatRoomData), isAdmin = inARoom && amAdmin();

    const wrapper = document.createElement('div'); wrapper.className = 'fcm-scroll-wrap';
    const scroll = document.createElement('div'); scroll.className = 'fcm-scroll';

    if (!friends.length) {
        const em = document.createElement('div'); em.className = 'fcm-empty'; em.textContent = T('noFriends');
        scroll.appendChild(em); wrapper.appendChild(scroll); wrapper.appendChild(makeCountBar(0)); container.appendChild(wrapper); return;
    }

    const tbl = document.createElement('table'); tbl.className = 'fcm-tbl';
    const thRow = document.createElement('tr');
    // 個人關係頁無悄悄話，動作僅查看／私訊兩顆，動作欄不設 min-width 交由內容決定。
    // table-layout:fixed → 每欄鎖死寬度（不隨內容/篩選變動、總和 ≤ 面板寬）。長文字欄以 ellipsis 截斷。
    [['', 'width:70px'], [T('colName'), 'width:150px', 'fcm-th-left'], [T('colId'), 'width:66px'], [T('colRel'), 'width:68px'], [T('colZone'), 'width:44px'], [T('colRoom'), 'width:150px'], [T('colOps'), 'width:92px'], [T('colManage'), 'width:205px']].forEach(([text, style, cls]) => {
        const th = document.createElement('th'); th.textContent = text; if (style) th.style.cssText = style; if (cls) th.className = cls; thRow.appendChild(th);
    });
    if (inARoom) { const th = document.createElement('th'); th.textContent = isAdmin ? T('colMgmt') : T('colMgmtNoPerm'); th.className = (isAdmin ? 'fcm-th-mgmt' : 'fcm-th-mgmt-off'); th.style.cssText = 'width:158px;'; thRow.appendChild(th); }
    const thead = document.createElement('thead'); thead.appendChild(thRow); tbl.appendChild(thead);
    const tbody = document.createElement('tbody');

    for (const f of friends) {
        const tr = document.createElement('tr'); tr.className = 'fcm-row';
        const online = isOnline(f.mn), zone = getZone(f.mn), isInRoom = inRoomFn(f.mn);
        const snapshotUrl = Snapshot._cache[f.mn] || null;

        const avTd = document.createElement('td');
        const avWrap = document.createElement('div'); avWrap.className = 'fcm-avwrap';
        avWrap.appendChild(makeFavStar(f.mn));
        avWrap.appendChild(makeAvEl(f.mn, snapshotUrl));
        avTd.appendChild(avWrap); tr.appendChild(avTd);
        const nameTd = document.createElement('td');
        const nd = document.createElement('div'); nd.className = 'fcm-name'; nd.textContent = f.name; nd.title = f.name;
        const sd = document.createElement('div'); sd.className = 'fcm-sta ' + (online ? 'fcm-online' : 'fcm-offline'); sd.textContent = online ? T('online') : T('offline');
        nameTd.appendChild(nd); nameTd.appendChild(sd); tr.appendChild(nameTd);
        tr.appendChild(makeIdCell(f.mn));
        const relTd = document.createElement('td'); relTd.style.cssText = 'text-align:center;width:70px;min-width:70px;'; relTd.appendChild(makeRelEl(getAllRels(f.mn))); tr.appendChild(relTd);
        const zt = document.createElement('td'); zt.style.textAlign = 'center';
        const zs = document.createElement('span'); zs.className = 'fcm-zone';
        const riZone = getRoomInfo(f.mn);
        const hideZone = !online || (online && riZone === null) || (riZone && !riZone.name && riZone.isPrivate);
        zs.textContent = hideZone ? '—' : (zone || T('zoneUnk')); zt.appendChild(zs); tr.appendChild(zt);
        const ri = getRoomInfo(f.mn);
        const rt = document.createElement('td');
        function _buildRoomLink(ri2, mc, ml) {
            const rcStr = mc !== null ? `${ri2.name}(${mc}/${ml ?? '?'})` : ri2.name;
            const roomFull = mc !== null && ml !== null && mc >= ml;
            const rl = document.createElement('span'); rl.className = 'fcm-room-link';
            rl.textContent = rcStr;
            rl.title = (ri2.isPrivate ? T('roomPrivPrefix') : '') + rcStr + (roomFull ? ('\n' + T('roomFull')) : ('\n' + T('roomGoPrompt')));
            // 加入房間：立即以房名開框（其餘欄位顯示佔位），背景查詢完整房間資料後再補上；
            //  查不到（私人房不在搜尋結果等）則退回好友端已知的房名＋人數。
            if (!roomFull) rl.addEventListener('click', () => {
                const fallback = { room: ri2.name, creator: '', count: mc, limit: ml, desc: '', priv: !!ri2.isPrivate, type: '' };
                const space = onlineFriends.find(ff => ff.MemberNumber === f.mn)?.ChatRoomSpace;
                const promise = fetchRoomFull(ri2.name, space)
                    .then(full => full ? roomInfoFromResult(full) : fallback)
                    .catch(() => fallback);
                showRoomJoinConfirm({ room: ri2.name, priv: !!ri2.isPrivate }, promise);
            }); else rl.style.color = '#808080';
            if (ri2.isPrivate) { const b2 = document.createElement('span'); b2.className = 'fcm-room-private'; b2.style.cssText = 'font-size:10px;color:#c090f0;margin-left:2px;'; b2.textContent = T('roomPrivShort'); rl.appendChild(b2); }
            return rl;
        }
        if (ri && ri.name) {
            let mc = null, ml = null;
            if (ri.isCurrent && typeof ChatRoomCharacter !== 'undefined') { mc = ChatRoomCharacter.length; ml = ChatRoomData?.MemberLimit ?? null; }
            else if (ri.memberCount !== null && ri.memberCount !== undefined) { mc = ri.memberCount; ml = ri.memberLimit ?? null; }
            else { const cd = getCachedRoomInfo(ri.name); if (cd) { mc = cd.MemberCount; ml = cd.MemberLimit; } }
            rt.appendChild(_buildRoomLink(ri, mc, ml));
            if (!ri.isCurrent && mc === null) {
                const friendSpace = onlineFriends.find(ff => ff.MemberNumber === f.mn)?.ChatRoomSpace;
                queryRoomInfo(ri.name, friendSpace, data => { if (data && rt.isConnected) { rt.innerHTML = ''; rt.appendChild(_buildRoomLink(ri, data.MemberCount, data.MemberLimit)); } });
            }
        } else if (ri && !ri.name && ri.isPrivate) {
            const sp = document.createElement('span'); sp.className = 'fcm-room-private'; sp.style.cssText = 'font-size:11px;color:#c090f0;font-weight:600;';
            sp.textContent = T('roomPrivateHidden'); rt.appendChild(sp);
        } else { rt.innerHTML = '<span class="fcm-room">—</span>'; }
        tr.appendChild(rt);

        // 動作（查看／私訊）與 管理（好友／白單／黑單／幽靈）分兩欄；個人關係頁不需要悄悄話
        const { actions: fActions, manage: fManage } = buildPersonOps(f.mn, { isInRoom, oneSided: false, whisper: false });
        const opsTd = document.createElement('td'); opsTd.appendChild(fActions); tr.appendChild(opsTd);
        const mngTd = document.createElement('td'); mngTd.appendChild(fManage); tr.appendChild(mngTd);

        if (inARoom) {
            const mgmtTd = document.createElement('td'); mgmtTd.className = 'fcm-td-mgmt' + (isAdmin ? '' : ' no-perm');
            const mb = buildMgmtBtns(f.mn, 'friends'); if (mb) mgmtTd.appendChild(mb); tr.appendChild(mgmtTd);
        }
        tbody.appendChild(tr);
    }
    tbl.appendChild(tbody); scroll.appendChild(tbl);
    wrapper.appendChild(scroll);
    wrapper.appendChild(makeCountBar(friends.length));
    container.appendChild(wrapper);

    if (cfg.avatars) _autoQueueVisible(friends.map(f => f.mn));
}

export { renderFriends, resetFriendsSearch };

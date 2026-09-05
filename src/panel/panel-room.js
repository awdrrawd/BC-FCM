import { CAMERA_ICON } from '../ui/icons.js';
import { cfg } from '../core/config.js';
import { T } from '../i18n/i18n.js';
import { PDB, _pc, Snapshot } from '../data/profile-db.js';
import { showNickname, setShowNickname, getDisplayName, matchesSearch, searchScore, getRel, getAllRels, REL_ORDER, getRoomPerms, amAdmin, inRoomFn } from '../data/data.js';
import { roomOp, makeIdCell } from '../chat/actions.js';
import { makeAvEl, makeRelEl, makePermEl, mkBtn, makeSearchWrap, makeSortSel, makeCountBar, paginate, makePageBar, buildMgmtBtns, buildPersonOps, _autoQueueVisible, refreshSnapshotsForList } from './panel-widgets.js';
import { wpsShareProfile } from '../chat/wps-share.js';
// ════════════════════════════════════════
//  FCM module: panel-room.js  (split from panel.js)
//  房間管理頁（房內人員／管理員／白名單／黑名單四個子頁）。
//  roomSubTab / roomSearchQ / roomSortMode 為本頁狀態；closePanel 透過
//  resetRoomAdminSearch 清空搜尋字串。renderRoom 以自身遞迴重繪，不需 renderCurrent。
// ════════════════════════════════════════

let roomSubTab = 'members';
let roomSearchQ = '', roomSortMode = 'name';
let roomSearchDebounce = null;
const ROOM_LIST_PAGE_SIZE = 100;
const roomPages = { admin: 0, white: 0, ban: 0 };

function resetRoomAdminSearch() { roomSearchQ = ''; Object.keys(roomPages).forEach(key => { roomPages[key] = 0; }); }

async function renderRoom(container) {
    container.innerHTML = '';
    if (typeof ChatRoomData === 'undefined' || !ChatRoomData) { const em = document.createElement('div'); em.className = 'fcm-empty'; em.textContent = T('notInRoom'); container.appendChild(em); return; }
    const isAdmin = amAdmin();
    if (!isAdmin) { const w = document.createElement('div'); w.className = 'fcm-warn'; w.textContent = T('noAdminWarn'); container.appendChild(w); }

    const stabs = document.createElement('div'); stabs.className = 'fcm-subtabs';
    ['members', 'admin', 'white', 'ban'].forEach(key => {
        const t = document.createElement('div'); t.className = 'fcm-stab' + (roomSubTab === key ? ' active' : ''); t.textContent = T('roomTab_' + key);
        t.addEventListener('click', () => { roomSubTab = key; renderRoom(container); }); stabs.appendChild(t);
    });
    container.appendChild(stabs);

    const canAddHere = isAdmin && roomSubTab !== 'members';
    const toolbar = document.createElement('div'); toolbar.className = 'fcm-toolbar';

    function isNumericQ(v) { const mn = parseInt(v); return mn > 0 && String(mn) === v.trim() && v.trim().length > 0; }

    let addBtn;
    const { wrap: sw, inp: rsEl } = makeSearchWrap(roomSearchQ, T('roomSearch'), val => {
        roomSearchQ = val;
        if (roomSubTab !== 'members') roomPages[roomSubTab] = 0;
        if (addBtn) addBtn.disabled = !(canAddHere && isNumericQ(val));
        clearTimeout(roomSearchDebounce);
        roomSearchDebounce = setTimeout(async () => {
            const pos = roomSearchQ.length;
            await renderRoom(container);
            const ns = container.querySelector('.fcm-room-search');
            const na = container.querySelector('.fcm-add-btn');
            if (ns) { ns.focus(); try { ns.setSelectionRange(pos, pos); } catch {} }
            if (na) na.disabled = !(canAddHere && isNumericQ(roomSearchQ));
        }, 400);
    }, 'fcm-room-search');
    toolbar.appendChild(sw);

    if (canAddHere) {
        addBtn = mkBtn(T('btnAdd'), 'fcm-btn-green fcm-add-btn', () => {
            const mn = parseInt(roomSearchQ); if (!mn || mn < 100) return;
            if (roomSubTab === 'admin') roomOp(mn, 'makeAdmin');
            else if (roomSubTab === 'white') roomOp(mn, 'addWhite');
            else if (roomSubTab === 'ban') roomOp(mn, 'ban');
            clearTimeout(roomSearchDebounce); rsEl.value = ''; roomSearchQ = ''; addBtn.disabled = true;
        });
        addBtn.title = T('btnAddTitle');
        addBtn.disabled = !isNumericQ(roomSearchQ);
        // Bug fix: stopPropagation on room admin search keydown
        rsEl.addEventListener('keydown', e => {
            e.stopPropagation();
            if (e.key === 'Enter' && !addBtn.disabled) { e.preventDefault(); addBtn.click(); }
        });
        toolbar.appendChild(addBtn);
    }

    toolbar.appendChild(Object.assign(document.createElement('span'), { className: 'fcm-spacer' }));
    const rNickBtn = document.createElement('button'); rNickBtn.className = 'fcm-nick-tog'; rNickBtn.textContent = showNickname ? T('togNick') : T('togName');
    rNickBtn.addEventListener('click', () => { setShowNickname(!showNickname); if (roomSubTab !== 'members') roomPages[roomSubTab] = 0; renderRoom(container); });
    toolbar.appendChild(rNickBtn);
    const { lbl: rsl, sel: rsortSel } = makeSortSel(roomSortMode, [['name', T('sortName')], ['id', T('sortId')], ['rel', T('sortRel')], ['perm', T('permAdmin')]], v => { roomSortMode = v; if (roomSubTab !== 'members') roomPages[roomSubTab] = 0; renderRoom(container); });
    toolbar.appendChild(rsl); toolbar.appendChild(rsortSel);
    const rBtn = mkBtn('↻', 'fcm-btn', () => renderRoom(container));
    rBtn.style.cssText = 'padding:4px 7px;border-radius:50%;font-size:13px;flex-shrink:0;';
    toolbar.appendChild(rBtn);
    const avBtnR = mkBtn('', 'fcm-btn', () => { refreshSnapshotsForList(mns); });
    avBtnR.innerHTML = CAMERA_ICON;
    avBtnR.title = T('btnSnapshotTitle');
    avBtnR.style.cssText = 'padding:4px 7px;border-radius:50%;font-size:13px;flex-shrink:0;';
    toolbar.appendChild(avBtnR);
    container.appendChild(toolbar);

    let mns = [];
    if (roomSubTab === 'members') mns = (ChatRoomData.Character || []).map(c => c.MemberNumber);
    else if (roomSubTab === 'admin') mns = [...(ChatRoomData.Admin || [])];
    else if (roomSubTab === 'white') mns = [...(ChatRoomData.Whitelist || [])];
    else if (roomSubTab === 'ban')   mns = [...(ChatRoomData.Ban || [])];

    if (roomSearchQ.trim()) { const q = roomSearchQ.trim(); mns = mns.filter(mn => matchesSearch(mn, q)); }

    switch (roomSortMode) {
        case 'id':   mns.sort((a, b) => a - b); break;
        case 'rel':  mns.sort((a, b) => REL_ORDER[getRel(a)] - REL_ORDER[getRel(b)]); break;
        case 'perm': mns.sort((a, b) => { const pa = getRoomPerms(a), pb = getRoomPerms(b); const ord = ['admin','pass','ban','visit']; return (ord.indexOf(pa[0]) || 0) - (ord.indexOf(pb[0]) || 0); }); break;
        default:     mns.sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b))); break;
    }
    if (roomSearchQ.trim()) mns.sort((a, b) => searchScore(a, roomSearchQ) - searchScore(b, roomSearchQ));

    const totalMembers = mns.length;
    const page = roomSubTab === 'members'
        ? { items: mns, page: 0, totalPages: 1 }
        : paginate(mns, roomPages[roomSubTab], ROOM_LIST_PAGE_SIZE);
    if (roomSubTab !== 'members') roomPages[roomSubTab] = page.page;
    mns = page.items;

    const wrapper = document.createElement('div'); wrapper.className = 'fcm-scroll-wrap';
    const scroll = document.createElement('div'); scroll.className = 'fcm-scroll';

    if (!mns.length) { const em = document.createElement('div'); em.className = 'fcm-empty'; em.textContent = T('noData'); scroll.appendChild(em); wrapper.appendChild(scroll); wrapper.appendChild(makeCountBar(0)); container.appendChild(wrapper); return; }

    await PDB.batchGet(mns);

    const tbl = document.createElement('table'); tbl.className = 'fcm-tbl';
    const thRow = document.createElement('tr');
    // 名稱欄固定寬度：.fcm-name 內容上限 140px + td 左右各 10px padding = 160px，
    //  四個子頁（房內人員／管理員／白名單／黑名單）名稱欄寬度一致，避免切換子頁時整表位移。
    // 動作欄不設 min-width：改由內容（查看／私訊，房內人員多一顆悄悄話）決定，避免預留過大空白。
    // table-layout:fixed → 每欄鎖死寬度（不隨子頁/內容變動、總和 ≤ 面板寬）。動作欄放最寬（房內人員多一顆悄悄話）。
    [['', 'width:46px'], [T('colName'), 'width:150px', 'fcm-th-left'], [T('colId'), 'width:64px'], [T('colRel'), 'width:68px'], [T('colPerm'), 'width:74px'], [T('colOps'), 'width:138px'], [T('colManage'), 'width:205px']].forEach(([text, style, cls]) => {
        const th = document.createElement('th'); th.textContent = text; if (style) th.style.cssText = style; if (cls) th.className = cls; thRow.appendChild(th);
    });
    const thMgmt = document.createElement('th'); thMgmt.textContent = isAdmin ? T('colMgmt') : T('colMgmtNoPerm'); thMgmt.className = isAdmin ? 'fcm-th-mgmt' : 'fcm-th-mgmt-off'; thMgmt.style.cssText = 'width:206px;'; thRow.appendChild(thMgmt);
    // 分享欄（房管之後，最後一欄）；house 一定在房間內，故恆可分享
    const thShare = document.createElement('th'); thShare.textContent = T('colShare'); thShare.style.cssText = 'width:58px;'; thRow.appendChild(thShare);
    const thead = document.createElement('thead'); thead.appendChild(thRow); tbl.appendChild(thead);
    const tbody = document.createElement('tbody');

    for (const mn of mns) {
        const tr = document.createElement('tr'); tr.className = 'fcm-row';
        const name = getDisplayName(mn), rel = getAllRels(mn), perms = getRoomPerms(mn);
        const snapshotUrl = Snapshot._cache[mn] || null;
        const isInRoom = inRoomFn(mn), isMe = mn === Player.MemberNumber;

        const avTd = document.createElement('td'); avTd.appendChild(makeAvEl(mn, snapshotUrl)); tr.appendChild(avTd);
        const nameTd = document.createElement('td');
        const nd = document.createElement('div'); nd.className = 'fcm-name'; nd.textContent = name; nd.title = name; nameTd.appendChild(nd);
        if (isMe) { const yl = document.createElement('div'); yl.className = 'fcm-you'; yl.textContent = T('youLabel'); nameTd.appendChild(yl); }
        tr.appendChild(nameTd);
        tr.appendChild(makeIdCell(mn));
        const relTd = document.createElement('td'); relTd.style.textAlign = 'center'; relTd.appendChild(makeRelEl(rel)); tr.appendChild(relTd);
        const permTd = document.createElement('td'); const pd = document.createElement('div'); pd.className = 'fcm-perms'; perms.forEach(p => pd.appendChild(makePermEl(p))); permTd.appendChild(pd); tr.appendChild(permTd);

        // 動作（查看／悄悄話／私訊）與 管理（好友／白單／黑單／幽靈）分兩欄；
        //  悄悄話僅「房內人員」子頁顯示；管理者／白名單／黑名單子頁一律顯示私訊（forceBeep）
        const { actions: rActions, manage: rManage } = buildPersonOps(mn, { isInRoom, isMe, whisper: roomSubTab === 'members', forceBeep: roomSubTab !== 'members' });
        const opsTd = document.createElement('td'); opsTd.appendChild(rActions); tr.appendChild(opsTd);
        const mngTd = document.createElement('td'); mngTd.appendChild(rManage); tr.appendChild(mngTd);

        const mgmtTd = document.createElement('td'); mgmtTd.className = 'fcm-td-mgmt' + (isAdmin && !isMe ? '' : ' no-perm');
        if (!isMe) { const mb = buildMgmtBtns(mn, roomSubTab); if (mb) mgmtTd.appendChild(mb); }
        tr.appendChild(mgmtTd);

        // 分享欄：有完整 Profile（characterBundle）才能分享，否則顯示「—」
        const shareTd = document.createElement('td'); shareTd.style.textAlign = 'center';
        const _hasBundle = !!(_pc[mn] && _pc[mn].characterBundle);
        if (_hasBundle && !isMe) {
            shareTd.appendChild(mkBtn(T('btnShare'), 'fcm-btn-purple', () => wpsShareProfile(mn)));
        } else {
            shareTd.innerHTML = '<span class="fcm-empty-value">—</span>';
        }
        tr.appendChild(shareTd);
        tbody.appendChild(tr);
    }
    tbl.appendChild(tbody); scroll.appendChild(tbl);
    wrapper.appendChild(scroll);
    wrapper.appendChild(makeCountBar(mns.length, totalMembers));
    if (roomSubTab !== 'members') {
        wrapper.appendChild(makePageBar(page.page, page.totalPages, nextPage => { roomPages[roomSubTab] = nextPage; renderRoom(container); }));
    }
    container.appendChild(wrapper);

    if (cfg.avatars) _autoQueueVisible(mns);
}

export { renderRoom, resetRoomAdminSearch };

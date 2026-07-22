import { T } from '../i18n/i18n.js';
import { PDB, _pc, Snapshot } from '../data/profile-db.js';
import { inRoomFn, amAdmin, getAllRels, onlineFriends } from '../data/data.js';
import { makeAvEl, makeRelEl, mkBtn, buildMgmtBtns, buildPersonOps } from './panel-widgets.js';
import { makeIdCell } from '../chat/actions.js';
import { wpsShareProfile } from '../chat/wps-share.js';
import { getRenderToken } from './panel.js';
// ════════════════════════════════════════
//  FCM module: panel-people.js  (split from panel.js)
//  人員查詢頁（renderPeople）＋ Profile 匯出/匯入。
//  _peopleQ / _peoplePage 為本頁狀態；外部（closePanel / 頁籤切換 / openPeopleSearch）
//  透過 resetPeopleSearch / setPeopleQuery 存取。
// ════════════════════════════════════════

const PEOPLE_PAGE_SIZE = 100;
let _peopleQ = '';
let _peoplePage = 0;

function resetPeopleSearch() { _peopleQ = ''; _peoplePage = 0; }
function setPeopleQuery(id) { _peopleQ = String(id); _peoplePage = 0; }

async function renderPeople(container, _myToken) {
    container.innerHTML = '';
    if (!PDB.db) {
        const em = document.createElement('div'); em.className = 'fcm-empty';
        em.textContent = T('peopleDbNotConnected');
        container.appendChild(em); return;
    }

    const toolbar = document.createElement('div'); toolbar.className = 'fcm-toolbar';
    const sw = document.createElement('div'); sw.style.cssText = 'position:relative;display:inline-flex;align-items:center;flex:1;min-width:180px;max-width:320px;';
    const inp = document.createElement('input'); inp.className = 'fcm-search'; inp.style.width = '100%';
    inp.placeholder = T('peopleSearchPlaceholder'); inp.value = _peopleQ;
    const clrX = document.createElement('button'); clrX.className = 'fcm-clear-btn'; clrX.textContent = '×';
    clrX.addEventListener('click', () => { inp.value = ''; _peopleQ = ''; _peoplePage = 0; runSearch(''); });
    sw.appendChild(inp); sw.appendChild(clrX); toolbar.appendChild(sw);

    const srchBtn = mkBtn(T('btnSearch'), 'fcm-btn', () => { _peoplePage = 0; runSearch(inp.value); });
    srchBtn.style.cssText = 'padding:5px 12px;font-size:12px;flex-shrink:0;';
    toolbar.appendChild(srchBtn);
    toolbar.appendChild(Object.assign(document.createElement('span'), { className: 'fcm-spacer' }));
    const rBtn = mkBtn('↻', 'fcm-btn', () => { _peoplePage = 0; runSearch(inp.value); });
    rBtn.style.cssText = 'padding:4px 7px;border-radius:50%;font-size:13px;flex-shrink:0;';
    toolbar.appendChild(rBtn);
    container.appendChild(toolbar);

    const hint = document.createElement('div'); hint.className = 'fcm-people-hint'; hint.textContent = T('peopleSearchHint');
    container.appendChild(hint);

    const allProfiles = await new Promise(res => {
        if (!PDB.db) return res([]);
        const req = PDB.db.transaction('profiles', 'readonly').objectStore('profiles').getAll();
        req.onsuccess = () => res(req.result || []);
        req.onerror = () => res([]);
    });
    if (_myToken !== getRenderToken()) return;
    allProfiles.sort((a, b) => (b.seen || b.savedAt || 0) - (a.seen || a.savedAt || 0));

    const wrapper = document.createElement('div'); wrapper.className = 'fcm-scroll-wrap';
    const scroll = document.createElement('div'); scroll.className = 'fcm-scroll';
    const countBar = document.createElement('div'); countBar.className = 'fcm-count';
    const pageBar = document.createElement('div');
    pageBar.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:8px;padding:6px 12px;background:#1a1230;border-top:1px solid #2a2048;flex-shrink:0;';
    wrapper.appendChild(scroll); wrapper.appendChild(countBar); wrapper.appendChild(pageBar);
    container.appendChild(wrapper);

    async function runSearch(q) {
        _peopleQ = q; q = q.trim();
        scroll.innerHTML = ''; pageBar.innerHTML = '';
        const isNumId = /^\d+$/.test(q) && parseInt(q) > 0;
        const qLow = q.toLowerCase();
        let filtered = q
        ? allProfiles.filter(p => (p.name || '').toLowerCase().includes(qLow) || (p.lastNick || '').toLowerCase().includes(qLow) || String(p.memberNumber).includes(q))
        : allProfiles;
        // 相關性排序：BC ID 是依序分配的，兩個人的 ID 很可能剛好相近（例如搜「123」會連帶找到
        // 「3123」「12345」），因此把「最接近」的結果（完全相同 → 開頭相符 → 其餘）排到最前面，
        // 其餘結果維持原本（最近見面）的相對順序。
        if (q && filtered.length > 1) {
            const _score = (p) => {
                if (isNumId) {
                    const idStr = String(p.memberNumber);
                    if (idStr === q) return 0;
                    if (idStr.startsWith(q)) return 1;
                    return 2;
                }
                const name = (p.name || '').toLowerCase(), nick = (p.lastNick || '').toLowerCase();
                if (name === qLow || nick === qLow) return 0;
                if (name.startsWith(qLow) || nick.startsWith(qLow)) return 1;
                return 2;
            };
            filtered = filtered
                .map((p, i) => ({ p, i, s: _score(p) }))
                .sort((a, b) => a.s - b.s || a.i - b.i)
                .map(x => x.p);
        }
        if (isNumId) {
            const mn = parseInt(q);
            const exactMatch = allProfiles.find(p => p.memberNumber === mn);
            if (!exactMatch) {
                const box = document.createElement('div'); box.className = 'fcm-unknown-id-box';
                const boxTitle = document.createElement('div'); boxTitle.className = 'fcm-unknown-id-title';
                boxTitle.textContent = T('peopleUnknownId', mn);
                box.appendChild(boxTitle);
                // buildPersonOps 回傳 { actions, manage } 兩組按鈕；這裡把它們攤平到同一列
                const { actions: uActions, manage: uManage } = buildPersonOps(mn, { isInRoom: inRoomFn(mn), oneSided: true });
                const allBtns = document.createElement('div'); allBtns.className = 'fcm-btns'; allBtns.style.flexWrap = 'wrap';
                Array.from(uActions.children).forEach(b => allBtns.appendChild(b));
                Array.from(uManage.children).forEach(b => allBtns.appendChild(b));
                // 如果在房間裡，把房管按鈕直接加到同一個 fcm-btns div
                if (typeof ChatRoomData !== 'undefined' && ChatRoomData) {
                    const sep = document.createElement('span');
                    sep.style.cssText = 'display:inline-block;width:1px;height:14px;background:#3a2870;margin:0 6px;vertical-align:middle;';
                    allBtns.appendChild(sep);
                    const boxMb = buildMgmtBtns(mn, 'people');
                    if (boxMb) {
                        // 把 boxMb 裡的按鈕一個個搬進 allBtns
                        Array.from(boxMb.children).forEach(btn => {
                            if (!amAdmin()) btn.disabled = true;
                            allBtns.appendChild(btn);
                        });
                    }
                }
                box.appendChild(allBtns);
                scroll.appendChild(box);
                if (filtered.length > 0) {
                    const simLbl = document.createElement('div');
                    simLbl.style.cssText = 'padding:8px 16px 4px;font-size:11px;color:#7060a0;letter-spacing:.5px;';
                    simLbl.textContent = T('peopleSimilarIds'); scroll.appendChild(simLbl);
                }
            }
        }
        const totalFiltered = filtered.length;
        const totalPages = Math.max(1, Math.ceil(totalFiltered / PEOPLE_PAGE_SIZE));
        if (_peoplePage >= totalPages) _peoplePage = totalPages - 1;
        const pageStart = _peoplePage * PEOPLE_PAGE_SIZE;
        const show = filtered.slice(pageStart, pageStart + PEOPLE_PAGE_SIZE);
        countBar.textContent = q
            ? T('peopleTotal', totalFiltered, allProfiles.length)
        : T('peopleTotal', Math.min(allProfiles.length, PEOPLE_PAGE_SIZE * (_peoplePage + 1)), allProfiles.length);
        if (!show.length && !(isNumId && !allProfiles.find(p => p.memberNumber === parseInt(q)))) {
            if (!scroll.querySelector('.fcm-unknown-id-box')) {
                const em = document.createElement('div'); em.className = 'fcm-empty'; em.textContent = T('peopleNoResults');
                scroll.appendChild(em);
            }
            return;
        }
        await PDB.batchGet(show.map(p => p.memberNumber));
        const tbl = document.createElement('table'); tbl.className = 'fcm-tbl';
        const thead = document.createElement('thead');
        const thRow = document.createElement('tr');
        [
            ['', 'width:42px'], [T('colName'), 'width:160px;min-width:160px', 'fcm-th-left'], [T('colId'), ''],
            [T('colRel'), ''], [T('colOps'), ''], [T('colManage'), 'min-width:130px'],
            ...((!!(typeof ChatRoomData !== 'undefined' && ChatRoomData)) ? [[T('colMgmt'), 'min-width:130px']] : []),
            [T('colSeen'), 'min-width:80px'], [T('colShare'), 'min-width:60px'],
        ].forEach(([text, style, cls]) => {
            const th = document.createElement('th'); th.textContent = text;
            if (style) th.style.cssText = style; if (cls) th.className = cls; thRow.appendChild(th);
        });
        thead.appendChild(thRow); tbl.appendChild(thead);
        const tbody = document.createElement('tbody');
        for (const p of show) {
            const mn = p.memberNumber;
            const tr = document.createElement('tr'); tr.className = 'fcm-row';
            const snapshotUrl = Snapshot._cache[mn] || null;
            const bcName   = p.name    || `#${mn}`;
            const nickName = p.lastNick || null;
            const isInRoom = inRoomFn(mn);
            const oneSided = getAllRels(mn).every(r => r === 'none') && !isInRoom && !onlineFriends.some(f => f.MemberNumber === mn);
            const avTd = document.createElement('td'); avTd.appendChild(makeAvEl(mn, snapshotUrl)); tr.appendChild(avTd);
            const nameTd = document.createElement('td');
            const nd = document.createElement('div'); nd.className = 'fcm-name';
            nd.textContent = nickName || bcName; nd.title = nickName || bcName; nameTd.appendChild(nd);
            if (nickName && nickName !== bcName) {
                const sub = document.createElement('div'); sub.className = 'fcm-id'; sub.textContent = bcName; nameTd.appendChild(sub);
            }
            tr.appendChild(nameTd);
            tr.appendChild(makeIdCell(mn));
            const relTd = document.createElement('td'); relTd.style.textAlign = 'center'; relTd.appendChild(makeRelEl(getAllRels(mn))); tr.appendChild(relTd);
            const freshProf = _pc[mn] || null;
            const hasBundle = !!(freshProf && freshProf.characterBundle);
            const isMe_p = mn === parseInt(Player?.MemberNumber);
            // 動作（查看／私訊）與 管理（好友／白單／黑單／幽靈）分兩欄；
            //  人員查詢一律顯示私訊（forceBeep），僅好友可用、同房間不算可私訊條件
            const { actions: pActions, manage: pManage } = buildPersonOps(mn, { isInRoom, isMe: isMe_p, oneSided, whisper: false, forceBeep: true });
            const opsTd = document.createElement('td'); opsTd.appendChild(pActions); tr.appendChild(opsTd);
            const mngTd = document.createElement('td'); mngTd.appendChild(pManage); tr.appendChild(mngTd);
            // ── Room admin column ─────────────────────────────────────────
            const _inARoom_p = !!(typeof ChatRoomData !== 'undefined' && ChatRoomData);
            if (_inARoom_p) {
                const _isAdmin_p = amAdmin();
                const mgmtTd_p = document.createElement('td');
                mgmtTd_p.className = 'fcm-td-mgmt' + (_isAdmin_p ? '' : ' no-perm');
                mgmtTd_p.style.maxWidth = '145px';
                const mb_p = buildMgmtBtns(mn, 'people');
                if (mb_p) mgmtTd_p.appendChild(mb_p);
                tr.appendChild(mgmtTd_p);
            }
            const shareTd = document.createElement('td'); shareTd.style.textAlign = 'center';
            if (hasBundle) {
                const shareBtn = mkBtn(T('btnShare'), 'fcm-btn-purple', () => wpsShareProfile(mn));
                if (!inRoomFn(parseInt(Player?.MemberNumber)) && !(typeof ChatRoomData !== 'undefined' && ChatRoomData)) {
                    shareBtn.disabled = true;
                    shareBtn.title = T('shareNeedRoom');
                }
                shareTd.appendChild(shareBtn);
            } else {
                shareTd.innerHTML = '<span style="color:#4a3870;font-size:11px;">—</span>';
            }
            const seenTime = p.seen;
            const seenTd = document.createElement('td'); seenTd.className = 'fcm-id'; seenTd.style.textAlign = 'center';
            seenTd.textContent = seenTime ? new Date(seenTime).toLocaleDateString() : '—'; tr.appendChild(seenTd);
            tr.appendChild(shareTd);
            tbody.appendChild(tr);
        }
        tbl.appendChild(tbody); scroll.appendChild(tbl);
        if (totalPages > 1) {
            const prevBtn = mkBtn('◀', 'fcm-btn', () => { _peoplePage--; runSearch(inp.value); });
            prevBtn.disabled = _peoplePage === 0;
            const nextBtn = mkBtn('▶', 'fcm-btn', () => { _peoplePage++; runSearch(inp.value); });
            nextBtn.disabled = _peoplePage >= totalPages - 1;
            const pageInfo = document.createElement('span');
            pageInfo.style.cssText = 'font-size:11px;color:#9080b8;';
            pageInfo.textContent = T('pageInfo', _peoplePage+1, totalPages);
            pageBar.appendChild(prevBtn); pageBar.appendChild(pageInfo); pageBar.appendChild(nextBtn);
            if (totalPages <= 7) {
                pageBar.innerHTML = ''; pageBar.appendChild(prevBtn);
                for (let i = 0; i < totalPages; i++) {
                    const pb = mkBtn(String(i+1), i === _peoplePage ? 'fcm-btn fcm-btn-purple' : 'fcm-btn', () => { _peoplePage = parseInt(pb.textContent)-1; runSearch(inp.value); });
                    pageBar.appendChild(pb);
                }
                pageBar.appendChild(nextBtn);
            }
        }
    }

    // Bug fix: stopPropagation on people search keydown
    inp.addEventListener('keydown', e => {
        e.stopPropagation();
        if (e.key === 'Enter') { _peoplePage = 0; runSearch(inp.value); }
    });

    await runSearch(_peopleQ);
    inp.focus();
}

async function exportProfiles() {
    try {
        const allProfiles = await new Promise((res, rej) => {
            const req = PDB.db.transaction('profiles','readonly').objectStore('profiles').getAll();
            req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error);
        });
        let notes = [];
        try { if (PDB.db.objectStoreNames.contains('notes')) { notes = await new Promise((res,rej) => { const req = PDB.db.transaction('notes','readonly').objectStore('notes').getAll(); req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); }); } } catch {}
        const data = { exportedAt: new Date().toISOString(), dbVersion: PDB.db.version, profiles: allProfiles, notes };
        const today = new Date(); const ymd = today.getFullYear() + String(today.getMonth()+1).padStart(2,'0') + String(today.getDate()).padStart(2,'0');
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `bce-past-profiles-${ymd}.json`; a.click(); URL.revokeObjectURL(a.href);
        return allProfiles.length;
    } catch(e) { console.error('🐈‍⬛ [FCM] export error:', e); return 0; }
}

async function importProfiles(file) {
    try {
        const data = JSON.parse(await file.text());
        let pc = 0, nc = 0;
        if (Array.isArray(data.profiles) && PDB.db) {
            const tx = PDB.db.transaction('profiles','readwrite'); const store = tx.objectStore('profiles');
            for (const p of data.profiles) {
                delete p.avatarDataUrl;
                const existing = await new Promise(res => { const r = store.get(p.memberNumber); r.onsuccess = () => res(r.result); r.onerror = () => res(null); });
                const existSeen = existing?.seen || existing?.savedAt || 0;
                const newSeen = p.seen || p.savedAt || 0;
                if (!existing || newSeen >= existSeen) { store.put(p); _pc[p.memberNumber] = p; pc++; }
            }
        }
        if (Array.isArray(data.notes) && PDB.db && PDB.db.objectStoreNames.contains('notes')) {
            const tx2 = PDB.db.transaction('notes','readwrite'); const store2 = tx2.objectStore('notes');
            for (const n of data.notes) { store2.put(n); nc++; }
        }
        return { pc, nc };
    } catch(e) { console.error('🐈‍⬛ [FCM] import error:', e); return { pc:0, nc:0 }; }
}

export { renderPeople, exportProfiles, importProfiles, resetPeopleSearch, setPeopleQuery };

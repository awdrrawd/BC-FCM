import { cfg, MOD_VER, saveCfg } from './config.js';
import { isZh, T, FCM_LANGS, FCM_LANG_NAMES } from './i18n.js';
import { PDB, _pc, Snapshot, _avQueue, _avBusy, _processAvQueue, loadAvatarFromBundle, _captureSnapshotDelayed, detectWCESave, setAvStatusEl } from './profile-db.js';
import { onlineFriends, showNickname, setShowNickname, getDisplayName, buildFriendList, getRel, getAllRels, REL_ORDER, getZone, getRoomInfo, getRoomPerms, amAdmin, inRoomFn, isFriendOf, canBeep } from './data.js';
import { roomOp, doView, doBeep, doWhisper, doAddFriend, doToggleList, doRemoveFriend, navigateToRoom, showConfirm, makeIdCell } from './actions.js';
import { injectStyles } from './styles.js';
import { _removeWhisperAvatar, startWhisperIndicator, stopWhisperIndicator, _installOocProtect, _uninstallOocProtect, applyGhostHide } from './chat-fx.js';
import { wpsShareProfile } from './wps-share.js';
// ════════════════════════════════════════
//  FCM module: panel.js
//  (split from Plugins/liko-FCM.user.js)
// ════════════════════════════════════════

    let _renderToken = 0;
    let _roomResults = [];
    let _roomZoneFilter = 'X';
    let _roomSearchQ2 = '';
    let _favRooms = new Set(JSON.parse(localStorage.getItem('fcmFavRooms') || '[]'));
    let _roomSortMode = 'fav';
    const _roomCache = new Map();

    function saveFavRooms() { try { localStorage.setItem('fcmFavRooms', JSON.stringify([..._favRooms])); } catch {} }

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

    const _pendingRoomQueries = new Set();
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

    let panelEl = null, miniEl = null, panelOpen = false, panelMini = false;
    let uiTab = 'friends', roomSubTab = 'members';
    let searchQ = '', roomSearchQ = '', sortMode = 'rel', roomSortMode = 'name';
    let _peopleQ = '';
    let searchDebounce = null, roomSearchDebounce = null;
    const filters = { online: true, offline: false, owner: false, lover: false, sub: false, friend: false, whitelist: false, blacklist: false };

    // ═══════════════════════════════════════════════════════════
    //  ELEMENT HELPERS
    // ═══════════════════════════════════════════════════════════
    function makeAvEl(mn, snapshotUrl) {
        mn = parseInt(mn);
        const el = document.createElement('div'); el.className = 'fcm-av'; el.dataset.mn = mn;
        el.style.cursor = 'pointer';
        el.title = isZh() ? '點擊重新抓取頭像' : 'Click to reload avatar';
        el.addEventListener('click', e => { e.stopPropagation(); _forceLoadAvatar(mn, el); });

        if (cfg.avatars) {
            const C = ChatRoomCharacter && ChatRoomCharacter.find(c => c.MemberNumber === mn);
            if (C && C.Canvas && C.Canvas.width > 0) {
                try {
                    const cv = document.createElement('canvas'); cv.width = cv.height = 36;
                    const ctx = cv.getContext('2d'), src = C.Canvas;
                    ctx.drawImage(src, src.width * 0.39, src.height * 0.40, src.width * 0.22, src.height * 0.11, 0, 0, 36, 36);
                    const img = document.createElement('img'); img.src = cv.toDataURL('image/jpeg', 0.85); el.appendChild(img); return el;
                } catch {}
            }
            const snap = snapshotUrl || Snapshot._cache[mn];
            if (snap && snap.length > 800) {
                const img = document.createElement('img'); img.src = snap; el.appendChild(img); return el;
            }
            (async () => {
                if (!el.isConnected) return;
                const saved = await Snapshot.get(mn);
                if (saved && saved.length > 800) {
                    const t = el.isConnected ? el : panelEl?.querySelector(`.fcm-av[data-mn="${mn}"]`);
                    if (t) { t.innerHTML = ''; const img = document.createElement('img'); img.src = saved; t.appendChild(img); }
                    return;
                }
                if (_pc[mn] === undefined) await PDB.get(mn);
                const profile = _pc[mn];
                _avQueue.push({ mn, profile, onDone: url => {
                    const t = panelEl?.querySelector(`.fcm-av[data-mn="${mn}"]`);
                    if (t) { t.innerHTML = ''; const img = document.createElement('img'); img.src = url; t.appendChild(img); }
                }});
                if (!_avBusy) _processAvQueue();
            })();
        }
        el.textContent = getDisplayName(mn).trim().slice(0, 2).toUpperCase() || '?';
        return el;
    }

    async function _forceLoadAvatar(mn, el) {
        mn = parseInt(mn);
        el.textContent = '…';
        const qi = _avQueue.findIndex(q => q.mn === mn); if (qi >= 0) _avQueue.splice(qi, 1);
        if (_pc[mn] === undefined) await PDB.get(mn);
        const profile = _pc[mn];
        if (!profile) { el.textContent = '?'; return; }
        if (!profile.characterBundle) { el.textContent = '?'; return; }
        delete Snapshot._cache[mn];
        if (Snapshot.db) { try { Snapshot.db.transaction('avatars','readwrite').objectStore('avatars').delete(mn); } catch {} }
        const url = await loadAvatarFromBundle(mn, profile);
        const target = el.isConnected ? el : panelEl?.querySelector(`.fcm-av[data-mn="${mn}"]`);
        if (url && target) {
            target.innerHTML = ''; const img = document.createElement('img'); img.src = url; target.appendChild(img);
        } else {
            if (target) target.textContent = getDisplayName(mn).trim().slice(0, 2).toUpperCase() || '?';
        }
    }

    const REL_LABEL = () => ({ owner: T('relOwner'), lover: T('relLover'), sub: T('relSub'), friend: T('relFriend'), contact: T('relContact'), whitelist: T('relWhitelist'), blacklist: T('relBlacklist'), ghost: T('relGhost'), none: '—' });
    function makeRelEl(rel) {
        const roles = Array.isArray(rel) ? rel : [rel];
        const wrap = document.createElement('div'); wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;';
        const labels = REL_LABEL();
        for (const r of roles) {
            if (r === 'none') { if (roles.length === 1) { const s = document.createElement('span'); s.textContent = '—'; wrap.appendChild(s); } continue; }
            const s = document.createElement('span'); s.className = `fcm-rel fcm-rel-${r in REL_ORDER ? r : 'contact'}`;
            s.textContent = labels[r] || r; wrap.appendChild(s);
        }
        return wrap;
    }
    function makePermEl(perm) { const el = document.createElement('span'); el.className = `fcm-perm fcm-perm-${perm}`; el.textContent = { admin: T('permAdmin'), pass: T('permPass'), ban: T('permBan'), visit: T('permVisit') }[perm] || perm; return el; }
    function mkBtn(label, cls, cb, title) { const b = document.createElement('button'); b.className = 'fcm-btn' + (cls ? ' ' + cls : ''); b.textContent = label; if (title) b.title = title; b.addEventListener('click', e => { e.stopPropagation(); cb(e); }); return b; }
    function mkToggle(on, onChange) { const w = document.createElement('div'); w.className = 'fcm-tog' + (on ? ' on' : ''); const d = document.createElement('div'); d.className = 'fcm-tog-dot'; w.appendChild(d); w.addEventListener('click', () => { const v = !w.classList.contains('on'); w.classList.toggle('on', v); onChange(v); }); return w; }

    // ── Bug fix: all search inputs stop keydown propagation to prevent
    // BC's global Enter handler from triggering room joins / profile opens.
    function makeSearchWrap(initialValue, placeholder, onInput, extraClass, onClear) {
        const wrap = document.createElement('div'); wrap.className = 'fcm-search-wrap';
        const inp = document.createElement('input'); inp.className = 'fcm-search' + (extraClass ? ' ' + extraClass : ''); inp.placeholder = placeholder; inp.value = initialValue;
        const clrBtn = document.createElement('button'); clrBtn.className = 'fcm-clear-btn'; clrBtn.textContent = '×'; clrBtn.title = 'Clear';
        clrBtn.addEventListener('click', e => {
            e.stopPropagation(); inp.value = ''; inp.focus();
            onInput('');
            if (onClear) onClear();
        });
        inp.addEventListener('input', () => { onInput(inp.value); }); // 只更新 searchQ 狀態
        // Bug fix: stop all keydown propagation from search inputs
        inp.addEventListener('keydown', e => { e.stopPropagation(); });
        wrap.appendChild(inp); wrap.appendChild(clrBtn);
        return { wrap, inp };
    }

    function buildMgmtBtns(mn, context) {
        if (!ChatRoomData) return null;
        const wrap = document.createElement('div'); wrap.className = 'fcm-btns';
        const isAdm = !!(ChatRoomData.Admin && ChatRoomData.Admin.some(a => parseInt(a) === mn));
        const isWht = !!(ChatRoomData.Whitelist && ChatRoomData.Whitelist.some(a => parseInt(a) === mn));
        const isBan = !!(ChatRoomData.Ban && ChatRoomData.Ban.some(a => parseInt(a) === mn));
        wrap.appendChild(mkBtn(isAdm ? T('btnRmAdmin') : T('btnAddAdmin'), isAdm ? 'fcm-btn-red' : 'fcm-btn-orange', () => roomOp(mn, isAdm ? 'rmAdmin' : 'makeAdmin')));
        wrap.appendChild(mkBtn(isWht ? T('btnRmWhite') : T('btnAddWhite'), isWht ? 'fcm-btn-red' : 'fcm-btn-green', () => roomOp(mn, isWht ? 'rmWhite' : 'addWhite')));
        if (isBan) wrap.appendChild(mkBtn(T('btnRmBan'), 'fcm-btn-green', () => roomOp(mn, 'unban')));
        else wrap.appendChild(mkBtn(T('btnAddBan'), 'fcm-btn-red', () => roomOp(mn, 'ban')));
        if (context === 'members' && inRoomFn(mn)) wrap.appendChild(mkBtn(T('btnKick'), 'fcm-btn-red', () => showConfirm(T('confirmKick', getDisplayName(mn)), () => roomOp(mn, 'kick'), isZh() ? '逐出' : 'Kick')));
        return wrap;
    }

    // ─── Shared: build action buttons for a person ─────────────────
    // Bug fix: showConfirm is the ONLY place confirmations appear.
    // doToggleList and doRemoveFriend no longer call showConfirm themselves.
    function buildPersonOps(mn, { isInRoom = false, isMe = false, oneSided = false } = {}) {
        mn = parseInt(mn);
        const ops = document.createElement('div'); ops.className = 'fcm-btns';
        const profile = _pc[mn] || null;
        const isFriend = isFriendOf(mn);
        const hasProfile = !!(profile && profile.characterBundle);
        const vb = mkBtn(T('btnView'), '', () => doView(mn));
        if (!isInRoom && !hasProfile) vb.disabled = true;
        ops.appendChild(vb);

        if (!isMe) {
            if (isInRoom) ops.appendChild(mkBtn(T('btnWhisper'), '', () => doWhisper(mn)));
            if (canBeep(mn)) {
                // BEEP/私信 只有真正的好友（含主人／戀人／奴隸關係）才可用，非好友時顯示為灰色停用
                const beepBtn = mkBtn(T('btnBeep'), 'fcm-btn-blue', () => doBeep(mn));
                const beepable = isFriendOf(mn) || ['owner', 'lover', 'sub'].includes(getRel(mn));
                if (!beepable) { beepBtn.disabled = true; beepBtn.title = T('noBeepNotFriend'); }
                ops.appendChild(beepBtn);
            }

            const _sep = document.createElement('span'); _sep.style.cssText = 'width:6px;display:inline-block;'; ops.appendChild(_sep);

            const _dname = getDisplayName(mn);
            const _isWhl = (Player.WhiteList || []).includes(mn);
            const _isBl  = (Player.BlackList || []).includes(mn);
            const _isGh  = (() => { try { return (Player.GhostList || []).includes(mn); } catch { return false; } })();
            const osSuffix = oneSided ? '\n\n' + T('peopleOneSidedWarn') : '';

            if (!isFriend) ops.appendChild(mkBtn(T('btnAddFriend'), 'fcm-btn-green',
                                                 () => showConfirm((isZh() ? `添加「${_dname}」為好友？` : `Add "${_dname}" as friend?`) + osSuffix, () => doAddFriend(mn))));
            else ops.appendChild(mkBtn(T('btnRmFriend'), 'fcm-btn-red',
                                       () => showConfirm(T('confirmDel', _dname), () => doRemoveFriend(mn), isZh() ? '移除' : 'Remove')));

            ops.appendChild(mkBtn(_isWhl ? T('btnRmWhite') : T('btnAddWhite'), _isWhl ? 'fcm-btn-red' : 'fcm-btn-green',
                                  () => showConfirm(_isWhl
                                                    ? (isZh() ? `移除「${_dname}」白名單？` : `Remove "${_dname}" from whitelist?`)
                                                    : (isZh() ? `將「${_dname}」加入白名單？` : `Add "${_dname}" to whitelist?`) + osSuffix,
                                                    () => doToggleList(mn, 'white', !_isWhl))));

            ops.appendChild(mkBtn(_isBl ? T('btnRmBlack') : T('btnAddBlack'), 'fcm-btn-red',
                                  () => showConfirm(_isBl
                                                    ? (isZh() ? `移除「${_dname}」黑名單？` : `Remove "${_dname}" from blacklist?`)
                                                    : T('confirmAddBan', _dname) + osSuffix,
                                                    () => doToggleList(mn, 'black', !_isBl),
                                                    _isBl ? undefined : (isZh() ? '加入' : 'Add'))));

            ops.appendChild(mkBtn(_isGh ? (isZh() ? '－幽靈' : '－Ghost') : (isZh() ? '＋幽靈' : '＋Ghost'), _isGh ? 'fcm-btn-red' : 'fcm-btn-purple',
                                  () => showConfirm(_isGh
                                                    ? (isZh() ? `移除「${_dname}」幽靈？` : `Remove "${_dname}" from ghost?`)
                                                    : T('confirmAddGhost', _dname) + osSuffix,
                                                    () => doToggleList(mn, 'ghost', !_isGh))));
        }
        return ops;
    }

    // ═══════════════════════════════════════════════════════════
    //  PANEL BUILD
    // ═══════════════════════════════════════════════════════════
    function buildPanel() {
        if (document.getElementById('fcm-panel')) { panelEl = document.getElementById('fcm-panel'); return; }
        injectStyles();
        const panel = document.createElement('div'); panel.id = 'fcm-panel'; panel.classList.add('hidden');
        const hdr = document.createElement('div'); hdr.id = 'fcm-hdr';
        const title = document.createElement('div'); title.id = 'fcm-title'; title.textContent = T('panelTitle');
        const minBtn = document.createElement('div'); minBtn.className = 'fcm-hbtn'; minBtn.textContent = T('minimize'); minBtn.addEventListener('click', minimizePanel);
        const closeBtn = document.createElement('div'); closeBtn.className = 'fcm-hbtn'; closeBtn.textContent = T('close'); closeBtn.addEventListener('click', closePanel);
        hdr.appendChild(title); hdr.appendChild(minBtn); hdr.appendChild(closeBtn);
        const tabBar = document.createElement('div'); tabBar.id = 'fcm-tabs';
        [['friends', T('tabFriends')], ['room', T('tabRoom')], ['roomSearch', T('tabRoomSearch')], ['people', T('tabPeople')], ['settings', T('tabSettings')], ['help', T('tabHelp')]].forEach(([key, label]) => {
            const t = document.createElement('div'); t.className = 'fcm-tab' + (key === uiTab ? ' active' : ''); t.dataset.tab = key; t.textContent = label;
            t.addEventListener('click', () => {
                uiTab = key;
                if (key !== 'people') { _peopleQ = ''; _peoplePage = 0; }
                tabBar.querySelectorAll('.fcm-tab').forEach(x => x.classList.toggle('active', x.dataset.tab === key));
                renderCurrent();
            }); tabBar.appendChild(t);
        });
        const content = document.createElement('div'); content.id = 'fcm-content';
        panel.appendChild(hdr); panel.appendChild(tabBar); panel.appendChild(content);
        document.body.appendChild(panel); panelEl = panel;
        let drag = { on: false, ox: 0, oy: 0 };
        hdr.addEventListener('mousedown', e => { if (e.target === minBtn || e.target === closeBtn) return; drag.on = true; const r = panel.getBoundingClientRect(); drag.ox = e.clientX - r.left; drag.oy = e.clientY - r.top; panel.style.transform = 'none'; e.preventDefault(); });
        document.addEventListener('mousemove', e => {
            if (!drag.on) return;
            // 夾住位置：讓標題列（fcm-hdr）永遠留在畫面內，避免拖出視窗後找不到
            const hdrH = hdr.offsetHeight || 46;
            const pw = panel.offsetWidth || 400;
            let nl = e.clientX - drag.ox, nt = e.clientY - drag.oy;
            nt = Math.max(0, Math.min(nt, window.innerHeight - hdrH));
            nl = Math.max(80 - pw, Math.min(nl, window.innerWidth - 80));
            panel.style.left = nl + 'px'; panel.style.top = nt + 'px';
        });
        document.addEventListener('mouseup', () => { drag.on = false; });
        const mini = document.createElement('div'); mini.id = 'fcm-mini';
        mini.innerHTML = `<span style="font-size:16px">🎛</span><div class="fcm-mini-pill"></div><span class="fcm-mini-lbl">${T('miniLabel')}</span>`;
        mini.addEventListener('click', restorePanel); document.body.appendChild(mini); miniEl = mini;
        let md = { on: false, ox: 0, oy: 0, moved: false };
        mini.addEventListener('mousedown', e => { md.on = true; md.moved = false; const r = mini.getBoundingClientRect(); md.ox = e.clientX - r.left; md.oy = e.clientY - r.top; mini.style.bottom = 'auto'; mini.style.transform = 'none'; mini.style.left = r.left + 'px'; mini.style.top = r.top + 'px'; e.preventDefault(); });
        document.addEventListener('mousemove', e => { if (!md.on) return; md.moved = true; mini.style.left = (e.clientX - md.ox) + 'px'; mini.style.top = (e.clientY - md.oy) + 'px'; });
        document.addEventListener('mouseup', () => { if (md.on && !md.moved) restorePanel(); md.on = false; });
    }

    // ═══════════════════════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════════════════════
    function renderCurrent() {
        if (!panelEl || !panelOpen || panelMini) return;
        const content = panelEl.querySelector('#fcm-content'); if (!content) return;
        const inARoom = !!(typeof ChatRoomData !== 'undefined' && ChatRoomData);
        panelEl.querySelectorAll('.fcm-tab[data-tab="room"]').forEach(rt => {
            rt.classList.toggle('fcm-tab-disabled', !inARoom);
            rt.title = inARoom ? '' : T('notInRoom');
        });
        const scrollEl = content.querySelector('.fcm-scroll');
        const savedScroll = scrollEl ? scrollEl.scrollTop : 0;
        const _myToken = ++_renderToken;
        let p;
        if (uiTab === 'friends') p = renderFriends(content, _myToken);
        else if (uiTab === 'people') p = renderPeople(content, _myToken);
        else if (uiTab === 'room') p = renderRoom(content);
        else if (uiTab === 'roomSearch') p = Promise.resolve(renderRoomSearch(content));
        else if (uiTab === 'help') p = Promise.resolve(renderHelp(content));
        else p = Promise.resolve(renderSettings(content));
        (p || Promise.resolve()).then(() => {
            if (_myToken !== _renderToken) return;
            if (savedScroll > 0) { const ns = content.querySelector('.fcm-scroll'); if (ns) ns.scrollTop = savedScroll; }
        }).catch(e => console.warn('🐈‍⬛ [FCM] render:', e));
    }

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

    function makeSortSel(currentMode, options, onChange) {
        const lbl = document.createElement('span'); lbl.className = 'fcm-lbl-sm'; lbl.textContent = T('sortBy') + ':';
        const sel = document.createElement('select'); sel.className = 'fcm-sel';
        options.forEach(([v, l]) => { const o = document.createElement('option'); o.value = v; o.textContent = l; if (v === currentMode) o.selected = true; sel.appendChild(o); });
        sel.addEventListener('change', () => onChange(sel.value));
        return { lbl, sel };
    }

    function makeCountBar(n, total) {
        const d = document.createElement('div'); d.className = 'fcm-count';
        d.textContent = total !== undefined ? T('peopleTotal', n, total) : T('total', n);
        return d;
    }

    async function _autoQueueVisible(mns) {
        const selfMn = parseInt(Player?.MemberNumber);
        await PDB.batchGet(mns);
        let queued = 0;
        for (const mn of mns) {
            if (mn === selfMn) continue;
            const snap = Snapshot._cache[mn];
            if (snap && snap.length > 800) continue;
            if (inRoomFn(mn)) continue;
            const profile = _pc[mn];
            if (!profile || !profile.characterBundle) continue;
            if (_avQueue.some(q => q.mn === mn)) continue;
            _avQueue.push({ mn, profile, onDone: url => {
                if (!url) return;
                const el = panelEl?.querySelector(`.fcm-av[data-mn="${mn}"]`);
                if (el) { el.innerHTML = ''; const img = document.createElement('img'); img.src = url; el.appendChild(img); }
            }});
            queued++;
        }
        if (queued > 0) { if (!_avBusy) _processAvQueue(); }
    }

    async function refreshSnapshotsForList(mns) {
        const selfMn = parseInt(Player?.MemberNumber);
        const toProcess = mns.filter(mn => mn !== selfMn);
        await PDB.batchGet(toProcess);
        let liveCount = 0, queueCount = 0, noBundle = 0;
        for (const mn of toProcess) {
            delete Snapshot._cache[mn];
            if (Snapshot.db) { try { Snapshot.db.transaction('avatars','readwrite').objectStore('avatars').delete(mn); } catch {} }
            const qi = _avQueue.findIndex(q => q.mn === mn);
            if (qi >= 0) _avQueue.splice(qi, 1);
            const C = ChatRoomCharacter && ChatRoomCharacter.find(c => c.MemberNumber === mn);
            if (C) { _captureSnapshotDelayed(C); liveCount++; continue; }
            const profile = _pc[mn];
            if (!profile || !profile.characterBundle) { noBundle++; continue; }
            _avQueue.push({ mn, profile, onDone: url => {
                if (!url) return;
                const el = panelEl?.querySelector(`.fcm-av[data-mn="${mn}"]`);
                if (el) { el.innerHTML = ''; const img = document.createElement('img'); img.src = url; el.appendChild(img); }
            }});
            queueCount++;
        }
        if (!_avBusy && _avQueue.length > 0) _processAvQueue();
    }
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
        nickBtn.title = isZh() ? (showNickname ? '切換為BC名稱' : '切換為暱稱') : (showNickname ? 'Switch to BC name' : 'Switch to nickname');
        nickBtn.addEventListener('click', () => { setShowNickname(!showNickname); renderCurrent(); });
        toolbar.appendChild(nickBtn);
        const { lbl: sl, sel: sortSel } = makeSortSel(sortMode, [['rel', T('sortRel')], ['id', T('sortId')], ['name', T('sortName')], ['added', T('sortAdded')]], v => { sortMode = v; renderCurrent(); });
        toolbar.appendChild(sl); toolbar.appendChild(sortSel);
        const rBtn = mkBtn('↻', 'fcm-btn', () => renderCurrent());
        rBtn.title = isZh() ? '重新整理' : 'Refresh'; rBtn.style.cssText = 'padding:4px 7px;border-radius:50%;font-size:13px;flex-shrink:0;';
        toolbar.appendChild(rBtn);
        const avBtn = mkBtn('📸', 'fcm-btn', () => { const curMns = friends.map(f => f.mn); refreshSnapshotsForList(curMns); });
        avBtn.title = isZh() ? '快照目前名單（強制重建頭像）' : 'Snapshot current list (force rebuild)';
        avBtn.style.cssText = 'padding:4px 7px;border-radius:50%;font-size:13px;flex-shrink:0;';
        toolbar.appendChild(avBtn);
        container.appendChild(toolbar);

        let friends = buildFriendList();
        if (searchQ.trim()) { const q = searchQ.trim().toLowerCase();
                             friends = friends.filter(f => {
                                 const nick = _pc[f.mn]?.lastNick || '';
                                 return f.name.toLowerCase().includes(q)
                                 || nick.toLowerCase().includes(q)
                                 || String(f.mn).includes(q);
                             });
                            }
        friends = friends.filter(applyFilters);
        switch (sortMode) {
            case 'id':    friends.sort((a, b) => a.mn - b.mn); break;
            case 'name':  friends.sort((a, b) => a.name.localeCompare(b.name)); break;
            case 'added': friends.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0)); break;
            default:      friends.sort((a, b) => { const d = REL_ORDER[a.rel] - REL_ORDER[b.rel]; return d || a.name.localeCompare(b.name); });
        }
        await PDB.batchGet(friends.map(f => f.mn));
        if (_myToken !== _renderToken) return;
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
        [['', 'width:42px'], [T('colName'), 'min-width:120px', 'fcm-th-left'], [T('colId'), ''], [T('colRel'), ''], [T('colZone'), ''], [T('colRoom'), 'min-width:100px'], [T('colOps'), 'min-width:150px']].forEach(([text, style, cls]) => {
            const th = document.createElement('th'); th.textContent = text; if (style) th.style.cssText = style; if (cls) th.className = cls; thRow.appendChild(th);
        });
        if (inARoom) { const th = document.createElement('th'); th.textContent = isAdmin ? T('colMgmt') : T('colMgmtNoPerm'); th.className = (isAdmin ? 'fcm-th-mgmt' : 'fcm-th-mgmt-off'); th.style.cssText = 'min-width:140px;max-width:155px;width:150px;'; thRow.appendChild(th); }
        const thead = document.createElement('thead'); thead.appendChild(thRow); tbl.appendChild(thead);
        const tbody = document.createElement('tbody');

        for (const f of friends) {
            const tr = document.createElement('tr'); tr.className = 'fcm-row';
            const online = isOnline(f.mn), zone = getZone(f.mn), isInRoom = inRoomFn(f.mn);
            const snapshotUrl = Snapshot._cache[f.mn] || null;

            const avTd = document.createElement('td'); avTd.appendChild(makeAvEl(f.mn, snapshotUrl)); tr.appendChild(avTd);
            const nameTd = document.createElement('td');
            const nd = document.createElement('div'); nd.className = 'fcm-name'; nd.textContent = f.name; nd.title = f.name;
            const sd = document.createElement('div'); sd.className = 'fcm-sta ' + (online ? 'fcm-online' : 'fcm-offline'); sd.textContent = online ? T('online') : T('offline');
            nameTd.appendChild(nd); nameTd.appendChild(sd); tr.appendChild(nameTd);
            tr.appendChild(makeIdCell(f.mn));
            const relTd = document.createElement('td'); relTd.style.textAlign = 'center'; relTd.style.minWidth = '60px'; relTd.appendChild(makeRelEl(getAllRels(f.mn))); tr.appendChild(relTd);
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
                rl.title = (ri2.isPrivate ? (isZh() ? '[私人] ' : '[Private] ') : '') + rcStr + (roomFull ? ('\n' + (isZh() ? '⚠ 房間已滿' : '⚠ Full')) : ('\n' + (isZh() ? '前往此房間？' : 'Go to room?')));
                if (!roomFull) rl.addEventListener('click', () => navigateToRoom(ri2.name)); else rl.style.color = '#808080';
                if (ri2.isPrivate) { const b2 = document.createElement('span'); b2.style.cssText = 'font-size:10px;color:#c090f0;margin-left:2px;'; b2.textContent = isZh() ? '(私人)' : '(Priv)'; rl.appendChild(b2); }
                return rl;
            }
            if (ri && ri.name) {
                let mc = null, ml = null;
                if (ri.isCurrent && typeof ChatRoomCharacter !== 'undefined') { mc = ChatRoomCharacter.length; ml = ChatRoomData?.MemberLimit ?? null; }
                else { const cd = getCachedRoomInfo(ri.name); if (cd) { mc = cd.MemberCount; ml = cd.MemberLimit; } }
                rt.appendChild(_buildRoomLink(ri, mc, ml));
                if (!ri.isCurrent && mc === null) {
                    const friendSpace = onlineFriends.find(ff => ff.MemberNumber === f.mn)?.ChatRoomSpace;
                    queryRoomInfo(ri.name, friendSpace, data => { if (data && rt.isConnected) { rt.innerHTML = ''; rt.appendChild(_buildRoomLink(ri, data.MemberCount, data.MemberLimit)); } });
                }
            } else if (ri && !ri.name && ri.isPrivate) {
                const sp = document.createElement('span'); sp.style.cssText = 'font-size:11px;color:#c090f0;font-weight:600;';
                sp.textContent = isZh() ? '(私密)' : '(Private)'; rt.appendChild(sp);
            } else { rt.innerHTML = '<span class="fcm-room">—</span>'; }
            tr.appendChild(rt);

            const opsTd = document.createElement('td');
            opsTd.appendChild(buildPersonOps(f.mn, { isInRoom, oneSided: false }));
            tr.appendChild(opsTd);

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
    const PEOPLE_PAGE_SIZE = 100;
    let _peoplePage = 0;

    async function renderPeople(container, _myToken) {
        container.innerHTML = '';
        if (!PDB.db) {
            const em = document.createElement('div'); em.className = 'fcm-empty';
            em.textContent = isZh() ? '資料庫未連線，請確認儲存模式已設定' : 'DB not connected — set a save mode in Settings';
            container.appendChild(em); return;
        }

        const toolbar = document.createElement('div'); toolbar.className = 'fcm-toolbar';
        const sw = document.createElement('div'); sw.style.cssText = 'position:relative;display:inline-flex;align-items:center;flex:1;min-width:180px;max-width:320px;';
        const inp = document.createElement('input'); inp.className = 'fcm-search'; inp.style.width = '100%';
        inp.placeholder = T('peopleSearchPlaceholder'); inp.value = _peopleQ;
        const clrX = document.createElement('button'); clrX.className = 'fcm-clear-btn'; clrX.textContent = '×';
        clrX.addEventListener('click', () => { inp.value = ''; _peopleQ = ''; _peoplePage = 0; runSearch(''); });
        sw.appendChild(inp); sw.appendChild(clrX); toolbar.appendChild(sw);

        const srchBtn = mkBtn(isZh() ? '搜尋' : 'Search', 'fcm-btn', () => { _peoplePage = 0; runSearch(inp.value); });
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
        if (_myToken !== _renderToken) return;
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
            if (isNumId) {
                const mn = parseInt(q);
                const exactMatch = allProfiles.find(p => p.memberNumber === mn);
                if (!exactMatch) {
                    const box = document.createElement('div'); box.className = 'fcm-unknown-id-box';
                    const boxTitle = document.createElement('div'); boxTitle.className = 'fcm-unknown-id-title';
                    boxTitle.textContent = T('peopleUnknownId', mn);
                    box.appendChild(boxTitle);
                    const allBtns = buildPersonOps(mn, { isInRoom: inRoomFn(mn), oneSided: true });
                    // 如果在房間裡，把房管按鈕直接加到同一個 fcm-btns div
                    if (typeof ChatRoomData !== 'undefined' && ChatRoomData) {
                        const sep = document.createElement('span');
                        sep.style.cssText = 'display:inline-block;width:1px;height:14px;background:#3a2870;margin:0 6px;vertical-align:middle;';
                        allBtns.appendChild(sep);
                        const boxMgmtWrap = document.createElement('div');
                        boxMgmtWrap.className = 'fcm-td-mgmt' + (amAdmin() ? '' : ' no-perm');
                        boxMgmtWrap.style.display = 'contents'; // 讓子元素直接流入父 flex
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
                ['', 'width:42px'], [T('colName'), 'min-width:130px', 'fcm-th-left'], [T('colId'), ''],
                [T('colRel'), ''], [T('colOps'), 'min-width:200px'],
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
                const opsTd = document.createElement('td');
                const freshProf = _pc[mn] || null;
                const hasBundle = !!(freshProf && freshProf.characterBundle);
                const opsWrap = document.createElement('div'); opsWrap.className = 'fcm-btns';
                const vb = mkBtn(T('btnView'), '', () => doView(mn));
                if (!isInRoom && !hasBundle) vb.disabled = true;
                opsWrap.appendChild(vb);
                if (canBeep(mn)) opsWrap.appendChild(mkBtn(T('btnBeep'), 'fcm-btn-blue', () => doBeep(mn)));
                const _psep = document.createElement('span'); _psep.style.cssText = 'width:6px;display:inline-block;'; opsWrap.appendChild(_psep);
                const _dname2 = nickName || bcName;
                const osSuffix = oneSided ? '\n\n' + T('peopleOneSidedWarn') : '';
                const _isWhl2 = (Player.WhiteList || []).includes(mn);
                const _isBl2  = (Player.BlackList || []).includes(mn);
                const _isGh2  = (() => { try { return (Player.GhostList || []).includes(mn); } catch { return false; } })();
                if (!isFriendOf(mn)) opsWrap.appendChild(mkBtn(T('btnAddFriend'), 'fcm-btn-green',
                                                               () => showConfirm((isZh() ? `添加「${_dname2}」為好友？` : `Add "${_dname2}" as friend?`) + osSuffix, () => doAddFriend(mn))));
                else opsWrap.appendChild(mkBtn(T('btnRmFriend'), 'fcm-btn-red',
                                               () => showConfirm(T('confirmDel', _dname2), () => doRemoveFriend(mn), isZh() ? '移除' : 'Remove')));
                opsWrap.appendChild(mkBtn(_isWhl2 ? T('btnRmWhite') : T('btnAddWhite'), _isWhl2 ? 'fcm-btn-red' : 'fcm-btn-green',
                                          () => showConfirm(_isWhl2
                                                            ? (isZh() ? `移除「${_dname2}」白名單？` : `Remove "${_dname2}" from whitelist?`)
                                                            : (isZh() ? `將「${_dname2}」加入白名單？` : `Add "${_dname2}" to whitelist?`) + osSuffix,
                                                            () => doToggleList(mn, 'white', !_isWhl2))));
                opsWrap.appendChild(mkBtn(_isBl2 ? T('btnRmBlack') : T('btnAddBlack'), 'fcm-btn-red',
                                          () => showConfirm(_isBl2
                                                            ? (isZh() ? `移除「${_dname2}」黑名單？` : `Remove "${_dname2}" from blacklist?`)
                                                            : T('confirmAddBan', _dname2) + osSuffix,
                                                            () => doToggleList(mn, 'black', !_isBl2),
                                                            _isBl2 ? undefined : (isZh() ? '加入' : 'Add'))));
                opsWrap.appendChild(mkBtn(_isGh2 ? (isZh() ? '-幽靈' : '-Ghost') : (isZh() ? '+幽靈' : '+Ghost'), _isGh2 ? 'fcm-btn-red' : 'fcm-btn-purple',
                                          () => showConfirm(_isGh2
                                                            ? (isZh() ? `移除「${_dname2}」幽靈？` : `Remove "${_dname2}" from ghost?`)
                                                            : T('confirmAddGhost', _dname2) + osSuffix,
                                                            () => doToggleList(mn, 'ghost', !_isGh2))));
                opsTd.appendChild(opsWrap); tr.appendChild(opsTd);
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
                        shareBtn.title = isZh() ? '需在聊天室中才能分享' : 'Must be in a chat room to share';
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
                pageInfo.textContent = isZh() ? `第 ${_peoplePage+1} / ${totalPages} 頁` : `Page ${_peoplePage+1} / ${totalPages}`;
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
        rNickBtn.addEventListener('click', () => { setShowNickname(!showNickname); renderRoom(container); });
        toolbar.appendChild(rNickBtn);
        const { lbl: rsl, sel: rsortSel } = makeSortSel(roomSortMode, [['name', T('sortName')], ['id', T('sortId')], ['rel', T('sortRel')], ['perm', T('permAdmin')]], v => { roomSortMode = v; renderRoom(container); });
        toolbar.appendChild(rsl); toolbar.appendChild(rsortSel);
        const rBtn = mkBtn('↻', 'fcm-btn', () => renderRoom(container));
        rBtn.style.cssText = 'padding:4px 7px;border-radius:50%;font-size:13px;flex-shrink:0;';
        toolbar.appendChild(rBtn);
        const avBtnR = mkBtn('📸', 'fcm-btn', () => { refreshSnapshotsForList(mns); });
        avBtnR.title = isZh() ? '快照目前名單（強制重建頭像）' : 'Snapshot current list (force rebuild)';
        avBtnR.style.cssText = 'padding:4px 7px;border-radius:50%;font-size:13px;flex-shrink:0;';
        toolbar.appendChild(avBtnR);
        container.appendChild(toolbar);

        let mns = [];
        if (roomSubTab === 'members') mns = (ChatRoomData.Character || []).map(c => c.MemberNumber);
        else if (roomSubTab === 'admin') mns = [...(ChatRoomData.Admin || [])];
        else if (roomSubTab === 'white') mns = [...(ChatRoomData.Whitelist || [])];
        else if (roomSubTab === 'ban')   mns = [...(ChatRoomData.Ban || [])];

        if (roomSearchQ.trim()) { const q = roomSearchQ.trim().toLowerCase(); mns = mns.filter(mn => getDisplayName(mn).toLowerCase().includes(q) || String(mn).includes(q)); }

        switch (roomSortMode) {
            case 'id':   mns.sort((a, b) => a - b); break;
            case 'rel':  mns.sort((a, b) => REL_ORDER[getRel(a)] - REL_ORDER[getRel(b)]); break;
            case 'perm': mns.sort((a, b) => { const pa = getRoomPerms(a), pb = getRoomPerms(b); const ord = ['admin','pass','ban','visit']; return (ord.indexOf(pa[0]) || 0) - (ord.indexOf(pb[0]) || 0); }); break;
            default:     mns.sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b))); break;
        }

        const wrapper = document.createElement('div'); wrapper.className = 'fcm-scroll-wrap';
        const scroll = document.createElement('div'); scroll.className = 'fcm-scroll';

        if (!mns.length) { const em = document.createElement('div'); em.className = 'fcm-empty'; em.textContent = T('noData'); scroll.appendChild(em); wrapper.appendChild(scroll); wrapper.appendChild(makeCountBar(0)); container.appendChild(wrapper); return; }

        await PDB.batchGet(mns);

        const tbl = document.createElement('table'); tbl.className = 'fcm-tbl';
        const thRow = document.createElement('tr');
        [['', 'width:42px'], [T('colName'), 'min-width:120px', 'fcm-th-left'], [T('colId'), ''], [T('colRel'), ''], [T('colPerm'), 'min-width:80px'], [T('colOps'), 'min-width:150px']].forEach(([text, style, cls]) => {
            const th = document.createElement('th'); th.textContent = text; if (style) th.style.cssText = style; if (cls) th.className = cls; thRow.appendChild(th);
        });
        const thMgmt = document.createElement('th'); thMgmt.textContent = isAdmin ? T('colMgmt') : T('colMgmtNoPerm'); thMgmt.className = isAdmin ? 'fcm-th-mgmt' : 'fcm-th-mgmt-off'; thMgmt.style.cssText = 'min-width:140px;max-width:155px;width:150px;'; thRow.appendChild(thMgmt);
        const thead = document.createElement('thead'); thead.appendChild(thRow); tbl.appendChild(thead);
        const tbody = document.createElement('tbody');

        for (const mn of mns) {
            const tr = document.createElement('tr'); tr.className = 'fcm-row';
            const name = getDisplayName(mn), rel = getRel(mn), perms = getRoomPerms(mn);
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

            const opsTd = document.createElement('td');
            opsTd.appendChild(buildPersonOps(mn, { isInRoom, isMe }));
            tr.appendChild(opsTd);

            const mgmtTd = document.createElement('td'); mgmtTd.className = 'fcm-td-mgmt' + (isAdmin && !isMe ? '' : ' no-perm');
            if (!isMe) { const mb = buildMgmtBtns(mn, roomSubTab); if (mb) mgmtTd.appendChild(mb); }
            tr.appendChild(mgmtTd);
            tbody.appendChild(tr);
        }
        tbl.appendChild(tbody); scroll.appendChild(tbl);
        wrapper.appendChild(scroll);
        wrapper.appendChild(makeCountBar(mns.length));
        container.appendChild(wrapper);

        if (cfg.avatars) _autoQueueVisible(mns);
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
    async function renderRoomSearch(container) {
        container.innerHTML = '';
        const wrap = document.createElement('div'); wrap.style.cssText = 'display:flex;flex-direction:column;height:100%;';

        const tb = document.createElement('div'); tb.className = 'fcm-toolbar';
        // (left refresh button removed in v1.3.5 — right side already has one)

        const sw = document.createElement('div'); sw.style.cssText = 'position:relative;display:inline-flex;align-items:center;flex:1;min-width:120px;max-width:200px;';
        const inp = document.createElement('input'); inp.className = 'fcm-search'; inp.placeholder = T('roomSearch2'); inp.value = _roomSearchQ2; inp.style.width = '100%';
        const clrX = document.createElement('button'); clrX.className = 'fcm-clear-btn'; clrX.textContent = '×';
        clrX.addEventListener('click', () => { inp.value = ''; _roomSearchQ2 = ''; });
        sw.appendChild(inp); sw.appendChild(clrX); tb.appendChild(sw);

        const srchBtn = mkBtn(T('roomSearchBtn'), 'fcm-btn', () => runSearch());
        srchBtn.style.cssText = 'padding:5px 10px;border-radius:8px;border:1.5px solid #4038a0;background:#1e1635;color:#b098d0;font-size:12px;font-weight:600;cursor:pointer;flex-shrink:0;';
        tb.appendChild(srchBtn);

        const zoneColors = {
            'X': { bg: '#1e1635', active: '#2e2650', label: isZh() ? '混合' : 'Mixed' },
            '':  { bg: '#2a1020', active: '#7a2040', label: isZh() ? '女性' : 'Female' },
            'M': { bg: '#101828', active: '#1a4070', label: isZh() ? '男性' : 'Male' }
        };
        const zoneGroup = document.createElement('div'); zoneGroup.style.cssText = 'display:flex;gap:3px;';
        Object.entries(zoneColors).forEach(([z, info]) => {
            const b = document.createElement('button'); b.setAttribute('data-space', z); b.textContent = info.label;
            const isActive = _roomZoneFilter === z;
            b.style.cssText = `padding:5px 10px;border-radius:8px;border:1.5px solid ${isActive ? '#d0b8ff' : '#4038a0'};background:${isActive ? info.active : info.bg};color:${isActive ? '#fff' : '#9070b0'};font-size:12px;font-weight:${isActive ? '700' : '400'};cursor:pointer;white-space:nowrap;`;
            b.addEventListener('click', () => {
                _roomZoneFilter = z;
                zoneGroup.querySelectorAll('[data-space]').forEach(x => {
                    const xz = x.getAttribute('data-space'), xi = zoneColors[xz], xa = xz === z;
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
        [['fav', isZh() ? '最愛優先' : 'Fav First'], ['friend', isZh() ? '好友優先' : 'Friends First'], ['name', isZh() ? '名稱優先' : 'Name']].forEach(([v, l]) => {
            const o = document.createElement('option'); o.value = v; o.textContent = l; if (v === _roomSortMode) o.selected = true; sortSel.appendChild(o);
        });
        sortSel.addEventListener('change', () => { _roomSortMode = sortSel.value; renderResults(); });
        tb.appendChild(sortSel);
        const rBtn = mkBtn('↻', 'fcm-btn', () => runSearch());
        rBtn.style.cssText = 'padding:4px 7px;border-radius:50%;font-size:13px;flex-shrink:0;';
        tb.appendChild(rBtn);
        wrap.appendChild(tb);

        const scroll = document.createElement('div'); scroll.style.cssText = 'flex:1;overflow-y:auto;';
        const countEl = document.createElement('div'); countEl.className = 'fcm-count'; countEl.style.textAlign = 'center';
        wrap.appendChild(scroll); wrap.appendChild(countEl);
        container.appendChild(wrap);

        // Bug fix: stopPropagation on room search input
        inp.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') runSearch(); });

        async function runSearch() {
            _roomSearchQ2 = inp.value;
            srchBtn.textContent = T('roomSearching'); srchBtn.disabled = true;
            _roomResults = await doRoomSearch(_roomSearchQ2, _roomZoneFilter);
            srchBtn.textContent = T('roomSearchBtn'); srchBtn.disabled = false;
            renderResults();
        }

        function renderResults() {
            scroll.innerHTML = '';
            const currentRoomName = (typeof ChatRoomData !== 'undefined' && ChatRoomData) ? ChatRoomData.Name : null;
            let list = [..._roomResults].sort((a, b) => {
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
                const card = document.createElement('div');
                // Priority: current room (pink) > fav (gold) > friends (green) > default
                let cardBorder;
                if (isCurrent) {
                    cardBorder = 'border:2px solid #e060a0;border-radius:8px;margin:3px 4px;background:rgba(220,80,140,.08);';
                } else if (isFav) {
                    cardBorder = 'border:1.5px solid #c8a020;border-radius:8px;margin:3px 4px;background:rgba(200,160,32,.06);';
                } else if (friendsHere.length > 0) {
                    cardBorder = 'border:1.5px solid #409060;border-radius:8px;margin:3px 4px;background:rgba(40,128,64,.06);';
                } else {
                    cardBorder = 'border-bottom:1px solid #2a2048;';
                }
                card.style.cssText = `display:flex;align-items:center;gap:10px;padding:10px 12px;transition:background .1s;${cardBorder}`;
                card.addEventListener('mouseenter', () => { if (!isFav && !friendsHere.length && !isCurrent) card.style.background = '#261a4a'; });
                card.addEventListener('mouseleave', () => { if (!isFav && !friendsHere.length && !isCurrent) card.style.background = ''; });
                const info = document.createElement('div'); info.style.cssText = 'flex:1;min-width:0;';
                const line1 = document.createElement('div'); line1.style.cssText = 'display:flex;align-items:center;gap:5px;flex-wrap:wrap;';
                const favBtn = document.createElement('button');
                favBtn.style.cssText = 'font-size:15px;padding:0 3px;border:none;background:transparent;cursor:pointer;color:' + (isFav ? '#f0d060' : '#5040a0') + ';flex-shrink:0;';
                favBtn.textContent = isFav ? '★' : '☆';
                favBtn.addEventListener('click', e => { e.stopPropagation(); if (_favRooms.has(room.Name)) _favRooms.delete(room.Name); else _favRooms.add(room.Name); saveFavRooms(); renderResults(); });
                line1.appendChild(favBtn);
                const nm = document.createElement('span'); nm.style.cssText = 'color:#e8c8ff;font-size:14px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;'; nm.textContent = room.Name || '?'; nm.title = room.Name; line1.appendChild(nm);
                if (room.Private) { const priv = document.createElement('span'); priv.style.cssText = 'font-size:11px;background:#2a1048;border:1px solid #8060b0;color:#c090f0;border-radius:6px;padding:2px 7px;flex-shrink:0;'; priv.textContent = T('roomPrivateLabel'); line1.appendChild(priv); }
                if (room.Creator) { const cr = document.createElement('span'); cr.style.cssText = 'font-size:14px;color:#e8c8ff;font-weight:700;flex-shrink:0;'; cr.textContent = '- ' + room.Creator; line1.appendChild(cr); }                if (cStr) { const cnt = document.createElement('span'); cnt.style.cssText = 'color:#9878b8;font-size:12px;flex-shrink:0;'; cnt.textContent = cStr; line1.appendChild(cnt); }
                if (isCurrent) { const hereBadge = document.createElement('span'); hereBadge.style.cssText = 'font-size:11px;background:#3a0828;border:1px solid #e060a0;color:#ff90c0;border-radius:6px;padding:2px 7px;flex-shrink:0;font-weight:700;'; hereBadge.textContent = isZh() ? '🏠 你' : '🏠 You'; line1.appendChild(hereBadge); }
                if (friendsHere.length > 0) { const fb = document.createElement('span'); fb.style.cssText = 'font-size:11px;background:#102038;border:1px solid #4080d8;color:#80c8ff;border-radius:6px;padding:2px 7px;flex-shrink:0;'; fb.textContent = `👥${friendsHere.length}: ${friendsHere.map(f => f.MemberName||'#'+f.MemberNumber).join(', ')}`; line1.appendChild(fb); }
                info.appendChild(line1);
                if (room.Description) { const desc = document.createElement('div'); desc.style.cssText = 'color:#7060a0;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px;'; desc.textContent = room.Description; info.appendChild(desc); }
                card.appendChild(info);
                // Join/Re-enter button
                const joinLabel = isCurrent ? (isZh() ? '重新進入' : 'Re-enter') : T('roomJoin');
                const joinCls   = isCurrent ? 'fcm-btn-orange' : 'fcm-btn-blue';
                const joinBtn = mkBtn(joinLabel, joinCls, () => {
                    if (isCurrent) {
                        const msg = isZh()
                        ? `你已經在「${room.Name}」中了。\n確定要重新進入嗎？`
                        : `You are already in "${room.Name}".\nRe-enter the room?`;
                        showConfirm(msg, () => navigateToRoom(room.Name), isZh() ? '重新進入' : 'Re-enter');
                    } else {
                        navigateToRoom(room.Name);
                    }
                });
                joinBtn.style.cssText += ';padding:7px 16px;font-size:13px;font-weight:700;flex-shrink:0;';
                card.appendChild(joinBtn);
                scroll.appendChild(card);
            });
        }

        if (_roomResults.length === 0) runSearch(); else renderResults();
    }
    function renderHelp(container) {
        container.innerHTML = '';
        const wrap = document.createElement('div');
        wrap.style.cssText = 'padding:16px 20px;overflow-y:auto;display:flex;flex-direction:column;gap:0;height:100%;';
        const zh = isZh();
        const sections = zh ? [
            { icon: '🎛', title: 'FCM 是什麼？',
             body: 'FCM（Friends & Chatroom Manager）是一個好友與聊天室管理工具，讓你在同一面板中查看好友狀態、管理房間成員、搜尋房間，以及查詢曾遇過的角色。' },
            { icon: '⚙', title: '部分功能需在「設定」頁面手動啟用',
             items: [
                 '【顯示頭像】— 預設關閉。啟用後在各列表顯示角色頭像（需曾同房或擁有完整資料）。',
                 '【私聊時顯示對象頭像】— 進入悄悄話 / BEEP 模式時，在畫面左下角顯示對象頭像。僅在聊天室主畫面顯示，查看角色資料、衣櫃等覆蓋畫面時自動隱藏。',
                 '【儲存模式】— 預設「不儲存」。建議至少選「僅名稱」，否則離線好友將無法顯示名稱，人員查詢頁也沒有資料。',
                 '【私聊 / BEEP 輸入框提示色】— 輸入 /w 或進入悄悄話模式時，輸入框顯示顏色邊框。',
                 '【OOC 保護】— 悄悄話模式下封鎖 Ctrl+Enter，防止 OOC 內容被誤發為普通對話。',
                 '【幽靈名單隱身】— 幽靈名單中的角色在聊天室不顯示身體（只對自己有效）。',
             ]},
            { icon: '👥', title: '好友關係顯示「單向好友」是正常的',
             body: '對方剛添加你時，BC 伺服器尚未將更新資料推送到你的客戶端，所以顯示為「單向好友」。重新登入或等待伺服器同步後即可顯示正確關係。' },
            { icon: '🏠', title: '房間管理',
             items: [
                 '「房間管理」頁需要你目前在某個聊天室中才能使用。',
                 '管理員功能（踢人、封禁、白名單等）需要你擁有該房間的管理員權限。',
                 '房間搜尋頁可以搜尋公開房間，並以星號標記最愛房間。',
             ]},
            { icon: '📍', title: '召喚功能（BEEP 視窗中的「召喚」按鈕）',
             body: '按下「召喚」會傳送附帶當前房間資訊的 BEEP。對方必須在 BC 中設定有接受召喚的規則才能自動傳送；否則對方只會收到文字訊息「summon」。需在房間中才能使用。' },
            { icon: '📜', title: '人員查詢與 Profile 分享',
             items: [
                 '「人員查詢」頁顯示你曾在同一房間遇過的角色（需啟用儲存模式）。',
                 '擁有完整資料（完整模式）的角色可點「分享」，將 Profile 傳送給當前聊天室的其他人。',
                 '與 WCE（bce-past-profiles）完全相容。若已安裝 WCE 建議儲存模式設為「不儲存」以避免重複儲存。',
             ]},
            { icon: '🖼', title: '頭像說明',
             items: [
                 '頭像從角色的 BC 畫布截取臉部，需有完整外觀資料才能生成。',
                 '若頭像顯示文字縮寫，可點擊頭像格子強制重新截取。',
                 '設定頁的「頭像快取管理」可清除所有頭像或批次載入好友頭像。',
             ]},
            { icon: '🔑', title: 'FCM 按鈕位置',
             items: [
                 '聊天室右側工具列 — 貓頭圖示按鈕',
                 '大廳畫面右上角 — 貓頭圖示按鈕',
                 '自己的個人檔案頁 — 右側按鈕',
                 '可在設定頁的「按鈕顯示設定」中分別開關各位置的按鈕（至少須保留一個）。',
             ]},
        ] : [
            { icon: '🎛', title: 'What is FCM?',
             body: "FCM (Friends & Chatroom Manager) is a companion tool for Bondage Club. View friend status, manage room members, search rooms, and look up characters you've encountered — all in one panel." },
            { icon: '⚙', title: 'Some features must be enabled in Settings first',
             items: [
                 '[Show Avatars] — Off by default. Shows portraits in lists (requires having been in the same room or having full profile data).',
                 '[Save Mode] — Defaults to "Off". Set to at least "Name only" so offline friend names display and the People tab has data.',
                 "[Show target avatar during whisper] — Displays the target's avatar bottom-left when in whisper/BEEP mode. Only on chatroom main screen; hidden during profile/wardrobe views.",
                 '[Whisper/BEEP Input Glow] — Shows a colored glow on chat input when /w is typed or whisper mode is active.',
                 '[OOC Protection] — Blocks Ctrl+Enter in whisper mode to prevent OOC content from being sent as normal chat.',
                 '[Ghost List Hide] — Characters on your ghost list are hidden in the chatroom (only affects your view).',
             ]},
            { icon: '👥', title: '"One-way" relationship is normal',
             body: "If someone shows as One-way friend, it means they recently added you but BC's server hasn't synced yet. Re-logging or waiting will fix it." },
            { icon: '🏠', title: 'Room Management',
             items: [
                 'The Room Management tab only works while you are in a chatroom.',
                 'Admin actions (kick, ban, whitelist, etc.) require admin rights in the room.',
                 'Room Search lets you search public rooms and star favorites.',
             ]},
            { icon: '📍', title: 'Summon (button in the BEEP dialog)',
             body: 'Clicking "Summon" sends a BEEP with your current room info. The target must have a summon rule in BC to be teleported automatically — otherwise they only receive "summon". Must be in a room.' },
            { icon: '📜', title: 'People tab & Profile sharing',
             items: [
                 "The People tab shows characters you've encountered (requires Save Mode).",
                 'Characters with full profile data can be shared to the chatroom via the Share button.',
                 "Fully compatible with WCE's bce-past-profiles DB. Use Save Mode \"Off\" if WCE is installed.",
             ]},
            { icon: '🖼', title: 'Avatars',
             items: [
                 "Avatars are cropped from the character's BC canvas — full appearance data required.",
                 'Click the avatar cell to force a reload.',
                 'Use "Avatar Cache" in Settings to clear or batch-load avatars.',
             ]},
            { icon: '🔑', title: 'FCM button locations',
             items: [
                 'ChatRoom toolbar — cat icon on the right',
                 'Main Hall — cat icon top-right',
                 'Your own profile page — right side button',
                 'Toggle each in Settings → Button Visibility.',
             ]},
        ];
        sections.forEach(sec => {
            const card = document.createElement('div');
            card.style.cssText = 'background:#1a1230;border:1px solid #2e2458;border-radius:10px;padding:12px 16px;margin-bottom:8px;transition:border-color .15s;';
            card.addEventListener('mouseenter', () => { card.style.borderColor = '#5a48a8'; });
            card.addEventListener('mouseleave', () => { card.style.borderColor = '#2e2458'; });
            const titleRow = document.createElement('div');
            titleRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px;';
            const iconEl = document.createElement('span'); iconEl.style.cssText = 'font-size:15px;flex-shrink:0;'; iconEl.textContent = sec.icon;
            const titleEl = document.createElement('div'); titleEl.style.cssText = 'color:#e0c8ff;font-size:13px;font-weight:700;'; titleEl.textContent = sec.title;
            titleRow.appendChild(iconEl); titleRow.appendChild(titleEl); card.appendChild(titleRow);
            if (sec.body) { const p = document.createElement('div'); p.style.cssText = 'color:#a090c0;font-size:12px;line-height:1.7;'; p.textContent = sec.body; card.appendChild(p); }
            if (sec.items) {
                const ul = document.createElement('div'); ul.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
                sec.items.forEach(item => {
                    const li = document.createElement('div'); li.style.cssText = 'color:#a090c0;font-size:12px;line-height:1.6;display:flex;gap:6px;';
                    const dot = document.createElement('span'); dot.style.cssText = 'color:#5a48a0;flex-shrink:0;'; dot.textContent = '•';
                    const txt = document.createElement('span'); txt.textContent = item;
                    li.appendChild(dot); li.appendChild(txt); ul.appendChild(li);
                });
                card.appendChild(ul);
            }
            wrap.appendChild(card);
        });
        const footer = document.createElement('div');
        footer.style.cssText = 'margin-top:4px;padding:10px 0;text-align:center;color:#4a3870;font-size:11px;letter-spacing:1px;';
        footer.textContent = `FCM v${MOD_VER}  ·  Liko - Friends & Chatroom Manager`;
        wrap.appendChild(footer);
        container.appendChild(wrap);
    }
    function renderSettings(container) {
        container.innerHTML = '';
        const wrap = document.createElement('div'); wrap.className = 'fcm-settings-wrap';
        function settingRow(label, note, on, onChange) {
            const row = document.createElement('div'); row.className = 'fcm-set-row';
            const tog = mkToggle(on, onChange), info = document.createElement('div');
            const lbl = document.createElement('div'); lbl.className = 'fcm-set-label'; lbl.textContent = label;
            const nt = document.createElement('div'); nt.className = 'fcm-set-note'; nt.textContent = note;
            info.appendChild(lbl); info.appendChild(nt); row.appendChild(tog); row.appendChild(info);
            return row;
        }
        function sectionHeader(title) {
            const h = document.createElement('div');
            h.style.cssText = 'font-size:15px;font-weight:800;letter-spacing:1px;color:#c4a0e0;padding:14px 0 4px 0;border-bottom:2px solid #3a2870;margin-bottom:2px;';
            h.textContent = title; wrap.appendChild(h);
        }
        function divider() { const d = document.createElement('div'); d.className = 'fcm-divider'; wrap.appendChild(d); }

        // ══════════════════════════════════════════
        //  GROUP A: UI 管理
        // ══════════════════════════════════════════
        sectionHeader(isZh() ? '⚙ UI 管理' : '⚙ UI Management');

        // ── Language ──────────────────────────────
        const langRow = document.createElement('div'); langRow.className = 'fcm-set-row'; langRow.style.alignItems = 'center';
        const langInfo = document.createElement('div'); langInfo.style.flex = '1';
        const langLbl = document.createElement('div'); langLbl.className = 'fcm-set-label'; langLbl.textContent = T('langLabel');
        const langNote2 = document.createElement('div'); langNote2.className = 'fcm-set-note';
        try { const tl = (typeof TranslationLanguage !== 'undefined' ? TranslationLanguage : ''); langNote2.textContent = T('langNote') + '  ' + T('langDetected', tl); } catch { langNote2.textContent = T('langNote'); }
        langInfo.appendChild(langLbl); langInfo.appendChild(langNote2);
        const langSel = document.createElement('select'); langSel.className = 'fcm-sel'; langSel.style.flexShrink = '0';
        // 舊值相容：把已存的 zh/en 映射回 TW/EN 供下拉選單正確選取
        const _curLang = cfg.lang === 'zh' ? 'TW' : cfg.lang === 'en' ? 'EN' : (cfg.lang || 'auto');
        FCM_LANGS.forEach(v => {
            const o = document.createElement('option'); o.value = v; o.textContent = FCM_LANG_NAMES[v] || v; if (v === _curLang) o.selected = true; langSel.appendChild(o);
        });
        langSel.addEventListener('change', () => {
            cfg.lang = langSel.value; saveCfg();
            if (panelEl) { panelEl.remove(); panelEl = null; }
            if (miniEl) { miniEl.remove(); miniEl = null; }
            panelOpen = false; panelMini = false;
            buildPanel(); uiTab = 'settings'; openPanel();
        });
        langRow.appendChild(langInfo); langRow.appendChild(langSel);
        wrap.appendChild(langRow);
        divider();

        // ── Avatars ───────────────────────────────
        const avRow = settingRow(T('setAvatars'), T('setAvatarsNote'), cfg.avatars, v => { cfg.avatars = v; saveCfg(); });
        const cacheBtn = document.createElement('button'); cacheBtn.className = 'fcm-btn fcm-btn-blue';
        cacheBtn.textContent = T('btnReloadAvatars'); cacheBtn.style.cssText = 'font-size:11px;padding:6px 12px;flex-shrink:0;margin-left:auto;';
        cacheBtn.title = T('reloadAvatarsNote');
        avRow.appendChild(cacheBtn);
        wrap.appendChild(avRow);

        const avPanel = document.createElement('div');
        avPanel.style.cssText = 'display:none;margin:0 0 4px 0;padding:10px 14px;background:#1a1030;border-radius:8px;border:1px solid #3a2870;flex-direction:column;gap:8px;';
        const avStatus = document.createElement('div'); avStatus.className = 'fcm-reload-status'; avStatus.style.textAlign = 'center';
        setAvStatusEl(avStatus);

        const clearRow = document.createElement('div'); clearRow.style.cssText = 'display:flex;align-items:center;gap:10px;';
        const clearInfo = document.createElement('div'); clearInfo.style.flex = '1';
        const clearLbl = document.createElement('div'); clearLbl.style.cssText = 'color:#e8d4ff;font-size:13px;font-weight:600;'; clearLbl.textContent = T('btnClearAvatarCache');
        const clearNote = document.createElement('div'); clearNote.className = 'fcm-set-note'; clearNote.textContent = T('clearAvatarCacheNote');
        clearInfo.appendChild(clearLbl); clearInfo.appendChild(clearNote);
        const clearExecBtn = document.createElement('button'); clearExecBtn.className = 'fcm-btn fcm-btn-red';
        clearExecBtn.textContent = isZh() ? '清除' : 'Clear'; clearExecBtn.style.cssText = 'flex-shrink:0;padding:5px 12px;';
        clearExecBtn.addEventListener('click', async () => {
            clearExecBtn.disabled = true; clearExecBtn.textContent = isZh() ? '清除中...' : 'Clearing...';
            await Snapshot.clear(); renderCurrent();
            avStatus.textContent = isZh() ? '✓ 頭像快取已清除' : '✓ Cache cleared';
            clearExecBtn.disabled = false; clearExecBtn.textContent = isZh() ? '清除' : 'Clear';
            setTimeout(() => { avStatus.textContent = ''; }, 3000);
        });
        clearRow.appendChild(clearInfo); clearRow.appendChild(clearExecBtn);
        const avOptDiv = document.createElement('div'); avOptDiv.style.cssText = 'height:1px;background:#2a2048;';
        const loadRow = document.createElement('div'); loadRow.style.cssText = 'display:flex;align-items:center;gap:10px;';
        const loadInfo = document.createElement('div'); loadInfo.style.flex = '1';
        const loadLbl = document.createElement('div'); loadLbl.style.cssText = 'color:#e8d4ff;font-size:13px;font-weight:600;'; loadLbl.textContent = T('btnLoadFriendAvatars');
        const loadNote = document.createElement('div'); loadNote.className = 'fcm-set-note'; loadNote.textContent = T('loadFriendAvatarsNote');
        loadInfo.appendChild(loadLbl); loadInfo.appendChild(loadNote);
        const loadExecBtn = document.createElement('button'); loadExecBtn.className = 'fcm-btn fcm-btn-blue';
        loadExecBtn.textContent = '📸'; loadExecBtn.style.cssText = 'flex-shrink:0;font-size:14px;padding:5px 10px;';
        loadExecBtn.addEventListener('click', async () => {
            if (loadExecBtn.disabled) return;
            loadExecBtn.disabled = true;
            const friendMns = buildFriendList().map(f => f.mn).filter(mn => { const snap = Snapshot._cache[mn]; return !snap || snap.length <= 800; });
            const total = friendMns.length;
            if (total === 0) { avStatus.textContent = isZh() ? '沒有需要載入的好友' : 'No friends need loading'; loadExecBtn.disabled = false; setTimeout(() => { avStatus.textContent = ''; }, 3000); return; }
            const waitMs = Math.min(30000, Math.max(5000, total * 150));
            await PDB.batchGet(friendMns);
            for (const mn of friendMns) {
                const p = _pc[mn]; if (!p || !p.characterBundle) continue;
                try { const data = JSON.parse(p.characterBundle); if (typeof CharacterLoadOnline === 'function') { const C = CharacterLoadOnline(data, mn); if (C && typeof CharacterRefresh === 'function') CharacterRefresh(C, false, undefined); } } catch {}
                await new Promise(r => setTimeout(r, 20));
            }
            let remaining = waitMs;
            const tick = setInterval(() => { remaining -= 1000; avStatus.textContent = remaining > 0 ? (isZh() ? `等待 BC 緩存外觀... 剩餘 ${(remaining/1000).toFixed(0)} 秒` : `Waiting for BC... ${(remaining/1000).toFixed(0)}s left`) : (isZh() ? '開始截圖...' : 'Snapshotting...'); }, 1000);
            avStatus.textContent = isZh() ? `等待 BC 緩存外觀... ${(waitMs/1000).toFixed(0)} 秒` : `Waiting for BC... ${(waitMs/1000).toFixed(0)}s`;
            await new Promise(r => setTimeout(r, waitMs));
            clearInterval(tick);
            await refreshSnapshotsForList(friendMns);
            avStatus.textContent = T('loadFriendAvatarsDone');
            loadExecBtn.disabled = false;
            setTimeout(() => { avStatus.textContent = ''; }, 4000);
        });
        loadRow.appendChild(loadInfo); loadRow.appendChild(loadExecBtn);
        avPanel.appendChild(clearRow); avPanel.appendChild(avOptDiv); avPanel.appendChild(loadRow); avPanel.appendChild(avStatus);
        let avPanelOpen = false;
        cacheBtn.addEventListener('click', () => { avPanelOpen = !avPanelOpen; avPanel.style.display = avPanelOpen ? 'flex' : 'none'; cacheBtn.style.borderColor = avPanelOpen ? '#b090f0' : ''; });
        wrap.appendChild(avPanel);
        divider();

        // ── Button Visibility — three checkboxes inline ───────────────
        const btnVisRow = document.createElement('div'); btnVisRow.className = 'fcm-set-row'; btnVisRow.style.alignItems = 'center';
        const btnVisInfo = document.createElement('div'); btnVisInfo.style.flex = '1';
        const btnVisLbl = document.createElement('div'); btnVisLbl.className = 'fcm-set-label'; btnVisLbl.textContent = T('btnVisibilityLabel');
        const btnVisNote = document.createElement('div'); btnVisNote.className = 'fcm-set-note'; btnVisNote.textContent = T('btnVisibilityNote');
        btnVisInfo.appendChild(btnVisLbl); btnVisInfo.appendChild(btnVisNote);
        btnVisRow.appendChild(btnVisInfo);
        // Three checkboxes side by side
        const chkWrap = document.createElement('div'); chkWrap.style.cssText = 'display:flex;flex-direction:row;gap:12px;flex-shrink:0;align-items:center;';
        function makeBtnVisChk(cfgKey, labelText) {
            const cell = document.createElement('label'); cell.style.cssText = 'display:flex;align-items:center;gap:4px;cursor:pointer;white-space:nowrap;';
            const chk = document.createElement('input'); chk.type = 'checkbox'; chk.checked = cfg[cfgKey]; chk.style.cssText = 'width:14px;height:14px;accent-color:#a078e8;cursor:pointer;';
            const lbl = document.createElement('span'); lbl.style.cssText = 'color:#c4a0e0;font-size:12px;';  lbl.textContent = labelText;
            chk.addEventListener('change', () => {
                const keys = ['btnShowChatRoom', 'btnShowMainHall', 'btnShowProfile'];
                if (!chk.checked && !keys.filter(k => k !== cfgKey).some(k => cfg[k])) {
                    chk.checked = true;
                    lbl.style.color = '#ff8080'; setTimeout(() => { lbl.style.color = '#c4a0e0'; }, 1200);
                    return;
                }
                cfg[cfgKey] = chk.checked; saveCfg();
            });
            cell.appendChild(chk); cell.appendChild(lbl);
            return cell;
        }
        chkWrap.appendChild(makeBtnVisChk('btnShowChatRoom', T('btnShowChatRoom')));
        chkWrap.appendChild(makeBtnVisChk('btnShowMainHall', T('btnShowMainHall')));
        chkWrap.appendChild(makeBtnVisChk('btnShowProfile',  T('btnShowProfile')));
        btnVisRow.appendChild(chkWrap);
        wrap.appendChild(btnVisRow);
        divider();

        // ── Save Mode ─────────────────────────────
        const smRow = document.createElement('div'); smRow.className = 'fcm-set-row'; smRow.style.alignItems = 'center';
        const smInfo = document.createElement('div'); smInfo.style.flex = '1'; smInfo.style.display = 'flex'; smInfo.style.alignItems = 'center'; smInfo.style.flexWrap = 'wrap'; smInfo.style.gap = '6px';
        const smLbl = document.createElement('div'); smLbl.className = 'fcm-set-label'; smLbl.textContent = T('saveModeLabel'); smInfo.appendChild(smLbl);
        const wceTag = document.createElement('span'); wceTag.style.display = 'none';
        detectWCESave().then(wceOn => { if (wceOn) { wceTag.className = 'fcm-wce-tag fcm-wce-tag-yes'; wceTag.textContent = isZh() ? '偵測到 WCE Profiles' : 'WCE detected'; wceTag.style.display = 'inline-block'; } });
        smInfo.appendChild(wceTag);
        const smSel = document.createElement('select'); smSel.className = 'fcm-sel'; smSel.style.flexShrink = '0';
        [['off', T('saveModeOff')], ['name', T('saveModeName')], ['avatar', T('saveModeAvatar')], ['full', T('saveModeFull')]].forEach(([v, l]) => {
            const o = document.createElement('option'); o.value = v; o.textContent = l; if (v === (cfg.saveMode||'off')) o.selected = true; smSel.appendChild(o);
        });
        const smDesc = document.createElement('div'); smDesc.className = 'fcm-set-desc';
        const updateSmDesc = () => { smDesc.textContent = T('saveModeDesc_' + (smSel.value || 'off')); };
        updateSmDesc();
        smSel.addEventListener('change', () => { cfg.saveMode = smSel.value; saveCfg(); updateSmDesc(); });
        smRow.appendChild(smInfo); smRow.appendChild(smSel);
        wrap.appendChild(smRow); wrap.appendChild(smDesc);

        // Export / Import — placed directly under Save Mode
        const exportRow = document.createElement('div'); exportRow.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;';
        function mkActionBtn(label, note, cls, cb) {
            const b = document.createElement('button'); b.className = 'fcm-btn ' + cls; b.textContent = label; b.title = note;
            b.style.cssText = 'flex:1;padding:8px;font-size:11px;'; b.addEventListener('click', cb); return b;
        }
        exportRow.appendChild(mkActionBtn(T('exportProfiles'), T('exportNote'), 'fcm-btn-blue', async () => {
            if (!PDB.db) return;
            const n = await exportProfiles();
            if (n > 0 && typeof ChatRoomSendLocal === 'function') ChatRoomSendLocal(T('exportDone', n), 5000);
        }));
        exportRow.appendChild(mkActionBtn(T('importProfiles'), T('importNote'), 'fcm-btn-green', () => {
            if (!PDB.db) return;
            const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
            inp.onchange = async () => { const f = inp.files[0]; if (!f) return; const r = await importProfiles(f); if (typeof ChatRoomSendLocal === 'function') ChatRoomSendLocal(T('importDone', r.pc, r.nc), 5000); renderCurrent(); };
            inp.click();
        }));
        wrap.appendChild(exportRow);

        // ══════════════════════════════════════════
        //  GROUP B: 聊天室管理
        // ══════════════════════════════════════════
        sectionHeader(isZh() ? '⚙ 聊天室管理' : '⚙ Chat Room');

        // ── Whisper Indicator (color) ─────────────
        const wiWrap = document.createElement('div');
        const wiToggleRow = document.createElement('div'); wiToggleRow.style.cssText = 'display:flex;align-items:center;gap:14px;';
        const wiTog = mkToggle(cfg.whisperIndicator, v => { cfg.whisperIndicator = v; saveCfg(); if (v) startWhisperIndicator(); else stopWhisperIndicator(); });
        wiTog.style.flexShrink = '0';
        const wiInfo = document.createElement('div'); wiInfo.style.flex = '1';
        const wiLbl = document.createElement('div'); wiLbl.className = 'fcm-set-label'; wiLbl.textContent = T('whisperIndicatorLabel');
        const wiNote = document.createElement('div'); wiNote.className = 'fcm-set-note'; wiNote.textContent = T('whisperIndicatorNote');
        wiInfo.appendChild(wiLbl); wiInfo.appendChild(wiNote);
        const wiColorLabelBtn = document.createElement('span');
        wiColorLabelBtn.style.cssText = 'font-size:11px;color:#a080c8;white-space:nowrap;flex-shrink:0;cursor:pointer;';
        wiColorLabelBtn.textContent = isZh() ? '修改顏色' : 'Color';
        const wiColorBtn = document.createElement('button');
        wiColorBtn.style.cssText = `width:28px;height:28px;border-radius:50%;background:${cfg.whisperColor||'#b070e8'};border:2px solid #6040a0;cursor:pointer;flex-shrink:0;transition:border-color .15s;`;
        let wiColorOpen = false;
        const wiColorPanel = document.createElement('div'); wiColorPanel.style.cssText = 'display:none;padding:10px 0 4px 56px;';
        const swatchRow = document.createElement('div'); swatchRow.style.cssText = 'display:flex;align-items:center;gap:7px;flex-wrap:wrap;';
        const presets = ['#b070e8','#e870c0','#70aaff','#70e8b0','#f0c040','#e87070','#ff9040','#ffffff'];
        const updateColorBtn = (color) => { wiColorBtn.style.background = color; wiColorBtn.style.boxShadow = `0 0 0 3px ${color}55`; };
        const allSwatches = [];
        const customInp = document.createElement('input'); customInp.type = 'color'; customInp.value = cfg.whisperColor || '#b070e8';
        customInp.style.cssText = 'width:30px;height:24px;border-radius:6px;border:1px solid #5048a0;background:#1a1030;cursor:pointer;padding:1px;';
        presets.forEach(color => {
            const sw = document.createElement('button');
            sw.style.cssText = `width:24px;height:24px;border-radius:50%;background:${color};border:2.5px solid ${cfg.whisperColor===color?'#fff':'transparent'};cursor:pointer;flex-shrink:0;transition:border .15s;`;
            sw.addEventListener('click', () => { cfg.whisperColor = color; saveCfg(); updateColorBtn(color); allSwatches.forEach(s => s.style.borderColor = 'transparent'); sw.style.borderColor = '#fff'; customInp.value = color; });
            allSwatches.push(sw); swatchRow.appendChild(sw);
        });
        customInp.addEventListener('input', () => { cfg.whisperColor = customInp.value; saveCfg(); updateColorBtn(customInp.value); allSwatches.forEach(s => s.style.borderColor = 'transparent'); });
        swatchRow.appendChild(customInp); wiColorPanel.appendChild(swatchRow);
        wiColorLabelBtn.addEventListener('click', () => wiColorBtn.click());
        wiColorBtn.addEventListener('click', () => { wiColorOpen = !wiColorOpen; wiColorPanel.style.display = wiColorOpen ? 'block' : 'none'; wiColorBtn.style.borderColor = wiColorOpen ? '#d0a0ff' : '#6040a0'; });
        wiToggleRow.appendChild(wiTog); wiToggleRow.appendChild(wiInfo); wiToggleRow.appendChild(wiColorLabelBtn); wiToggleRow.appendChild(wiColorBtn);
        wiWrap.appendChild(wiToggleRow); wiWrap.appendChild(wiColorPanel);
        wrap.appendChild(wiWrap);
        updateColorBtn(cfg.whisperColor || '#b070e8');
        divider();

        // ── Whisper Avatar ────────────────────────
        wrap.appendChild(settingRow(T('whisperAvatarLabel'), T('whisperAvatarNote'), cfg.whisperAvatar, v => {
            cfg.whisperAvatar = v; saveCfg();
            if (!v) _removeWhisperAvatar();
        }));
        divider();

        // ── OOC Protection ────────────────────────
        wrap.appendChild(settingRow(T('oocProtectLabel'), T('oocProtectNote'), cfg.oocProtect, v => {
            cfg.oocProtect = v; saveCfg();
            if (v) _installOocProtect(); else _uninstallOocProtect();
        }));
        divider();

        // ── Ghost Hide ────────────────────────────
        wrap.appendChild(settingRow(T('ghostHideLabel'), T('ghostHideNote'), cfg.ghostHide, v => { cfg.ghostHide = v; saveCfg(); applyGhostHide(v); }));
        divider();

        // ── Profile 關係人快速搜尋 ──────────────────
        const prRow = settingRow(T('profileRelLabel'), T('profileRelNote'), cfg.profileRelations, v => {
            cfg.profileRelations = v; saveCfg();
        });

        // 底線染色（邏輯與私聊/BEEP 提示色相同）：預設紫色，可選無色
        const PRC_DEFAULT = '#8868c0';
        const prcColorLabelBtn = document.createElement('span');
        prcColorLabelBtn.style.cssText = 'font-size:11px;color:#a080c8;white-space:nowrap;flex-shrink:0;cursor:pointer;margin-left:auto;';
        prcColorLabelBtn.textContent = T('profileRelColorLabel');
        const _prcSwatchBg = c => c
            ? c
            : `#2a2048 linear-gradient(45deg, transparent 46%, #ff4040 46%, #ff4040 54%, transparent 54%)`;
        const prcColorBtn = document.createElement('button');
        prcColorBtn.style.cssText = `width:28px;height:28px;border-radius:50%;background:${_prcSwatchBg(cfg.profileRelColor)};border:2px solid #6040a0;cursor:pointer;flex-shrink:0;transition:border-color .15s;`;
        let prcColorOpen = false;
        const prcColorPanel = document.createElement('div'); prcColorPanel.style.cssText = 'display:none;padding:10px 0 4px 0;';
        const prcSwatchRow = document.createElement('div'); prcSwatchRow.style.cssText = 'display:flex;align-items:center;gap:7px;flex-wrap:wrap;';
        const prcPresets = ['#8868c0','#b070e8','#e870c0','#70aaff','#70e8b0','#f0c040','#e87070','#ff9040'];
        const prcUpdateBtn = (color) => {
            prcColorBtn.style.background = _prcSwatchBg(color);
            prcColorBtn.style.boxShadow = color ? `0 0 0 3px ${color}55` : 'none';
        };
        const prcAllSwatches = [];
        const prcCustomInp = document.createElement('input'); prcCustomInp.type = 'color'; prcCustomInp.value = cfg.profileRelColor || PRC_DEFAULT;
        prcCustomInp.style.cssText = 'width:30px;height:24px;border-radius:6px;border:1px solid #5048a0;background:#1a1030;cursor:pointer;padding:1px;';
        // 「無色」：圓形＋紅色對角線（不畫底線）
        const prcNoneBtn = document.createElement('button');
        prcNoneBtn.title = T('colorNone');
        prcNoneBtn.style.cssText = `width:24px;height:24px;border-radius:50%;background:${_prcSwatchBg(null)};border:2.5px solid ${!cfg.profileRelColor ? '#fff' : 'transparent'};cursor:pointer;flex-shrink:0;transition:border .15s;`;
        prcNoneBtn.addEventListener('click', () => {
            cfg.profileRelColor = null; saveCfg(); prcUpdateBtn(null);
            prcAllSwatches.forEach(s => s.style.borderColor = 'transparent'); prcNoneBtn.style.borderColor = '#fff';
            prcCustomInp.value = PRC_DEFAULT;
        });
        prcSwatchRow.appendChild(prcNoneBtn);
        prcPresets.forEach(color => {
            const sw = document.createElement('button');
            sw.style.cssText = `width:24px;height:24px;border-radius:50%;background:${color};border:2.5px solid ${cfg.profileRelColor===color?'#fff':'transparent'};cursor:pointer;flex-shrink:0;transition:border .15s;`;
            sw.addEventListener('click', () => {
                cfg.profileRelColor = color; saveCfg(); prcUpdateBtn(color);
                prcNoneBtn.style.borderColor = 'transparent';
                prcAllSwatches.forEach(s => s.style.borderColor = 'transparent'); sw.style.borderColor = '#fff';
                prcCustomInp.value = color;
            });
            prcAllSwatches.push(sw); prcSwatchRow.appendChild(sw);
        });
        prcCustomInp.addEventListener('input', () => {
            cfg.profileRelColor = prcCustomInp.value; saveCfg(); prcUpdateBtn(prcCustomInp.value);
            prcNoneBtn.style.borderColor = 'transparent';
            prcAllSwatches.forEach(s => s.style.borderColor = 'transparent');
        });
        prcSwatchRow.appendChild(prcCustomInp); prcColorPanel.appendChild(prcSwatchRow);
        prcColorLabelBtn.addEventListener('click', () => prcColorBtn.click());
        prcColorBtn.addEventListener('click', () => { prcColorOpen = !prcColorOpen; prcColorPanel.style.display = prcColorOpen ? 'block' : 'none'; prcColorBtn.style.borderColor = prcColorOpen ? '#d0a0ff' : '#6040a0'; });
        prRow.appendChild(prcColorLabelBtn); prRow.appendChild(prcColorBtn);
        wrap.appendChild(prRow);
        wrap.appendChild(prcColorPanel);

        container.appendChild(wrap);
    }

    // ═══════════════════════════════════════════════════════════
    //  PANEL STATE
    // ═══════════════════════════════════════════════════════════
    function openPanel() {
        if (!panelEl) buildPanel();
        panelEl.classList.remove('hidden');
        if (miniEl) miniEl.classList.remove('visible');
        panelOpen = true; panelMini = false;
        ServerSend('AccountQuery', { Query: 'OnlineFriends' });
        renderCurrent();
    }

    function minimizePanel() { if (!panelEl) return; panelEl.classList.add('hidden'); if (miniEl) miniEl.classList.add('visible'); panelMini = true; _removeWhisperAvatar(); }
    function restorePanel() { if (!panelEl) buildPanel(); panelEl.classList.remove('hidden'); if (miniEl) miniEl.classList.remove('visible'); panelMini = false; renderCurrent(); }
    function closePanel() {
        if (panelEl) panelEl.classList.add('hidden');
        if (miniEl) miniEl.classList.remove('visible');
        panelOpen = false; panelMini = false;
        _peopleQ = ''; _peoplePage = 0;
        _removeWhisperAvatar();
        document.getElementById('fcm-beep-overlay')?.remove();
        document.getElementById('fcm-confirm-overlay')?.remove();
    }
    function togglePanel() { if (panelOpen || panelMini) closePanel(); else openPanel(); }

    function registerCommand() {
        if (typeof CommandCombine === 'function') {
            CommandCombine([{
                Tag: 'profiles',
                Description: isZh() ? '<篩選> - 開啟人員查詢（依名稱或 ID 篩選）' : '<filter> - Open People search (filter by name or ID)',
                Action: arg => { _peopleQ = arg ? arg.trim() : ''; _peoplePage = 0; uiTab = 'people'; openPanel(); },
            }]);
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  PROFILE RELATIONS QUICK-SEARCH  (feature: profileRelations)
    //  角色資料頁的關係網（BC 於 canvas 繪製）→ 由 hooks.js 疊上可點按鈕，
    //  點擊後呼叫此函式開啟人員查詢並帶入該關係人 ID。
    // ═══════════════════════════════════════════════════════════
    function openPeopleSearch(id) {
        _peopleQ = String(id); _peoplePage = 0; uiTab = 'people';
        openPanel();
    }

export { renderCurrent, buildPanel, openPanel, closePanel, minimizePanel, restorePanel, togglePanel, registerCommand, openPeopleSearch, panelOpen, panelMini, uiTab };

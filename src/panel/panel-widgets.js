import { cfg } from '../core/config.js';
import { T, isZh } from '../i18n/i18n.js';
import { PDB, _pc, Snapshot, _avQueue, _avBusy, _processAvQueue, loadAvatarFromBundle, _captureSnapshotDelayed } from '../data/profile-db.js';
import { getDisplayName, REL_ORDER, getRel, isFriendOf, canBeep, inRoomFn, isFav, toggleFav } from '../data/data.js';
import { roomOp, doView, doBeep, doWhisper, doToggleList, doRemoveFriend, showConfirm, showAddFriendConfirm } from '../chat/actions.js';
import { openChat } from '../communication/chat.js';
// ════════════════════════════════════════
//  FCM module: panel-widgets.js  (split from panel.js)
//  共用的元素工廠與列表輔助：頭像、關係/權限標籤、按鈕、搜尋框、
//  人員操作按鈕組、房管按鈕組、排序/計數列、頭像佇列刷新。
//  panelEl 恆等於 #fcm-panel，故此處直接以 getElementById 取用，避免與 panel.js 互相 import。
// ════════════════════════════════════════

const _panel = () => document.getElementById('fcm-panel');

function makeAvEl(mn, snapshotUrl) {
    mn = parseInt(mn);
    const el = document.createElement('div'); el.className = 'fcm-av'; el.dataset.mn = mn;
    el.style.borderRadius = cfg.avatarShape === 'round' ? '50%' : '8px';
    el.style.cursor = 'pointer';
    el.title = T('avReloadTitle');
    el.addEventListener('click', e => { e.stopPropagation(); _forceLoadAvatar(mn, el); });

    if (cfg.avatars) {
        const C = ChatRoomCharacter && ChatRoomCharacter.find(c => c.MemberNumber === mn);
        const sharedMode = C?.OnlineSharedSettings?.FCM?.avatarMode;
        if (sharedMode === 'none') { el.textContent = getDisplayName(mn).trim().slice(0, 2).toUpperCase() || '?'; return el; }
        const snap = snapshotUrl || Snapshot._cache[mn];
        if (snap) {
            const img = document.createElement('img'); img.src = snap; img.style.borderRadius = cfg.avatarShape === 'round' ? '50%' : '7px'; el.appendChild(img); return el;
        }
        (async () => {
            if (!el.isConnected) return;
            const saved = await Snapshot.get(mn);
            if (saved) {
                const t = el.isConnected ? el : _panel()?.querySelector(`.fcm-av[data-mn="${mn}"]`);
                if (t) { t.innerHTML = ''; const img = document.createElement('img'); img.src = saved; t.appendChild(img); }
                return;
            }
            if (_pc[mn] === undefined) await PDB.get(mn);
            const profile = _pc[mn];
            _avQueue.push({ mn, profile, onDone: url => {
                const t = _panel()?.querySelector(`.fcm-av[data-mn="${mn}"]`);
                if (t) { t.innerHTML = ''; const img = document.createElement('img'); img.src = url; t.appendChild(img); }
            }});
            if (!_avBusy) _processAvQueue();
        })();
    }
    el.textContent = getDisplayName(mn).trim().slice(0, 2).toUpperCase() || '?';
    return el;
}

// ── 關注星號：點擊切換 cfg.favorites；onToggle 供呼叫端重排（可略） ──
function makeFavStar(mn, onToggle) {
    mn = parseInt(mn);
    const s = document.createElement('span');
    const paint = () => { const on = isFav(mn); s.className = 'fcm-fav' + (on ? ' on' : ''); s.textContent = on ? '★' : '☆'; };
    paint();
    s.title = isZh() ? '設為關注（點擊切換）' : 'Follow (click to toggle)';
    s.addEventListener('click', e => { e.stopPropagation(); const now = toggleFav(mn); paint(); if (onToggle) onToggle(now); });
    return s;
}

async function _forceLoadAvatar(mn, el) {
    mn = parseInt(mn);
    el.textContent = '…';
    const qi = _avQueue.findIndex(q => q.mn === mn); if (qi >= 0) _avQueue.splice(qi, 1);
    if (_pc[mn] === undefined) await PDB.get(mn);
    const profile = _pc[mn];
    if (!profile) { el.textContent = '?'; return; }
    if (!profile.characterBundle) { el.textContent = '?'; return; }
    await Snapshot.delete(mn);
    const url = await loadAvatarFromBundle(mn, profile);
    const target = el.isConnected ? el : _panel()?.querySelector(`.fcm-av[data-mn="${mn}"]`);
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
    if (context === 'members' && inRoomFn(mn)) {
        // 黑單與逐出之間空一格，避免誤觸
        const _sep = document.createElement('span'); _sep.style.cssText = 'width:8px;display:inline-block;'; wrap.appendChild(_sep);
        wrap.appendChild(mkBtn(T('btnKick'), 'fcm-btn-red', () => showConfirm(T('confirmKick', getDisplayName(mn)), () => roomOp(mn, 'kick'), T('btnKick'))));
    }
    return wrap;
}

// ─── Shared: build action buttons for a person ─────────────────
// Bug fix: showConfirm is the ONLY place confirmations appear.
// doToggleList and doRemoveFriend no longer call showConfirm themselves.
// 回傳兩組按鈕：actions（查看／悄悄話／私訊）與 manage（好友／白單／黑單／幽靈），
//  分別放在「動作」與「管理」兩個表格欄位。
function buildPersonOps(mn, { isInRoom = false, isMe = false, oneSided = false, whisper = true, forceBeep = false } = {}) {
    mn = parseInt(mn);
    const actions = document.createElement('div'); actions.className = 'fcm-btns';
    const manage = document.createElement('div'); manage.className = 'fcm-btns';
    const profile = _pc[mn] || null;
    const isFriend = isFriendOf(mn);
    const hasProfile = !!(profile && profile.characterBundle);
    const vb = mkBtn(T('btnView'), '', () => doView(mn));
    if (!isInRoom && !hasProfile) vb.disabled = true;
    actions.appendChild(vb);

    if (!isMe) {
        if (isInRoom && whisper) actions.appendChild(mkBtn(T('btnWhisper'), '', () => cfg.takeoverFcmChatButtons && cfg.communicationEnabled ? openChat(mn) : doWhisper(mn)));
        // forceBeep：一律顯示私訊按鈕。私訊/BEEP 僅真正的好友（含主人／戀人／奴隸）可用，
        //  「同房間」不算可私訊條件，非好友時反灰停用。
        if (canBeep(mn) || forceBeep) {
            const beepBtn = mkBtn(T('btnBeep'), 'fcm-btn-blue', () => cfg.takeoverFcmChatButtons && cfg.communicationEnabled ? openChat(mn) : doBeep(mn));
            const beepable = isFriendOf(mn) || ['owner', 'lover', 'sub'].includes(getRel(mn));
            if (!beepable) { beepBtn.disabled = true; beepBtn.title = T('noBeepNotFriend'); }
            actions.appendChild(beepBtn);
        }

        const _dname = getDisplayName(mn);
        const _isWhl = (Player.WhiteList || []).includes(mn);
        const _isBl  = (Player.BlackList || []).includes(mn);
        const _isGh  = (() => { try { return (Player.GhostList || []).includes(mn); } catch { return false; } })();
        const osSuffix = oneSided ? '\n\n' + T('peopleOneSidedWarn') : '';

        if (!isFriend) manage.appendChild(mkBtn(T('btnAddFriend'), 'fcm-btn-green',
                                             () => showAddFriendConfirm(mn, _dname, oneSided)));
        else manage.appendChild(mkBtn(T('btnRmFriend'), 'fcm-btn-red',
                                   () => showConfirm(T('confirmDel', _dname), () => doRemoveFriend(mn), T('btnRemove'))));

        manage.appendChild(mkBtn(_isWhl ? T('btnRmWhite') : T('btnAddWhite'), _isWhl ? 'fcm-btn-red' : 'fcm-btn-green',
                              () => showConfirm(_isWhl
                                                ? T('confirmRmWhite', _dname)
                                                : T('confirmAddWhite', _dname) + osSuffix,
                                                () => doToggleList(mn, 'white', !_isWhl))));

        manage.appendChild(mkBtn(_isBl ? T('btnRmBlack') : T('btnAddBlack'), 'fcm-btn-red',
                              () => showConfirm(_isBl
                                                ? T('confirmRmBlack', _dname)
                                                : T('confirmAddBan', _dname) + osSuffix,
                                                () => doToggleList(mn, 'black', !_isBl),
                                                _isBl ? undefined : T('btnAddConfirm'))));

        manage.appendChild(mkBtn(_isGh ? T('btnRmGhost') : T('btnAddGhost'), _isGh ? 'fcm-btn-red' : 'fcm-btn-purple',
                              () => showConfirm(_isGh
                                                ? T('confirmRmGhost', _dname)
                                                : T('confirmAddGhost', _dname) + osSuffix,
                                                () => doToggleList(mn, 'ghost', !_isGh))));
    }
    return { actions, manage };
}

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
    await Promise.all([PDB.batchGet(mns), Snapshot.batchGet(mns)]);
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
            const el = _panel()?.querySelector(`.fcm-av[data-mn="${mn}"]`);
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
        await Snapshot.delete(mn);
        const qi = _avQueue.findIndex(q => q.mn === mn);
        if (qi >= 0) _avQueue.splice(qi, 1);
        const C = ChatRoomCharacter && ChatRoomCharacter.find(c => c.MemberNumber === mn);
        if (C) { _captureSnapshotDelayed(C); liveCount++; continue; }
        const profile = _pc[mn];
        if (!profile || !profile.characterBundle) { noBundle++; continue; }
        _avQueue.push({ mn, profile, onDone: url => {
            if (!url) return;
            const el = _panel()?.querySelector(`.fcm-av[data-mn="${mn}"]`);
            if (el) { el.innerHTML = ''; const img = document.createElement('img'); img.src = url; el.appendChild(img); }
        }});
        queueCount++;
    }
    if (!_avBusy && _avQueue.length > 0) _processAvQueue();
}

export { makeAvEl, makeFavStar, _forceLoadAvatar, makeRelEl, makePermEl, mkBtn, mkToggle, makeSearchWrap,
         buildMgmtBtns, buildPersonOps, makeSortSel, makeCountBar, _autoQueueVisible, refreshSnapshotsForList };

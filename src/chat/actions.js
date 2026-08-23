import { T } from '../i18n/i18n.js';
import { PDB } from '../data/profile-db.js';
import { amAdmin, inRoomFn, getDisplayName, isFriendOf } from '../data/data.js';
import { renderCurrent, minimizePanel, closePanel } from '../panel/panel.js';
// ════════════════════════════════════════
//  FCM module: actions.js
//  (split from Plugins/liko-FCM.user.js)
// ════════════════════════════════════════

    function roomOp(mn, action) {
        if (!amAdmin()) return;
        mn = parseInt(mn);
        switch (action) {
            case 'makeAdmin': {
                if (!Array.isArray(ChatRoomData.Admin)) ChatRoomData.Admin = [];
                if (!ChatRoomData.Admin.some(a => parseInt(a) === mn)) ChatRoomData.Admin.push(mn);
                if (inRoomFn(mn)) { ServerSend('ChatRoomAdmin', { MemberNumber: mn, Action: 'Promote' }); }
                else { ServerSend('ChatRoomAdmin', { MemberNumber: Player.ID, Room: ChatRoomGetSettings(ChatRoomData), Action: 'Update' }); }
                break;
            }
            case 'rmAdmin': {
                if (!Array.isArray(ChatRoomData.Admin)) ChatRoomData.Admin = [];
                const _ai = ChatRoomData.Admin.findIndex(a => parseInt(a) === mn);
                if (_ai >= 0) ChatRoomData.Admin.splice(_ai, 1);
                if (inRoomFn(mn)) { ServerSend('ChatRoomAdmin', { MemberNumber: mn, Action: 'Demote' }); }
                else { ServerSend('ChatRoomAdmin', { MemberNumber: Player.ID, Room: ChatRoomGetSettings(ChatRoomData), Action: 'Update' }); }
                break;
            }
            case 'addWhite': ServerSend('ChatRoomAdmin', { MemberNumber: mn, Action: 'Whitelist' }); break;
            case 'rmWhite':  ServerSend('ChatRoomAdmin', { MemberNumber: mn, Action: 'Unwhitelist' }); break;
            case 'ban':      ServerSend('ChatRoomAdmin', { MemberNumber: mn, Action: 'Ban' }); break;
            case 'unban':    ServerSend('ChatRoomAdmin', { MemberNumber: mn, Action: 'Unban' }); break;
            case 'kick':     ServerSend('ChatRoomAdmin', { MemberNumber: mn, Action: 'Kick' }); break;
        }
        renderCurrent();
        setTimeout(renderCurrent, 1200);
    }

    // ═══════════════════════════════════════════════════════════
    //  INTERACTION HELPERS
    // ═══════════════════════════════════════════════════════════
    async function doView(mn) {
        mn = parseInt(mn);
        const C = ChatRoomCharacter && ChatRoomCharacter.find(c => c.MemberNumber === mn);
        if (C && typeof InformationSheetLoadCharacter === 'function') { InformationSheetLoadCharacter(C); return; }
        const p = await PDB.get(mn); if (!p || !p.characterBundle) { alert(T('noProfile')); return; }
        try { const data = JSON.parse(p.characterBundle); if (typeof CharacterLoadOnline === 'function') { const loaded = CharacterLoadOnline(data, mn); if (typeof InformationSheetLoadCharacter === 'function') InformationSheetLoadCharacter(loaded); } } catch { alert(T('noProfile')); }
    }

    function doBeep(mn) {
        mn = parseInt(mn); const name = getDisplayName(mn);
        // Let the overlay disappear on screen before ServerSend enters other
        // mods' synchronous hooks (notably WCE's first-time IM history load).
        // This does not bypass ModSDK; it only moves the normal send to the
        // next painted frame so the click itself remains responsive.
        const sendAfterPaint = callback => requestAnimationFrame(() => setTimeout(callback, 0));
        const ex = document.getElementById('fcm-beep-overlay'); if (ex) { ex.remove(); return; }
        const overlay = document.createElement('div'); overlay.id = 'fcm-beep-overlay'; overlay.className = 'fcm-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100000;display:flex;align-items:center;justify-content:center;';
        overlay.addEventListener('click', () => overlay.remove());
        const pop = document.createElement('div'); pop.className = 'fcm-dialog';
        pop.style.cssText = 'background:#241840;border:2px solid #8060c8;border-radius:16px;padding:26px;width:min(520px,92vw);box-shadow:0 10px 50px rgba(0,0,0,.85);display:flex;flex-direction:column;gap:16px;';
        pop.addEventListener('click', e => e.stopPropagation());
        const titleEl = document.createElement('div'); titleEl.style.cssText = 'color:#d0a8f0;font-size:16px;font-weight:700;text-align:center;'; titleEl.textContent = T('beepTitle', name);
        const ta = document.createElement('textarea'); ta.rows = 10; ta.placeholder = T('beepPlaceholder');
        ta.style.cssText = 'background:#1a1030;border:1.5px solid #6050a0;border-radius:10px;padding:12px;color:#f0e0ff;font-size:13px;outline:none;width:100%;box-sizing:border-box;resize:vertical;min-height:140px;max-height:360px;overflow-y:auto;font-family:inherit;line-height:1.5;';
        ta.style.setProperty('user-select', 'text', 'important');
        const btnRow = document.createElement('div'); btnRow.style.cssText = 'display:flex;gap:12px;';
        const cancelBtn = document.createElement('button'); cancelBtn.textContent = T('beepCancel'); cancelBtn.style.cssText = 'flex:1;padding:14px;background:#1e1635;border:1.5px solid #5a48a8;border-radius:10px;color:#c4a0e0;font-size:14px;cursor:pointer;font-weight:600;'; cancelBtn.addEventListener('click', () => overlay.remove());
        const sendBtn = document.createElement('button'); sendBtn.textContent = T('beepSend'); sendBtn.style.cssText = 'flex:2;padding:14px;background:#1a3860;border:1.5px solid #4090d8;border-radius:10px;color:#90d0ff;font-size:15px;cursor:pointer;font-weight:700;';
        sendBtn.addEventListener('click', () => {
            const msg = ta.value.trim();
            overlay.remove();
            sendAfterPaint(() => {
                ServerSend('AccountBeep', { MemberNumber: mn, BeepType: '', Message: msg || undefined });
                if (typeof FriendListBeepLog !== 'undefined') FriendListBeepLog.push({ MemberNumber: mn, MemberName: name, Sent: true, Time: new Date(), Message: msg });
            });
        });
        ta.addEventListener('keydown', e => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); sendBtn.click(); } if (e.key === 'Escape') overlay.remove(); e.stopPropagation(); });
        const summonBtn = document.createElement('button');
        summonBtn.textContent = T('beepSummon');
        summonBtn.style.cssText = 'flex:1;padding:14px;background:#182a10;border:1.5px solid #40a030;border-radius:10px;color:#80e860;font-size:14px;cursor:pointer;font-weight:700;';
        summonBtn.addEventListener('click', () => {
            const msg = T('beepSummonConfirm', name);
            showConfirm(msg, () => {
                overlay.remove();
                sendAfterPaint(() => {
                    try {
                        ServerSend('AccountBeep', {
                            MemberNumber: mn, BeepType: '',
                            Message: 'summon',
                            ChatRoomName: (typeof ChatRoomData !== 'undefined' && ChatRoomData) ? ChatRoomData.Name : undefined,
                            ChatRoomSpace: (typeof ChatRoomData !== 'undefined' && ChatRoomData) ? ChatRoomData.Space : undefined,
                        });
                    } catch(e) { console.warn('🐈‍⬛ [FCM] summon error:', e); }
                    if (typeof FriendListBeepLog !== 'undefined') FriendListBeepLog.push({ MemberNumber: mn, MemberName: name, Sent: true, Time: new Date(), Message: '[summon]' });
                });
            }, T('beepSummon'));
        });
        if (typeof ChatRoomData === 'undefined' || !ChatRoomData) {
            summonBtn.disabled = true; summonBtn.style.opacity = '0.35'; summonBtn.style.cursor = 'not-allowed';
            summonBtn.title = T('beepSummonNoRoom');
        }
        btnRow.appendChild(cancelBtn); btnRow.appendChild(summonBtn); btnRow.appendChild(sendBtn);
        pop.appendChild(titleEl); pop.appendChild(ta); pop.appendChild(btnRow);
        overlay.appendChild(pop); document.body.appendChild(overlay); ta.focus();
    }

    function doWhisper(mn) { const el = document.getElementById('InputChat'); if (el) { el.value = `/w ${mn} `; el.focus(); } minimizePanel(); }
    function doAddFriend(mn) { mn = parseInt(mn); if (!isFriendOf(mn) && typeof ChatRoomListManipulation === 'function') { ChatRoomListManipulation(Player.FriendList, true, mn.toString()); setTimeout(renderCurrent, 400); } }

    // ── Bug fix: doToggleList no longer calls showConfirm internally ──
    // All confirmation is handled exclusively at the call site.
    function doToggleList(mn, listType, add) {
        mn = parseInt(mn);
        let list;
        if (listType === 'white') list = Player.WhiteList;
        else if (listType === 'black') list = Player.BlackList;
        else if (listType === 'ghost') { try { list = Player.GhostList; } catch { list = null; } }
        if (!Array.isArray(list)) return;
        try {
            if (typeof ChatRoomListManipulation === 'function') { ChatRoomListManipulation(list, add, String(mn)); }
            else {
                const idx2 = list.indexOf(mn);
                if (add && idx2 < 0) list.push(mn);
                else if (!add && idx2 >= 0) list.splice(idx2, 1);
                const d = {}; d[listType === 'white' ? 'WhiteList' : listType === 'black' ? 'BlackList' : 'GhostList'] = list;
                if (typeof ServerAccountUpdate !== 'undefined') ServerAccountUpdate.QueueData(d);
            }
        } catch(e) { console.warn('🐈‍⬛ [FCM] doToggleList:', e); }
        setTimeout(renderCurrent, 400);
    }
    function doRemoveFriend(mn) { mn = parseInt(mn); if (typeof ChatRoomListManipulation === 'function') { ChatRoomListManipulation(Player.FriendList, false, mn.toString()); setTimeout(renderCurrent, 400); } }

    // 實際加入房間（無確認）。供簡易確認（navigateToRoom）與詳細資訊確認（showRoomJoinConfirm）共用。
    function _doJoinRoom(roomName) {
        // Blur all FCM search inputs to prevent their keydown handlers from
        // leaking Enter/Shift+Enter events into the new room context (Nami bug fix)
        document.querySelectorAll('.fcm-search, .fcm-room-search').forEach(el => el.blur());
        closePanel();
        // 先離開並切到 ChatSearch（同步）：把畫面弄離 ChatRoom，避免 join 回來時 ChatRoomRun 讀到 null 而崩潰。
        try {
            if (typeof ChatRoomLeave === 'function') ChatRoomLeave();
            if (typeof CommonSetScreen === 'function') CommonSetScreen('Online', 'ChatSearch');
        } catch (e) { console.warn('🐈‍⬛ [FCM] leaveRoom:', e); }
        // 隔一小段再送 join：模擬 BC 手動換房的人為延遲，讓伺服器先處理完「離開」，
        //  否則 leave 與 join 擠在同一 tick 會被伺服器判定為重複加入。
        // ponytail: 固定 150ms 緩衝；連線很慢時可調長，這是需要依實際延遲微調的旋鈕。
        setTimeout(() => {
            try {
                ChatSearchLastQueryJoinTime = typeof CommonTime === 'function' ? CommonTime() : Date.now();
                ChatSearchLastQueryJoin = roomName;
                if (typeof ServerSend === 'function') ServerSend('ChatRoomJoin', { Name: roomName });
            } catch (e) { console.warn('🐈‍⬛ [FCM] joinRoom:', e); }
        }, 150);
    }

    // 只知道房名時的簡易文字確認（例如好友列表的房間連結）。
    function navigateToRoom(roomName) {
        showConfirm(T('confirmRoom', roomName), () => _doJoinRoom(roomName), T('roomGo'));
    }

    // ── Bug fix: showConfirm — stopPropagation on Enter to prevent
    // BC's room-join handler from firing after the confirm dialog closes.
    // Also guards against double-fire via _confirmed flag.
    function showConfirm(msg, onOk, okLabel) {
        const ex = document.getElementById('fcm-confirm-overlay'); if (ex) ex.remove();
        const overlay = document.createElement('div'); overlay.id = 'fcm-confirm-overlay'; overlay.className = 'fcm-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:100001;display:flex;align-items:center;justify-content:center;';
        const box = document.createElement('div'); box.className = 'fcm-dialog';
        box.style.cssText = 'background:#241840;border:2px solid #7060c0;border-radius:14px;padding:28px 24px;width:min(380px,88vw);box-shadow:0 8px 40px rgba(0,0,0,.8);display:flex;flex-direction:column;gap:20px;font-family:-apple-system,sans-serif;';
        box.addEventListener('click', e => e.stopPropagation());
        const msgEl = document.createElement('div'); msgEl.style.cssText = 'color:#e8d0ff;font-size:14px;text-align:center;line-height:1.7;white-space:pre-wrap;'; msgEl.textContent = msg;
        const btnRow = document.createElement('div'); btnRow.style.cssText = 'display:flex;gap:12px;';
        const cancelBtn = document.createElement('button'); cancelBtn.textContent = T('btnCancel');
        cancelBtn.style.cssText = 'flex:1;padding:12px;background:#1e1635;border:1.5px solid #5a48a8;border-radius:10px;color:#c4a0e0;font-size:13px;cursor:pointer;font-weight:600;'; cancelBtn.addEventListener('click', () => { cleanup(); overlay.remove(); });
        const okBtn = document.createElement('button'); okBtn.textContent = okLabel || T('btnConfirm');
        okBtn.style.cssText = 'flex:2;padding:12px;background:#1a3060;border:1.5px solid #4080d8;border-radius:10px;color:#90c8ff;font-size:13px;cursor:pointer;font-weight:700;';

        // Bug fix: one-shot guard prevents double-fire on rapid double-click
        let _confirmed = false;
        okBtn.addEventListener('click', () => {
            if (_confirmed) return; _confirmed = true;
            cleanup(); overlay.remove(); if (onOk) onOk();
        });

        const keyFn = e => {
            // Bug fix: stopPropagation so Enter/Escape don't reach BC's global handlers
            e.stopPropagation();
            if (e.key === 'Escape') { cleanup(); overlay.remove(); }
            if (e.key === 'Enter') {
                if (_confirmed) return; _confirmed = true;
                cleanup(); overlay.remove(); if (onOk) onOk();
            }
        };
        function cleanup() { document.removeEventListener('keydown', keyFn, true); }
        // Use capture phase so we intercept before BC's handlers
        document.addEventListener('keydown', keyFn, true);
        overlay.addEventListener('click', () => { cleanup(); overlay.remove(); });
        btnRow.appendChild(cancelBtn); btnRow.appendChild(okBtn);
        box.appendChild(msgEl); box.appendChild(btnRow);
        overlay.appendChild(box); document.body.appendChild(overlay); setTimeout(() => okBtn.focus(), 50);
    }

    // ═══════════════════════════════════════════════════════════
    //  ADD FRIEND — 三選一確認 + 通知對方（藉由 Leash 式 Hidden 訊息）
    //  參考 BC 的 HoldLeash：ServerSend("ChatRoomChat",{Type:"Hidden",Target})
    //  可送達同房間的任何人（含非好友），故「同意且通知」需與對方同房。
    // ═══════════════════════════════════════════════════════════
    // 一律走 leash 式 Hidden 訊息（ChatRoomChat + Type:"Hidden" + Target）：同房投遞、無需好友，
    // 這才是本功能的本意。AccountBeep 反而受伺服器好友限制（雙方皆非好友時被丟棄）。
    // Content 用自訂標記、且「絕不」攜帶任何房間欄位，避免被 BC 或其他 mod 的牽引處理器誤判成換房指令。
    // BC 對未知 Hidden Content 不做任何處理，故沒裝 FCM 的人完全不會看到。
    const FRIENDREQ_MSG = 'FCMFriendReq';

    function showAddFriendConfirm(mn, dname, oneSided) {
        mn = parseInt(mn);
        const ex = document.getElementById('fcm-confirm-overlay'); if (ex) ex.remove();
        const overlay = document.createElement('div'); overlay.id = 'fcm-confirm-overlay'; overlay.className = 'fcm-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:100001;display:flex;align-items:center;justify-content:center;';
        const box = document.createElement('div'); box.className = 'fcm-dialog';
        box.style.cssText = 'background:#241840;border:2px solid #7060c0;border-radius:14px;padding:26px 24px;width:min(400px,90vw);box-shadow:0 8px 40px rgba(0,0,0,.8);display:flex;flex-direction:column;gap:18px;font-family:-apple-system,sans-serif;';
        box.addEventListener('click', e => e.stopPropagation());

        const msgEl = document.createElement('div'); msgEl.style.cssText = 'color:#e8d0ff;font-size:14px;text-align:center;line-height:1.7;white-space:pre-wrap;';
        const hint = document.createElement('span'); hint.style.cssText = 'display:block;color:#9a86c8;font-size:12px;margin-top:6px;';
        hint.textContent = T('addFriendNotifyHint');
        msgEl.textContent = T('addFriendTitle', dname) + (oneSided ? '\n\n' + T('peopleOneSidedWarn') : '');
        msgEl.appendChild(hint);

        const cleanup = () => { document.removeEventListener('keydown', keyFn, true); };
        const close = () => { cleanup(); overlay.remove(); };

        const btnRow = document.createElement('div'); btnRow.style.cssText = 'display:flex;gap:10px;';
        const cancelBtn = document.createElement('button'); cancelBtn.textContent = T('btnCancel');
        cancelBtn.style.cssText = 'flex:1;padding:11px;background:#1e1635;border:1.5px solid #5a48a8;border-radius:10px;color:#c4a0e0;font-size:13px;cursor:pointer;font-weight:600;';
        cancelBtn.addEventListener('click', close);

        const okBtn = document.createElement('button'); okBtn.textContent = T('btnAgree');
        okBtn.style.cssText = 'flex:1;padding:11px;background:#123a20;border:1.5px solid #40a860;border-radius:10px;color:#90f0b0;font-size:13px;cursor:pointer;font-weight:700;';
        okBtn.addEventListener('click', () => { close(); doAddFriend(mn); });

        const okNotifyBtn = document.createElement('button'); okNotifyBtn.textContent = T('btnAgreeNotify');
        okNotifyBtn.style.cssText = 'flex:1.3;padding:11px;background:#1a3060;border:1.5px solid #4080d8;border-radius:10px;color:#90c8ff;font-size:13px;cursor:pointer;font-weight:700;';
        okNotifyBtn.addEventListener('click', () => { close(); doAddFriend(mn); sendFriendReqNotify(mn); });

        const keyFn = e => { e.stopPropagation(); if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', keyFn, true);
        overlay.addEventListener('click', close);
        btnRow.appendChild(cancelBtn); btnRow.appendChild(okBtn); btnRow.appendChild(okNotifyBtn);
        box.appendChild(msgEl); box.appendChild(btnRow);
        overlay.appendChild(box); document.body.appendChild(overlay);
    }

    function sendFriendReqNotify(mn) {
        mn = parseInt(mn);
        // leash 走同房投遞：對方不在本房則無法送達，明確提示而非假裝已送出。
        if (!inRoomFn(mn)) { if (typeof ChatRoomSendLocal === 'function') ChatRoomSendLocal(T('friendReqNeedRoom'), 5000); return; }
        try {
            // Hidden＋Target：只送給該成員，不帶任何房間資訊，故不會觸發真正的牽引/換房。
            ServerSend('ChatRoomChat', {
                Type: 'Hidden',
                Content: FRIENDREQ_MSG,
                Target: mn,
            });
            if (typeof ChatRoomSendLocal === 'function') ChatRoomSendLocal(T('friendReqSent', getDisplayName(mn)), 5000);
        } catch (e) { console.warn('🐈‍⬛ [FCM] sendFriendReqNotify:', e); }
    }

    // 接收端：在聊天記錄疊一張卡（參考 AFC 戀人申請卡），提供 同意／取消／查看
    function handleIncomingFriendReq(fromNum, fromName) {
        fromNum = parseInt(fromNum);
        if (!fromNum || fromNum === parseInt(Player?.MemberNumber)) return;
        const uiId = 'fcm-friendreq-' + fromNum;
        if (document.getElementById(uiId)) return;   // 已有一張，避免重複
        const dname = fromName || getDisplayName(fromNum);

        const el = _appendChatCard(uiId);
        if (!el) return;
        const title = document.createElement('div');
        title.style.cssText = 'font-weight:bold;font-size:1.02em;margin-bottom:8px;color:#ffd0e6;';
        title.textContent = T('friendReqIncoming', `${dname} (${fromNum})`);
        const row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
        const mkCardBtn = (label, bg, brd, col, cb) => {
            const b = document.createElement('button');
            b.style.cssText = `padding:4px 16px;background:${bg};color:${col};border:1px solid ${brd};border-radius:5px;cursor:pointer;font-size:.95em;white-space:nowrap;`;
            b.textContent = label; b.addEventListener('click', cb); return b;
        };
        row.appendChild(mkCardBtn(T('btnAgree'), '#123a20', '#40a860', '#90f0b0', () => {
            doAddFriend(fromNum);
            if (typeof ChatRoomSendLocal === 'function') ChatRoomSendLocal(T('friendReqAdded', dname), 5000);
            el.remove();
        }));
        row.appendChild(mkCardBtn(T('btnCancel'), 'transparent', '#555', '#bbb', () => el.remove()));
        row.appendChild(mkCardBtn(T('btnViewProfile'), '#241848', '#7060c0', '#c8a8f0', () => doView(fromNum)));
        el.appendChild(title); el.appendChild(row);
        _scrollChatToEnd();
    }

    // ═══════════════════════════════════════════════════════════
    //  ROOM SHARE — 分享房間資訊到聊天室（Action 可見）＋ FCM 專屬加入按鈕
    // ═══════════════════════════════════════════════════════════
    const ROOMSHARE_TAG = 'LikoFCMRoomShare';
    // BC 佔位法：Content 用未知 tag 會顯示 MISSING TEXT IN "Interface.csv": <tag>，
    // 再以同名 Text 字典項替換整段字串，即可顯示自訂內容而不報錯。
    const SYS_ACTION_TAG = 'MISSING TEXT IN "Interface.csv": CUSTOM_SYSTEM_ACTION';

    function _arrEq(a, b) { if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false; return a.every((x, i) => x === b[i]); }
    function _roomIsPrivate(room) { return !!room && !!room.Visibility && !_arrEq(room.Visibility, ['All']); }
    function _roomTypeLabel(room) {
        const mt = room && room.MapType;
        if (mt === 'Always') return T('roomTypeMap');
        if (mt === 'Hybrid') return T('roomTypeMix');
        return '';
    }

    function shareRoomToChat(room) {
        if (typeof ChatRoomData === 'undefined' || !ChatRoomData) return;
        if (!room || !room.Name) return;
        const sharer = (Player && (Player.Nickname || Player.Name)) || String(Player?.MemberNumber);
        const priv = _roomIsPrivate(room) ? `(${T('roomPrivateLabel')})` : '';
        const typeLbl = _roomTypeLabel(room); const typeTag = typeLbl ? `(${typeLbl})` : '';
        const mc = room.MemberCount ?? room.NbMember ?? null;
        const ml = room.MemberLimit ?? room.Limit ?? null;
        const cStr = mc !== null ? ` (${mc}${ml !== null ? '/' + ml : ''})` : '';
        const line2 = `${room.Name} - ${room.Creator || '?'}${cStr} ${priv}${typeTag}`.trim();
        const desc = (room.Description || '').trim();
        const systemMessage = T('roomShareIntro', sharer) + '\n' + line2 + (desc ? '\n' + desc : '');
        try {
            ServerSend('ChatRoomChat', {
                Type: 'Action', Content: 'CUSTOM_SYSTEM_ACTION',
                Dictionary: [
                    { Tag: SYS_ACTION_TAG, Text: systemMessage },     // 顯示文字（所有人可見）
                    // 隱藏屬性：FCM 專屬（無 Text，BC 會忽略但會原樣轉發給其他 FCM 使用者）
                    { Tag: ROOMSHARE_TAG, Room: room.Name, Sharer: sharer, Creator: room.Creator || '',
                        Count: mc, Limit: ml, Desc: desc, Priv: _roomIsPrivate(room) ? 1 : 0, Type: typeLbl || '' },
                ],
            });
            if (typeof ChatRoomSendLocal === 'function') ChatRoomSendLocal(T('roomShareLocalDone', room.Name), 5000);
        } catch (e) { console.warn('🐈‍⬛ [FCM] shareRoomToChat:', e); }
    }

    // 接收端（FCM 專屬）：把「這一則」剛渲染好的 Action 訊息就地轉換成資訊卡，
    //  右下角加「加入房間」。沒插件的人讀不到 ROOMSHARE_TAG，只會看到普通系統訊息。
    function _mkRoomJoinBtn(info) {
        const b = document.createElement('button');
        b.className = 'fcm-room-share-button';
        b.style.cssText = 'padding:6px 20px;background:#1a3860;color:#90d0ff;border:1px solid #4090d8;border-radius:6px;cursor:pointer;font-size:.9em;font-weight:700;white-space:nowrap;';
        b.textContent = '🚪 ' + T('roomJoinRoomBtn');
        // 點加入 → 先跳出詳細資訊確認框（房名／作者／人數／資訊），再實際加入
        b.addEventListener('click', () => showRoomJoinConfirm(info));
        return b;
    }

    // 房間資訊卡的內文（房名-作者 ┄ 人數 ／ 資訊描述），不含按鈕。
    //  聊天室房卡與「加入房間」確認框共用。
    //  pending=true 時（資料尚在載入）：未知的人數／描述顯示淡色「⋯」佔位，載入後由外層抽換。
    function _buildRoomDetail(info, pending) {
        const detail = document.createElement('div');
        detail.className = 'fcm-room-share-detail';
        detail.style.cssText = 'display:flex;flex-direction:column;gap:8px;min-width:0;';

        // 標題列：左＝房名-作者(＋私人/類型標籤)，右＝人數
        const head = document.createElement('div');
        head.style.cssText = 'display:flex;align-items:baseline;justify-content:space-between;gap:12px;';
        const titleWrap = document.createElement('div');
        titleWrap.style.cssText = 'min-width:0;display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;';
        const nameEl = document.createElement('span');
        nameEl.className = 'fcm-room-share-name';
        nameEl.style.cssText = 'color:#e8c8ff;font-size:1.05em;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px;';
        nameEl.textContent = info.room; nameEl.title = info.room;
        titleWrap.appendChild(nameEl);
        if (info.creator) { const cr = document.createElement('span'); cr.className = 'fcm-room-share-creator'; cr.style.cssText = 'color:#c8a0e8;font-size:.95em;font-weight:600;'; cr.textContent = '- ' + info.creator; titleWrap.appendChild(cr); }
        if (info.priv) { const pv = document.createElement('span'); pv.className = 'fcm-room-share-badge'; pv.style.cssText = 'font-size:.72em;background:#2a1048;border:1px solid #8060b0;color:#c090f0;border-radius:6px;padding:1px 6px;'; pv.textContent = T('roomPrivateLabel'); titleWrap.appendChild(pv); }
        if (info.type) { const tp = document.createElement('span'); tp.style.cssText = 'font-size:.72em;background:#182a1a;border:1px solid #3a7048;color:#78d090;border-radius:5px;padding:1px 6px;'; tp.textContent = info.type; titleWrap.appendChild(tp); }
        head.appendChild(titleWrap);
        const cntEl = document.createElement('span');
        cntEl.className = 'fcm-room-share-count';
        cntEl.style.cssText = 'color:#90d0ff;font-size:.95em;font-weight:700;white-space:nowrap;flex-shrink:0;';
        if (info.count != null) cntEl.textContent = `👥 ${info.count}${info.limit != null ? '/' + info.limit : ''}`;
        else if (pending) { cntEl.textContent = '⋯'; cntEl.style.opacity = '.4'; }
        head.appendChild(cntEl);
        detail.appendChild(head);

        // 資訊（描述）：有才顯示；pending 時保留一列淡色佔位，過長時卡內捲動
        if (info.desc || pending) {
            const body = document.createElement('div');
            body.className = 'fcm-room-share-description';
            body.style.cssText = 'color:#b8a8d8;font-size:.9em;line-height:1.5;white-space:pre-wrap;word-break:break-word;max-height:120px;overflow-y:auto;border-top:1px solid #3a2a5a;border-bottom:1px solid #3a2a5a;padding:6px 0;';
            if (info.desc) body.textContent = info.desc;
            else { body.textContent = '⋯'; body.style.opacity = '.4'; }
            detail.appendChild(body);
        }
        return detail;
    }

    // 依 ROOMSHARE_TAG 攜帶的欄位組出結構化房卡（內文＋右下「前往房間」按鈕）。
    function _buildRoomShareCard(info) {
        const card = document.createElement('div');
        card.style.cssText = 'display:flex;flex-direction:column;gap:8px;min-width:0;';
        card.appendChild(_buildRoomDetail(info));
        const foot = document.createElement('div');
        foot.style.cssText = 'display:flex;justify-content:flex-end;';
        foot.appendChild(_mkRoomJoinBtn(info));
        card.appendChild(foot);
        return card;
    }

    // 「加入房間」詳細資訊確認框：顯示房名／作者／人數／資訊，確認後才實際加入。
    //  分享房卡與房間搜尋頁的「加入」按鈕共用。
    //  infoPromise（選填）：資料尚未齊全時傳入，會先以 info 立即開框（其餘欄位顯示佔位），
    //  待 Promise 解析出完整 info 後就地抽換內容。使用者可在載入完成前就按「加入」。
    function showRoomJoinConfirm(info, infoPromise) {
        if (!info || !info.room) return;
        const ex = document.getElementById('fcm-confirm-overlay'); if (ex) ex.remove();
        const overlay = document.createElement('div'); overlay.id = 'fcm-confirm-overlay'; overlay.className = 'fcm-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:100001;display:flex;align-items:center;justify-content:center;';
        const box = document.createElement('div'); box.className = 'fcm-dialog';
        box.style.cssText = 'background:rgb(36,24,64);border:2px solid rgb(112,96,192);border-radius:14px;padding:28px 24px;width:min(380px,88vw);box-shadow:0 8px 40px rgba(0,0,0,.8);display:flex;flex-direction:column;gap:20px;font-family:-apple-system,sans-serif;';
        box.addEventListener('click', e => e.stopPropagation());
        const detailWrap = document.createElement('div');
        detailWrap.appendChild(_buildRoomDetail(info, !!infoPromise));
        box.appendChild(detailWrap);
        // 完整資料回來後就地抽換（若對話框已關閉則忽略）
        if (infoPromise) {
            Promise.resolve(infoPromise)
                .then(full => { if (overlay.isConnected) detailWrap.replaceChildren(_buildRoomDetail((full && full.room) ? full : info, false)); })
                .catch(() => { if (overlay.isConnected) detailWrap.replaceChildren(_buildRoomDetail(info, false)); });
        }

        const btnRow = document.createElement('div'); btnRow.style.cssText = 'display:flex;gap:12px;';
        const cancelBtn = document.createElement('button'); cancelBtn.textContent = T('btnCancel');
        cancelBtn.style.cssText = 'flex:1;padding:12px;background:#1e1635;border:1.5px solid #5a48a8;border-radius:10px;color:#c4a0e0;font-size:13px;cursor:pointer;font-weight:600;';
        cancelBtn.addEventListener('click', () => { cleanup(); overlay.remove(); });
        const okBtn = document.createElement('button'); okBtn.textContent = '🚪 ' + T('roomJoinRoomBtn');
        okBtn.style.cssText = 'flex:2;padding:12px;background:#1a3060;border:1.5px solid #4080d8;border-radius:10px;color:#90c8ff;font-size:13px;cursor:pointer;font-weight:700;';
        let _confirmed = false;
        okBtn.addEventListener('click', () => { if (_confirmed) return; _confirmed = true; cleanup(); overlay.remove(); _doJoinRoom(info.room); });

        const keyFn = e => {
            e.stopPropagation();
            if (e.key === 'Escape') { cleanup(); overlay.remove(); }
            if (e.key === 'Enter') { if (_confirmed) return; _confirmed = true; cleanup(); overlay.remove(); _doJoinRoom(info.room); }
        };
        function cleanup() { document.removeEventListener('keydown', keyFn, true); }
        document.addEventListener('keydown', keyFn, true);
        overlay.addEventListener('click', () => { cleanup(); overlay.remove(); });
        btnRow.appendChild(cancelBtn); btnRow.appendChild(okBtn);
        box.appendChild(btnRow);
        overlay.appendChild(box); document.body.appendChild(overlay); setTimeout(() => okBtn.focus(), 50);
    }

    function _roomShareInfoFromEntry(entry) {
        return {
            room: entry.Room,
            creator: entry.Creator || '',
            count: (entry.Count != null) ? entry.Count : null,
            limit: (entry.Limit != null) ? entry.Limit : null,
            desc: (entry.Desc || '').trim(),
            priv: !!entry.Priv,
            type: entry.Type || '',
        };
    }

    // 由房間搜尋結果物件組出 showRoomJoinConfirm 需要的 info 形狀。
    function roomInfoFromResult(room) {
        return {
            room: room.Name,
            creator: room.Creator || '',
            count: room.MemberCount ?? room.NbMember ?? null,
            limit: room.MemberLimit ?? room.Limit ?? null,
            desc: (room.Description || '').trim(),
            priv: _roomIsPrivate(room),
            type: _roomTypeLabel(room),
        };
    }

    function handleIncomingRoomShare(data) {
        try {
            const entry = (data.Dictionary || []).find(e => e && e.Tag === ROOMSHARE_TAG);
            if (!entry || !entry.Room) return;
            // 自己分享的也一併轉成房卡（含加入按鈕）
            const info = _roomShareInfoFromEntry(entry);
            // 找出剛剛（next(args) 已同步渲染）這則 Action 訊息元素
            const log = document.getElementById('TextAreaChatLog');
            let msgEl = null;
            if (log) {
                const nodes = log.querySelectorAll(`.ChatMessageAction[data-sender="${data.Sender}"]`);
                for (let i = nodes.length - 1; i >= 0; i--) { if (nodes[i].dataset.fcmRoomshare !== '1') { msgEl = nodes[i]; break; } }
            }
            if (msgEl) {
                msgEl.dataset.fcmRoomshare = '1';
                msgEl.classList.add('fcm-room-share-message');
                // 就地換成結構化房卡外觀（清掉原本純文字，改用房卡）
                msgEl.style.background = 'rgba(40,15,55,.55)';
                msgEl.style.border = '1px solid #6a4da8';
                msgEl.style.borderRadius = '8px';
                msgEl.style.padding = '10px 12px';
                msgEl.style.textAlign = 'left';
                msgEl.innerHTML = '';
                if (entry.Sharer) {
                    const intro = document.createElement('div');
                    intro.className = 'fcm-room-share-intro';
                    intro.style.cssText = 'color:#a890c8;font-size:.82em;margin-bottom:6px;';
                    intro.textContent = T('roomShareIntro', entry.Sharer);
                    msgEl.appendChild(intro);
                }
                msgEl.appendChild(_buildRoomShareCard(info));
            } else {
                // 退回：找不到訊息元素（例如沙盒環境）→ 疊一張獨立卡片
                const uiId = 'fcm-roomjoin-' + data.Sender + '-' + Date.now().toString(36);
                const el = _appendChatCard(uiId); if (!el) return;
                el.appendChild(_buildRoomShareCard(info));
            }
            _scrollChatToEnd();
        } catch (e) { console.warn('🐈‍⬛ [FCM] handleIncomingRoomShare:', e); }
    }

    // ── 聊天記錄卡片輔助（參考 AFC createProposalUI）─────────────────
    function _appendChatCard(uiId) {
        if (document.getElementById(uiId)) return null;
        let container = document.getElementById('TextAreaChatLog') || document.getElementById('chat-room-chat-log');
        const floating = !container;
        if (floating) container = document.body;
        if (!container) return null;
        const el = document.createElement('div'); el.id = uiId; el.className = 'fcm-chat-card';
        el.style.cssText = floating
            ? 'position:fixed;bottom:120px;left:50%;transform:translateX(-50%);z-index:99999;max-width:600px;width:90vw;background:rgba(40,15,55,.97);border:2px solid #9060d0;border-radius:10px;padding:12px 16px;font-size:1em;line-height:1.6;color:#eee;box-shadow:0 4px 24px rgba(0,0,0,.7);'
            : 'background:rgba(40,15,55,.93);border:2px solid #9060d0;border-radius:8px;padding:10px 14px;margin:6px 4px;font-size:1em;line-height:1.5;color:#eee;';
        container.appendChild(el);
        return el;
    }
    function _scrollChatToEnd() {
        const c = document.getElementById('TextAreaChatLog') || document.getElementById('chat-room-chat-log');
        if (c) c.scrollTop = c.scrollHeight;
    }

    function makeIdCell(mn) {
        const td = document.createElement('td'); td.className = 'fcm-id fcm-id-copy'; td.textContent = String(mn); td.title = T('copyId');
        td.addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(String(mn)); td.textContent = T('copyDone'); td.style.color = '#50d880'; setTimeout(() => { td.textContent = String(mn); td.style.color = ''; }, 1200); } catch {}
        });
        return td;
    }

export { roomOp, doView, doBeep, doWhisper, doAddFriend, doToggleList, doRemoveFriend, navigateToRoom, showConfirm, makeIdCell,
         showAddFriendConfirm, shareRoomToChat, showRoomJoinConfirm, roomInfoFromResult, handleIncomingFriendReq, handleIncomingRoomShare, FRIENDREQ_MSG, ROOMSHARE_TAG };

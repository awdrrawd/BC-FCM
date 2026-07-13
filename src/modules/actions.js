import { T } from './i18n.js';
import { PDB } from './profile-db.js';
import { amAdmin, inRoomFn, getDisplayName, isFriendOf } from './data.js';
import { renderCurrent, minimizePanel, closePanel } from './panel.js';
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
        const ex = document.getElementById('fcm-beep-overlay'); if (ex) { ex.remove(); return; }
        const overlay = document.createElement('div'); overlay.id = 'fcm-beep-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100000;display:flex;align-items:center;justify-content:center;';
        overlay.addEventListener('click', () => overlay.remove());
        const pop = document.createElement('div');
        pop.style.cssText = 'background:#241840;border:2px solid #8060c8;border-radius:16px;padding:26px;width:min(520px,92vw);box-shadow:0 10px 50px rgba(0,0,0,.85);display:flex;flex-direction:column;gap:16px;';
        pop.addEventListener('click', e => e.stopPropagation());
        const titleEl = document.createElement('div'); titleEl.style.cssText = 'color:#d0a8f0;font-size:16px;font-weight:700;text-align:center;'; titleEl.textContent = T('beepTitle', name);
        const ta = document.createElement('textarea'); ta.rows = 10; ta.placeholder = T('beepPlaceholder');
        ta.style.cssText = 'background:#1a1030;border:1.5px solid #6050a0;border-radius:10px;padding:12px;color:#f0e0ff;font-size:13px;outline:none;width:100%;box-sizing:border-box;resize:vertical;min-height:140px;max-height:360px;overflow-y:auto;font-family:inherit;line-height:1.5;';
        ta.style.setProperty('user-select', 'text', 'important');
        const btnRow = document.createElement('div'); btnRow.style.cssText = 'display:flex;gap:12px;';
        const cancelBtn = document.createElement('button'); cancelBtn.textContent = T('beepCancel'); cancelBtn.style.cssText = 'flex:1;padding:14px;background:#1e1635;border:1.5px solid #5a48a8;border-radius:10px;color:#c4a0e0;font-size:14px;cursor:pointer;font-weight:600;'; cancelBtn.addEventListener('click', () => overlay.remove());
        const sendBtn = document.createElement('button'); sendBtn.textContent = T('beepSend'); sendBtn.style.cssText = 'flex:2;padding:14px;background:#1a3860;border:1.5px solid #4090d8;border-radius:10px;color:#90d0ff;font-size:15px;cursor:pointer;font-weight:700;';
        sendBtn.addEventListener('click', () => { const msg = ta.value.trim(); ServerSend('AccountBeep', { MemberNumber: mn, BeepType: '', Message: msg || undefined }); if (typeof FriendListBeepLog !== 'undefined') FriendListBeepLog.push({ MemberNumber: mn, MemberName: name, Sent: true, Time: new Date(), Message: msg }); overlay.remove(); });
        ta.addEventListener('keydown', e => { if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); sendBtn.click(); } if (e.key === 'Escape') overlay.remove(); e.stopPropagation(); });
        const summonBtn = document.createElement('button');
        summonBtn.textContent = T('beepSummon');
        summonBtn.style.cssText = 'flex:1;padding:14px;background:#182a10;border:1.5px solid #40a030;border-radius:10px;color:#80e860;font-size:14px;cursor:pointer;font-weight:700;';
        summonBtn.addEventListener('click', () => {
            const msg = T('beepSummonConfirm', name);
            showConfirm(msg, () => {
                try {
                    ServerSend('AccountBeep', {
                        MemberNumber: mn, BeepType: '',
                        Message: 'summon',
                        ChatRoomName: (typeof ChatRoomData !== 'undefined' && ChatRoomData) ? ChatRoomData.Name : undefined,
                        ChatRoomSpace: (typeof ChatRoomData !== 'undefined' && ChatRoomData) ? ChatRoomData.Space : undefined,
                    });
                } catch(e) { console.warn('🐈‍⬛ [FCM] summon error:', e); }
                if (typeof FriendListBeepLog !== 'undefined') FriendListBeepLog.push({ MemberNumber: mn, MemberName: name, Sent: true, Time: new Date(), Message: '[summon]' });
                overlay.remove();
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

    function navigateToRoom(roomName) {
        showConfirm(T('confirmRoom', roomName), () => {
            // Blur all FCM search inputs to prevent their keydown handlers from
            // leaking Enter/Shift+Enter events into the new room context (Nami bug fix)
            document.querySelectorAll('.fcm-search, .fcm-room-search').forEach(el => el.blur());
            closePanel();
            try {
                if (typeof ChatRoomLeave === 'function') ChatRoomLeave();
                if (typeof CommonSetScreen === 'function') CommonSetScreen('Online', 'ChatSearch');
                try { ChatSearchLastQueryJoinTime = typeof CommonTime === 'function' ? CommonTime() : Date.now(); } catch {}
                try { ChatSearchLastQueryJoin = roomName; } catch {}
                ServerSend('ChatRoomJoin', { Name: roomName });
            } catch (e) { console.warn('🐈‍⬛ [FCM] navigateToRoom:', e); }
        }, T('roomGo'));
    }

    // ── Bug fix: showConfirm — stopPropagation on Enter to prevent
    // BC's room-join handler from firing after the confirm dialog closes.
    // Also guards against double-fire via _confirmed flag.
    function showConfirm(msg, onOk, okLabel) {
        const ex = document.getElementById('fcm-confirm-overlay'); if (ex) ex.remove();
        const overlay = document.createElement('div'); overlay.id = 'fcm-confirm-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:100001;display:flex;align-items:center;justify-content:center;';
        const box = document.createElement('div');
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
    const FRIENDREQ_TAG = 'LikoFCMFriendReq';

    function showAddFriendConfirm(mn, dname, oneSided) {
        mn = parseInt(mn);
        const ex = document.getElementById('fcm-confirm-overlay'); if (ex) ex.remove();
        const overlay = document.createElement('div'); overlay.id = 'fcm-confirm-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:100001;display:flex;align-items:center;justify-content:center;';
        const box = document.createElement('div');
        box.style.cssText = 'background:#241840;border:2px solid #7060c0;border-radius:14px;padding:26px 24px;width:min(400px,90vw);box-shadow:0 8px 40px rgba(0,0,0,.8);display:flex;flex-direction:column;gap:18px;font-family:-apple-system,sans-serif;';
        box.addEventListener('click', e => e.stopPropagation());

        const msgEl = document.createElement('div'); msgEl.style.cssText = 'color:#e8d0ff;font-size:14px;text-align:center;line-height:1.7;white-space:pre-wrap;';
        const hint = document.createElement('span'); hint.style.cssText = 'display:block;color:#9a86c8;font-size:12px;margin-top:6px;';
        hint.textContent = T('addFriendNotifyHint');
        msgEl.textContent = T('addFriendTitle', dname) + (oneSided ? '\n\n' + T('peopleOneSidedWarn') : '');
        msgEl.appendChild(hint);

        const inRoom = inRoomFn(mn);
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
        if (!inRoom) { okNotifyBtn.disabled = true; okNotifyBtn.style.opacity = '.4'; okNotifyBtn.style.cursor = 'not-allowed'; okNotifyBtn.title = T('friendReqNeedRoom'); }
        okNotifyBtn.addEventListener('click', () => { if (okNotifyBtn.disabled) return; close(); doAddFriend(mn); sendFriendReqNotify(mn); });

        const keyFn = e => { e.stopPropagation(); if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', keyFn, true);
        overlay.addEventListener('click', close);
        btnRow.appendChild(cancelBtn); btnRow.appendChild(okBtn); btnRow.appendChild(okNotifyBtn);
        box.appendChild(msgEl); box.appendChild(btnRow);
        overlay.appendChild(box); document.body.appendChild(overlay);
    }

    function sendFriendReqNotify(mn) {
        mn = parseInt(mn);
        try {
            ServerSend('ChatRoomChat', {
                Type: 'Hidden', Content: FRIENDREQ_TAG, Target: mn,
                Dictionary: [{ Tag: FRIENDREQ_TAG, SenderName: (Player && (Player.Nickname || Player.Name)) || String(Player?.MemberNumber) }],
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
        const line2 = `${room.Name} - ${room.Creator || '?'} ${priv}${typeTag}`.trim();
        const desc = (room.Description || '').trim();
        const systemMessage = T('roomShareIntro', sharer) + '\n' + line2 + (desc ? '\n' + desc : '');
        try {
            ServerSend('ChatRoomChat', {
                Type: 'Action', Content: 'CUSTOM_SYSTEM_ACTION',
                Dictionary: [
                    { Tag: SYS_ACTION_TAG, Text: systemMessage },     // 顯示文字（所有人可見）
                    { Tag: ROOMSHARE_TAG, Room: room.Name },          // 隱藏屬性：FCM 專屬（無 Text，BC 會忽略）
                ],
            });
            if (typeof ChatRoomSendLocal === 'function') ChatRoomSendLocal(T('roomShareLocalDone', room.Name), 5000);
        } catch (e) { console.warn('🐈‍⬛ [FCM] shareRoomToChat:', e); }
    }

    // 接收端（FCM 專屬）：把「這一則」剛渲染好的 Action 訊息就地轉換成資訊卡，
    //  右下角加「加入房間」。沒插件的人讀不到 ROOMSHARE_TAG，只會看到普通系統訊息。
    function _mkRoomJoinBtn(roomName) {
        const b = document.createElement('button');
        b.style.cssText = 'padding:5px 16px;background:#1a3860;color:#90d0ff;border:1px solid #4090d8;border-radius:6px;cursor:pointer;font-size:.9em;font-weight:700;white-space:nowrap;';
        b.textContent = '🚪 ' + T('roomJoinRoomBtn');
        b.addEventListener('click', () => navigateToRoom(roomName));
        return b;
    }
    function handleIncomingRoomShare(data) {
        try {
            const entry = (data.Dictionary || []).find(e => e && e.Tag === ROOMSHARE_TAG);
            if (!entry || !entry.Room) return;
            // 自己分享的也一併轉成房卡（含加入按鈕）
            const roomName = entry.Room;
            // 找出剛剛（next(args) 已同步渲染）這則 Action 訊息元素
            const log = document.getElementById('TextAreaChatLog');
            let msgEl = null;
            if (log) {
                const nodes = log.querySelectorAll(`.ChatMessageAction[data-sender="${data.Sender}"]`);
                for (let i = nodes.length - 1; i >= 0; i--) { if (nodes[i].dataset.fcmRoomshare !== '1') { msgEl = nodes[i]; break; } }
            }
            if (msgEl) {
                msgEl.dataset.fcmRoomshare = '1';
                // 就地套上資訊卡外觀
                msgEl.style.background = 'rgba(40,15,55,.55)';
                msgEl.style.border = '1px solid #6a4da8';
                msgEl.style.borderRadius = '8px';
                msgEl.style.padding = '8px 12px';
                msgEl.style.textAlign = 'left';
                const foot = document.createElement('div');
                foot.style.cssText = 'display:flex;justify-content:flex-end;margin-top:6px;';
                foot.appendChild(_mkRoomJoinBtn(roomName));
                msgEl.appendChild(foot);
            } else {
                // 退回：找不到訊息元素（例如沙盒環境）→ 疊一張獨立卡片
                const uiId = 'fcm-roomjoin-' + data.Sender + '-' + Date.now().toString(36);
                const el = _appendChatCard(uiId); if (!el) return;
                const row = document.createElement('div'); row.style.cssText = 'display:flex;justify-content:flex-end;';
                row.appendChild(_mkRoomJoinBtn(roomName)); el.appendChild(row);
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
        const el = document.createElement('div'); el.id = uiId;
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
         showAddFriendConfirm, shareRoomToChat, handleIncomingFriendReq, handleIncomingRoomShare, FRIENDREQ_TAG, ROOMSHARE_TAG };

import { T, isZh } from './i18n.js';
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
            const msg = (isZh()
                         ? `請確定您有召喚對方的權限，否則對方只會收到文字 "summon"。\n\n確定要召喚「${name}」嗎？`
                         : `Make sure you have permission to summon them, otherwise they will only receive the text "summon".\n\nSummon "${name}"?`);
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
            }, isZh() ? '召喚' : 'Summon');
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
        }, isZh() ? '🚪 前往' : '🚪 Go');
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
        const cancelBtn = document.createElement('button'); cancelBtn.textContent = isZh() ? '取消' : 'Cancel';
        cancelBtn.style.cssText = 'flex:1;padding:12px;background:#1e1635;border:1.5px solid #5a48a8;border-radius:10px;color:#c4a0e0;font-size:13px;cursor:pointer;font-weight:600;'; cancelBtn.addEventListener('click', () => { cleanup(); overlay.remove(); });
        const okBtn = document.createElement('button'); okBtn.textContent = okLabel || (isZh() ? '確認' : 'Confirm');
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

    function makeIdCell(mn) {
        const td = document.createElement('td'); td.className = 'fcm-id fcm-id-copy'; td.textContent = String(mn); td.title = T('copyId');
        td.addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(String(mn)); td.textContent = T('copyDone'); td.style.color = '#50d880'; setTimeout(() => { td.textContent = String(mn); td.style.color = ''; }, 1200); } catch {}
        });
        return td;
    }

export { roomOp, doView, doBeep, doWhisper, doAddFriend, doToggleList, doRemoveFriend, navigateToRoom, showConfirm, makeIdCell };

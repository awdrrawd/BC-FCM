import { modApi, cfg, MOD_VER, BTN_X, BTN_Y, BTN_W, BTN_H, _fcmIconImg } from './config.js';
import { T } from '../i18n/i18n.js';
import { setOnlineFriends } from '../data/data.js';
import { PDB, syncRoomAvatar } from '../data/profile-db.js';
import { renderCurrent, panelOpen, panelMini, uiTab, buildPanel, togglePanel, closePanel, openPanel, openPeopleSearch } from '../panel/panel.js';
import { _applyWhisperStyle, _updateWhisperAvatar, _drawWavOnCanvas } from '../chat/chat-fx.js';
import { WPS_PREFIX, wpsHandleMessage, observeWpsOpenTokens } from '../chat/wps-share.js';
import { handleIncomingFriendReq, handleIncomingRoomShare, FRIENDREQ_MSG, ROOMSHARE_TAG } from '../chat/actions.js';
import { handleIncomingBeep, handleIncomingChatMessageId, handleIncomingChatTag, handleIncomingFriendRequestNotice, handleIncomingWhisper, handleIncomingWhisperDisplay, handleOutgoingServerSend, handleOnlineFriendsUpdate } from '../communication/chat.js';
import { shouldBypassBcxReceiveRules } from '../communication/bcx-compat.js';
import { warnLimited } from './logger.js';
// ════════════════════════════════════════
//  FCM module: hooks.js
//  (split from Plugins/liko-FCM.user.js)
// ════════════════════════════════════════

    // Profile 關係人快速搜尋：透過 hook DrawTextFit 擷取 BC 實際繪製的「關係列」
    //  （主人 CollaredBy/TrialBy、戀人 Dating/Engaged/MarriedWith，皆結尾帶「(MemberNumber)」），
    //  按鈕框剛好貼合文字寬度（不受欄位固定寬影響）。
    //  _relCollect：InformationSheetRun 繪製期間暫存本幀擷取結果；_relRegions：供點擊命中測試。
    let _relCollect = null;
    let _introShown = false;   // 初始化提示只顯示一次
    let _relRegions = [];
    let _afcRegions = [];   // AFC 拓展戀人面板的可點區塊（透過 window.Liko.AFC 公開 API）
    let _hooksRegistered = false;

    // 將 hex 顏色朝白色混合，用於 hover 時提亮底線（amt: 0~1）
    function _lightenHex(hex, amt) {
        try {
            const h = String(hex).replace('#', '');
            const n = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
            const r = parseInt(n.substr(0, 2), 16), g = parseInt(n.substr(2, 2), 16), b = parseInt(n.substr(4, 2), 16);
            const mix = c => Math.round(c + (255 - c) * amt);
            return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
        } catch { return hex; }
    }

    function _afcPanelOpen() {
        try { const A = window.Liko && window.Liko.AFC; return !!(A && typeof A.isProfilePanelOpen === 'function' && A.isProfilePanelOpen()); } catch { return false; }
    }

    // 量測文字依欄寬縮字級後的實際寬度與字級（給 AFC 面板底線用）
    function _fittedTextWidth(text, maxW) {
        let w = 0, size = 36;
        try {
            if (typeof DrawingGetTextSize === 'function' && typeof CommonGetFont === 'function' && typeof MainCanvas !== 'undefined' && MainCanvas) {
                const res = DrawingGetTextSize(text, maxW);
                size = parseInt(res[1]) || 36;
                const prev = MainCanvas.font;
                MainCanvas.font = CommonGetFont(String(res[1]));
                w = MainCanvas.measureText(res[0]).width;
                MainCanvas.font = prev;
            }
        } catch {}
        if (!w && typeof MainCanvas !== 'undefined' && MainCanvas) { try { w = MainCanvas.measureText(text).width; } catch {} }
        if (!w) w = Math.min(maxW || 500, String(text).length * 18);
        return { w, size };
    }

    // 由 DrawTextFit 的參數量測實際繪製後的文字寬度（BC 會依欄寬縮字級）
    function _measureRelRegion(text, X, Y, Width) {
        const m = typeof text === 'string' && text.match(/\((\d{2,})\)\s*$/);
        if (!m) return null;
        const mn = parseInt(m[1]);
        if (!mn) return null;
        let w = 0, drawText = text;
        try {
            if (typeof DrawingGetTextSize === 'function' && typeof CommonGetFont === 'function' && typeof MainCanvas !== 'undefined' && MainCanvas) {
                const res = DrawingGetTextSize(text, Width);
                drawText = res[0];
                const prev = MainCanvas.font;
                MainCanvas.font = CommonGetFont(String(res[1]));
                w = MainCanvas.measureText(drawText).width;
                MainCanvas.font = prev;
            }
        } catch {}
        if (!w && typeof MainCanvas !== 'undefined' && MainCanvas) { try { w = MainCanvas.measureText(text).width; } catch {} }
        if (!w) w = Math.min(Width || 600, String(text).length * 18);
        const align = (typeof MainCanvas !== 'undefined' && MainCanvas && MainCanvas.textAlign) || 'left';
        const left = align === 'center' ? X - w / 2 : align === 'right' ? X - w : X;
        return { mn, x: left - 5, y: Y - 24, w: w + 10, h: 48 };  // textBaseline=middle → 以 Y 為垂直中心
    }

    function registerHooks() {
    if (_hooksRegistered) return;
    _hooksRegistered = true;
    const bypassedBeeps = new WeakSet();
    modApi.hookFunction('ServerAccountBeep', 10, (args, next) => {
        const data = args[0];
        // FCM 好友邀請借用 Leash 封包，但沒有任何房間資料；必須在此攔截，
        // 不可繼續交給 ServerHandleLeashBeep。
        if (data?.BeepType === 'Leash' && data?.Message === FRIENDREQ_MSG && !data?.ChatRoomName && !data?.ChatRoomSpace) {
            try { handleIncomingFriendReq(data.MemberNumber, data.MemberName); } catch (error) { warnLimited('friend request handling failed', error); }
            try { handleIncomingFriendRequestNotice(data); } catch (error) { warnLimited('friend request notice failed', error); }
            return;
        }
        if (data && shouldBypassBcxReceiveRules()) {
            try { handleIncomingBeep(data); bypassedBeeps.add(data); } catch (error) { warnLimited('BCX bypass beep handling failed', error); }
        }
        return next(args);
    });
    // BCX uses priority 5 for its receive rule. Running the normal FCM capture
    // below it means blocked beeps never reach FCM; priority 10 above is only
    // used when the explicit bypass setting is enabled.
    modApi.hookFunction('ServerAccountBeep', 0, (args, next) => {
        const data = args[0];
        if (data && !bypassedBeeps.has(data)) { try { handleIncomingBeep(data); } catch (error) { warnLimited('beep handling failed', error); } }
        return next(args);
    });
    modApi.hookFunction('ServerSend', 10, (args, next) => {
        try { handleOutgoingServerSend(args[0], args[1]); } catch (error) { warnLimited('outgoing chat capture failed', error); }
        return next(args);
    });
    modApi.hookFunction('ServerAccountQueryResult', 0, (args, next) => {
        const data = args[0];
        if (data?.Query === 'OnlineFriends' && Array.isArray(data.Result)) {
            setOnlineFriends(data.Result);
            handleOnlineFriendsUpdate(data.Result);
        }
        const r = next(args);
        // 任何來源取得的 OnlineFriends 結果都直接更新已開啟的關係／房間頁，不另設計時器。
        if (data?.Query === 'OnlineFriends' && panelOpen && !panelMini && (uiTab === 'friends' || uiTab === 'room')) {
            renderCurrent();
        }
        return r;
    });
    modApi.hookFunction('ChatRoomSync', 0, (args, next) => {
        const r = next(args);
        // 初始化提示：ChatRoomSendLocal 只在房內生效，故延到首次進房時顯示一次
        if (!_introShown) {
            _introShown = true;
            if (typeof ChatRoomSendLocal === 'function') ChatRoomSendLocal(T('initHint', MOD_VER), 0);
        }
        const raws = (args[0] && args[0].Character) || [];
        setTimeout(() => raws.forEach(raw => {
            const C = ChatRoomCharacter && ChatRoomCharacter.find(c => c.MemberNumber === raw.MemberNumber);
            if (C) {
                if (cfg.saveMode !== 'off') PDB.save(C, raw);
                if (cfg.avatars) syncRoomAvatar(C);
            }
        }), 800);
        return r;
    });
    modApi.hookFunction('ChatRoomSyncMemberJoin', 0, (args, next) => {
        const r = next(args);
        if (args[0] && args[0].Character) {
            const raw = args[0].Character;
            setTimeout(() => {
                const C = ChatRoomCharacter && ChatRoomCharacter.find(c => c.MemberNumber === raw.MemberNumber);
                if (C) {
                    if (cfg.saveMode !== 'off') PDB.save(C, raw);
                    if (cfg.avatars) syncRoomAvatar(C);
                }
            }, 800);
        }
        return r;
    });
    modApi.hookFunction('ChatRoomSyncRoomProperties', 0, (args, next) => {
        let r; try { r = next(args); } catch(e) { console.warn('🐈‍⬛ [FCM] SyncRoomProperties:', e); }
        try { if (panelOpen && !panelMini && uiTab === 'room') renderCurrent(); } catch {}
        return r;
    });
    modApi.hookFunction('ChatRoomSyncMemberLeave', 0, (args, next) => {
        const r = next(args);
        if (panelOpen && !panelMini && uiTab === 'room') renderCurrent();
        return r;
    });
    let _whisperDrawCount = 0;

    modApi.hookFunction('DrawProcess', 10, (args, next) => {
        next(args);
        if (typeof CurrentScreen !== 'undefined' && CurrentScreen === 'ChatRoom' && (typeof CurrentCharacter === 'undefined' || CurrentCharacter === null)) {
            if (cfg.btnShowChatRoom) {
                const btnColor = (panelOpen || panelMini) ? 'Pink' : 'Gray';
                MainCanvas.globalAlpha = 0.75;
                DrawButton(BTN_X, BTN_Y, BTN_W, BTN_H, '', btnColor, '', 'Friends & Room Manager');
                if (_fcmIconImg && typeof DrawImageResize === 'function') { const pad = 4; DrawImageResize(_fcmIconImg, BTN_X + pad, BTN_Y + pad, BTN_W - pad * 2, BTN_H - pad * 2); }
                MainCanvas.globalAlpha = 1.0;
            }
        }
        if (++_whisperDrawCount % 15 === 0) {
            _applyWhisperStyle();
            _updateWhisperAvatar();
        }
        // Draw whisper avatar on canvas every frame (after next() so it renders on top)
        const _inChatMain = (typeof CurrentScreen !== 'undefined' && CurrentScreen === 'ChatRoom')
        && (typeof CurrentCharacter === 'undefined' || CurrentCharacter === null);
        if (_inChatMain) _drawWavOnCanvas();
    });

    modApi.hookFunction('ChatRoomClick', 10, (args, next) => {
        if (cfg.btnShowChatRoom && MouseIn(BTN_X, BTN_Y, BTN_W, BTN_H)) { buildPanel(); togglePanel(); return; }
        next(args);
    });
    modApi.hookFunction('ChatRoomLeave', 0, (args, next) => { closePanel(); return next(args); });

    // ── Main Hall button ──────────────────────────────────────────
    const HALL_BTN_X = 1525, HALL_BTN_Y = 25, HALL_BTN_W = 90, HALL_BTN_H = 90;
    modApi.hookFunction('MainHallRun', 10, (args, next) => {
        next(args);
        if (!cfg.btnShowMainHall) return;
        if (typeof DrawButton === 'function') {
            const btnColor = (panelOpen || panelMini) ? 'Pink' : 'White';
            DrawButton(HALL_BTN_X, HALL_BTN_Y, HALL_BTN_W, HALL_BTN_H, '', btnColor, '', 'FCM');
            if (_fcmIconImg && typeof DrawImageResize === 'function') {
                const pad = 8;
                DrawImageResize(_fcmIconImg, HALL_BTN_X + pad, HALL_BTN_Y + pad, HALL_BTN_W - pad * 2, HALL_BTN_H - pad * 2);
            }
        }
    });
    modApi.hookFunction('MainHallClick', 10, (args, next) => {
        if (cfg.btnShowMainHall && typeof MouseIn === 'function' && MouseIn(HALL_BTN_X, HALL_BTN_Y, HALL_BTN_W, HALL_BTN_H)) {
            buildPanel(); togglePanel(); return;
        }
        return next(args);
    });

    // Explicit receive bypass: capture whispers before BCX's priority-5 rule.
    modApi.hookFunction('ChatRoomMessage', 10, (args, next) => {
        if (shouldBypassBcxReceiveRules()) { try { handleIncomingWhisper(args[0]); } catch (error) { warnLimited('BCX bypass whisper handling failed', error); } }
        return next(args);
    });
    // WPS hidden share messages
    modApi.hookFunction('ChatRoomMessage', 0, (args, next) => {
        const data = args[0];
        if (data?.Type === 'Hidden' && data?.Content === 'FCM::CHAT::TAG' && handleIncomingChatTag(data)) return;
        if (data?.Type === 'Hidden' && data?.Content === 'FCM::CHAT::MESSAGE' && handleIncomingChatMessageId(data)) return;
        if (data?.Type === 'Hidden' && data?.Content?.startsWith(WPS_PREFIX)) {
            if (!window.LikoWPSInstance) { wpsHandleMessage(data); return; }
        }
        // 房間分享（Action 對所有人可見）→ 先讓 BC 正常顯示，再疊上 FCM 專屬加入按鈕
        if (data?.Type === 'Action' && Array.isArray(data?.Dictionary) && data.Dictionary.some(e => e?.Tag === ROOMSHARE_TAG)) {
            const r = next(args);
            try { handleIncomingRoomShare(data); } catch (error) { warnLimited('room share handling failed', error); }
            return r;
        }
        return next(args);
    });
    modApi.hookFunction('ChatRoomMessageDisplay', 99, (args, next) => {
        const result = next(args);
        try { handleIncomingWhisperDisplay(args[0], args[1], args[2]); } catch (error) { warnLimited('whisper display handling failed', error); }
        return result;
    });

    observeWpsOpenTokens();
    modApi.hookFunction('DrawCharacter', 5, (args, next) => {
        try {
            const C = args[0];
            if (cfg.ghostHide && C && typeof Player !== 'undefined' && Player && C.MemberNumber !== Player.MemberNumber) {
                const gl = Player.GhostList;
                if (Array.isArray(gl) && gl.includes(C.MemberNumber)) return;
            }
        } catch {}
        return next(args);
    });
        // 擷取關係列座標：僅在 InformationSheet 繪製期間（_relCollect 非 null）作用
        modApi.hookFunction('DrawTextFit', 0, (args, next) => {
            const ret = next(args);
            if (_relCollect && cfg.profileRelations) {
                try { const reg = _measureRelRegion(args[0], args[1], args[2], args[3]); if (reg) _relCollect.push(reg); } catch {}
            }
            return ret;
        });
        // BC 原生關係列：priority 5（與 BC 按鈕同層）→ AFC 面板(7) 會畫在其上，展開時自然被蓋住
        modApi.hookFunction('InformationSheetRun', 5, (args, next) => {
            const collecting = cfg.profileRelations && typeof CurrentScreen !== 'undefined' && CurrentScreen === 'InformationSheet'
                && !(typeof InformationSheetSecondScreen !== 'undefined' && InformationSheetSecondScreen);
            if (collecting) _relCollect = [];
            const r = next(args);
            // Profile 關係人快速搜尋：在 BC 已繪製的關係列文字上疊一個貼合文字的可點高亮框
            if (collecting) {
                let regions = _relCollect || [];
                _relCollect = null;
                // 只保留真正的關係人 MemberNumber（戀人＋主人），濾掉像「更多戀人 (10)」的計數
                try {
                    const C = (typeof InformationSheetSelection !== 'undefined') ? InformationSheetSelection : null;
                    const valid = new Set();
                    if (C && typeof C.GetLovership === 'function') for (const l of (C.GetLovership() || [])) if (l && l.MemberNumber) valid.add(parseInt(l.MemberNumber));
                    try { if (C && typeof C.OwnerNumber === 'function') { const on = C.OwnerNumber(); if (on && on !== -1) valid.add(parseInt(on)); } } catch {}
                    try { if (C && C.Ownership && C.Ownership.MemberNumber) valid.add(parseInt(C.Ownership.MemberNumber)); } catch {}
                    regions = C ? regions.filter(reg => valid.has(reg.mn)) : [];
                } catch {}
                _relRegions = regions;
                try {
                    for (const reg of _relRegions) {
                        const hov = typeof MouseIn === 'function' && MouseIn(reg.x, reg.y, reg.w, reg.h);
                        // 只畫底線（貼合文字寬度），不畫按鈕外框；hover 時加粗變亮；無色時不畫
                        if (cfg.profileRelColor && typeof MainCanvas !== 'undefined' && MainCanvas) {
                            MainCanvas.save();
                            MainCanvas.fillStyle = hov ? _lightenHex(cfg.profileRelColor, 0.4) : cfg.profileRelColor;
                            MainCanvas.fillRect(reg.x + 5, reg.y + reg.h - 6, Math.max(0, reg.w - 10), hov ? 3 : 2);
                            MainCanvas.restore();
                        }
                    }
                } catch {}
            } else {
                _relRegions = [];
            }
            const viewingSelf = (typeof InformationSheetSelection !== 'undefined') &&
                  (InformationSheetSelection === Player.MemberNumber || InformationSheetSelection?.MemberNumber === Player.MemberNumber);
            if (viewingSelf && cfg.btnShowProfile && typeof DrawButton === 'function') {
                const btnColor = (panelOpen && !panelMini) ? '#3a1858' : 'White';
                DrawButton(1715, 420, 90, 90, '', btnColor, '', 'FCM');
                if (_fcmIconImg && typeof DrawImageResize === 'function') {
                    DrawImageResize(_fcmIconImg, 1725, 428, 74, 74);
                }
            }
            return r;
        });
        modApi.hookFunction('InformationSheetClick', 5, (args, next) => {
            const viewingSelf = (typeof InformationSheetSelection !== 'undefined') &&
                  (InformationSheetSelection === Player.MemberNumber || InformationSheetSelection?.MemberNumber === Player.MemberNumber);
        if (viewingSelf && cfg.btnShowProfile && typeof MouseIn === 'function' && MouseIn(1715, 420, 90, 90)) { openPanel(); return; }
            // Profile 關係人快速搜尋：點到某一關係列（主人／戀人）→ 開啟人員查詢並帶入該 ID
            if (cfg.profileRelations) {
                try {
                    for (const reg of _relRegions) {
                        if (typeof MouseIn === 'function' && MouseIn(reg.x, reg.y, reg.w, reg.h)) { openPeopleSearch(reg.mn); return; }
                    }
                } catch {}
            }
            return next(args);
        });

        // ── AFC 拓展戀人面板支援（priority 8，遵守 AFC 優先序契約）──────────
        //  AFC 於 priority 7 繪製「更多戀人」面板並填好 getProfileLoverRegions()；
        //  我們掛 priority 8（外層）→ next() 後 AFC 已畫完，於面板之上疊底線並優先吃點擊。
        modApi.hookFunction('InformationSheetRun', 8, (args, next) => {
            const r = next(args);
            _afcRegions = [];
            try {
                const AFC = window.Liko && window.Liko.AFC;
                if (cfg.profileRelations && _afcPanelOpen() && AFC && typeof AFC.getProfileLoverRegions === 'function') {
                    for (const e of (AFC.getProfileLoverRegions() || [])) {
                        if (!e || !e.memberNumber) continue;
                        const nameStr = `♥ ${e.name} (${e.memberNumber})`;   // 對齊 AFC 的名稱行格式
                        const fit = _fittedTextWidth(nameStr, e.w);
                        const w = Math.max(0, Math.min(fit.w, e.w));
                        const hit = { mn: parseInt(e.memberNumber), x: e.x - 5, y: e.y, w: w + 10, h: 46 };
                        _afcRegions.push(hit);
                        const hov = typeof MouseIn === 'function' && MouseIn(hit.x, hit.y, hit.w, hit.h);
                        if (cfg.profileRelColor && typeof MainCanvas !== 'undefined' && MainCanvas) {
                            MainCanvas.save();
                            MainCanvas.fillStyle = hov ? _lightenHex(cfg.profileRelColor, 0.4) : cfg.profileRelColor;
                            // AFC: region.y = 名稱行中心 - 26；底線畫在名稱文字正下方
                            MainCanvas.fillRect(e.x, e.y + 26 + fit.size * 0.5 + 1, w, hov ? 3 : 2);
                            MainCanvas.restore();
                        }
                    }
                }
            } catch { _afcRegions = []; }
            return r;
        });
        modApi.hookFunction('InformationSheetClick', 8, (args, next) => {
            if (cfg.profileRelations && _afcPanelOpen()) {
                try {
                    for (const reg of _afcRegions) {
                        if (typeof MouseIn === 'function' && MouseIn(reg.x, reg.y, reg.w, reg.h)) { openPeopleSearch(reg.mn); return; }
                    }
                } catch {}
            }
            return next(args);
        });
    }

export { registerHooks };

import { T } from '../i18n/i18n.js';
import { injectStyles } from './styles.js';
import { _removeWhisperAvatar } from '../chat/chat-fx.js';
import { renderHelp } from './panel-help.js';
import { renderPeople, resetPeopleSearch, setPeopleQuery } from './panel-people.js';
import { renderSettings } from './panel-settings.js';
import { renderFriends, resetFriendsSearch } from './panel-friends.js';
import { renderRoom, resetRoomAdminSearch } from './panel-room.js';
import { renderRoomSearch, resetRoomSearchQuery } from './panel-roomsearch.js';
// ════════════════════════════════════════
//  FCM module: panel.js  (orchestration core — split from Plugins/liko-FCM.user.js)
//  面板骨架與生命週期：建立/開關/拖曳、頁籤切換、renderCurrent 分派。
//  各分頁的渲染與狀態已拆至 panel-{friends,room,roomsearch,people,settings,help}.js，
//  共用元件在 panel-widgets.js、房間資料在 panel-rooms-data.js。
// ════════════════════════════════════════

    let _renderToken = 0;
    // 供已拆出的分頁模組（如 panel-people.js）判斷自己的 render 是否已過期。
    function getRenderToken() { return _renderToken; }
    let panelEl = null, miniEl = null, panelOpen = false, panelMini = false;
    let uiTab = 'friends';
    // 手動刷新的 5 秒冷卻計時；_friendPoll：面板開著時的定期抓取（BC 在聊天室內不會自動輪詢 OnlineFriends）
    let _lastRefresh = 0, _friendPoll = null;

    function enableDragScroll(scope) {
        scope.querySelectorAll('.fcm-scroll,.fcm-settings-wrap').forEach(element => {
            if (element.dataset.dragScroll) return; element.dataset.dragScroll = '1';
            let startX=0,startY=0,left=0,top=0,dragging=false;
            element.addEventListener('pointerdown', e => {
                if (e.button !== 0 || e.target.closest('button,input,textarea,select,a')) return;
                startX=e.clientX; startY=e.clientY; left=element.scrollLeft; top=element.scrollTop; dragging=true; element.setPointerCapture(e.pointerId); element.classList.add('drag-scrolling');
            });
            element.addEventListener('pointermove', e => { if (!dragging) return; const dx=e.clientX-startX,dy=e.clientY-startY; if(Math.abs(dx)+Math.abs(dy)>3)e.preventDefault(); element.scrollLeft=left-dx; element.scrollTop=top-dy; });
            const stop=()=>{dragging=false;element.classList.remove('drag-scrolling')}; element.addEventListener('pointerup',stop); element.addEventListener('pointercancel',stop);
        });
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
        const minBtn = document.createElement('button'); minBtn.type = 'button'; minBtn.className = 'fcm-hbtn fcm-chat-icon-action'; minBtn.title = T('minimize'); minBtn.textContent = T('minimize'); minBtn.addEventListener('click', minimizePanel);
        const closeBtn = document.createElement('button'); closeBtn.type = 'button'; closeBtn.className = 'fcm-hbtn fcm-chat-icon-action'; closeBtn.title = T('close'); closeBtn.textContent = T('close'); closeBtn.addEventListener('click', closePanel);
        hdr.appendChild(title); hdr.appendChild(minBtn); hdr.appendChild(closeBtn);
        const tabBar = document.createElement('div'); tabBar.id = 'fcm-tabs';
        [['friends', T('tabFriends')], ['room', T('tabRoom')], ['roomSearch', T('tabRoomSearch')], ['people', T('tabPeople')], ['settings', T('tabSettings')], ['help', T('tabHelp')]].forEach(([key, label]) => {
            const t = document.createElement('div'); t.className = 'fcm-tab' + (key === uiTab ? ' active' : ''); t.dataset.tab = key; t.textContent = label;
            t.addEventListener('click', () => {
                uiTab = key;
                if (key !== 'people') resetPeopleSearch();
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
        // 拖曳期間關閉 CSS transition（#fcm-mini 有 transition:all .15s，否則每次 mousemove 都會補間造成拖曳卡頓）
        mini.addEventListener('mousedown', e => { md.on = true; md.moved = false; const r = mini.getBoundingClientRect(); md.ox = e.clientX - r.left; md.oy = e.clientY - r.top; mini.style.transition = 'none'; mini.style.bottom = 'auto'; mini.style.transform = 'none'; mini.style.left = r.left + 'px'; mini.style.top = r.top + 'px'; e.preventDefault(); });
        document.addEventListener('mousemove', e => { if (!md.on) return; md.moved = true; mini.style.left = (e.clientX - md.ox) + 'px'; mini.style.top = (e.clientY - md.oy) + 'px'; });
        document.addEventListener('mouseup', () => { if (md.on) { mini.style.transition = ''; if (!md.moved) restorePanel(); } md.on = false; });
    }

    // ═══════════════════════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════════════════════
    function renderCurrent() {
        if (!panelEl || !panelOpen || panelMini) return;
        const content = panelEl.querySelector('#fcm-content'); if (!content) return;
        // 同步頁籤高亮：外部入口（/profiles 指令、關係網人員查詢、設定按鈕）直接改 uiTab
        //  後只呼叫 renderCurrent，頁籤列的 active 狀態需在此一併更新，否則會停在上次頁籤。
        panelEl.querySelectorAll('.fcm-tab').forEach(x => x.classList.toggle('active', x.dataset.tab === uiTab));
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
            enableDragScroll(content);
        }).catch(e => console.warn('🐈‍⬛ [FCM] render:', e));
    }

    // 手動刷新：即刻請求最新線上好友資料，5 秒冷卻防連點狂發。回來的重繪由 hooks.js 的輪詢
    //  重繪銜接；此處先以現有資料立即重繪一次。回傳 false = 冷卻中（供按鈕給視覺提示）。
    function refreshPanel() {
        const now = Date.now();
        if (now - _lastRefresh < 5000) return false;
        _lastRefresh = now;
        try { if (typeof ServerSend === 'function') ServerSend('AccountQuery', { Query: 'OnlineFriends' }); } catch {}
        renderCurrent();
        return true;
    }
    // 面板開著且在 friends/room 分頁時定期重查線上好友；結果回來由 hooks.js 的 result hook 重繪。
    function _startFriendPoll() {
        if (_friendPoll) return;
        _friendPoll = setInterval(() => {
            if (panelOpen && !panelMini && (uiTab === 'friends' || uiTab === 'room')
                && typeof ServerSend === 'function') {
                ServerSend('AccountQuery', { Query: 'OnlineFriends' });
            }
        }, 15000);  // ponytail: 固定 15s；要更即時就調短
    }
    function _stopFriendPoll() { if (_friendPoll) { clearInterval(_friendPoll); _friendPoll = null; } }


    // ═══════════════════════════════════════════════════════════
    //  PANEL STATE
    // ═══════════════════════════════════════════════════════════
    function openPanel() {
        if (!panelEl) buildPanel();
        panelEl.classList.remove('hidden');
        if (miniEl) miniEl.classList.remove('visible');
        panelOpen = true; panelMini = false;
        // 開啟即查一次；不動 _lastRefresh，手動 ↻ 的冷卻與「開啟」脫鉤（開啟後仍可立即手動再查一次）
        try { if (typeof ServerSend === 'function') ServerSend('AccountQuery', { Query: 'OnlineFriends' }); } catch {}
        _startFriendPoll();
        renderCurrent();
    }

    // 語言切換：就地刷新標題／頁籤／當前分頁文字，不整個銷毀重建面板（CHAT 端亦以同一套
    // fcm-language-change 事件即時更新，兩邊互相即時反映，而非各自依賴一次性重建）。
    function refreshChrome() {
        if (!panelEl) return;
        const title = panelEl.querySelector('#fcm-title'); if (title) title.textContent = T('panelTitle');
        const hdrBtns = panelEl.querySelectorAll('#fcm-hdr .fcm-hbtn');
        if (hdrBtns[0]) hdrBtns[0].textContent = T('minimize');
        if (hdrBtns[1]) hdrBtns[1].textContent = T('close');
        const tabDefs = [['friends', T('tabFriends')], ['room', T('tabRoom')], ['roomSearch', T('tabRoomSearch')], ['people', T('tabPeople')], ['settings', T('tabSettings')], ['help', T('tabHelp')]];
        panelEl.querySelectorAll('#fcm-tabs .fcm-tab').forEach((el, index) => { if (tabDefs[index]) el.textContent = tabDefs[index][1]; });
        if (miniEl) { const lbl = miniEl.querySelector('.fcm-mini-lbl'); if (lbl) lbl.textContent = T('miniLabel'); }
        renderCurrent();
    }
    // 由設定頁（panel-settings.js）語言切換後呼叫：面板若未開啟則正常開啟到設定頁；
    // 若已開啟，僅就地刷新文字並廣播事件，讓 CHAT（若開啟中）同步即時刷新。
    function reopenForLang() {
        uiTab = 'settings';
        if (!panelEl || !panelOpen) { openPanel(); }
        else { panelEl.querySelectorAll('.fcm-tab').forEach(x => x.classList.toggle('active', x.dataset.tab === uiTab)); refreshChrome(); }
        window.dispatchEvent(new CustomEvent('fcm-language-change'));
    }
    // CHAT 端切換語言時會廣播同一事件；FCM 面板若已開啟，就地刷新即可，不需重建。
    window.addEventListener('fcm-language-change', refreshChrome);

    function minimizePanel() { if (!panelEl) return; panelEl.classList.add('hidden'); if (miniEl) miniEl.classList.add('visible'); panelMini = true; _stopFriendPoll(); _removeWhisperAvatar(); }
    function restorePanel() { if (!panelEl) buildPanel(); panelEl.classList.remove('hidden'); if (miniEl) miniEl.classList.remove('visible'); panelMini = false; _startFriendPoll(); renderCurrent(); }
    function closePanel() {
        if (panelEl) panelEl.classList.add('hidden');
        if (miniEl) miniEl.classList.remove('visible');
        panelOpen = false; panelMini = false;
        _stopFriendPoll();
        // 關閉時一併清空所有搜尋欄位狀態
        resetPeopleSearch();
        resetFriendsSearch(); resetRoomAdminSearch(); resetRoomSearchQuery();
        _removeWhisperAvatar();
        document.getElementById('fcm-beep-overlay')?.remove();
        document.getElementById('fcm-confirm-overlay')?.remove();
    }
    function togglePanel() { if (panelOpen || panelMini) closePanel(); else openPanel(); }

    function registerCommand() {
        if (typeof CommandCombine === 'function') {
            CommandCombine([{
                Tag: 'profiles',
                Description: T('cmdProfilesDesc'),
                Action: arg => { setPeopleQuery(arg ? arg.trim() : ''); uiTab = 'people'; openPanel(); },
            }]);
        }
    }

    // ═══════════════════════════════════════════════════════════
    //  PROFILE RELATIONS QUICK-SEARCH  (feature: profileRelations)
    //  角色資料頁的關係網（BC 於 canvas 繪製）→ 由 hooks.js 疊上可點按鈕，
    //  點擊後呼叫此函式開啟人員查詢並帶入該關係人 ID。
    // ═══════════════════════════════════════════════════════════
    function openPeopleSearch(id) {
        setPeopleQuery(id); uiTab = 'people';
        openPanel();
    }

export { renderCurrent, refreshPanel, buildPanel, openPanel, closePanel, minimizePanel, restorePanel, togglePanel, registerCommand, openPeopleSearch, getRenderToken, reopenForLang, panelOpen, panelMini, uiTab };

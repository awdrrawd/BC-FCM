import { cfg, saveCfg, THEME_DEFAULTS } from '../core/config.js';
import { T, FCM_LANGS, FCM_LANG_NAMES, FCM_LANG_FLAGS, ensureI18n } from '../i18n/i18n.js';
import { applyTheme } from './styles.js';
import { PDB, _pc, Snapshot, detectWCESave, setAvStatusEl, ensureOwnAvatarSnapshot, updateOwnAvatarSnapshot, updateOwnAvatarProfile } from '../data/profile-db.js';
import { buildFriendList } from '../data/data.js';
import { mkBtn, mkToggle, refreshSnapshotsForList } from './panel-widgets.js';
import { exportProfiles, importProfiles } from './panel-people.js';
import { _applyWhisperStyle, _removeWhisperAvatar, _installOocProtect, _uninstallOocProtect } from '../chat/chat-fx.js';
import { renderCurrent, reopenForLang } from './panel-controller.js';
import { refreshChatSettings, playNotificationSound, saveCustomNotificationSound } from '../communication/chat.js';
import { THEME_PRESETS } from '../core/themes.js';
import { ALARM_MUTED_ICON, ALARM_ACTIVE_ICON } from '../ui/icons.js';
// ════════════════════════════════════════
//  FCM module: panel-settings.js  (split from panel.js)
//  設定頁。與 index 唯一的耦合是「切換語言後重建面板」，已抽成 reopenForLang()。
// ════════════════════════════════════════

function renderSettings(container) {
    container.innerHTML = '';
    const wrap = document.createElement('div'); wrap.className = 'fcm-settings-wrap';
    function settingRow(label, note, on, onChange) {
        const row = document.createElement('div'); row.className = 'fcm-set-row';
        const tog = mkToggle(on, onChange), info = document.createElement('div');
        const lbl = document.createElement('div'); lbl.className = 'fcm-set-label'; lbl.textContent = label;
        const nt = document.createElement('div'); nt.className = 'fcm-set-note'; nt.textContent = note;
        info.style.flex = '1';
        info.appendChild(lbl); info.appendChild(nt); row.appendChild(info); row.appendChild(tog);
        return row;
    }
    function balloonSelectRow(label, note, cfgKey, legacyKey) {
        const row = document.createElement('div'); row.className = 'fcm-set-row';
        const info = document.createElement('div'); info.style.flex = '1';
        const lbl = document.createElement('div'); lbl.className = 'fcm-set-label'; lbl.textContent = label;
        const nt = document.createElement('div'); nt.className = 'fcm-set-note'; nt.textContent = note;
        const select = document.createElement('select'); select.className = 'fcm-sel';
        [['off', T('balloonOff')], ['top-left', `⬉ ${T('balloonTopLeft')}`], ['middle-left', `⭠ ${T('balloonMiddleLeft')}`], ['bottom-left', `⬋ ${T('balloonBottomLeft')}`], ['top-right', `⬈ ${T('balloonTopRight')}`], ['middle-right', `⭢ ${T('balloonMiddleRight')}`], ['bottom-right', `⬊ ${T('balloonBottomRight')}`]].forEach(([value, text]) => {
            const option = document.createElement('option'); option.value = value; option.textContent = text; option.selected = cfg[cfgKey] === value; select.appendChild(option);
        });
        select.addEventListener('change', () => { cfg[cfgKey] = select.value; cfg[legacyKey] = select.value !== 'off'; saveCfg(); refreshChatSettings(); });
        info.appendChild(lbl); info.appendChild(nt); row.appendChild(info); row.appendChild(select);
        return row;
    }
    const nav = document.createElement('div'); nav.className = 'fcm-settings-nav';
    const navItems = [['main', T('settingsTabMain')], ['communication', T('settingsTabCommunication')], ['chat', T('settingsTabChat')]];
    navItems.forEach(([id, label], index) => {
        const b = document.createElement('button'); b.textContent = label; b.classList.toggle('active', index === 0);
        b.addEventListener('click', () => {
            nav.querySelectorAll('button').forEach(x => x.classList.remove('active')); b.classList.add('active');
            wrap.querySelector(`#fcm-settings-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        nav.appendChild(b);
    });
    wrap.appendChild(nav);
    function sectionHeader(title, id) {
        const h = document.createElement('div');
        if (id) { h.id = `fcm-settings-${id}`; h.className = `fcm-settings-section fcm-settings-${id}`; }
        h.style.cssText = 'font-size:15px;font-weight:800;letter-spacing:1px;color:#c4a0e0;padding:14px 0 4px 0;border-bottom:2px solid #3a2870;margin-bottom:2px;';
        h.textContent = title; wrap.appendChild(h);
    }
    function divider() { const d = document.createElement('div'); d.className = 'fcm-divider'; wrap.appendChild(d); }

    // ══════════════════════════════════════════
    //  GROUP A: UI 管理
    // ══════════════════════════════════════════
    sectionHeader(T('setSecUI'), 'main');

    // ── Language ──────────────────────────────
    const langRow = document.createElement('div'); langRow.className = 'fcm-set-row'; langRow.style.alignItems = 'center';
    const langInfo = document.createElement('div'); langInfo.style.flex = '1';
    const langLbl = document.createElement('div'); langLbl.className = 'fcm-set-label'; langLbl.textContent = T('langLabel');
    langInfo.appendChild(langLbl);   // 語言不需要說明文字
    const langSel = document.createElement('select'); langSel.className = 'fcm-sel fcm-lang-flag-select'; langSel.style.flexShrink = '0';
    // 國旗字體用 inline style（保證生效，不被主題 CSS 層疊蓋掉）：白嫖 BC 的 "Twemoji Country Flags"。
    // select 本體 + 每個 option 都要設：因為 .fcm-sel option 有自訂背景色，Chromium 會用 styled
    // popup 渲染下拉清單，該模式下 option 不繼承 select 的字體，不各自設國旗就會退化成 TW/CN 字母。
    const FLAG_FONT = '"Twemoji Country Flags",-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans TC",sans-serif';
    langSel.style.fontFamily = FLAG_FONT;
    // 舊值相容：把已存的 zh/en 映射回 TW/EN 供下拉選單正確選取
    const _curLang = cfg.lang === 'zh' ? 'TW' : cfg.lang === 'en' ? 'EN' : (cfg.lang || 'auto');
    FCM_LANGS.forEach(v => {
        const o = document.createElement('option'); o.value = v; o.style.fontFamily = FLAG_FONT; o.textContent = (FCM_LANG_FLAGS[v] ? FCM_LANG_FLAGS[v] + ' ' : '') + (FCM_LANG_NAMES[v] || v); if (v === _curLang) o.selected = true; langSel.appendChild(o);
    });
    langSel.addEventListener('change', async () => {
        cfg.lang = langSel.value; saveCfg();
        // 一國一檔：切換語言時按需抓取新選語言的字庫（TW/CN/EN 已在內建後備，其餘需 fetch）
        await ensureI18n();
        reopenForLang();
    });
    langRow.appendChild(langInfo); langRow.appendChild(langSel);
    wrap.appendChild(langRow);
    divider();

    // ── Theme Colors (面板底色 / 字體顏色 / 強調色) ──
    const themeRow = document.createElement('div'); themeRow.className = 'fcm-set-row'; themeRow.style.alignItems = 'flex-start';
    const themeInfo = document.createElement('div'); themeInfo.style.flex = '1';
    const themeLbl = document.createElement('div'); themeLbl.className = 'fcm-set-label'; themeLbl.textContent = T('themeSettingsLabel');
    const themeNote = document.createElement('div'); themeNote.className = 'fcm-set-note'; themeNote.textContent = T('themeColorNote');
    const pickers = document.createElement('div'); pickers.style.cssText = 'display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin-top:9px;';
    const colorField = (labelKey, cfgKey) => {
        const box = document.createElement('label'); box.style.cssText = 'display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#a090c8;cursor:pointer;';
        const inp = document.createElement('input'); inp.type = 'color'; inp.value = cfg[cfgKey] || THEME_DEFAULTS[cfgKey];
        inp.style.cssText = 'width:32px;height:24px;border-radius:6px;border:1px solid #5048a0;background:#1a1030;cursor:pointer;padding:1px;';
        inp.addEventListener('input', () => { cfg[cfgKey] = inp.value; cfg.themePreset = 'custom'; saveCfg(); applyTheme(); updateThemeButton(); });
        const span = document.createElement('span'); span.textContent = T(labelKey);
        box.appendChild(inp); box.appendChild(span); box._inp = inp;
        return box;
    };
    const fPanel = colorField('themePanelColor', 'panelColor');
    const fFont  = colorField('themeFontColor', 'fontColor');
    const fAccent = colorField('themeAccentColor', 'accentColor');
    const themeReset = mkBtn(T('themeReset'), 'fcm-btn', () => {
        cfg.panelColor = THEME_DEFAULTS.panelColor; cfg.fontColor = THEME_DEFAULTS.fontColor; cfg.accentColor = THEME_DEFAULTS.accentColor;
        cfg.themePreset = 'violet';
        saveCfg(); applyTheme();
        fPanel._inp.value = THEME_DEFAULTS.panelColor; fFont._inp.value = THEME_DEFAULTS.fontColor; fAccent._inp.value = THEME_DEFAULTS.accentColor;
        presetRow.querySelectorAll('button').forEach(x => x.classList.toggle('active', x.textContent === T('themePreset_violet'))); updateThemeButton();
    });
    themeReset.style.cssText = 'font-size:11px;padding:5px 10px;';
    pickers.appendChild(fPanel); pickers.appendChild(fFont); pickers.appendChild(fAccent); pickers.appendChild(themeReset);
    const presetRow = document.createElement('div'); presetRow.className = 'fcm-theme-presets';
    Object.entries(THEME_PRESETS).forEach(([key, colors]) => {
        const b = document.createElement('button'); b.className = 'fcm-btn'; b.textContent = T(`themePreset_${key}`);
        b.classList.toggle('active', cfg.themePreset === key);
        b.addEventListener('click', () => {
            [cfg.panelColor, cfg.fontColor, cfg.accentColor] = colors; cfg.themePreset = key;
            fPanel._inp.value = colors[0]; fFont._inp.value = colors[1]; fAccent._inp.value = colors[2];
            presetRow.querySelectorAll('button').forEach(x => x.classList.remove('active')); b.classList.add('active');
            saveCfg(); applyTheme(); updateThemeButton();
        });
        presetRow.appendChild(b);
    });
    const themeManageBtn = document.createElement('button'); themeManageBtn.className = 'fcm-btn fcm-theme-manage';
    const themeName = () => cfg.themePreset === 'custom' ? T('themeCustom') : T(`themePreset_${cfg.themePreset || 'violet'}`);
    const updateThemeButton = () => { themeManageBtn.textContent = `${T('themeSettingsLabel')} · ${themeName()}`; };
    updateThemeButton();
    const themePanel = document.createElement('div'); themePanel.className = 'fcm-theme-options'; themePanel.style.display = 'none';
    themePanel.appendChild(presetRow); themePanel.appendChild(pickers);
    themeManageBtn.addEventListener('click', () => { const open = themePanel.style.display !== 'block'; themePanel.style.display = open ? 'block' : 'none'; themeManageBtn.classList.toggle('active', open); });
    themeInfo.appendChild(themeLbl); themeInfo.appendChild(themeNote);
    themeRow.appendChild(themeInfo); themeRow.appendChild(themeManageBtn);
    wrap.appendChild(themeRow); wrap.appendChild(themePanel);
    divider();

    // ── Avatars ───────────────────────────────
    const avRow = document.createElement('div'); avRow.className = 'fcm-set-row'; avRow.style.alignItems = 'center';
    const avDisplayInfo = document.createElement('div'); avDisplayInfo.style.flex = '1';
    const avDisplayLabel = document.createElement('div'); avDisplayLabel.className = 'fcm-set-label'; avDisplayLabel.textContent = T('setAvatars');
    const avDisplayNote = document.createElement('div'); avDisplayNote.className = 'fcm-set-note'; avDisplayNote.textContent = T('setAvatarsNote');
    avDisplayInfo.appendChild(avDisplayLabel); avDisplayInfo.appendChild(avDisplayNote); avRow.appendChild(avDisplayInfo);
    const avDisplaySelect = document.createElement('select'); avDisplaySelect.className = 'fcm-sel';
    [['none', '不顯示'], ['round', '圓形'], ['square', '方形']].forEach(([value, label]) => {
        const option = document.createElement('option'); option.value = value; option.textContent = label;
        option.selected = value === (cfg.avatars ? (cfg.avatarShape || 'square') : 'none'); avDisplaySelect.appendChild(option);
    });
    avDisplaySelect.addEventListener('change', async () => {
        cfg.avatars = avDisplaySelect.value !== 'none';
        if (cfg.avatars) { cfg.avatarShape = avDisplaySelect.value; cfg.chatAvatarShape = avDisplaySelect.value; }
        saveCfg(); if (cfg.avatars) await ensureOwnAvatarSnapshot(); renderCurrent();
    });
    const ownSnapshotBtn = document.createElement('button'); ownSnapshotBtn.className = 'fcm-btn';
    ownSnapshotBtn.textContent = T('btnUpdateOwnAvatar'); ownSnapshotBtn.style.cssText = 'font-size:11px;padding:6px 12px;flex-shrink:0;';
    ownSnapshotBtn.addEventListener('click', async () => {
        ownSnapshotBtn.disabled = true;
        const ok = await updateOwnAvatarSnapshot();
        ownSnapshotBtn.textContent = ok ? T('ownAvatarUpdated') : T('ownAvatarUpdateFailed');
        setTimeout(() => { ownSnapshotBtn.textContent = T('btnUpdateOwnAvatar'); ownSnapshotBtn.disabled = false; }, 2500);
    });
    const cacheBtn = document.createElement('button'); cacheBtn.className = 'fcm-btn fcm-btn-blue';
    cacheBtn.textContent = T('btnReloadAvatars'); cacheBtn.style.cssText = 'font-size:11px;padding:6px 12px;flex-shrink:0;margin-left:auto;';
    cacheBtn.title = T('reloadAvatarsNote');
    avRow.appendChild(ownSnapshotBtn); avRow.appendChild(cacheBtn); avRow.appendChild(avDisplaySelect);
    wrap.appendChild(avRow);
    const avatarModeRow = document.createElement('div'); avatarModeRow.className = 'fcm-set-row'; avatarModeRow.style.alignItems = 'center';
    const avatarModeInfo = document.createElement('div'); avatarModeInfo.style.flex = '1';
    const avatarModeLabel = document.createElement('div'); avatarModeLabel.className = 'fcm-set-label'; avatarModeLabel.textContent = T('avatarModeLabel');
    const avatarModeNote = document.createElement('div'); avatarModeNote.className = 'fcm-set-note'; avatarModeNote.textContent = T('avatarModeNote');
    avatarModeInfo.appendChild(avatarModeLabel); avatarModeInfo.appendChild(avatarModeNote);
    const avatarModeSelect = document.createElement('select'); avatarModeSelect.className = 'fcm-sel';
    [['url', T('avatarModeUrl')], ['game', T('avatarModeGame')], ['none', T('avatarModeNone')]].forEach(([value, label]) => {
        const o = document.createElement('option'); o.value = value; o.textContent = label; o.selected = cfg.avatarMode === value; avatarModeSelect.appendChild(o);
    });
    avatarModeRow.appendChild(avatarModeInfo); avatarModeRow.appendChild(avatarModeSelect); wrap.appendChild(avatarModeRow);
    const avatarUrlRow = document.createElement('div'); avatarUrlRow.className = 'fcm-set-row'; avatarUrlRow.style.paddingLeft = '56px';
    const avatarUrlInput = document.createElement('input'); avatarUrlInput.className = 'fcm-search'; avatarUrlInput.placeholder = 'https://…'; avatarUrlInput.value = cfg.avatarUrl || '';
    avatarUrlInput.style.width = '100%'; avatarUrlRow.appendChild(avatarUrlInput); wrap.appendChild(avatarUrlRow);
    const paintAvatarMode = () => { avatarUrlRow.style.display = avatarModeSelect.value === 'url' ? 'flex' : 'none'; };
    avatarModeSelect.addEventListener('change', async () => {
        cfg.avatarMode = avatarModeSelect.value; saveCfg(); paintAvatarMode();
        await updateOwnAvatarProfile(cfg.avatarMode, cfg.avatarUrl);
    });
    avatarUrlInput.addEventListener('change', async () => {
        cfg.avatarUrl = avatarUrlInput.value.trim(); saveCfg();
        if (cfg.avatarMode === 'url') await updateOwnAvatarProfile('url', cfg.avatarUrl);
    });
    paintAvatarMode();

    const avPanel = document.createElement('div'); avPanel.className = 'fcm-avatar-options';
    avPanel.style.cssText = 'display:none;margin:0 0 4px 0;padding:10px 14px;background:#1a1030;border-radius:8px;border:1px solid #3a2870;flex-direction:column;gap:8px;';
    const avStatus = document.createElement('div'); avStatus.className = 'fcm-reload-status'; avStatus.style.textAlign = 'center';
    setAvStatusEl(avStatus);

    const clearRow = document.createElement('div'); clearRow.style.cssText = 'display:flex;align-items:center;gap:10px;';
    const clearInfo = document.createElement('div'); clearInfo.style.flex = '1';
    const clearLbl = document.createElement('div'); clearLbl.style.cssText = 'color:#e8d4ff;font-size:13px;font-weight:600;'; clearLbl.textContent = T('btnClearAvatarCache');
    const clearNote = document.createElement('div'); clearNote.className = 'fcm-set-note'; clearNote.textContent = T('clearAvatarCacheNote');
    clearInfo.appendChild(clearLbl); clearInfo.appendChild(clearNote);
    const clearExecBtn = document.createElement('button'); clearExecBtn.className = 'fcm-btn fcm-btn-red';
    clearExecBtn.textContent = T('btnClear'); clearExecBtn.style.cssText = 'flex-shrink:0;padding:5px 12px;';
    clearExecBtn.addEventListener('click', async () => {
        clearExecBtn.disabled = true; clearExecBtn.textContent = T('btnClearing');
        await Snapshot.clear(); renderCurrent();
        avStatus.textContent = T('avCacheCleared');
        clearExecBtn.disabled = false; clearExecBtn.textContent = T('btnClear');
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
        const friendMns = [];
        for (const f of buildFriendList()) if (!await Snapshot.get(f.mn)) friendMns.push(f.mn);
        const total = friendMns.length;
        if (total === 0) { avStatus.textContent = T('noFriendsToLoad'); loadExecBtn.disabled = false; setTimeout(() => { avStatus.textContent = ''; }, 3000); return; }
        const waitMs = Math.min(30000, Math.max(5000, total * 150));
        await PDB.batchGet(friendMns);
        for (const mn of friendMns) {
            const p = _pc[mn]; if (!p || !p.characterBundle) continue;
            try { const data = JSON.parse(p.characterBundle); if (typeof CharacterLoadOnline === 'function') { const C = CharacterLoadOnline(data, mn); if (C && typeof CharacterRefresh === 'function') CharacterRefresh(C, false, undefined); } } catch {}
            await new Promise(r => setTimeout(r, 20));
        }
        let remaining = waitMs;
        const tick = setInterval(() => { remaining -= 1000; avStatus.textContent = remaining > 0 ? T('avWaitLeft', (remaining/1000).toFixed(0)) : T('avSnapshotting'); }, 1000);
        avStatus.textContent = T('avWait', (waitMs/1000).toFixed(0));
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
    detectWCESave().then(wceOn => { if (wceOn) { wceTag.className = 'fcm-wce-tag fcm-wce-tag-yes'; wceTag.textContent = T('wceTagDetected'); wceTag.style.display = 'inline-block'; } });
    smInfo.appendChild(wceTag);
    const smSel = document.createElement('select'); smSel.className = 'fcm-sel'; smSel.style.flexShrink = '0';
    [['off', T('saveModeOff')], ['name', T('saveModeName')], ['avatar', T('saveModeAvatar')], ['full', T('saveModeFull')]].forEach(([v, l]) => {
        const o = document.createElement('option'); o.value = v; o.textContent = l; if (v === (cfg.saveMode||'off')) o.selected = true; smSel.appendChild(o);
    });
    const smDesc = document.createElement('div'); smDesc.className = 'fcm-set-note'; smDesc.style.flexBasis = '100%';
    const updateSmDesc = () => { smDesc.textContent = T('saveModeDesc_' + (smSel.value || 'off')); };
    updateSmDesc();
    smSel.addEventListener('change', () => { cfg.saveMode = smSel.value; saveCfg(); updateSmDesc(); });
    smInfo.appendChild(smDesc);

    const manageProfilesBtn = document.createElement('button'); manageProfilesBtn.className = 'fcm-btn';
    manageProfilesBtn.textContent = T('manageProfiles'); manageProfilesBtn.style.cssText = 'padding:6px 11px;flex-shrink:0;';
    smRow.appendChild(smInfo); smRow.appendChild(manageProfilesBtn); smRow.appendChild(smSel);
    wrap.appendChild(smRow);

    // Export / Import — placed directly under Save Mode
    const exportRow = document.createElement('div'); exportRow.style.cssText = 'display:none;gap:8px;flex-wrap:wrap;margin-top:6px;';
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
    manageProfilesBtn.addEventListener('click', () => {
        const open = exportRow.style.display !== 'flex'; exportRow.style.display = open ? 'flex' : 'none';
        manageProfilesBtn.classList.toggle('active', open);
    });

    // ══════════════════════════════════════════
    //  GROUP B: communication foundation
    // ══════════════════════════════════════════
    sectionHeader(T('setSecCommunication'), 'communication');
    wrap.appendChild(settingRow(T('communicationEnabled'), T('communicationEnabledNote'), cfg.communicationEnabled, v => { cfg.communicationEnabled = v; saveCfg(); refreshChatSettings(); }));
    divider();
    wrap.appendChild(settingRow(T('takeoverChatButtons'), T('takeoverChatButtonsNote'), cfg.takeoverFcmChatButtons, v => { cfg.takeoverFcmChatButtons = v; saveCfg(); }));
    divider();
    wrap.appendChild(balloonSelectRow(T('persistentBalloon'), T('persistentBalloonNote'), 'balloonPlacement', 'persistentBalloon'));
    divider();
    wrap.appendChild(balloonSelectRow(T('individualBalloons'), T('individualBalloonsNote'), 'userBalloonPlacement', 'individualBalloons'));
    divider();
    wrap.appendChild(settingRow(T('balloonSnap'), T('balloonSnapNote'), cfg.balloonSnap, v => { cfg.balloonSnap = v; saveCfg(); }));
    divider();
    wrap.appendChild(settingRow(T('notificationAnimation'), T('notificationAnimationNote'), cfg.notificationAnimation, v => { cfg.notificationAnimation = v; saveCfg(); }));
    divider();
    const soundRow = document.createElement('div'); soundRow.className = 'fcm-set-row'; soundRow.style.alignItems = 'center';
    const soundInfo = document.createElement('div'); soundInfo.style.flex = '1';
    const soundLabel = document.createElement('div'); soundLabel.className = 'fcm-set-label'; soundLabel.textContent = T('notificationSound');
    soundInfo.appendChild(soundLabel);
    const soundSelect = document.createElement('select'); soundSelect.className = 'fcm-sel';
    [['', T('off')], ['Audio/BeepAlarm.mp3', 'BeepAlarm'], ['Audio/BellMedium.mp3', 'BellMedium'], ['Audio/Belt1.mp3', 'Belt1'], ['Audio/VibrationTone4ShortLoop.mp3', 'VibrationTone4ShortLoop'], ['custom', T('chatSoundCustom')]].forEach(([value, label]) => {
        const o = document.createElement('option'); o.value = value; o.textContent = label; o.selected = (!cfg.notificationAudio && !value) || (cfg.notificationAudio && cfg.notificationSound === value); soundSelect.appendChild(o);
    });
    const soundFile = document.createElement('input'); soundFile.type = 'file'; soundFile.accept = 'audio/*'; soundFile.hidden = true;
    const previewSound = document.createElement('button'); previewSound.className = 'fcm-icon-btn fcm-sound-preview';
    const refreshSoundIcon = () => { const on = !!cfg.notificationAudio && !!cfg.notificationSound; previewSound.innerHTML = on ? ALARM_ACTIVE_ICON : ALARM_MUTED_ICON; previewSound.disabled = !on; };
    refreshSoundIcon(); previewSound.addEventListener('click', playNotificationSound);
    soundSelect.addEventListener('change', () => {
        if (soundSelect.value === 'custom') { soundSelect.value = cfg.notificationAudio ? (cfg.notificationSound || '') : ''; soundFile.click(); return; }
        cfg.notificationSound = soundSelect.value; cfg.notificationAudio = !!soundSelect.value; saveCfg(); refreshSoundIcon(); refreshChatSettings();
    });
    soundFile.addEventListener('change', async () => { if (await saveCustomNotificationSound(soundFile.files?.[0])) { soundSelect.value = 'custom'; refreshSoundIcon(); refreshChatSettings(); } });
    soundRow.appendChild(soundInfo); soundRow.appendChild(previewSound); soundRow.appendChild(soundSelect); soundRow.appendChild(soundFile); wrap.appendChild(soundRow);

    // ══════════════════════════════════════════
    //  GROUP B: 聊天室管理
    // ══════════════════════════════════════════
    sectionHeader(T('setSecChat'), 'chat');

    // ── Profile 關係人快速搜尋（置於聊天室管理最上方）──
    buildProfileRelSetting();
    divider();

    // ── Whisper Indicator (color) ─────────────
    const wiWrap = document.createElement('div');
    const wiToggleRow = document.createElement('div'); wiToggleRow.style.cssText = 'display:flex;align-items:center;gap:14px;';
    const wiTog = mkToggle(cfg.whisperIndicator, v => { cfg.whisperIndicator = v; saveCfg(); _applyWhisperStyle(); });
    wiTog.style.flexShrink = '0';
    const wiInfo = document.createElement('div'); wiInfo.style.flex = '1';
    const wiLbl = document.createElement('div'); wiLbl.className = 'fcm-set-label'; wiLbl.textContent = T('whisperIndicatorLabel');
    const wiNote = document.createElement('div'); wiNote.className = 'fcm-set-note'; wiNote.textContent = T('whisperIndicatorNote');
    wiInfo.appendChild(wiLbl); wiInfo.appendChild(wiNote);
    const wiColorLabelBtn = document.createElement('span');
    wiColorLabelBtn.className = 'fcm-color-edit-label';
    wiColorLabelBtn.style.cssText = 'font-size:11px;color:#a080c8;white-space:nowrap;flex-shrink:0;cursor:pointer;';
    wiColorLabelBtn.textContent = T('colorEditLabel');
    const wiColorBtn = document.createElement('button');
    wiColorBtn.className = 'fcm-color-button';
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
    wiToggleRow.appendChild(wiInfo); wiToggleRow.appendChild(wiColorLabelBtn); wiToggleRow.appendChild(wiColorBtn); wiToggleRow.appendChild(wiTog);
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
    wrap.appendChild(settingRow(T('ghostHideLabel'), T('ghostHideNote'), cfg.ghostHide, v => { cfg.ghostHide = v; saveCfg(); }));

    // Profile 關係人快速搜尋：本體以 buildProfileRelSetting() 建立、於「聊天室管理」最上方呼叫（函式宣告會提升）
    function buildProfileRelSetting() {
    // 底線染色（邏輯與私聊/BEEP 提示色相同）：預設紫色，可選無色
    const PRC_DEFAULT = '#8868c0';
    const prRow = settingRow(T('profileRelLabel'), T('profileRelNote'), cfg.profileRelations, v => {
        cfg.profileRelations = v; saveCfg();
    });
    const prcColorLabelBtn = document.createElement('span');
    prcColorLabelBtn.className = 'fcm-color-edit-label';
    prcColorLabelBtn.style.cssText = 'font-size:11px;color:#a080c8;white-space:nowrap;flex-shrink:0;cursor:pointer;margin-left:auto;';
    prcColorLabelBtn.textContent = T('colorEditLabel');   // 與私聊提示色共用「修改顏色」字串
    const _prcSwatchBg = c => c
        ? c
        : `#2a2048 linear-gradient(45deg, transparent 46%, #ff4040 46%, #ff4040 54%, transparent 54%)`;
    const prcColorBtn = document.createElement('button');
    prcColorBtn.className = 'fcm-color-button';
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
    const prToggle = prRow.querySelector('.fcm-tog');
    prRow.insertBefore(prcColorLabelBtn, prToggle); prRow.insertBefore(prcColorBtn, prToggle);
    wrap.appendChild(prRow);
    wrap.appendChild(prcColorPanel);
    }   // end buildProfileRelSetting

    container.appendChild(wrap);
}

export { renderSettings };

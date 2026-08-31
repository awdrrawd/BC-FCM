// ════════════════════════════════════════
//  FCM module: config.js
//  (split from Plugins/liko-FCM.user.js)
// ════════════════════════════════════════

import { MOD_VER } from './version.js';

    const existingFcmMod = bcModSdk.getModsInfo?.().find(mod => mod.name === 'Liko - FCM');
    if (existingFcmMod) {
        console.warn('🐈‍⬛ [FCM] Already registered with Mod SDK, aborting duplicate init.');
        throw new Error('[FCM] Duplicate Mod SDK registration prevented.');
    }

    const modApi = bcModSdk.registerMod({
            name: 'Liko - FCM', fullName: 'Friends and ChatRoom Manager', version: MOD_VER, repository: "https://github.com/awdrrawd/BC-FCM"
        }, { allowReplace: false });
    const BTN_X = 955, BTN_Y = 455, BTN_W = 45, BTN_H = 45;
    // ── FCM icon (SVG → preloaded Image for DrawImageResize) ──────

    const FCM_ICON_SVG = `<svg version="1.2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 90 90" width="90" height="90">
		<style> .s0 { fill: #ffffff } .s1 { fill: #010101 } .s2 { fill: #ffe5d9 } </style>
		<g id="图层 2 copy">
			<path id="Path 0" fill-rule="evenodd" class="s0" d="m-10.61-1.21h116.67v92.42h-116.67zm10.61 91.21h90v-90h-90z"/>
			<path id="Path 1" class="s1" d="m3.11 19.4c-0.55 0.33-1.19 1.01-1.44 1.51-0.38 0.76-0.46 2.86-0.46 13.03 0 9.64 0.09 12.29 0.42 12.95 0.22 0.46 0.8 1.18 1.29 1.59 0.48 0.42 2.98 1.63 5.57 2.69 2.58 1.06 5.35 2.43 6.16 3.03 1.28 0.96 1.45 1.2 1.27 1.86-0.12 0.42-0.29 1.3-0.38 1.97-0.09 0.67-0.01 1.69 0.17 2.27 0.19 0.59 0.76 1.47 1.28 1.97 0.53 0.5 1.65 1.14 2.51 1.42 1.35 0.44 1.6 0.65 1.82 1.52 0.14 0.55 0.49 1.34 0.79 1.76 0.29 0.42 1.06 1.01 1.71 1.33 0.65 0.31 1.73 0.65 2.39 0.76 0.88 0.15 1.24 0.36 1.32 0.8 0.06 0.33 0.47 1.06 0.91 1.64 0.44 0.57 1.35 1.28 2.01 1.58 0.67 0.3 1.66 0.55 2.2 0.55 0.79 0.01 1.05 0.17 1.31 0.84 0.18 0.46 0.62 1.16 0.98 1.55 0.37 0.4 1.21 0.98 1.88 1.29 0.66 0.3 1.59 0.56 2.04 0.56 0.46 0.01 1.35-0.2 1.97-0.46 0.63-0.26 1.52-0.84 1.97-1.29l0.84-0.82c1.29 1.07 2.21 1.65 2.88 1.97 0.66 0.33 1.62 0.6 2.12 0.6 0.5 0 1.45-0.27 2.12-0.59 0.66-0.32 1.5-0.83 1.86-1.13 0.36-0.3 0.86-1.02 1.11-1.6 0.46-1.05 0.48-1.06 2.08-0.95 1.21 0.08 1.94-0.05 2.9-0.53 0.71-0.36 1.59-1.09 1.95-1.63 0.37-0.54 0.75-1.33 0.86-1.74 0.14-0.57 0.41-0.78 1.08-0.84 0.48-0.04 1.33-0.15 1.87-0.23 0.54-0.08 1.48-0.59 2.09-1.13 0.61-0.54 1.3-1.43 1.52-1.97 0.22-0.54 0.4-1.29 0.4-1.67 0-0.53 0.28-0.77 1.29-1.09 0.71-0.22 1.63-0.64 2.05-0.93 0.41-0.29 1.08-1.2 1.48-2.02 0.61-1.23 0.7-1.75 0.53-3l-0.2-1.52c3.41-1.6 5.56-2.61 6.98-3.26 1.41-0.66 3.32-1.53 4.24-1.94 0.92-0.41 1.98-1.04 2.38-1.41 0.39-0.36 0.9-1.03 1.13-1.49 0.35-0.68 0.43-3.15 0.43-13.03 0-11.66-0.03-12.24-0.61-13.19-0.33-0.54-0.91-1.14-1.29-1.33-0.58-0.29-1.17-0.13-4.01 1.11-1.83 0.8-4.49 1.99-5.91 2.65-1.42 0.66-3.8 1.73-5.3 2.37-2.22 0.95-3.1 1.18-4.7 1.19-1.51 0.01-3.17-0.35-7.12-1.52-2.83-0.84-5.9-1.61-6.82-1.71-0.92-0.1-2.42-0.02-3.33 0.17-0.92 0.2-2.28 0.64-3.03 0.99-1.19 0.55-1.54 0.59-2.65 0.29-0.71-0.19-2.21-0.34-3.34-0.34-1.12 0-4.02 0.36-6.44 0.79-3.36 0.6-5.06 0.75-7.27 0.65-2.77-0.12-3.1-0.21-8.64-2.49-3.16-1.3-7.22-2.96-9.01-3.69-1.79-0.73-3.7-1.32-4.24-1.32-0.55 0-1.43 0.27-1.97 0.61z"/>
			<path id="Path 2" fill-rule="evenodd" class="s2" d="m5.21 21.82c0.3 0 2.22 0.67 4.26 1.49 2.04 0.83 5.76 2.34 8.26 3.36 2.5 1.02 5.43 2.05 6.51 2.29 1.09 0.23 2.65 0.43 3.49 0.43 0.83 0 3.97-0.41 6.97-0.92 3-0.51 5.72-0.88 6.05-0.83 0.48 0.07 0.28 0.3-0.9 1.06-0.84 0.53-1.94 1.41-2.47 1.96-0.52 0.56-2.12 3.19-3.55 5.86-1.81 3.37-2.6 5.17-2.61 5.9-0.01 0.59 0.19 1.37 0.44 1.75 0.26 0.37 1.21 0.95 2.13 1.28 0.91 0.34 2.04 0.61 2.5 0.61 0.46 0.01 1.58-0.22 2.5-0.49 0.91-0.27 2.24-0.88 2.95-1.36 0.71-0.48 1.87-1.64 2.58-2.56 0.92-1.21 1.58-1.77 2.35-1.98 0.58-0.15 1.53-0.37 2.12-0.48 1.03-0.19 1.35 0.04 11.06 7.96 5.5 4.48 10.23 8.42 10.52 8.76 0.28 0.33 0.52 1.12 0.53 1.74 0.01 0.9-0.17 1.27-0.82 1.75-0.46 0.34-1.14 0.62-1.52 0.61-0.37-0.01-0.92-0.13-1.21-0.28-0.29-0.15-2.78-2.13-5.53-4.4-2.84-2.34-5.27-4.12-5.62-4.12-0.34 0-0.79 0.17-0.99 0.38-0.21 0.21-0.37 0.69-0.37 1.06 0.01 0.48 0.75 1.3 2.51 2.77 1.37 1.15 3.76 3.13 5.3 4.4 2.69 2.2 2.8 2.35 2.8 3.51q0 1.22-0.6 1.82c-0.33 0.33-0.98 0.69-1.44 0.78q-0.83 0.17-1.59-0.36c-0.42-0.3-2.63-2.08-4.93-3.96-2.63-2.17-4.42-3.43-4.86-3.43-0.38 0-0.86 0.17-1.07 0.38-0.2 0.21-0.38 0.67-0.4 1.04-0.02 0.48 0.85 1.37 3.42 3.45 1.89 1.54 3.75 3.12 4.13 3.51 0.39 0.41 0.68 1.09 0.68 1.62 0 0.53-0.29 1.22-0.68 1.64-0.38 0.41-0.96 0.82-1.29 0.91-0.34 0.1-1.05-0.06-1.58-0.35-0.54-0.29-2.35-1.66-4.02-3.03-1.67-1.38-3.28-2.5-3.58-2.5-0.3 0-0.72 0.17-0.92 0.38-0.2 0.21-0.36 0.72-0.36 1.13 0 0.57 0.6 1.26 2.43 2.81 2.18 1.83 2.42 2.15 2.42 3.1q0.01 1.07-0.74 1.82c-0.44 0.44-1.1 0.76-1.59 0.77-0.47 0-1.42-0.4-2.14-0.91-1.27-0.91-1.28-0.93-1.09-2.36 0.12-0.9 0.04-1.89-0.22-2.65-0.22-0.67-0.75-1.6-1.17-2.07-0.43-0.46-1.18-0.98-1.68-1.13-0.89-0.28-0.91-0.34-0.91-2.2 0-1.67-0.12-2.07-0.91-3.09-0.5-0.65-1.46-1.42-2.12-1.71-0.67-0.3-1.59-0.55-2.05-0.55-0.69-0.01-0.89-0.2-1.2-1.14-0.2-0.63-0.81-1.58-1.36-2.13-0.55-0.54-1.58-1.13-2.29-1.32-1.05-0.27-1.59-0.23-2.95 0.19-0.92 0.29-1.7 0.41-1.73 0.26-0.04-0.14-0.32-0.6-0.64-1.02-0.31-0.42-1.06-1-1.67-1.29-0.61-0.29-1.66-0.53-2.33-0.53-0.66 0-1.51 0.16-1.89 0.34-0.37 0.19-1.05 0.7-2.33 1.93l-1.22-1.13c-0.67-0.63-1.6-1.33-2.06-1.56-0.45-0.24-2.87-1.26-5.37-2.29-2.6-1.06-4.78-2.15-5.09-2.53-0.5-0.61-0.55-1.6-0.59-12.05-0.04-9.42 0.02-11.44 0.37-11.74 0.24-0.2 0.67-0.36 0.97-0.36zm80.4 1.03c0.19 0.05 0.33 4.18 0.38 11.42 0.07 8.81 0 11.46-0.3 11.87-0.21 0.3-2.77 1.64-5.69 2.98-2.92 1.34-5.98 2.76-8.33 3.85l-3.94-3.19c-2.17-1.75-3.98-3.3-4.02-3.45-0.04-0.15 0.41-0.27 1-0.27 0.75 0 1.3-0.23 1.82-0.76 0.67-0.68 0.7-0.82 0.32-1.44-0.38-0.61-0.62-0.67-2.5-0.58-1.14 0.05-2.69-0.05-3.44-0.23-0.75-0.18-2.18-0.89-3.18-1.58-1-0.69-2.98-2.22-4.4-3.39-2.52-2.09-2.6-2.13-3.94-1.95-0.75 0.09-2.35 0.46-3.56 0.81-2.03 0.59-2.28 0.76-3.35 2.23-0.64 0.87-1.56 1.93-2.05 2.36-0.49 0.42-1.43 0.95-2.1 1.17-0.72 0.25-1.76 0.34-2.57 0.23-0.75-0.1-1.43-0.27-1.52-0.37-0.08-0.1 0.79-1.98 1.94-4.18 1.15-2.19 2.45-4.52 2.88-5.17 0.62-0.93 1.71-1.7 5.03-3.56 2.33-1.31 4.72-2.52 5.3-2.68 0.59-0.17 1.75-0.3 2.58-0.3 0.94-0.01 3.73 0.63 7.35 1.66 3.77 1.08 6.39 1.67 7.42 1.67 0.88-0.01 2.28-0.19 3.11-0.42 0.83-0.23 3.08-1.12 5-1.98 1.92-0.86 4.3-1.93 5.29-2.39 0.99-0.45 2.56-1.18 3.49-1.62 0.92-0.45 1.81-0.78 1.98-0.74zm-44.85 1.79c1.16 0.01 1.57 0.06 0.91 0.13-0.67 0.06-1.62 0.06-2.12-0.01-0.5-0.06 0.04-0.12 1.21-0.12zm-18.32 29.61c0.58 0 1.29 0.24 1.59 0.53 0.31 0.31 0.54 0.96 0.53 1.58 0 0.74-0.32 1.5-1.07 2.5-0.58 0.8-1.34 1.58-1.67 1.75-0.34 0.16-0.91 0.3-1.29 0.31-0.37 0-0.99-0.27-1.36-0.61-0.51-0.46-0.67-0.9-0.62-1.76 0.05-0.89 0.38-1.52 1.46-2.73 1.18-1.33 1.56-1.58 2.43-1.57zm8.24 2.15c0.29-0.02 0.87 0.3 1.29 0.72 0.47 0.47 0.76 1.1 0.76 1.67 0 0.64-0.46 1.47-1.53 2.8-0.84 1.04-2.1 2.48-2.8 3.2-0.91 0.92-1.52 1.29-2.11 1.28-0.47 0-1.16-0.34-1.59-0.77-0.42-0.41-0.76-1.06-0.76-1.44 0-0.37 0.24-1.03 0.53-1.45 0.29-0.43 1.45-1.88 2.58-3.24 1.12-1.35 2.28-2.52 2.57-2.6 0.29-0.07 0.77-0.15 1.06-0.17zm5.85 4.82c0.51 0 1.19 0.3 1.58 0.68 0.45 0.43 0.69 1.03 0.69 1.66-0.01 0.78-0.49 1.55-2.36 3.75-1.29 1.53-2.59 2.89-2.88 3.03-0.29 0.15-0.77 0.27-1.06 0.28-0.29 0-0.91-0.27-1.36-0.61-0.64-0.47-0.84-0.87-0.84-1.68 0-0.78 0.31-1.44 1.17-2.5 0.64-0.79 1.84-2.15 2.67-3.03 1.16-1.22 1.71-1.59 2.39-1.58zm4.08 6.97c0.25-0.02 0.83 0.25 1.28 0.59 0.67 0.49 0.84 0.86 0.84 1.83 0 1.03-0.22 1.43-1.44 2.72q-1.44 1.5-2.2 1.52c-0.42 0.01-1.13-0.26-1.59-0.6-0.63-0.47-0.83-0.87-0.83-1.67 0-0.79 0.29-1.41 1.13-2.4 0.63-0.73 1.41-1.47 1.75-1.64 0.33-0.18 0.81-0.33 1.06-0.35z"/>
		</g></svg>`;
    let _fcmIconImg = null;
    (() => {
        const blob = new Blob([FCM_ICON_SVG], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => { _fcmIconImg = img; URL.revokeObjectURL(url); };
        img.onerror = () => { URL.revokeObjectURL(url); };
        img.src = url;
    })();
    // ═══════════════════════════════════════════════════════════
    //  SETTINGS
    // ═══════════════════════════════════════════════════════════
    // 主題顏色預設值（＝原本精心調校的深紫配色）；三者皆為預設時不套用覆蓋、保留原生外觀
    const THEME_DEFAULTS = { panelColor: '#1a1821', fontColor: '#f1ecff', accentColor: '#7648fe' };
    let cfg = {
        avatars: false, lang: 'auto', saveMode: 'off',
        favorites: [],                // 關注的成員編號（個人關係頁星號）
        favoriteRooms: [],
        whisperIndicator: false, whisperColor: '#b070e8',
        ghostHide: false,
        whisperAvatar: false,
        oocProtect: false,
        btnShowChatRoom: true,
        btnShowMainHall: true,
        btnShowProfile: true,
        profileRelations: false,
        profileRelColor: '#8868c0',   // Profile 關係人快速搜尋：底線顏色（null = 無色/不畫底線）
        // ── 主題顏色（面板底色 / 字體顏色 / 強調色）──
        panelColor: THEME_DEFAULTS.panelColor,
        fontColor: THEME_DEFAULTS.fontColor,
        accentColor: THEME_DEFAULTS.accentColor,
        themePreset: 'violet',
        avatarMode: 'game',
        avatarUrl: '',
        avatarShape: 'square',
        chatAvatarShape: 'square',
        chatGroups: {},
        chatMemberGroups: {},
        busyMessage: '',
        afkMessage: '',
        busyAutoReply: false,
        afkAutoReply: false,
        chatAvatarMode: 'follow',
        chatAvatarUrl: '',
        chatThemeMode: 'follow',
        chatThemePreset: 'violet',
        chatPanelColor: THEME_DEFAULTS.panelColor,
        chatFontColor: THEME_DEFAULTS.fontColor,
        chatAccentColor: THEME_DEFAULTS.accentColor,
        chatFontSize: 13,
        chatFontFamily: 'system',
        communicationEnabled: false,
        bypassBcxCommunication: false,
        persistentBalloon: false,
        balloonPlacement: 'off',
        takeoverFcmChatButtons: false,
        individualBalloons: false,
        userBalloonPlacement: 'off',
        balloonSnap: true,
        notificationAnimation: true,
        notificationAudio: true,
        notificationSound: 'Audio/BeepAlarm.mp3',
        chatLayout: 'split',
        chatPanelPosition: null,
        chatBalloonPosition: null,
        chatUserBalloonPositions: {},
        chatStatus: 'online',
        profileNickname: '',
        statusMessage: '',
    };
    function loadCfg() {
        try { const s = Player?.ExtensionSettings?.FCM?.settings; if (s && typeof s === 'object') Object.assign(cfg, s); } catch {}
        // Settings belong to the BC account. The former localStorage mirror was
        // shared by every account in the same browser and is intentionally not
        // migrated because its owner cannot be identified safely.
        if (Player?.MemberNumber) { try { localStorage.removeItem('LikoFCM'); } catch {} }
        // Migrate the former built-in purple defaults; intentional custom colors are untouched.
        if (cfg.panelColor === '#1e1635' && cfg.fontColor === '#f0e4ff' && cfg.accentColor === '#a078e8') {
            Object.assign(cfg, THEME_DEFAULTS, { themePreset: 'violet' });
        }
        if (!['round', 'square'].includes(cfg.avatarShape)) cfg.avatarShape = 'square';
        if (!['round', 'square'].includes(cfg.chatAvatarShape)) cfg.chatAvatarShape = 'square';
        cfg.chatFontSize = Math.max(10, Math.min(24, Number(cfg.chatFontSize) || 13));
        if (!['system', 'heiti', 'ming', 'kai', 'mono', 'jhenghei', 'yahei', 'pmingliu', 'mingliu', 'dfkai', 'notoSansTC', 'notoSerifTC', 'sourceHanSans', 'sourceHanSerif'].includes(cfg.chatFontFamily)) cfg.chatFontFamily = 'system';
        const placements = ['off', 'top-left', 'middle-left', 'bottom-left', 'top-right', 'middle-right', 'bottom-right'];
        // Boolean settings from older versions map to the former bottom-right default.
        if (!placements.includes(cfg.balloonPlacement) || (cfg.balloonPlacement === 'off' && cfg.persistentBalloon)) cfg.balloonPlacement = cfg.persistentBalloon ? 'bottom-right' : 'off';
        if (!placements.includes(cfg.userBalloonPlacement) || (cfg.userBalloonPlacement === 'off' && cfg.individualBalloons)) cfg.userBalloonPlacement = cfg.individualBalloons ? 'bottom-right' : 'off';
        cfg.persistentBalloon = cfg.balloonPlacement !== 'off';
        cfg.individualBalloons = cfg.userBalloonPlacement !== 'off';
        // BrushHair4 音效已移除；曾選用它的使用者改回預設提示音，避免播放失敗的靜音狀態。
        if (cfg.notificationSound === 'Audio/BrushHair4.mp3') cfg.notificationSound = 'Audio/BeepAlarm.mp3';
    }
    function saveCfg() {
        try {
            Player.ExtensionSettings ??= {};
            Player.ExtensionSettings.FCM ??= {};
            Player.ExtensionSettings.FCM.settings = { ...cfg };
            if (typeof globalThis.ServerPlayerExtensionSettingsSync === 'function') globalThis.ServerPlayerExtensionSettingsSync('FCM');
        } catch {}
    }

export { MOD_VER, modApi, BTN_X, BTN_Y, BTN_W, BTN_H, FCM_ICON_SVG, _fcmIconImg, cfg, loadCfg, saveCfg, THEME_DEFAULTS };

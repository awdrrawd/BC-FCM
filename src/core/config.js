// ════════════════════════════════════════
//  FCM module: config.js
//  (split from Plugins/liko-FCM.user.js)
// ════════════════════════════════════════

import { MOD_VER } from './version.js';
import { warnLimited } from './logger.js';

    const existingFcmMod = bcModSdk.getModsInfo?.().find(mod => mod.name === 'Liko - FCM');
    if (existingFcmMod) {
        console.warn('🐈‍⬛ [FCM] Already registered with Mod SDK, aborting duplicate init.');
        throw new Error('[FCM] Duplicate Mod SDK registration prevented.');
    }

    const modApi = bcModSdk.registerMod({
            name: 'Liko - FCM', fullName: 'Friends and ChatRoom Manager', version: MOD_VER, repository: "https://github.com/awdrrawd/BC-FCM"
        }, { allowReplace: false });
    const BTN_X = 955, BTN_Y = 455, BTN_W = 45, BTN_H = 45;
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
        try { const s = Player?.ExtensionSettings?.FCM?.settings; if (s && typeof s === 'object') Object.assign(cfg, s); } catch (error) { warnLimited('settings load failed', error); }
        // Settings belong to the BC account. The former localStorage mirror was
        // shared by every account in the same browser and is intentionally not
        // migrated because its owner cannot be identified safely.
        if (Player?.MemberNumber) { try { localStorage.removeItem('LikoFCM'); } catch (error) { warnLimited('legacy settings cleanup failed', error); } }
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
        } catch (error) { warnLimited('settings sync failed', error); }
    }

export { MOD_VER, modApi, BTN_X, BTN_Y, BTN_W, BTN_H, cfg, loadCfg, saveCfg, THEME_DEFAULTS };

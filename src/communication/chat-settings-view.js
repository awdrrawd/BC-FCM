import { cfg } from '../core/config.js';
import { THEME_KEYS } from '../core/themes.js';
import { FCM_LANGS, FCM_LANG_FLAGS, FCM_LANG_NAMES, T, TH } from '../i18n/i18n.js';
import { ALARM_ACTIVE_ICON, ALARM_MUTED_ICON } from '../ui/icons.js';
import { hasCustomNotificationSound } from './chat-audio.js';
import { availableFontChoices } from './chat-font.js';
import { esc } from './chat-content.js';

function selectOptions(options, current) {
    return options.map(([value, label]) => `<option value="${esc(value)}" ${current === value ? 'selected' : ''}>${esc(label)}</option>`).join('');
}

function placementOptions(current) {
    return selectOptions([
        ['off', T('balloonOff')], ['top-left', `⬉ ${T('balloonTopLeft')}`], ['middle-left', `⭠ ${T('balloonMiddleLeft')}`],
        ['bottom-left', `⬋ ${T('balloonBottomLeft')}`], ['top-right', `⬈ ${T('balloonTopRight')}`], ['middle-right', `⭢ ${T('balloonMiddleRight')}`],
        ['bottom-right', `⬊ ${T('balloonBottomRight')}`],
    ], current);
}

function settingsHtml() {
    const languageOptions = FCM_LANGS.map(value => `<option value="${esc(value)}" ${String(cfg.lang || 'auto').toLowerCase() === value.toLowerCase() ? 'selected' : ''}>${esc(FCM_LANG_FLAGS[value] || '')} ${esc(FCM_LANG_NAMES[value] || value)}</option>`).join('');
    const sounds = [['', T('off')], ['Audio/BeepAlarm.mp3', 'BeepAlarm'], ['Audio/BellMedium.mp3', 'BellMedium'], ['Audio/Belt1.mp3', 'Belt1'], ['Audio/VibrationTone4ShortLoop.mp3', 'VibrationTone4ShortLoop'], ['custom', T('chatSoundCustom')]];
    const soundEnabled = !!cfg.notificationAudio && !!cfg.notificationSound && (cfg.notificationSound !== 'custom' || hasCustomNotificationSound());
    const currentThemeName = cfg.chatThemeMode === 'follow' ? T('chatThemeFollow') : cfg.chatThemeMode === 'custom' ? T('themeCustom') : T(`themePreset_${cfg.chatThemePreset || 'violet'}`);
    const fontFamilies = availableFontChoices();
    return `<div class="fcm-chat-settings fcm-set-like">
        <div class="fcm-chat-setting-row"><span><b>${TH('langLabel')}</b></span><select class="fcm-chat-language" data-chat-language>${languageOptions}</select></div>
        <div class="fcm-chat-setting-row"><span><b>${TH('themeSettingsLabel')}</b><small>${TH('chatThemeNote')}</small></span><button class="fcm-chat-theme-manage" data-chat-theme-manage>${TH('themeSettingsLabel')} · ${esc(currentThemeName)}</button></div>
        <div class="fcm-chat-theme-options" data-chat-theme-options hidden><div class="fcm-chat-theme-presets"><button class="${cfg.chatThemeMode === 'follow' ? 'active' : ''}" data-chat-theme-follow>${TH('chatThemeFollow')}</button>${THEME_KEYS.map(value => `<button class="${cfg.chatThemeMode === 'preset' && cfg.chatThemePreset === value ? 'active' : ''}" data-chat-theme-preset="${value}">${TH(`themePreset_${value}`)}</button>`).join('')}</div><div class="fcm-chat-theme-colors"><label>${TH('themePanelColor')}<input type="color" data-chat-theme-color="chatPanelColor" value="${esc(cfg.chatPanelColor)}"></label><label>${TH('themeFontColor')}<input type="color" data-chat-theme-color="chatFontColor" value="${esc(cfg.chatFontColor)}"></label><label>${TH('themeAccentColor')}<input type="color" data-chat-theme-color="chatAccentColor" value="${esc(cfg.chatAccentColor)}"></label></div></div>
        <div class="fcm-chat-setting-row"><span><b>${TH('chatFontFamily')}</b><small>${TH('chatFontFamilyNote')}</small></span><div class="fcm-chat-font-controls"><input data-chat-font-size type="number" min="10" max="24" step="1" value="${Number(cfg.chatFontSize) || 13}" title="${TH('chatFontSize')}"><select data-chat-font-family>${selectOptions(fontFamilies, cfg.chatFontFamily)}</select></div></div>
        <div class="fcm-chat-setting-row"><span><b>${TH('chatTakeover')}</b><small>${TH('chatTakeoverNote')}</small></span><button class="fcm-chat-switch ${cfg.takeoverFcmChatButtons ? 'on' : ''}" data-setting="takeover"><i></i></button></div>
        <div class="fcm-chat-setting-row"><span><b>${TH('bypassBcxCommunication')}</b><small>${TH('bypassBcxCommunicationNote')}</small></span><button class="fcm-chat-switch ${cfg.bypassBcxCommunication ? 'on' : ''}" data-setting="bcxBypass"><i></i></button></div>
        <div class="fcm-chat-setting-row"><span><b>${TH('chatPersistentBalloon')}</b><small>${TH('chatPersistentBalloonNote')}</small></span><select data-balloon-placement>${placementOptions(cfg.balloonPlacement)}</select></div>
        <div class="fcm-chat-setting-row"><span><b>${TH('chatIndividualBalloons')}</b><small>${TH('chatIndividualBalloonsNote')}</small></span><select data-user-balloon-placement>${placementOptions(cfg.userBalloonPlacement)}</select></div>
        <div class="fcm-chat-setting-row"><span><b>${TH('balloonSnap')}</b><small>${TH('balloonSnapNote')}</small></span><button class="fcm-chat-switch ${cfg.balloonSnap ? 'on' : ''}" data-setting="balloonSnap"><i></i></button></div>
        <div class="fcm-chat-setting-row"><span><b>${TH('chatNotifyAnim')}</b><small>${TH('chatNotifyAnimNote')}</small></span><button class="fcm-chat-switch ${cfg.notificationAnimation ? 'on' : ''}" data-setting="animation"><i></i></button></div>
        <div class="fcm-chat-setting-row"><span><b>${TH('chatSoundLabel')}</b><small>${TH('chatSoundNote')}</small></span><div class="fcm-chat-sound-control"><button data-preview-sound ${soundEnabled ? '' : 'disabled'}>${soundEnabled ? ALARM_ACTIVE_ICON : ALARM_MUTED_ICON}</button><select data-chat-sound>${sounds.map(([value, label]) => `<option value="${esc(value)}" ${(!cfg.notificationAudio && !value) || (cfg.notificationAudio && cfg.notificationSound === value) ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select><input data-custom-sound type="file" accept="audio/*" hidden></div></div>
        <div class="fcm-chat-setting-row"><span><b>${TH('chatAvatarShapeLabel')}</b><small>${TH('chatAvatarShapeNote')}</small></span><select data-chat-avatar-shape><option value="round" ${cfg.chatAvatarShape === 'round' ? 'selected' : ''}>${TH('chatAvatarShapeRound')}</option><option value="square" ${cfg.chatAvatarShape !== 'round' ? 'selected' : ''}>${TH('chatAvatarShapeSquare')}</option></select></div>
        <div class="fcm-chat-setting-row"><span><b>${TH('chatAvatarSourceLabel')}</b><small>${TH('chatAvatarSourceNote')}</small></span><select data-chat-avatar-mode><option value="follow" ${cfg.chatAvatarMode === 'follow' ? 'selected' : ''}>${TH('chatAvatarFollow')}</option><option value="url" ${cfg.chatAvatarMode === 'url' ? 'selected' : ''}>${TH('chatAvatarUrl')}</option><option value="game" ${cfg.chatAvatarMode === 'game' ? 'selected' : ''}>${TH('chatAvatarGame')}</option></select></div>
        <div class="fcm-chat-setting-row"><span><b>${TH('chatAvatarUrlLabel')}</b><small>${TH('chatAvatarUrlNote')}</small></span><input data-chat-avatar-url value="${esc(cfg.chatAvatarUrl || '')}" placeholder="https://…"></div>
    </div>`;
}

export { settingsHtml };

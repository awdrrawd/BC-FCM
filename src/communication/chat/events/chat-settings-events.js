import { cfg, saveCfg } from '../../../core/config.js';
import { T, ensureLang } from '../../../i18n/i18n.js';
import { applyTheme } from '../../../panel/styles.js';
import { hasCustomNotificationSound, playNotificationSound, saveCustomNotificationSound } from '../../chat-audio.js';

const TOGGLE_SETTING_KEYS = {
    takeover: 'takeoverFcmChatButtons',
    bcxBypass: 'bypassBcxCommunication',
    animation: 'notificationAnimation',
    balloonSnap: 'balloonSnap',
};

function bindChatSettingsEvents({ root, renderChat, refreshChatSettings, chatColors }) {
    const commit = (update, { refresh = false, render = true, applySharedTheme = false } = {}) => {
        update();
        saveCfg();
        if (refresh) refreshChatSettings();
        else if (render && root.style.display !== 'none') renderChat();
        if (applySharedTheme) applyTheme();
    };

    root.querySelectorAll('[data-setting]').forEach(button => button.addEventListener('click', () => {
        const key = TOGGLE_SETTING_KEYS[button.dataset.setting];
        if (key) commit(() => { cfg[key] = !cfg[key]; }, { refresh: true });
    }));
    root.querySelector('[data-balloon-placement]')?.addEventListener('change', event => {
        commit(() => { cfg.balloonPlacement = event.target.value; cfg.persistentBalloon = cfg.balloonPlacement !== 'off'; cfg.chatBalloonPosition = null; }, { refresh: true });
    });
    root.querySelector('[data-user-balloon-placement]')?.addEventListener('change', event => {
        commit(() => { cfg.userBalloonPlacement = event.target.value; cfg.individualBalloons = cfg.userBalloonPlacement !== 'off'; cfg.chatUserBalloonPositions = {}; }, { refresh: true });
    });
    root.querySelector('[data-chat-language]')?.addEventListener('change', async event => {
        cfg.lang = event.target.value; saveCfg(); await ensureLang(cfg.lang);
        window.dispatchEvent(new CustomEvent('fcm-language-change'));
    });
    root.querySelector('[data-chat-sound]')?.addEventListener('change', event => {
        const value = event.target.value;
        if (value === 'custom' && !hasCustomNotificationSound()) {
            event.target.value = cfg.notificationAudio ? (cfg.notificationSound || '') : '';
            root.querySelector('[data-custom-sound]')?.click();
            return;
        }
        commit(() => { cfg.notificationSound = value; cfg.notificationAudio = !!value; });
    });
    root.querySelector('[data-preview-sound]')?.addEventListener('click', playNotificationSound);
    root.querySelector('[data-custom-sound]')?.addEventListener('change', async event => {
        if (await saveCustomNotificationSound(event.target.files?.[0])) renderChat();
    });
    root.querySelector('[data-chat-avatar-shape]')?.addEventListener('change', event => commit(() => { cfg.chatAvatarShape = event.target.value; }, { refresh: true }));
    root.querySelector('[data-chat-theme-manage]')?.addEventListener('click', () => { const box = root.querySelector('[data-chat-theme-options]'); box.hidden = !box.hidden; });
    root.querySelector('[data-chat-theme-follow]')?.addEventListener('click', () => commit(() => { cfg.chatThemeMode = 'follow'; }, { refresh: true }));
    root.querySelectorAll('button[data-chat-theme-preset]').forEach(button => button.addEventListener('click', () => commit(() => { cfg.chatThemePreset = button.dataset.chatThemePreset; cfg.chatThemeMode = 'preset'; }, { refresh: true })));
    root.querySelectorAll('[data-chat-theme-color]').forEach(input => input.addEventListener('input', () => {
        cfg[input.dataset.chatThemeColor] = input.value;
        cfg.chatThemeMode = 'custom';
        saveCfg();
        refreshChatSettings();
        const [panelColor, textColor, accentColor] = chatColors();
        const panel = root.querySelector('#fcm-chat-panel');
        panel.style.setProperty('--s', panelColor);
        panel.style.setProperty('--tx', textColor);
        panel.style.setProperty('--ac', accentColor);
        const button = root.querySelector('[data-chat-theme-manage]');
        if (button) button.textContent = `${T('themeSettingsLabel')} · ${T('themeCustom')}`;
    }));
    root.querySelector('[data-chat-font-size]')?.addEventListener('change', event => commit(() => { cfg.chatFontSize = Math.max(10, Math.min(24, Number(event.target.value) || 13)); }, { applySharedTheme: true }));
    root.querySelector('[data-chat-font-family]')?.addEventListener('change', event => commit(() => { cfg.chatFontFamily = event.target.value; }, { applySharedTheme: true }));
    root.querySelector('[data-chat-avatar-mode]')?.addEventListener('change', event => commit(() => { cfg.chatAvatarMode = event.target.value; }));
    root.querySelector('[data-chat-avatar-url]')?.addEventListener('change', event => commit(() => { cfg.chatAvatarUrl = event.target.value.trim(); }));
}

export { bindChatSettingsEvents };

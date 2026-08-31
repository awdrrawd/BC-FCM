import { cfg, saveCfg } from '../core/config.js';
import { AudioStore } from './chat-store.js';

let customAudioUrl = '';

function hasCustomNotificationSound() {
    return !!customAudioUrl;
}

async function initChatAudio() {
    const customSound = await AudioStore.get();
    if (!customSound?.blob) return;
    if (customAudioUrl) URL.revokeObjectURL(customAudioUrl);
    customAudioUrl = URL.createObjectURL(customSound.blob);
}

function playNotificationSound() {
    if (!cfg.notificationAudio) return;
    try {
        const source = cfg.notificationSound === 'custom' ? customAudioUrl : (cfg.notificationSound || 'Audio/BeepAlarm.mp3');
        if (!source) return;
        const audio = new Audio(source);
        audio.volume = 0.8;
        // Autoplay rejection is expected when the browser has not received a
        // user gesture, so it should not be reported as an application error.
        audio.play().catch(() => {});
    } catch { /* Audio is an optional enhancement. */ }
}

async function saveCustomNotificationSound(file) {
    if (!file || !await AudioStore.save(file)) return false;
    if (customAudioUrl) URL.revokeObjectURL(customAudioUrl);
    customAudioUrl = URL.createObjectURL(file);
    cfg.notificationSound = 'custom';
    cfg.notificationAudio = true;
    saveCfg();
    return true;
}

export { hasCustomNotificationSound, initChatAudio, playNotificationSound, saveCustomNotificationSound };

import { cfg } from '../core/config.js';

let bcxApi = null;

function getBcxApi() {
    if (bcxApi) return bcxApi;
    try {
        bcxApi = window.bcx?.getModApi?.('Liko - FCM') ?? null;
    } catch { bcxApi = null; }
    return bcxApi;
}

function getRuleState(rule) {
    try { return getBcxApi()?.getRuleState?.(rule) ?? null; } catch { return null; }
}

function blockedBy(rule, target, channel) {
    if (cfg.bypassBcxCommunication) return false;
    const state = getRuleState(rule);
    if (!state?.isEnforced) return false;
    try { state.triggerAttempt?.(Number(target)); } catch {}
    window.dispatchEvent(new CustomEvent('fcm:bcx-send-blocked', { detail: { channel } }));
    return true;
}

export function sendBcxAwareBeep(data) {
    if (!data || blockedBy('speech_restrict_beep_send', data.MemberNumber, 'beep')) return false;
    ServerSend('AccountBeep', data);
    return true;
}

export function sendBcxAwareWhisper(data) {
    if (!data || blockedBy('speech_restrict_whisper_send', data.Target, 'whisper')) return false;
    ServerSend('ChatRoomChat', data);
    return true;
}

export function canSendBcxWhisper(target) {
    return !blockedBy('speech_restrict_whisper_send', target, 'whisper');
}

export function shouldBypassBcxReceiveRules() {
    return !!cfg.bypassBcxCommunication;
}

export function isBcxAvailable() {
    return !!getBcxApi();
}

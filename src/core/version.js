export const MOD_VER = (typeof __FCM_VERSION__ !== 'undefined' && __FCM_VERSION__) || '1.6.4';

window.Liko = window.Liko ?? {};
Object.assign(window.Liko.FCM, { version: MOD_VER });

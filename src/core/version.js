// This module is the single owner of FCM's duplicate-load guard. Like AEE's
// version module, it snapshots the old state and claims the namespace during
// dependency evaluation, before the ModSDK module can register anything.
export const MOD_VER = (typeof __FCM_VERSION__ !== 'undefined' && __FCM_VERSION__) || '1.5.0';

window.Liko = window.Liko ?? {};

export const FCM_ALREADY_LOADED = !!window.Liko.FCM;
window.Liko.FCM = window.Liko.FCM ?? { version: MOD_VER };

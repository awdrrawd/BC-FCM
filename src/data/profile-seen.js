import { T } from '../i18n/i18n.js';
import { warnLimited } from '../core/logger.js';
// Profile 資訊頁右上角的「最後見面」時間。
// 欄位名 BCESeen 沿用 WCE / LCE：只要從保存的 Profile 重建角色，就把 seen 寫進去；
// WCE / LCE 的個資功能啟用時由它們繪製，否則由 FCM 自己繪製（避免疊兩次）。

/** 從保存的 Profile 重建出角色後呼叫，讓資訊頁知道這份資料的觀察時間。 */
function markSeen(character, profile) {
    const seen = Number(profile?.seen);
    if (character && typeof character === 'object' && Number.isFinite(seen) && seen > 0) character.BCESeen = seen;
    return character;
}

// WCE 或 LCE 的個資功能啟用中 → 它們的 InformationSheetRun 會畫同一行字。
function externalSeenDrawn() {
    try {
        if (globalThis.FBC_VERSION && typeof globalThis.fbcSettingValue === 'function'
            && globalThis.fbcSettingValue('pastProfiles') === true) return true;
    } catch (error) { warnLimited('WCE/FBC last-seen probe failed', error); }
    try {
        const lce = window.Liko?.LCE;
        if (typeof lce?.pastProfiles?.get === 'function' && lce.getFeature?.('pastProfiles') === true) return true;
    } catch (error) { warnLimited('LCE last-seen probe failed', error); }
    return false;
}

/** 在 InformationSheetRun 中呼叫：位置與 WCE / LCE 相同（右上角 1200, 75，靠左）。 */
function drawLastSeen() {
    try {
        const seen = typeof InformationSheetSelection !== 'undefined' ? Number(InformationSheetSelection?.BCESeen) : 0;
        if (!seen || externalSeenDrawn() || typeof MainCanvas === 'undefined' || !MainCanvas || typeof DrawText !== 'function') return;
        const alignment = MainCanvas.textAlign;
        try {
            MainCanvas.textAlign = 'left';
            DrawText(`${T('profileLastSeen')} ${new Date(seen).toLocaleString()}`, 1200, 75, 'grey', 'black');
        } finally { MainCanvas.textAlign = alignment; }
    } catch (error) { warnLimited('last-seen drawing failed', error); }
}

export { markSeen, externalSeenDrawn, drawLastSeen };

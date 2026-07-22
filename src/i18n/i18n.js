import { cfg } from '../core/config.js';
import './i18n-engine.js';     // 執行共用引擎 IIFE：window.Liko.__Sys_i18n__ / __Sys_L10N__（自帶防重載）
import './i18n-fallback.js';   // 內建後備字庫（TW+EN）同步註冊，離線／fetch 失敗時可用
// ════════════════════════════════════════
//  FCM module: i18n.js  （薄轉接層，不含引擎、不含完整文本）
//  結構參考 BC-AFC：i18n-engine.js（共用引擎）＋ i18n-fallback.js（TW+EN 後備）＋ 一國一檔的
//    Translation/<LANG>.js（自註冊到 FCM 命名空間、{0} 位置佔位）。
//  介面字串走共用引擎 window.Liko.__Sys_i18n__；完整文本改為「執行期 fetch」：
//    翻譯者只需改 Translation/<LANG>.js，build 會複製到 public/ 部署，免動程式。
//    載入前／離線時用內建後備（fallback）；fetch 到的完整字庫會覆蓋後備。
// ════════════════════════════════════════

const I18N_NS = 'FCM';
// 手動語言選單（auto + 各語系）；auto 依 BC TranslationLanguage
const FCM_LANGS = ['auto', 'TW', 'CN', 'EN', 'JP', 'KR', 'DE', 'FR', 'RU', 'UA'];
const FCM_LANG_NAMES = { auto: 'Auto', TW: '繁體中文', CN: '简体中文', EN: 'English', JP: '日本語', KR: '한국어', DE: 'Deutsch', FR: 'Français', RU: 'Русский', UA: 'Українська' };
// 執行期 fetch 的語言檔（一國一檔）；引擎只會抓「目前語言 + EN 後備」（CN 再加 TW）
const T_LANGS = ['TW', 'CN', 'EN', 'JP', 'KR', 'DE', 'FR', 'RU', 'UA'];

// 依 bundle（assets/main.js）位置解析同層根目錄的素材網址；本地 vite preview 與 Pages 皆適用。
function assetUrl(path) {
    const url = new URL(import.meta.url);
    url.pathname = url.pathname.replace(/\/assets\/[^/]+$/, `/${String(path).replace(/^\//, '')}`);
    url.search = '';
    return url.toString();
}

// 抓「目前語言 + EN 後備」的字庫檔並註冊到共用引擎；引擎依 URL 去重、自帶時間戳破快取。
//  fetch 失敗／未完成時沿用內建後備（i18n-fallback.js）。
async function ensureI18n() {
    try {
        const eng = window.Liko?.__Sys_i18n__;
        if (!eng?.ensure) return;
        const urlMap = {};
        for (const c of T_LANGS) urlMap[c] = assetUrl('Translation/' + c + '.js');
        await eng.ensure(I18N_NS, urlMap, fcmLang());   // 依語言分檔（.js 自註冊）
    } catch (e) { console.warn('🐈‍⬛ [FCM] 翻譯載入失敗，改用內建後備:', e.message); }
}

// 目前語言：玩家手動選 > 遊戲語系（ZH→TW）；相容舊值 zh/en
function fcmLang() {
    try {
        let sel = (cfg && cfg.lang) || 'auto';
        if (sel && sel !== 'auto') {
            if (sel === 'zh') return 'TW';
            if (sel === 'en') return 'EN';
            return String(sel).toUpperCase();
        }
        const raw = (typeof TranslationLanguage !== 'undefined' ? TranslationLanguage : '') || 'EN';
        const c = String(raw).toUpperCase().trim();
        return c === 'ZH' ? 'TW' : (c || 'EN');
    } catch { return 'EN'; }
}

// 中文語系（TW/CN）→ 供大量 inline 三元判斷使用（其餘語言走英文分支）
function isZh() { const l = fcmLang(); return l === 'TW' || l === 'CN'; }

// 取翻譯：走共用引擎 t()，args 以陣列傳入走位置式 {0}{1}，並把 FCM 算好的語言（含手動選擇）
//  以第 4 參 forceLang 傳入；缺 key 時引擎回傳 key 本身（並 console.warn）。
function T(key, ...args) {
    const eng = window.Liko?.__Sys_i18n__;
    if (eng?.t) return eng.t(I18N_NS, key, args, fcmLang());
    return key;
}

export { isZh, T, I18N_NS, FCM_LANGS, FCM_LANG_NAMES, fcmLang, ensureI18n, assetUrl };

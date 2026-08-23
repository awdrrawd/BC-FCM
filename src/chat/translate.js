import { cfg } from '../core/config.js';
// ════════════════════════════════════════
//  FCM module: translate.js  （D2 · 聊天消息翻译）
//  可插拔后端，默认 MyMemory（免费 / 支持 CORS / 免 key，约 5000 词/天/IP）。
//  设计原则：仅做「显示端增强」——原文照存照发，只在本地多渲染一行译文。
//  调用方务必处理返回 null（离线 / 超时 / 同源语言 / 限额），不要因此打断聊天流。
// ════════════════════════════════════════

// 内部语言码 → 各 provider 所需码
const LANG_MAP = {
    mymemory:   { TW: 'zh-TW', CN: 'zh-CN', EN: 'en', JA: 'ja', KO: 'ko', DE: 'de', FR: 'fr', ES: 'es', VI: 'vi', RU: 'ru', UA: 'uk' },
    libretranslate: { TW: 'zh', CN: 'zh', EN: 'en', JA: 'ja', KO: 'ko', DE: 'de', FR: 'fr', ES: 'es', VI: 'vi', RU: 'ru', UA: 'uk' },
    deepl:      { TW: 'ZH', CN: 'ZH', EN: 'EN', JA: 'JA', KO: 'KO', DE: 'DE', FR: 'FR', ES: 'ES', VI: 'VI', RU: 'RU', UA: 'UK' },
    custom:     { TW: 'zh-TW', CN: 'zh-CN', EN: 'en', JA: 'ja', KO: 'ko', DE: 'de', FR: 'fr', ES: 'es', VI: 'vi', RU: 'ru', UA: 'uk' },
    // Google 非官方 gtx 端点：接受 ISO 码，zh-TW/zh-CN 均可用
    google:     { TW: 'zh-TW', CN: 'zh-CN', EN: 'en', JA: 'ja', KO: 'ko', DE: 'de', FR: 'fr', ES: 'es', VI: 'vi', RU: 'ru', UA: 'uk' },
};

const DEFAULT_ENDPOINT = {
    mymemory: 'https://api.mymemory.translated.net/get',
    libretranslate: 'https://translate.argosopentech.com/translate',
    deepl: 'https://api-free.deepl.com/v2/translate',
    google: 'https://translate.googleapis.com/translate_a/single',  // 仅作文档；实际 URL 在 _translateGoogle 内组装（gtx 参数）
};

// 会话内缓存：避免同一条消息在每次重渲染时重复请求（也省免费额度）
const _cache = new Map();
function _cacheKey(provider, src, tgt, text) { return `${provider}:${src}->${tgt}:${text}`; }

function _mapLang(code, provider) {
    const c = String(code || 'EN').toUpperCase();
    return (LANG_MAP[provider] && LANG_MAP[provider][c]) || (LANG_MAP.mymemory[c]) || 'en';
}

// 轻量源语言探测：含 CJK → 中文；否则 → 英文（覆盖 EN↔ZH 最常见场景）
function detectSource(text) {
    return /[一-鿿]/.test(text || '') ? 'zh' : 'en';
}

function _endpoint(provider) {
    const cfgEp = (cfg.translatorEndpoint || '').trim();
    if (cfgEp) return cfgEp;
    return DEFAULT_ENDPOINT[provider] || DEFAULT_ENDPOINT.mymemory;
}

// ───────────────────────────────────────────────────────────
// Google 翻译（非官方 gtx 端点）
// 移植自 Liko-MAT（https://github.com/awdrrawd/liko-Plugin-Repository）
//   MIT License · Copyright (c) 2026 awdrrawd
// 特点：免 API key、免费；但 (1) translate.googleapis.com 在中国大陆被墙，需 VPN；
//       (2) 非官方端点，Google 可能限流/封禁。这里沿用 MAT 的健壮处理：
//       超时 AbortController、429/403 显式识别、网络/5xx 退避重试（600/1200ms）。
// ───────────────────────────────────────────────────────────
async function _translateGoogle(text, target, attempt = 0) {
    const MAX_RETRY = 2;
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 8000);
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`;
        const resp = await fetch(url, { signal: ctrl.signal });
        if (resp.status === 429) throw new Error('rate_limit');
        if (resp.status === 403) throw new Error('blocked');
        if (!resp.ok) throw new Error(`http_${resp.status}`);
        const data = await resp.json();
        return data[0]?.map(seg => seg?.[0] || '').join('') || null;
    } catch (e) {
        const isNetwork = e instanceof TypeError || e.name === 'AbortError';
        const reason = isNetwork ? 'network' : (e.message || 'unknown');
        const transient = isNetwork || /^http_5\d\d$/.test(reason);
        if (transient && attempt < MAX_RETRY) {
            await new Promise(r => setTimeout(r, 600 * (attempt + 1)));
            return _translateGoogle(text, target, attempt + 1);
        }
        return null;
    } finally {
        clearTimeout(to);
    }
}

async function _fetchJson(url, options, timeout = 8000) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeout);
    try {
        const res = await fetch(url, { ...options, signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } finally { clearTimeout(timer); }
}

// 统一入口：text 原文，target 内部码（如 'EN'/'CN'），source 可选（默认启发式）
async function translate(text, target = cfg.translateTarget || 'EN', source) {
    const t = String(text || '').trim();
    if (!t) return null;
    const provider = cfg.translatorProvider || 'mymemory';
    const src = source ? _mapLang(source, provider) : (detectSource(t) === 'zh' ? _mapLang('CN', provider) : _mapLang('EN', provider));
    const tgt = _mapLang(target, provider);
    if (!src || !tgt || src === tgt) return null;           // 同源不翻译

    const key = _cacheKey(provider, src, tgt, t);
    if (_cache.has(key)) return _cache.get(key);

    try {
        let out = null;
        if (provider === 'mymemory') {
            const url = `${_endpoint('mymemory')}?q=${encodeURIComponent(t)}&langpair=${encodeURIComponent(src)}|${encodeURIComponent(tgt)}`;
            const data = await _fetchJson(url);
            out = data?.responseData?.translatedText || null;
            if (out && /MYMEMORY WARNING/.test(out)) out = null;   // 触发限额/警告时退化为不翻译
        } else if (provider === 'libretranslate') {
            const data = await _fetchJson(_endpoint('libretranslate'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ q: t, source: 'auto', target: tgt, api_key: cfg.translatorKey || undefined }),
            });
            out = data?.translatedText || null;
        } else if (provider === 'deepl') {
            const data = await _fetchJson(_endpoint('deepl'), {
                method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `DeepL-Auth-Key ${cfg.translatorKey || ''}` },
                body: JSON.stringify({ text: [t], target_lang: tgt }),
            });
            out = data?.translations?.[0]?.text || null;
        } else if (provider === 'google') {
            // 非官方 gtx 端点，免 key / 免费；详见 _translateGoogle 注释
            out = await _translateGoogle(t, tgt);
        } else { // custom：POST { q, source, target }，期望 { translatedText } 或纯文本
            const data = await _fetchJson(_endpoint('custom'), {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ q: t, source: src, target: tgt, api_key: cfg.translatorKey || undefined }),
            });
            out = (data && (data.translatedText || data.translatedText === '' ? data.translatedText : null)) || (typeof data === 'string' ? data : null);
        }
        if (out && String(out).trim()) { _cache.set(key, out); return out; }
        return null;
    } catch (e) {
        console.warn('🐈‍⬛ [FCM] 翻译失败:', e && e.message);
        return null;
    }
}

// 批量预取（可选）：返回 Promise，不阻塞调用方
function prefetch(text, target, source) { return translate(text, target, source); }

export { translate, detectSource, prefetch, _mapLang };

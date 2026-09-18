function hasMAT() {
    return typeof globalThis.Liko?.MAT?.translate === 'function';
}

function createChatTranslationService({ getMAT = () => globalThis.Liko?.MAT, now = Date.now } = {}) {
    const valid = result => !result?.error && typeof result?.translated === 'string' && !!result.translated.trim();

    async function translate(content) {
        if (typeof content !== 'string' || !content.trim()) return { error: 'invalid_argument' };
        if (content.length > 10000) return { error: 'text_too_long' };
        try {
            const mat = getMAT();
            if (typeof mat?.translate !== 'function') return { error: 'unavailable' };
            if (mat.settingsReady === false || !mat.recvLang) return { error: 'not_ready' };
            const language = mat.recvLang;
            // MAT's full-text cache also reassembles its cached long-message fragments.
            const cached = mat.getCachedTranslation?.(content, language);
            if (valid(cached)) return { ...cached, targetLang: language };
            const history = typeof mat.getCachedTranslation === 'function' ? null : mat.getHistory?.();
            const entry = Array.isArray(history) ? history.find(item => item.text === content && item.targetLang?.toLowerCase() === language.toLowerCase() && item.expiresAt > now() && valid(item)) : null;
            if (entry) return { translated: entry.translated, detectedLang: entry.detectedLang, targetLang: language };
            const result = await mat.translate(content, language, { priority: 'manual' });
            return valid(result) ? { ...result, targetLang: language } : { error: result?.error || 'invalid_response' };
        } catch (error) {
            return { error: error?.name === 'AbortError' ? 'timeout' : error?.message || 'network' };
        }
    }

    return { translate };
}

export { createChatTranslationService, hasMAT };

import assert from 'node:assert/strict';
import test from 'node:test';
import { createChatTranslationService, hasMAT } from '../src/communication/chat/services/chat-translation.js';

const success = translated => ({ translated, detectedLang: 'en' });

test('MAT full-text cache and history are used before a manual translation request', async () => {
    let calls = 0;
    const mat = {
        recvLang: 'zh-TW', getCachedTranslation: (text, lang) => {
            assert.equal(lang, 'zh-TW');
            return text === 'cached' ? success('快取') : null;
        },
        getHistory: () => [
            { text: 'history', targetLang: 'ja', translated: 'wrong language', expiresAt: 200 },
            { text: 'history', targetLang: 'zh-TW', translated: 'expired', expiresAt: 99 },
            { text: 'history', targetLang: 'zh-TW', translated: '歷史', expiresAt: 200 },
        ],
        translate: async (text, language, options) => {
            calls++;
            assert.equal(text, 'new'); assert.equal(language, 'zh-TW');
            assert.equal(options.priority, 'manual');
            return success('新翻譯');
        },
    };
    const service = createChatTranslationService({ getMAT: () => mat, now: () => 100 });
    assert.equal((await service.translate('cached')).translated, '快取');
    delete mat.getCachedTranslation;
    assert.equal((await service.translate('history')).translated, '歷史');
    assert.equal(calls, 0);
    assert.equal((await service.translate('new')).translated, '新翻譯');
    assert.equal(calls, 1);
});

test('manual requests still use MAT when automatic translation is disabled', async () => {
    const mat = { enabled: false, recvLang: 'ja', translate: async (content, language, options) => {
        assert.equal(options.priority, 'manual');
        assert.equal(language, 'ja');
        return success('translated');
    } };
    const service = createChatTranslationService({ getMAT: () => mat });
    assert.equal((await service.translate('hello')).translated, 'translated');
    assert.equal(mat.enabled, false);
    mat.translate = async () => { throw new Error('network'); };
    assert.equal((await service.translate('hello')).error, 'network');
});

test('a full-text cache miss does not scan a duplicate history snapshot', async () => {
    const service = createChatTranslationService({ getMAT: () => ({
        recvLang: 'ja', getCachedTranslation: () => null,
        getHistory: () => assert.fail('the full-text cache already checked these entries'),
        translate: async () => success('translated'),
    }) });
    assert.equal((await service.translate('new')).translated, 'translated');
});

test('missing MAT or uninitialized language never issues a translation request', async () => {
    let mat;
    const service = createChatTranslationService({ getMAT: () => mat });
    assert.equal((await service.translate('hello')).error, 'unavailable');
    mat = { translate: () => assert.fail('must wait for the MAT language') };
    assert.equal((await service.translate('hello')).error, 'not_ready');
    mat.recvLang = 'en';
    mat.settingsReady = false;
    assert.equal((await service.translate('hello')).error, 'not_ready');
    assert.equal((await service.translate('x'.repeat(10001))).error, 'text_too_long');
});

test('MAT detection checks the API rather than its automatic translation toggle', () => {
    const previous = globalThis.Liko;
    try {
        globalThis.Liko = {};
        assert.equal(hasMAT(), false);
        globalThis.Liko.MAT = { enabled: false, translate() {} };
        assert.equal(hasMAT(), true);
    } finally { globalThis.Liko = previous; }
});

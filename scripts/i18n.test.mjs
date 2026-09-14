import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { Linter } from 'eslint';

const read = path => readFileSync(path, 'utf8');
const english = JSON.parse(read('Translation/EN.json'));
function files(dir) {
    return readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
}

test('UI literals have no hard-coded Chinese and static translation keys exist', () => {
    const linter = new Linter();
    const rule = {
        create(context) {
            function check(node, value) {
                if (typeof value !== 'string') return;
                // Font measurement text is not displayed. CSS comments are documentation.
                if (context.filename.endsWith('/chat-font.js') && node.parent?.id?.name === 'sample') return;
                if (/\p{Script=Han}/u.test(value.replace(/\/\*[\s\S]*?\*\//g, ''))) {
                    context.report({ node, message: 'Move visible Chinese text into Translation/*.json.' });
                }
            }
            return {
                Literal: node => check(node, node.value),
                TemplateElement: node => check(node, node.value.cooked),
                CallExpression(node) {
                    if (!['T', 'TH', 'text'].includes(node.callee.name)) return;
                    const key = node.arguments[0];
                    if (key?.type === 'Literal' && typeof key.value === 'string' && !(key.value in english)) {
                        context.report({ node: key, message: `Missing translation key: ${key.value}` });
                    }
                },
            };
        },
    };
    const failures = [];
    for (const file of files('src').filter(f => f.endsWith('.js') && !f.startsWith('src/i18n/'))) {
        const messages = linter.verify(read(file), [{ plugins: { fcm: { rules: { translated: rule } } }, rules: { 'fcm/translated': 'error' } }], { filename: file });
        failures.push(...messages.map(m => `${file}:${m.line}: ${m.message}`));
    }
    assert.deepEqual(failures, []);
});

test('every fallback key is present in the complete dictionaries', () => {
    // This file uses a literal key per entry; values are not executed.
    const keys = [...read('src/i18n/i18n-fallback.js').matchAll(/^\s+"([^"]+)": \{ TW:/gm)].map(m => m[1]);
    assert.ok(keys.length > 100);
    assert.deepEqual(keys.filter(key => !(key in english)), []);
});

test('help and generic font names resolve through the selected locale on every render', async () => {
    let language = 'EN';
    globalThis.__fcmTestTranslate = key => JSON.parse(read(`Translation/${language}.json`))[key] ?? `MISSING:${key}`;
    const hooks = registerHooks({ load(url, context, next) {
        if (url.endsWith('/src/i18n/i18n.js')) return { format: 'module', source: 'export const T = key => globalThis.__fcmTestTranslate(key);', shortCircuit: true };
        if (url.endsWith('/src/core/config.js')) return { format: 'module', source: 'export const cfg = {}; export const MOD_VER = "test";', shortCircuit: true };
        return next(url, context);
    } });
    const { renderHelp } = await import('../src/panel/panel-help.js');
    const { availableFontChoices } = await import('../src/communication/chat-font.js');
    hooks.deregister();
    const texts = [];
    const element = () => ({ style: {}, appendChild() {}, addEventListener() {}, getContext: () => null,
        set textContent(value) { texts.push(value); } });
    globalThis.document = { createElement: element };
    for (const locale of readdirSync('Translation').filter(f => f.endsWith('.json'))) {
        language = locale.slice(0, -5);
        texts.length = 0;
        renderHelp(element());
        const fonts = availableFontChoices();
        const dict = JSON.parse(read(`Translation/${locale}`));
        assert.ok(texts.includes(dict.helpIntroTitle));
        assert.ok(texts.includes(dict.helpAvatarsText));
        assert.equal(fonts[0][1], dict.chatFontSystem);
        assert.equal(texts.some(t => String(t).startsWith('MISSING:')), false);
    }
    delete globalThis.__fcmTestTranslate;
});

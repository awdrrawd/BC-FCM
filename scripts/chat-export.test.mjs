import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';

const hooks = registerHooks({ load(url, context, next) {
    const stubs = {
        '/src/core/config.js': 'export const cfg = { lang: "en" };',
        '/src/core/logger.js': 'export const warnLimited = () => {};',
        '/src/i18n/i18n.js': 'export const T = key => key; export const TH = key => key;',
        '/src/data/profile-db.js': 'export const Snapshot = {};',
        '/src/communication/chat/data/chat-store.js': 'export const ChatStore = {};',
    };
    for (const [suffix, source] of Object.entries(stubs)) if (url.endsWith(suffix)) return { format: 'module', source, shortCircuit: true };
    return next(url, context);
} });
const { conversationExportHtml } = await import('../src/communication/chat/services/chat-export.js');
hooks.deregister();

test('exported conversation has a restrictive CSP, no script and no inline event handlers', () => {
    globalThis.Player = { MemberNumber: 1, Name: 'me' };
    globalThis.document = { documentElement: { lang: 'en' } };
    const html = conversationExportHtml(
        [{ direction: 'in', timestamp: 1, content: 'hi <img src=x onerror=alert(1)> https://example.com/a.png' }],
        'https://example.com/a.png?x=" onerror="alert(1)',
        { memberNumber: 2, getDisplayName: () => '<b>peer</b>', chatColors: () => ['#111', '#eee', '#a0f'] });
    assert.match(html, /http-equiv="Content-Security-Policy"/);
    assert.match(html, /default-src 'none'/);
    assert.doesNotMatch(html, /<script/i);
    // Quoted values are escaped data (the avatar URL above deliberately tries to inject onerror); only real attributes count.
    const withoutQuotedValues = html.replace(/"[^"]*"/g, '""');
    assert.doesNotMatch(withoutQuotedValues, /<[^>]+\son\w+\s*=/i, 'no tag may carry an inline event handler attribute');
    assert.match(html, /src="https:\/\/example\.com\/a\.png\?x=&quot; onerror=&quot;alert\(1\)"/, 'the injected quote is escaped inside the attribute');
    assert.doesNotMatch(html, /<b>peer<\/b>/);
});

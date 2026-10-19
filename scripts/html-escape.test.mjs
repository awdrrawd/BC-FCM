import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const hooks = registerHooks({ load(url, context, next) {
    if (url.endsWith('/i18n/i18n.js')) return { format: 'module', source: 'export const TH = key => key;', shortCircuit: true };
    if (url.endsWith('/communication/image-trust.js')) return { format: 'module', source: 'export const imageOriginTrusted = () => true;', shortCircuit: true };
    return next(url, context);
} });
const { esc, messageContentHtml } = await import('../src/communication/chat/services/chat-content.js');
hooks.deregister();

test('esc() escapes quotes so values are safe inside quoted attributes', () => {
    const out = esc('x" onfocus="window.__pwned=1" tabindex="0" x="');
    assert.ok(!out.includes('"'), out);
    assert.equal(esc(`it's <b>&`), 'it&#39;s &lt;b&gt;&amp;');
    assert.equal(esc(null), '');
});

test('message links cannot break out of href/title/src attributes', () => {
    const html = messageContentHtml('see https://example.com/p.png?a=b"onerror="x');
    // every attribute value must stay inside its own pair of quotes
    assert.equal((html.match(/"/g) || []).length % 2, 0, html);
    assert.ok(!/\sonerror=/.test(html), html);
});

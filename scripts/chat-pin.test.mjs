import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const hooks = registerHooks({ load(url, context, next) {
    const source = url.endsWith('/services/chat-content.js') ? 'export const esc = String;'
        : url.endsWith('/ui/search-clear.js') ? 'export const attachSearchClear = () => {};' : null;
    return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });
const { pinnedFirst, filterGroupRows } = await import('../src/communication/chat/data/chat-list-data.js');
const { contactRowsHtml } = await import('../src/communication/chat/views/chat-list-view.js');
hooks.deregister();

const rows = [1, 2, 3, 4, 5].map(memberNumber => ({ memberNumber }));
const helpers = {
    avatarHtml: () => '', displayName: n => `P${n}`, biography: () => '', cleanMessage: x => x,
    esc: x => String(x), text: x => x,
};
const dividers = html => (html.match(/fcm-chat-pin-divider/g) || []).length;

test('pinned members sort first and keep their relative order', () => {
    const pinned = new Set([4, 2]);
    assert.deepEqual(pinnedFirst(rows, n => pinned.has(n)).map(r => r.memberNumber), [2, 4, 1, 3, 5]);
    assert.equal(pinnedFirst(rows, () => false), rows);
});

test('group rows are pinned-first too', () => {
    const out = filterGroupRows({ members: [1, 2, 3] }, '', n => `P${n}`, () => '', n => n === 3);
    assert.deepEqual(out.map(r => r.memberNumber), [3, 1, 2]);
});

test('one divider is drawn right after the last pinned row', () => {
    const pinned = new Set([1, 2, 3]);
    const html = contactRowsHtml(pinnedFirst(rows, n => pinned.has(n)), { ...helpers, isPinned: n => pinned.has(n) });
    assert.equal(dividers(html), 1);
    assert.ok(html.indexOf('data-member="3"') < html.indexOf('fcm-chat-pin-divider'));
    assert.ok(html.indexOf('fcm-chat-pin-divider') < html.indexOf('data-member="4"'));
});

test('a single pinned member among others is followed by a divider; none means no divider', () => {
    assert.equal(dividers(contactRowsHtml(pinnedFirst(rows, n => n === 5), { ...helpers, isPinned: n => n === 5 })), 1);
    assert.equal(dividers(contactRowsHtml(rows, { ...helpers, isPinned: () => false })), 0);
});

test('history rows never get a pin divider', () => {
    const history = rows.map(r => ({ ...r, direction: 'in', content: 'x', timestamp: 1 }));
    assert.equal(dividers(contactRowsHtml(history, { ...helpers, history: true, isPinned: () => true })), 0);
});

test('no divider when every row is pinned', () => {
    assert.equal(dividers(contactRowsHtml(rows, { ...helpers, isPinned: () => true })), 0);
    assert.equal(dividers(contactRowsHtml(rows.slice(0, 1), { ...helpers, isPinned: () => true })), 0);
});

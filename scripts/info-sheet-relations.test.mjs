import test from 'node:test';
import assert from 'node:assert/strict';
import { decorateInfoSheetRelations } from '../src/core/info-sheet-relations.js';

// 最小假 DOM：只實作 decorateInfoSheetRelations 用到的介面
function el(classes, { copies = [], next = null } = {}) {
    const node = {
        classes, dataset: {}, appended: [], nextElementSibling: next,
        classList: { contains: c => classes.includes(c) },
        querySelectorAll: () => copies.map(t => ({ textContent: t })),
        append(child) { node.appended.push(child); },
    };
    return node;
}
const sheetOf = rows => ({ querySelectorAll: selector => rows.filter(r => selector.split(',').some(s => r.classes.includes(s.trim().slice(1)))) });

function run(rows) {
    const since = [], buttons = [];
    const count = decorateInfoSheetRelations(sheetOf(rows), {
        attachSince: (line, member) => since.push([line, member]),
        makeButton: member => { const b = { member }; buttons.push(b); return b; },
    });
    return { count, since, buttons };
}

test('lover row (.information-sheet-lover) gets the search on its since line, even without a relations-slot wrapper', () => {
    const sinceLine = el(['information-sheet-since']);
    const lover = el(['information-sheet-lover'], { copies: ['Alice', '12345'], next: sinceLine });
    const { count, since } = run([lover]);
    assert.equal(count, 1);
    assert.deepEqual(since, [[sinceLine, 12345]]);
    assert.equal(lover.dataset.fcmSearch, '1');
});

test('owner row, legacy entry-title row and no-since fallback button all work', () => {
    const ownerSince = el(['information-sheet-since']);
    const owner = el(['information-sheet-owner'], { copies: ['Mistress', '777'], next: ownerSince });
    const legacy = el(['information-sheet-entry-title'], { copies: ['Bob', '42'] });
    const { count, since, buttons } = run([owner, legacy]);
    assert.equal(count, 2);
    assert.deepEqual(since, [[ownerSince, 777]]);
    assert.deepEqual(buttons, [{ member: 42 }]);
    assert.deepEqual(legacy.appended, buttons);
});

test('rows without a member number (NPC lovers), non-numeric ids and already-decorated rows are skipped', () => {
    const npc = el(['information-sheet-lover'], { copies: ['NPC'] });
    const bad = el(['information-sheet-lover'], { copies: ['A', 'x1'] });
    const done = el(['information-sheet-lover'], { copies: ['A', '5'] });
    done.dataset.fcmSearch = '1';
    const { count } = run([npc, bad, done]);
    assert.equal(count, 0);
});

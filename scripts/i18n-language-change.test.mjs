import assert from 'node:assert/strict';
import test from 'node:test';

// The shared engine is an IIFE that needs window/document/localStorage only.
const listeners = {};
const store = new Map([['BondageClubLanguage', 'EN']]);
const intervals = [];
globalThis.window = globalThis;
globalThis.document = { hidden: false, addEventListener: (type, fn) => { listeners[`doc:${type}`] = fn; }, head: { appendChild() {} }, createElement: () => ({}) };
globalThis.addEventListener = (type, fn) => { listeners[type] = fn; };
globalThis.localStorage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
const nativeSetInterval = globalThis.setInterval;
globalThis.setInterval = (...args) => { intervals.push(args); return nativeSetInterval(() => {}, 1e9); };

await import('../src/i18n/i18n-engine.js');
const engine = globalThis.Liko.__Sys_i18n__;

test('language changes are pushed to listeners without any polling timer', () => {
    assert.equal(intervals.length, 0, 'the engine must not start a polling interval');
    const seen = [];
    engine.onChange(lang => seen.push(lang));
    assert.equal(engine.refreshLanguage(), false, 'no change, no notification');
    store.set('BondageClubLanguage', 'TW');
    assert.equal(engine.refreshLanguage(), true);
    assert.deepEqual(seen, ['TW']);
    assert.equal(engine.refreshLanguage(), false, 'same language is not reported twice');
});

test('other tabs, focus and visibility changes are detected through events', () => {
    const seen = [];
    engine.onChange(lang => seen.push(lang));
    store.set('BondageClubLanguage', 'FR');
    listeners.storage({ key: 'BondageClubLanguage' });
    store.set('BondageClubLanguage', 'DE');
    listeners.storage({ key: 'unrelated' });          // ignored key: no re-detection
    assert.deepEqual(seen, ['FR']);
    listeners.focus();
    assert.deepEqual(seen, ['FR', 'DE']);
    store.set('BondageClubLanguage', 'EN');
    listeners['doc:visibilitychange']();
    assert.deepEqual(seen, ['FR', 'DE', 'EN']);
});

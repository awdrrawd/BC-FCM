import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';

const imports = registerHooks({ load(url, context, next) {
    const stubs = {
        '/src/core/config.js': 'export const cfg = { saveMode: "full" };',
        '/src/i18n/i18n.js': 'export const T = key => key;',
        '/src/data/data.js': 'export const inRoomFn = () => false;',
        '/src/core/logger.js': 'export const warnLimited = () => {};',
    };
    for (const [suffix, source] of Object.entries(stubs)) {
        if (url.endsWith(suffix)) return { format: 'module', source, shortCircuit: true };
    }
    return next(url, context);
} });
const { openVersionless } = await import('../src/data/idb-open.js');
const { Snapshot } = await import('../src/data/profile-db.js');
imports.deregister();

// Minimal IndexedDB double: each open() yields a request the test drives by hand.
function fakeIndexedDB() {
    const opens = [];
    globalThis.indexedDB = { open(...args) {
        const db = { closed: 0, objectStoreNames: { contains: () => true }, close() { this.closed++; } };
        const request = { result: db, args };
        opens.push(request);
        return request;
    } };
    return opens;
}
const succeed = request => request.onsuccess();

test('never requests a version and only creates stores from onupgradeneeded', async () => {
    const opens = fakeIndexedDB();
    const created = [];
    const pending = openVersionless('x-db', { upgrade: db => created.push(db) });
    assert.deepEqual(opens[0].args, ['x-db']);
    opens[0].onupgradeneeded({ target: { result: opens[0].result } });
    succeed(opens[0]);
    assert.equal(await pending, opens[0].result);
    assert.equal(created.length, 1);
});

test('closes at once on versionchange so another plugin\'s upgrade is never blocked', async () => {
    const opens = fakeIndexedDB();
    const lost = [];
    const pending = openVersionless('x-db', { onLost: db => lost.push(db) });
    succeed(opens[0]);
    const db = await pending;
    db.onversionchange();
    assert.equal(db.closed, 1);
    assert.deepEqual(lost, [db]);
});

test('a queued open resolves to null on timeout and a late connection is closed, not leaked', async () => {
    const opens = fakeIndexedDB();
    const pending = openVersionless('x-db', { timeout: 20 });
    assert.equal(await pending, null);
    succeed(opens[0]);
    assert.equal(opens[0].result.closed, 1);
});

test('request errors and thrown opens resolve to null instead of rejecting', async () => {
    const opens = fakeIndexedDB();
    const failed = openVersionless('x-db');
    opens[0].error = new Error('denied');
    opens[0].onerror();
    assert.equal(await failed, null);
    globalThis.indexedDB = { open() { throw new Error('unavailable'); } };
    assert.equal(await openVersionless('x-db'), null);
});

test('Snapshot shares one open, reopens after a version change and does not remember a transient miss', async () => {
    const opens = fakeIndexedDB();
    Snapshot.db = null;
    const first = Promise.all([Snapshot.init(), Snapshot.init()]);
    assert.equal(opens.length, 1, 'concurrent init() calls share one connection');
    succeed(opens[0]);
    assert.deepEqual(await first, [true, true]);
    const previous = Snapshot.db;
    previous.onversionchange();
    assert.equal(Snapshot.db, null);
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(opens.length, 2, 'reopened without a version after yielding to the upgrade');
    succeed(opens[1]);
    assert.equal(await Snapshot.init(), true);
    assert.notEqual(Snapshot.db, previous);
    Snapshot.db = null;
    delete globalThis.indexedDB;
});

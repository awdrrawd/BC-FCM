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
const { PDB, Snapshot, _pc } = await import('../src/data/profile-db.js');
const { cfg } = await import('../src/core/config.js');
imports.deregister();

function database(rows = [], fail = false) {
    const records = new Map(rows.map(row => [row.memberNumber, structuredClone(row)]));
    return {
        records, writes: 0, version: 31,
        objectStoreNames: { contains: name => name === 'profiles' },
        transaction() {
            const tx = { error: new Error('transaction failed') };
            tx.objectStore = () => ({
                getAll: () => {
                    const req = {};
                    queueMicrotask(() => { req.result = structuredClone([...records.values()]); req.onsuccess?.(); });
                    return req;
                },
                get: key => {
                    const req = {};
                    queueMicrotask(() => {
                        req.result = structuredClone(records.get(key)); req.onsuccess?.();
                        if (!tx.writing) queueMicrotask(() => tx.oncomplete?.());
                    });
                    return req;
                },
                put: value => {
                    tx.writing = true;
                    this.writes++;
                    queueMicrotask(() => {
                        if (fail) tx.onabort?.();
                        else { records.set(value.memberNumber, structuredClone(value)); tx.oncomplete?.(); }
                    });
                },
            });
            return tx;
        },
    };
}
const character = { MemberNumber: 7, Name: 'New name' };
const old = { memberNumber: 7, name: 'Old name', seen: 123, characterBundle: '{"MemberNumber":7,"Appearance":[]}' };
Snapshot.get = async () => 'existing-avatar';

test('retired blob URLs survive until both decoding and displayed-image users release them', t => {
    const revoked = [];
    t.mock.method(URL, 'revokeObjectURL', url => revoked.push(url));
    const url = 'blob:old-avatar';
    Snapshot.retainUrl(url);
    Snapshot.retainUrl(url);
    Snapshot._retireUrl(url);
    assert.deepEqual(revoked, []);
    Snapshot.releaseUrl(url);
    assert.deepEqual(revoked, []);
    Snapshot.releaseUrl(url);
    assert.deepEqual(revoked, [url]);
    Snapshot.releaseUrl(url);
    assert.deepEqual(revoked, [url]);
    Snapshot._retireUrl('blob:unused');
    assert.deepEqual(revoked, [url, 'blob:unused']);
});

test('captureFace centralizes warmup, redraw resets and timeout', async t => {
    let now = 0, draws = 0;
    const C = { MustDraw: false };
    t.mock.method(Date, 'now', () => now);
    t.mock.method(globalThis, 'setTimeout', callback => { now += 500; queueMicrotask(callback); });
    const originalCanvas = globalThis.CharacterLoadCanvas;
    globalThis.CharacterLoadCanvas = target => { draws++; target.MustDraw = false; };
    t.after(() => { if (originalCanvas) globalThis.CharacterLoadCanvas = originalCanvas; else delete globalThis.CharacterLoadCanvas; });
    t.mock.method(PDB, '_face', () => 'x'.repeat(900));
    const image = await PDB.captureFace(C, 100, { warmup: 2000, timeout: 6000 });
    assert.equal(image.length, 900);
    assert.equal(now, 3500);
    assert.equal(draws, 1);
    t.mock.method(PDB, '_face', () => { C.MustDraw = true; return 'x'.repeat(900); });
    assert.equal(await PDB.captureFace(C, 100, { warmup: 0, timeout: 2000 }), null);
    assert.ok(draws > 2);
});

test('captured JSON remains valid after the game introduces an Asset/Group cycle', async () => {
    cfg.saveMode = 'full';
    const raw = { ...character, Appearance: [], Inventory: ['unused'] };
    const bundle = PDB.capture(raw);
    const group = { Asset: [] };
    group.Asset.push({ Group: group });
    raw.Appearance.push({ Asset: group.Asset[0] });
    PDB.db = database();
    await PDB.save(character, bundle);
    assert.deepEqual(JSON.parse(PDB.db.records.get(7).characterBundle), { ...character, Appearance: [] });
    assert.deepEqual(raw.Inventory, ['unused']);
    assert.equal(PDB.capture(raw), null);
    await PDB.save(character, null);
    assert.equal(PDB.db.writes, 1);
});

test('name-only saves preserve full profile and its observation time', async () => {
    cfg.saveMode = 'name';
    PDB.db = database([old]);
    await PDB.save(character, null);
    const saved = PDB.db.records.get(7);
    assert.equal(saved.name, character.Name);
    assert.equal(saved.characterBundle, old.characterBundle);
    assert.equal(saved.seen, old.seen);
});

test('avatar-only saves never write profiles', async () => {
    cfg.saveMode = 'avatar';
    PDB.db = database([old]);
    await PDB.save(character, null);
    assert.equal(PDB.db.writes, 0);
    assert.deepEqual(PDB.db.records.get(7), old);
});

test('an aborted write does not publish uncommitted cache data', async () => {
    cfg.saveMode = 'name';
    PDB.db = database([old], true);
    _pc[7] = old;
    await PDB.save(character, null);
    assert.equal(_pc[7], old);
});

test('reads see external writes and deletions despite a populated cache', async () => {
    PDB.db = database([old]);
    await PDB.get(7);
    PDB.db.records.set(7, { ...old, name: 'WCE update' });
    assert.equal((await PDB.get(7)).name, 'WCE update');
    PDB.db.records.delete(7);
    assert.equal(await PDB.get(7), null);
});

test('version changes close the old connection and reopen without requesting a version', async () => {
    PDB.db = null;
    let opens = 0, closed = 0;
    globalThis.indexedDB = { open(...args) {
        assert.deepEqual(args, ['bce-past-profiles']);
        opens++;
        const req = { result: { objectStoreNames: { contains: () => true }, close() { closed++; } } };
        queueMicrotask(() => req.onsuccess());
        return req;
    } };
    await Promise.all([PDB.init(), PDB.init()]);
    assert.equal(opens, 1);
    const previous = PDB.db;
    previous.onversionchange();
    assert.equal(closed, 1);
    assert.equal(PDB.db, null);
    await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(opens, 2);
    assert.notEqual(PDB.db, previous);
    delete globalThis.indexedDB;
});

test('backup import validates bundles, ignores requested upgrades and preserves full records', async () => {
    PDB.db = database([old]);
    const result = await PDB.importBackup({ dbVersion: 999, profiles: [
        { memberNumber: 7, name: 'Name-only import', seen: 200 },
        { memberNumber: 8, name: 'Invalid', seen: 200, characterBundle: '{"MemberNumber":9,"Appearance":[]}' },
        { memberNumber: 9, name: 'New profile', seen: 200, characterBundle: '{"MemberNumber":9,"Appearance":[]}', avatarDataUrl: 'not a profile field' },
    ], notes: [{ memberNumber: 7, note: 'no notes store', updatedAt: 200 }] });
    assert.deepEqual(result, { pc: 2, nc: 0 });
    assert.equal(PDB.db.version, 31);
    assert.equal(PDB.db.records.get(7).characterBundle, old.characterBundle);
    assert.equal(PDB.db.records.get(7).seen, old.seen);
    assert.equal(PDB.db.records.has(8), false);
    assert.equal('avatarDataUrl' in PDB.db.records.get(9), false);
    const backup = await PDB.exportBackup();
    assert.equal(backup.profiles.length, 2);
    assert.deepEqual(backup.notes, []);
    assert.equal(backup.dbVersion, 31);
});

test('shared profiles only commit newer valid bundles and refresh the cache', async () => {
    PDB.db = database([old]);
    assert.equal(await PDB.receiveShared(old), false);
    assert.equal(await PDB.receiveShared({ ...old, seen: 124 }), true);
    assert.equal(_pc[7].seen, 124);
    assert.equal(await PDB.receiveShared({ ...old, seen: 125, characterBundle: 'invalid JSON' }), false);
    assert.equal(PDB.db.records.get(7).seen, 124);
});

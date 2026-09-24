import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

async function openProfileDatabase(page) {
    await page.goto('/tests/browser/fixture.html');
    // Exercise the real module against native IndexedDB, replacing only game dependencies.
    const source = readFileSync('src/data/profile-db.js', 'utf8').replace(/^import .*;\r?\n/gm, '');
    await page.addScriptTag({ type: 'module', content: `
        const cfg = {}, T = key => key, inRoomFn = () => false, _pc = {};
        const warnLimited = () => {};
        ${source}
        globalThis.profileImport = { PDB, cache: _pc };
    ` });
    await page.waitForFunction(() => !!globalThis.profileImport);
    const importer = readFileSync('src/data/profile-import.js', 'utf8').replace(/^import .*;\r?\n/gm, '');
    const statusView = readFileSync('src/panel/panel-profile-import.js', 'utf8').replace(/^import .*;\r?\n/gm, '');
    await page.addScriptTag({ type: 'module', content: `
        const { PDB } = globalThis.profileImport;
        const T = (key, ...args) => key + ' ' + args.join('/');
        ${importer}
        ${statusView}
        Object.assign(globalThis.profileImport, { importProfileFile, showProfileImportProgress });
    ` });
    await page.waitForFunction(() => !!globalThis.profileImport.importProfileFile);
    await page.evaluate(async () => {
        await new Promise((resolve, reject) => {
            const req = indexedDB.open('bce-past-profiles', 31);
            req.onupgradeneeded = () => {
                for (const name of ['profiles', 'notes']) req.result.createObjectStore(name, { keyPath: 'memberNumber' });
            };
            req.onsuccess = () => { req.result.close(); resolve(); };
            req.onerror = () => reject(req.error);
        });
    });
}

test('native IndexedDB merges duplicate profiles and notes and preserves DB version', async ({ page }) => {
    await openProfileDatabase(page);
    const result = await page.evaluate(async () => {
        const { PDB } = globalThis.profileImport;
        const profiles = Array.from({ length: 120 }, (_, i) => ({ memberNumber: i + 1, name: 'Original', seen: 200 }));
        await PDB.importBackup({ profiles, notes: [{ memberNumber: 1, note: 'Local', updatedAt: 200 }] });
        const stats = await PDB.importBackup({ dbVersion: 999, profiles: [
            { memberNumber: 1, name: 'Older', seen: 100 },
            { memberNumber: 2, name: 'Newer', seen: 300 },
            { memberNumber: 2, name: 'Intermediate', seen: 250 },
            { memberNumber: 121, name: 'Added', seen: 200 },
        ], notes: [
            { memberNumber: 1, note: 'Older', updatedAt: 100 },
            { memberNumber: 2, note: 'New', updatedAt: 100 },
            { memberNumber: 2, note: 'Newest', updatedAt: 300 },
        ] });
        return { stats, profiles: await PDB.getAll(), notes: await PDB.getAll('notes'), version: PDB.db.version };
    });
    expect(result.stats).toEqual({ pc: 2, nc: 2, kept: 3, invalid: 0, unavailableNotes: 0 });
    expect(result.version).toBe(31);
    expect(result.profiles).toHaveLength(121);
    expect(result.profiles[0].name).toBe('Original');
    expect(result.profiles[1].name).toBe('Newer');
    expect(result.notes.map(row => row.note)).toEqual(['Local', 'Newest']);
});

test('optional local backups merge every valid profile in native IndexedDB', async ({ page }) => {
    const directory = process.env.FCM_PROFILE_BACKUPS;
    test.skip(!directory, 'Set FCM_PROFILE_BACKUPS to a local directory of backup JSON files');
    test.setTimeout(240000);
    await openProfileDatabase(page);
    const expected = new Map();
    const files = readdirSync(directory).filter(file => file.endsWith('.json')).sort().reverse();
    await page.evaluate(() => {
        const input = document.createElement('input'); input.type = 'file'; input.id = 'backup-file'; document.body.append(input);
    });
    for (const file of files) {
        const path = resolve(directory, file);
        const backup = JSON.parse(readFileSync(path, 'utf8'));
        for (const row of backup.profiles) {
            const time = row.seen || row.savedAt;
            expected.set(row.memberNumber, Math.max(expected.get(row.memberNumber) || 0, time));
        }
        await page.locator('#backup-file').setInputFiles(path);
        const result = await page.evaluate(async () => {
            const { PDB, importProfileFile, showProfileImportProgress } = globalThis.profileImport;
            const status = showProfileImportProgress();
            let ticks = 0, updates = 0, last;
            const timer = setInterval(() => ticks++, 50);
            const started = performance.now();
            const stats = await importProfileFile(document.querySelector('#backup-file').files[0], {
                onProgress(state) { status.update(state); last = state; updates++; },
            });
            clearInterval(timer);
            status.finish('Complete');
            const rows = await PDB.getAll();
            return { stats, ticks, updates, last, elapsed: Math.round(performance.now() - started),
                version: PDB.db.version, times: rows.map(row => [row.memberNumber, row.seen]) };
        });
        expect(result.stats.invalid).toBe(0);
        expect(result.version).toBe(31);
        expect(new Map(result.times)).toEqual(expected);
        expect(result.ticks).toBeGreaterThan(5);
        expect(result.updates).toBeGreaterThan(100);
        expect(result.last.processed).toBe(result.last.total);
        await expect(page.locator('#fcm-profile-import-progress')).toHaveAttribute('aria-busy', 'false');
        console.log(`${file}: ${JSON.stringify(result.stats)}, total: ${result.times.length}, ${result.elapsed}ms, UI ticks: ${result.ticks}`);
    }
});

test('worker import reports failures, retains committed batches and can retry after quota errors', async ({ page }) => {
    await openProfileDatabase(page);
    const result = await page.evaluate(async () => {
        const { PDB, importProfileFile } = globalThis.profileImport;
        const file = value => new File([JSON.stringify(value)], 'backup.json');
        const profiles = Array.from({ length: 250 }, (_, i) => ({ memberNumber: i + 1, name: 'Test', seen: 100 }));
        const original = PDB.importBackup;
        let calls = 0, last, error;
        PDB.importBackup = async function(data) {
            if (++calls === 2) throw new DOMException('Disk full', 'QuotaExceededError');
            return original.call(this, data);
        };
        try { await importProfileFile(file({ profiles }), { onProgress: state => { last = state; } }); }
        catch (e) { error = e.name; }
        const countAfterFailure = (await PDB.getAll()).length;
        PDB.importBackup = original;
        const retried = await importProfileFile(file({ profiles }));
        const invalid = [];
        for (const blob of [new File(['{broken'], 'broken.json'), file({ profiles: [], notes: {} })]) {
            try { await importProfileFile(blob); } catch (e) { invalid.push(e.message); }
        }
        const again = await importProfileFile(file({ profiles: [] }));
        return { error, last, countAfterFailure, retried, invalid, again };
    });
    expect(result.error).toBe('QuotaExceededError');
    expect(result.last.processed).toBe(100);
    expect(result.countAfterFailure).toBe(100);
    expect(result.retried.pc).toBe(150);
    expect(result.retried.kept).toBe(100);
    expect(result.invalid).toHaveLength(2);
    expect(result.again.pc).toBe(0);
});

test('progress survives panel navigation, prevents concurrent imports and fades out three seconds after completion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await openProfileDatabase(page);
    await page.evaluate(async () => {
        const { PDB, importProfileFile, showProfileImportProgress } = globalThis.profileImport;
        const original = PDB.importBackup;
        let release;
        const gate = new Promise(resolve => { release = resolve; });
        PDB.importBackup = async function(data) { await gate; return original.call(this, data); };
        const status = showProfileImportProgress();
        const file = new File([JSON.stringify({ profiles: [{ memberNumber: 1, name: 'Name', seen: 100 }] })], 'backup.json');
        const running = importProfileFile(file, { onProgress: state => status.update(state) });
        let blocked = false;
        try { await importProfileFile(file); } catch { blocked = true; }
        globalThis.progressTest = { blocked, async finish() { release(); await running; PDB.importBackup = original; status.finish('Complete'); } };
        document.querySelector('#fcm-content').replaceChildren();
    });
    expect(await page.evaluate(() => globalThis.progressTest.blocked)).toBe(true);
    await expect(page.locator('#fcm-profile-import-progress')).toBeVisible();
    await expect(page.locator('#fcm-profile-import-progress')).toHaveAttribute('aria-busy', 'true');
    await expect(page.locator('#fcm-profile-import-progress')).toHaveCSS('user-select', 'none');
    const now = new Date();
    await page.clock.install({ time: now });
    await page.clock.pauseAt(now);
    await page.evaluate(() => globalThis.progressTest.finish());
    await expect(page.locator('#fcm-profile-import-progress')).toContainText('Complete');
    await expect(page.locator('#fcm-profile-import-progress progress')).toHaveCount(0);
    await expect(page.locator('#fcm-profile-import-progress button')).toHaveCount(0);
    await page.clock.fastForward(2999);
    await expect(page.locator('#fcm-profile-import-progress')).toBeVisible();
    await page.clock.fastForward(1);
    await expect(page.locator('#fcm-profile-import-progress')).toHaveCount(1);
    await page.clock.fastForward(180);
    await expect(page.locator('#fcm-profile-import-progress')).toHaveCount(0);
});

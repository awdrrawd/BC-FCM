import { PDB } from './profile-db.js';

let importing = false;

// Read and parse off the UI thread. Transfer only one batch at a time so the
// parsed backup is never cloned into the main thread in its entirety.
function backupWorker() {
    let profiles, notes, offset = 0, store = 'profiles';
    self.onmessage = async ({ data }) => {
        try {
            if (data.file) {
                let text = await data.file.text();
                self.postMessage({ phase: 'parsing' });
                const backup = JSON.parse(text.replace(/^\uFEFF/, ''));
                text = null;
                if (!backup || !Array.isArray(backup.profiles) || (backup.notes !== undefined && !Array.isArray(backup.notes))) {
                    throw new Error('Invalid profile backup');
                }
                profiles = backup.profiles; notes = backup.notes || [];
                self.postMessage({ phase: 'ready', total: profiles.length + notes.length });
                return;
            }
            let rows = store === 'profiles' ? profiles : notes;
            if (offset >= rows.length && store === 'profiles') { store = 'notes'; offset = 0; rows = notes; }
            if (offset >= rows.length) { self.postMessage({ phase: 'done' }); return; }
            const end = Math.min(offset + 100, rows.length);
            const batch = rows.slice(offset, end);
            // Avatar caches are not part of the shared profile schema.
            if (store === 'profiles') for (const row of batch) {
                if (row && typeof row === 'object') { delete row.avatarDataUrl; delete row._avatarLoading; }
            }
            self.postMessage({ phase: 'batch', store, rows: batch });
            rows.fill(null, offset, end);
            offset = end;
        } catch (error) { self.postMessage({ phase: 'error', message: error.message }); }
    };
}

async function importProfileFile(file, { onProgress = () => {} } = {}) {
    if (importing) throw new Error('A profile import is already running');
    importing = true;
    let worker, url, pending, failure;
    const report = progress => { try { onProgress(progress); } catch { /* UI cannot interrupt a committed import. */ } };
    try {
        report({ phase: 'reading', processed: 0, total: 0 });
        url = URL.createObjectURL(new Blob([`(${backupWorker.toString()})()`], { type: 'text/javascript' }));
        worker = new Worker(url);
        const request = message => new Promise((resolve, reject) => {
            if (failure) { reject(failure); return; }
            pending = { resolve, reject };
            worker.postMessage(message);
        });
        worker.onmessage = ({ data }) => {
            if (data.phase === 'parsing') { report({ phase: 'parsing', processed: 0, total: 0 }); return; }
            if (data.phase === 'error') pending?.reject(new Error(data.message));
            else pending?.resolve(data);
        };
        const fail = message => { failure = new Error(message); pending?.reject(failure); };
        worker.onerror = event => fail(event.message || 'Profile worker failed');
        worker.onmessageerror = () => fail('Profile worker message failed');
        const { total } = await request({ file });
        let processed = 0;
        const result = { pc: 0, nc: 0, kept: 0, invalid: 0, unavailableNotes: 0 };
        report({ phase: 'merging', processed, total });
        while (true) {
            const batch = await request({ next: true });
            if (batch.phase === 'done') break;
            const stats = await PDB.importBackup({ profiles: [], [batch.store]: batch.rows });
            for (const key of Object.keys(result)) result[key] += stats[key];
            processed += batch.rows.length;
            report({ phase: 'merging', processed, total });
        }
        return result;
    } finally {
        worker?.terminate();
        if (url) URL.revokeObjectURL(url);
        importing = false;
    }
}

export { importProfileFile };

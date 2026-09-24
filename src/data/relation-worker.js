import { createRelationIndex } from './relation-index.js';

function relationWorker(createIndex) {
    const index = createIndex();
    let db, ready = false, prepared;
    const fail = error => self.postMessage({ type: 'error', message: error?.message || String(error) });
    self.onmessage = ({ data }) => {
        if (data.type === 'load') {
            const request = indexedDB.open('bce-past-profiles');
            // This feature is read-only and must not create/upgrade the shared database.
            request.onupgradeneeded = () => request.transaction.abort();
            request.onerror = () => fail(request.error);
            request.onblocked = () => fail(new Error('Profile database blocked'));
            request.onsuccess = () => {
                db = request.result;
                db.onversionchange = () => { db.close(); fail(new Error('Profile database changed; refresh required')); };
                if (!db.objectStoreNames.contains('profiles')) { db.close(); fail(new Error('Profiles store missing')); return; }
                const tx = db.transaction('profiles', 'readonly');
                const cursor = tx.objectStore('profiles').openCursor();
                cursor.onsuccess = () => {
                    if (!cursor.result) return;
                    index.add(cursor.result.value);
                    cursor.result.continue();
                };
                tx.onabort = tx.onerror = () => { db.close(); fail(tx.error || new Error('Profile scan failed')); };
                tx.oncomplete = () => {
                    db.close();
                    const stats = index.finish(data.social); ready = true;
                    self.postMessage({ type: 'ready', stats });
                };
            };
        } else if (ready) {
            try {
                let value;
                if (data.type === 'prepare') {
                    prepared = index.graph(data.options);
                    value = { nodes: prepared.nodes.length, edges: prepared.edges.length };
                } else if (data.type === 'prepared') { value = prepared; prepared = null; }
                else value = data.type === 'search' ? index.search(data.query) : index.graph(data.options);
                self.postMessage({ type: 'result', requestId: data.requestId, value });
            }
            catch (error) { fail(error); }
        }
    };
}

export function createRelationWorker(social) {
    const url = URL.createObjectURL(new Blob([`(${relationWorker.toString()})(${createRelationIndex.toString()})`], { type: 'text/javascript' }));
    let worker;
    try { worker = new Worker(url); } catch (error) { URL.revokeObjectURL(url); throw error; }
    const pending = new Map();
    let sequence = 0, disposed = false, failure;
    let resolveReady, rejectReady;
    const ready = new Promise((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
    const fail = error => { failure = error; rejectReady(error); for (const request of pending.values()) request.reject(error); pending.clear(); };
    worker.onmessage = ({ data }) => {
        if (data.type === 'ready') resolveReady(data.stats);
        else if (data.type === 'error') fail(new Error(data.message));
        else { pending.get(data.requestId)?.resolve(data.value); pending.delete(data.requestId); }
    };
    worker.onerror = event => fail(new Error(event.message || 'Relation worker failed'));
    worker.onmessageerror = () => fail(new Error('Relation worker message failed'));
    worker.postMessage({ type: 'load', social });
    return {
        ready,
        async request(type, payload) {
            await ready;
            if (disposed || failure) throw failure || new Error('Relation view closed');
            return new Promise((resolve, reject) => {
                const requestId = ++sequence;
                pending.set(requestId, { resolve, reject });
                worker.postMessage({ type, requestId, ...payload });
            });
        },
        dispose() { if (disposed) return; disposed = true; worker.terminate(); URL.revokeObjectURL(url); fail(new DOMException('Closed', 'AbortError')); },
    };
}

const DB_NAME = 'fcm-chat';
const DB_VERSION = 1;

const ChatStore = {
    db: null,
    async init() {
        if (this.db) return true;
        return new Promise(resolve => {
            try {
                const req = indexedDB.open(DB_NAME, DB_VERSION);
                req.onupgradeneeded = e => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('messages')) {
                        const store = db.createObjectStore('messages', { keyPath: 'id' });
                        store.createIndex('memberNumber', 'memberNumber');
                        store.createIndex('timestamp', 'timestamp');
                    }
                };
                req.onsuccess = () => { this.db = req.result; resolve(true); };
                req.onerror = () => resolve(false);
            } catch { resolve(false); }
        });
    },
    async put(message) {
        if (!this.db) await this.init();
        if (!this.db) return false;
        return new Promise(resolve => {
            try {
                const req = this.db.transaction('messages', 'readwrite').objectStore('messages').put(message);
                req.onsuccess = () => resolve(true); req.onerror = () => resolve(false);
            } catch { resolve(false); }
        });
    },
    async all() {
        if (!this.db) await this.init();
        if (!this.db) return [];
        return new Promise(resolve => {
            try {
                const req = this.db.transaction('messages', 'readonly').objectStore('messages').getAll();
                req.onsuccess = () => resolve((req.result || []).sort((a, b) => a.timestamp - b.timestamp));
                req.onerror = () => resolve([]);
            } catch { resolve([]); }
        });
    },
    async prune({ maxAge = 7 * 24 * 60 * 60 * 1000, maxCount = 100 } = {}) {
        const all = await this.all();
        const cutoff = Date.now() - maxAge;
        const keep = all.filter(m => Number(m.timestamp) >= cutoff).slice(-maxCount);
        const keepIds = new Set(keep.map(m => m.id));
        const remove = all.filter(m => !keepIds.has(m.id));
        if (!remove.length) return keep;
        await new Promise(resolve => {
            try {
                const tx = this.db.transaction('messages', 'readwrite');
                const store = tx.objectStore('messages');
                remove.forEach(m => store.delete(m.id));
                tx.oncomplete = () => resolve(); tx.onerror = () => resolve();
            } catch { resolve(); }
        });
        return keep;
    },
    async markRead(memberNumber) {
        const messages = (await this.all()).filter(m => m.memberNumber === Number(memberNumber) && !m.read);
        await Promise.all(messages.map(m => this.put({ ...m, read: true })));
    },
    async deleteMember(memberNumber) {
        if (!this.db) await this.init();
        if (!this.db) return false;
        const target = Number(memberNumber);
        const records = (await this.all()).filter(m => Number(m.memberNumber) === target);
        return new Promise(resolve => {
            try {
                const tx = this.db.transaction('messages', 'readwrite');
                const store = tx.objectStore('messages');
                records.forEach(m => store.delete(m.id));
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => resolve(false);
            } catch { resolve(false); }
        });
    },
    async clear() {
        if (!this.db) await this.init();
        if (!this.db) return false;
        return new Promise(resolve => {
            try {
                const req = this.db.transaction('messages', 'readwrite').objectStore('messages').clear();
                req.onsuccess = () => resolve(true); req.onerror = () => resolve(false);
            } catch { resolve(false); }
        });
    },
};

const AudioStore = {
    db: null,
    async init() {
        if (this.db) return true;
        return new Promise(resolve => {
            const req = indexedDB.open('fcm-chat-audio');
            req.onupgradeneeded = event => { const db = event.target.result; if (!db.objectStoreNames.contains('sounds')) db.createObjectStore('sounds', { keyPath: 'id' }); };
            req.onsuccess = () => { this.db = req.result; resolve(true); }; req.onerror = () => resolve(false);
        });
    },
    async save(file) {
        if (!await this.init()) return false;
        return new Promise(resolve => { const req = this.db.transaction('sounds','readwrite').objectStore('sounds').put({ id:'custom', name:file.name, blob:file, savedAt:Date.now() }); req.onsuccess=()=>resolve(true); req.onerror=()=>resolve(false); });
    },
    async get() {
        if (!await this.init()) return null;
        return new Promise(resolve => { const req=this.db.transaction('sounds','readonly').objectStore('sounds').get('custom'); req.onsuccess=()=>resolve(req.result||null); req.onerror=()=>resolve(null); });
    },
};

export { ChatStore, AudioStore };

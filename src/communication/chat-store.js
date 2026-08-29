const DB_NAME = 'fcm-chat';
const DB_VERSION = 1; // 共用資料庫，任意修改會導致其他插件的錯誤，修改前請先詢問必要性
const accountNumber = () => Number(globalThis.Player?.MemberNumber) || 0;
const OFFLINE_TTL = 48 * 60 * 60 * 1000;

const OfflineQueue = {
    key() { const owner = accountNumber(); return owner ? `FCM_chat_outbox_${owner}` : ''; },
    all() {
        try {
            const key = this.key();
            if (!key) return [];
            const now = Date.now();
            const rows = JSON.parse(localStorage.getItem(key) || '[]').filter(row => row && Number(row.memberNumber) && typeof row.content === 'string' && now - Number(row.queuedAt) < OFFLINE_TTL);
            localStorage.setItem(key, JSON.stringify(rows));
            return rows;
        } catch { return []; }
    },
    add(memberNumber, content) {
        const rows = this.all();
        const row = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, memberNumber: Number(memberNumber), content: String(content), queuedAt: Date.now() };
        rows.push(row);
        try { localStorage.setItem(this.key(), JSON.stringify(rows)); } catch {}
        return row;
    },
    remove(ids) {
        const remove = new Set(ids);
        const rows = this.all().filter(row => !remove.has(row.id));
        try { localStorage.setItem(this.key(), JSON.stringify(rows)); } catch {}
    },
    removeMember(memberNumber) {
        const rows = this.all().filter(row => Number(row.memberNumber) !== Number(memberNumber));
        try { localStorage.setItem(this.key(), JSON.stringify(rows)); } catch {}
    },
};

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
        const ownerMemberNumber = accountNumber();
        if (!ownerMemberNumber) return false;
        if (!this.db) await this.init();
        if (!this.db) return false;
        return new Promise(resolve => {
            try {
                const req = this.db.transaction('messages', 'readwrite').objectStore('messages').put({ ...message, ownerMemberNumber });
                req.onsuccess = () => resolve(true); req.onerror = () => resolve(false);
            } catch { resolve(false); }
        });
    },
    async all() {
        const ownerMemberNumber = accountNumber();
        if (!ownerMemberNumber) return [];
        if (!this.db) await this.init();
        if (!this.db) return [];
        return new Promise(resolve => {
            try {
                const req = this.db.transaction('messages', 'readonly').objectStore('messages').getAll();
                req.onsuccess = () => resolve((req.result || []).filter(message => Number(message.ownerMemberNumber) === ownerMemberNumber).sort((a, b) => a.timestamp - b.timestamp));
                req.onerror = () => resolve([]);
            } catch { resolve([]); }
        });
    },
    // Returns a lightweight recent-message index for the UI. Despite the legacy
    // name this must never delete history; deletion is an explicit user action.
    async prune({ maxCount = 100 } = {}) {
        const all = await this.all();
        return all.slice(-maxCount);
    },
    async page(memberNumber, { before = Infinity, limit = 50 } = {}) {
        const ownerMemberNumber = accountNumber();
        if (!ownerMemberNumber || !this.db) await this.init();
        if (!ownerMemberNumber || !this.db) return { messages: [], hasMore: false };
        const target = Number(memberNumber);
        const rows = [];
        return new Promise(resolve => {
            try {
                const index = this.db.transaction('messages', 'readonly').objectStore('messages').index('timestamp');
                const range = Number.isFinite(before) ? IDBKeyRange.upperBound(before, true) : null;
                const req = index.openCursor(range, 'prev');
                req.onsuccess = () => {
                    const cursor = req.result;
                    if (!cursor || rows.length > limit) {
                        const hasMore = rows.length > limit;
                        resolve({ messages: rows.slice(0, limit).reverse(), hasMore });
                        return;
                    }
                    const message = cursor.value;
                    if (Number(message.ownerMemberNumber) === ownerMemberNumber && Number(message.memberNumber) === target) rows.push(message);
                    cursor.continue();
                };
                req.onerror = () => resolve({ messages: [], hasMore: false });
            } catch { resolve({ messages: [], hasMore: false }); }
        });
    },
    async memberAll(memberNumber) {
        const target = Number(memberNumber);
        return (await this.all()).filter(message => Number(message.memberNumber) === target);
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
        const records = await this.all();
        return new Promise(resolve => {
            try {
                const tx = this.db.transaction('messages', 'readwrite');
                const store = tx.objectStore('messages');
                records.forEach(message => store.delete(message.id));
                tx.oncomplete = () => resolve(true); tx.onerror = () => resolve(false);
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

export { ChatStore, AudioStore, OfflineQueue };

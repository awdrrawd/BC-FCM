import { warnLimited } from '../core/logger.js';

const DB_NAME = 'fcm-chat';
// Do not pass a version here. This database may be opened by other plugins;
// schema upgrades require explicit coordination with their maintainers first.
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
        } catch (error) { warnLimited('offline queue read failed', error); return []; }
    },
    add(memberNumber, content) {
        const rows = this.all();
        const row = { id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, memberNumber: Number(memberNumber), content: String(content), queuedAt: Date.now() };
        rows.push(row);
        try { localStorage.setItem(this.key(), JSON.stringify(rows)); } catch (error) { warnLimited('offline queue write failed', error); }
        return row;
    },
    remove(ids) {
        const remove = new Set(ids);
        const rows = this.all().filter(row => !remove.has(row.id));
        try { localStorage.setItem(this.key(), JSON.stringify(rows)); } catch (error) { warnLimited('offline queue write failed', error); }
    },
    removeMember(memberNumber) {
        const rows = this.all().filter(row => Number(row.memberNumber) !== Number(memberNumber));
        try { localStorage.setItem(this.key(), JSON.stringify(rows)); } catch (error) { warnLimited('offline queue write failed', error); }
    },
};

const ChatStore = {
    db: null,
    async init() {
        if (this.db) return true;
        return new Promise(resolve => {
            try {
                const req = indexedDB.open(DB_NAME);
                req.onupgradeneeded = e => {
                    const db = e.target.result;
                    if (!db.objectStoreNames.contains('messages')) {
                        const store = db.createObjectStore('messages', { keyPath: 'id' });
                        store.createIndex('memberNumber', 'memberNumber');
                        store.createIndex('timestamp', 'timestamp');
                    }
                };
                req.onsuccess = () => {
                    this.db = req.result;
                    this.db.onversionchange = () => { this.db.close(); this.db = null; };
                    resolve(true);
                };
                req.onerror = () => { warnLimited('chat database open failed', req.error); resolve(false); };
            } catch (error) { warnLimited('chat database open failed', error); resolve(false); }
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
                req.onsuccess = () => resolve(true); req.onerror = () => { warnLimited('chat message write failed', req.error); resolve(false); };
            } catch (error) { warnLimited('chat message write failed', error); resolve(false); }
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
                req.onerror = () => { warnLimited('chat history read failed', req.error); resolve([]); };
            } catch (error) { warnLimited('chat history read failed', error); resolve([]); }
        });
    },
    // Returns a lightweight recent-message index for the UI. This never deletes
    // history; deletion remains an explicit user action.
    async recentIndex({ maxCount = 100 } = {}) {
        const ownerMemberNumber = accountNumber();
        if (!ownerMemberNumber || !this.db) await this.init();
        if (!ownerMemberNumber || !this.db || maxCount <= 0) return [];
        const rows = [];
        return new Promise(resolve => {
            try {
                const index = this.db.transaction('messages', 'readonly').objectStore('messages').index('timestamp');
                const req = index.openCursor(null, 'prev');
                req.onsuccess = () => {
                    const cursor = req.result;
                    if (!cursor || rows.length >= maxCount) { resolve(rows.reverse()); return; }
                    if (Number(cursor.value.ownerMemberNumber) === ownerMemberNumber) rows.push(cursor.value);
                    cursor.continue();
                };
                req.onerror = () => { warnLimited('recent chat history read failed', req.error); resolve([]); };
            } catch (error) { warnLimited('recent chat history read failed', error); resolve([]); }
        });
    },
    async page(memberNumber, { before = Infinity, limit = 50 } = {}) {
        const ownerMemberNumber = accountNumber();
        if (!ownerMemberNumber || !this.db) await this.init();
        if (!ownerMemberNumber || !this.db) return { messages: [], hasMore: false };
        const target = Number(memberNumber);
        return new Promise(resolve => {
            try {
                const index = this.db.transaction('messages', 'readonly').objectStore('messages').index('memberNumber');
                const req = index.getAll(target);
                req.onsuccess = () => {
                    const eligible = (req.result || [])
                        .filter(message => Number(message.ownerMemberNumber) === ownerMemberNumber && (!Number.isFinite(before) || Number(message.timestamp) < before))
                        .sort((a, b) => Number(a.timestamp) - Number(b.timestamp));
                    const start = Math.max(0, eligible.length - limit);
                    resolve({ messages: eligible.slice(start), hasMore: start > 0 });
                };
                req.onerror = () => { warnLimited('chat page read failed', req.error); resolve({ messages: [], hasMore: false }); };
            } catch (error) { warnLimited('chat page read failed', error); resolve({ messages: [], hasMore: false }); }
        });
    },
    async memberAll(memberNumber) {
        const ownerMemberNumber = accountNumber();
        if (!ownerMemberNumber || !this.db) await this.init();
        if (!ownerMemberNumber || !this.db) return [];
        const target = Number(memberNumber);
        return new Promise(resolve => {
            try {
                const index = this.db.transaction('messages', 'readonly').objectStore('messages').index('memberNumber');
                const req = index.getAll(target);
                req.onsuccess = () => resolve((req.result || []).filter(message => Number(message.ownerMemberNumber) === ownerMemberNumber).sort((a, b) => Number(a.timestamp) - Number(b.timestamp)));
                req.onerror = () => { warnLimited('member chat history read failed', req.error); resolve([]); };
            } catch (error) { warnLimited('member chat history read failed', error); resolve([]); }
        });
    },
    async markRead(memberNumber) {
        const ownerMemberNumber = accountNumber();
        if (!ownerMemberNumber || !this.db) await this.init();
        if (!ownerMemberNumber || !this.db) return false;
        const target = Number(memberNumber);
        return new Promise(resolve => {
            try {
                const tx = this.db.transaction('messages', 'readwrite');
                const index = tx.objectStore('messages').index('memberNumber');
                const req = index.openCursor(IDBKeyRange.only(target));
                req.onsuccess = () => {
                    const cursor = req.result;
                    if (!cursor) return;
                    const message = cursor.value;
                    if (Number(message.ownerMemberNumber) === ownerMemberNumber && !message.read) cursor.update({ ...message, read: true });
                    cursor.continue();
                };
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => { warnLimited('chat read state update failed', tx.error); resolve(false); };
            } catch (error) { warnLimited('chat read state update failed', error); resolve(false); }
        });
    },
    async deleteMember(memberNumber) {
        if (!this.db) await this.init();
        if (!this.db) return false;
        const ownerMemberNumber = accountNumber();
        if (!ownerMemberNumber) return false;
        const target = Number(memberNumber);
        return new Promise(resolve => {
            try {
                const tx = this.db.transaction('messages', 'readwrite');
                const store = tx.objectStore('messages');
                const req = store.index('memberNumber').openCursor(IDBKeyRange.only(target));
                req.onsuccess = () => {
                    const cursor = req.result;
                    if (!cursor) return;
                    if (Number(cursor.value.ownerMemberNumber) === ownerMemberNumber) cursor.delete();
                    cursor.continue();
                };
                tx.oncomplete = () => resolve(true);
                tx.onerror = () => { warnLimited('member chat deletion failed', tx.error); resolve(false); };
            } catch (error) { warnLimited('member chat deletion failed', error); resolve(false); }
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
                tx.oncomplete = () => resolve(true); tx.onerror = () => { warnLimited('chat history clear failed', tx.error); resolve(false); };
            } catch (error) { warnLimited('chat history clear failed', error); resolve(false); }
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

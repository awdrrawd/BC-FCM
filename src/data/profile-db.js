import { cfg } from '../core/config.js';
import { T } from '../i18n/i18n.js';
import { inRoomFn } from './data.js';
// ════════════════════════════════════════
//  FCM module: profile-db.js
//  (split from Plugins/liko-FCM.user.js)
// ════════════════════════════════════════

    const PDB = {
        db: null,
        async init() {
            return new Promise(res => {
                try {
                    const req = indexedDB.open('bce-past-profiles');
                    req.onsuccess = () => { this.db = req.result; res(this.db.objectStoreNames.contains('profiles')); };
                    req.onerror = () => res(false);
                    req.onupgradeneeded = e => { const db = e.target.result; if (!db.objectStoreNames.contains('profiles')) db.createObjectStore('profiles', { keyPath: 'memberNumber' }); };
                } catch { res(false); }
            });
        },
        _face(C, sz = 44) {
            try {
                const src = C && C.Canvas; if (!src || !src.width) return '';
                const cv = document.createElement('canvas'); cv.width = cv.height = sz;
                const ctx = cv.getContext('2d');
                ctx.fillStyle = '#1a0028'; ctx.fillRect(0, 0, sz, sz);
                ctx.drawImage(src, src.width * 0.39, src.height * 0.40, src.width * 0.22, src.height * 0.11, 0, 0, sz, sz);
                return cv.toDataURL('image/jpeg', 0.85);
            } catch { return ''; }
        },
        save(C, raw) {
            if (cfg.saveMode === 'off' || !this.db || !C || !C.MemberNumber) return;
            try {
                const nick = (typeof CharacterNickname === 'function' ? CharacterNickname(C) : '') || C.Nickname || C.Name || '';
                const now = Date.now();
                const prof = { memberNumber: C.MemberNumber, name: C.Name || '', lastNick: nick, seen: now };
                if (cfg.saveMode === 'full') {
                    const src = raw || { MemberNumber: C.MemberNumber, Name: C.Name || '', Nickname: C.Nickname || '',
                                        LabelColor: C.LabelColor || '#fff', Description: C.Description || '',
                                        Title: C.Title || '', Appearance: C.Appearance || [],
                                        Lovership: C.Lovership || [], Reputation: C.Reputation || [] };
                    const b = { ...src };
                    ['ActivePose','Inventory','BlockItems','LimitedItems','FavoriteItems',
                     'ArousalSettings','OnlineSharedSettings','WhiteList','BlackList','Crafting',
                     'ItemPermission','InventoryData'].forEach(k => delete b[k]);
                    prof.characterBundle = JSON.stringify(b);
                }
                _pc[C.MemberNumber] = prof;
                this.db.transaction('profiles', 'readwrite').objectStore('profiles').put(prof);
                if (cfg.saveMode === 'avatar' || cfg.saveMode === 'full') {
                    // Do not regenerate a face merely because the profile was saved again.
                    // IndexedDB is authoritative; manual refresh remains the overwrite path.
                    Snapshot.get(C.MemberNumber).then(existing => {
                        if (existing) return;
                        const url = this._face(C);
                        if (url) Snapshot.save(C.MemberNumber, url, { source: 'profile-capture' });
                    });
                }
            } catch {}
        },
        get(mn) {
            mn = parseInt(mn); if (_pc[mn] !== undefined) return Promise.resolve(_pc[mn]); if (!this.db) { _pc[mn] = null; return Promise.resolve(null); }
            return new Promise(res => { try { const req = this.db.transaction('profiles', 'readonly').objectStore('profiles').get(mn); req.onsuccess = () => { _pc[mn] = req.result || null; res(_pc[mn]); }; req.onerror = () => { _pc[mn] = null; res(null); }; } catch { _pc[mn] = null; res(null); } });
        },
        async batchGet(mns) { for (const mn of mns) if (_pc[parseInt(mn)] === undefined) await this.get(mn); },
    };
    const _pc = {};
    const Snapshot = {
        db: null,
        _cache: {},
        _records: {},
        async init() {
            return new Promise(res => {
                try {
                    // Do not force-upgrade the shared avatar DB. Existing v1/v2 databases
                    // both keep the same `avatars` store and record key.
                    const req = indexedDB.open('fcm-snapshot');
                    req.onupgradeneeded = e => {
                        const db = e.target.result;
                        if (!db.objectStoreNames.contains('avatars')) {
                            db.createObjectStore('avatars', { keyPath: 'memberNumber' });
                        }
                    };
                    req.onsuccess = () => { this.db = req.result; res(true); };
                    req.onerror = () => res(false);
                } catch { res(false); }
            });
        },
        async save(mn, data, meta = {}) {
            mn = parseInt(mn);
            if (!this.db || !data) return;
            let blob = data;
            if (typeof data === 'string') {
                try { blob = await (await fetch(data)).blob(); } catch { return; }
            }
            if (!(blob instanceof Blob)) return;
            const oldUrl = this._cache[mn];
            if (typeof oldUrl === 'string' && oldUrl.startsWith('blob:')) URL.revokeObjectURL(oldUrl);
            const rec = {
                memberNumber: mn,
                blob,
                savedAt: Date.now(),
                source: meta.source || 'manual',
                sourceUpdatedAt: Number(meta.sourceUpdatedAt) || 0,
                sourceUrl: meta.sourceUrl || '',
            };
            this._records[mn] = rec;
            this._cache[mn] = URL.createObjectURL(blob);
            try { this.db.transaction('avatars', 'readwrite').objectStore('avatars').put(rec); } catch {}
        },
        getRecord(mn) {
            mn = parseInt(mn);
            if (this._records[mn] !== undefined) return Promise.resolve(this._records[mn]);
            if (!this.db) { this._records[mn] = null; return Promise.resolve(null); }
            return new Promise(res => {
                try {
                    const req = this.db.transaction('avatars', 'readonly').objectStore('avatars').get(mn);
                    req.onsuccess = async () => {
                        let r = req.result || null;
                        // v1 migration: turn the old data URL record into a Blob record.
                        if (r?.avatarDataUrl && !r.blob) {
                            try {
                                const blob = await (await fetch(r.avatarDataUrl)).blob();
                                r = { memberNumber: mn, blob, savedAt: r.savedAt || Date.now(), source: 'legacy', sourceUpdatedAt: 0, sourceUrl: '' };
                                this.db.transaction('avatars', 'readwrite').objectStore('avatars').put(r);
                            } catch {}
                        }
                        this._records[mn] = r;
                        res(r);
                    };
                    req.onerror = () => { this._records[mn] = null; res(null); };
                } catch { this._records[mn] = null; res(null); }
            });
        },
        get(mn) {
            mn = parseInt(mn);
            if (this._cache[mn] !== undefined) return Promise.resolve(this._cache[mn]);
            return this.getRecord(mn).then(r => {
                if (!r) { this._cache[mn] = null; return null; }
                if (r.blob instanceof Blob) this._cache[mn] = URL.createObjectURL(r.blob);
                else this._cache[mn] = r.avatarDataUrl || null;
                return this._cache[mn];
            });
        },
        async batchGet(mns) {
            for (const mn of mns) {
                const k = parseInt(mn);
                if (this._cache[k] === undefined) await this.get(k);
            }
        },
        async delete(mn) {
            mn = parseInt(mn);
            const url = this._cache[mn];
            if (typeof url === 'string' && url.startsWith('blob:')) URL.revokeObjectURL(url);
            delete this._cache[mn];
            delete this._records[mn];
            if (!this.db) return;
            return new Promise(res => {
                try {
                    const req = this.db.transaction('avatars', 'readwrite').objectStore('avatars').delete(mn);
                    req.onsuccess = req.onerror = () => res();
                } catch { res(); }
            });
        },
        async clear() {
            Object.values(this._cache).forEach(url => { if (typeof url === 'string' && url.startsWith('blob:')) URL.revokeObjectURL(url); });
            Object.keys(this._cache).forEach(k => delete this._cache[k]);
            Object.keys(this._records).forEach(k => delete this._records[k]);
            if (!this.db) return;
            return new Promise(res => {
                try {
                    const req = this.db.transaction('avatars', 'readwrite').objectStore('avatars').clear();
                    req.onsuccess = () => res();
                    req.onerror = () => res();
                } catch { res(); }
            });
        },
    };

    function _sharedFcmProfile(C) {
        const data = C?.OnlineSharedSettings?.FCM;
        return data && typeof data === 'object' ? data : null;
    }

    async function _blobFromSharedProfile(shared) {
        if (typeof shared?.avatarUrl === 'string' && shared.avatarUrl) {
            try {
                const response = await fetch(shared.avatarUrl, { cache: 'force-cache' });
                if (response.ok) return { blob: await response.blob(), source: 'shared-url', sourceUrl: shared.avatarUrl };
            } catch {}
        }
        if (typeof shared?.avatarSnapshot === 'string' && shared.avatarSnapshot.startsWith('data:image/')) {
            try { return { blob: await (await fetch(shared.avatarSnapshot)).blob(), source: 'shared-snapshot', sourceUrl: '' }; } catch {}
        }
        return null;
    }

    // Room entry order: shared FCM data -> timestamp comparison -> legacy capture only when no data exists.
    async function syncRoomAvatar(C) {
        const mn = parseInt(C?.MemberNumber);
        if (!mn || mn === parseInt(Player?.MemberNumber)) return null;
        const record = await Snapshot.getRecord(mn);
        const shared = _sharedFcmProfile(C);
        const remoteTime = Number(shared?.avatarUpdatedAt) || 0;
        if (shared?.avatarMode === 'none') return record ? Snapshot.get(mn) : null;
        if (shared && (shared.avatarUrl || shared.avatarSnapshot)) {
            if (record && (remoteTime === 0 || Number(record.sourceUpdatedAt) >= remoteTime)) return Snapshot.get(mn);
            const received = await _blobFromSharedProfile(shared);
            if (received) {
                await Snapshot.save(mn, received.blob, { ...received, sourceUpdatedAt: remoteTime });
                return Snapshot.get(mn);
            }
        }
        if (record) return Snapshot.get(mn);
        _captureSnapshotDelayed(C);
        return null;
    }

    function ensureOwnSharedProfile() {
        if (!Player) return null;
        Player.OnlineSharedSettings ??= {};
        Player.OnlineSharedSettings.FCM ??= {};
        const p = Player.OnlineSharedSettings.FCM;
        p.version ??= 1;
        p.avatarMode ??= cfg.avatarMode || 'game';
        p.avatarUrl ??= cfg.avatarMode === 'url' ? (cfg.avatarUrl || '') : '';
        p.avatarSnapshot ??= '';
        p.avatarUpdatedAt ??= 0;
        p.signature ??= '';
        p.status ??= 'online';
        p.busyMessage ??= cfg.busyMessage || '';
        p.afkMessage ??= cfg.afkMessage || '';
        p.profileUpdatedAt ??= 0;
        return p;
    }

    async function updateOwnAvatarSnapshot() {
        const shared = ensureOwnSharedProfile();
        if (!shared || !Player?.Canvas?.width) return false;
        const dataUrl = PDB._face(Player, 100);
        if (!dataUrl) return false;
        shared.avatarSnapshot = dataUrl;
        shared.avatarUpdatedAt = Date.now();
        try { ServerAccountUpdate.QueueData({ OnlineSharedSettings: Player.OnlineSharedSettings }); } catch { return false; }
        return true;
    }

    async function ensureOwnAvatarSnapshot() {
        const shared = ensureOwnSharedProfile();
        if (shared?.avatarMode === 'none') return false;
        if (!shared || shared.avatarSnapshot) return !!shared?.avatarSnapshot;
        return updateOwnAvatarSnapshot();
    }

    async function updateOwnAvatarProfile(mode, avatarUrl = '') {
        const shared = ensureOwnSharedProfile();
        if (!shared) return false;
        shared.avatarMode = ['url', 'game', 'none'].includes(mode) ? mode : 'game';
        shared.avatarUrl = shared.avatarMode === 'url' ? String(avatarUrl || '').trim() : '';
        if (shared.avatarMode !== 'none' && !shared.avatarSnapshot) await updateOwnAvatarSnapshot();
        shared.avatarUpdatedAt = Date.now();
        try { ServerAccountUpdate.QueueData({ OnlineSharedSettings: Player.OnlineSharedSettings }); return true; } catch { return false; }
    }
    const _avQueue = []; let _avBusy = false;
    let _avStatusEl = null;

    async function detectWCESave() {
        try { if (typeof fbcSettings !== 'undefined' && fbcSettings.pastProfiles === true) return true; } catch {}
        try { if (PDB.db && PDB.db.objectStoreNames.contains('notes')) return true; } catch {}
        try { if (window.BCE_VERSION || window.FBC_VERSION) return true; } catch {}
        return false;
    }

    function queueAvatarLoad(mn, profile, onDone) {
        mn = parseInt(mn);
        const cached = Snapshot._cache[mn];
        if (cached) { onDone(cached); return; }
        if (_avQueue.some(q => q.mn === mn)) return;
        _avQueue.push({ mn, profile, onDone });
        if (!_avBusy) _processAvQueue();
    }

    async function _processAvQueue() {
        if (_avBusy || _avQueue.length === 0) return;
        _avBusy = true;
        function updateStatus() { const n = _avQueue.length + 1; if (_avStatusEl) _avStatusEl.textContent = T('reloadStatusLoading', n); }
        while (_avQueue.length > 0) {
            const { mn, profile, onDone } = _avQueue.shift();
            updateStatus();
            const alreadyCached = await Snapshot.get(mn);
            if (alreadyCached) { onDone(alreadyCached); continue; }
            const url = await loadAvatarFromBundle(mn, profile);
            if (url) onDone(url);
            await new Promise(r => setTimeout(r, 80));
        }
        _avBusy = false;
        if (_avStatusEl) { _avStatusEl.textContent = T('reloadStatusDone'); setTimeout(() => { if (_avStatusEl) _avStatusEl.textContent = ''; }, 3000); }
    }

    async function loadAvatarFromBundle(mn, profile) {
        mn = parseInt(mn);
        if (!profile?.characterBundle) return null;
        if (inRoomFn(mn)) return null;
        try {
            const data = JSON.parse(profile.characterBundle);
            if (typeof CharacterLoadOnline !== 'function') return null;
            const C = CharacterLoadOnline(data, mn);
            if (!C) return null;
            if (typeof CharacterRefresh === 'function') CharacterRefresh(C, false, undefined);
            let prev = '', stable = 0, url = '';
            for (let i = 0; i < 40; i++) {
                await new Promise(r => requestAnimationFrame(r));
                const cur = PDB._face(C, 44);
                if (cur && cur.length > 800) {
                    if (cur === prev) {
                        stable++;
                        if (stable >= 3) { url = cur; break; }
                    } else {
                        stable = 0; prev = cur;
                    }
                }
            }
            try {
                if (Array.isArray(Character)) {
                    const live = new Set((ChatRoomCharacter || []).map(c => c.MemberNumber));
                    const idx = Character.findIndex(c => c.MemberNumber === mn && !live.has(mn));
                    if (idx >= 0) Character.splice(idx, 1);
                }
            } catch {}
            if (url && url.length > 800) Snapshot.save(mn, url, { source: 'manual' });
            return url || null;
        } catch { return null; }
    }
    function _captureSnapshotDelayed(C) {
        if (!C || !C.MemberNumber || C.MemberNumber === parseInt(Player?.MemberNumber)) return;
        if (Snapshot._cache[C.MemberNumber]) return;
        const mn = C.MemberNumber;
        let stable = 0, prev = '';
        const check = () => {
            if (Snapshot._cache[mn]) return;
            const url = PDB._face(C, 44);
            if (url && url.length > 800) {
                if (url === prev) {
                    stable++;
                    if (stable >= 3) { Snapshot.save(mn, url, { source: 'room-capture' }); return; }
                } else { stable = 0; prev = url; }
            }
            setTimeout(check, 600);
        };
        setTimeout(check, 1500);
    }
    function setAvStatusEl(v) { _avStatusEl = v; }

export { PDB, _pc, Snapshot, detectWCESave, _avQueue, _avBusy, _avStatusEl, setAvStatusEl, _processAvQueue, loadAvatarFromBundle, queueAvatarLoad, _captureSnapshotDelayed, syncRoomAvatar, ensureOwnSharedProfile, ensureOwnAvatarSnapshot, updateOwnAvatarSnapshot, updateOwnAvatarProfile };

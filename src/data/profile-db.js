import { cfg } from '../core/config.js';
import { T } from '../i18n/i18n.js';
import { inRoomFn } from './data.js';
import { profileCache as _pc } from './profile-cache.js';
import { warnLimited } from '../core/logger.js';

function normalizeProfile(profile, allowNameOnly) {
    const memberNumber = Number(profile?.memberNumber);
    if (!Number.isSafeInteger(memberNumber) || memberNumber <= 0 || !Number.isFinite(profile?.seen) || profile.seen <= 0) return null;
    try {
        const bundle = typeof profile.characterBundle === 'string' ? JSON.parse(profile.characterBundle) : null;
        if (typeof profile.characterBundle === 'string' && (!bundle || typeof bundle !== 'object')) return null;
        if ([profile.name, bundle?.Name].some(value => value !== undefined && typeof value !== 'string')) return null;
        // BC/WCE serialize an unset nickname as either null or an absent property.
        if ([profile.lastNick, bundle?.Nickname].some(value => value != null && typeof value !== 'string')) return null;
        if (bundle ? Number(bundle.MemberNumber) !== memberNumber || !Array.isArray(bundle.Appearance)
            : !allowNameOnly || typeof profile.name !== 'string') return null;
        return {
            memberNumber, name: bundle?.Name || profile.name || '',
            lastNick: bundle?.Nickname || profile.lastNick || bundle?.Name || profile.name || '',
            seen: profile.seen, ...(bundle ? { characterBundle: profile.characterBundle } : {}),
        };
    } catch { return null; }
}

function mergeProfile(existing, incoming) {
    if (existing && Number(existing.seen ?? existing.savedAt) >= incoming.seen) return existing;
    const saved = { ...existing, ...incoming };
    // Keep the full bundle's observation date when only a newer name is available.
    if (!incoming.characterBundle && existing?.characterBundle) saved.seen = existing.seen ?? existing.savedAt;
    return saved;
}
// ════════════════════════════════════════
//  FCM module: profile-db.js
//  (split from Plugins/liko-FCM.user.js)
// ════════════════════════════════════════

    const PDB = {
        db: null,
        opening: null,
        async init() {
            if (this.db) return true;
            if (this.opening) return this.opening;
            this.opening = new Promise(res => {
                try {
                    // Shared with WCE/LCE: omit the version to retain the existing DB version.
                    // Never raise it without explicit user direction; discuss schema changes first,
                    // since a higher version breaks plugins that still request an older version.
                    // Liko.LCE.profileDatabase exposes compatibility metadata, not upgrade authority.
                    const req = indexedDB.open('bce-past-profiles');
                    req.onsuccess = () => {
                        const db = req.result;
                        if (!db.objectStoreNames.contains('profiles')) { db.close(); res(false); return; }
                        this.db = db;
                        db.onversionchange = () => {
                            db.close();
                            if (this.db === db) this.db = null;
                            for (const key of Object.keys(_pc)) delete _pc[key];
                            // Reopen without a version after yielding to the pending upgrade.
                            setTimeout(() => { void this.init(); }, 0);
                        };
                        res(true);
                    };
                    req.onerror = () => res(false);
                    req.onupgradeneeded = e => { const db = e.target.result; if (!db.objectStoreNames.contains('profiles')) db.createObjectStore('profiles', { keyPath: 'memberNumber' }); };
                } catch (error) { warnLimited('profile database open failed', error); res(false); }
            });
            try { return await this.opening; }
            finally { this.opening = null; }
        },
        capture(raw) {
            if (cfg.saveMode !== 'full' || !raw?.MemberNumber) return null;
            try {
                const bundle = { ...raw };
                ['ActivePose', 'Inventory', 'BlockItems', 'LimitedItems', 'FavoriteItems',
                    'ArousalSettings', 'OnlineSharedSettings', 'WhiteList', 'BlackList', 'Crafting',
                    'ItemPermission', 'InventoryData'].forEach(key => delete bundle[key]);
                return JSON.stringify(bundle);
            } catch (error) { warnLimited('profile capture failed', error); return null; }
        },
        _face(C, sz = 100) {
            try {
                const src = C && C.Canvas; if (!src || !src.width) return '';
                const cv = document.createElement('canvas'); cv.width = cv.height = sz;
                const ctx = cv.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.fillStyle = '#1a0028'; ctx.fillRect(0, 0, sz, sz);
                const cropSize = 210;
                ctx.drawImage(src, src.width / 2 - cropSize / 2, 740, cropSize, cropSize, 0, 0, sz, sz);
                return cv.toDataURL('image/webp', 0.9);
            } catch (error) { warnLimited('profile avatar rendering failed', error); return ''; }
        },
        async captureFace(C, size = 100, { warmup = 2500, timeout = 10000 } = {}) {
            // A canvas can exist before its textures finish loading. Require a warm-up and
            // repeated stable captures, resetting whenever BC requests another redraw.
            let previous = '', stable = 0;
            globalThis.CharacterLoadCanvas?.(C);
            const started = Date.now();
            while (Date.now() - started < timeout) {
                await new Promise(resolve => setTimeout(resolve, 500));
                if (C?.MustDraw) {
                    globalThis.CharacterLoadCanvas?.(C);
                    previous = ''; stable = 0;
                    continue;
                }
                const url = this._face(C, size);
                if (Date.now() - started < warmup || !url || url.length <= 800) { previous = ''; stable = 0; continue; }
                stable = url === previous ? stable + 1 : 0;
                previous = url;
                if (stable >= 3) return url;
            }
            return null;
        },
        async save(C, characterBundle) {
            const mode = cfg.saveMode;
            if (mode === 'off' || !C?.MemberNumber) return;
            // Avatar persistence is independent of profile serialization and its DB connection.
            if (mode === 'avatar' || mode === 'full') {
                try {
                    if (!await Snapshot.get(C.MemberNumber)) {
                        const url = await this.captureFace(C);
                        if (url && !await Snapshot.get(C.MemberNumber)) await Snapshot.save(C.MemberNumber, url, { source: 'profile-capture' });
                    }
                } catch (error) { warnLimited('profile avatar save failed', error); }
            }
            if (mode === 'avatar' || (mode === 'full' && typeof characterBundle !== 'string')) return;
            try {
                if (!await this.init()) return;
                const nick = (typeof CharacterNickname === 'function' ? CharacterNickname(C) : '') || C.Nickname || C.Name || '';
                const now = Date.now();
                const prof = { memberNumber: C.MemberNumber, name: C.Name || '', lastNick: nick, seen: now };
                if (mode === 'full') prof.characterBundle = characterBundle;
                await new Promise((resolve, reject) => {
                    const tx = this.db.transaction('profiles', 'readwrite');
                    const store = tx.objectStore('profiles');
                    const req = store.get(C.MemberNumber);
                    let saved;
                    req.onsuccess = () => {
                        saved = { ...req.result, ...prof };
                        // A name-only observation must not make an old full bundle look newer.
                        if (mode === 'name' && req.result?.characterBundle) saved.seen = req.result.seen;
                        store.put(saved);
                    };
                    tx.oncomplete = () => { _pc[C.MemberNumber] = saved; resolve(); };
                    tx.onerror = tx.onabort = () => reject(tx.error);
                });
            } catch (error) { warnLimited('profile cache write failed', error); }
        },
        async receiveShared(profile, { allowNameOnly = false } = {}) {
            const incoming = normalizeProfile(profile, allowNameOnly);
            if (!incoming) return false;
            const { memberNumber } = incoming;
            try {
                if (!this.db) await this.init();
                if (!this.db?.objectStoreNames.contains('profiles')) return false;
                return await new Promise(resolve => {
                    const tx = this.db.transaction('profiles', 'readwrite');
                    const store = tx.objectStore('profiles');
                    const req = store.get(memberNumber);
                    let saved, changed = false;
                    req.onsuccess = () => {
                        const existing = req.result;
                        // Compare observation times, never the time the share arrived.
                        saved = mergeProfile(existing, incoming);
                        if (saved !== existing) { store.put(saved); changed = true; }
                    };
                    tx.oncomplete = () => { _pc[memberNumber] = saved; resolve(changed); };
                    tx.onerror = tx.onabort = () => { warnLimited('shared profile save failed', tx.error); resolve(false); };
                });
            } catch (error) { warnLimited('shared profile save failed', error); return false; }
        },
        async get(mn) {
            mn = parseInt(mn);
            if (!await this.init()) return null;
            return new Promise(res => { try { const req = this.db.transaction('profiles', 'readonly').objectStore('profiles').get(mn); req.onsuccess = () => { _pc[mn] = req.result || null; res(_pc[mn]); }; req.onerror = () => { warnLimited('profile cache read failed', req.error); _pc[mn] = null; res(null); }; } catch (error) { warnLimited('profile cache read failed', error); _pc[mn] = null; res(null); } });
        },
        async batchGet(mns) { await Promise.all([...new Set(mns)].map(mn => this.get(mn))); },
        async getAll(storeName = 'profiles') {
            if (!['profiles', 'notes'].includes(storeName)) throw new Error('Unsupported profile store');
            if (!await this.init()) throw new Error('Profile database unavailable');
            if (!this.db.objectStoreNames.contains(storeName)) return [];
            return new Promise((resolve, reject) => {
                const req = this.db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
                req.onsuccess = () => {
                    const rows = req.result || [];
                    if (storeName === 'profiles') {
                        for (const key of Object.keys(_pc)) delete _pc[key];
                        for (const row of rows) _pc[row.memberNumber] = row;
                    }
                    resolve(rows);
                };
                req.onerror = () => reject(req.error);
            });
        },
        async exportBackup() {
            const profiles = await this.getAll();
            const notes = await this.getAll('notes');
            return { exportedAt: new Date().toISOString(), dbVersion: this.db.version, profiles, notes };
        },
        async importBackup(data) {
            if (!data || !Array.isArray(data.profiles) || (data.notes !== undefined && !Array.isArray(data.notes))) throw new Error('Invalid profile backup');
            if (!await this.init()) throw new Error('Profile database unavailable');
            const result = { pc: 0, nc: 0, kept: 0, invalid: 0, unavailableNotes: 0 };
            // Backup dbVersion is informational only. Never upgrade or create stores for an import.
            for (const [storeName, rows] of [['profiles', data.profiles], ['notes', data.notes || []]]) {
                if (!this.db.objectStoreNames.contains(storeName)) { result.unavailableNotes += rows.length; continue; }
                // Bound transaction size and yield between batches for large backups.
                for (let offset = 0; offset < rows.length; offset += 100) {
                    const batch = rows.slice(offset, offset + 100).map(row => {
                        if (storeName === 'profiles') return normalizeProfile({ ...row, seen: row?.seen || row?.savedAt }, true);
                        if (!Number.isSafeInteger(row?.memberNumber) || row.memberNumber <= 0 || typeof row.note !== 'string'
                            || !Number.isFinite(row.updatedAt) || row.updatedAt < 0) return null;
                        return { memberNumber: row.memberNumber, note: row.note, updatedAt: row.updatedAt };
                    });
                    await new Promise((resolve, reject) => {
                        const tx = this.db.transaction(storeName, 'readwrite');
                        const store = tx.objectStore(storeName);
                        const committed = new Map();
                        let changed = 0, kept = 0, invalid = 0;
                        let index = 0;
                        // Queue the next read after the preceding write, including duplicate IDs.
                        const next = () => {
                            while (index < batch.length && !batch[index]) { invalid++; index++; }
                            if (index === batch.length) return;
                            const incoming = batch[index++];
                            const req = store.get(incoming.memberNumber);
                            req.onsuccess = () => {
                                const existing = req.result;
                                const saved = storeName === 'profiles' ? mergeProfile(existing, incoming)
                                    : existing && Number(existing.updatedAt) >= incoming.updatedAt ? existing : incoming;
                                if (saved !== existing) { store.put(saved); changed++; }
                                else kept++;
                                committed.set(incoming.memberNumber, saved);
                                next();
                            };
                        };
                        tx.oncomplete = () => {
                            if (storeName === 'profiles') for (const [id, row] of committed) _pc[id] = row;
                            result[storeName === 'profiles' ? 'pc' : 'nc'] += changed;
                            result.kept += kept; result.invalid += invalid;
                            resolve();
                        };
                        tx.onerror = tx.onabort = () => reject(tx.error || new Error('Profile import transaction failed'));
                        next();
                    });
                }
            }
            return result;
        },
    };
    const Snapshot = {
        _urlUsers: new Map(),
        _retiredUrls: new Set(),
        retainUrl(url) {
            if (url?.startsWith('blob:')) this._urlUsers.set(url, (this._urlUsers.get(url) || 0) + 1);
        },
        releaseUrl(url) {
            const count = this._urlUsers.get(url) || 0;
            if (count > 1) { this._urlUsers.set(url, count - 1); return; }
            this._urlUsers.delete(url);
            if (this._retiredUrls.delete(url)) URL.revokeObjectURL(url);
        },
        _retireUrl(url) {
            if (!url?.startsWith('blob:')) return;
            if (this._urlUsers.has(url)) this._retiredUrls.add(url);
            else URL.revokeObjectURL(url);
        },
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
                } catch (error) { warnLimited('avatar database open failed', error); res(false); }
            });
        },
        async save(mn, data, meta = {}) {
            mn = parseInt(mn);
            if (!this.db || !data) return;
            let blob = data;
            if (typeof data === 'string') {
                try { blob = await (await fetch(data)).blob(); } catch (error) { warnLimited('avatar data conversion failed', error); return; }
            }
            if (!(blob instanceof Blob)) return;
            const oldUrl = this._cache[mn];
            this._retireUrl(oldUrl);
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
            window.dispatchEvent(new CustomEvent('fcm-avatar-updated', { detail: { memberNumber: mn } }));
            try { this.db.transaction('avatars', 'readwrite').objectStore('avatars').put(rec); } catch (error) { warnLimited('avatar cache write failed', error); }
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
                            } catch (error) { warnLimited('legacy avatar migration failed', error); }
                        }
                        this._records[mn] = r;
                        res(r);
                    };
                    req.onerror = () => { this._records[mn] = null; res(null); };
                } catch (error) { warnLimited('avatar cache read failed', error); this._records[mn] = null; res(null); }
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
            this._retireUrl(url);
            delete this._cache[mn];
            delete this._records[mn];
            if (!this.db) return;
            return new Promise(res => {
                try {
                    const req = this.db.transaction('avatars', 'readwrite').objectStore('avatars').delete(mn);
                    req.onsuccess = req.onerror = () => res();
                } catch (error) { warnLimited('avatar cache deletion failed', error); res(); }
            });
        },
        async clear() {
            Object.values(this._cache).forEach(url => this._retireUrl(url));
            Object.keys(this._cache).forEach(k => delete this._cache[k]);
            Object.keys(this._records).forEach(k => delete this._records[k]);
            if (!this.db) return;
            return new Promise(res => {
                try {
                    const req = this.db.transaction('avatars', 'readwrite').objectStore('avatars').clear();
                    req.onsuccess = () => res();
                    req.onerror = () => res();
                } catch (error) { warnLimited('avatar cache clear failed', error); res(); }
            });
        },
    };

    function _sharedFcmProfile(C) {
        const data = C?.OnlineSharedSettings?.FCM;
        return data && typeof data === 'object' ? data : null;
    }

    async function _blobFromSharedProfile(shared) {
        if (typeof shared?.avatarUrl === 'string' && shared.avatarUrl) {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            try {
                const response = await fetch(shared.avatarUrl, { cache: 'force-cache', referrerPolicy: 'no-referrer', signal: controller.signal });
                const declaredSize = Number(response.headers.get('content-length')) || 0;
                const mime = String(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
                if (!response.ok || declaredSize > 2 * 1024 * 1024 || !mime.startsWith('image/')) throw new Error('invalid image response');
                const blob = await response.blob();
                if (blob.size > 2 * 1024 * 1024 || !String(blob.type).toLowerCase().startsWith('image/')) throw new Error('invalid image data');
                return { blob, source: 'shared-url', sourceUrl: shared.avatarUrl };
            } catch (error) {
                if (error?.name !== 'AbortError') console.warn('🐈‍⬛ [FCM] shared avatar download failed:', error?.message || error);
            } finally { clearTimeout(timeout); }
        }
        if (typeof shared?.avatarSnapshot === 'string' && shared.avatarSnapshot.startsWith('data:image/')) {
            try { return { blob: await (await fetch(shared.avatarSnapshot)).blob(), source: 'shared-snapshot', sourceUrl: '' }; } catch (error) { warnLimited('shared avatar snapshot decode failed', error); }
        }
        return null;
    }

    // Room entry order: shared FCM data -> timestamp comparison -> legacy capture only when no data exists.
    async function syncRoomAvatar(C) {
        const mn = parseInt(C?.MemberNumber);
        if (!mn || mn === parseInt(Player?.MemberNumber)) return null;
        let record = await Snapshot.getRecord(mn);
        const shared = _sharedFcmProfile(C);
        const remoteTime = Number(shared?.avatarUpdatedAt) || 0;
        if (record?.blob && typeof createImageBitmap === 'function') {
            try {
                const bitmap = await createImageBitmap(record.blob);
                const lowResolution = bitmap.width < 90 || bitmap.height < 90;
                bitmap.close();
                if (lowResolution) {
                    const upgraded = await PDB.captureFace(C, 100);
                    if (upgraded) {
                        await Snapshot.save(mn, upgraded, { source: 'resolution-upgrade', sourceUpdatedAt: remoteTime });
                        record = await Snapshot.getRecord(mn);
                    }
                }
            } catch (error) { warnLimited(`avatar refresh check failed (${mn})`, error); }
        }
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
        const dataUrl = await PDB.captureFace(Player, 100);
        if (!dataUrl) return false;
        shared.avatarSnapshot = dataUrl;
        shared.avatarUpdatedAt = Date.now();
        if (!Snapshot.db) await Snapshot.init();
        await Snapshot.save(Player.MemberNumber, dataUrl, { source: 'manual-self', sourceUpdatedAt: shared.avatarUpdatedAt });
        try { ServerAccountUpdate.QueueData({ OnlineSharedSettings: Player.OnlineSharedSettings }); } catch (error) { warnLimited('avatar snapshot sync failed', error); return false; }
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
        try { ServerAccountUpdate.QueueData({ OnlineSharedSettings: Player.OnlineSharedSettings }); return true; } catch (error) { warnLimited('avatar profile sync failed', error); return false; }
    }
    const _avQueue = []; let _avBusy = false;
    let _avStatusEl = null;

    async function detectWCESave() {
        try {
            if (globalThis.FBC_VERSION && typeof globalThis.fbcSettingValue === 'function'
                && globalThis.fbcSettingValue('pastProfiles') === true) return true;
        } catch {}
        try {
            const lce = window.Liko?.LCE;
            if (typeof lce?.pastProfiles?.get === 'function' && lce.getFeature?.('pastProfiles') === true) return true;
        } catch {}
        return false;
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
            onDone(url);
            await new Promise(r => setTimeout(r, 80));
        }
        _avBusy = false;
        if (_avStatusEl) { _avStatusEl.textContent = T('reloadStatusDone'); setTimeout(() => { if (_avStatusEl) _avStatusEl.textContent = ''; }, 3000); }
    }

    async function loadAvatarFromBundle(mn, profile) {
        mn = parseInt(mn);
        if (!profile?.characterBundle) return null;
        if (inRoomFn(mn)) return null;
        let C = null;
        let existedBefore = false;
        try {
            const data = JSON.parse(profile.characterBundle);
            if (typeof CharacterLoadOnline !== 'function') return null;
            existedBefore = Array.isArray(Character) && Character.some(character =>
                String(character?.CharacterID) === String(data.ID) || Number(character?.MemberNumber) === mn);
            C = CharacterLoadOnline(data, mn);
            if (!C) return null;
            if (typeof CharacterRefresh === 'function') CharacterRefresh(C, false, undefined);

            // A newly reconstructed character needs time for BC's image/texture cache to finish.
            // Loaded assets mark C.MustDraw; rebuild on that signal, then require several identical
            // captures after the warm-up period. A timeout prevents a failed asset from blocking forever.
            const url = await PDB.captureFace(C, 100, {
                warmup: existedBefore ? 500 : 5000,
                timeout: existedBefore ? 7000 : 12000,
            });
            if (url && url.length > 800) await Snapshot.save(mn, url, { source: 'manual' });
            return url || null;
        } catch (error) { warnLimited(`avatar reconstruction failed (${mn})`, error); return null; }
        finally {
            // CharacterLoadOnline registers reconstructed characters globally. Release temporary ones
            // through BC's cleanup path so animations and character-owned resources are purged as well.
            try {
                const isLive = C && (C === Player || C === globalThis.CurrentCharacter
                    || C === globalThis.CharacterAppearanceSelection
                    || (ChatRoomCharacter || []).includes(C));
                if (C && !isLive && typeof globalThis.CharacterDelete === 'function') globalThis.CharacterDelete(C, false);
            } catch (error) { warnLimited(`temporary avatar character cleanup failed (${mn})`, error); }
        }
    }
    const pendingRoomCaptures = new Set();
    function _captureSnapshotDelayed(C) {
        if (!C || !C.MemberNumber || C.MemberNumber === parseInt(Player?.MemberNumber)) return;
        if (Snapshot._cache[C.MemberNumber]) return;
        const mn = C.MemberNumber;
        if (pendingRoomCaptures.has(mn)) return;
        pendingRoomCaptures.add(mn);
        void PDB.captureFace(C, 100).then(async url => {
            if (url && !await Snapshot.get(mn)) await Snapshot.save(mn, url, { source: 'room-capture' });
        }).catch(error => warnLimited('room avatar capture failed', error))
            .finally(() => pendingRoomCaptures.delete(mn));
    }
    function setAvStatusEl(v) { _avStatusEl = v; }

export { PDB, _pc, Snapshot, detectWCESave, _avQueue, _avBusy, setAvStatusEl, _processAvQueue, loadAvatarFromBundle, _captureSnapshotDelayed, syncRoomAvatar, ensureOwnAvatarSnapshot, updateOwnAvatarSnapshot, updateOwnAvatarProfile };

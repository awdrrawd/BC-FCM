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
                    const url = this._face(C);
                    if (url) Snapshot.save(C.MemberNumber, url);
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
        async init() {
            return new Promise(res => {
                try {
                    const req = indexedDB.open('fcm-snapshot', 1);
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
        save(mn, dataUrl) {
            mn = parseInt(mn);
            if (!this.db || !dataUrl) return;
            const rec = { memberNumber: mn, avatarDataUrl: dataUrl, savedAt: Date.now() };
            this._cache[mn] = dataUrl;
            try { this.db.transaction('avatars', 'readwrite').objectStore('avatars').put(rec); } catch {}
        },
        get(mn) {
            mn = parseInt(mn);
            if (this._cache[mn] !== undefined) return Promise.resolve(this._cache[mn]);
            if (!this.db) { this._cache[mn] = null; return Promise.resolve(null); }
            return new Promise(res => {
                try {
                    const req = this.db.transaction('avatars', 'readonly').objectStore('avatars').get(mn);
                    req.onsuccess = () => { const r = req.result; this._cache[mn] = r ? r.avatarDataUrl : null; res(this._cache[mn]); };
                    req.onerror = () => { this._cache[mn] = null; res(null); };
                } catch { this._cache[mn] = null; res(null); }
            });
        },
        async batchGet(mns) {
            for (const mn of mns) {
                const k = parseInt(mn);
                if (this._cache[k] === undefined) await this.get(k);
            }
        },
        async clear() {
            Object.keys(this._cache).forEach(k => delete this._cache[k]);
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
            if (alreadyCached && alreadyCached.length > 800) { onDone(alreadyCached); continue; }
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
            if (url && url.length > 800) Snapshot.save(mn, url);
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
                    if (stable >= 3) { Snapshot.save(mn, url); return; }
                } else { stable = 0; prev = url; }
            }
            setTimeout(check, 600);
        };
        setTimeout(check, 1500);
    }
    function setAvStatusEl(v) { _avStatusEl = v; }

export { PDB, _pc, Snapshot, detectWCESave, _avQueue, _avBusy, _avStatusEl, setAvStatusEl, _processAvQueue, loadAvatarFromBundle, queueAvatarLoad, _captureSnapshotDelayed };

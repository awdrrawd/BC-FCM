import { warnLimited } from '../core/logger.js';

const OPEN_TIMEOUT_MS = 15_000;

/**
 * Opens an IndexedDB database the way every FCM store must: WITHOUT a version.
 *
 * - Omitting the version keeps whatever version another plugin (WCE/LCE/LianChat)
 *   already created, so FCM can never cause an asymmetric upgrade.
 * - `upgrade(db)` only runs when the database does not exist yet (version 1), which
 *   is the one situation where creating stores is safe.
 * - When another context wants to upgrade the database, we close our connection at
 *   once so the upgrade is never blocked, then report it through `onLost(db)` so the
 *   owner can drop its handle (and reopen if it wants).
 * - An open that stays queued behind someone else's blocked upgrade resolves to null
 *   after `timeout` instead of hanging its callers; a connection that arrives after
 *   the timeout is closed immediately.
 *
 * Resolves to the open database, or null on any failure. Never rejects.
 */
function openVersionless(name, { upgrade, onLost, timeout = OPEN_TIMEOUT_MS } = {}) {
    return new Promise(resolve => {
        let settled = false;
        let timer = null;
        const finish = db => {
            if (settled) { db?.close(); return; }   // late success after a timeout: don't leak the connection
            settled = true;
            clearTimeout(timer);
            resolve(db);
        };
        try {
            const request = indexedDB.open(name);
            request.onupgradeneeded = event => { try { upgrade?.(event.target.result); } catch (error) { warnLimited(`${name} schema creation failed`, error); } };
            request.onsuccess = () => {
                const db = request.result;
                if (settled) { db.close(); return; }
                db.onversionchange = () => { db.close(); onLost?.(db); };
                db.onclose = () => onLost?.(db);
                finish(db);
            };
            request.onerror = () => { warnLimited(`${name} database open failed`, request.error); finish(null); };
            timer = setTimeout(() => { warnLimited(`${name} database open timed out`, 'another connection is blocking it'); finish(null); }, timeout);
        } catch (error) {
            warnLimited(`${name} database open failed`, error);
            finish(null);
        }
    });
}

export { openVersionless, OPEN_TIMEOUT_MS };

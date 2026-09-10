import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
const hooks = registerHooks({ load(url, context, next) {
    if (url.endsWith('/services/chat-content.js')) return { format: 'module', source: 'export const esc = value => String(value);', shortCircuit: true };
    return next(url, context);
} });
const { createChatContactService } = await import('../src/communication/chat/services/chat-contact-service.js');
hooks.deregister();

test('chat and balloon share decoded sources, snapshot refresh, URL mode and failed-load fallback', async () => {
    const listeners = new Map();
    const decoding = new Map();
    globalThis.window = { addEventListener: (name, handler) => listeners.set(name, handler) };
    globalThis.Node = { TEXT_NODE: 3 };
    globalThis.Image = class {
        decode() { return new Promise((resolve, reject) => decoding.set(this.src, { resolve, reject })); }
    };
    const rows = [0, 1].map(() => ({
        dataset: { avatarMember: '7' }, childNodes: [], image: null,
        querySelector() { return this.image; },
        insertBefore(image) { this.image = image; image.owner = this; },
    }));
    globalThis.document = {
        querySelectorAll: () => rows,
        createElement: () => ({
            getAttribute() { return this.src; },
            replaceWith(image) { this.owner.image = image; image.owner = this.owner; },
        }),
    };
    const shared = { avatarMode: 'game', avatarSnapshot: 'incomplete-shared' };
    const snapshot = { _cache: { 7: 'complete-cache' }, get: async () => snapshot._cache[7] };
    const service = createChatContactService({ config: {}, snapshot, syncRoomAvatar: async () => {},
        displayName: () => 'Player', inRoom: () => true, isFriend: () => true,
        getPlayer: () => ({ MemberNumber: 1 }), getRoomCharacters: () => [{ MemberNumber: 7, OnlineSharedSettings: { FCM: shared } }],
        getOnlineFriends: () => [], getRemoteProfiles: () => new Map(), getRoot: () => null });
    const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
    const hydrate = service.hydrateAvatars();
    await flush();
    assert.equal(rows[0].image, null);
    assert.equal(service.avatarHtml(7).includes('<img'), false);
    decoding.get('complete-cache').resolve();
    await hydrate;
    assert.deepEqual(rows.map(row => row.image.src), ['complete-cache', 'complete-cache']);
    assert.match(service.avatarHtml(7), /complete-cache/);
    snapshot._cache[7] = 'new-snapshot';
    listeners.get('fcm-avatar-updated')({ detail: { memberNumber: 7 } });
    assert.equal(rows[0].image.src, 'complete-cache');
    decoding.get('new-snapshot').resolve();
    await flush();
    assert.deepEqual(rows.map(row => row.image.src), ['new-snapshot', 'new-snapshot']);
    shared.avatarMode = 'url'; shared.avatarUrl = 'custom-url';
    const custom = service.hydrateAvatars(); await flush();
    decoding.get('custom-url').resolve(); await custom;
    assert.deepEqual(rows.map(row => row.image.src), ['custom-url', 'custom-url']);
    shared.avatarUrl = 'broken-url';
    const broken = service.hydrateAvatars(); await flush();
    decoding.get('broken-url').reject(new Error('decode failed')); await broken;
    assert.deepEqual(rows.map(row => row.image.src), ['custom-url', 'custom-url']);
    for (const key of ['window', 'document', 'Image', 'Node']) delete globalThis[key];
});

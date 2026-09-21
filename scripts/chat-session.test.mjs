import assert from 'node:assert/strict';
import test from 'node:test';
import { ChatStore } from '../src/communication/chat/data/chat-store.js';
import { createChatLifecycle } from '../src/communication/chat/controllers/chat-lifecycle.js';
import { createChatComposer } from '../src/communication/chat/controllers/chat-composer.js';

const noop = () => {};
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

test('concurrent database opens share a connection and closed connections are released', async () => {
    const previous = globalThis.indexedDB;
    let opens = 0;
    const request = {};
    const db = { close: noop };
    globalThis.indexedDB = { open: () => { opens++; return request; } };
    ChatStore.db = null;
    try {
        const first = ChatStore.init(), second = ChatStore.init();
        request.result = db;
        request.onsuccess();
        assert.deepEqual(await Promise.all([first, second]), [true, true]);
        assert.equal(opens, 1);
        db.onclose();
        assert.equal(ChatStore.db, null);
    } finally { globalThis.indexedDB = previous; ChatStore.db = null; }
});

test('index reads recover a stale connection and distinguish errors from empty history', async () => {
    const previousPlayer = globalThis.Player;
    const init = ChatStore.init;
    globalThis.Player = { MemberNumber: 1 };
    let opens = 0;
    const broken = { close: noop, transaction: () => { throw new Error('closed connection'); } };
    const healthy = { transaction: () => ({ objectStore: () => ({ index: () => ({ openCursor: () => {
        const request = {};
        queueMicrotask(() => request.onsuccess());
        return request;
    } }) }) }) };
    try {
        ChatStore.db = broken;
        ChatStore.init = async () => { opens++; ChatStore.db = healthy; return true; };
        assert.deepEqual(await ChatStore.recentIndex(), []);
        assert.equal(opens, 1);
        ChatStore.db = broken;
        ChatStore.init = async () => { ChatStore.db = broken; return true; };
        assert.equal(await ChatStore.recentIndex(), null);
    } finally { ChatStore.db = null; ChatStore.init = init; globalThis.Player = previousPlayer; }
});

test('closing and reopening invalidates an older index read even with no selected contact', async () => {
    const reads = [deferred(), deferred()];
    let index = 0, rendered = 0;
    const updates = [];
    const root = { isConnected: true, style: {} };
    const lifecycle = createChatLifecycle({ config: { communicationEnabled: true }, getRoot: () => root,
        getSelectedMember: () => null, getPlayerMemberNumber: () => 1,
        requestOnlineFriends: noop, chatStore: { recentIndex: () => reads[index++].promise },
        setMessageIndex: rows => updates.push(rows), refreshBadges: noop, render: () => rendered++,
        cleanupMessageActions: noop, syncBalloonVisibility: noop, ensureBalloons: noop,
    });
    const old = lifecycle.open();
    lifecycle.minimize();
    const current = lifecycle.open();
    reads[1].resolve([{ id: 'new' }]);
    assert.equal(await current, true);
    reads[0].resolve([]);
    assert.equal(await old, false);
    assert.deepEqual(updates, [[{ id: 'new' }]]);
    assert.equal(rendered, 1);
});

test('sending feedback is delayed and preserves the button width', async () => {
    const delivery = deferred();
    const button = { style: { width: '' }, dataset: {}, textContent: 'Send', isConnected: true, getBoundingClientRect: () => ({ width: 80 }) };
    const input = { value: 'hello', isConnected: true };
    const composer = createChatComposer({ getRoot: () => ({ querySelector: selector => selector === '[data-send]' ? button : selector === '[data-input]' ? input : null }),
        getMemberNumber: () => 42, displayName: String, capability: () => 'beep', isFriend: () => true,
        sender: { send: () => delivery.promise }, getReplyTarget: () => null, clearReplyTarget: noop, sendingDelay: 10,
    });
    const sending = composer.send();
    assert.equal(button.textContent, 'Send');
    assert.equal(button.style.width, '80px');
    await new Promise(resolve => setTimeout(resolve, 25));
    assert.equal(button.textContent, 'chatSending');
    assert.equal(button.style.width, '80px');
    delivery.resolve(true);
    await sending;
    assert.equal(button.textContent, 'Send');
    assert.equal(button.style.width, '');
    assert.equal(button.disabled, false);
});


test('notification index retains 15 contacts independently of the last 100 messages and expires at seven days', async () => {
    const previous = globalThis.Player;
    globalThis.Player = { MemberNumber: 1 };
    const now = Date.now();
    const week = 7 * 24 * 60 * 60 * 1000;
    const records = [
        ...Array.from({ length: 110 }, (_, i) => ({ id: 'busy-' + i, memberNumber: 2, timestamp: now - i, ownerMemberNumber: 1 })),
        ...Array.from({ length: 20 }, (_, i) => ({ id: 'contact-' + i, memberNumber: i + 3, timestamp: now - 200 - i, ownerMemberNumber: 1 })),
        { id: 'expired', memberNumber: 99, timestamp: now - week - 1, ownerMemberNumber: 1 },
    ];
    ChatStore.db = { transaction: () => ({ objectStore: () => ({ index: () => ({ openCursor: () => {
        const request = {};
        let position = 0;
        const advance = () => queueMicrotask(() => {
            request.result = position < records.length ? { value: records[position++], continue: advance } : null;
            request.onsuccess();
        });
        advance();
        return request;
    } }) }) }) };
    try {
        const result = await ChatStore.recentIndex({ now });
        assert.equal(new Set(result.map(row => row.memberNumber)).size, 15);
        assert.equal(result.filter(row => row.memberNumber === 2).length, 100);
        assert.equal(result.some(row => row.id === 'expired'), false);
        records.splice(0, records.length, { id: 'boundary', memberNumber: 2, timestamp: now - week, ownerMemberNumber: 1 },
            { id: 'expired', memberNumber: 3, timestamp: now - week - 1, ownerMemberNumber: 1 });
        assert.deepEqual((await ChatStore.recentIndex({ now })).map(row => row.id), ['boundary']);
    } finally { ChatStore.db = null; globalThis.Player = previous; }
});

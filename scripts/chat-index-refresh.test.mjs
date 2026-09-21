import assert from 'node:assert/strict';
import test from 'node:test';
import { createChatIndexRefresh } from '../src/communication/chat/controllers/chat-index-refresh.js';
import { createChatRuntime } from '../src/communication/chat/controllers/chat-runtime.js';

test('reconnection rebuilds the index without clearing it while the account is unavailable', async () => {
    let owner = 0, reads = 0, current = [{ id: 'existing' }], result = [{ id: 'restored' }];
    const refresh = createChatIndexRefresh({ getOwner: () => owner,
        store: { recentIndex: async () => { reads++; return result; } },
        setIndex: rows => { current = rows; }, refreshList() {}, refreshBadges() {},
    });
    assert.equal(await refresh.refresh(), false);
    assert.equal(reads, 0);
    assert.equal(current[0].id, 'existing');
    owner = 42;
    assert.equal(await refresh.refresh(), true);
    assert.equal(current[0].id, 'restored');
    result = null;
    assert.equal(await refresh.refresh(), false);
    assert.equal(current[0].id, 'restored');
    result = [];
    assert.equal(await refresh.refresh(), true);
    assert.deepEqual(current, []);
});

test('an outdated index read cannot overwrite a newer visit', async () => {
    const pending = [];
    const updates = [];
    const refresh = createChatIndexRefresh({ getOwner: () => 42,
        store: { recentIndex: () => new Promise(resolve => pending.push(resolve)) },
        setIndex: rows => updates.push(rows), refreshList() {}, refreshBadges() {},
    });
    const first = refresh.refresh(), second = refresh.refresh();
    pending[1]([{ id: 'new' }]);
    assert.equal(await second, true);
    pending[0]([]);
    assert.equal(await first, false);
    assert.deepEqual(updates, [[{ id: 'new' }]]);
});

test('friend synchronization rebuilds history even when presence did not change', async () => {
    let refreshes = 0;
    const runtime = createChatRuntime({ config: { communicationEnabled: true },
        presence: { updateOnlineRows: () => false }, offlineDelivery: { dispatch() {} },
        refreshMessageIndex: async () => { refreshes++; },
    });
    await runtime.updateOnlineFriends([]);
    await runtime.updateOnlineFriends([]);
    assert.equal(refreshes, 2);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const hooks = registerHooks({ load(url, context, next) {
    const source = url.endsWith('/core/logger.js') ? 'export const warnLimited = () => {};' : null;
    return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });
const { createChatDrafts } = await import('../src/communication/chat/controllers/chat-drafts.js');
const { createChatSelectedActions } = await import('../src/communication/chat/services/chat-selected-actions.js');
const { createChatMessageSelectionController } = await import('../src/communication/chat/controllers/chat-message-selection.js');
const { createChatMemberMenu } = await import('../src/communication/chat/controllers/chat-member-menu.js');
hooks.deregister();

function memoryStorage() {
    const data = new Map();
    return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, String(value)), data };
}

test('drafts are kept per contact, restored into an empty input, and cleared when blank', () => {
    const storage = memoryStorage();
    const input = { value: '' };
    let member = 1;
    const drafts = createChatDrafts({ getRoot: () => ({ querySelector: () => input }), getMemberNumber: () => member, getOwner: () => 7, storage: () => storage });
    drafts.set(1, 'hello'); drafts.set(2, 'world');
    assert.equal(drafts.get(1), 'hello');
    drafts.restore();
    assert.equal(input.value, 'hello');
    input.value = 'typed'; drafts.restore();
    assert.equal(input.value, 'typed', 'never overwrites what the user is typing');
    member = 2; input.value = ''; drafts.restore();
    assert.equal(input.value, 'world');
    drafts.set(2, '   ');
    assert.equal(drafts.get(2), '');
    // a new instance (reload) reads what was persisted
    const again = createChatDrafts({ getRoot: () => null, getMemberNumber: () => 1, getOwner: () => 7, storage: () => storage });
    assert.equal(again.get(1), 'hello');
    assert.equal(again.get(2), '');
});

test('drafts are separate per account', () => {
    const storage = memoryStorage();
    let owner = 7;
    const drafts = createChatDrafts({ getRoot: () => null, getMemberNumber: () => 1, getOwner: () => owner, storage: () => storage });
    drafts.set(1, 'mine');
    owner = 8;
    assert.equal(drafts.get(1), '');
});

function selectionFixture(records) {
    const events = [];
    const selection = createChatMessageSelectionController({
        getPanel: () => null, getMessages: () => records, canForwardToRoom: () => false,
        renderUi: (_panel, state) => events.push(state), selectedCountText: String, onExit: () => events.push('exit'),
    });
    return { selection, events };
}

test('selection starts in export mode and can enter delete mode; exit resets the mode', () => {
    const { selection, events } = selectionFixture([{ id: 'a' }, { id: 'b' }]);
    selection.enter({ dataset: { msgId: 'a' } });
    assert.equal(selection.getMode(), 'export');
    selection.exit();
    selection.enter({ dataset: { msgId: 'b' } }, 'delete');
    assert.equal(selection.getMode(), 'delete');
    assert.equal(events.at(-1).mode, 'delete');
    selection.exit();
    assert.equal(selection.getMode(), 'export');
});

test('deleting selected messages is local, confirmed, and cleans up the offline queue', async () => {
    const records = [{ id: 'a', queueId: 'q1' }, { id: 'b' }, { id: 'c' }];
    const { selection } = selectionFixture(records);
    selection.enter({ dataset: { msgId: 'a' } }, 'delete');
    selection.ids.add('b');
    const calls = { deleted: null, queue: null, removed: null, after: 0, confirmText: '' };
    const actions = createChatSelectedActions({
        selection, getPlayer: () => ({}), getConversationMemberNumber: () => 1, displayName: String, cleanContent: String,
        capability: () => 'none', isFriend: () => false, sender: {}, getRoom: () => null, sendRoomMessage: () => {}, exportConversation: () => {},
        biography: () => '', avatarUrl: () => '', chatColors: () => [],
        confirm: async message => { calls.confirmText = message; return true; }, text: (key, count) => `${key}:${count}`,
        chatStore: { deleteMessages: async ids => { calls.deleted = ids; return true; } },
        offlineQueue: { remove: ids => { calls.queue = ids; } },
        removeMessages: ids => { calls.removed = [...ids]; }, afterDelete: () => { calls.after++; },
    });
    assert.equal(await actions.deleteMessages(), true);
    assert.deepEqual(calls.deleted, ['a', 'b']);
    assert.deepEqual(calls.queue, ['q1']);
    assert.deepEqual(calls.removed, ['a', 'b']);
    assert.equal(calls.after, 1);
    assert.equal(calls.confirmText, 'chatConfirmDeleteMessages:2');
    assert.equal(selection.isActive(), false);
});

test('declining the confirmation or a failed store write deletes nothing', async () => {
    for (const [confirmed, stored] of [[false, true], [true, false]]) {
        const { selection } = selectionFixture([{ id: 'a' }]);
        selection.enter({ dataset: { msgId: 'a' } }, 'delete');
        let removed = false;
        const actions = createChatSelectedActions({
            selection, getPlayer: () => ({}), getConversationMemberNumber: () => 1, displayName: String, cleanContent: String,
            capability: () => 'none', isFriend: () => false, sender: {}, getRoom: () => null, sendRoomMessage: () => {}, exportConversation: () => {},
            biography: () => '', avatarUrl: () => '', chatColors: () => [],
            confirm: async () => confirmed, text: String, chatStore: { deleteMessages: async () => stored },
            removeMessages: () => { removed = true; },
        });
        assert.equal(await actions.deleteMessages(), false);
        assert.equal(removed, false);
        assert.equal(selection.isActive(), true);
    }
});

globalThis.window ??= globalThis;
function menuFixture(access) {
    const elements = {
        '[data-member-pin]': { textContent: '' }, '[data-member-open]': {}, '[data-member-group-toggle]': {}, '[data-member-cancel]': {},
        '[data-member-room]': { hidden: false, disabled: true, textContent: '', title: '' },
        '[data-member-groups]': { hidden: true, setAttribute() {} },
    };
    const menu = { hidden: true, style: {}, offsetWidth: 100, offsetHeight: 100, querySelector: selector => elements[selector] || null };
    const panel = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }) };
    const root = { querySelector: selector => (selector === '.fcm-chat-member-menu' ? menu : selector === '#fcm-chat-panel' ? panel : null) };
    const calls = { requested: [], went: [] };
    const controller = createChatMemberMenu({
        getRoot: () => root, text: key => key, isPinned: () => false, togglePin() {}, openChat() {}, getGroups: () => [], getMemberGroups: () => [],
        toggleGroup() {}, createGroup: async () => '', refreshList() {},
        getRoomAccess: () => access.current, requestRoomName: member => calls.requested.push(member), goToRoom: member => calls.went.push(member),
    });
    return { controller, elements, calls, menu };
}

test('go-to-room is enabled at once when the room name is known', () => {
    const access = { current: { canOpenRoom: true, hideRoom: false } };
    const { controller, elements, calls } = menuFixture(access);
    globalThis.document ??= { addEventListener() {} };
    controller.show(5, 10, 10);
    assert.equal(elements['[data-member-room]'].disabled, false);
    assert.deepEqual(calls.requested, []);
    elements['[data-member-room]'].onclick();
    assert.deepEqual(calls.went, [5]);
});

test('unknown room name is fetched in the background and the button enables when it arrives', async () => {
    const access = { current: { canOpenRoom: false, hideRoom: false } };
    const { controller, elements, calls } = menuFixture(access);
    globalThis.document ??= { addEventListener() {} };
    controller.show(5, 10, 10);
    assert.deepEqual(calls.requested, [5]);
    assert.equal(elements['[data-member-room]'].disabled, true);
    assert.equal(elements['[data-member-room]'].textContent, 'chatGoRoomLoading');
    access.current = { canOpenRoom: true, hideRoom: false };
    await new Promise(resolve => setTimeout(resolve, 750));
    assert.equal(elements['[data-member-room]'].disabled, false);
    assert.equal(elements['[data-member-room]'].textContent, 'chatGoRoom');
    controller.hide();
});

test('go-to-room is hidden for someone already in your room', () => {
    const { controller, elements } = menuFixture({ current: { canOpenRoom: false, hideRoom: true } });
    globalThis.document ??= { addEventListener() {} };
    controller.show(5, 10, 10);
    assert.equal(elements['[data-member-room]'].hidden, true);
});

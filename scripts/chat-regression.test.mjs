import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { createChatComposer } from '../src/communication/chat/controllers/chat-composer.js';
import { createChatListController } from '../src/communication/chat/controllers/chat-list-controller.js';
import { createChatMessageRecorder } from '../src/communication/chat/services/chat-message-recorder.js';
import { createChatMemberSelection } from '../src/communication/chat/controllers/chat-member-selection.js';

// Isolate translation's game bootstrap; these tests do not render translated UI.
const hooks = registerHooks({
    load(url, context, nextLoad) {
        if (url.endsWith('/src/i18n/i18n.js')) {
            return { format: 'module', source: 'export const TH = key => key;', shortCircuit: true };
        }
        return nextLoad(url, context);
    },
});
const { ChatConversationController } = await import('../src/communication/chat/controllers/chat-conversation-controller.js');
const { normalizeMessage } = await import('../src/communication/chat/services/chat-transport.js');
hooks.deregister();

const noop = () => {};
const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
};
const page = id => ({ messages: [{ id, content: id, timestamp: 1 }], hasMore: true });

test('incoming messages stay unread when the selected conversation is minimized', async () => {
    let visible = false;
    const saved = [];
    const recorder = createChatMessageRecorder({
        config: { communicationEnabled: true }, normalizeMessage: data => normalizeMessage(data, { displayName: String }),
        chatStore: { put: async message => saved.push(message), recentIndex: async () => saved },
        conversation: { add: noop }, isPanelVisible: () => visible, isSelectedMember: member => member === 42,
        setMessageIndex: noop, appendMessage: noop, refreshList: noop, notifyIncoming: noop,
    });
    const record = (memberNumber, direction = 'in') => recorder.record({ memberNumber, direction, content: 'hello' });
    assert.equal((await record(42)).read, false);
    assert.equal((await record(42, 'out')).read, true);
    visible = true;
    assert.equal((await record(42)).read, true);
    assert.equal((await record(43)).read, false);
});

test('background list refresh preserves forwarding targets and normal scroll position', () => {
    let forwarding = true;
    let bindings = 0;
    const scroll = { innerHTML: 'forwarding targets', scrollTop: 125 };
    const controller = createChatListController({
        getRoot: () => ({ querySelector: () => scroll }),
        isForwardTargetsActive: () => forwarding, renderVisibleScrollHtml: () => 'updated contacts',
        bindMemberRows: () => bindings++, hydrateAvatars: noop,
    });
    controller.refreshVisible();
    assert.equal(scroll.innerHTML, 'forwarding targets');
    assert.equal(bindings, 0);
    forwarding = false;
    controller.refreshVisible();
    assert.equal(scroll.innerHTML, 'updated contacts');
    assert.equal(scroll.scrollTop, 125);
    assert.equal(bindings, 1);
});

test('Enter confirms IME composition without sending; ordinary Enter sends', () => {
    let sent = 0;
    let prevented = 0;
    const input = { value: '測試' };
    const composer = createChatComposer({
        getRoot: () => ({ querySelector: () => input }), getMemberNumber: () => 42,
        displayName: String, capability: () => 'whisper', isFriend: () => true,
        sender: { send: () => { sent++; return true; } }, getReplyTarget: () => null, clearReplyTarget: noop,
    });
    const enter = options => composer.handleKeydown({ key: 'Enter', stopPropagation: noop, preventDefault: () => prevented++, ...options });
    enter({ isComposing: true });
    enter({ keyCode: 229 });
    enter({ shiftKey: true });
    assert.equal(sent, 0);
    assert.equal(prevented, 0);
    assert.equal(input.value, '測試');
    enter({});
    assert.equal(sent, 1);
    assert.equal(input.value, '');
});

test('selecting a contact refreshes read counts before conversation loading completes', async () => {
    const previousWindow = globalThis.window;
    globalThis.window = { setTimeout: () => 0 };
    try {
        let selected;
        let messages = [{ read: false }];
        let refreshed = false;
        let badgesRefreshed = 0;
        const loading = deferred();
        const controller = createChatMemberSelection({
            getRoot: () => null, getMemberNumber: () => selected, setMemberNumber: value => { selected = value; },
            resetSelection: noop, clearReply: noop, closeContactCard: noop, setStackedDetail: noop,
            chatStore: { markRead: async () => {}, recentIndex: async () => [{ read: true }] },
            setMessageIndex: value => { messages = value; },
            refreshList: () => { assert.equal(messages[0].read, true); refreshed = true; },
            loadConversation: () => {
                assert.equal(refreshed, true);
                assert.equal(badgesRefreshed, 1);
                loading.resolve();
                return loading.promise;
            },
            refreshBadges: () => { assert.equal(messages[0].read, true); badgesRefreshed++; },
            getLayout: () => 'split', refreshConversation: noop,
        });
        const selection = controller.select(42);
        await selection;
        assert.equal(refreshed, true);
        assert.equal(badgesRefreshed, 1);
    } finally { globalThis.window = previousWindow; }
});

test('stale requests cannot clear the loading state of a newer request', async () => {
    const controller = new ChatConversationController();
    const first = deferred();
    const second = deferred();
    let current = 1;
    const store = { page: target => target === 1 ? first.promise : second.promise };
    const a = controller.load(store, 1, target => target === current);
    current = 2;
    const b = controller.load(store, 2, target => target === current);
    first.resolve(page('old'));
    assert.equal(await a, false);
    assert.equal(controller.loading, true);
    second.resolve(page('new'));
    assert.equal(await b, true);
    assert.equal(controller.messages[0].id, 'new');
    assert.equal(controller.loading, false);
});

test('returning to the same contact ignores its earlier request', async () => {
    const controller = new ChatConversationController();
    const first = deferred();
    const latest = deferred();
    const a = controller.load({ page: () => first.promise }, 42, () => true);
    const b = controller.load({ page: () => latest.promise }, 42, () => true);
    latest.resolve(page('latest'));
    await b;
    first.resolve(page('stale'));
    assert.equal(await a, false);
    assert.equal(controller.messages[0].id, 'latest');
});

test('reset invalidates pending older-history requests', async () => {
    const controller = new ChatConversationController();
    await controller.load({ page: async () => page('current') }, 42, () => true);
    const older = deferred();
    const loading = controller.loadOlder({ page: () => older.promise }, 42, () => true);
    controller.reset();
    older.resolve(page('deleted history'));
    assert.equal(await loading, null);
    assert.deepEqual(controller.messages, []);
    assert.equal(controller.loading, false);
});

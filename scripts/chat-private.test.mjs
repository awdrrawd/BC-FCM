import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { createChatSender } from '../src/communication/chat/services/chat-sender.js';
import { createChatProfileViewer } from '../src/communication/chat/services/chat-profile-viewer.js';
import { createChatComposer } from '../src/communication/chat/controllers/chat-composer.js';
import { PRIVATE_TAG, PRIVATE_BEEP, META_TAG, privatePackets, profileMentionIds, createPrivatePayloadReceiver } from '../src/communication/chat/services/chat-private-payload.js';
const hooks = registerHooks({ load(url, context, next) {
    if (url.endsWith('/src/i18n/i18n.js')) return { format: 'module', source: 'export const TH = key => key;', shortCircuit: true };
    return next(url, context);
} });
const { createChatTransportHandler } = await import('../src/communication/chat/services/chat-transport-handler.js');
hooks.deregister();
const noop = () => {};
const profile = { memberNumber: 77, seen: 100, characterBundle: JSON.stringify({ MemberNumber: 77, Name: '未見玩家', Appearance: [], Description: 'profile' }) };
const payload = (extra = {}) => ({ id: 'message-123', target: 2, content: '@未見玩家 (77)', profiles: [profile], replyPreview: '', replyToId: '', ...extra });

function receiverContext() {
    const records = [], native = [];
    const handler = createChatTransportHandler({ getPlayer: () => ({ MemberNumber: 2 }), getMessages: () => records, getRoot: () => null,
        recordMessage: value => records.push(value), chatStore: {}, setRemoteProfile: noop, displayName: String,
        showRoomInvite: noop, htmlText: String, warn: noop, isEnabled: () => true, isOutgoingSuppressed: () => false,
        nativeTags: { decorate: (element, data, peer) => native.push({ element, data, peer }), decorateBeep: (element, data, peer) => native.push({ element, data, peer }) },
        getOutgoing: () => null });
    return { records, native, handler };
}
function senderContext(overrides = {}) {
    const server = [], beeps = [], records = [];
    const sender = createChatSender({ offlineQueue: { add: () => null }, canSendWhisper: () => true,
        sendServer: (type, value) => server.push({ type, value }), sendBeep: value => { beeps.push(value); return true; },
        recordMessage: value => records.push(value), runWithoutOutgoingCapture: fn => fn(), loadSharedProfile: async () => profile,
        onNativeMessage: noop, warn: noop, wait: async () => {}, ...overrides });
    return { sender, server, beeps, records };
}

test('small payload uses one packet; Unicode multipart payload reassembles out of order and once', () => {
    assert.equal(privatePackets(payload()).length, 1);
    const large = payload({ profiles: [{ ...profile, characterBundle: JSON.stringify({ MemberNumber: 77, Name: '測試', Appearance: [], Description: '中文'.repeat(4000) }) }] });
    const packets = privatePackets(large);
    assert.ok(packets.length > 1);
    assert.ok(packets.every(value => value.length <= 1000));
    const receiver = createPrivatePayloadReceiver({ getSelf: () => 2 });
    receiver.receive(1, packets.at(-1), 'whisper');
    for (const packet of [...packets].reverse()) receiver.receive(1, packet, 'whisper');
    assert.deepEqual(receiver.consume(1, large.id), large);
    assert.equal(receiver.consume(1, large.id), null);
    for (const packet of packets) assert.equal(receiver.receive(1, packet, 'whisper'), null);
});

test('receiver rejects wrong target, mixed senders, malformed packets and expires transfers', () => {
    let now = 0;
    let self = 2;
    const receiver = createPrivatePayloadReceiver({ getSelf: () => self, now: () => now });
    assert.equal(receiver.receive(1, privatePackets(payload({ target: 3 }))[0], 'beep'), null);
    assert.equal(receiver.receive(1, '{bad json', 'beep'), null);
    receiver.receive(1, privatePackets(payload())[0], 'whisper');
    assert.equal(receiver.consume(3, 'message-123'), null);
    now = 120001;
    assert.equal(receiver.consume(1, 'message-123'), null);
    receiver.receive(1, privatePackets(payload())[0], 'whisper');
    self = 4;
    assert.equal(receiver.consume(1, 'message-123'), null);
});

test('profiles must match explicit mentions and the enclosed member number', () => {
    assert.deepEqual(profileMentionIds('@77 @測試 (77) @88'), [77, 88]);
    assert.throws(() => privatePackets(payload({ content: 'not a share' })));
    assert.throws(() => privatePackets(payload({ profiles: [{ memberNumber: 77, characterBundle: profile.characterBundle.replace('77', '88') }] })));
    assert.throws(() => privatePackets(payload({ profiles: [profile, profile] })));

});

test('Beep attachment does nothing until the exact readable message arrives', async () => {
    const { sender, beeps } = senderContext();
    assert.equal(await sender.send({ memberNumber: 2, channel: 'beep', content: '@未見玩家 (77)' }), true);
    const { handler, records, native } = receiverContext();
    for (const beep of beeps.filter(value => value.BeepType === PRIVATE_BEEP)) handler.receivePrivate({ ...beep, MemberNumber: 1 });
    assert.equal(records.length, 0);
    assert.equal(native.length, 0);
    const readable = { ...beeps.at(-1), MemberNumber: 1 };
    assert.equal(readable.BeepType, '');
    handler.incomingBeep(readable);
    handler.incomingBeepDisplay(readable, 'exact-native-row');
    assert.equal(records.length, 1);
    assert.deepEqual(records[0].profiles, [profile]);
    assert.equal(native[0].element, 'exact-native-row');
    assert.equal(native[0].peer, 1);
});

test('whisper metadata is in the actual message and unrelated messages cannot consume attachments', async () => {
    const { sender, server } = senderContext();
    await sender.send({ memberNumber: 2, channel: 'whisper', content: '@未見玩家 (77)', replyTarget: { sharedMsgId: 'earlier-123', preview: 'prior' } });
    const { handler, records, native } = receiverContext();
    for (const { value } of server.slice(0, -1)) {
        assert.equal(value.Content, PRIVATE_TAG);
        assert.equal(value.Target, 2);
        handler.receivePrivate({ ...value, Sender: 1 });
    }
    handler.incomingWhisperDisplay({ Type: 'Whisper', Sender: 1, Target: 2, Content: 'ordinary', Dictionary: [] }, 'ordinary', null, 'ordinary-row');
    assert.equal(native.length, 0);
    const actual = server.at(-1).value;
    assert.equal(actual.Type, 'Whisper');
    assert.ok(actual.Dictionary.some(value => value.Tag === META_TAG));
    handler.incomingWhisperDisplay({ ...actual, Sender: 1 }, actual.Content, null, 'shared-row');
    assert.deepEqual(records.at(-1).profiles, [profile]);
    assert.equal(records.at(-1).replyToId, 'earlier-123');
    assert.equal(native[0].element, 'shared-row');
});

test('public or other-recipient messages never become native profile tags', () => {
    const { handler, native } = receiverContext();
    const meta = { Tag: META_TAG, MessageId: 'message-123', Target: 3, ReplyPreview: 'prior', ReplyToId: 'earlier-123' };
    handler.incomingWhisperDisplay({ Type: 'Whisper', Sender: 1, Target: 3, Content: '@77', Dictionary: [meta] }, '@77', null, 'wrong-recipient');
    handler.incomingWhisperDisplay({ Type: 'Chat', Sender: 1, Target: 2, Content: '@77', Dictionary: [meta] }, '@77', null, 'public');
    assert.equal(native.length, 0);
});

test('recipient can open shared profile without local data or live character', async () => {
    let opened;
    const viewer = createChatProfileViewer({ findLiveCharacter: () => null, loadProfile: async () => null,
        loadCharacter: (bundle, member) => ({ ...bundle, MemberNumber: member }), showInformationSheet: value => { opened = value; }, warn: noop });
    assert.equal(await viewer.open(77, profile), true);
    assert.equal(opened.Name, '未見玩家');
    assert.equal(await viewer.open(88), false);
});

test('composer keeps newer text and suppresses duplicate sends while profile loads', async () => {
    let resolve;
    let sends = 0;
    const input = { value: '@77', isConnected: true };
    const composer = createChatComposer({ getRoot: () => ({ querySelector: selector => selector === '[data-input]' ? input : null }),
        getMemberNumber: () => 2, displayName: String, capability: () => 'whisper', isFriend: () => true,
        sender: { send: () => { sends++; return new Promise(done => { resolve = done; }); } }, getReplyTarget: () => null, clearReplyTarget: noop });
    const sending = composer.send();
    input.value = 'next message';
    await composer.send();
    assert.equal(sends, 1);
    resolve(true);
    await sending;
    assert.equal(input.value, 'next message');
});

test('reply preview containing a profile never reloads or retransmits its bundle', async () => {
    for (const channel of ['whisper', 'beep']) {
        let loads = 0;
        const context = senderContext({ loadSharedProfile: async () => { loads++; throw new Error('must not load quoted profiles'); } });
        assert.equal(await context.sender.send({ memberNumber: 2, channel, content: '收到',
            replyTarget: { sharedMsgId: 'original-123', preview: '@未見玩家 (77)' } }), true);
        assert.equal(loads, 0);
        assert.deepEqual(context.records[0].profiles, []);
        assert.equal(context.records[0].replyToId, 'original-123');
        if (channel === 'whisper') assert.equal(context.server.length, 1);
        else assert.equal(context.beeps.length, 1);
    }
});

test('receiving a profile saves it before recording the message without opening the panel', async () => {
    const { createChatMessageRecorder } = await import('../src/communication/chat/services/chat-message-recorder.js');
    const order = [];
    const recorder = createChatMessageRecorder({ config: { communicationEnabled: true, saveMode: 'off' },
        normalizeMessage: data => ({ ...data }), saveSharedProfile: async value => { assert.deepEqual(value, profile); order.push('profile saved'); },
        chatStore: { put: async () => order.push('message saved'), recentIndex: async () => [] },
        isPanelVisible: () => false, isSelectedMember: () => false, setMessageIndex: noop, notifyIncoming: noop });
    await recorder.record({ memberNumber: 1, direction: 'in', content: '@77', profiles: [profile] });
    assert.deepEqual(order, ['profile saved', 'message saved']);
    order.length = 0;
    await recorder.record({ memberNumber: 1, direction: 'out', content: '@77', profiles: [profile] });
    assert.deepEqual(order, ['message saved']);
});

test('offline Profile shares fail without queueing or sending', async () => {
    let queued = false;
    const context = senderContext({ offlineQueue: { add: () => { queued = true; } } });
    assert.equal(await context.sender.send({ memberNumber: 2, channel: 'none', content: '@77' }), false);
    assert.equal(queued, false);
    assert.equal(context.beeps.length, 0);
    assert.equal(context.records.length, 0);
});

test('ordinary Beep text is unmodified and only profile sharing adds custom packets', async () => {
    const context = senderContext();
    await context.sender.send({ memberNumber: 2, channel: 'beep', content: 'hello' });
    assert.deepEqual(context.beeps, [{ MemberNumber: 2, BeepType: '', Message: 'hello' }]);
    context.beeps.length = 0;
    await context.sender.send({ memberNumber: 2, channel: 'beep', content: '@77' });
    assert.equal(context.beeps.at(-1).Message, '@77');
    assert.ok(context.beeps.slice(0, -1).every(row => row.BeepType === PRIVATE_BEEP));
});

test('ordinary offline replies queue only text and preserve references without loading profiles', async () => {
    const queued = [];
    const context = senderContext({ isFriend: () => true, offlineQueue: { add: (memberNumber, content) => { const row = { id: 'queued-1', memberNumber, content }; queued.push(row); return row; } },
        loadSharedProfile: () => { throw new Error('must not load'); } });
    assert.equal(await context.sender.send({ memberNumber: 2, channel: 'none', content: 'hello', replyTarget: { preview: '@77', sharedMsgId: 'original-1' } }), true);
    assert.deepEqual(queued, [{ id: 'queued-1', memberNumber: 2, content: 'hello' }]);
    assert.equal(context.records[0].queued, true);
    assert.equal(context.records[0].replyToId, 'original-1');
    assert.equal(context.beeps.length, 0);
    assert.equal(await senderContext({ isFriend: () => true }).sender.send({ memberNumber: 2, channel: 'none', content: 'hello' }), false);
});

test('offline delivery sends text once, excludes Profile shares and cancels on account change', async () => {
    const { createOfflineDeliveryService } = await import('../src/communication/chat/services/chat-offline-delivery.js');
    let owner = 'account-1';
    let rows = [{ id: 'plain', memberNumber: 2, content: 'hello' }, { id: 'share', memberNumber: 2, content: '@77' }];
    const sent = [], saved = [];
    const service = createOfflineDeliveryService({ offlineQueue: { key: () => owner, all: () => rows, remove: ids => { rows = rows.filter(row => !ids.includes(row.id)); } },
        chatStore: { all: async () => [{ queueId: 'plain', queued: true }], put: async row => saved.push(row) },
        isFriend: () => true, sendBeep: row => { sent.push(row); return true; }, runWithoutOutgoingCapture: fn => fn(), onDelivered: noop, onError: error => { throw error; }, interval: 0 });
    assert.equal(service.dispatch([{ MemberNumber: 2 }]), 1);
    assert.equal(service.dispatch([{ MemberNumber: 2 }]), 0);
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.deepEqual(sent, [{ MemberNumber: 2, BeepType: '', Message: 'hello' }]);
    assert.equal(saved[0].queued, false);
    assert.equal(rows[0].id, 'share');
    rows.push({ id: 'later', memberNumber: 2, content: 'later' });
    assert.equal(service.dispatch([{ MemberNumber: 2 }]), 1);
    owner = 'account-2';
    await new Promise(resolve => setTimeout(resolve, 20));
    assert.equal(sent.length, 1);
});

test('forwarding uses the shared sender and retains selection if sharing fails', async () => {
    const { createChatSelectedActions } = await import('../src/communication/chat/services/chat-selected-actions.js');
    let exitCount = 0;
    const calls = [];
    const actions = createChatSelectedActions({ selection: { records: () => [{ content: '@77', timestamp: 0 }], exit: () => exitCount++ },
        getPlayer: () => ({ MemberNumber: 1 }), getConversationMemberNumber: () => 3, displayName: String, cleanContent: String,
        capability: () => 'none', isFriend: () => true, sender: { send: async data => { calls.push(data); return false; } } });
    await actions.forwardTo(2);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].channel, 'none');
    assert.ok(calls[0].content.includes('@77'));
    assert.equal(exitCount, 0);
});

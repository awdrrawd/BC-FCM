import assert from 'node:assert/strict';
import test from 'node:test';
import { createChatComposer } from '../src/communication/chat/controllers/chat-composer.js';
import { createChatConversationPresence } from '../src/communication/chat/controllers/chat-conversation-presence.js';
import { createChatLifecycle } from '../src/communication/chat/controllers/chat-lifecycle.js';
import { roomHeaderText } from '../src/communication/chat/services/chat-room-header.js';

const noop = () => {};

test('same-room channel selection controls sending and survives presence changes', async () => {
    let available = 'whisper';
    let member = 42;
    const sent = [];
    const input = { value: 'hello', isConnected: true };
    const composer = createChatComposer({
        getRoot: () => ({ querySelector: selector => selector === '[data-input]' ? input : null }),
        getMemberNumber: () => member, displayName: String, capability: () => available,
        isFriend: () => true, getReplyTarget: () => null, clearReplyTarget: noop,
        sender: { send: data => { sent.push(data); return true; } },
    });
    assert.equal(composer.getChannel(), 'whisper');
    composer.selectChannel('beep');
    await composer.send();
    assert.equal(sent[0].channel, 'beep');
    member = 43;
    assert.equal(composer.getChannel(), 'whisper');
    member = 42;
    assert.equal(composer.getChannel(), 'beep');
    composer.selectChannel('whisper');
    input.value = 'whisper';
    await composer.send();
    assert.equal(sent[1].channel, 'whisper');
    available = 'beep';
    composer.selectChannel('whisper');
    assert.equal(composer.getChannel(), 'beep');
    available = 'none';
    assert.equal(composer.getChannel(), 'none');
});

test('room headers show current Limit, public cached occupancy, and hide private occupancy', () => {
    assert.equal(roomHeaderText({ roomInfo: { name: 'room', isCurrent: true }, baseRoomText: 'room', room: { Limit: 10 }, characters: [1, 2] }), 'room ＜2/10＞');
    assert.equal(roomHeaderText({ roomInfo: { name: 'public', memberCount: 1 }, baseRoomText: 'public', cachedRoom: { MemberCount: 10, MemberLimit: 10 } }), 'public ＜10/10＞');
    assert.equal(roomHeaderText({ roomInfo: { name: 'secret', isPrivate: true }, baseRoomText: 'private', cachedRoom: { MemberCount: 2, MemberLimit: 10 } }), 'private');
});

test('presence keeps both same-room channels enabled and retains current room occupancy', () => {
    const button = () => ({ classList: { toggle: noop } });
    const whisper = button(), beep = button();
    const meta = { dataset: {}, setAttribute: noop };
    const nodes = { '[data-room-meta="42"]': meta, '[data-channel="whisper"]': whisper, '[data-channel="beep"]': beep };
    const presence = createChatConversationPresence({
        getRoot: () => ({ querySelector: selector => nodes[selector] }), getMemberNumber: () => 42,
        getRoom: () => ({ Limit: 10 }), getRoomCharacters: () => [1, 2, 3], getOnlineFriends: () => [],
        roomState: { get: () => ({ roomInfo: { name: 'room', isCurrent: true }, roomText: 'room', canOpenRoom: true }) },
        capability: () => 'beep', inRoom: () => true, sharedProfile: () => ({}), text: String,
        queryRoomInfo: () => assert.fail('current room needs no search'),
    });
    presence.refresh();
    assert.equal(meta.textContent, 'room ＜3/10＞');
    assert.equal(whisper.disabled, false);
    assert.equal(beep.disabled, false);
});

test('a contact balloon opens notifications even when the panel is already visible', async () => {
    const root = { isConnected: true, style: { display: 'block' } };
    let selected, view;
    let rendered;
    const done = new Promise(resolve => { rendered = resolve; });
    const lifecycle = createChatLifecycle({
        config: { communicationEnabled: true }, getRoot: () => root,
        getSelectedMember: () => selected, setSelectedMember: value => { selected = value; },
        getPlayerMemberNumber: () => 1, setActiveView: value => { view = value; },
        setStackedDetail: noop, resetSelection: noop, clearReply: noop, closeContactCard: noop,
        requestOnlineFriends: noop, chatStore: { markRead: async () => {}, recentIndex: async () => [] },
        setMessageIndex: noop, loadConversation: async () => {}, refreshBadges: noop, render: rendered,
    });
    lifecycle.toggle(42);
    await done;
    assert.equal(view, 'notifications');
    assert.equal(selected, 42);
    assert.equal(root.style.display, 'block');
});

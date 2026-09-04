import { forEachForwardedMessage, forwardedMessageText } from '../data/chat-selection.js';

function createChatSelectedActions({ selection, getPlayer, getConversationMemberNumber, displayName, cleanContent, capability, isFriend, offlineQueue, recordMessage, runWithoutOutgoingCapture, sendWhisper, sendBeep, getRoom, sendRoomMessage, exportConversation, biography, avatarUrl, chatColors }) {
    function format(message) {
        return forwardedMessageText(message, {
            player: getPlayer(), conversationMemberNumber: getConversationMemberNumber(), displayName, cleanContent,
        });
    }

    async function forwardTo(memberNumber) {
        const target = Number(memberNumber);
        const available = capability(target);
        if (!target || (available === 'none' && !isFriend(target))) return;
        await forEachForwardedMessage(selection.records(), async message => {
            const content = format(message);
            if (available === 'none') {
                const queued = offlineQueue.add(target, content);
                await recordMessage({ memberNumber: target, direction: 'out', channel: 'beep', content, queued: true, queueId: queued.id }, { notify: false });
                return;
            }
            const sent = runWithoutOutgoingCapture(() => available === 'whisper'
                ? sendWhisper({ Type: 'Whisper', Target: target, Content: content })
                : sendBeep({ MemberNumber: target, BeepType: '', Message: content }));
            if (sent) await recordMessage({ memberNumber: target, direction: 'out', channel: available, content }, { notify: false });
        });
        selection.exit();
    }

    async function forwardToRoom() {
        if (!getRoom() || !selection.size()) return;
        await forEachForwardedMessage(selection.records(), message => sendRoomMessage('ChatRoomChat', { Type: 'Chat', Content: format(message) }));
        selection.exit();
    }

    function exportMessages(formatName) {
        const messages = selection.records();
        if (!messages.length) return;
        exportConversation(formatName, {
            memberNumber: getConversationMemberNumber(), messages, getDisplayName: displayName,
            biography, avatarUrl, chatColors,
        });
    }

    return { exportMessages, forwardTo, forwardToRoom };
}

export { createChatSelectedActions };

import { forEachForwardedMessage, forwardedMessageText } from '../data/chat-selection.js';

function createChatSelectedActions({ selection, getPlayer, getConversationMemberNumber, displayName, cleanContent, capability, isFriend, sender, getRoom, sendRoomMessage, exportConversation, biography, avatarUrl, chatColors }) {
    function format(message) {
        return forwardedMessageText(message, {
            player: getPlayer(), conversationMemberNumber: getConversationMemberNumber(), displayName, cleanContent,
        });
    }

    async function forwardTo(memberNumber) {
        const target = Number(memberNumber);
        const available = capability(target);
        if (!target || (available === 'none' && !isFriend(target))) return;
        let failed = false;
        await forEachForwardedMessage(selection.records(), async message => {
            if (!await sender.send({ memberNumber: target, channel: available, content: format(message) })) failed = true;
        });
        if (!failed) selection.exit();
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

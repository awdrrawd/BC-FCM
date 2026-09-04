import { contactCardHtml, conversationHtml } from './chat-conversation-view.js';
import { conversationMessagesHtml } from './chat-message-view.js';

function createChatConversationPresenter({ getMemberNumber, getConfig, getRoom, getRoomCharacters, getCachedRoomInfo, capability, roomState, isFriend, inRoom, avatarHtml, displayName, biography, hasSavedProfile, isContactCardOpen, getMessages, getUnread, isMultiSelect, getReplyTarget, getSelectedCount, text }) {
    function renderContactCard() {
        const memberNumber = Number(getMemberNumber());
        return contactCardHtml({
            memberNumber, avatarHtml, displayName: displayName(memberNumber), biography: biography(memberNumber),
            hasProfile: hasSavedProfile(memberNumber), isFriend: isFriend(memberNumber),
        });
    }

    function render() {
        const memberNumber = Number(getMemberNumber());
        if (!memberNumber) return conversationHtml({ memberNumber: null });
        const config = getConfig();
        const available = capability(memberNumber);
        const { roomInfo, roomText: baseRoomText, canOpenRoom, unavailable } = roomState.get(memberNumber);
        const cachedRoom = roomInfo?.name ? getCachedRoomInfo(roomInfo.name) : null;
        const memberCount = roomInfo?.isCurrent ? (getRoomCharacters()?.length ?? null) : (roomInfo?.memberCount ?? cachedRoom?.MemberCount ?? null);
        const memberLimit = roomInfo?.isCurrent ? (getRoom()?.MemberLimit ?? null) : (roomInfo?.memberLimit ?? cachedRoom?.MemberLimit ?? null);
        const roomCount = memberCount !== null && memberCount !== undefined ? ` ＜${memberCount}${memberLimit !== null && memberLimit !== undefined ? `/${memberLimit}` : ''}＞` : '';
        const roomText = canOpenRoom ? `${roomInfo.name}${roomCount}` : baseRoomText;
        const online = available !== 'none';
        const inputPlaceholder = unavailable ? text('noBeepNotFriend') : !online ? text('chatOfflineQueuePlaceholder') : available === 'whisper' ? text('chatWhisperInputPlaceholder') : text('chatPrivateInputPlaceholder');
        return conversationHtml({
            memberNumber, stacked: config.chatLayout === 'stacked', avatarHtml,
            displayName: displayName(memberNumber), biography: biography(memberNumber),
            showNotFriendBadge: !isFriend(memberNumber) && !unavailable,
            roomText, roomName: roomInfo?.name || '', canOpenRoom,
            canSummon: !!getRoom() && online && !inRoom(memberNumber), groups: Object.entries(config.chatGroups || {}),
            contactCardHtml: isContactCardOpen() ? renderContactCard() : '', messagesHtml: conversationMessagesHtml(getMessages()),
            unread: getUnread(), multiSelect: isMultiSelect(), available, online,
            canInvite: available !== 'none' && !inRoom(memberNumber), inputPlaceholder, unavailable,
            replyTarget: getReplyTarget(), selectedCount: getSelectedCount(), canForwardToRoom: !!getRoom(),
        });
    }

    return { contactCardHtml: renderContactCard, html: render };
}

export { createChatConversationPresenter };

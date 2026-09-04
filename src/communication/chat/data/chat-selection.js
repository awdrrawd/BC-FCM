function selectedMessages(messages, selectedIds) {
    return messages.filter(message => selectedIds.has(String(message.id)));
}

function buildForwardTargetGroups({ roomCharacters, friendRows, selfMemberNumber, conversationMemberNumber, isFriend, isOnline }) {
    const excluded = new Set([Number(selfMemberNumber), Number(conversationMemberNumber)]);
    const room = [...new Set((roomCharacters || []).map(character => Number(character.MemberNumber)))]
        .filter(memberNumber => memberNumber && !excluded.has(memberNumber));
    const roomSet = new Set(room);
    const friends = [...new Set((friendRows || []).map(friend => Number(friend.mn)))]
        .filter(memberNumber => memberNumber && !excluded.has(memberNumber) && !roomSet.has(memberNumber) && isFriend(memberNumber));
    return {
        room,
        friends: friends.filter(isOnline),
        offline: friends.filter(memberNumber => !isOnline(memberNumber)),
    };
}

function forwardedMessageText(message, { player, conversationMemberNumber, displayName, cleanContent, locale }) {
    const sender = message.direction === 'out'
        ? `${player?.Nickname || player?.Name || displayName(player?.MemberNumber)} (${player?.MemberNumber})`
        : `${displayName(conversationMemberNumber)} (${conversationMemberNumber})`;
    return `↪ ${sender} · ${new Date(message.timestamp).toLocaleString(locale)}\n${cleanContent(message.content)}`;
}

async function forEachForwardedMessage(messages, callback, delay = 350) {
    for (let index = 0; index < messages.length; index++) {
        await callback(messages[index], index);
        if (index < messages.length - 1 && delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
    }
}

export { buildForwardTargetGroups, forEachForwardedMessage, forwardedMessageText, selectedMessages };

function createChatConversationPresence({ getRoot, getMemberNumber, getRoom, getOnlineFriends, roomState, capability, inRoom, sharedProfile, text, queryRoomInfo }) {
    function refreshRoomMeta() {
        const memberNumber = Number(getMemberNumber());
        if (!memberNumber) return;
        const { roomInfo, canOpenRoom } = roomState.get(memberNumber);
        if (!canOpenRoom || roomInfo.isCurrent || roomInfo.isPrivate) return;
        const friend = getOnlineFriends().find(item => Number(item.MemberNumber) === memberNumber);
        queryRoomInfo(roomInfo.name, friend?.ChatRoomSpace, data => {
            const meta = getRoot()?.querySelector(`[data-room-meta="${memberNumber}"]`);
            if (!meta || Number(getMemberNumber()) !== memberNumber || memberNumber !== Number(meta.dataset.roomMeta)) return;
            const count = data?.MemberCount;
            const limit = data?.MemberLimit;
            const roomText = `${roomInfo.name}${count !== null && count !== undefined ? ` ＜${count}${limit !== null && limit !== undefined ? `/${limit}` : ''}＞` : ''}`;
            meta.textContent = roomText;
            meta.title = roomText;
        });
    }

    function refresh() {
        const memberNumber = Number(getMemberNumber());
        if (!memberNumber) return;
        const root = getRoot();
        const available = capability(memberNumber);
        const { roomInfo, roomText, canOpenRoom, unavailable } = roomState.get(memberNumber);
        const meta = root?.querySelector(`[data-room-meta="${memberNumber}"]`);
        if (meta) {
            meta.textContent = roomText;
            meta.title = roomText;
            if (canOpenRoom) {
                meta.dataset.roomName = roomInfo.name;
                meta.setAttribute('role', 'button');
                meta.tabIndex = 0;
            } else {
                delete meta.dataset.roomName;
                meta.removeAttribute('role');
                meta.removeAttribute('tabindex');
            }
        }
        const online = available !== 'none';
        const status = online ? (sharedProfile(memberNumber).status || 'online') : 'offline';
        const dot = root?.querySelector(`.fcm-chat-conversation-header [data-avatar-member="${memberNumber}"] i`);
        if (dot) dot.className = status;
        const summon = root?.querySelector('[data-summon]');
        if (summon) summon.disabled = !getRoom() || !online || inRoom(memberNumber);
        const whisper = root?.querySelector('[data-channel="whisper"]');
        const beep = root?.querySelector('[data-channel="beep"]');
        if (whisper) { whisper.disabled = available !== 'whisper'; whisper.classList.toggle('active', available === 'whisper'); }
        if (beep) { beep.disabled = available !== 'beep'; beep.classList.toggle('active', available === 'beep'); }
        const input = root?.querySelector('[data-input]');
        if (input) input.placeholder = unavailable ? text('noBeepNotFriend') : !online ? text('chatOfflineQueuePlaceholder') : available === 'whisper' && inRoom(memberNumber) ? text('chatWhisperInputPlaceholder') : text('chatPrivateInputPlaceholder');
        const send = root?.querySelector('[data-send]');
        if (send) {
            send.textContent = online ? text('chatSend') : text('chatQueueSend');
            send.disabled = unavailable;
        }
        refreshRoomMeta();
    }

    return { refresh, refreshRoomMeta };
}

export { createChatConversationPresence };

function createChatRoomStateService({ getRoomInfo, inRoom, isFriend, isOnline, getCurrentRoom, text }) {
    function get(memberNumber) {
        const target = Number(memberNumber);
        const roomInfo = getRoomInfo(target);
        const sameRoom = inRoom(target);
        const friend = isFriend(target);
        const privateRoom = friend && !!roomInfo?.isPrivate && !roomInfo?.isCurrent;
        const roomText = sameRoom
            ? roomInfo?.name || getCurrentRoom()?.Name || text('chatMainHall')
            : !friend
                ? text('chatNotFriend')
                : privateRoom
                    ? text('roomPrivateLabel')
                    : roomInfo?.name || (isOnline(target) ? text('chatMainHall') : text('chatOffline'));
        return {
            roomInfo,
            roomText,
            friend,
            sameRoom,
            privateRoom,
            unavailable: !sameRoom && !friend,
            canOpenRoom: friend && !!roomInfo?.name && !privateRoom,
        };
    }

    return { get };
}

export { createChatRoomStateService };

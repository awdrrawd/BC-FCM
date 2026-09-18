function roomHeaderText({ roomInfo, baseRoomText, room, characters, cachedRoom }) {
    if (!roomInfo?.name || (roomInfo.isPrivate && !roomInfo.isCurrent)) return baseRoomText;
    const count = roomInfo.isCurrent ? characters?.length ?? room?.MemberCount : cachedRoom?.MemberCount ?? roomInfo.memberCount;
    const limit = roomInfo.isCurrent ? room?.Limit ?? room?.MemberLimit : cachedRoom?.MemberLimit ?? cachedRoom?.Limit ?? roomInfo.memberLimit;
    return `${baseRoomText}${count != null ? ` ＜${count}/${limit ?? '?'}＞` : ''}`;
}

export { roomHeaderText };

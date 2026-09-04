function createChatRoomActions({ getMemberNumber, getRoom, getRoomCharacters, capability, confirm, text, runWithoutOutgoingCapture, sendBeep, recordMessage }) {
    function canSendTo(memberNumber) {
        return memberNumber && capability(memberNumber) === 'beep';
    }

    function inviteCurrent() {
        const memberNumber = Number(getMemberNumber());
        const room = getRoom();
        if (!canSendTo(memberNumber) || !room?.Name) return;
        const count = getRoomCharacters()?.length ?? room.MemberCount ?? null;
        const limit = room.MemberLimit ?? null;
        const description = String(room.Description || '').trim();
        const message = `|${room.Name}| - ${room.Creator || '?'} ＜${count ?? 0}/${limit ?? 0}＞${description ? `\n${description}` : ''}`;
        const sent = runWithoutOutgoingCapture(() => sendBeep({ MemberNumber: memberNumber, BeepType: '', IsSecret: false, Message: message }));
        if (sent) recordMessage({ memberNumber, direction: 'out', channel: 'beep', content: room.Name, roomName: room.Name }, { notify: false });
    }

    async function summonCurrent() {
        const memberNumber = Number(getMemberNumber());
        const room = getRoom();
        if (!canSendTo(memberNumber) || !room?.Name) return;
        if (!await confirm(text('beepSummonTitle'), text('beepSummon'))) return;
        if (Number(getMemberNumber()) !== memberNumber || getRoom()?.Name !== room.Name) return;
        const sent = runWithoutOutgoingCapture(() => sendBeep({
            MemberNumber: memberNumber, BeepType: '', Message: 'summon', ChatRoomName: room.Name, ChatRoomSpace: room.Space,
        }));
        if (sent) recordMessage({ memberNumber, direction: 'out', channel: 'beep', content: 'summon', roomName: room.Name }, { notify: false });
    }

    return { inviteCurrent, summonCurrent };
}

export { createChatRoomActions };

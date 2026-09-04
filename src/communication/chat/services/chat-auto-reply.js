function createChatAutoReplyService({ config, inRoom, isOnline, sendWhisper, sendBeep, recordMessage, runWithoutOutgoingCapture, cooldown = 60000 }) {
    const lastReplyTimes = new Map();

    function replyContent() {
        if (config.chatStatus === 'busy' && config.busyAutoReply) return config.busyMessage || '';
        if (config.chatStatus === 'afk' && config.afkAutoReply) return config.afkMessage || '';
        return '';
    }

    function handle(message) {
        const content = replyContent();
        const memberNumber = Number(message.memberNumber);
        const now = Date.now();
        if (!content || !memberNumber || now - (lastReplyTimes.get(memberNumber) || 0) < cooldown) return false;
        lastReplyTimes.set(memberNumber, now);
        const sent = runWithoutOutgoingCapture(() => {
            if (message.channel === 'whisper' && inRoom(memberNumber)) {
                return sendWhisper({ Type: 'Whisper', Target: memberNumber, Content: content });
            }
            if (isOnline(memberNumber)) return sendBeep({ MemberNumber: memberNumber, BeepType: '', Message: content });
            return false;
        });
        if (sent) recordMessage({ memberNumber, direction: 'out', channel: message.channel, content }, { notify: false });
        return !!sent;
    }

    return { handle };
}

export { createChatAutoReplyService };

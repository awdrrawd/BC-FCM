function createChatSender({ offlineQueue, canSendWhisper, sendServer, sendBeep, recordMessage, runWithoutOutgoingCapture }) {
    function queue(memberNumber, content) {
        const queued = offlineQueue.add(memberNumber, content);
        recordMessage({ memberNumber, direction: 'out', channel: 'beep', content, queued: true, queueId: queued.id }, { notify: false });
        return true;
    }

    function send({ memberNumber, content, channel, replyTarget = null }) {
        const target = Number(memberNumber);
        if (!target || !content) return false;
        if (channel === 'none') return queue(target, content);

        const replyId = channel === 'whisper' ? replyTarget?.nativeMsgId || '' : '';
        const outgoingId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
        const sent = runWithoutOutgoingCapture(() => {
            if (channel !== 'whisper') return sendBeep({ MemberNumber: target, BeepType: '', Message: content });
            if (!canSendWhisper(target)) return false;
            sendServer('ChatRoomChat', { Type: 'Hidden', Target: target, Content: 'FCM::CHAT::MESSAGE', Dictionary: [{ Tag: 'FCM::CHAT::MESSAGE', MessageId: outgoingId }] });
            if (replyTarget) {
                sendServer('ChatRoomChat', { Type: 'Hidden', Target: target, Content: 'FCM::CHAT::TAG', Dictionary: [{ Tag: 'FCM::CHAT::TAG', ReplyId: replyId, TargetSharedId: replyTarget.sharedMsgId, Preview: replyTarget.preview }] });
            }
            const data = typeof globalThis.ChatRoomGenerateChatRoomChatMessage === 'function'
                ? globalThis.ChatRoomGenerateChatRoomChatMessage('Whisper', content, replyId)
                : { Type: 'Whisper', Content: content, Dictionary: replyId ? [{ Tag: 'ReplyId', ReplyId: replyId }] : [] };
            data.Target = target;
            sendServer('ChatRoomChat', data);
            return true;
        });
        if (!sent) return false;
        recordMessage({
            id: outgoingId, sharedMsgId: outgoingId, memberNumber: target, direction: 'out', channel, content,
            replyPreview: replyTarget?.preview || '', replyToId: replyTarget?.sharedMsgId || '',
        }, { notify: false });
        return true;
    }

    return { send };
}

export { createChatSender };

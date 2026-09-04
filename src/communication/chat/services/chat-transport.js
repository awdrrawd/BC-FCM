import { cleanMessage, parseRoomInvite } from './chat-content.js';

function normalizeMessage(data, { displayName, selectedMember }) {
    return {
        id: data.id || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
        memberNumber: Number(data.memberNumber), direction: data.direction, channel: data.channel,
        content: cleanMessage(data.content), roomName: data.roomName || '', name: displayName(data.memberNumber),
        timestamp: Number(data.timestamp) || Date.now(), read: data.direction === 'out' || Number(data.memberNumber) === Number(selectedMember),
        queued: !!data.queued, queueId: data.queueId || '', nativeMsgId: data.nativeMsgId || '',
        translatedContent: cleanMessage(data.translatedContent || ''), replyPreview: cleanMessage(data.replyPreview || ''),
        replyToId: data.replyToId || '', sharedMsgId: data.sharedMsgId || '',
    };
}

function classifyIncomingBeep(data) {
    if (!data?.Message) return { type: 'ignore' };
    if (data.BeepType === 'LCPlayerInfo' || data.BeepType === 'FCMPlayerInfo') {
        try {
            const info = JSON.parse(data.Message);
            return { type: 'profile', profile: { avatarUrl: info.avatarUrl || info.Avatar || '', signature: info.signature || info.Signature || '', status: info.status || 'online', updatedAt: Number(info.updatedAt || info.UpdateTime) || Date.now() } };
        } catch (error) { return { type: 'invalid-profile', error }; }
    }
    const invite = parseRoomInvite(data.Message);
    if (invite) return { type: 'invite', invite, roomName: invite.roomName || data.ChatRoomName };
    if (data.BeepType && !['Message', 'Beep'].includes(data.BeepType)) return { type: 'ignore' };
    return { type: 'message' };
}

class WhisperMetadata {
    constructor() {
        this.bypassed = new WeakSet();
        this.messageIds = new Map();
        this.replyTags = new Map();
    }

    markBypassed(data) { this.bypassed.add(data); }
    consumeBypassed(data) { return this.bypassed.delete(data); }

    receiveMessageId(data) {
        const tag = Array.isArray(data?.Dictionary) ? data.Dictionary.find(entry => entry?.Tag === 'FCM::CHAT::MESSAGE') : null;
        if (!tag?.MessageId || !data.Sender) return false;
        this.messageIds.set(Number(data.Sender), String(tag.MessageId));
        return true;
    }

    receiveReplyTag(data) {
        const tag = Array.isArray(data?.Dictionary) ? data.Dictionary.find(entry => entry?.Tag === 'FCM::CHAT::TAG') : null;
        if (!tag || !data.Sender) return false;
        this.replyTags.set(Number(data.Sender), { preview: cleanMessage(tag.Preview || ''), replyId: tag.ReplyId || '', targetSharedId: tag.TargetSharedId || '' });
        return true;
    }

    consumeDisplay(data, displayedMessage) {
        const dictionary = Array.isArray(data.Dictionary) ? data.Dictionary : [];
        const idEntry = dictionary.find(entry => entry?.Tag === 'MsgId' && entry.MsgId);
        const content = String(displayedMessage ?? data.Content ?? '');
        const garble = dictionary.find(entry => Array.isArray(entry?.Effects) && entry.Effects.includes('gagGarble') && entry.Original);
        const translatedContent = garble?.Original && cleanMessage(garble.Original) !== cleanMessage(content) ? garble.Original : '';
        const nativeReply = dictionary.find(entry => entry?.Tag === 'ReplyId')?.ReplyId || '';
        const sender = Number(data.Sender);
        const pendingTag = this.replyTags.get(sender);
        const replyTag = pendingTag && (!nativeReply || !pendingTag.replyId || pendingTag.replyId === nativeReply) ? pendingTag : null;
        if (replyTag) this.replyTags.delete(sender);
        const sharedMsgId = this.messageIds.get(sender) || '';
        this.messageIds.delete(sender);
        return { content, translatedContent, nativeMsgId: idEntry?.MsgId || '', replyPreview: replyTag?.preview || '', replyToId: replyTag?.targetSharedId || '', sharedMsgId };
    }
}

function findPendingOutgoingWhisper(messages, target, now = Date.now()) {
    return [...messages].reverse().find(message => message.direction === 'out' && message.channel === 'whisper'
        && message.memberNumber === Number(target) && !message.nativeMsgId && now - message.timestamp < 30000);
}

export { WhisperMetadata, classifyIncomingBeep, findPendingOutgoingWhisper, normalizeMessage };

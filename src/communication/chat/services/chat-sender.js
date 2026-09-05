import { META_TAG, PRIVATE_TAG, PRIVATE_BEEP, privatePackets, profileMentionIds } from './chat-private-payload.js';

function createChatSender({ offlineQueue, isFriend, canSendWhisper, sendServer, sendBeep, recordMessage, runWithoutOutgoingCapture, loadSharedProfile, onNativeMessage, warn, getSelf = () => globalThis.Player?.MemberNumber, wait = () => new Promise(resolve => setTimeout(resolve, 350)) }) {
    const outgoing = new Map();
    function remember(payload) {
        outgoing.set(payload.id, payload);
        while (outgoing.size > 32) outgoing.delete(outgoing.keys().next().value);
    }
    async function deliver(payload, channel) {
        const owner = getSelf();
        const target = payload.target;
        if (channel === 'whisper' && !canSendWhisper(target)) return false;
        if (channel !== 'whisper' && payload.content.length > 1000) return false;
        const data = channel !== 'whisper' ? null : typeof globalThis.ChatRoomGenerateChatRoomChatMessage === 'function'
            ? globalThis.ChatRoomGenerateChatRoomChatMessage('Whisper', payload.content, payload.nativeReplyId || '')
            : { Type: 'Whisper', Content: payload.content, Dictionary: payload.nativeReplyId ? [{ Tag: 'ReplyId', ReplyId: payload.nativeReplyId }] : [] };
        if (data) payload.wireContent = data.Content;
        const enhanced = payload.profiles.length > 0;
        if (enhanced) {
            for (const [index, packet] of privatePackets(payload).entries()) {
                if (index) await wait();
                if (getSelf() !== owner) return false;
                const sent = runWithoutOutgoingCapture(() => {
                    if (channel !== 'whisper') return sendBeep({ MemberNumber: target, BeepType: PRIVATE_BEEP, Message: packet });
                    sendServer('ChatRoomChat', { Type: 'Hidden', Target: target, Content: PRIVATE_TAG, Dictionary: [{ Tag: PRIVATE_TAG, Packet: packet }] });
                    return true;
                });
                if (!sent) return false;
            }
        }
        remember(payload);
        if (channel === 'whisper') {
            data.Target = target;
            data.Dictionary ||= [];
            data.Dictionary.push({ Tag: META_TAG, MessageId: payload.id, Target: target, ReplyPreview: payload.replyPreview, ReplyToId: payload.replyToId });
            runWithoutOutgoingCapture(() => sendServer('ChatRoomChat', data));
        } else {
            if (!runWithoutOutgoingCapture(() => sendBeep({ MemberNumber: target, BeepType: '', Message: payload.content }))) return false;
            onNativeMessage?.(payload, target, true);
        }
        return true;
    }

    async function send({ memberNumber, content, channel, replyTarget = null }) {
        const owner = getSelf();
        const target = Number(memberNumber);
        if (!target || !content) return false;
        try {
            const ids = profileMentionIds(content);
            if (channel === 'none') {
                if (ids.length || !isFriend(target) || content.length > 1000) return false;
                const queued = offlineQueue.add(target, content);
                if (!queued) return false;
                await recordMessage({ memberNumber: target, direction: 'out', channel: 'beep', content,
                    queued: true, queueId: queued.id, replyPreview: replyTarget?.preview || '', replyToId: replyTarget?.sharedMsgId || '' }, { notify: false });
                return true;
            }
            if (ids.length > 6) throw new Error('At most six profiles can be shared in one message');
            const profiles = await Promise.all(ids.map(async id => {
                const profile = await loadSharedProfile(id);
                if (!profile?.characterBundle) throw new Error(`Profile ${id} is unavailable`);
                return profile;
            }));
            if (getSelf() !== owner) return false;
            const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
            const payload = { id, target, content, profiles, replyPreview: replyTarget?.preview || '', replyToId: replyTarget?.sharedMsgId || '', nativeReplyId: replyTarget?.nativeMsgId || '' };
            if (!await deliver(payload, channel)) return false;
            if (getSelf() !== owner) return false;
            await recordMessage({ id, sharedMsgId: id, memberNumber: target, direction: 'out', channel,
                content, profiles, nativeMsgId: payload.nativeMsgId || '', replyPreview: payload.replyPreview, replyToId: payload.replyToId }, { notify: false });
            return true;
        } catch (error) {
            warn?.('private chat send failed', error);
            return false;
        }
    }

    return { send, getOutgoing: id => outgoing.get(id) };
}

export { createChatSender };

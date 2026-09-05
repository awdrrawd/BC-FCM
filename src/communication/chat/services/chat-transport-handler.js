import { WhisperMetadata, classifyIncomingBeep, findPendingOutgoingWhisper } from './chat-transport.js';
import { PRIVATE_TAG, PRIVATE_BEEP, META_TAG, createPrivatePayloadReceiver } from './chat-private-payload.js';

function createChatTransportHandler({ getPlayer, getMessages, getRoot, recordMessage, chatStore, setRemoteProfile, displayName, showRoomInvite, htmlText, warn, isEnabled, isOutgoingSuppressed, nativeTags, getOutgoing }) {
    const whisperMetadata = new WhisperMetadata();
    const bypassPayloads = new WeakMap();
    const beepPayloads = new WeakMap();
    const privateReceiver = createPrivatePayloadReceiver({ getSelf: () => getPlayer()?.MemberNumber });
    const localMessageId = (sender, id) => `private-${getPlayer()?.MemberNumber}-${sender}-${id}`;

    function receivePrivate(data) {
        if (!isEnabled()) return false;
        const beep = data?.BeepType === PRIVATE_BEEP;
        const hidden = data?.Type === 'Hidden' && data?.Content === PRIVATE_TAG;
        if (!beep && !hidden) return false;
        const self = Number(getPlayer()?.MemberNumber);
        if (hidden && Number(data.Target) !== self) return true;
        const sender = Number(beep ? data.MemberNumber : data.Sender);
        const packet = beep ? data.Message : (Array.isArray(data.Dictionary) ? data.Dictionary.find(entry => entry?.Tag === PRIVATE_TAG)?.Packet : null);
        privateReceiver.receive(sender, packet, beep ? 'beep' : 'whisper');
        return true;
    }

    function inlinePayload(data) {
        const self = Number(getPlayer()?.MemberNumber);
        const outgoing = Number(data.Sender) === self;
        if (!isEnabled() || data.Type !== 'Whisper' || (!outgoing && Number(data.Target) !== self)) return null;
        const meta = Array.isArray(data.Dictionary) ? data.Dictionary.find(entry => entry?.Tag === META_TAG) : null;
        if (!meta || meta.Target !== Number(data.Target) || typeof meta.MessageId !== 'string'
            || !/^[a-z0-9-]{6,64}$/i.test(meta.MessageId) || typeof meta.ReplyPreview !== 'string'
            || meta.ReplyPreview.length > 200 || typeof meta.ReplyToId !== 'string' || meta.ReplyToId.length > 128) return null;
        const payload = outgoing ? getOutgoing(meta.MessageId) : privateReceiver.consume(Number(data.Sender), meta.MessageId);
        if (payload && (payload.wireContent || payload.content) === data.Content && payload.target === Number(data.Target)) return payload;
        return { id: meta.MessageId, profiles: [], replyPreview: meta.ReplyPreview, replyToId: meta.ReplyToId };
    }

    function incomingBeep(data) {
        const payload = isEnabled() && !data?.BeepType ? privateReceiver.consumeBeep(Number(data.MemberNumber), data.Message) : null;
        if (payload) {
            beepPayloads.set(data, payload);
            recordMessage({ ...payload, id: localMessageId(data.MemberNumber, payload.id), sharedMsgId: payload.id, memberNumber: data.MemberNumber, direction: 'in', channel: 'beep' });
            return;
        }
        const incoming = classifyIncomingBeep(data);
        if (incoming.type === 'profile') {
            setRemoteProfile(Number(data.MemberNumber), incoming.profile);
            return;
        }
        if (incoming.type === 'invalid-profile') {
            warn('LianChat profile payload parse failed', incoming.error);
            return;
        }
        if (incoming.type === 'invite') {
            const { invite, roomName } = incoming;
            recordMessage({ memberNumber: data.MemberNumber, name: data.MemberName, direction: 'in', channel: 'beep', content: roomName, roomName });
            showRoomInvite(data.MemberNumber, displayName(data.MemberNumber), {
                room: roomName, creator: invite.creator || '', count: invite.count ?? null, limit: invite.limit ?? null,
                desc: invite.desc || '', priv: !!invite.priv, type: invite.type || '',
            });
            return;
        }
        if (incoming.type === 'message') recordMessage({ memberNumber: data.MemberNumber, name: data.MemberName, direction: 'in', channel: 'beep', content: data.Message });
    }

    function incomingWhisper(data) {
        if (!data || data.Type !== 'Whisper' || !data.Content || Number(data.Sender) === Number(getPlayer()?.MemberNumber)) return;
        const payload = inlinePayload(data);
        if (payload) bypassPayloads.set(data, payload);
        recordMessage({ memberNumber: data.Sender, direction: 'in', channel: 'whisper', content: data.Content, timestamp: data.Time,
            ...(payload ? { id: localMessageId(data.Sender, payload.id), sharedMsgId: payload.id, profiles: payload.profiles, replyPreview: payload.replyPreview, replyToId: payload.replyToId } : {}) });
        whisperMetadata.markBypassed(data);
    }

    function incomingWhisperDisplay(data, displayedMessage, senderCharacter, element) {
        if (!data || data.Type !== 'Whisper') return;
        const payload = bypassPayloads.get(data) || inlinePayload(data);
        bypassPayloads.delete(data);
        const peer = Number(data.Sender) === Number(getPlayer()?.MemberNumber) ? Number(data.Target) : Number(data.Sender);
        if (payload) nativeTags.decorate(element, payload, peer);
        if (whisperMetadata.consumeBypassed(data)) return;
        const idEntry = Array.isArray(data.Dictionary) ? data.Dictionary.find(entry => entry?.Tag === 'MsgId' && entry.MsgId) : null;
        if (Number(data.Sender) === Number(getPlayer()?.MemberNumber)) {
            if (payload && idEntry?.MsgId) payload.nativeMsgId = idEntry.MsgId;
            const pending = payload ? getMessages().find(message => message.id === payload.id) : findPendingOutgoingWhisper(getMessages(), Number(data.Target));
            if (pending && idEntry?.MsgId) {
                pending.nativeMsgId = idEntry.MsgId;
                chatStore.put(pending);
                getRoot()?.querySelector(`[data-msg-id="${CSS.escape(String(pending.id))}"]`)?.setAttribute('data-native-msg-id', idEntry.MsgId);
            }
            return;
        }
        const metadata = whisperMetadata.consumeDisplay(data, displayedMessage);
        recordMessage({ memberNumber: senderCharacter?.MemberNumber ?? data.Sender, direction: 'in', channel: 'whisper', ...metadata,
            ...(payload ? { id: localMessageId(data.Sender, payload.id), sharedMsgId: payload.id, profiles: payload.profiles, replyPreview: payload.replyPreview, replyToId: payload.replyToId } : {}), timestamp: data.Time });
    }

    function incomingFriendRequest(data) {
        const memberNumber = Number(data.MemberNumber);
        recordMessage({ memberNumber, name: displayName(memberNumber), direction: 'in', channel: 'beep', content: `📩 ${htmlText('friendReqIncoming', `${displayName(memberNumber)} (${memberNumber})`)}` });
    }

    function outgoing(type, data) {
        if (!isEnabled() || isOutgoingSuppressed() || !data) return;
        if (type === 'AccountBeep' && data.MemberNumber && data.Message && !data.BeepType) {
            recordMessage({ memberNumber: data.MemberNumber, direction: 'out', channel: 'beep', content: data.Message }, { notify: false });
        } else if (type === 'ChatRoomChat' && data.Type === 'Whisper' && data.Target && data.Content) {
            recordMessage({ memberNumber: data.Target, direction: 'out', channel: 'whisper', content: data.Content }, { notify: false });
        }
    }

    return {
        receivePrivate,
        incomingBeepDisplay: (data, element) => {
            const payload = beepPayloads.get(data);
            beepPayloads.delete(data);
            if (payload) nativeTags.decorateBeep(element, payload, Number(data.MemberNumber));
        },
        incomingBeep, incomingFriendRequest, incomingWhisper, incomingWhisperDisplay, outgoing,
        receiveMessageId: data => isEnabled() && Number(data?.Target) === Number(getPlayer()?.MemberNumber) && whisperMetadata.receiveMessageId(data),
        receiveReplyTag: data => isEnabled() && Number(data?.Target) === Number(getPlayer()?.MemberNumber) && whisperMetadata.receiveReplyTag(data),
    };
}

export { createChatTransportHandler };

import { WhisperMetadata, classifyIncomingBeep, findPendingOutgoingWhisper } from './chat-transport.js';

function createChatTransportHandler({ getPlayer, getMessages, getRoot, recordMessage, chatStore, setRemoteProfile, displayName, showRoomInvite, htmlText, warn, isEnabled, isOutgoingSuppressed }) {
    const whisperMetadata = new WhisperMetadata();

    function incomingBeep(data) {
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
        recordMessage({ memberNumber: data.Sender, direction: 'in', channel: 'whisper', content: data.Content, timestamp: data.Time });
        whisperMetadata.markBypassed(data);
    }

    function incomingWhisperDisplay(data, displayedMessage, senderCharacter) {
        if (!data || data.Type !== 'Whisper' || whisperMetadata.consumeBypassed(data)) return;
        const idEntry = Array.isArray(data.Dictionary) ? data.Dictionary.find(entry => entry?.Tag === 'MsgId' && entry.MsgId) : null;
        if (Number(data.Sender) === Number(getPlayer()?.MemberNumber)) {
            const pending = findPendingOutgoingWhisper(getMessages(), Number(data.Target));
            if (pending && idEntry?.MsgId) {
                pending.nativeMsgId = idEntry.MsgId;
                chatStore.put(pending);
                getRoot()?.querySelector(`[data-msg-id="${CSS.escape(String(pending.id))}"]`)?.setAttribute('data-native-msg-id', idEntry.MsgId);
            }
            return;
        }
        const metadata = whisperMetadata.consumeDisplay(data, displayedMessage);
        recordMessage({ memberNumber: senderCharacter?.MemberNumber ?? data.Sender, direction: 'in', channel: 'whisper', ...metadata, timestamp: data.Time });
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
        incomingBeep, incomingFriendRequest, incomingWhisper, incomingWhisperDisplay, outgoing,
        receiveMessageId: data => whisperMetadata.receiveMessageId(data),
        receiveReplyTag: data => whisperMetadata.receiveReplyTag(data),
    };
}

export { createChatTransportHandler };

import { TH } from '../../../i18n/i18n.js';
import { REPLY_ICON } from '../../../ui/icons.js';
import { cleanMessage, esc, messageContentHtml } from '../services/chat-content.js';

function messageDateKey(timestamp) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function messageDateLabel(timestamp) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function profileMentionsHtml(content) {
    const pattern = /@([^@\n()]*?)\s*\((\d+)\)|@(\d+)/gu;
    let html = '';
    let last = 0;
    for (const match of String(content).matchAll(pattern)) {
        html += messageContentHtml(String(content).slice(last, match.index));
        const memberNumber = match[2] || match[3];
        html += `<button class="fcm-chat-profile-mention" data-profile-member="${memberNumber}">${esc(match[0])}</button>`;
        last = match.index + match[0].length;
    }
    return html + messageContentHtml(String(content).slice(last));
}

function messageHtml(message) {
    const content = cleanMessage(message.content);
    const kind = message.channel === 'whisper' && content.startsWith('*') ? ' emote' : message.channel === 'whisper' && content.startsWith('(') ? ' ooc' : '';
    return `<div class="fcm-chat-message ${message.direction}${kind} ${message.queued ? 'queued' : ''}" data-msg-id="${esc(message.id)}" data-message-date="${esc(messageDateKey(message.timestamp))}" data-shared-msg-id="${esc(message.sharedMsgId || message.id)}" data-native-msg-id="${esc(message.nativeMsgId || '')}"><button class="fcm-chat-message-reply" data-message-reply title="${TH('chatReply')}">${REPLY_ICON}</button>${message.replyPreview ? `<button class="fcm-chat-tag-preview" data-reply-jump="${esc(message.replyToId || '')}">${REPLY_ICON}<i>${esc(message.replyPreview)}</i></button>` : ''}<span class="fcm-chat-content">${profileMentionsHtml(content)}</span>${message.translatedContent ? `<span class="fcm-chat-message-original">[${esc(cleanMessage(message.translatedContent))}]</span>` : ''}${message.roomName ? `<button class="fcm-chat-room-join" data-join-room="${esc(message.roomName)}">${TH('roomJoinRoomBtn')}</button>` : ''}<time>${message.channel === 'whisper' ? TH('chatChannelWhisper') : TH('chatChannelPrivate')} · ${new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${message.queued ? ` · ${TH('chatQueued')}` : ''}</time></div>`;
}

function conversationMessagesHtml(rows) {
    let previousDate = '';
    return rows.map(message => {
        const date = messageDateKey(message.timestamp);
        const separator = date !== previousDate ? `<div class="fcm-chat-date-separator" data-message-date="${esc(date)}"><span>${esc(messageDateLabel(message.timestamp))}</span></div>` : '';
        previousDate = date;
        return separator + messageHtml(message);
    }).join('');
}

export { conversationMessagesHtml, messageDateKey, messageDateLabel, messageHtml };

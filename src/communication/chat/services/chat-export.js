import { cfg } from '../../../core/config.js';
import { warnLimited } from '../../../core/logger.js';
import { T } from '../../../i18n/i18n.js';
import { Snapshot } from '../../../data/profile-db.js';
import { ChatStore } from '../data/chat-store.js';
import { esc, messageContentHtml } from './chat-content.js';

function downloadConversationFile(content, type, extension, memberNumber) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([content], { type }));
    link.download = `FCM-Chat-${memberNumber}-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function exportedMessageHtml(message, peerName, selfName) {
    const sender = message.direction === 'out' ? selfName : peerName;
    const reply = message.replyPreview ? `<div class="reply">↩ ${esc(message.replyPreview)}</div>` : '';
    const translation = message.translatedContent ? `<div class="translation">[${esc(message.translatedContent)}]</div>` : '';
    return `<article class="message ${message.direction}">${reply}<div class="sender">${esc(sender)}</div><div class="content">${messageContentHtml(message.content, false)}</div>${translation}<footer>${esc(message.channel === 'whisper' ? T('chatChannelWhisper') : T('chatChannelPrivate'))} · <time datetime="${new Date(message.timestamp).toISOString()}">${esc(new Date(message.timestamp).toLocaleString())}</time></footer></article>`;
}

function exportTimestamp(date = new Date()) {
    const pad = value => String(value).padStart(2, '0');
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function blobAsDataUrl(blob) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(blob);
    });
}

async function exportAvatarUrl(memberNumber, directUrl) {
    if (directUrl?.startsWith('data:image/')) return directUrl;
    const record = await Snapshot.getRecord(memberNumber);
    if (record?.blob instanceof Blob) return blobAsDataUrl(record.blob);
    if (directUrl && !directUrl.startsWith('blob:')) {
        try {
            const response = await fetch(directUrl);
            if (response.ok) return await blobAsDataUrl(await response.blob());
        } catch (error) { warnLimited('chat export avatar conversion failed', error); }
        return directUrl;
    }
    return '';
}

function conversationExportHtml(storedMessages, peerAvatar, context) {
    const { memberNumber, getDisplayName, chatColors } = context;
    const peerName = `${getDisplayName(memberNumber)} (${memberNumber})`;
    const selfDisplayName = String(Player?.Nickname || Player?.Name || getDisplayName(Player?.MemberNumber));
    const selfName = `${selfDisplayName} (${Player?.MemberNumber})`;
    const peerAvatarHtml = peerAvatar ? `<img class="avatar" src="${esc(peerAvatar)}" alt="" onerror="this.remove()">` : '';
    const [panel, text, accent] = chatColors();
    const title = `FCM Chat — ${peerName}`;
    return `<!doctype html><html lang="${esc(document.documentElement.lang || cfg.lang || 'en')}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>
:root{color-scheme:dark;--panel:${esc(panel)};--text:${esc(text)};--accent:${esc(accent)};--surface:color-mix(in srgb,var(--panel) 82%,#000);--incoming-border:color-mix(in srgb,var(--text) 65%,transparent)}*{box-sizing:border-box}body{margin:0;background:#111;color:var(--text);font:14px/1.45 system-ui,sans-serif}.app{width:min(860px,100%);min-height:100vh;margin:auto;background:var(--panel);box-shadow:0 0 40px #000}.header{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:11px;padding:14px 22px;background:color-mix(in srgb,var(--panel) 92%,transparent);border-bottom:1px solid color-mix(in srgb,var(--accent) 35%,transparent);backdrop-filter:blur(10px)}.avatar{width:42px;height:42px;flex:0 0 42px;object-fit:cover;border:1px solid var(--accent);border-radius:50%}h1{margin:0;color:var(--accent);font-size:18px}.messages{display:flex;flex-direction:column;gap:10px;padding:22px}.message{position:relative;width:fit-content;max-width:72%;padding:9px 12px;border:1px solid var(--incoming-border);border-radius:9px;background:var(--surface)}.message::before{content:"";position:absolute;top:16px;width:8px;height:8px;background:var(--surface);transform:rotate(45deg)}.message.in::before{left:-5px;border-left:1px solid var(--incoming-border);border-bottom:1px solid var(--incoming-border)}.message.out{align-self:flex-end;background:color-mix(in srgb,var(--accent) 14%,var(--panel));border-color:var(--accent)}.message.out::before{right:-5px;background:color-mix(in srgb,var(--accent) 14%,var(--panel));border-top:1px solid var(--accent);border-right:1px solid var(--accent)}.sender{margin-bottom:3px;color:var(--accent);font-size:12px;font-weight:700}.content{white-space:pre-wrap;overflow-wrap:anywhere;user-select:text}.content a{color:var(--accent)}.content img{display:block;max-width:min(420px,100%);max-height:420px;margin-top:7px;border-radius:7px}.reply{margin-bottom:6px;padding:4px 7px;border-left:3px solid var(--accent);background:#0002;opacity:.82}.translation{margin-top:5px}.message footer{margin-top:5px;font-size:10px;opacity:.62}.empty{text-align:center;opacity:.65}</style></head><body><main class="app"><header class="header">${peerAvatarHtml}<h1>${esc(peerName)} - ${esc(exportTimestamp())} · ${storedMessages.length}</h1></header><section class="messages">${storedMessages.map(message => exportedMessageHtml(message, peerName, selfName)).join('') || `<div class="empty">${esc(T('chatNoMessages'))}</div>`}</section></main></body></html>`;
}

async function exportConversation(format, context) {
    const memberNumber = Number(context.memberNumber);
    if (!memberNumber) return;
    const storedMessages = Array.isArray(context.messages) ? context.messages : await ChatStore.memberAll(memberNumber);
    if (format === 'json') {
        const payload = {
            format: 'FCM_CHAT_EXPORT', version: 1, exportedAt: new Date().toISOString(),
            owner: { memberNumber: Number(Player?.MemberNumber), name: String(Player?.Nickname || Player?.Name || context.getDisplayName(Player?.MemberNumber)) },
            contact: { memberNumber, name: context.getDisplayName(memberNumber), biography: context.biography(memberNumber) || '' },
            messageCount: storedMessages.length,
            messages: storedMessages.map(({ ownerMemberNumber: _owner, ...message }) => message),
        };
        downloadConversationFile(JSON.stringify(payload, null, 2), 'application/json;charset=utf-8', 'json', memberNumber);
        return;
    }
    const peerAvatar = await exportAvatarUrl(memberNumber, context.avatarUrl(memberNumber));
    downloadConversationFile(conversationExportHtml(storedMessages, peerAvatar, context), 'text/html;charset=utf-8', 'html', memberNumber);
}

export { exportConversation };

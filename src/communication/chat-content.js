import { TH } from '../i18n/i18n.js';
import { imageOriginTrusted } from './image-trust.js';

const CHAT_IMAGE_EXT = /\.(?:png|jpe?g|gif|webp|bmp|avif|apng|jfif|svg|ico)$/iu;
const BALLOON_PREVIEW_MAX_CHARS = 80;

function esc(value) {
    const el = document.createElement('div');
    el.textContent = String(value ?? '');
    return el.innerHTML;
}

function cleanMessage(value) {
    let text = String(value ?? '');
    // Older releases appended private metadata after these markers. Strip it
    // whenever stored history or incoming compatibility payloads are rendered.
    const hiddenIndex = text.indexOf('\uf124');
    if (hiddenIndex >= 0) text = text.slice(0, hiddenIndex);
    const legacyIndex = text.indexOf('{"messageType"');
    if (legacyIndex > 0) text = text.slice(0, legacyIndex);
    return text.replace(/[\r\n]+$/g, '').trim();
}

function balloonPreviewText(value) {
    const normalized = cleanMessage(value).replace(/\s+/gu, ' ').trim();
    const characters = Array.from(normalized);
    return characters.length > BALLOON_PREVIEW_MAX_CHARS
        ? `${characters.slice(0, BALLOON_PREVIEW_MAX_CHARS).join('')}…`
        : normalized;
}

function messageContentHtml(value, interactive = true) {
    const text = cleanMessage(value);
    const urlPattern = /https?:\/\/[^\s<>"']+/giu;
    let html = '';
    let cursor = 0;
    for (const match of text.matchAll(urlPattern)) {
        const raw = match[0];
        const trailing = raw.match(/[),.!?\]]+$/u)?.[0] || '';
        const candidate = trailing ? raw.slice(0, -trailing.length) : raw;
        let url;
        try { url = new URL(candidate); } catch { continue; }
        if (!['http:', 'https:'].includes(url.protocol)) continue;
        html += esc(text.slice(cursor, match.index));
        const href = esc(url.href);
        if (CHAT_IMAGE_EXT.test(url.pathname)) {
            html += imageOriginTrusted(url)
                ? `<a class="fcm-chat-image-link" href="${href}" target="_blank" rel="noopener noreferrer" title="${href}"><img class="fcm-chat-image" src="${href}" alt="${href}" loading="lazy" referrerpolicy="no-referrer"></a>`
                : `<a class="fcm-chat-link" href="${href}" target="_blank" rel="noopener noreferrer">${esc(candidate)}</a>${interactive ? ` <button class="fcm-chat-image-trust" data-trust-image-origin="${esc(url.origin)}" type="button">${TH('chatTrustImage')}</button>` : ''}`;
        } else {
            html += `<a class="fcm-chat-link" href="${href}" target="_blank" rel="noopener noreferrer">${esc(candidate)}</a>`;
        }
        html += esc(trailing);
        cursor = match.index + raw.length;
    }
    return html + esc(text.slice(cursor));
}

function parseRoomInvite(value) {
    const lines = String(value ?? '').replace(/\r\n?/g, '\n').split('\n');
    const match = lines[0]?.trim().match(/^\|([^|]+)\|(.*)$/u);
    if (!match?.[1]?.trim()) return null;
    const full = (match[2] || '').match(/^\s*-\s*(.*?)\s*＜(\d+)\/(\d+)＞\s*$/u);
    return {
        roomName: match[1].trim(),
        creator: full?.[1]?.trim() || '',
        count: full?.[2] == null ? null : Number(full[2]),
        limit: full?.[3] == null ? null : Number(full[3]),
        desc: lines.slice(1).join('\n').trim(),
    };
}

export { balloonPreviewText, cleanMessage, esc, messageContentHtml, parseRoomInvite };

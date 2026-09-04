import { messageDateKey, messageDateLabel, messageHtml } from '../views/chat-message-view.js';
import { esc } from '../services/chat-content.js';

function createChatMessageAppender({ getRoot, conversation, bindImages, updateUnreadNotice, joinRoom }) {
    function append(message) {
        const log = getRoot()?.querySelector('.fcm-chat-main .fcm-chat-messages');
        if (!log || log.querySelector(`[data-msg-id="${CSS.escape(String(message.id))}"]`)) return;
        const shouldFollowLatest = conversation.viewport.shouldFollow(log, message.direction);
        log.querySelector(':scope > .fcm-chat-empty')?.remove();
        const previousElement = [...log.querySelectorAll(':scope > .fcm-chat-message')].at(-1);
        const previousMessage = previousElement
            ? conversation.messages.find(row => String(row.id) === previousElement.dataset.msgId)
            : null;
        if (!previousMessage || messageDateKey(previousMessage.timestamp) !== messageDateKey(message.timestamp)) {
            log.insertAdjacentHTML('beforeend', `<div class="fcm-chat-date-separator" data-message-date="${esc(messageDateKey(message.timestamp))}"><span>${esc(messageDateLabel(message.timestamp))}</span></div>`);
        }
        log.insertAdjacentHTML('beforeend', messageHtml(message));
        const inserted = log.lastElementChild;
        inserted?.querySelector('[data-join-room]')?.addEventListener('click', event => {
            const room = event.currentTarget.dataset.joinRoom;
            if (room) joinRoom({ room });
        });
        bindImages(inserted, log);
        if (shouldFollowLatest) {
            conversation.viewport.follow();
            conversation.unread = 0;
            requestAnimationFrame(() => {
                conversation.viewport.scrollToLatest(log);
                updateUnreadNotice();
            });
        } else {
            conversation.unread++;
            updateUnreadNotice();
        }
    }

    return { append };
}

export { createChatMessageAppender };

import { esc } from '../services/chat-content.js';

function createChatReplyController({ getRoot, cleanMessage, text, previewLength = 80 }) {
    let target = null;

    function get() {
        return target;
    }

    function clear({ focus = true } = {}) {
        target = null;
        getRoot()?.querySelector('.fcm-chat-reply-indicator')?.remove();
        if (focus) getRoot()?.querySelector('[data-input]')?.focus();
    }

    function renderIndicator() {
        const wrap = getRoot()?.querySelector('.fcm-chat-input-wrap');
        if (!wrap || !target) return;
        let indicator = wrap.querySelector('.fcm-chat-reply-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.className = 'fcm-chat-reply-indicator';
            wrap.prepend(indicator);
        }
        indicator.innerHTML = `<span>${text('chatReply')}: ${esc(target.preview)}</span><button data-cancel-reply title="${text('chatCancel')}">×</button>`;
        indicator.querySelector('[data-cancel-reply]').addEventListener('click', clear);
    }

    function select(messageElement) {
        target = {
            nativeMsgId: messageElement?.dataset.nativeMsgId,
            sharedMsgId: messageElement?.dataset.sharedMsgId || messageElement?.dataset.msgId || '',
            preview: cleanMessage(messageElement?.querySelector('.fcm-chat-content')?.textContent || '').slice(0, previewLength),
        };
        renderIndicator();
        const input = getRoot()?.querySelector('[data-input]');
        if (input) {
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
        }
    }

    return { clear, get, select };
}

export { createChatReplyController };

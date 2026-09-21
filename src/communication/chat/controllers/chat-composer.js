function createChatComposer({ getRoot, getMemberNumber, displayName, capability, isFriend, sender, getReplyTarget, clearReplyTarget, text = key => key, sendingDelay = 600 }) {
    let sending = false;
    const channels = new Map();
    function getChannel(memberNumber = getMemberNumber()) {
        const available = capability(memberNumber);
        return available === 'whisper' && channels.get(Number(memberNumber)) === 'beep' ? 'beep' : available;
    }
    function selectChannel(channel) {
        const memberNumber = Number(getMemberNumber());
        const available = capability(memberNumber);
        if (channel !== available && !(available === 'whisper' && channel === 'beep')) return;
        channels.set(memberNumber, channel);
    }
    function expandProfileMentions(content) {
        return String(content).replace(/@(\d+)/gu, (all, id) => `@${displayName(Number(id))} (${id})`);
    }

    async function send() {
        if (sending) return;
        const input = getRoot()?.querySelector('[data-input]');
        const memberNumber = Number(getMemberNumber());
        const content = expandProfileMentions(input?.value.trim() || '');
        if (!input || !content || !memberNumber) return;
        const available = getChannel(memberNumber);
        if (available === 'none' && !isFriend(memberNumber)) return;
        const original = input.value;
        const reply = getReplyTarget();
        const button = getRoot()?.querySelector('[data-send]');
        const label = button?.textContent;
        const notice = getRoot()?.querySelector('[data-bcx-compose-notice]');
        if (notice) notice.hidden = true;
        const width = button?.style?.width;
        if (button) {
            if (button.style && button.getBoundingClientRect) button.style.width = button.getBoundingClientRect().width + 'px';
            button.disabled = true;
            if (button.dataset) button.dataset.sending = 'true';
        }
        const timer = setTimeout(() => {
            if (button?.isConnected && Number(getMemberNumber()) === memberNumber) button.textContent = text('chatSending');
        }, sendingDelay);
        sending = true;
        try {
            const sent = await sender.send({ memberNumber, content, channel: available, replyTarget: reply });
            if (Number(getMemberNumber()) !== memberNumber || !input.isConnected) return;
            if (!sent) {
                if (notice?.hidden) { notice.textContent = text('chatSendFailed'); notice.hidden = false; }
                return;
            }
            if (getReplyTarget() === reply) clearReplyTarget({ focus: false });
            if (input.value === original) input.value = '';
        } finally {
            clearTimeout(timer);
            sending = false;
            if (button) {
                button.disabled = capability(memberNumber) === 'none' && !isFriend(memberNumber);
                button.textContent = label;
                if (button.style) button.style.width = width;
                if (button.dataset) delete button.dataset.sending;
            }
        }
    }

    function handleKeydown(event) {
        event.stopPropagation();
        if (event.isComposing || event.keyCode === 229) return;
        if (event.key !== 'Enter' || event.shiftKey) return;
        event.preventDefault();
        return send();
    }

    return { getChannel, selectChannel, handleKeydown, send };
}

export { createChatComposer };

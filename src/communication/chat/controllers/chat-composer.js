function createChatComposer({ getRoot, getMemberNumber, displayName, capability, isFriend, sender, getReplyTarget, clearReplyTarget, text = key => key }) {
    let sending = false;
    function expandProfileMentions(content) {
        return String(content).replace(/@(\d+)/gu, (all, id) => `@${displayName(Number(id))} (${id})`);
    }

    async function send() {
        if (sending) return;
        const input = getRoot()?.querySelector('[data-input]');
        const memberNumber = Number(getMemberNumber());
        const content = expandProfileMentions(input?.value.trim() || '');
        if (!input || !content || !memberNumber) return;
        const available = capability(memberNumber);
        if (available === 'none' && !isFriend(memberNumber)) return;
        const original = input.value;
        const reply = getReplyTarget();
        const button = getRoot()?.querySelector('[data-send]');
        const label = button?.textContent;
        const notice = getRoot()?.querySelector('[data-bcx-compose-notice]');
        if (notice) notice.hidden = true;
        if (button) { button.disabled = true; button.textContent = text('chatSending'); }
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
            sending = false;
            if (button) { button.disabled = false; button.textContent = label; }
        }
    }

    function handleKeydown(event) {
        event.stopPropagation();
        if (event.isComposing || event.keyCode === 229) return;
        if (event.key !== 'Enter' || event.shiftKey) return;
        event.preventDefault();
        return send();
    }

    return { handleKeydown, send };
}

export { createChatComposer };

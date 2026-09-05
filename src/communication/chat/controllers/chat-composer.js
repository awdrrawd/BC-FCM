function createChatComposer({ getRoot, getMemberNumber, displayName, capability, isFriend, sender, getReplyTarget, clearReplyTarget }) {
    function expandProfileMentions(content) {
        return String(content).replace(/@(\d+)/gu, (all, id) => `@${displayName(Number(id))} (${id})`);
    }

    function send() {
        const input = getRoot()?.querySelector('[data-input]');
        const memberNumber = Number(getMemberNumber());
        const content = expandProfileMentions(input?.value.trim() || '');
        if (!input || !content || !memberNumber) return;
        const available = capability(memberNumber);
        if (available === 'none' && !isFriend(memberNumber)) return;
        const sent = sender.send({ memberNumber, content, channel: available, replyTarget: getReplyTarget() });
        if (!sent) return;
        clearReplyTarget({ focus: false });
        input.value = '';
    }

    function handleKeydown(event) {
        event.stopPropagation();
        if (event.isComposing || event.keyCode === 229) return;
        if (event.key !== 'Enter' || event.shiftKey) return;
        event.preventDefault();
        send();
    }

    return { handleKeydown, send };
}

export { createChatComposer };

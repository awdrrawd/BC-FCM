function createChatMessageRecorder({ config, normalizeMessage, chatStore, conversation, isPanelVisible, isSelectedMember, setMessageIndex, appendMessage, refreshList, notifyIncoming }) {
    async function record(data, { notify = true } = {}) {
        if (!config.communicationEnabled || !data?.memberNumber) return null;
        const message = normalizeMessage(data);
        if (!message.content) return null;
        message.read = message.direction === 'out' || (isPanelVisible() && isSelectedMember(message.memberNumber));
        await chatStore.put(message);
        setMessageIndex(await chatStore.recentIndex());
        if (isPanelVisible()) {
            if (isSelectedMember(message.memberNumber)) {
                conversation.add(message);
                appendMessage(message);
            }
            refreshList();
        }
        if (notify && message.direction === 'in') notifyIncoming(message);
        return message;
    }

    return { record };
}

export { createChatMessageRecorder };

function createChatConversationActions({ getMemberNumber, displayName, confirm, text, chatStore, offlineQueue, removeFromIndex, resetConversation, exportConversation, biography, avatarUrl, chatColors, onDeleted }) {
    async function deleteCurrent() {
        const memberNumber = Number(getMemberNumber());
        if (!memberNumber || !await confirm(text('chatConfirmDeleteConv', displayName(memberNumber)))) return;
        await chatStore.deleteMember(memberNumber);
        offlineQueue.removeMember(memberNumber);
        removeFromIndex(memberNumber);
        if (Number(getMemberNumber()) === memberNumber) {
            resetConversation();
            onDeleted();
        }
    }

    function exportCurrent(format) {
        const memberNumber = Number(getMemberNumber());
        if (!memberNumber) return;
        return exportConversation(format, {
            memberNumber, getDisplayName: displayName, biography, avatarUrl, chatColors,
        });
    }

    return { deleteCurrent, exportCurrent };
}

export { createChatConversationActions };

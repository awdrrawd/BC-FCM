function createChatMemberSelection({ getRoot, getMemberNumber, setMemberNumber, resetSelection, clearReply, closeContactCard, setStackedDetail, chatStore, setMessageIndex, loadConversation, refreshList, refreshBadges, getLayout, refreshConversation }) {
    let justOpenedMember = null;
    let clearTimer = 0;

    function getJustOpenedMember() {
        return justOpenedMember;
    }

    async function select(memberNumber) {
        const target = Number(memberNumber);
        if (!target) return;
        setMemberNumber(target);
        resetSelection();
        clearReply({ focus: false });
        closeContactCard();
        justOpenedMember = target;
        setStackedDetail(true);
        await chatStore.markRead(target);
        if (Number(getMemberNumber()) !== target) return;
        const messageIndex = await chatStore.recentIndex();
        if (Number(getMemberNumber()) !== target) return;
        setMessageIndex(messageIndex);
        refreshList();
        refreshBadges();
        await loadConversation(target);
        if (Number(getMemberNumber()) !== target) return;
        const root = getRoot();
        const stacked = getLayout() === 'stacked';
        root?.querySelector('.fcm-chat-list')?.classList.toggle('slide-out', stacked);
        root?.querySelector('.fcm-chat-main')?.classList.toggle('slide-in', stacked);
        refreshConversation();
        clearTimeout(clearTimer);
        clearTimer = window.setTimeout(() => {
            if (justOpenedMember === target) justOpenedMember = null;
        }, 350);
    }

    function bind(scope = getRoot()) {
        scope?.querySelectorAll('[data-member]').forEach(button => button.addEventListener('click', () => select(button.dataset.member)));
    }

    return { bind, getJustOpenedMember, select };
}

export { createChatMemberSelection };

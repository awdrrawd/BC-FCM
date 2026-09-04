function createChatLifecycle({ config, getRoot, setRoot, getSelectedMember, setSelectedMember, getPlayerMemberNumber, setActiveView, setStackedDetail, resetSelection, clearReply, closeContactCard, cleanupMessageActions, requestOnlineFriends, chatStore, setMessageIndex, loadConversation, refreshBadges, render, syncBalloonVisibility, ensureBalloons, resetBalloonInteraction, paintBalloon }) {
    function ensureRoot() {
        let root = getRoot();
        if (!root?.isConnected) {
            root = document.createElement('div');
            root.id = 'fcm-chat-root';
            document.body.appendChild(root);
            setRoot(root);
        }
        return root;
    }

    async function open(memberNumber = null) {
        if (!config.communicationEnabled) return false;
        if (Number(memberNumber) === Number(getPlayerMemberNumber())) memberNumber = null;
        if (memberNumber) {
            setSelectedMember(Number(memberNumber));
            resetSelection();
            clearReply({ focus: false });
            closeContactCard();
            setStackedDetail(true);
        }
        ensureRoot().style.display = 'block';
        requestOnlineFriends();
        const selectedMember = getSelectedMember();
        if (selectedMember) await chatStore.markRead(selectedMember);
        if (selectedMember && Number(getSelectedMember()) !== Number(selectedMember)) return false;
        const messageIndex = await chatStore.recentIndex();
        if (selectedMember && Number(getSelectedMember()) !== Number(selectedMember)) return false;
        setMessageIndex(messageIndex);
        if (selectedMember) await loadConversation(selectedMember);
        if (selectedMember && Number(getSelectedMember()) !== Number(selectedMember)) return false;
        refreshBadges();
        render();
        return true;
    }

    function minimize() {
        cleanupMessageActions();
        const root = getRoot();
        if (root) root.style.display = 'none';
        syncBalloonVisibility();
        ensureBalloons(true);
    }

    function toggle(memberNumber = null) {
        const root = getRoot();
        if (root?.isConnected && root.style.display !== 'none') minimize();
        else {
            if (memberNumber) setActiveView('chat');
            else {
                setActiveView('notifications');
                setStackedDetail(false);
            }
            open(memberNumber);
        }
    }

    function close() {
        const memberToClose = getSelectedMember();
        setSelectedMember(null);
        resetSelection();
        clearReply({ focus: false });
        closeContactCard();
        setStackedDetail(false);
        cleanupMessageActions();
        const root = getRoot();
        if (root) root.style.display = 'none';
        syncBalloonVisibility();
        document.querySelectorAll('#fcm-chat-balloon,.fcm-chat-user-balloon').forEach(resetBalloonInteraction);
        if (memberToClose) document.getElementById(`fcm-chat-user-${memberToClose}`)?.remove();
        const balloon = document.getElementById('fcm-chat-balloon');
        if (!config.persistentBalloon) balloon?.remove();
        else if (!balloon) ensureBalloons();
        else {
            paintBalloon(balloon);
            balloon.classList.toggle('persistent', !!config.communicationEnabled);
        }
    }

    return { close, minimize, open, toggle };
}

export { createChatLifecycle };

function createChatHistoryViewportController({ getRoot, getMemberNumber, conversation, store, renderMessages, bindImages, syncSelection, joinRoom, text }) {
    let dateFrame = 0;

    function updateUnreadNotice() {
        const button = getRoot()?.querySelector('[data-new-messages]');
        if (!button) return;
        button.hidden = !conversation.unread;
        button.textContent = text('chatNewUnread', conversation.unread);
    }

    function updateDateBubble(log) {
        const bubble = getRoot()?.querySelector('[data-history-date]');
        if (!log || !bubble) return;
        cancelAnimationFrame(dateFrame);
        dateFrame = requestAnimationFrame(() => {
            const distanceFromLatest = log.scrollHeight - log.scrollTop - log.clientHeight;
            if (distanceFromLatest <= 24) {
                bubble.hidden = true;
                return;
            }
            const logTop = log.getBoundingClientRect().top;
            const current = [...log.querySelectorAll(':scope > .fcm-chat-message')].find(message => message.getBoundingClientRect().bottom > logTop + 4);
            if (!current?.dataset.messageDate) {
                bubble.hidden = true;
                return;
            }
            const [year, month, day] = current.dataset.messageDate.split('-');
            bubble.textContent = `${year}/${month}/${day}`;
            bubble.hidden = false;
        });
    }

    async function loadOlder(log) {
        const memberNumber = Number(getMemberNumber());
        if (!memberNumber) return;
        const oldHeight = log.scrollHeight;
        const oldTop = log.scrollTop;
        const loaded = await conversation.loadOlder(store, memberNumber, target => Number(getMemberNumber()) === target);
        if (!loaded || !log.isConnected) return;
        log.innerHTML = renderMessages(conversation.messages);
        bindImages(log, log);
        syncSelection();
        log.querySelectorAll('[data-join-room]').forEach(button => button.addEventListener('click', () => {
            if (button.dataset.joinRoom) joinRoom({ room: button.dataset.joinRoom });
        }));
        log.scrollTop = oldTop + (log.scrollHeight - oldHeight);
        updateDateBubble(log);
    }

    function bind(log, newMessagesButton) {
        log?.addEventListener('scroll', () => {
            if (log.scrollTop < 80) loadOlder(log);
            if (conversation.viewport.updateFromScroll(log) && conversation.unread) {
                conversation.unread = 0;
                updateUnreadNotice();
            }
            updateDateBubble(log);
        });
        newMessagesButton?.addEventListener('click', () => {
            conversation.viewport.follow();
            conversation.viewport.scrollToLatest(log);
            conversation.unread = 0;
            updateUnreadNotice();
        });
    }

    function reset() {
        cancelAnimationFrame(dateFrame);
        dateFrame = 0;
    }

    return { bind, reset, updateDateBubble, updateUnreadNotice };
}

export { createChatHistoryViewportController };

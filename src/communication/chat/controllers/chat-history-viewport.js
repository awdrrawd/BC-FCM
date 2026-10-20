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

    function bindJoinButtons(scope) {
        scope.querySelectorAll('[data-join-room]').forEach(button => button.addEventListener('click', () => {
            if (button.dataset.joinRoom) joinRoom({ room: button.dataset.joinRoom });
        }));
    }

    // Renders only the rows that are not in the DOM yet (everything before the first
    // message currently shown) and prepends them, instead of rebuilding and rebinding
    // the whole history for every page. Returns false when the DOM and the model do not
    // line up, so the caller can fall back to a full render.
    function prependOlder(log, messages) {
        const first = log.querySelector(':scope > .fcm-chat-message');
        const index = first ? messages.findIndex(message => String(message.id) === first.dataset.msgId) : -1;
        if (index < 0) return false;
        // Rows were merged somewhere other than the top: only a full render shows them.
        if (log.querySelectorAll(':scope > .fcm-chat-message').length !== messages.length - index) return false;
        if (index === 0) return true;   // nothing new to show
        const batch = document.createElement('div');
        batch.innerHTML = renderMessages(messages.slice(0, index));
        const lastOlder = [...batch.querySelectorAll(':scope > .fcm-chat-message')].pop();
        const leading = log.firstElementChild;
        // The new batch carries its own separator for a day it shares with the old top.
        if (leading?.classList.contains('fcm-chat-date-separator') && leading.dataset.messageDate === lastOlder?.dataset.messageDate) leading.remove();
        const added = [...batch.childNodes];
        log.prepend(...added);
        // Bind after insertion (external media plugins expect attached elements), but only on the new nodes.
        const scope = { querySelectorAll: selector => added.flatMap(node => node.nodeType === 1
            ? [...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector)] : []) };
        bindImages(scope, log);
        bindJoinButtons(scope);
        return true;
    }

    async function loadOlder(log) {
        const memberNumber = Number(getMemberNumber());
        if (!memberNumber) return;
        const oldHeight = log.scrollHeight;
        const oldTop = log.scrollTop;
        const loaded = await conversation.loadOlder(store, memberNumber, target => Number(getMemberNumber()) === target);
        if (!loaded || !log.isConnected) return;
        if (!prependOlder(log, conversation.messages)) {
            log.innerHTML = renderMessages(conversation.messages);
            bindImages(log, log);
            bindJoinButtons(log);
        }
        syncSelection();
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

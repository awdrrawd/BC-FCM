function createChatMessageSelectionController({ getPanel, getMessages, canForwardToRoom, renderUi, selectMessages, selectedCountText, onExit }) {
    const ids = new Set();
    let active = false;

    function isActive() {
        return active;
    }

    function size() {
        return ids.size;
    }

    function records() {
        return selectMessages(getMessages(), ids);
    }

    function updateUi() {
        renderUi(getPanel(), {
            active,
            selectedIds: ids,
            canForwardToRoom: canForwardToRoom(),
            selectedCountText,
        });
    }

    function reset() {
        active = false;
        ids.clear();
    }

    function enter(messageElement) {
        active = true;
        if (messageElement?.dataset.msgId) ids.add(String(messageElement.dataset.msgId));
        getPanel()?.querySelectorAll('.fcm-chat-message.selected').forEach(message => message.classList.remove('selected'));
        updateUi();
    }

    function exit() {
        onExit();
        reset();
        updateUi();
    }

    return { enter, exit, ids, isActive, records, reset, size, updateUi };
}

export { createChatMessageSelectionController };

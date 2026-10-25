import { selectedMessages } from '../data/chat-selection.js';

function createChatMessageSelectionController({ getPanel, getMessages, canForwardToRoom, renderUi, selectedCountText, onExit }) {
    const ids = new Set();
    let active = false;
    let mode = 'export';

    function isActive() {
        return active;
    }

    function size() {
        return ids.size;
    }

    function records() {
        return selectedMessages(getMessages(), ids);
    }

    function updateUi() {
        renderUi(getPanel(), {
            active,
            mode,
            selectedIds: ids,
            canForwardToRoom: canForwardToRoom(),
            selectedCountText,
        });
    }

    function reset() {
        active = false;
        mode = 'export';
        ids.clear();
    }

    function getMode() {
        return mode;
    }

    function enter(messageElement, nextMode = 'export') {
        active = true;
        mode = nextMode === 'delete' ? 'delete' : 'export';
        if (messageElement?.dataset.msgId) ids.add(String(messageElement.dataset.msgId));
        getPanel()?.querySelectorAll('.fcm-chat-message.selected').forEach(message => message.classList.remove('selected'));
        updateUi();
    }

    function exit() {
        onExit();
        reset();
        updateUi();
    }

    return { enter, exit, getMode, ids, isActive, records, reset, size, updateUi };
}

export { createChatMessageSelectionController };

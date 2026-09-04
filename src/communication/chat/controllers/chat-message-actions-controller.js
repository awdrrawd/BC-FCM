import { installMessageActions } from '../events/chat-message-actions.js';

function createChatMessageActionsController({ getRoot, messageSelection, openProfile, replyToMessage, isMobile }) {
    let cleanup = null;

    function bind() {
        const root = getRoot();
        cleanup?.();
        cleanup = installMessageActions({
            root,
            log: root?.querySelector('.fcm-chat-messages'),
            menu: root?.querySelector('.fcm-chat-context-menu'),
            isMultiSelectActive: messageSelection.isActive,
            selectedIds: messageSelection.ids,
            updateMultiSelectUi: messageSelection.updateUi,
            openProfile,
            replyToMessage,
            enterMultiSelect: messageSelection.enter,
            isMobile,
        });
    }

    function destroy() {
        cleanup?.();
        cleanup = null;
    }

    return { bind, destroy };
}

export { createChatMessageActionsController };

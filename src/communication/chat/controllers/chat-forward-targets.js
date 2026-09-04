import { buildForwardTargetGroups } from '../data/chat-selection.js';
import { bindForwardTargetEvents, forwardTargetsHtml } from '../views/chat-selection-view.js';
import { esc } from '../services/chat-content.js';

function createChatForwardTargetsController({ getRoot, getRoomCharacters, getFriendRows, getSelfMemberNumber, getConversationMemberNumber, isFriend, isOnline, avatarHtml, displayName, text, hasSelection, isStackedDetail, refreshChatList, hydrateAvatars, onSelect }) {
    let active = false;
    let activeTab = 'room';

    function isActive() {
        return active;
    }

    function html() {
        const groups = buildForwardTargetGroups({
            roomCharacters: getRoomCharacters(), friendRows: getFriendRows(),
            selfMemberNumber: getSelfMemberNumber(), conversationMemberNumber: getConversationMemberNumber(),
            isFriend, isOnline,
        });
        return forwardTargetsHtml({ groups, activeTab, avatarHtml, displayName, esc, text });
    }

    function bind() {
        bindForwardTargetEvents(getRoot(), {
            onCancel: close,
            onSelect,
            onTab: tab => {
                activeTab = tab;
                refresh();
            },
        });
    }

    function refresh() {
        const list = getRoot()?.querySelector('.fcm-chat-list');
        if (!list || !active) return;
        list.innerHTML = html();
        hydrateAvatars();
        bind();
    }

    function show() {
        const root = getRoot();
        const list = root?.querySelector('.fcm-chat-list');
        if (!hasSelection() || !list || active) return;
        active = true;
        activeTab = 'room';
        refresh();
        root.querySelector('.fcm-chat-body')?.classList.add('forward-target-mode');
        list.classList.remove('slide-out');
        root.querySelector('.fcm-chat-main')?.classList.remove('slide-in');
    }

    function close() {
        if (!active) return;
        const root = getRoot();
        const list = root?.querySelector('.fcm-chat-list');
        active = false;
        root?.querySelector('.fcm-chat-body')?.classList.remove('forward-target-mode');
        if (!list) return;
        refreshChatList();
        if (isStackedDetail()) {
            list.classList.add('slide-out');
            root?.querySelector('.fcm-chat-main')?.classList.add('slide-in');
        }
    }

    function reset() {
        active = false;
        activeTab = 'room';
    }

    return { bind, close, html, isActive, reset, show };
}

export { createChatForwardTargetsController };

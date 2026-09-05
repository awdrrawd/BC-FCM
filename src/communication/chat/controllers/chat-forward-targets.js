import { buildForwardTargetGroups } from '../data/chat-selection.js';
import { bindForwardTargetEvents, forwardTargetRowsHtml, forwardTargetsHtml } from '../views/chat-selection-view.js';
import { bindSearch } from '../views/chat-search-view.js';
import { esc } from '../services/chat-content.js';

function createChatForwardTargetsController({ getRoot, getRoomCharacters, getFriendRows, getSelfMemberNumber, getConversationMemberNumber, isFriend, isOnline, avatarHtml, displayName, text, hasSelection, isStackedDetail, refreshChatList, hydrateAvatars, onSelect }) {
    let active = false;
    let activeTab = 'room';
    let search = '';

    function isActive() {
        return active;
    }

    function model() {
        const groups = buildForwardTargetGroups({
            roomCharacters: getRoomCharacters(), friendRows: getFriendRows(),
            selfMemberNumber: getSelfMemberNumber(), conversationMemberNumber: getConversationMemberNumber(),
            isFriend, isOnline,
        });
        return { groups, activeTab, search, avatarHtml, displayName, esc, text };
    }

    function html() {
        return forwardTargetsHtml(model());
    }

    function bind() {
        bindSearch(getRoot()?.querySelector('.fcm-chat-list'), value => {
            search = value;
            const scroll = getRoot()?.querySelector('.fcm-chat-forward-targets');
            if (!scroll || !active) return;
            scroll.innerHTML = forwardTargetRowsHtml(model());
            scroll.scrollTop = 0;
            bindForwardTargetEvents(scroll, { onSelect });
            hydrateAvatars();
        });
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
        search = '';
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
        search = '';
    }

    return { bind, close, html, isActive, reset, show };
}

export { createChatForwardTargetsController };

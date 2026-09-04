import { conversationRows, historyMessageRows, recentConversationRows, unreadMessageCount } from '../data/chat-conversation-data.js';
import { buildGroupDefinitions, filterContactRows, filterGroupRows, filterNotificationRows, selectedGroupDefinition } from '../data/chat-list-data.js';
import { chatListHtml, contactRowsHtml, groupsHtml, notificationsHtml } from './chat-list-view.js';
import { esc } from '../services/chat-content.js';

function createChatListPresenter({ getMessages, getFriendRows, getPlayerMemberNumber, getSelectedMember, getJustOpenedMember, getRoomCharacters, getConfig, getState, avatarHtml, displayName, biography, cleanMessage, isOnline, isFavorite, getRelations, text, htmlText }) {
    function conversations() {
        return conversationRows(getMessages(), getFriendRows(), getPlayerMemberNumber());
    }

    function unreadCount(memberNumber = null) {
        return unreadMessageCount(getMessages(), memberNumber);
    }

    function contactRows(rows, { history = false } = {}) {
        return contactRowsHtml(rows, {
            history, selectedMember: getSelectedMember(), justOpenedMember: getJustOpenedMember(), avatarHtml,
            displayName, biography, cleanMessage, esc, text,
        });
    }

    function filteredContacts(state) {
        return filterContactRows(conversations(), { presence: state.presenceFilter, relation: state.relationFilter, search: state.search }, {
            isOnline, isFavorite, getRelations, displayName, biography,
        });
    }

    function notificationRows(state) {
        const rows = state.notificationTab === 'recent'
            ? recentConversationRows(conversations())
            : historyMessageRows(getMessages(), getPlayerMemberNumber());
        return filterNotificationRows(rows, state.notificationSearch, { displayName, biography, cleanMessage });
    }

    function groupData(state) {
        const config = getConfig();
        const definitions = buildGroupDefinitions({
            roomCharacters: getRoomCharacters(), selfMemberNumber: getPlayerMemberNumber(), friendRows: getFriendRows(),
            isFavorite, groups: config.chatGroups, memberGroups: config.chatMemberGroups, text,
        });
        const group = selectedGroupDefinition(definitions, state.groupMode, state.selectedGroup);
        return { definitions, group, rows: filterGroupRows(group, state.groupSearch, displayName, biography) };
    }

    function viewHtml(view = getState().activeView) {
        const state = getState();
        if (view === 'notifications') {
            return notificationsHtml({ rowsHtml: contactRows(notificationRows(state), { history: true }), notificationTab: state.notificationTab, notificationSearch: state.notificationSearch, esc, text: htmlText });
        }
        if (view === 'groups') {
            const { definitions, group, rows } = groupData(state);
            return groupsHtml({ definitions, group, rowsHtml: contactRows(rows), groupMode: state.groupMode, groupSearch: state.groupSearch, esc, text: htmlText });
        }
        if (view === 'chat') {
            return chatListHtml({ rowsHtml: contactRows(filteredContacts(state)), search: state.search, presenceFilter: state.presenceFilter, relationFilter: state.relationFilter, esc, text: htmlText });
        }
        return null;
    }

    function visibleScrollHtml() {
        const state = getState();
        if (state.activeView === 'notifications') return contactRows(notificationRows(state), { history: true }) || `<div class="fcm-chat-empty">${htmlText('chatNoRecord')}</div>`;
        if (state.activeView === 'chat') return contactRows(filteredContacts(state)) || `<div class="fcm-chat-empty">${htmlText('chatEmptyCategory')}</div>`;
        if (state.activeView === 'groups') return contactRows(groupData(state).rows) || `<div class="fcm-chat-empty">${htmlText('chatGroupEmpty')}</div>`;
        return null;
    }

    return { unreadCount, viewHtml, visibleScrollHtml };
}

export { createChatListPresenter };

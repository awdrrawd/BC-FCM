import { searchHtml } from './chat-search-view.js';

function contactRowsHtml(rows, { history = false, selectedMember, justOpenedMember, avatarHtml, displayName, biography, cleanMessage, esc, text }) {
    return rows.map(row => {
        const memberNumber = Number(row.memberNumber);
        const direction = row.direction === 'out' ? text('chatSent') : text('chatReceived');
        const subtitle = history ? `${direction}: ${cleanMessage(row.content)}` : biography(memberNumber);
        return `<button class="fcm-chat-row ${selectedMember === memberNumber ? 'selected' : ''} ${justOpenedMember === memberNumber ? 'just-opened' : ''}" data-member="${memberNumber}">
            ${avatarHtml(memberNumber)}
            <span class="fcm-chat-row-meta"><b>${esc(displayName(memberNumber))}</b><small>${esc(subtitle)}</small></span>
            ${history || row.timestamp ? `<time>${row.timestamp ? new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</time>` : ''}
            ${row.unread ? `<em>${row.unread}</em>` : ''}
        </button>`;
    }).join('');
}

function notificationsHtml({ rowsHtml, notificationTab, notificationSearch, esc, text }) {
    return `${searchHtml(notificationSearch, esc, text)}
        <div class="fcm-chat-subtabs"><button class="${notificationTab === 'recent' ? 'active' : ''}" data-notification-tab="recent">${text('chatRecent')}</button><button class="${notificationTab === 'history' ? 'active' : ''}" data-notification-tab="history">${text('chatHistory')}</button></div>
        <div class="fcm-chat-scroll">${rowsHtml || `<div class="fcm-chat-empty">${text('chatNoRecord')}</div>`}</div>`;
}

function groupsHtml({ definitions, group, rowsHtml, groupMode, groupSearch, esc, text }) {
    return `${searchHtml(groupSearch, esc, text)}
        <div class="fcm-chat-subtabs"><button class="${groupMode === 'room' ? 'active' : ''}" data-group-mode="room">${text('chatRoom')}</button><button class="${groupMode === 'groups' ? 'active' : ''}" data-group-mode="groups">${text('chatGroupsTab')}</button></div>
        ${groupMode === 'groups' ? `<div class="fcm-chat-group-tabs"><button class="fcm-chat-group-add" data-add-group>＋</button>${definitions.groups.map(item => `<button class="${item.id === group.id ? 'active' : ''}" data-group="${item.id}">${esc(item.label)}</button>`).join('')}</div>` : ''}
        <div class="fcm-chat-scroll">${rowsHtml || `<div class="fcm-chat-empty">${text('chatGroupEmpty')}</div>`}</div>`;
}

function chatListHtml({ rowsHtml, search, presenceFilter, relationFilter, esc, text }) {
    return `${searchHtml(search, esc, text)}
        <div class="fcm-chat-subtabs"><button class="${presenceFilter === 'online' ? 'active' : ''}" data-presence="online">${text('chatPresenceOnline')}</button><button class="${presenceFilter === 'offline' ? 'active' : ''}" data-presence="offline">${text('chatPresenceOffline')}</button></div>
        <div class="fcm-chat-tags"><button class="${relationFilter === 'owner' ? 'active' : ''}" data-rel="owner">${text('chatRelOwnerLover')}</button><button class="${relationFilter === 'sub' ? 'active' : ''}" data-rel="sub">${text('chatRelSub')}</button><button class="${relationFilter === 'follow' ? 'active' : ''}" data-rel="follow">${text('chatRelFollow')}</button></div>
        <div class="fcm-chat-scroll">${rowsHtml || `<div class="fcm-chat-empty">${text('chatEmptyCategory')}</div>`}</div>`;
}

export { chatListHtml, contactRowsHtml, groupsHtml, notificationsHtml };

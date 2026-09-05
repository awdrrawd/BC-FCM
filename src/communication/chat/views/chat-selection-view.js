import { searchHtml } from './chat-search-view.js';

function forwardTargetRowsHtml({ groups, activeTab, search = '', avatarHtml, displayName, esc, text }) {
    const rows = groups[activeTab] || groups.room || [];
    const query = search.trim().toLocaleLowerCase();
    const targetRows = rows.filter(memberNumber => `${displayName(memberNumber)} ${memberNumber}`.toLocaleLowerCase().includes(query)).map(memberNumber => `<button class="fcm-chat-row fcm-chat-forward-target" data-forward-member="${memberNumber}">
        ${avatarHtml(memberNumber)}
        <span class="fcm-chat-row-meta"><b>${esc(displayName(memberNumber))} (${memberNumber})</b></span>
    </button>`).join('');
    return targetRows || `<div class="fcm-chat-empty">${text('chatNoRecord')}</div>`;
}

function forwardTargetsHtml(model) {
    const { activeTab, search = '', esc, text } = model;
    return `<div class="fcm-chat-forward-header"><b>${text('chatForwardContact')}</b><button data-forward-cancel>${text('chatCancel')}</button></div>
        ${searchHtml(search, esc, text)}
        <div class="fcm-chat-subtabs fcm-chat-forward-tabs"><button class="${activeTab === 'room' ? 'active' : ''}" data-forward-tab="room">${text('chatRoom')}</button><button class="${activeTab === 'friends' ? 'active' : ''}" data-forward-tab="friends">${text('chatFriends')}</button><button class="${activeTab === 'offline' ? 'active' : ''}" data-forward-tab="offline">${text('chatPresenceOffline')}</button></div>
        <div class="fcm-chat-scroll fcm-chat-forward-targets">${forwardTargetRowsHtml(model)}</div>`;
}

function bindForwardTargetEvents(scope, { onCancel, onSelect, onTab }) {
    scope?.querySelector('[data-forward-cancel]')?.addEventListener('click', onCancel);
    scope?.querySelectorAll('[data-forward-member]').forEach(button => button.addEventListener('click', () => onSelect(button.dataset.forwardMember)));
    scope?.querySelectorAll('[data-forward-tab]').forEach(button => button.addEventListener('click', () => onTab(button.dataset.forwardTab)));
}

function updateMultiSelectUi(panel, { active, selectedIds, canForwardToRoom, selectedCountText }) {
    panel?.querySelector('.fcm-chat-messages')?.classList.toggle('multi-selecting', active);
    panel?.querySelectorAll('.fcm-chat-message').forEach(message => message.classList.toggle('multi-selected', selectedIds.has(String(message.dataset.msgId))));
    const actions = panel?.querySelector('.fcm-chat-actions');
    const compose = panel?.querySelector('.fcm-chat-compose');
    const multi = panel?.querySelector('[data-multi-actions]');
    if (actions) actions.hidden = active;
    if (compose) compose.hidden = active;
    if (multi) multi.hidden = !active;
    const count = multi?.querySelector('[data-multi-count]');
    if (count) count.textContent = selectedCountText(selectedIds.size);
    multi?.querySelectorAll('button:not([data-multi-cancel])').forEach(button => {
        button.disabled = !selectedIds.size || (button.hasAttribute('data-multi-forward-room') && !canForwardToRoom);
    });
}

export { bindForwardTargetEvents, forwardTargetRowsHtml, forwardTargetsHtml, updateMultiSelectUi };

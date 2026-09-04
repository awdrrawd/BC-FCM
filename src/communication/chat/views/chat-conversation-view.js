import { T, TH } from '../../../i18n/i18n.js';
import { ADD_FRIEND_ICON, DOWNLOAD_ICON, FOLDER_ICON, GROUP_ICON, INVITE_ICON, SEARCH_ICON, SUMMON_ICON, TRASH_ICON, EXIT_ICON } from '../../../ui/icons.js';
import { esc } from '../services/chat-content.js';

function contactCardHtml({ memberNumber, avatarHtml, displayName, biography, hasProfile, isFriend }) {
    return `<section class="fcm-chat-contact-card">${avatarHtml(memberNumber, 100, 'card')}<div><b>${esc(displayName)} (${memberNumber})</b><small>${esc(biography || T('chatNoBiography'))}</small><span class="fcm-chat-card-actions"><button data-card-refresh>${TH('chatProfileSnapshot')}</button>${hasProfile ? `<button class="fcm-chat-card-search" data-card-profile title="${TH('btnViewProfile')}">${SEARCH_ICON}</button>` : ''}${isFriend ? '' : `<button data-card-add-friend title="${TH('addFriend')}">${ADD_FRIEND_ICON}${TH('addFriend')}</button>`}</span></div></section>`;
}

function conversationHtml(model) {
    if (!model.memberNumber) return `<div class="fcm-chat-empty">${TH('chatSelectPlayer')}</div>`;
    const roomLink = model.canOpenRoom ? `data-room-name="${esc(model.roomName)}" role="button" tabindex="0"` : '';
    return `<header class="fcm-chat-conversation-header">
        ${model.stacked ? `<button class="fcm-chat-back fcm-chat-icon-action" data-back title="${TH('chatBack')}">${EXIT_ICON}</button>` : ''}
        ${model.avatarHtml(model.memberNumber, 38, 'conversation')}
        <span class="fcm-chat-conversation-meta"><span class="fcm-chat-name-line"><b>${esc(model.displayName)} (${model.memberNumber})${model.showNotFriendBadge ? `<i class="fcm-chat-not-friend">${TH('chatNotFriend')}</i>` : ''}</b><small data-room-meta="${model.memberNumber}" title="${esc(model.roomText)}" ${roomLink}>${esc(model.roomText)}</small></span><small class="fcm-chat-bio"><i>${esc(model.biography || '-')}</i></small></span>
        <button class="fcm-chat-header-action fcm-chat-icon-action" data-summon ${model.canSummon ? '' : 'disabled'} title="${TH('beepSummon')}">${SUMMON_ICON}</button>
        <div class="fcm-chat-assign"><button class="fcm-chat-rail-button" data-toggle-assign title="${TH('chatAssignGroup')}">${GROUP_ICON}</button><div class="fcm-chat-assign-menu" data-assign-menu>${model.groups.map(([id, label]) => `<button data-assign-group="${esc(id)}">${esc(label)}</button>`).join('')}<button class="create" data-create-group-from-chat>＋ ${TH('chatNewGroup')}</button></div></div>
    </header>
    ${model.contactCardHtml || ''}
    <div class="fcm-chat-messages">${model.messagesHtml || `<div class="fcm-chat-empty">${TH('chatNoMessages')}</div>`}</div>
    <div class="fcm-chat-history-date" data-history-date hidden></div>
    <button class="fcm-chat-new-messages" data-new-messages ${model.unread ? '' : 'hidden'}>${TH('chatNewUnread', model.unread)}</button>
    <div class="fcm-chat-actions" ${model.multiSelect ? 'hidden' : ''}><button class="fcm-chat-icon-action" data-invite ${model.canInvite ? '' : 'disabled'} title="${TH('chatInviteRoom')}" aria-label="${TH('chatInviteRoom')}">${INVITE_ICON}</button><span></span><div class="fcm-chat-tools"><div class="fcm-chat-tools-menu"><button class="fcm-chat-icon-action" data-export="html" title="${TH('chatExportHtml')}">${DOWNLOAD_ICON}<span>${TH('chatExportHtml')}</span></button><button class="fcm-chat-icon-action" data-export="json" title="${TH('chatExportJson')}">${DOWNLOAD_ICON}<span>${TH('chatExportJson')}</span></button><button class="fcm-chat-icon-action" data-delete title="${TH('chatDeleteAll')}">${TRASH_ICON}<span>${TH('chatDeleteAll')}</span></button></div><button class="fcm-chat-icon-action" data-toggle-tools title="${TH('chatMessageTools')}">${FOLDER_ICON}</button></div></div>
    <div class="fcm-chat-compose" ${model.multiSelect ? 'hidden' : ''}>
        <div class="fcm-chat-compose-notice" data-bcx-compose-notice hidden></div>
        <div class="fcm-chat-channels ${model.online ? '' : 'offline'}"><button class="${model.available === 'whisper' ? 'active' : ''}" data-channel="whisper" ${model.available !== 'whisper' ? 'disabled' : ''}>${TH('btnWhisper')}</button><button class="${model.available === 'beep' ? 'active' : ''}" data-channel="beep" ${model.available !== 'beep' ? 'disabled' : ''}>${TH('btnBeep')}</button></div>
        <div class="fcm-chat-input-wrap">${model.replyTarget ? `<div class="fcm-chat-reply-indicator"><span>${TH('chatReply')}: ${esc(model.replyTarget.preview)}</span><button data-cancel-reply title="${TH('chatCancel')}">×</button></div>` : ''}<div class="fcm-chat-profile-suggest" data-profile-suggest hidden></div><textarea data-input rows="2" placeholder="${esc(model.inputPlaceholder)}"></textarea></div>
        <button data-send ${model.unavailable ? 'disabled' : ''}>${model.online ? TH('chatSend') : TH('chatQueueSend')}</button>
    </div>
    <div class="fcm-chat-multi-actions" data-multi-actions ${model.multiSelect ? '' : 'hidden'}><b data-multi-count>${TH('chatSelectedCount', model.selectedCount)}</b><div><button data-multi-forward-contact>${TH('chatForwardContact')}</button><button data-multi-forward-room ${model.canForwardToRoom ? '' : 'disabled'}>${TH('chatForwardRoom')}</button><button data-multi-export="json">${TH('chatExportJson')}</button><button data-multi-export="html">${TH('chatExportHtml')}</button><button data-multi-cancel>${TH('chatCancel')}</button></div></div>`;
}

export { contactCardHtml, conversationHtml };

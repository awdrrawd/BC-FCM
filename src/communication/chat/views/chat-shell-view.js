import { esc } from '../services/chat-content.js';
import { profileHtml } from './chat-profile-view.js';
import { settingsHtml } from './chat-settings-view.js';
import { CHAT_ICON, NOTIFICATION_ICON, GROUP_ICON, LAYOUT_ICON, SETTINGS_ICON, MAXIMIZE_ICON, EDIT_ICON } from '../../../ui/icons.js';

function createChatSidebarView({ getActiveView, getPlayer, getConfig, text, htmlText, avatarHtml, forwardTargets, listPresenter }) {
    function html() {
        const activeView = getActiveView();
        if (forwardTargets.isActive()) return forwardTargets.html();
        if (activeView === 'profile') return profileHtml({ Player: getPlayer(), cfg: getConfig(), T: text, TH: htmlText, esc, avatarHtml, editIcon: EDIT_ICON });
        if (activeView === 'settings') return settingsHtml();
        return listPresenter.viewHtml() || '';
    }

    return { html };
}

function chatShellHtml(model) {
    const stacked = model.layout === 'stacked';
    const detailVisible = model.stackedDetail && !model.forwardTargetMode;
    return `<div id="fcm-chat-panel" class="${model.maximized ? 'maximized' : ''}" data-layout-mode="${esc(model.layout || 'split')}" data-theme="${esc(model.theme)}" style="${model.sizeStyle}--s:${esc(model.panelColor)};--tx:${esc(model.textColor)};--ac:${esc(model.accentColor)};--chat-font-size:${Number(model.fontSize) || 13}px;--chat-font-family:${esc(model.fontFamily)}">
        <div class="fcm-chat-titlebar"><b>FCM-Chat</b><span></span><button class="fcm-chat-icon-action ${stacked ? 'active' : ''}" data-layout title="${model.text('chatToggleLayout')}">${LAYOUT_ICON}<i>${stacked ? model.text('chatLayoutSplit') : model.text('chatLayoutMerged')}</i></button><button class="fcm-chat-icon-action ${model.maximized ? 'active' : ''}" data-max title="${model.text('chatToggleMax')}">${MAXIMIZE_ICON}<i>${model.maximized ? model.text('chatRestore') : model.text('chatMaximize')}</i></button><button class="fcm-chat-icon-action" data-min title="${model.text('chatMinimize')}">—</button><button class="fcm-chat-icon-action" data-close title="${model.text('chatClose')}">×</button></div>
        <div class="fcm-chat-body view-${esc(model.activeView)} ${stacked ? 'stacked' : ''} ${model.activeView === 'profile' || model.activeView === 'settings' ? 'wide-view' : ''} ${model.forwardTargetMode ? 'forward-target-mode' : ''}">
            <nav class="fcm-chat-rail">
                <button class="fcm-chat-rail-button fcm-chat-self ${model.activeView === 'profile' ? 'active' : ''}" data-view="profile" title="${model.text('chatProfileTab')}">${model.selfAvatarHtml}</button>
                <button class="fcm-chat-rail-button ${model.activeView === 'notifications' ? 'active' : ''}" data-view="notifications" title="${model.text('chatNotificationsTab')}">${NOTIFICATION_ICON}${model.unreadBadgeHtml}</button>
                <button class="fcm-chat-rail-button ${model.activeView === 'chat' ? 'active' : ''}" data-view="chat" title="${model.text('chatChatTab')}">${CHAT_ICON}</button>
                <button class="fcm-chat-rail-button ${model.activeView === 'groups' ? 'active' : ''}" data-view="groups" title="${model.text('chatGroupsTab')}">${GROUP_ICON}</button>
                <span></span>
                <button class="fcm-chat-rail-button" data-status title="${model.text('chatStatusTab')}"><i class="fcm-status-dot ${esc(model.status || 'online')}"></i></button>
                <button class="fcm-chat-rail-button ${model.activeView === 'settings' ? 'active' : ''}" data-view="settings" title="${model.text('chatSettingsTab')}">${SETTINGS_ICON}</button>
            </nav>
            <aside class="fcm-chat-list ${detailVisible ? 'slide-out' : ''}">${model.listHtml}</aside>
            <main class="fcm-chat-main ${detailVisible ? 'slide-in' : ''}">${model.conversationHtml}</main>
        </div>
        <div class="fcm-chat-status-menu"><button data-status-value="online"><i class="online"></i>${model.text('chatStatusOnline')}</button><button data-status-value="busy"><i class="busy"></i>${model.text('chatStatusBusy')}</button><button data-status-value="afk"><i class="afk"></i>${model.text('chatStatusAFK')}</button></div>
        <div class="fcm-chat-context-menu" hidden><button data-context-select>${model.text('chatSelectMessage')}</button><button data-context-copy>${model.text('chatCopy')}</button><button data-context-multi>${model.text('chatMultiSelect')}</button><button data-context-reply>${model.text('chatReply')}</button><button data-context-cancel>${model.text('chatCancel')}</button></div>
    </div>`;
}

export { chatShellHtml, createChatSidebarView };

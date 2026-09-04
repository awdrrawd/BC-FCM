import { positionPanel } from './chat-panel-layout.js';

function createChatRenderer({ getRoot, getActiveView, getMaximized, getStackedDetail, getConfig, getPlayer, colors, fontFamily, panelSession, profileSuggestion, historyViewport, forwardTargets, avatarHtml, unreadBadgeHtml, listHtml, conversationHtml, shellHtml, bindShellEvents, bindConversationEvents, installDragScroll, conversationPresence, hydrateAvatars, messageImages, conversation, syncBalloonVisibility, text }) {
    function updateBiographyMarquee(scope) {
        requestAnimationFrame(() => {
            const biography = scope.querySelector('.fcm-chat-bio');
            if (biography) biography.classList.toggle('marquee', biography.scrollWidth > biography.clientWidth);
        });
    }

    function render() {
        const root = getRoot();
        if (!root) return;
        profileSuggestion.reset();
        historyViewport.reset();
        const config = getConfig();
        const activeView = getActiveView();
        const settingsScrollTop = activeView === 'settings' ? root.querySelector('.fcm-chat-list')?.scrollTop : null;
        const [panelColor, textColor, accentColor] = colors();
        root.innerHTML = shellHtml({
            maximized: getMaximized(), layout: config.chatLayout,
            theme: config.chatThemeMode === 'preset' ? config.chatThemePreset : config.chatThemeMode === 'custom' ? 'custom' : config.themePreset || 'violet',
            sizeStyle: panelSession.inlineSizeStyle(), panelColor, textColor, accentColor,
            fontSize: config.chatFontSize, fontFamily: fontFamily(), activeView, stackedDetail: getStackedDetail(),
            forwardTargetMode: forwardTargets.isActive(), selfAvatarHtml: avatarHtml(getPlayer()?.MemberNumber || 0, 34, 'toolbar'),
            unreadBadgeHtml: unreadBadgeHtml(), status: config.chatStatus, listHtml: listHtml(),
            conversationHtml: conversationHtml(), text,
        });
        positionPanel(root.querySelector('#fcm-chat-panel'), getMaximized(), config.chatPanelPosition);
        syncBalloonVisibility();
        bindShellEvents();
        installDragScroll(root, '.fcm-chat-scroll,.fcm-chat-messages,.fcm-chat-profile,.fcm-chat-body.view-settings .fcm-chat-list');
        conversationPresence.refreshRoomMeta();
        hydrateAvatars();
        const log = root.querySelector('.fcm-chat-messages');
        if (log) {
            messageImages.bind(log, log);
            conversation.viewport.follow();
            conversation.viewport.scrollToLatest(log);
        }
        if (settingsScrollTop !== null && settingsScrollTop !== undefined) {
            const settingsList = root.querySelector('.fcm-chat-list');
            if (settingsList) settingsList.scrollTop = settingsScrollTop;
        }
        updateBiographyMarquee(root);
    }

    function refreshConversation({ scrollToLatest = true } = {}) {
        const main = getRoot()?.querySelector('.fcm-chat-main');
        if (!main) return;
        profileSuggestion.reset();
        historyViewport.reset();
        main.innerHTML = conversationHtml();
        bindConversationEvents();
        installDragScroll(main, '.fcm-chat-messages');
        conversationPresence.refreshRoomMeta();
        hydrateAvatars();
        const log = main.querySelector('.fcm-chat-messages');
        if (log) {
            messageImages.bind(log, log);
            if (scrollToLatest) {
                conversation.viewport.follow();
                conversation.viewport.scrollToLatest(log);
            }
        }
        updateBiographyMarquee(main);
    }

    return { refreshConversation, render };
}

export { createChatRenderer };

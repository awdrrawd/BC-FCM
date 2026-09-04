import { animateLayoutChange, animatePanelSize, syncConversationBackButton } from './chat-panel-layout.js';
import { installChatDrag } from './chat-drag.js';
import { EXIT_ICON, LAYOUT_ICON } from '../../../ui/icons.js';

function createChatPanelControls({ getRoot, config, saveConfig, panelSession, getMaximized, setMaximized, setStackedDetail, getSelectedMember, closeChat, minimizeChat, syncBalloonVisibility, text, htmlText }) {
    function closeStackedDetail() {
        setStackedDetail(false);
        getRoot()?.querySelector('.fcm-chat-list')?.classList.remove('slide-out');
        getRoot()?.querySelector('.fcm-chat-main')?.classList.remove('slide-in');
    }

    function bind(panel) {
        panelSession.observe(panel, getMaximized);
        installChatDrag(panel, panel.querySelector('.fcm-chat-titlebar'), { configKey: 'chatPanelPosition', isMaximized: getMaximized });
        getRoot()?.querySelector('[data-close]')?.addEventListener('click', closeChat);
        getRoot()?.querySelector('[data-min]')?.addEventListener('click', minimizeChat);
        getRoot()?.querySelector('[data-max]')?.addEventListener('click', event => {
            event.stopPropagation();
            const before = panel.getBoundingClientRect();
            panel.classList.add('fcm-size-animating');
            const maximized = !getMaximized();
            setMaximized(maximized);
            panel.classList.toggle('maximized', maximized);
            event.currentTarget.classList.toggle('active', maximized);
            const label = event.currentTarget.querySelector('i');
            if (label) label.textContent = maximized ? text('chatRestore') : text('chatMaximize');
            syncBalloonVisibility();
            animatePanelSize(panel, before);
        });
        getRoot()?.querySelector('button[data-layout]')?.addEventListener('click', event => {
            event.stopPropagation();
            const body = panel.querySelector('.fcm-chat-body');
            const list = body?.querySelector('.fcm-chat-list');
            const main = body?.querySelector('.fcm-chat-main');
            const beforeList = list?.getBoundingClientRect();
            const beforeMain = main?.getBoundingClientRect();
            config.chatLayout = config.chatLayout === 'stacked' ? 'split' : 'stacked';
            const stacked = config.chatLayout === 'stacked';
            const stackedDetail = stacked && !!getSelectedMember();
            setStackedDetail(stackedDetail);
            saveConfig();
            panel.dataset.layoutMode = config.chatLayout;
            event.currentTarget.classList.toggle('active', stacked);
            event.currentTarget.innerHTML = `${LAYOUT_ICON}<i>${stacked ? htmlText('chatLayoutSplit') : htmlText('chatLayoutMerged')}</i>`;
            body?.classList.toggle('stacked', stacked);
            list?.classList.toggle('slide-out', stackedDetail);
            main?.classList.toggle('slide-in', stackedDetail);
            syncConversationBackButton(main, stacked, { title: text('chatBack'), icon: EXIT_ICON, onBack: closeStackedDetail });
            if (beforeList && beforeMain) animateLayoutChange(list, main, beforeList, beforeMain, stacked, stackedDetail);
        });
    }

    return { bind, closeStackedDetail };
}

export { createChatPanelControls };

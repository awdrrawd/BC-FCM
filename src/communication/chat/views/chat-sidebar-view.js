import { profileHtml } from './chat-profile-view.js';
import { settingsHtml } from './chat-settings-view.js';
import { EDIT_ICON } from '../../../ui/icons.js';
import { esc } from '../services/chat-content.js';

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

export { createChatSidebarView };

import { T } from '../i18n/i18n.js';
import { MAXIMIZE_ICON } from '../ui/icons.js';
import { animatePanelSize } from '../communication/chat/controllers/chat-panel-layout.js';

export function syncPanelMaximize(panel) {
    const button = panel.querySelector('[data-panel-max]');
    if (!button) return;
    const maximized = panel.classList.contains('maximized');
    const label = T(maximized ? 'chatRestore' : 'chatMaximize');
    button.title = label; button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(maximized));
    button.classList.toggle('active', maximized);
}

export function createPanelMaximizeButton(panel) {
    const button = document.createElement('button'); button.type = 'button';
    button.className = 'fcm-hbtn fcm-chat-icon-action'; button.dataset.panelMax = '';
    button.innerHTML = MAXIMIZE_ICON;
    button.addEventListener('click', event => {
        event.stopPropagation();
        const before = panel.getBoundingClientRect();
        panel.classList.toggle('maximized');
        syncPanelMaximize(panel);
        animatePanelSize(panel, before);
    });
    return button;
}

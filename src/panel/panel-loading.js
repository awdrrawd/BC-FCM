import { T } from '../i18n/i18n.js';

export function showPanelLoading(host) {
    const node = document.createElement('div'); node.className = 'fcm-page-loading';
    node.setAttribute('role', 'status');
    const spinner = document.createElement('span'); spinner.className = 'fcm-graph-spinner';
    spinner.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span'); label.textContent = T('panelLoading');
    node.append(spinner, label); host.append(node);
    return () => node.remove();
}

export async function withPanelLoading(host, load) {
    const finish = showPanelLoading(host);
    try { return await load(); } finally { finish(); }
}

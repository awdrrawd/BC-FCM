import { cfg, THEME_DEFAULTS } from '../core/config.js';
import { installDragScroll } from './drag-scroll.js';

let installed = false;
let openControl = null;
const controls = new Set();

function colorsFor(select) {
    const root = select.closest('#fcm-chat-panel,#fcm-panel');
    const computed = root ? getComputedStyle(root) : null;
    return {
        accent: computed?.getPropertyValue('--ac').trim() || cfg.accentColor || THEME_DEFAULTS.accentColor,
        panel: computed?.getPropertyValue('--surface-alt').trim() || cfg.panelColor || THEME_DEFAULTS.panelColor,
        text: computed?.getPropertyValue('--tx').trim() || cfg.fontColor || THEME_DEFAULTS.fontColor,
        dim: computed?.getPropertyValue('--dim').trim() || '#9c93b8',
    };
}

function closeOpen() {
    if (!openControl) return;
    openControl.menu.remove();
    openControl.button.setAttribute('aria-expanded', 'false');
    openControl = null;
}

function optionLabel(option) {
    return option.label || option.textContent || '';
}

function isFlagSelect(select) {
    return select.matches('.fcm-lang-flag-select,.fcm-chat-language,[data-chat-language]');
}

function contentWidth(select) {
    const style = getComputedStyle(select);
    const fontSize = `${Math.max(10, (Number(cfg.chatFontSize) || 13) - 1)}px`;
    const probe = document.createElement('span');
    probe.style.cssText = 'position:fixed;left:-10000px;top:-10000px;visibility:hidden;pointer-events:none;white-space:pre;width:max-content;';
    probe.style.fontFamily = isFlagSelect(select)
        ? '"Twemoji Country Flags",-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans TC",sans-serif'
        : style.fontFamily;
    probe.style.fontSize = fontSize;
    probe.style.fontWeight = style.fontWeight;
    probe.style.fontStyle = style.fontStyle;
    probe.style.letterSpacing = style.letterSpacing;
    document.body.appendChild(probe);
    let widest = 0;
    for (const option of select.options) {
        probe.textContent = optionLabel(option).trim();
        widest = Math.max(widest, probe.getBoundingClientRect().width);
    }
    probe.remove();
    return Math.ceil(Math.min(260, Math.max(90, widest + 48)));
}

function syncButton(control) {
    const option = control.select.selectedOptions?.[0] || control.select.options[0];
    const colors = colorsFor(control.select);
    control.wrapper.style.setProperty('--ac', colors.accent);
    control.wrapper.style.setProperty('--surface-alt', colors.panel);
    control.wrapper.style.setProperty('--tx', colors.text);
    control.wrapper.style.setProperty('--dim', colors.dim);
    control.wrapper.style.fontSize = `${Math.max(10, (Number(cfg.chatFontSize) || 13) - 1)}px`;
    control.label.textContent = option ? optionLabel(option) : '';
    control.button.disabled = control.select.disabled;
}

function choose(control, option) {
    if (option.disabled) return;
    control.select.value = option.value;
    control.select.dispatchEvent(new Event('change', { bubbles: true }));
    syncButton(control);
    closeOpen();
    control.button.focus();
}

function positionMenu(control) {
    const rect = control.button.getBoundingClientRect();
    const menuWidth = Math.min(window.innerWidth - 8, Math.max(rect.width, control.contentWidth));
    const roomBelow = window.innerHeight - rect.bottom - 8;
    const maxHeight = Math.max(120, Math.min(320, Math.max(roomBelow, rect.top - 8)));
    const openAbove = roomBelow < Math.min(220, maxHeight) && rect.top > roomBelow;
    // Match AEE: the popup's right edge follows the trigger's right edge.
    control.menu.style.left = `${Math.max(4, Math.min(rect.right - menuWidth, window.innerWidth - menuWidth - 4))}px`;
    control.menu.style.width = `${menuWidth}px`;
    control.menu.style.maxHeight = `${maxHeight}px`;
    control.menu.style.top = openAbove ? 'auto' : `${rect.bottom + 3}px`;
    control.menu.style.bottom = openAbove ? `${window.innerHeight - rect.top + 3}px` : 'auto';
}

function openMenu(control) {
    if (openControl === control) { closeOpen(); return; }
    closeOpen();
    syncButton(control);
    if (control.select.disabled) return;

    const colors = colorsFor(control.select);
    const menu = document.createElement('div');
    menu.className = 'fcm-theme-select-menu';
    menu.setAttribute('role', 'listbox');
    menu.style.setProperty('--fcm-select-accent', colors.accent);
    menu.style.setProperty('--fcm-select-panel', colors.panel);
    menu.style.setProperty('--fcm-select-text', colors.text);
    menu.style.setProperty('--fcm-select-dim', colors.dim);
    const selectStyle = getComputedStyle(control.select);
    menu.style.fontFamily = selectStyle.fontFamily;
    menu.style.fontSize = `${Math.max(10, (Number(cfg.chatFontSize) || 13) - 1)}px`;
    if (control.button.classList.contains('fcm-theme-select-flags')) menu.classList.add('fcm-theme-select-flags');

    [...control.select.options].forEach(option => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'fcm-theme-select-option';
        item.textContent = optionLabel(option);
        item.disabled = option.disabled;
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', String(option.selected));
        if (option.selected) item.classList.add('selected');
        item.addEventListener('click', () => choose(control, option));
        menu.appendChild(item);
    });

    document.body.appendChild(menu);
    installDragScroll(menu, ':scope');
    control.menu = menu;
    openControl = control;
    control.button.setAttribute('aria-expanded', 'true');
    positionMenu(control);
    const focusable = () => [...menu.querySelectorAll('.fcm-theme-select-option:not(:disabled)')];
    const selected = menu.querySelector('[aria-selected="true"]:not(:disabled)') || focusable()[0];
    selected?.focus({ preventScroll: true });
    selected?.scrollIntoView({ block: 'nearest' });
    menu.addEventListener('keydown', event => {
        const options = focusable();
        if (!options.length) return;
        const current = options.indexOf(document.activeElement);
        let next = current;
        if (event.key === 'ArrowDown') next = (current + 1) % options.length;
        else if (event.key === 'ArrowUp') next = (current - 1 + options.length) % options.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = options.length - 1;
        else if (event.key === 'Escape') {
            event.preventDefault();
            closeOpen();
            control.button.focus();
            return;
        } else return;
        event.preventDefault();
        options[next].focus({ preventScroll: true });
        options[next].scrollIntoView({ block: 'nearest' });
    });
}

function enhance(select) {
    if (!(select instanceof HTMLSelectElement)
        || !select.closest('#fcm-panel,#fcm-chat-panel,#fcm-chat-root')
        || select.dataset.fcmThemeSelect === 'true'
        || select.multiple) return;
    select.dataset.fcmThemeSelect = 'true';

    const wrapper = document.createElement('span');
    wrapper.className = 'fcm-theme-select';
    const preferredWidth = contentWidth(select);
    wrapper.style.width = `${preferredWidth}px`;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'fcm-theme-select-button';
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    const label = document.createElement('span');
    const arrow = document.createElement('span');
    arrow.className = 'fcm-theme-select-arrow';
    arrow.textContent = '⌄';
    button.append(label, arrow);
    if (isFlagSelect(select)) {
        button.classList.add('fcm-theme-select-flags');
    }

    select.parentNode.insertBefore(wrapper, select);
    wrapper.append(select, button);
    select.classList.add('fcm-theme-select-native');
    const control = { select, wrapper, button, label, menu: null, contentWidth: preferredWidth };
    controls.add(control);
    syncButton(control);

    button.addEventListener('click', () => openMenu(control));
    button.addEventListener('keydown', event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            openMenu(control);
        } else if (event.key === 'Escape') closeOpen();
    });
    select.addEventListener('change', () => syncButton(control));
}

export function enhanceThemeSelects(root = document) {
    if (root instanceof HTMLSelectElement) enhance(root);
    root.querySelectorAll?.('#fcm-panel select,#fcm-chat-panel select,#fcm-chat-root select').forEach(enhance);
}

function injectStyles() {
    if (document.getElementById('fcm-theme-select-css')) return;
    const style = document.createElement('style');
    style.id = 'fcm-theme-select-css';
    style.textContent = `
.fcm-theme-select{position:relative;display:inline-flex;flex:0 0 auto!important;flex-direction:row!important;min-width:90px;max-width:100%;vertical-align:middle}
.fcm-theme-select-native{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;opacity:0!important;pointer-events:none!important}
.fcm-theme-select-button{display:flex;width:100%;min-width:0;align-items:center;justify-content:space-between;gap:8px;padding:6px 9px;background:var(--surface-alt,#111016);color:var(--tx,#eee);border:1px solid var(--ac,#7648fe);border-radius:7px;cursor:pointer;text-align:left;white-space:nowrap}
.fcm-theme-select-button:hover,.fcm-theme-select-button:focus-visible,.fcm-theme-select-button[aria-expanded="true"]{outline:0;border-color:var(--ac,#7648fe);box-shadow:0 0 0 2px color-mix(in srgb,var(--ac,#7648fe) 22%,transparent)}
.fcm-theme-select-button:disabled{opacity:.45;cursor:not-allowed}.fcm-theme-select-arrow{flex:0 0 auto;color:var(--ac,#7648fe)}
.fcm-theme-select-flags{font-family:"Twemoji Country Flags",-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans TC",sans-serif!important}
.fcm-theme-select-menu{position:fixed;z-index:1000005;display:flex;flex-direction:column;overflow:auto;padding:3px;background:var(--fcm-select-panel,#111016);color:var(--fcm-select-text,#eee);border:1px solid var(--fcm-select-accent,#7648fe);border-radius:7px;box-shadow:0 10px 30px #000b;scrollbar-color:var(--fcm-select-accent,#7648fe) rgba(0,0,0,.55);scrollbar-width:thin}
.fcm-theme-select-menu::-webkit-scrollbar{width:10px;height:10px}.fcm-theme-select-menu::-webkit-scrollbar-track{background:rgba(0,0,0,.55)}.fcm-theme-select-menu::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--fcm-select-accent,#7648fe) 65%,transparent);border:0;border-radius:4px}.fcm-theme-select-menu::-webkit-scrollbar-thumb:hover{background:var(--fcm-select-accent,#7648fe)}
.fcm-theme-select-option{display:block;width:100%;padding:6px 8px;background:transparent;color:inherit;border:1px solid transparent;border-radius:5px;text-align:left;white-space:nowrap;cursor:pointer}
.fcm-theme-select-option:hover,.fcm-theme-select-option:focus-visible{outline:0;background:color-mix(in srgb,var(--fcm-select-accent,#7648fe) 16%,transparent);border-color:color-mix(in srgb,var(--fcm-select-accent,#7648fe) 45%,transparent)}
.fcm-theme-select-option.selected{background:color-mix(in srgb,var(--fcm-select-accent,#7648fe) 28%,transparent);color:var(--fcm-select-accent,#7648fe);border-color:var(--fcm-select-accent,#7648fe)}.fcm-theme-select-option:disabled{color:var(--fcm-select-dim,#888);opacity:.5;cursor:not-allowed}
`;
    document.head.appendChild(style);
}

export function installThemeSelects() {
    if (installed) return;
    installed = true;
    injectStyles();
    enhanceThemeSelects();
    new MutationObserver(records => {
        for (const record of records) {
            for (const node of record.removedNodes) {
                if (openControl && node instanceof Element && (node === openControl.wrapper || node.contains(openControl.wrapper))) closeOpen();
            }
            for (const node of record.addedNodes) if (node instanceof Element) enhanceThemeSelects(node);
        }
        for (const control of controls) if (!control.wrapper.isConnected) controls.delete(control);
    }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener('pointerdown', event => {
        if (openControl && !openControl.menu.contains(event.target) && !openControl.button.contains(event.target)) closeOpen();
    }, true);
    window.addEventListener('resize', closeOpen);
    window.addEventListener('scroll', event => {
        if (openControl && event.target instanceof Node && openControl.menu.contains(event.target)) return;
        closeOpen();
    }, true);
    window.addEventListener('fcm-theme-change', () => {
        closeOpen();
        for (const control of controls) {
            if (control.wrapper.isConnected) syncButton(control);
            else controls.delete(control);
        }
        enhanceThemeSelects();
    });
}

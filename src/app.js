// FCM application (loaded by main.js and bundled by Vite to assets/main.js).
import { MOD_VER } from './core/version.js';
import './core/config.js';
import { openPanel, closePanel, togglePanel } from './panel/panel.js';
import { init } from './core/core-init.js';
import { openChat, closeChat } from './communication/chat.js';
import { installThemeSelects } from './ui/theme-select.js';

Object.assign(window.Liko.FCM, {
        version: MOD_VER,
        open: () => openPanel(),
        close: () => closePanel(),
        toggle: () => togglePanel(),
        openChat: memberNumber => openChat(memberNumber),
        closeChat: () => closeChat(),
});

installThemeSelects();
init();

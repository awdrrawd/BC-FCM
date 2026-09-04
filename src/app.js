// FCM application (loaded by main.js and bundled by Vite to assets/main.js).
import { MOD_VER } from './core/version.js';
import './core/config.js';
import { openPanel, closePanel, togglePanel } from './panel/panel.js';
import { init } from './core/core-init.js';
import { openChat, closeChat } from './communication/chat.js';
import { installThemeSelects } from './ui/theme-select.js';
import { createPublicApi } from './api/public-api.js';

const publicApi = createPublicApi();

Object.assign(window.Liko.FCM, {
        apiVersion: 1,
        version: MOD_VER,
        open: () => openPanel(),
        close: () => closePanel(),
        toggle: () => togglePanel(),
        openChat: memberNumber => openChat(memberNumber),
        closeChat: () => closeChat(),
        avatar: publicApi.avatar,
        profiles: publicApi.profiles,
});

installThemeSelects();
init();

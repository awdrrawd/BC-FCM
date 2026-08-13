// FCM entry (bundled by Vite to assets/main.js).
import { FCM_ALREADY_LOADED, MOD_VER } from './core/version.js';
import './core/config.js';
import { openPanel, closePanel, togglePanel } from './panel/panel.js';
import { init } from './core/core-init.js';

if (FCM_ALREADY_LOADED) {
    console.warn('[FCM] Already loaded, skipping duplicate initialization.');
} else {
    Object.assign(window.Liko.FCM, {
        version: MOD_VER,
        open: () => openPanel(),
        close: () => closePanel(),
        toggle: () => togglePanel(),
    });

    init();
}

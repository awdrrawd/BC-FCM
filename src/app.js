// ════════════════════════════════════════
//  FCM entry (bundled by vite → assets/main.js)
//  Loader (loader.user.js / loader.local.user.js) dynamically imports this file.
//  Splits the former single-file userscript (Plugins/liko-FCM.user.js) into ./{core,panel,chat,data,i18n}/*.js.
// ════════════════════════════════════════

import { MOD_VER } from './core/config.js';
import { openPanel, closePanel, togglePanel } from './panel/panel.js';
import { init } from './core/core-init.js';

// The bootstrap reserves this namespace before this module graph runs.
Object.assign(window.Liko.FCM, {
    version: MOD_VER,
    open: () => openPanel(),
    close: () => closePanel(),
    toggle: () => togglePanel(),
});

init();

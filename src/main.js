// ════════════════════════════════════════
//  FCM entry (bundled by vite → assets/main.js)
//  Loader (loader.user.js / loader.local.user.js) dynamically imports this file.
//  Splits the former single-file userscript (Plugins/liko-FCM.user.js) into ./modules/*.js.
// ════════════════════════════════════════

import { MOD_VER } from './modules/config.js';
import { openPanel, closePanel, togglePanel } from './modules/panel.js';
import { init } from './modules/core-init.js';

// 對外唯一入口：window.Liko.FCM（版本 + API；loader 先設 'loading' 佔位）
window.Liko = window.Liko ?? {};
window.Liko.FCM = {
    version: MOD_VER,
    open: () => openPanel(),
    close: () => closePanel(),
    toggle: () => togglePanel(),
};

init();

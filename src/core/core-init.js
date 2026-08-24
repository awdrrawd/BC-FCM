import { MOD_VER, cfg, loadCfg } from './config.js';
import { ensureI18n } from '../i18n/i18n.js';
import { PDB, Snapshot, detectWCESave, ensureOwnAvatarSnapshot } from '../data/profile-db.js';
import { buildPanel, registerCommand } from '../panel/panel.js';
import { _installOocProtect } from '../chat/chat-fx.js';
import { registerHooks } from './hooks.js';
import { initChat } from '../communication/chat.js';
// ════════════════════════════════════════
//  FCM module: core-init.js
//  (split from Plugins/liko-FCM.user.js)
// ════════════════════════════════════════


    let initStarted = false;
    async function init() {
        loadCfg();
        if (typeof ChatRoomCharacter === 'undefined' || typeof Player === 'undefined' || !Player?.MemberNumber) return setTimeout(init, 500);
        if (initStarted) return;
        initStarted = true;
        // Player settings become available only after login; merge them over the local fallback.
        loadCfg();

        // 載入多語字庫（與 HSC 共用 Liko-i18n 引擎），完成後再建面板／首次渲染
        await ensureI18n();

        // Apply persisted feature states at startup
        if (cfg.oocProtect) _installOocProtect();

        Promise.all([PDB.init(), Snapshot.init()]).then(async ([pdbOk]) => {
            if (!pdbOk) console.warn('🐈‍⬛ [FCM] Profile DB: no profiles store');
            const stored = JSON.parse(localStorage.getItem('LikoFCM') || '{}');
            if (stored.saveMode === undefined) {
                await detectWCESave();
            }
            if (cfg.avatars) await ensureOwnAvatarSnapshot();
        });
        buildPanel();
        await initChat();
        registerHooks();
        registerCommand();
        console.log(`🐈‍⬛ [FCM] ✅ v${MOD_VER} loaded`);
    }

export { init };

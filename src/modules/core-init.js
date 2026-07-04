import { MOD_VER, cfg, loadCfg } from './config.js';
import { ensureI18n } from './i18n.js';
import { PDB, Snapshot, detectWCESave } from './profile-db.js';
import { buildPanel, registerCommand } from './panel.js';
import { _installOocProtect } from './chat-fx.js';
import { registerHooks } from './hooks.js';
// ════════════════════════════════════════
//  FCM module: core-init.js
//  (split from Plugins/liko-FCM.user.js)
// ════════════════════════════════════════


    async function init() {
        loadCfg();
        if (typeof ChatRoomCharacter === 'undefined' || typeof Player === 'undefined') return setTimeout(init, 500);

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
        });
        buildPanel();
        registerHooks();
        registerCommand();
        console.log(`🐈‍⬛ [FCM] ✅ v${MOD_VER} loaded`);
    }

export { init };

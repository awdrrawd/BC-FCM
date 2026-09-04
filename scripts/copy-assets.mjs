// Stage self-hosted assets into public/ (which vite deploys to dist/ → Pages):
//   Translation/*.json -> public/Translation/*.json
// 共用引擎不在此部署：src/i18n/i18n-engine.js 是 liko-Plugin-Repository/Plugins/expand/BC_i18n.js
// 的 vendored 副本，隨 bundle 打包供單裝 FCM 使用；其他插件則從 plugin-repo 的 canonical @require。
import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function stageTranslations(srcDir, dstDir) {
  const from = root + srcDir;
  if (!existsSync(from)) { console.warn(`🐈‍⬛ [FCM] ⚠️ 找不到 ${srcDir}，略過`); return; }
  mkdirSync(root + dstDir, { recursive: true });
  let n = 0;
  for (const name of readdirSync(from)) {
    if (!name.endsWith('.json')) continue;
    copyFileSync(from + name, root + dstDir + name);
    n++;
  }
  console.log(`🐈‍⬛ [FCM] ${srcDir} -> ${dstDir} (${n} 檔)`);
}

mkdirSync(root + 'public', { recursive: true });
rmSync(root + 'public/Translation/', { recursive: true, force: true });
stageTranslations('Translation/', 'public/Translation/');

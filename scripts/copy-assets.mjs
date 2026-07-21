// Stage self-hosted assets into public/ (which vite deploys to dist/ → Pages):
//   Translation/*.js -> public/Translation/   (i18n 引擎 BC_i18n.js + 一國一檔字庫 <LANG>.js)
// Edit the sources in Translation/<LANG>.js（一國一檔）；build refreshes public/.
// 引擎已隨 bundle 打包（src/modules/i18n-engine.js）；BC_i18n.js 仍部署供其他插件共用。
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function copyInto(srcDir, dstDir, filter) {
  const from = root + srcDir;
  if (!existsSync(from)) { console.warn(`🐈‍⬛ [FCM] ⚠️ 找不到 ${srcDir}，略過`); return; }
  mkdirSync(root + dstDir, { recursive: true });
  let n = 0;
  for (const name of readdirSync(from)) {
    if (filter && !filter(name)) continue;
    copyFileSync(from + name, root + dstDir + name);
    n++;
  }
  console.log(`🐈‍⬛ [FCM] ${srcDir} -> ${dstDir} (${n} 檔)`);
}

mkdirSync(root + 'public', { recursive: true });
copyInto('Translation/', 'public/Translation/', n => n.endsWith('.js'));

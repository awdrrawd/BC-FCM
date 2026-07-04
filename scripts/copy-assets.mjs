// Stage self-hosted assets into public/ (which vite deploys to dist/ → Pages):
//   Translation/*.js -> public/Translation/   (i18n 引擎 Liko-i18n.js + FCM 字庫 FCM-i18n.js)
// Edit the sources in Translation/; build refreshes public/.
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

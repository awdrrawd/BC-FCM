// Stage self-hosted assets into public/ (which vite deploys to dist/ → Pages):
//   Translation/*.js -> public/Translation/   （一國一檔字庫 <LANG>.js，FCM 執行期 fetch）
// Edit the sources in Translation/<LANG>.js（一國一檔）；build refreshes public/.
// 共用引擎不在此部署：src/i18n/i18n-engine.js 是 liko-Plugin-Repository/Plugins/expand/BC_i18n.js
// 的 vendored 副本，隨 bundle 打包供單裝 FCM 使用；其他插件則從 plugin-repo 的 canonical @require。
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function copyInto(srcDir, dstDir, filter) {
  const from = root + srcDir;
  if (!existsSync(from)) { console.warn(`🐈‍⬛ [FCM] ⚠️ 找不到 ${srcDir}，略過`); return; }
  mkdirSync(root + dstDir, { recursive: true });
  let n = 0;
  for (const name of readdirSync(from)) {
    if (filter && !filter(name)) continue;
    const source = from + name;
    const destination = root + dstDir + name;
    // Windows may temporarily deny replacing a file watched by Vite or an
    // editor. Avoid touching identical staged assets altogether.
    if (!existsSync(destination) || !readFileSync(source).equals(readFileSync(destination))) copyFileSync(source, destination);
    n++;
  }
  console.log(`🐈‍⬛ [FCM] ${srcDir} -> ${dstDir} (${n} 檔)`);
}

mkdirSync(root + 'public', { recursive: true });
copyInto('Translation/', 'public/Translation/', n => n.endsWith('.js'));

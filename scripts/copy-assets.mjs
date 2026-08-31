// Stage self-hosted assets into public/ (which vite deploys to dist/ → Pages):
//   Translation/*.js -> public/Translation/*.json
// Translation sources keep their translator-friendly wrapper, but runtime assets
// are data-only JSON so remote text is never executed in the game page.
// 共用引擎不在此部署：src/i18n/i18n-engine.js 是 liko-Plugin-Repository/Plugins/expand/BC_i18n.js
// 的 vendored 副本，隨 bundle 打包供單裝 FCM 使用；其他插件則從 plugin-repo 的 canonical @require。
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';
import { runInNewContext } from 'node:vm';

const root = fileURLToPath(new URL('..', import.meta.url));

function stageTranslations(srcDir, dstDir) {
  const from = root + srcDir;
  if (!existsSync(from)) { console.warn(`🐈‍⬛ [FCM] ⚠️ 找不到 ${srcDir}，略過`); return; }
  mkdirSync(root + dstDir, { recursive: true });
  let n = 0;
  for (const name of readdirSync(from)) {
    if (!name.endsWith('.js')) continue;
    const source = from + name;
    const language = name.slice(0, -3).toUpperCase();
    const code = readFileSync(source, 'utf8');
    let table = null;
    const register = (namespace, strings) => { if (namespace === 'FCM') table = strings; };
    const sandbox = { window: { Liko: { __Sys_i18n__: { register } } }, console: { error() {}, warn() {}, log() {} } };
    runInNewContext(code, sandbox, { filename: name, timeout: 250 });
    if (!table || typeof table !== 'object') throw new Error(`Invalid translation wrapper: ${name}`);
    const flat = Object.fromEntries(Object.entries(table).map(([key, values]) => {
      const value = values?.[language];
      if (typeof value !== 'string') throw new Error(`Missing ${language} value for ${key} in ${name}`);
      return [key, value];
    }));
    const destination = root + dstDir + language + '.json';
    const output = JSON.stringify(flat);
    if (!existsSync(destination) || readFileSync(destination, 'utf8') !== output) writeFileSync(destination, output);
    const staleScript = root + dstDir + name;
    if (existsSync(staleScript)) rmSync(staleScript);
    n++;
  }
  console.log(`🐈‍⬛ [FCM] ${srcDir} -> ${dstDir} (${n} 檔)`);
}

mkdirSync(root + 'public', { recursive: true });
stageTranslations('Translation/', 'public/Translation/');

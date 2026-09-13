import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';

const errors = [], read = file => readFileSync(file, 'utf8');
function files(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]); }
// Validate documentation references without executing its embedded JavaScript.
let links = 0;
for (const file of files('docs').filter(file => file.endsWith('.md'))) {
    for (const [, target] of read(file).matchAll(/\]\(([^)]+)\)/g)) {
        if (/^(https?:|#)/.test(target)) continue;
        links++;
        if (!existsSync(resolve(dirname(file), target.split('#')[0]))) errors.push(`${file}: missing ${target}`);
    }
}
const graph = read('docs/fcm-architecture.html').split('const features=')[1]?.split('let active=')[0];
if (!graph) errors.push('architecture graph data missing');
for (const [, list] of (graph || '').matchAll(/\['[^']*','[^']*','([^']+)'\]/g)) {
    for (const target of list.split(',')) {
        links++;
        if (!existsSync(target.startsWith('../') ? target.slice(3) : `src/${target}`)) errors.push(`architecture: missing ${target}`);
    }
}
const sources = files('src').filter(file => file.endsWith('.js')).map(file => resolve(file));
const edges = new Map(sources.map(file => [file, [...read(file).matchAll(/(?:from\s*|import\s*(?:\(\s*)?)['"](\.[^'"]+)['"]/g)]
    .map(([, target]) => resolve(dirname(file), target.split('?')[0]))]));
const done = new Set(), active = new Set();
function visit(file, chain = []) {
    if (active.has(file)) { errors.push(`import cycle: ${[...chain, file].map(f => relative('.', f)).join(' -> ')}`); return; }
    if (done.has(file) || !edges.has(file)) return;
    active.add(file);
    for (const target of edges.get(file)) {
        if (!existsSync(target)) errors.push(`${relative('.', file)}: missing import ${target}`);
        visit(target, [...chain, file]);
    }
    active.delete(file); done.add(file);
}
sources.forEach(file => visit(file));

const english = JSON.parse(read('Translation/EN.json'));
// Existing fallback-only room-order strings: fail new gaps, report this known backlog.
const backlog = new Set(['roomTab_order','roomOrderMode','roomOrder_swap','roomOrder_insert','roomOrderChanged','roomOrderWaiting','roomOrderFailed']);
for (const file of files('Translation').filter(file => file.endsWith('.json'))) {
    const data = JSON.parse(read(file));
    const missing = Object.keys(english).filter(key => !(key in data));
    for (const key of missing) if (!backlog.has(key) || /\/(TW|CN)\.json$/.test(file)) errors.push(`${file}: missing translation ${key}`);
    if (missing.length) console.warn(`${file}: ${missing.length} known room-order keys use English fallback`);
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else console.log(`Project validation passed: ${links} references, ${sources.length} modules, translation gaps checked.`);

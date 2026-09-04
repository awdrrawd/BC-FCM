import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath, URL } from 'node:url';

const root = fileURLToPath(new URL('../assets/icons/', import.meta.url));
const errors = [];
const names = readdirSync(root).filter(name => name.toLowerCase().endsWith('.svg')).sort();
const forbiddenMarkup = /<(?:script|foreignObject|iframe|object|embed|image|animate|animateMotion|animateTransform|set)\b/i;
const eventHandler = /\son[a-z]+\s*=/i;
const externalReference = /(?:href|src)\s*=\s*["'](?!#)[^"']+["']/i;
const externalCssReference = /@import\b|url\(\s*["']?(?:https?:|\/\/|data:)/i;

for (const name of names) {
    const source = readFileSync(root + name, 'utf8');
    const label = `assets/icons/${name}`;
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*\.svg$/.test(name)) errors.push(`${label}: filename must use lowercase kebab-case`);
    if (statSync(root + name).size > 32 * 1024) errors.push(`${label}: file exceeds the 32 KiB icon limit`);
    if (!/^\s*<svg\b/i.test(source) || !/<\/svg>\s*$/i.test(source)) errors.push(`${label}: must contain one complete SVG root`);
    if (!/<svg\b[^>]*\bxmlns=["']http:\/\/www\.w3\.org\/2000\/svg["']/i.test(source)) errors.push(`${label}: missing SVG namespace`);
    const viewBox = source.match(/<svg\b[^>]*\bviewBox=["']([^"']+)["']/i)?.[1]?.trim().split(/[ ,]+/).map(Number);
    if (!viewBox || viewBox.length !== 4 || viewBox.some(value => !Number.isFinite(value)) || viewBox[2] <= 0 || viewBox[3] <= 0) {
        errors.push(`${label}: viewBox must contain four finite values with positive width and height`);
    }
    if (/<!DOCTYPE|<!ENTITY/i.test(source)) errors.push(`${label}: document types and entities are forbidden`);
    if (forbiddenMarkup.test(source)) errors.push(`${label}: executable, embedded, or raster content is forbidden`);
    if (eventHandler.test(source)) errors.push(`${label}: inline event handlers are forbidden`);
    if (/javascript\s*:/i.test(source) || externalReference.test(source) || externalCssReference.test(source)) errors.push(`${label}: external or JavaScript references are forbidden`);

    const ids = [...source.matchAll(/\bid=["']([^"']+)["']/gi)].map(match => match[1]);
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicateIds.length) errors.push(`${label}: duplicate IDs: ${[...new Set(duplicateIds)].join(', ')}`);
    const references = [...source.matchAll(/(?:url\(\s*#|(?:href|xlink:href)=["']#)([^)'"\s]+)/gi)].map(match => match[1]);
    const missingIds = references.filter(id => !ids.includes(id));
    if (missingIds.length) errors.push(`${label}: references missing IDs: ${[...new Set(missingIds)].join(', ')}`);
}

if (!names.length) errors.push('assets/icons: no SVG icons found');
if (errors.length) {
    console.error(`🐈‍⬛ [FCM] SVG validation failed (${errors.length})\n- ${errors.join('\n- ')}`);
    process.exitCode = 1;
} else {
    console.log(`🐈‍⬛ [FCM] SVG icons validated (${names.length} files)`);
}

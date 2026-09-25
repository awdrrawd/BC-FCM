import { mkToggle } from '../ui/toggle.js';
import { cfg, saveCfg } from '../core/config.js';
import { T } from '../i18n/i18n.js';
import { relationOptions, relationStyles } from '../data/relation-options.js';

export function renderRelationSettings() {
    const wrap = document.createElement('div');
    const options = relationOptions(cfg.relationGraph);
    const save = () => { cfg.relationGraph = relationOptions(options); saveCfg(); };
    function row(key) {
        const row = document.createElement('div'); row.className = 'fcm-set-row';
        const title = document.createElement('span'); title.className = 'fcm-set-label'; title.textContent = T(key); title.style.flex = '1';
        const actions = document.createElement('div'); actions.className = 'fcm-setting-actions'; row.append(title, actions); wrap.append(row); return actions;
    }
    for (const [role, key] of [['master', 'graphMaster'], ['sub', 'graphSub'], ['lover', 'graphLovership'], ['social', 'graphSocial']]) {
        const host = row(key), color = document.createElement('input'), select = document.createElement('select');
        color.type = 'color'; color.value = options[role].color; color.setAttribute('aria-label', `${T(key)} · ${T('graphColor')}`);
        select.className = 'fcm-sel'; select.setAttribute('aria-label', `${T(key)} · ${T('graphLine')}`);
        for (const style of relationStyles) {
            const option = document.createElement('option'); option.value = style; option.textContent = T(`graphStyle_${style}`); select.append(option);
        }
        select.value = options[role].style;
        color.onchange = () => { options[role].color = color.value; save(); };
        select.onchange = () => { options[role].style = select.value; save(); };
        host.append(color, select);
    }
    for (const [key, label, max] of [['depth', 'graphDefaultDepth', 100], ['width', 'graphLineWidth', 6]]) {
        const input = document.createElement('input'); input.type = 'number'; input.className = 'fcm-search';
        input.min = '1'; input.step = '1'; if (max) input.max = String(max);
        input.style.width = '76px'; input.value = options[key]; input.setAttribute('aria-label', T(label));
        input.onchange = () => { if (input.checkValidity() && Number.isSafeInteger(Number(input.value))) options[key] = Number(input.value); save(); input.value = cfg.relationGraph[key]; };
        row(label).append(input);
    }
    const warning = mkToggle(options.warnLarge, value => { options.warnLarge = value; save(); });
    warning.setAttribute('aria-label', T('graphWarnEnabled')); row('graphWarnEnabled').append(warning);
    const note = document.createElement('p'); note.className = 'fcm-set-note'; note.textContent = T('graphDepthHint'); wrap.append(note);
    return wrap;
}

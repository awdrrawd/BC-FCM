import { cfg, saveCfg } from '../core/config.js';
import { T } from '../i18n/i18n.js';
import { panelTabs, tabPreferences } from '../data/panel-tabs.js';

export function renderTabSettings() {
    const wrap = document.createElement('div'); wrap.className = 'fcm-tab-settings';
    const row = document.createElement('div'); row.className = 'fcm-set-row';
    const title = document.createElement('div'); title.className = 'fcm-set-label'; title.style.flex = '1'; title.textContent = T('tabDisplaySettings');
    const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'fcm-btn fcm-theme-manage'; edit.textContent = T('tabEdit'); edit.setAttribute('aria-expanded', 'false');
    const panel = document.createElement('div'); panel.className = 'fcm-theme-options fcm-tab-editor'; panel.hidden = true;
    const chips = document.createElement('div'); chips.className = 'fcm-tab-chips'; chips.dataset.fcmDragOwner = '';
    const note = document.createElement('p'); note.className = 'fcm-set-note'; note.textContent = T('tabSettingsHint');
    panel.append(chips, note); row.append(title, edit); wrap.append(row, panel);
    edit.onclick = () => { panel.hidden = !panel.hidden; edit.setAttribute('aria-expanded', String(!panel.hidden)); };
    const options = tabPreferences(cfg.panelTabs), names = new Map(panelTabs);
    let drag, suppressClick = false;
    function save() { cfg.panelTabs = tabPreferences(options); saveCfg(); window.dispatchEvent(new Event('fcm-tabs-change')); }
    function move(key, index) {
        options.order.splice(options.order.indexOf(key), 1); options.order.splice(index, 0, key); save(); draw();
        chips.querySelector(`[data-tab-setting="${key}"]`)?.focus();
    }
    function draw() {
        chips.replaceChildren();
        options.order.forEach(key => {
            const chip = document.createElement('button'); chip.type = 'button'; chip.className = 'fcm-tab-chip'; chip.dataset.tabSetting = key;
            chip.textContent = T(names.get(key));
            const visible = !options.hidden.includes(key); chip.classList.toggle('active', visible); chip.setAttribute('aria-pressed', String(visible));
            chip.onclick = () => {
                if (suppressClick) return;
                if (options.hidden.includes(key)) options.hidden = options.hidden.filter(item => item !== key); else options.hidden.push(key);
                save(); draw(); chips.querySelector(`[data-tab-setting="${key}"]`)?.focus();
            };
            chip.onkeydown = event => {
                if (!event.altKey || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
                event.preventDefault(); const index = options.order.indexOf(key) + (event.key === 'ArrowLeft' ? -1 : 1);
                if (index >= 0 && index < options.order.length) move(key, index);
            };
            chip.onpointerdown = event => {
                if (event.button !== 0) return;
                suppressClick = false; drag = {key, x:event.clientX, y:event.clientY, target:key, moved:false, pointer:event.pointerId};
                chip.setPointerCapture(event.pointerId);
            };
            chip.onpointermove = event => {
                if (!drag || drag.pointer !== event.pointerId) return;
                if (Math.hypot(event.clientX-drag.x,event.clientY-drag.y) > 6) drag.moved = true;
                if (!drag.moved) return;
                chip.classList.add('dragging');
                const target = document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-tab-setting]');
                if (target && chips.contains(target)) drag.target = target.dataset.tabSetting;
                chips.querySelectorAll('[data-tab-setting]').forEach(item => item.classList.toggle('drop-target', item.dataset.tabSetting === drag.target));
            };
            chip.onpointerup = event => {
                if (!drag || drag.pointer !== event.pointerId) return;
                const previous = drag; drag = null; suppressClick = previous.moved;
                if (previous.moved && previous.key !== previous.target) move(previous.key, options.order.indexOf(previous.target));
                else chips.querySelectorAll('.dragging,.drop-target').forEach(item => item.classList.remove('dragging','drop-target'));
                setTimeout(() => { suppressClick = false; }, 0);
            };
            chip.onpointercancel = chip.onlostpointercapture = () => { drag = null; chips.querySelectorAll('.dragging,.drop-target').forEach(item => item.classList.remove('dragging','drop-target')); };
            chips.append(chip);
        });
    }
    draw(); return wrap;
}

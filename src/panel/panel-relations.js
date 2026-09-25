import { createRelationCanvas } from './relation-canvas.js';
import { makeSearchWrap } from '../ui/search-clear.js';
import { cfg, saveCfg } from '../core/config.js';
import { relationOptions, ownSocialRelations } from '../data/relation-options.js';
import { openProfile } from '../api/public-api.js';
import { minimizePanel } from './panel-controller.js';
import { T } from '../i18n/i18n.js';
import { createRelationWorker } from '../data/relation-worker.js';
import { beginPanelView } from './panel-lifecycle.js';

let query = '', sidebarVisible = true;
const CANVAS_LABEL_THRESHOLD = 200, LARGE_GRAPH_THRESHOLD = 1000;
const svgNS = 'http://www.w3.org/2000/svg';
const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
};
const svgElement = (tag, attributes = {}) => {
    const node = document.createElementNS(svgNS, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    return node;
};

export async function renderRelations(container, { openPeopleSearch, initialFocus = null } = {}) {
    let focusId = initialFocus;
    const options = relationOptions(cfg.relationGraph);
    let service, observer, cancelWarning, frame = 0, requestVersion = 0, searchVersion = 0;
    const active = beginPanelView(container, { dispose() { cancelWarning?.(); cancelAnimationFrame(frame); service?.dispose(); observer?.disconnect(); } });
    container.replaceChildren();
    const root = element('div', 'fcm-relations');
    const toolbar = element('div', 'fcm-toolbar');
    const { wrap: searchWrap, inp: input } = makeSearchWrap(query, T('peopleSearchPlaceholder'), undefined, undefined,
        () => { query = ''; ++searchVersion; results.replaceChildren(); });
    const controls = [];
    function button(label, action, host = toolbar) {
        const node = element('button', 'fcm-btn', label); node.type = 'button';
        node.addEventListener('click', action); host.append(node);
        if (host === toolbar || host.classList.contains('fcm-graph-filters')) controls.push(node);
        return node;
    }
    toolbar.append(searchWrap);
    button(T('btnSearch'), () => { void search(); });
    toolbar.append(element('span', 'fcm-spacer'));
    button(T('graphSelf'), () => { focusId = Number(globalThis.Player?.MemberNumber); void showGraph(); });
    const refreshButton = button(T('graphRefresh'), () => { void renderRelations(container, { openPeopleSearch, initialFocus: focusId }); });
    const depth = element('input', 'fcm-search');
    depth.type = 'number'; depth.min = '1'; depth.max = '10'; depth.step = '1';
    depth.setAttribute('aria-label', T('graphDepth'));
    depth.value = String(options.depth);
    const filters = element('div', 'fcm-graph-filters');
    const depthLabel = element('label', 'fcm-graph-depth', T('graphDepth'));
    depth.title = T('graphDepthHint');
    const stepper = element('span', 'fcm-graph-stepper');
    for (const [text, delta] of [['−', -1], ['+', 1]]) {
        const step = element('button', 'fcm-btn', text); step.type = 'button';
        step.setAttribute('aria-label', `${T('graphDepth')} ${text} 1`);
        step.onclick = () => { depth.value = String(Math.min(10, Math.max(1, Number(depth.value) + delta))); applyDepth(); };
        controls.push(step); stepper.append(step);
        if (delta === -1) stepper.append(depth);
    }
    depthLabel.append(stepper); filters.append(depthLabel);
    const isPressed = toggle => toggle.getAttribute('aria-pressed') === 'true';
    function saveOptions(patch) {
        Object.assign(options, relationOptions({ ...cfg.relationGraph, ...patch }));
        cfg.relationGraph = { ...options }; saveCfg();
    }
    function filter(key, className, pressed = true, onChange = showGraph) {
        const toggle = element('button', `fcm-graph-filter ${className}`, key ? T(key) : ''); toggle.type = 'button';
        const sync = () => { toggle.classList.toggle('active', pressed); toggle.setAttribute('aria-pressed', String(pressed)); };
        toggle.onclick = () => { pressed = !pressed; sync(); void onChange(pressed); };
        sync(); filters.append(toggle); return toggle;
    }
    const master = filter('graphMaster', 'fcm-graph-master');
    const sub = filter('graphSub', 'fcm-graph-sub');
    const lover = filter('graphLovership', 'fcm-graph-lover');
    master.style.color = options.master.color;
    sub.style.color = options.sub.color;
    lover.style.color = options.lover.color;
    const friend = filter('graphFriend', 'fcm-graph-social', false), whitelist = filter('graphWhitelist', 'fcm-graph-social', false);
    friend.title = whitelist.title = T('graphOwnSocial');
    friend.style.color = whitelist.style.color = options.social.color;
    filter('graphSilence', 'fcm-graph-silence', !options.warnLarge, disabled => {
        saveOptions({ warnLarge: !disabled });
        if (disabled) cancelWarning?.(true);
    });
    let namePath = null;
    filter('graphNames', 'fcm-graph-names', options.showNames, value => { saveOptions({ showNames: value }); updateNames(); });
    function updateNames() {
        for (const node of visualNodes) {
            node.hideLabel = !options.showNames || (namePath !== null && !(node.center || namePath.has(Number(node.group.dataset.node))));
            node.group.classList.toggle('fcm-graph-no-label', node.hideLabel);
        }
        paintCanvas();
    }
    const stop = button(T('graphStop'), () => {
        ++requestVersion; ++searchVersion; cancelWarning?.(); service?.dispose(); service = null;
        clearGraph(); setBusy(false); setControlsDisabled(false);
        status.textContent = centerLabel.textContent = T('graphStopped');
    }, filters);
    function setControlsDisabled(disabled) {
        for (const control of [...controls, input, depth, master, sub, lover, friend, whitelist]) control.disabled = disabled;
        stop.disabled = false;
    }
    function applyDepth() {
        const value = Number(depth.value);
        if (!Number.isSafeInteger(value) || value < 1 || value > 10) { depth.value = String(options.depth); return; }
        if (options.depth === value) return;
        saveOptions({ depth: value }); void showGraph();
    }
    depth.onchange = applyDepth;
    depth.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); applyDepth(); } });
    const status = element('div', 'fcm-graph-status', ''); status.setAttribute('role', 'status');
    const help = element('details', 'fcm-graph-help');
    help.append(element('summary', '', T('graphHelp')), element('div', 'fcm-graph-hint', T('graphHint')));
    const body = element('div', 'fcm-graph-body');
    const sidebar = element('div', 'fcm-graph-sidebar');
    const results = element('div', 'fcm-graph-results'), detail = element('div', 'fcm-graph-detail', T('graphSelect'));
    sidebar.append(element('div', 'fcm-graph-section-title', T('graphDetails')), detail,
        element('div', 'fcm-graph-section-title', T('btnSearch')), results);
    const stage = element('div', 'fcm-graph-stage');
    const canvas = element('canvas', 'fcm-graph-edges'); canvas.setAttribute('aria-hidden', 'true');
    const canvasRenderer = createRelationCanvas(canvas);
    const svg = svgElement('svg', { role: 'group', 'aria-label': T('tabRelations'), viewBox: '-400 -300 800 600' });
    const empty = element('div', 'fcm-graph-empty', T('graphStart'));
    const centerLabel = element('div', 'fcm-graph-center', T('graphStart'));
    const viewportControls = element('div', 'fcm-graph-viewport-controls');
    const loading = element('div', 'fcm-graph-loading'); loading.hidden = true; loading.setAttribute('role', 'status');
    loading.append(element('span', 'fcm-graph-spinner'), element('span', '', T('graphBusy')));
    function setBusy(busy) { loading.hidden = !busy; stage.setAttribute('aria-busy', String(busy)); }
    stage.append(canvas, svg, empty, centerLabel, viewportControls, loading); body.append(stage, sidebar);
    const sidebarToggle = button(T('graphDetails'), () => {
        sidebarVisible = !sidebarVisible; syncSidebar();
    });
    function syncSidebar() {
        sidebar.hidden = !sidebarVisible;
        sidebarToggle.setAttribute('aria-expanded', String(sidebarVisible));
        sidebarToggle.classList.toggle('active', sidebarVisible);
    }
    syncSidebar();
    const footer = element('div', 'fcm-graph-footer'); footer.append(status, help);
    root.append(toolbar, filters, body, footer); container.append(root);
    let graphNodes = [], visualNodes = [];
    const nodeLevels = new Map(), adjacency = new Map();
    const graphStyle = getComputedStyle(stage);
    const labelColors = { text:graphStyle.getPropertyValue('--tx').trim() || '#eee', background:graphStyle.backgroundColor || '#161020', font:graphStyle.fontFamily || 'sans-serif' };
    function paintCanvas() { canvasRenderer.paint(visualEdges, view, svg.clientWidth, svg.clientHeight, options.width, graphNodes.length >= CANVAS_LABEL_THRESHOLD ? visualNodes : [], labelColors); }
    let view = { x: -400, y: -300, w: 800, h: 600 }, fitted = { ...view }, drag, visualEdges = [];
    function clearGraph() {
        cancelAnimationFrame(frame); frame = 0;
        svg.replaceChildren(); graphNodes = []; visualNodes = []; visualEdges = [];
        nodeLevels.clear(); adjacency.clear(); canvasRenderer.reset();
        detail.textContent = T('graphSelect');
        paintCanvas();
    }
    function updateSizes(edges = true) {
        const width = svg.clientWidth, height = svg.clientHeight;
        const scale = Math.min(width / view.w, height / view.h);
        if (!scale) return;
        for (const { group, pos, labelWidth } of visualNodes) {
            const sx = (pos.x - view.x) * scale + (width - view.w * scale)/2;
            const sy = (pos.y - view.y) * scale + (height - view.h * scale)/2;
            const margin = labelWidth + 24;
            const outside = edges && (sx < -margin || sy < -margin || sx > width + margin || sy > height + margin);
            group.style.display = outside ? 'none' : '';
            if (outside) continue;
            group.setAttribute('transform', `translate(${pos.x} ${pos.y}) scale(${1/scale})`);
        }
        if (!edges) return;
        paintCanvas();
    }
    function applyView(edges = true) { svg.setAttribute('viewBox', `${view.x} ${view.y} ${view.w} ${view.h}`); updateSizes(edges); }
    function scheduleView() { if (!frame) frame = requestAnimationFrame(() => { frame = 0; if (active()) applyView(); }); }
    function fitGraph() {
        if (!svg.querySelector('[data-node]')) return;
        svg.classList.add('fcm-fitting');
        // Labels have a fixed screen size. Fit their actual bounds as well as the
        // nodes, iterating because their world-space size changes with the scale.
        updateSizes(false);
        for (let pass = 0; pass < 8; pass++) {
            const bounds = svg.getBBox();
            const scale = Math.min(svg.clientWidth / view.w, svg.clientHeight / view.h);
            if (!scale || !bounds.width || !bounds.height) break;
            const padding = 20 / scale;
            fitted = { x: bounds.x - padding, y: bounds.y - padding,
                w: bounds.width + padding * 2, h: bounds.height + padding * 2 };
            const delta = Math.abs(view.w - fitted.w) / view.w;
            view = { ...fitted }; applyView(false);
            if (delta < 0.001) break;
        }
        svg.classList.remove('fcm-fitting');
        updateSizes();
    }
    observer = new ResizeObserver(() => {
        if (view.w === fitted.w && view.x === fitted.x && view.y === fitted.y) fitGraph();
        else updateSizes();
    }); observer.observe(stage);
    function zoom(factor) {
        const width = Math.max(fitted.w / 8, Math.min(fitted.w * 3, view.w * factor));
        const ratio = width / view.w;
        view = { x: view.x + (view.w - width) / 2, y: view.y + view.h * (1 - ratio) / 2, w: width, h: view.h * ratio }; scheduleView();
    }
    button('+', () => zoom(0.8), viewportControls).setAttribute('aria-label', T('graphZoomIn'));
    button('−', () => zoom(1.25), viewportControls).setAttribute('aria-label', T('graphZoomOut'));
    button(T('graphFit'), fitGraph, viewportControls);
    svg.addEventListener('wheel', event => { event.preventDefault(); zoom(event.deltaY > 0 ? 1.15 : 0.87); }, { passive: false });
    svg.addEventListener('pointerdown', event => {
        if (event.button !== 0 || event.target.closest('[data-node]')) return;
        const matrix = svg.getScreenCTM();
        if (!matrix) return;
        drag = { x: event.clientX, y: event.clientY, view: { ...view }, scale: matrix.a };
        svg.setPointerCapture(event.pointerId);
    });
    svg.addEventListener('pointermove', event => {
        if (!drag) return;
        view.x = drag.view.x - (event.clientX - drag.x) / drag.scale;
        view.y = drag.view.y - (event.clientY - drag.y) / drag.scale; scheduleView();
    });
    for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) svg.addEventListener(event, () => { drag = null; });
    const date = seen => seen ? new Date(seen).toLocaleString() : T('graphUnknown');
    function select(node, { highlight = true } = {}) {
        const neighbors = new Set([node.id]), pathEdges = new Set();
        const queue = [node.id], visited = new Set(queue);
        for (let i = 0; i < queue.length; i++) for (const edge of adjacency.get(queue[i]) || []) {
            const other = edge.from === queue[i] ? edge.to : edge.from;
            if (nodeLevels.get(other) >= nodeLevels.get(queue[i])) continue;
            pathEdges.add(edge.id); neighbors.add(other);
            if (!visited.has(other)) { visited.add(other); queue.push(other); }
        }
        namePath = highlight ? visited : null;
        for (const edge of visualEdges) {
            const { from, to } = edge;
            const connected = from === node.id || to === node.id || pathEdges.has(edge.id);
            edge.muted = highlight && !connected;
            if (connected) { neighbors.add(from); neighbors.add(to); }
        }
        for (const item of svg.querySelectorAll('[data-node]')) {
            item.classList.toggle('selected', Number(item.dataset.node) === node.id);
            item.classList.toggle('fcm-graph-muted', highlight && !neighbors.has(Number(item.dataset.node)));
        }
        updateNames();
        detail.replaceChildren(element('b', '', node.name), element('span', 'fcm-graph-member-id', `#${node.id}`),
            element('small', 'fcm-graph-distance', node.level === 0 ? T('graphCenter') : T('graphHops', node.level)),
            element('p', '', T('graphSeen', date(node.seen))));
        if (node.missing) detail.append(element('p', '', T('graphMissing')));
        button(T('graphFocus'), () => { focusId = node.id; void showGraph(); }, detail);
        button(T('graphOpenProfile'), async event => {
            const target = event.currentTarget; target.disabled = true;
            try {
                if (await openProfile(node.id)) { if (active()) minimizePanel({ showMini: false }); }
                else if (active()) status.textContent = T('graphProfileFailed');
            } catch { if (active()) status.textContent = T('graphProfileFailed'); }
            finally { if (active()) target.disabled = false; }
        }, detail);
        button(T('tabPeople'), () => openPeopleSearch?.(String(node.id)), detail);
    }
    svg.addEventListener('contextmenu', event => {
        event.preventDefault(); drag = null;
        if (graphNodes.length) select(graphNodes[0], { highlight: false });
        svg.querySelectorAll('[data-node].selected').forEach(node => node.classList.remove('selected'));
    });
    async function draw(graph, version) {
        clearGraph();
        graphNodes = graph.nodes;
        for (const node of graph.nodes) nodeLevels.set(node.id, node.level);
        for (const edge of graph.edges) for (const id of [edge.from, edge.to]) {
            if (!adjacency.has(id)) adjacency.set(id, []);
            adjacency.get(id).push(edge);
        }
        svg.classList.toggle('fcm-raster-labels', graphNodes.length >= CANVAS_LABEL_THRESHOLD);
        const valid = () => active() && version === requestVersion;
        const yieldUI = () => new Promise(resolve => setTimeout(resolve, 0));
        let work = 0;
        empty.hidden = graph.nodes.length > 0;
        if (!graph.nodes.length) { canvasRenderer.paint([], view, svg.clientWidth, svg.clientHeight, options.width); empty.textContent = T('graphNotFound'); centerLabel.textContent = T('graphNotFound'); return; }
        centerLabel.textContent = `${T('graphCenter')} · ${graph.nodes[0].name} #${graph.nodes[0].id}`;
        const positions = new Map();
        positions.set(graph.nodes[0].id, { x: 0, y: 0 });
        let radius = 180;
        const rings = [], byLevel = new Map();
        for (const node of graph.nodes) { if (!byLevel.has(node.level)) byLevel.set(node.level, []); byLevel.get(node.level).push(node); }
        const levels = [...byLevel.keys()].filter(level => level > 0).sort((a, b) => a - b);
        for (const level of levels) {
            const ring = byLevel.get(level);
            radius = Math.max(radius + 180, ring.length * 22);
            rings.push(radius);
            ring.forEach((node, index) => {
                const angle = index * Math.PI * 2 / ring.length - Math.PI / 2 + (level - 1) * 0.85;
                positions.set(node.id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
            });
        }
        const extent = radius + Math.max(200, radius * 0.5);
        fitted = { x: -extent, y: -extent, w: extent * 2, h: extent * 2 }; view = { ...fitted }; applyView();
        for (const r of rings) svg.append(svgElement('circle', { r, class: 'fcm-graph-ring', 'aria-hidden': 'true' }));
        const colors = Object.fromEntries(['master', 'sub', 'lover', 'social'].map(role => [role, options[role].color]));
        // Ownership always points owner -> owned. Color distinguishes the outward
        // path towards an owner from the outward path towards an owned member.
        const edgeRole = edge => ['friend', 'whitelist'].includes(edge.type) ? 'social' : edge.type === 'lover' ? 'lover'
            : nodeLevels.get(edge.from) > nodeLevels.get(edge.to) ? 'master' : 'sub';
        const nodeRoles = new Map();
        for (const edge of graph.edges) {
            const fromLevel = nodeLevels.get(edge.from), toLevel = nodeLevels.get(edge.to);
            if (fromLevel === toLevel) continue;
            const farther = fromLevel > toLevel ? edge.from : edge.to;
            if (!nodeRoles.has(farther) || edge.type === 'owner') nodeRoles.set(farther, edgeRole(edge));
        }
        const pairs = new Map(), pairIndex = new Map();
        const pairKey = edge => `${Math.min(edge.from, edge.to)}:${Math.max(edge.from, edge.to)}`;
        for (const edge of graph.edges) pairs.set(pairKey(edge), (pairs.get(pairKey(edge)) || 0) + 1);
        for (const edge of graph.edges) {
            if (++work % 150 === 0) { await yieldUI(); if (!valid()) return; }
            const a = positions.get(edge.from), b = positions.get(edge.to);
            const key = pairKey(edge), index = pairIndex.get(key) || 0;
            pairIndex.set(key, index + 1);
            const bend = (index - (pairs.get(key) - 1) / 2) * 40 * (edge.from < edge.to ? 1 : -1);
            const role = edgeRole(edge);
            const style = options[role].style;
            visualEdges.push({ id:edge.id, a, b, bend, style, color:colors[role], type:edge.type, from:edge.from, to:edge.to, muted:false });
        }
        for (const node of graph.nodes) {
            if (++work % 100 === 0) { await yieldUI(); if (!valid()) return; }
            const pos = positions.get(node.id);
            const group = svgElement('g', { transform: `translate(${pos.x} ${pos.y})`, 'data-node': node.id, 'data-level': node.level,
                'data-angle': Math.atan2(pos.y, pos.x) * 180 / Math.PI,
                tabindex: 0, role: 'button', 'aria-label': `${node.name} #${node.id}` });
            if (nodeRoles.has(node.id)) group.style.setProperty('--node-color', colors[nodeRoles.get(node.id)]);
            group.classList.toggle('missing', node.missing);
            group.append(svgElement('circle', { r: node.level === 0 ? 11 : 7 }));
            const title = svgElement('title'); title.textContent = `${node.name} #${node.id}\n${T('graphSeen', date(node.seen))}`; group.append(title);
            const label = svgElement('text', { y: node.level === 0 ? 26 : 22, 'text-anchor': 'middle' });
            label.style.setProperty('font-size', '12px', 'important'); label.style.strokeWidth = '3px';
            const radial = node.level > 0 && byLevel.get(node.level).length > 16;
            if (radial) {
                const angle = Number(group.dataset.angle), left = angle > 90 || angle < -90;
                label.setAttribute('transform', `rotate(${left ? angle + 180 : angle})`);
                label.setAttribute('text-anchor', left ? 'end' : 'start'); label.setAttribute('x', left ? -13 : 13); label.setAttribute('y', 4);
            }
            label.textContent = `${node.name} #${node.id}`; group.append(label);
            group.addEventListener('click', () => select(node));
            group.addEventListener('keydown', event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); select(node); } });
            group.addEventListener('dblclick', () => { focusId = node.id; void showGraph(); });
            svg.append(group);
            visualNodes.push({ group, pos, center:node.level === 0, labelWidth:label.textContent.length * 12, label, radial });
        }
        select(graph.nodes[0], { highlight: false });
        fitGraph();
    }
    const showError = error => { if (active() && error?.name !== 'AbortError') { status.textContent = T('graphError'); console.warn('[FCM] relation graph:', error); } };
    function ensureService() {
        return service ||= createRelationWorker(ownSocialRelations(globalThis.Player));
    }
    function confirmLarge(count) {
        return new Promise(resolve => {
            const warning = element('div', 'fcm-graph-warning'); warning.setAttribute('role', 'alert');
            warning.append(element('p', '', T('graphLargeWarning')), element('p', '', T('graphCount', count.nodes, count.edges)));
            cancelWarning = (proceed = false) => { warning.remove(); cancelWarning = null; resolve(proceed); };
            button(T('graphContinue'), () => cancelWarning?.(true), warning);
            button(T('graphCancel'), () => cancelWarning?.(), warning);
            stage.append(warning);
        });
    }
    async function showGraph() {
        if (!focusId) return;
        cancelWarning?.();
        const version = ++requestVersion, current = ensureService();
        const valid = () => active() && version === requestVersion;
        try {
            setBusy(true);
            const count = await current.request('prepare', { options: { id: focusId, depth: depth.value, master: isPressed(master), sub: isPressed(sub), lover: isPressed(lover), friend: isPressed(friend), whitelist: isPressed(whitelist) } });
            if (!valid()) return;
            if (options.warnLarge && count.nodes > LARGE_GRAPH_THRESHOLD) {
                setBusy(false);
                if (!await confirmLarge(count)) { if (valid()) status.textContent = T('graphStopped'); return; }
            }
            if (!valid()) return;
            const graph = await current.request('prepared');
            if (!valid()) return;
            setBusy(true);
            await draw(graph, version);
            if (!valid()) return;
            const reached = graph.nodes.reduce((max, node) => Math.max(max, node.level), 0);
            status.textContent = T('graphCount', graph.nodes.length, graph.edges.length)
                + (reached < Number(depth.value) ? ` · ${T('graphDepthReached', reached)}` : '');
        } catch (error) { if (valid()) showError(error); }
        finally { if (valid()) setBusy(false); }
    }
    async function search() {
        query = input.value.trim();
        const version = ++searchVersion;
        try {
            const matches = await ensureService().request('search', { query });
            if (!active() || version !== searchVersion) return;
            results.replaceChildren(element('small', '', T('graphSearchLimit')));
            if (!matches.length) results.append(element('p', '', T('graphNotFound')));
            for (const node of matches) button(`${node.name} #${node.id}`, () => { focusId = node.id; void showGraph(); }, results);
            if (matches.length) { focusId = matches[0].id; await showGraph(); }
        } catch (error) { if (version === searchVersion) showError(error); }
    }
    input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); if (!input.disabled) void search(); } });
    setControlsDisabled(true);
    // Refresh remains available after a read error; leaving the tab also cancels the worker.
    try {
        service = ensureService();
        setBusy(true);
        await service.ready;
        if (!active()) return;
        setBusy(false);
        setControlsDisabled(false);
        if (focusId) await showGraph();
    } catch (error) { showError(error); if (active()) { setBusy(false); refreshButton.disabled = false; } }
}

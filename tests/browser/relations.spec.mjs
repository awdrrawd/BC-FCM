import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { build } from 'esbuild';

async function setup(page, count = 8, fullPanel = false) {
    const translations = readFileSync('Translation/TW.json', 'utf8');
    await page.route('**/src/i18n/i18n.js', route => route.fulfill({ contentType: 'text/javascript', body:
        `const dict=${translations}; export const T=(key,...args)=>(dict[key]||key).replace(/\\{(\\d+)\\}/g,(_,i)=>args[i]??''); export const TH=T;` }));
    await page.route('**/src/api/public-api.js', route => route.fulfill({ contentType: 'text/javascript', body: 'export const openProfile=async id=>{globalThis.openedGraphProfile=id;return true;};' }));
    await page.route('**/src/panel/panel-controller.js', route => route.fulfill({ contentType: 'text/javascript', body: readFileSync('src/panel/panel-controller.js', 'utf8') }));
    if (fullPanel) {
        const stubs = {
            'panel/panel-controller.js': readFileSync('src/panel/panel-controller.js', 'utf8'),
            'panel/panel-settings.js': 'export const renderSettings=()=>{};',
            'panel/panel-help.js': 'export const renderHelp=()=>{};',
            'panel/panel-friends.js': 'export const renderFriends=()=>{},resetFriendsSearch=()=>{};',
            'panel/panel-room.js': 'export const renderRoom=()=>{},resetRoomAdminSearch=()=>{};',
            'panel/panel-roomsearch.js': 'export const renderRoomSearch=()=>{},resetRoomSearchQuery=()=>{};',
            'chat/chat-fx.js': 'export const _removeWhisperAvatar=()=>{};',
            'data/data.js': 'export const amAdmin=()=>true,getDisplayName=String,inRoomFn=()=>false,getAllRels=()=>[],onlineFriends=[],matchesSearchFields=()=>true,searchScoreFields=()=>0,requestOnlineFriends=()=>{},buildFriendList=()=>[];',
        };
        for (const [path, body] of Object.entries(stubs)) await page.route(`**/src/${path}`, route => route.fulfill({ contentType: 'text/javascript', body }));
    }
    await page.goto('/tests/browser/fixture.html');
    await page.waitForFunction(() => !!globalThis.fixture);
    await page.evaluate(async count => {
        await new Promise((resolve, reject) => {
            const req = indexedDB.open('bce-past-profiles', 31);
            req.onupgradeneeded = () => req.result.createObjectStore('profiles', { keyPath: 'memberNumber' });
            req.onerror = () => reject(req.error);
            req.onsuccess = () => {
                const db = req.result, tx = db.transaction('profiles', 'readwrite'), store = tx.objectStore('profiles');
                for (let id = 1; id <= count; id++) store.put({ memberNumber: id, name: `Person ${id}`, lastNick: `Member ${id}`, seen: 1700000000000 + id,
                    characterBundle: JSON.stringify({ MemberNumber: id, Ownership: id > 1 ? { MemberNumber: 1 } : null,
                        Lovership: id === 1 ? [{ MemberNumber: 2 }] : [], Description: 'unused'.repeat(30) }) });
                tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
            };
        });
        const { renderRelations } = await import('/src/panel/panel-relations.js');
        const { disposePanelView } = await import('/src/panel/panel-lifecycle.js');
        const { createPanelMaximizeButton, syncPanelMaximize } = await import('/src/panel/panel-maximize.js');
        const panel = document.querySelector('#fcm-panel');
        const header = document.createElement('div'); header.id = 'fcm-hdr';
        header.append(createPanelMaximizeButton(panel)); panel.prepend(header); syncPanelMaximize(panel);
        globalThis.Player.MemberNumber = 1;
        globalThis.graphTest = {
            render: () => renderRelations(document.querySelector('#fcm-content'), { openPeopleSearch: id => { globalThis.graphTest.searched = id; } }),
            dispose: () => disposePanelView(document.querySelector('#fcm-content')),
        };
    }, count);
}

// Click the painted circle: an SVG group bounding box also includes its label
// and can have its center in empty space depending on the platform font metrics.
test('relationship tab reads native IndexedDB, filters, focuses and links to people search', async ({ page }) => {
    await setup(page);
    await page.evaluate(() => globalThis.graphTest.render());
    await expect(page.locator('.fcm-graph-stage [data-node]')).toHaveCount(8);
    await expect(page.locator('.fcm-graph-edges')).toBeVisible();
    await expect(page.locator('.fcm-graph-status')).toContainText('8 條關係');
    await page.locator('.fcm-graph-owner').click();
    await expect(page.locator('.fcm-graph-stage [data-node]')).toHaveCount(2);
    await expect(page.locator('.fcm-graph-status')).toContainText('1 條關係');
    await page.locator('.fcm-graph-stage [data-node="2"] circle').click();
    await expect(page.locator('.fcm-graph-detail')).toContainText('Member 2');
    await page.locator('.fcm-graph-detail button').last().click();
    expect(await page.evaluate(() => globalThis.graphTest.searched)).toBe('2');
    await page.locator('.fcm-relations .fcm-toolbar input').fill('Member 8');
    await page.locator('.fcm-relations .fcm-toolbar input').press('Enter');
    await expect(page.locator('.fcm-graph-stage [data-node]')).toHaveCount(1);
    await expect(page.locator('.fcm-graph-detail')).toContainText('Member 8');
    await page.locator('.fcm-graph-owner').click();
    await page.locator('.fcm-graph-depth input').fill('2');
    await page.locator('.fcm-graph-depth input').press('Enter');
    await expect(page.locator('.fcm-graph-stage [data-node]')).toHaveCount(8);
    await page.screenshot({ path: 'test-results/relations-preview.png' });
});

test('FCM maximizes and restores the original panel bounds', async ({ page }) => {
    await setup(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const panel = page.locator('#fcm-panel');
    const before = await panel.boundingBox();
    await expect(page.locator('[data-panel-max]')).toHaveText('');
    await expect(page.locator('[data-panel-max] svg')).toHaveCount(1);
    await page.locator('[data-panel-max]').click();
    const maximized = await panel.boundingBox();
    expect(maximized.x).toBe(0); expect(maximized.y).toBe(0);
    expect(maximized.width).toBe(page.viewportSize().width);
    expect(maximized.height).toBe(page.viewportSize().height);
    await expect(page.locator('[data-panel-max]')).toHaveAttribute('aria-pressed', 'true');
    await page.locator('[data-panel-max]').click();
    expect(await panel.boundingBox()).toEqual(before);
});

test('five-hop graph renders every level, remembers depth, and allows more room by hiding details', async ({ page }) => {
    await setup(page);
    await page.evaluate(async () => {
        await new Promise((resolve, reject) => {
            const request = indexedDB.open('bce-past-profiles');
            request.onsuccess = () => {
                const db = request.result, tx = db.transaction('profiles', 'readwrite'), store = tx.objectStore('profiles');
                store.clear();
                for (let id = 1; id <= 7; id++) store.put({ memberNumber: id, name: `Chain ${id}`, seen: 1700000000000,
                    characterBundle: JSON.stringify({ MemberNumber: id, Ownership: id < 7 ? { MemberNumber: id + 1 } : null }) });
                tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
            };
        });
        await globalThis.graphTest.render();
    });
    await expect(page.locator('.fcm-graph-depth input')).toHaveValue('2');
    await expect(page.locator('.fcm-graph-stage [data-node]')).toHaveCount(3);
    await page.locator('.fcm-graph-depth input').fill('5');
    await page.locator('.fcm-graph-depth input').press('Enter');
    await expect(page.locator('.fcm-graph-stage [data-node]')).toHaveCount(6);
    await expect(page.locator('.fcm-graph-ring')).toHaveCount(5);
    expect(await page.locator('[data-node="6"]').getAttribute('transform')).not.toMatch(/undefined|NaN/);
    await page.locator('[data-node="3"] circle').click();
    await expect(page.locator('.fcm-graph-stage [data-node].fcm-graph-muted')).toHaveCount(2);
    await expect(page.locator('[data-node="4"] text')).toBeVisible();
    await expect(page.locator('[data-node="5"] text')).toBeHidden();
    await expect(page.locator('[data-node="1"]')).not.toHaveClass(/fcm-graph-muted/);
    await page.locator('.fcm-graph-stage svg').click({button:'right',position:{x:10,y:10}});
    await expect(page.locator('.fcm-graph-muted')).toHaveCount(0);
    await expect(page.locator('[data-node].selected')).toHaveCount(0);
    const width = (await page.locator('.fcm-graph-stage').boundingBox()).width;
    await page.locator('.fcm-toolbar button[aria-expanded]').click();
    await expect(page.locator('.fcm-graph-sidebar')).toBeHidden();
    expect((await page.locator('.fcm-graph-stage').boundingBox()).width).toBeGreaterThan(width);
    await page.evaluate(() => globalThis.graphTest.render());
    await expect(page.locator('.fcm-graph-depth input')).toHaveValue('5');
    await expect(page.locator('.fcm-graph-stage [data-node]')).toHaveCount(6);
    await page.locator('.fcm-toolbar button[aria-expanded]').click();
    await page.screenshot({ path: 'test-results/relations-five-hops.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.fcm-graph-depth input')).toBeVisible();
    const bounds = await page.locator('.fcm-graph-stage').boundingBox();
    expect(bounds.width).toBeGreaterThan(200); expect(bounds.height).toBeGreaterThan(170);
    await page.screenshot({ path: 'test-results/relations-mobile.png' });
});

test('large profile index warns before drawing and can be cancelled', async ({ page }) => {
    test.setTimeout(60000);
    await setup(page, 30000);
    await page.evaluate(() => { globalThis.graphTicks = 0; globalThis.graphTimer = setInterval(() => globalThis.graphTicks++, 20); void globalThis.graphTest.render(); });
    await expect(page.locator('.fcm-graph-loading')).toBeVisible();
    await expect(page.locator('.fcm-graph-status')).not.toContainText('正在');
    await expect(page.locator('.fcm-graph-warning')).toContainText('該關係網數據龐大可能導致延遲甚至停止運作');
    await expect(page.locator('.fcm-graph-warning')).toContainText('30000');
    await expect(page.locator('[data-node]')).toHaveCount(0);
    expect(await page.evaluate(() => { clearInterval(globalThis.graphTimer); return globalThis.graphTicks; })).toBeGreaterThan(1);
    await page.getByRole('button', { name: '取消', exact: true }).click();
    await expect(page.locator('.fcm-graph-warning')).toHaveCount(0);
    await page.getByRole('button', { name: '停止繪製', exact: true }).click();
    await expect(page.locator('.fcm-graph-status')).toContainText('已停止');
});

test('real FCM shell places Relations after People and releases workers on tab switch and close', async ({ page }) => {
    await setup(page, 8, true);
    await page.evaluate(async () => {
        document.querySelector('#fcm-panel').remove();
        const NativeWorker = globalThis.Worker;
        globalThis.activeGraphWorkers = 0;
        globalThis.Worker = class extends NativeWorker {
            constructor(...args) { super(...args); globalThis.activeGraphWorkers++; }
            terminate() { globalThis.activeGraphWorkers--; super.terminate(); }
        };
        globalThis.realPanel = await import('/src/panel/panel.js');
        globalThis.realPanel.openPanel();
    });
    expect(await page.locator('#fcm-tabs .fcm-tab').evaluateAll(tabs => tabs.map(tab => tab.dataset.tab)))
        .toEqual(['friends', 'room', 'roomSearch', 'people', 'relations', 'settings', 'help']);
    await page.locator('[data-tab="relations"]').click();
    await expect(page.locator('.fcm-graph-stage [data-node]')).toHaveCount(8);
    expect(await page.evaluate(() => globalThis.activeGraphWorkers)).toBe(1);
    await page.locator('[data-panel-max]').click();
    await expect(page.locator('#fcm-panel')).toHaveClass(/maximized/);
    await page.locator('[data-tab="settings"]').click();
    expect(await page.evaluate(() => globalThis.activeGraphWorkers)).toBe(0);
    await page.locator('[data-tab="relations"]').click();
    await expect(page.locator('.fcm-graph-stage [data-node]')).toHaveCount(8);
    await page.screenshot({ path: 'test-results/relations-fullscreen.png' });
    await page.locator('[data-panel-close]').click();
    expect(await page.evaluate(() => globalThis.activeGraphWorkers)).toBe(0);
    await expect(page.locator('#fcm-panel')).toBeHidden();
});

test('bundled minified relation worker remains self-contained and keeps the shared DB version', async ({ page }) => {
    await setup(page);
    const result = await build({ stdin: { contents: 'import { createRelationWorker } from "./src/data/relation-worker.js"; globalThis.compiledRelationWorker = createRelationWorker;',
        resolveDir: process.cwd() }, bundle: true, minify: true, write: false, target: 'es2020' });
    await page.addScriptTag({ content: result.outputFiles[0].text });
    const graph = await page.evaluate(async () => {
        const worker = globalThis.compiledRelationWorker();
        try {
            await worker.ready;
            const value = await worker.request('graph', { options: { id: 1 } });
            const databases = await indexedDB.databases();
            return { count: value.nodes.length, version: databases.find(db => db.name === 'bce-past-profiles').version };
        } finally { worker.dispose(); }
    });
    expect(graph).toEqual({ count: 8, version: 31 });
});

test('dense first-hop labels stay visible, SVG fills its stage and relationship colors match direction', async ({ page }) => {
    await setup(page, 80);
    await page.evaluate(async () => {
        await new Promise((resolve, reject) => {
            const request = indexedDB.open('bce-past-profiles');
            request.onsuccess = () => {
                const db = request.result, tx = db.transaction('profiles', 'readwrite');
                tx.objectStore('profiles').put({ memberNumber: 1, name: 'Center', seen: 1700000000000,
                    characterBundle: JSON.stringify({ MemberNumber: 1, Ownership: { MemberNumber: 81 }, Lovership: [{ MemberNumber: 2 }] }) });
                tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error);
            };
        });
        await globalThis.graphTest.render();
    });
    const labels = page.locator('.fcm-graph-stage [data-level="1"] text');
    await expect(labels).toHaveCount(80);
    expect(await labels.evaluateAll(nodes => nodes.every(node => getComputedStyle(node).display !== 'none'))).toBe(true);
    await expect(page.locator('.fcm-graph-edges')).toBeVisible();
    await expect(page.locator('[data-node="81"] circle')).toHaveCSS('stroke', 'rgb(255, 179, 71)');
    const stage = await page.locator('.fcm-graph-stage').boundingBox();
    const svg = await page.locator('.fcm-graph-stage > svg').boundingBox();
    expect(svg.y).toBeCloseTo(stage.y, 0); expect(svg.height).toBeCloseTo(stage.height, 0);
    expect(await labels.evaluateAll(nodes => {
        const bounds = nodes[0].closest('svg').getBoundingClientRect();
        return nodes.every(node => { const r = node.getBoundingClientRect();
            return r.top >= bounds.top && r.bottom <= bounds.bottom && r.left >= bounds.left && r.right <= bounds.right;
        });
    })).toBe(true);
    await page.locator('[data-node="2"] circle').click();
    await expect(page.locator('[data-node="81"] text')).toBeHidden();
    await page.locator('.fcm-graph-depth input').fill('12');
    await page.locator('.fcm-graph-depth input').press('Enter');
    await expect(page.locator('.fcm-graph-depth input')).toHaveValue('12');
    await page.screenshot({ path: 'test-results/relations-dense-labels.png' });
});

test('own social filters, configurable appearance and Profile action', async ({ page }) => {
    await setup(page);
    await page.evaluate(async () => {
        globalThis.Player.FriendList = [99]; globalThis.Player.WhiteList = [100];
        const { cfg } = await import('/src/core/config.js');
        cfg.relationGraph = { master: { color: '#aabbcc', style: 'dotted' }, sub: { color: '#112233', style: 'none' } };
        await globalThis.graphTest.render();
    });
    await expect(page.locator('[data-node="99"]')).toHaveCount(0);
    await page.getByRole('button', { name:'朋友', exact: true }).click();
    await expect(page.locator('[data-node="99"]')).toHaveCount(1);
    await page.getByRole('button', { name:'白名單', exact: true }).click();
    await expect(page.locator('[data-node="100"]')).toHaveCount(1);
    await expect(page.getByRole('button', {name:'朋友',exact:true})).toHaveAttribute('aria-pressed','true');
    await expect(page.locator('[data-node="2"] circle')).toHaveCSS('stroke','rgb(17, 34, 51)');
    await page.locator('[data-node="2"] circle').click();
    await page.getByRole('button', { name: '開啟 Profile' }).click();
    expect(await page.evaluate(() => globalThis.openedGraphProfile)).toBe(2);
});

test('approved graph has no 200-person cap and stop warnings persists', async ({ page }) => {
    await setup(page, 1001);
    await page.evaluate(() => { void globalThis.graphTest.render(); });
    await expect(page.locator('.fcm-graph-warning')).toBeVisible();
    await page.getByRole('button', { name:'停止警告', exact: true }).click();
    await expect(page.locator('[data-node]')).toHaveCount(1001);
    expect(await page.evaluate(async () => (await import('/src/core/config.js')).cfg.relationGraph.warnLarge)).toBe(false);
});

test('graph settings save colors, styles and default depth', async ({ page }) => {
    await setup(page);
    await page.evaluate(async () => {
        const { renderRelationSettings } = await import('/src/panel/panel-relation-settings.js');
        document.querySelector('#fcm-content').replaceChildren(renderRelationSettings());
    });
    await page.getByLabel('主人 · 線條').selectOption('dotted');
    await page.getByLabel('主人 · 顏色').fill('#123456');
    await page.getByLabel('主人 · 顏色').dispatchEvent('change');
    await page.getByLabel('預設關係層數').fill('4');
    await page.getByLabel('預設關係層數').dispatchEvent('change');
    const value = await page.evaluate(async () => (await import('/src/core/config.js')).cfg.relationGraph);
    expect(value.master).toEqual({color:'#123456', style:'dotted'});
    expect(value.depth).toBe(4);
    await page.evaluate(() => globalThis.graphTest.render());
    await expect(page.getByLabel('關係層數', {exact:true})).toHaveValue('4');
});

test('opening Profile hides FCM and its minimized pill and allows reopening', async ({ page }) => {
    await setup(page, 8, true);
    await page.evaluate(async () => {
        document.querySelector('#fcm-panel').remove();
        const panel = await import('/src/panel/panel.js');
        globalThis.realGraphPanel = panel; panel.openPanel();
    });
    await page.locator('[data-tab="relations"]').click();
    await expect(page.locator('[data-node]')).toHaveCount(8);
    await page.getByRole('button', {name:'開啟 Profile'}).click();
    await expect(page.locator('#fcm-panel')).toBeHidden();
    await expect(page.locator('#fcm-mini')).not.toHaveClass(/visible/);
    await page.evaluate(() => globalThis.realGraphPanel.togglePanel());
    await expect(page.locator('#fcm-panel')).toBeVisible();
});

test('relation settings use compact right-aligned switches and themed labels', async ({ page }) => {
    await setup(page);
    await page.evaluate(async () => {
        const { renderRelationSettings } = await import('/src/panel/panel-relation-settings.js');
        const host = document.createElement('div'); host.className = 'fcm-settings-wrap'; host.append(renderRelationSettings());
        document.querySelector('#fcm-content').replaceChildren(host);
    });
    const toggle = page.getByRole('switch', {name:'大型關係網警告'});
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    const box = await toggle.boundingBox(); expect(box.width).toBeLessThan(50);
    const row = await toggle.locator('xpath=../..').boundingBox(); expect(box.x).toBeGreaterThan(row.x + row.width * .7);
    await toggle.press('Space'); await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(page.locator('.fcm-setting-actions')).toHaveCount(7);
    await page.screenshot({path:'test-results/relation-settings.png'});
});

test('tab preferences reorder and hide tabs without losing settings access', async ({ page }) => {
    await setup(page, 8, true);
    await page.evaluate(async () => {
        document.querySelector('#fcm-panel').remove();
        const panel = await import('/src/panel/panel.js'); panel.openPanel();
        document.querySelector('[data-panel-settings]').click();
        const { renderTabSettings } = await import('/src/panel/panel-tab-settings.js');
        const host = document.createElement('div'); host.className = 'fcm-settings-wrap'; host.style.height = '250px';
        host.append(renderTabSettings()); const filler = document.createElement('div'); filler.style.cssText = 'height:1000px;flex-shrink:0'; host.append(filler);
        document.querySelector('#fcm-content').append(host);
        const { installDragScroll } = await import('/src/ui/drag-scroll.js');
        installDragScroll(document.querySelector('#fcm-content'), '.fcm-settings-wrap');
    });
    await expect(page.locator('.fcm-tab-editor')).toBeHidden();
    await page.getByRole('button', {name:'編輯',exact:true}).click();
    const row = page.locator('[data-tab-setting="relations"]');
    const source = await row.boundingBox(), target = await page.locator('[data-tab-setting="people"]').boundingBox();
    await page.mouse.move(source.x+source.width/2,source.y+source.height/2); await page.mouse.down();
    await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:8}); await page.mouse.up();
    await expect(row).toHaveAttribute('aria-pressed','true');
    expect(await page.locator('.fcm-settings-wrap').evaluate(el=>el.scrollTop)).toBe(0);
    const fontSize = await row.evaluate(el=>parseFloat(getComputedStyle(el).fontSize)); expect(fontSize).toBeCloseTo(12 + 4/3, 1);
    expect(await page.locator('#fcm-tabs .fcm-tab').evaluateAll(nodes => nodes.map(n => n.dataset.tab)))
        .toEqual(['friends','room','roomSearch','relations','people','settings','help']);
    await page.screenshot({path:'test-results/tab-editor.png'});
    await row.click();
    await expect(page.locator('#fcm-tabs [data-tab="relations"]')).toHaveCount(0);
    await page.locator('[data-tab-setting="settings"]').click();
    await expect(page.locator('#fcm-tabs [data-tab="settings"]')).toHaveCount(0);
    await page.locator('[data-tab="people"]').click();
    await page.locator('[data-panel-settings]').click();
    expect(await page.evaluate(async () => (await import('/src/panel/panel.js')).uiTab)).toBe('settings');
    expect(await page.evaluate(async () => (await import('/src/core/config.js')).cfg.panelTabs.hidden)).toEqual(['relations','settings']);
});

test('graph search clears and fixed screen-space rope pitch survives zoom', async ({ page }) => {
    await setup(page);
    await page.evaluate(() => globalThis.graphTest.render());
    await expect(page.locator('.fcm-graph-filters input[type="checkbox"]')).toHaveCount(0);
    const sizes = await page.locator('.fcm-graph-filters, .fcm-graph-filters *').evaluateAll(nodes => [...new Set(nodes.map(node => getComputedStyle(node).fontSize))]);
    expect(sizes).toHaveLength(1);
    for(let i=0;i<4;i++) await page.getByRole('button',{name:'放大',exact:true}).click();
    await expect(page.locator('.fcm-graph-edges')).toBeVisible();
    const input=page.locator('.fcm-toolbar .fcm-search'); await input.fill('Member 2'); await input.press('Enter');
    await expect(page.locator('.fcm-graph-detail')).toContainText('Member 2');
    await page.locator('.fcm-search-wrap .fcm-clear-btn').click(); await expect(input).toHaveValue('');
    expect((await page.locator('.fcm-search-wrap').boundingBox()).width).toBe(168);
});

test('1000-person interaction benchmark', async ({ page }) => {
    test.setTimeout(60000);
    await setup(page, 1000);
    const metrics = await page.evaluate(async () => {
        const { cfg } = await import('/src/core/config.js'); cfg.relationGraph = { warnLarge:true };
        const start=performance.now(); await globalThis.graphTest.render();
        await new Promise(requestAnimationFrame); const load=performance.now()-start;
        const frames=[];
        for(let i=0;i<8;i++) {
            const start=performance.now(); document.querySelector('.fcm-graph-viewport-controls button').click();
            await new Promise(requestAnimationFrame); frames.push(performance.now()-start);
        }
        return {load,frames};
    });
    console.log('GRAPH_BENCHMARK', JSON.stringify(metrics));
    expect(Math.max(...metrics.frames)).toBeLessThan(200);
    expect(metrics.load).toBeLessThan(3000);
    await page.getByRole('button',{name:'置中／適合視窗'}).click();
    await page.screenshot({path:'test-results/relations-1000.png'});
    await expect(page.locator('[data-node]')).toHaveCount(1000);
});

test('canvas chain links keep ten-pixel spacing across zoom and none hides edges', async ({ page }) => {
    await setup(page);
    const result = await page.evaluate(async () => {
        const { createRelationCanvas } = await import('/src/panel/relation-canvas.js');
        const canvas = document.createElement('canvas'), painter = createRelationCanvas(canvas);
        const edge = {a:{x:0,y:50},b:{x:400,y:50},style:'chain',color:'#ffb347',type:'owner',bend:0};
        painter.paint([edge],{x:0,y:0,w:400,h:100},400,100,2);
        const ctx=canvas.getContext('2d');
        const before=Array.from(ctx.getImageData(40,40,100,20).data);
        painter.paint([edge],{x:0,y:25,w:200,h:50},400,100,2);
        const after=Array.from(ctx.getImageData(40,40,100,20).data);
        const row=ctx.getImageData(40,50,100,1).data;
        const holes=Array.from({length:100},(_,i)=>row[i*4+3]).filter(alpha=>alpha<50).length;
        const repeats=Array.from({length:90},(_,i)=>row[i*4+3]===row[(i+10)*4+3]).every(Boolean);
        painter.paint([{...edge,style:'none'}],{x:0,y:0,w:400,h:100},400,100,2);
        const empty=ctx.getImageData(0,0,400,100).data.every(value=>value===0);
        return {same:JSON.stringify(before)===JSON.stringify(after),holes,repeats,empty};
    });
    expect(result.same).toBe(true); expect(result.holes).toBeGreaterThan(10); expect(result.repeats).toBe(true); expect(result.empty).toBe(true);
});

test('1000 people with 3999 relationships remain interactive and render cached names', async ({ page }) => {
    test.setTimeout(60000); await setup(page, 1000);
    const metrics = await page.evaluate(async () => {
        await new Promise((resolve,reject)=>{
            const request=indexedDB.open('bce-past-profiles');
            request.onsuccess=()=>{
                const db=request.result, tx=db.transaction('profiles','readwrite');
                for(let id=1;id<=1000;id++) tx.objectStore('profiles').put({memberNumber:id,name:`Dense ${id}`,seen:1700000000000,
                    characterBundle:JSON.stringify({MemberNumber:id,Ownership:id>1?{MemberNumber:1}:null,Lovership:[1,13,47].map(offset=>({MemberNumber:(id+offset-1)%1000+1}))})});
                tx.oncomplete=()=>{db.close();resolve();};tx.onerror=()=>reject(tx.error);
            };
        });
        const {cfg}=await import('/src/core/config.js');cfg.relationGraph={warnLarge:true};
        const start=performance.now();await globalThis.graphTest.render();await new Promise(requestAnimationFrame);
        const load=performance.now()-start, frames=[];
        for(let i=0;i<6;i++) {const start=performance.now();document.querySelector('.fcm-graph-viewport-controls button').click();await new Promise(requestAnimationFrame);frames.push(performance.now()-start);}
        return {load,frames};
    });
    console.log('DENSE_GRAPH_BENCHMARK',JSON.stringify(metrics));
    expect(Math.max(...metrics.frames)).toBeLessThan(250); expect(metrics.load).toBeLessThan(3000);
    await expect(page.locator('[data-node]')).toHaveCount(1000);
    await expect(page.locator('.fcm-graph-status')).toContainText('3999');
    await page.getByRole('button',{name:'置中／適合視窗'}).click();
    await expect(page.locator('.fcm-graph-stage svg')).toHaveClass(/fcm-raster-labels/);
    await page.screenshot({path:'test-results/relations-dense-1000.png'});
});

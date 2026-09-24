import { test, expect } from '@playwright/test';
test.beforeEach(async ({page}) => {
    page.on('pageerror', error => { throw error; });
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await page.goto('/tests/browser/fixture.html');
    await page.waitForFunction(()=>!!globalThis.fixture);
});
test('20 players, drag insertion preview and Escape cancellation', async ({page}) => {
    await page.evaluate(()=>fixture.order());
    await expect(page.locator('.fcm-order-card')).toHaveCount(20);
    await page.locator('.fcm-sel').selectOption('insert');
    const source=await page.locator('[data-order-member="10"]').boundingBox();
    const target=await page.locator('[data-order-member="2"]').boundingBox();
    await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();
    await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:8});
    await expect(page.locator('.drag-ghost')).toBeVisible();
    await expect(page.locator('[data-order-member="10"] strong')).toHaveText('2');
    await page.keyboard.press('Escape');await page.mouse.up();
    await expect(page.locator('.drag-ghost')).toHaveCount(0);
    await expect(page.locator('[data-order-member="10"] strong')).toHaveText('10');
    expect(await page.evaluate(()=>sent.length)).toBe(0);
});
test('narrow layout stacks groups; non-admin cannot reorder', async ({page}) => {
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>{admin=false;fixture.order();});
    const groups=page.locator('.fcm-order-group'); const a=await groups.nth(0).boundingBox(),b=await groups.nth(1).boundingBox();
    expect(b.y).toBeGreaterThanOrEqual(a.y+a.height);
    await expect(page.locator('.fcm-order-card:disabled')).toHaveCount(20);
});
test('drop sends silent insertion commands and confirmation reuses the board', async ({page}) => {
    await page.evaluate(()=>fixture.order());await page.locator('.fcm-sel').selectOption('insert');
    const source=await page.locator('[data-order-member="10"]').boundingBox(), target=await page.locator('[data-order-member="2"]').boundingBox();
    await page.mouse.move(source.x+source.width/2,source.y+source.height/2);await page.mouse.down();
    await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:8});await page.mouse.up();
    await expect(page.locator('[data-order-member="10"] strong')).toHaveText('2');
    expect(await page.evaluate(()=>sent.length)).toBe(8);
    expect(await page.evaluate(()=>sent.every(({packet})=>packet.Publish===false))).toBe(true);
    await page.evaluate(()=>{document.querySelector('.fcm-order-board').dataset.sentinel='original';fixture.confirmOrder();});
    await expect(page.locator('.fcm-order-board')).toHaveAttribute('data-sentinel','original');
    await expect(page.locator('[data-order-member="10"]')).toBeEnabled();
});
test('initial left and restored right balloon tooltip sides', async ({page}) => {
    await page.evaluate(()=>fixture.balloon(true));
    const balloon=page.locator('#fcm-chat-balloon');await balloon.hover();
    let b=await balloon.boundingBox(),p=await page.locator('.fcm-balloon-preview').boundingBox();expect(p.x).toBeGreaterThan(b.x);
    await page.evaluate(()=>fixture.balloon(false));await balloon.hover();
    b=await balloon.boundingBox();p=await page.locator('.fcm-balloon-preview').boundingBox();expect(p.x+p.width).toBeLessThan(b.x);
});
test('card buttons keep whole labels on a narrow screen', async ({page}) => {
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>fixture.card());
    const result=await page.locator('[data-card-add-friend]').evaluate(el=>({wrap:getComputedStyle(el).whiteSpace,overflow:el.scrollWidth>el.clientWidth}));
    expect(result).toEqual({wrap:'nowrap',overflow:false});
});
test('pending people visits ignore out-of-order results and leaving', async ({page}) => {
    await page.evaluate(()=>fixture.people());await page.waitForFunction(()=>loads.length===1);
    await expect(page.locator('.fcm-search')).toHaveCount(0);
    await expect(page.locator('.fcm-page-loading')).toBeVisible();
    await page.evaluate(()=>fixture.people());await page.waitForFunction(()=>loads.length===2);
    await page.evaluate(()=>loads[1]([]));await expect(page.locator('.fcm-toolbar')).toHaveCount(1);
    await page.evaluate(()=>loads[0]([]));await expect(page.locator('.fcm-toolbar')).toHaveCount(1);
    await page.evaluate(()=>fixture.people());await page.waitForFunction(()=>loads.length===3);
    await page.evaluate(()=>{fixture.leave();loads[2]([]);});await expect(page.locator('#fcm-content')).toBeEmpty();
});

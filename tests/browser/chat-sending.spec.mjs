import { test, expect } from '@playwright/test';

test('fast sends do not flash and slow sends keep the composer geometry unchanged', async ({ page }) => {
    await page.goto('/tests/browser/fixture.html');
    await page.waitForFunction(() => !!globalThis.fixture);
    await page.evaluate(async () => {
        const { createChatComposer } = await import('/src/communication/chat/controllers/chat-composer.js');
        const root = document.createElement('div');
        root.id = 'fcm-chat-root';
        root.innerHTML = '<div id="fcm-chat-panel" style="--s:#17131e;--tx:#eee;--ac:#a078e8"><div class="fcm-chat-compose"><textarea data-input>hello</textarea><button data-send>Send</button></div></div>';
        document.body.append(root);
        const composer = createChatComposer({ getRoot: () => root, getMemberNumber: () => 42,
            capability: () => 'beep', displayName: String, isFriend: () => true, getReplyTarget: () => null,
            clearReplyTarget() {}, text: () => 'Sending…',
            sender: { send: () => globalThis.slowSend ? new Promise(resolve => { globalThis.finishSend = resolve; }) : true },
        });
        root.querySelector('[data-send]').addEventListener('click', composer.send);
        globalThis.labels = [];
        new MutationObserver(() => globalThis.labels.push(root.querySelector('[data-send]').textContent))
            .observe(root.querySelector('[data-send]'), { childList: true });
    });
    const button = page.locator('[data-send]');
    const before = await button.boundingBox();
    await button.click();
    await expect(button).toBeEnabled();
    expect(await page.evaluate(() => globalThis.labels.includes('Sending…'))).toBe(false);
    await page.locator('[data-input]').fill('slow');
    await page.evaluate(() => { globalThis.slowSend = true; });
    await button.click();
    await expect(button).toBeDisabled();
    await expect(button).toHaveText('Sending…');
    const during = await button.boundingBox();
    expect(during.width).toBeCloseTo(before.width, 1);
    expect(during.x).toBeCloseTo(before.x, 1);
    await page.evaluate(() => globalThis.finishSend(true));
    await expect(button).toHaveText('Send');
    await expect(button).toBeEnabled();
});

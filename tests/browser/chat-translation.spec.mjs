import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => { throw error; });
    await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
    await page.goto('/tests/browser/fixture.html');
    await page.waitForFunction(() => !!globalThis.fixture);
    await page.evaluate(async () => {
        const { messageHtml } = await import('/src/communication/chat/views/chat-message-view.js');
        const { installMessageActions } = await import('/src/communication/chat/events/chat-message-actions.js');
        const { createChatTranslationController } = await import('/src/communication/chat/controllers/chat-translation.js');
        document.querySelector('#fcm-panel').style.display = 'none';
        globalThis.Liko = { MAT: { translate() {} } };
        const root = document.createElement('div'); root.id = 'fcm-chat-root';
        const messages = ['first', 'second', 'third'].map((content, id) => messageHtml({ id: String(id), content, timestamp: 1, direction: 'in', channel: 'beep' })).join('');
        root.innerHTML = `<div id="fcm-chat-panel" style="--s:#17131e;--tx:#eee;--ac:#a078e8"><div class="fcm-chat-main"><header class="fcm-chat-conversation-header" style="height:55px;flex:none">Contact</header><div class="fcm-chat-messages" style="padding-top:180px">${messages}</div><textarea data-input></textarea></div><div class="fcm-chat-context-menu" hidden>${['select', 'copy', 'multi', 'reply', 'translate', 'cancel'].map(action => `<button data-context-${action}>${action}</button>`).join('')}</div></div>`;
        document.body.append(root);
        globalThis.translationRequests = [];
        const controller = createChatTranslationController({
            getRoot: () => root, getMemberNumber: () => 42, text: key => key,
            translate: content => new Promise(resolve => globalThis.translationRequests.push({ content, resolve })),
        });
        let cleanup;
        globalThis.rebindMessageActions = () => {
            cleanup?.();
            cleanup = installMessageActions({ root, log: root.querySelector('.fcm-chat-messages'), menu: root.querySelector('.fcm-chat-context-menu'),
            isMultiSelectActive: () => false, selectedIds: new Set(), updateMultiSelectUi() {}, openProfile() {},
            replyToMessage() {}, enterMultiSelect() {}, isMobile: () => false, translateMessage: controller.show,
            });
        };
        globalThis.rebindMessageActions();
    });
});

test('selected-message translation is below the header, replaces on another message and closes anywhere', async ({ page }) => {
    const first = page.locator('[data-msg-id="0"]');
    await first.locator('.fcm-chat-content').click();
    await first.locator('[data-message-translate]').click();
    const panel = page.locator('.fcm-chat-translation');
    await expect(panel).toContainText('chatTranslationLoading');
    await expect(panel.locator('small')).toHaveCount(0);
    await page.evaluate(() => globalThis.translationRequests[0].resolve({ translated: '<img src=x onerror=alert(1)>', targetLang: 'zh-TW' }));
    await expect(panel.locator('p')).toHaveText('<img src=x onerror=alert(1)>');
    await expect(panel.locator('img')).toHaveCount(0);
    const headerBox = await page.locator('.fcm-chat-conversation-header').boundingBox();
    const panelBox = await panel.boundingBox();
    expect(panelBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height);
    await page.locator('[data-msg-id="1"] .fcm-chat-content').click();
    await expect(panel).toContainText('chatTranslationLoading');
    expect(await page.evaluate(() => globalThis.translationRequests[1].content)).toBe('second');
    await page.evaluate(() => globalThis.translationRequests[1].resolve({ translated: 'second translation' }));
    await expect(panel.locator('p')).toHaveText('second translation');
    await panel.click();
    await expect(panel).toHaveCount(0);
});

test('context translation ignores stale results after replacement and dismissal', async ({ page }) => {
    await page.locator('[data-msg-id="0"]').click({ button: 'right' });
    await page.locator('[data-context-translate]').click();
    await expect(page.locator('.fcm-chat-context-menu')).toBeHidden();
    await page.locator('[data-msg-id="1"] .fcm-chat-content').click();
    await page.evaluate(() => {
        globalThis.translationRequests[1].resolve({ translated: 'new result' });
        globalThis.translationRequests[0].resolve({ translated: 'stale result' });
    });
    await expect(page.locator('.fcm-chat-translation p')).toHaveText('new result');
    await page.locator('[data-msg-id="2"] .fcm-chat-content').click();
    await page.locator('[data-input]').click();
    await page.evaluate(() => globalThis.translationRequests[2].resolve({ translated: 'closed result' }));
    await expect(page.locator('.fcm-chat-translation')).toHaveCount(0);
});

test('translation actions hide without MAT and reappear when MAT becomes ready', async ({ page }) => {
    await page.evaluate(() => { delete globalThis.Liko.MAT; window.dispatchEvent(new Event('liko:mat-ready')); });
    await page.locator('[data-msg-id="0"] .fcm-chat-content').click();
    await expect(page.locator('[data-msg-id="0"] [data-message-translate]')).toBeHidden();
    await page.locator('[data-msg-id="0"]').click({ button: 'right' });
    await expect(page.locator('[data-context-translate]')).toBeHidden();
    await page.evaluate(() => { globalThis.Liko.MAT = { enabled: false, translate() {} }; window.dispatchEvent(new Event('liko:mat-ready')); });
    await expect(page.locator('[data-context-translate]')).toBeVisible();
    await expect(page.locator('[data-msg-id="0"] [data-message-translate]')).toBeVisible();
});


test('rebinding the same message log removes old handlers', async ({ page }) => {
    await page.evaluate(() => { globalThis.rebindMessageActions(); globalThis.rebindMessageActions(); });
    const message = page.locator('[data-msg-id="0"]');
    await message.locator('.fcm-chat-content').click();
    await expect(message).toHaveClass(/selected/);
    await message.locator('[data-message-translate]').click();
    expect(await page.evaluate(() => globalThis.translationRequests.length)).toBe(1);
});

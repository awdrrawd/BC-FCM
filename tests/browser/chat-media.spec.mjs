import { test, expect } from '@playwright/test';

test('FCM owns optional media buttons, drafts and recipient isolation', async ({ page }) => {
    await page.goto('/tests/browser/fixture.html');
    await page.waitForFunction(() => !!globalThis.fixture);
    await page.evaluate(async () => {
        const media = await import('/src/communication/chat/controllers/chat-media.js');
        const root = document.createElement('div');
        document.getElementById('fcm-panel').style.display = 'none';
        root.id = 'fcm-chat-panel';
        root.innerHTML = '<div class="fcm-chat-compose"><button data-upload-image hidden>Upload</button><textarea data-input>draft</textarea><button data-send>Send</button></div><div class="fcm-chat-content">video</div>';
        document.body.append(root);
        globalThis.mediaFixture = { root, member: 2, choices: 0, processed: 0 };
        const state = globalThis.mediaFixture;
        state.bind = () => media.bindMediaComposer(root, {getMemberNumber:()=>state.member, text:key=>key});
        state.bind();
        state.ready = () => {
            globalThis.Liko = {ImageUploader: {chooseImage: callback => {state.choices++;state.deliver=callback;},uploadFile: async()=> 'https://example.test/drop.png'}};
            globalThis.LikoVideoPlayerInstance = {processMessage: () => state.processed++};
            state.bind(); state.bind(); media.processChatMedia(root);
        };
        window.prompt = (text,url) => {state.recovered=url;};
    });
    await expect(page.locator('[data-upload-image]')).toBeHidden();
    await page.evaluate(()=>globalThis.mediaFixture.ready());
    await page.locator('[data-upload-image]').click();
    expect(await page.evaluate(()=>globalThis.mediaFixture.choices)).toBe(1);
    await page.evaluate(()=>globalThis.mediaFixture.deliver('https://example.test/first.png'));
    await expect(page.locator('[data-input]')).toHaveValue('draft https://example.test/first.png');
    await page.locator('[data-upload-image]').click();
    await page.evaluate(()=>{globalThis.mediaFixture.member=3;globalThis.mediaFixture.deliver('https://example.test/late.png');});
    await expect(page.locator('[data-input]')).toHaveValue('draft https://example.test/first.png');
    expect(await page.evaluate(()=>globalThis.mediaFixture.recovered)).toBe('https://example.test/late.png');
    expect(await page.evaluate(()=>globalThis.mediaFixture.processed)).toBe(1);
});


test('panel header and history drops use the current composer once after rebinding', async ({ page }) => {
    await page.goto('/tests/browser/fixture.html');
    await page.waitForFunction(() => !!globalThis.fixture);
    const result = await page.evaluate(async () => {
        const { bindMediaComposer } = await import('/src/communication/chat/controllers/chat-media.js');
        const panel = document.createElement('div'); panel.id = 'fcm-chat-panel';
        panel.innerHTML = '<header>Header</header><div class="fcm-chat-main"><div class="fcm-chat-content">History</div><div class="fcm-chat-compose"><button data-upload-image></button><textarea data-input>first</textarea></div></div>';
        document.body.append(panel);
        let calls = 0;
        globalThis.Liko = { ImageUploader: { chooseImage() {}, async uploadFile() { calls++; return 'https://example.test/image.png'; } } };
        const options = {getMemberNumber:()=>2,text:key=>key};
        const main = panel.querySelector('.fcm-chat-main');
        bindMediaComposer(main, options); bindMediaComposer(main, options);
        async function drop(target) {
            const dataTransfer = new DataTransfer(); dataTransfer.items.add(new File(['x'],'x.png',{type:'image/png'}));
            target.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer}));
            await new Promise(resolve=>setTimeout(resolve,0));
        }
        await drop(panel.querySelector('header'));
        const first = panel.querySelector('[data-input]').value;
        main.querySelector('.fcm-chat-compose').innerHTML = '<button data-upload-image></button><textarea data-input>second</textarea>';
        bindMediaComposer(main, options);
        await drop(panel.querySelector('.fcm-chat-content'));
        const second = panel.querySelector('[data-input]').value;
        main.querySelector('.fcm-chat-compose').remove();
        await drop(panel.querySelector('header'));
        return { calls, first, second };
    });
    expect(result).toEqual({calls:2,first:'first https://example.test/image.png',second:'second https://example.test/image.png'});
});

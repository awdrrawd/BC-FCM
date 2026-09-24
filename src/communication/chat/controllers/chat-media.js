// Optional media plugins own upload/playback; FCM owns UI, routing and drafts.
const bound = new WeakSet();
const panels = new WeakMap();
function uploader() { return globalThis.Liko?.ImageUploader; }

function processChatMedia(scope) {
    const api = globalThis.LikoVideoPlayerInstance;
    if (typeof api?.processMessage !== 'function') return;
    scope?.querySelectorAll?.('.fcm-chat-content').forEach(element => {
        try { api.processMessage(element); } catch (error) { console.warn('[FCM] Media rendering failed', error); }
    });
}

function captureDestination(input, { getMemberNumber, text }) {
    const member = Number(getMemberNumber());
    return urls => {
        if (!urls.length) return;
        if (!input.isConnected || Number(getMemberNumber()) !== member) {
            window.prompt(text('chatUploadRecover'), urls.join(' '));
            return;
        }
        input.value = [input.value.trimEnd(), ...urls].filter(Boolean).join(' ');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
    };
}

function bindMediaComposer(main, { getMemberNumber, text }) {
    const panel = main?.closest('#fcm-chat-panel') || main;
    if (panel) {
        const installed = panels.has(panel);
        panels.set(panel, { getMemberNumber, text });
        if (!installed) bindPanelDrop(panel);
    }
    const compose = main?.querySelector('.fcm-chat-compose');
    const input = compose?.querySelector('[data-input]');
    const button = compose?.querySelector('[data-upload-image]');
    if (!input || !button) return;
    button.hidden = typeof uploader()?.chooseImage !== 'function';
    if (bound.has(button)) return;
    bound.add(button);
    button.addEventListener('click', event => {
        event.preventDefault(); event.stopPropagation();
        const deliver = captureDestination(input, { getMemberNumber, text });
        try { uploader()?.chooseImage(url => deliver([url])); }
        catch (error) { console.warn('[FCM] Image chooser failed', error); }
    });
}

function bindPanelDrop(panel) {
    panel.addEventListener('dragover', event => {
        if (typeof uploader()?.uploadFile !== 'function' || !Array.from(event.dataTransfer?.types || []).includes('Files')) return;
        event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'copy';
    });
    panel.addEventListener('drop', async event => {
        const api = uploader();
        const files = Array.from(event.dataTransfer?.files || []);
        if (typeof api?.uploadFile !== 'function' || !files.length) return;
        event.preventDefault(); event.stopPropagation();
        const input = panel.querySelector('.fcm-chat-compose [data-input]');
        const context = panels.get(panel);
        if (!input || !Number(context.getMemberNumber())) return;
        const deliver = captureDestination(input, context);
        for (const file of files) {
            if (!file.type.startsWith('image/')) continue;
            try {
                const url = await api.uploadFile(file);
                if (url) deliver([url]);
            } catch (error) { console.warn('[FCM] Image upload failed', error); }
        }
    });
}
export { bindMediaComposer, processChatMedia };

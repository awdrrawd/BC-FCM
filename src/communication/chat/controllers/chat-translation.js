function createChatTranslationController({ getRoot, getMemberNumber, translate, text, document: doc = globalThis.document }) {
    let panel = null;
    let messageId = null;
    let generation = 0;
    let observer = null;

    function close() {
        generation++;
        panel?.remove();
        panel = null;
        messageId = null;
        observer?.disconnect();
        observer = null;
        doc.removeEventListener('click', dismiss, true);
    }

    function dismiss(event) {
        const message = event.target.closest('.fcm-chat-message');
        if (message && getRoot()?.contains(message) && message.dataset.msgId !== messageId && !event.target.closest('button,a,input,textarea')) {
            void show(message);
        } else close();
    }

    async function show(message) {
        const content = message?.querySelector('.fcm-chat-content')?.textContent || '';
        const header = getRoot()?.querySelector('.fcm-chat-conversation-header');
        if (!header || !content.trim()) return;
        close();
        const request = generation;
        const member = getMemberNumber();
        messageId = message.dataset.msgId;
        panel = doc.createElement('section');
        panel.className = 'fcm-chat-translation';
        panel.setAttribute('role', 'status');
        panel.setAttribute('aria-live', 'polite');
        const title = doc.createElement('strong');
        title.textContent = text('chatTranslate');
        const body = doc.createElement('p');
        body.textContent = text('chatTranslationLoading');
        panel.append(title, body);
        header.insertAdjacentElement('afterend', panel);
        const currentPanel = panel;
        const position = () => { currentPanel.style.top = `${header.offsetTop + header.offsetHeight + 6}px`; };
        position();
        if (typeof ResizeObserver === 'function') {
            observer = new ResizeObserver(position);
            observer.observe(header);
        }
        doc.addEventListener('click', dismiss, true);
        try {
            const result = await translate(content);
            if (request !== generation || !currentPanel.isConnected || getMemberNumber() !== member) return;
            body.textContent = result?.error || typeof result?.translated !== 'string'
                ? text('chatTranslationFailed') : result.translated;
            if (result?.targetLang) title.textContent = `${text('chatTranslate')} · ${result.targetLang}`;
        } catch {
            if (request === generation && currentPanel.isConnected && getMemberNumber() === member) body.textContent = text('chatTranslationFailed');
        }
    }

    return { close, show };
}

export { createChatTranslationController };

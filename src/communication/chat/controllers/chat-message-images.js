import { normalizedImageOrigin, trustImageOrigin } from '../../image-trust.js';

function createChatMessageImagesController({ getViewport, confirm, text, rerender }) {
    function bind(scope, log) {
        scope?.querySelectorAll?.('.fcm-chat-image').forEach(image => {
            image.addEventListener('load', () => {
                const viewport = getViewport();
                if (log && viewport.followingLatest) viewport.scrollToLatest(log);
            }, { once: true });
            image.addEventListener('error', () => {
                const link = image.closest('a');
                if (!link) return;
                link.className = 'fcm-chat-link';
                link.textContent = link.href;
            }, { once: true });
        });
        scope?.querySelectorAll?.('[data-trust-image-origin]').forEach(button => {
            button.addEventListener('click', async () => {
                const origin = normalizedImageOrigin(button.dataset.trustImageOrigin);
                if (!origin || !await confirm(text('chatTrustImagePrompt', origin), text('chatTrustImage'))) return;
                trustImageOrigin(origin);
                rerender();
            });
        });
    }

    return { bind };
}

export { createChatMessageImagesController };

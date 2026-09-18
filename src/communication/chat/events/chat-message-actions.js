import { hasMAT } from '../services/chat-translation.js';

function selectMessageText(messageElement) {
    const content = messageElement?.querySelector('.fcm-chat-content');
    if (!content) return;
    const lastContent = messageElement.querySelector('.fcm-chat-message-original') || content;
    const selection = getSelection();
    const range = document.createRange();
    range.setStartBefore(content);
    range.setEndAfter(lastContent);
    selection.removeAllRanges();
    selection.addRange(range);
}

function installMessageActions({ root, log, menu, isMultiSelectActive, selectedIds, updateMultiSelectUi, openProfile, replyToMessage, translateMessage = () => {}, enterMultiSelect, isMobile }) {
    if (!root || !log || !menu) return () => {};
    const listeners = new AbortController();
    const listen = (element, type, handler, options = {}) => element.addEventListener(type, handler, { ...options, signal: listeners.signal });
    const syncTranslation = () => root.querySelectorAll('[data-message-translate],[data-context-translate]').forEach(button => { button.hidden = !hasMAT(); });
    syncTranslation();
    listen(window, 'liko:mat-ready', syncTranslation);
    let target = null;
    let suppressClickUntil = 0;
    let holdTimer = 0;

    const hide = () => { menu.hidden = true; target = null; };
    const show = (message, clientX, clientY) => {
        syncTranslation();
        target = message;
        menu.hidden = false;
        const panelRect = root.querySelector('#fcm-chat-panel').getBoundingClientRect();
        menu.style.left = `${Math.max(8, Math.min(clientX - panelRect.left, panelRect.width - menu.offsetWidth - 8))}px`;
        menu.style.top = `${Math.max(8, Math.min(clientY - panelRect.top, panelRect.height - menu.offsetHeight - 8))}px`;
    };
    const closeFromOutside = event => { if (!event.target.closest('.fcm-chat-context-menu')) hide(); };
    listen(document, 'pointerdown', closeFromOutside, { capture: true });

    listen(log, 'click', event => {
        if (Date.now() < suppressClickUntil) { event.preventDefault(); return; }
        const message = event.target.closest('.fcm-chat-message');
        if (isMultiSelectActive() && message) {
            const id = String(message.dataset.msgId);
            if (selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id);
            updateMultiSelectUi();
            return;
        }
        const profile = event.target.closest('[data-profile-member]');
        if (profile) { openProfile(profile.dataset.profileMember, message?.dataset.msgId); return; }
        const jump = event.target.closest('[data-reply-jump]');
        if (jump) {
            const targetMessage = log.querySelector(`[data-shared-msg-id="${CSS.escape(jump.dataset.replyJump)}"]`);
            if (targetMessage) {
                targetMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetMessage.classList.add('reply-highlight');
                setTimeout(() => targetMessage.classList.remove('reply-highlight'), 1600);
            }
            return;
        }
        const translation = event.target.closest('[data-message-translate]');
        if (translation) { event.stopPropagation(); void translateMessage(message); return; }
        const reply = event.target.closest('[data-message-reply]');
        if (reply) { event.stopPropagation(); replyToMessage(reply.closest('.fcm-chat-message')); return; }
        if (message) {
            const selected = message.classList.contains('selected');
            log.querySelectorAll('.fcm-chat-message.selected').forEach(element => element.classList.remove('selected'));
            message.classList.toggle('selected', !selected);
        }
    });
    listen(log, 'contextmenu', event => {
        const message = event.target.closest('.fcm-chat-message');
        if (!message) return;
        event.preventDefault();
        show(message, event.clientX, event.clientY);
    });

    if (isMobile()) {
        let startX = 0;
        let startY = 0;
        const cancelHold = () => { clearTimeout(holdTimer); holdTimer = 0; };
        listen(log, 'pointerdown', event => {
            const message = event.target.closest('.fcm-chat-message');
            if (!message || event.button !== 0) return;
            startX = event.clientX;
            startY = event.clientY;
            holdTimer = window.setTimeout(() => {
                suppressClickUntil = Date.now() + 500;
                navigator.vibrate?.(25);
                show(message, startX, startY);
            }, 550);
        });
        listen(log, 'pointerup', cancelHold);
        listen(log, 'pointercancel', cancelHold);
        listen(log, 'pointermove', event => { if (Math.hypot(event.clientX - startX, event.clientY - startY) > 10) cancelHold(); });
    }

    menu.querySelector('[data-context-reply]').onclick = () => { const message = target; hide(); replyToMessage(message); };
    const translation = menu.querySelector('[data-context-translate]');
    if (translation) translation.onclick = () => { const message = target; hide(); void translateMessage(message); };
    menu.querySelector('[data-context-select]').onclick = () => { const message = target; hide(); selectMessageText(message); };
    menu.querySelector('[data-context-copy]').onclick = async () => {
        const parts = target ? [...target.querySelectorAll('.fcm-chat-content,.fcm-chat-message-original')].map(element => element.textContent) : [];
        hide();
        if (parts.length) await navigator.clipboard.writeText(parts.join('\n'));
    };
    menu.querySelector('[data-context-multi]').onclick = () => { const message = target; hide(); enterMultiSelect(message); };
    menu.querySelector('[data-context-cancel]').onclick = hide;

    return () => {
        clearTimeout(holdTimer);
        listeners.abort();
        menu.querySelectorAll('button').forEach(button => { button.onclick = null; });
        hide();
    };
}

function createChatMessageActionsController({ getRoot, messageSelection, openProfile, replyToMessage, translateMessage, closeTranslation = () => {}, isMobile }) {
    let cleanup = null;

    function bind() {
        const root = getRoot();
        cleanup?.();
        closeTranslation();
        cleanup = installMessageActions({
            root,
            log: root?.querySelector('.fcm-chat-messages'),
            menu: root?.querySelector('.fcm-chat-context-menu'),
            isMultiSelectActive: messageSelection.isActive,
            selectedIds: messageSelection.ids,
            updateMultiSelectUi: messageSelection.updateUi,
            openProfile,
            replyToMessage,
            translateMessage,
            enterMultiSelect: messageSelection.enter,
            isMobile,
        });
    }

    function destroy() {
        closeTranslation();
        cleanup?.();
        cleanup = null;
    }

    return { bind, destroy };
}

export { createChatMessageActionsController, installMessageActions };

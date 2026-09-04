import { createDialogHost } from '../../../ui/dialog.js';
import { esc } from '../services/chat-content.js';

function createChatDialogs({ colors, text, htmlText }) {
    function overlayStyle() {
        const [surface, foreground, accent] = colors();
        return `--s:${surface};--tx:${foreground};--ac:${accent}`;
    }

    function confirm(message, confirmLabel = text('chatConfirmDelete')) {
        return new Promise(resolve => {
            const host = createDialogHost({
                overlayClass: 'fcm-chat-modal-overlay', dialogClass: 'fcm-chat-modal', overlayStyle: overlayStyle(),
                onClose: value => resolve(!!value),
            });
            host.dialog.innerHTML = `<div>${esc(message)}</div><div><button data-modal-cancel>${htmlText('chatCancel')}</button><button data-modal-ok>${esc(confirmLabel)}</button></div>`;
            host.listen(host.dialog.querySelector('[data-modal-cancel]'), 'click', () => host.close(false));
            host.listen(host.dialog.querySelector('[data-modal-ok]'), 'click', () => host.close(true));
            host.mount();
        });
    }

    function promptGroupName() {
        return new Promise(resolve => {
            const host = createDialogHost({
                overlayClass: 'fcm-chat-modal-overlay', dialogClass: 'fcm-chat-modal fcm-chat-group-dialog', overlayStyle: overlayStyle(),
                onClose: value => resolve(value || ''),
            });
            host.dialog.innerHTML = `<div>${htmlText('chatNewGroup')}</div><input data-new-group-name maxlength="24" placeholder="${htmlText('chatNewGroup')}"><div><button data-modal-cancel>${htmlText('chatCancel')}</button><button data-modal-ok>${htmlText('btnConfirm')}</button></div>`;
            const input = host.dialog.querySelector('[data-new-group-name]');
            host.listen(host.dialog.querySelector('[data-modal-cancel]'), 'click', () => host.close(''));
            host.listen(host.dialog.querySelector('[data-modal-ok]'), 'click', () => host.close(input.value.trim()));
            host.listen(input, 'keydown', event => {
                event.stopPropagation();
                if (event.key === 'Enter') host.close(input.value.trim());
                else if (event.key === 'Escape') host.close('');
            });
            host.mount();
            input.focus();
        });
    }

    return { confirm, promptGroupName };
}

export { createChatDialogs };

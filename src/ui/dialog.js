const activeDialogs = new Map();

function closeDialog(id, result) {
    const active = activeDialogs.get(id);
    if (active) return active.close(result);
    const existing = document.getElementById(id);
    if (!existing) return false;
    existing.remove();
    return true;
}

function createDialogHost({
    id = '',
    overlayClass = 'fcm-overlay',
    dialogClass = 'fcm-dialog',
    overlayStyle = '',
    dialogStyle = '',
    closeOnBackdrop = true,
    onKeyDown = null,
    onClose = null,
} = {}) {
    if (id) closeDialog(id);

    const overlay = document.createElement('div');
    if (id) overlay.id = id;
    overlay.className = overlayClass;
    overlay.style.cssText = overlayStyle;

    const dialog = document.createElement('div');
    dialog.className = dialogClass;
    dialog.style.cssText = dialogStyle;
    overlay.appendChild(dialog);

    const cleanups = [];
    let closed = false;
    const listen = (target, type, listener, options) => {
        target.addEventListener(type, listener, options);
        cleanups.push(() => target.removeEventListener(type, listener, options));
    };
    const close = result => {
        if (closed) return false;
        closed = true;
        while (cleanups.length) cleanups.pop()();
        overlay.remove();
        if (id && activeDialogs.get(id)?.overlay === overlay) activeDialogs.delete(id);
        onClose?.(result);
        return true;
    };

    listen(dialog, 'click', event => event.stopPropagation());
    if (closeOnBackdrop) listen(overlay, 'click', event => { if (event.target === overlay) close(); });
    if (onKeyDown) listen(document, 'keydown', event => onKeyDown(event, close), true);

    const host = {
        overlay,
        dialog,
        close,
        listen,
        mount(parent = document.body) { parent.appendChild(overlay); },
    };
    if (id) activeDialogs.set(id, host);
    return host;
}

export { closeDialog, createDialogHost };

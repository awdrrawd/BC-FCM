import { cfg, saveCfg } from '../../../core/config.js';

function resetBalloonInteraction(element) {
    element?.classList.remove('dragging', 'released', 'release-water', 'stirred', 'notify');
    ['--drag-angle', '--drag-stretch', '--drag-squash', '--stir-x', '--stir-y', '--stir-angle'].forEach(name => element?.style.removeProperty(name));
}

function updateBalloonPreviewSide(element) {
    if (!element?.matches?.('#fcm-chat-balloon,.fcm-chat-user-balloon')) return;
    const rect = element.getBoundingClientRect();
    element.classList.toggle('preview-right', rect.left < innerWidth * 0.25);
}

function stirNearbyBalloons(dragged, dx, dy) {
    const source = dragged.getBoundingClientRect();
    const sx = source.left + source.width / 2;
    const sy = source.top + source.height / 2;
    document.querySelectorAll('#fcm-chat-balloon,.fcm-chat-user-balloon').forEach(other => {
        if (other === dragged || getComputedStyle(other).display === 'none') return;
        const rect = other.getBoundingClientRect();
        const distance = Math.hypot(rect.left + rect.width / 2 - sx, rect.top + rect.height / 2 - sy);
        if (distance > 150) return;
        const force = (1 - distance / 150) * 13;
        const length = Math.hypot(dx, dy) || 1;
        other.style.setProperty('--stir-x', `${dx / length * force}px`);
        other.style.setProperty('--stir-y', `${dy / length * force}px`);
        other.style.setProperty('--stir-angle', `${Math.max(-9, Math.min(9, dx * .35))}deg`);
        other.classList.add('stirred');
    });
}

function settleStirredBalloons() {
    document.querySelectorAll('.stirred').forEach(balloon => {
        balloon.classList.remove('stirred');
        balloon.style.removeProperty('--stir-x');
        balloon.style.removeProperty('--stir-y');
        balloon.style.removeProperty('--stir-angle');
    });
}

function snapBalloonToNearestEdge(element) {
    if (!element?.matches?.('#fcm-chat-balloon,.fcm-chat-user-balloon')) return;
    const rect = element.getBoundingClientRect();
    const distances = { left: rect.left, right: innerWidth - rect.right, top: rect.top, bottom: innerHeight - rect.bottom };
    const edge = Object.entries(distances).sort((a, b) => a[1] - b[1])[0][0];
    const margin = 8;
    element.dataset.snapEdge = edge;
    element.style.setProperty('--water-angle', { bottom: '0deg', top: '180deg', left: '90deg', right: '-90deg' }[edge]);
    element.style.right = element.style.bottom = 'auto';
    if (edge === 'left') element.style.left = `${margin}px`;
    else if (edge === 'right') element.style.left = `${Math.max(margin, innerWidth - element.offsetWidth - margin)}px`;
    else if (edge === 'top') element.style.top = `${margin}px`;
    else element.style.top = `${Math.max(margin, innerHeight - element.offsetHeight - margin)}px`;
    updateBalloonPreviewSide(element);
}

function resolveBalloonCollision(element) {
    if (!element?.matches?.('#fcm-chat-balloon,.fcm-chat-user-balloon')) return;
    const others = [...document.querySelectorAll('#fcm-chat-balloon,.fcm-chat-user-balloon')].filter(other => other !== element && getComputedStyle(other).display !== 'none');
    let rect = element.getBoundingClientRect();
    for (let pass = 0; pass < 12 && others.some(other => { const r = other.getBoundingClientRect(); return rect.left < r.right + 6 && rect.right + 6 > r.left && rect.top < r.bottom + 6 && rect.bottom + 6 > r.top; }); pass++) {
        const horizontal = ['top', 'bottom'].includes(element.dataset.snapEdge);
        if (horizontal) {
            const nextLeft = rect.right + 8;
            element.style.left = `${nextLeft + rect.width <= innerWidth ? nextLeft : Math.max(0, rect.left - rect.width - 8)}px`;
            element.style.right = 'auto';
        } else {
            const nextTop = rect.bottom + 8;
            element.style.top = `${nextTop + rect.height <= innerHeight ? nextTop : Math.max(0, rect.top - rect.height - 8)}px`;
            element.style.bottom = 'auto';
        }
        rect = element.getBoundingClientRect();
    }
    updateBalloonPreviewSide(element);
}

function installChatDrag(element, handle, { configKey, memberNumber = null, isMaximized = () => false } = {}) {
    if (!element || !handle || !configKey) return;
    handle.addEventListener('pointerdown', event => {
        if ((event.target.closest('button') && handle !== element) || isMaximized()) return;
        const rect = element.getBoundingClientRect();
        const offsetX = event.clientX - rect.left;
        const offsetY = event.clientY - rect.top;
        let moved = false;
        const isBalloon = element.matches('#fcm-chat-balloon,.fcm-chat-user-balloon');
        const startX = event.clientX;
        const startY = event.clientY;
        let lastX = event.clientX;
        let lastY = event.clientY;
        if (isBalloon) element.classList.remove('released', 'release-water');
        handle.setPointerCapture(event.pointerId);
        const move = next => {
            if (isBalloon && !moved) {
                if (Math.hypot(next.clientX - startX, next.clientY - startY) < 6) return;
                moved = true;
                element.classList.add('dragging');
            } else if (!isBalloon) moved = true;
            const dx = next.clientX - lastX;
            const dy = next.clientY - lastY;
            lastX = next.clientX;
            lastY = next.clientY;
            const nextLeft = isBalloon ? next.clientX - element.offsetWidth / 2 : next.clientX - offsetX;
            const nextTop = isBalloon ? next.clientY + 20 : next.clientY - offsetY;
            element.style.left = `${Math.max(0, Math.min(innerWidth - element.offsetWidth, nextLeft))}px`;
            element.style.top = `${Math.max(0, Math.min(innerHeight - element.offsetHeight, nextTop))}px`;
            element.style.right = element.style.bottom = 'auto';
            if (isBalloon) {
                const speed = Math.min(0.22, Math.hypot(dx, dy) / 90);
                element.style.setProperty('--drag-angle', `${Math.max(-7, Math.min(7, dx * .3))}deg`);
                element.style.setProperty('--drag-stretch', `${1 + speed}`);
                element.style.setProperty('--drag-squash', `${1 - speed * .55}`);
                stirNearbyBalloons(element, dx, dy);
            } else element.style.transform = 'none';
            updateBalloonPreviewSide(element);
        };
        const up = next => {
            handle.removeEventListener('pointermove', move);
            handle.removeEventListener('pointerup', up);
            handle.removeEventListener('pointercancel', cancel);
            handle.removeEventListener('lostpointercapture', cancel);
            try { if (handle.hasPointerCapture(next.pointerId)) handle.releasePointerCapture(next.pointerId); } catch {}
            if (isBalloon && moved) {
                element.classList.remove('dragging');
                element.classList.add('released', 'release-water');
                element.style.removeProperty('--drag-angle');
                element.style.removeProperty('--drag-stretch');
                element.style.removeProperty('--drag-squash');
                settleStirredBalloons();
                setTimeout(() => element.classList.remove('release-water'), 150);
                setTimeout(() => element.classList.remove('released'), 540);
            }
            if (!moved) return;
            element.dataset.dragMoved = '1';
            setTimeout(() => { delete element.dataset.dragMoved; }, 0);
            if (cfg.balloonSnap) snapBalloonToNearestEdge(element);
            resolveBalloonCollision(element);
            const position = { x: element.offsetLeft, y: element.offsetTop };
            if (memberNumber) { cfg[configKey] ||= {}; cfg[configKey][memberNumber] = position; }
            else cfg[configKey] = position;
            saveCfg();
        };
        const cancel = next => up(next);
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', up);
        handle.addEventListener('pointercancel', cancel);
        handle.addEventListener('lostpointercapture', cancel);
    });
}

export { installChatDrag, resetBalloonInteraction, resolveBalloonCollision, updateBalloonPreviewSide };

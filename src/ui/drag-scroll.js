const installedScopes = new WeakMap();

function installDragScroll(scope, selector) {
    if (!(scope instanceof Element)) return;
    const existing = installedScopes.get(scope);
    if (existing) { existing.selectors.add(selector); return; }

    const state = { selectors: new Set([selector]), drag: null, suppressArea: null };
    installedScopes.set(scope, state);
    const findArea = target => {
        for (let node = target; node instanceof Element; node = node.parentElement) {
            if ([...state.selectors].some(value => value === ':scope' ? node === scope : node.matches(value))) return node;
            if (node === scope) break;
        }
        return null;
    };
    scope.addEventListener('pointerdown', event => {
        if (!event.isPrimary || event.button !== 0) return;
        const target = event.target instanceof Element ? event.target : null;
        const area = target && findArea(target);
        if (!area || (area.scrollHeight <= area.clientHeight + 1 && area.scrollWidth <= area.clientWidth + 1)) return;
        if (target.closest('input[type="range"],textarea,select,[contenteditable="true"]')) return;
        state.drag = {
            area, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
            startScrollLeft: area.scrollLeft, startScrollTop: area.scrollTop, dragging: false,
        };
    }, true);
    scope.addEventListener('pointermove', event => {
        const drag = state.drag;
        if (!drag || drag.pointerId !== event.pointerId) return;
        const dx = event.clientX - drag.startX;
        const dy = event.clientY - drag.startY;
        if (!drag.dragging) {
            if (Math.abs(dx) + Math.abs(dy) < 6) return;
            drag.dragging = true;
            drag.area.classList.add('drag-scrolling');
            try { drag.area.setPointerCapture(event.pointerId); } catch { /* detached during rerender */ }
        }
        event.preventDefault();
        drag.area.scrollLeft = drag.startScrollLeft - dx;
        drag.area.scrollTop = drag.startScrollTop - dy;
    }, { capture: true, passive: false });
    const finish = event => {
        const drag = state.drag;
        if (!drag || drag.pointerId !== event.pointerId) return;
        state.drag = null;
        drag.area.classList.remove('drag-scrolling');
        if (!drag.dragging) return;
        state.suppressArea = drag.area;
        window.setTimeout(() => { if (state.suppressArea === drag.area) state.suppressArea = null; }, 0);
    };
    scope.addEventListener('pointerup', finish, true);
    scope.addEventListener('pointercancel', finish, true);
    scope.addEventListener('click', event => {
        if (!state.suppressArea || !(event.target instanceof Node) || !state.suppressArea.contains(event.target)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        state.suppressArea = null;
    }, true);
}

export { installDragScroll };

// One active view per container. Replacing a view invalidates its async work first.
const views = new WeakMap();
export function disposePanelView(container) {
    const view = views.get(container);
    views.delete(container);
    view?.dispose?.();
}
export function beginPanelView(container, view = {}) {
    disposePanelView(container);
    views.set(container, view);
    return () => container.isConnected && views.get(container) === view;
}
export function updatePanelView(container) { return views.get(container)?.update?.() || false; }

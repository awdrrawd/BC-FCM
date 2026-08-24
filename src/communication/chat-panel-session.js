class ChatPanelSession {
    constructor() {
        this.size = null;
        this.observer = null;
    }

    inlineSizeStyle() {
        return this.size ? `width:${this.size.width}px;height:${this.size.height}px;` : '';
    }

    observe(panel, isMaximized) {
        this.observer?.disconnect();
        if (!panel || typeof ResizeObserver !== 'function') return;
        this.observer = new ResizeObserver(() => {
            if (isMaximized()) return;
            const rect = panel.getBoundingClientRect();
            if (rect?.width && rect?.height) this.size = { width: Math.round(rect.width), height: Math.round(rect.height) };
        });
        this.observer.observe(panel);
    }
}

const chatPanelSession = new ChatPanelSession();

export { chatPanelSession };

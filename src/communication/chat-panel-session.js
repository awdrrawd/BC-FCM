class ChatPanelSession {
    constructor() {
        this.size = null;
        this.observer = null;
        this.frame = 0;
    }

    inlineSizeStyle() {
        return this.size ? `width:${this.size.width}px;height:${this.size.height}px;` : '';
    }

    observe(panel, isMaximized) {
        this.observer?.disconnect();
        if (this.frame) cancelAnimationFrame(this.frame);
        this.frame = 0;
        if (!panel || typeof ResizeObserver !== 'function') return;
        this.observer = new ResizeObserver(entries => {
            if (isMaximized()) return;
            const entry = entries[entries.length - 1];
            const borderBox = entry?.borderBoxSize?.[0] || entry?.borderBoxSize;
            const width = borderBox?.inlineSize || entry?.contentRect?.width;
            const height = borderBox?.blockSize || entry?.contentRect?.height;
            if (!width || !height) return;
            if (this.frame) cancelAnimationFrame(this.frame);
            this.frame = requestAnimationFrame(() => {
                this.frame = 0;
                this.size = { width: Math.round(width), height: Math.round(height) };
            });
        });
        this.observer.observe(panel);
    }
}

const chatPanelSession = new ChatPanelSession();

export { chatPanelSession };

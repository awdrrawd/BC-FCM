import { ConversationViewport } from './chat-viewport.js';
import { mergeOlderMessages, normalizeConversationPage } from './chat-conversation-data.js';

class ChatConversationController {
    constructor(pageSize = 50, bottomThreshold = 40) {
        this.pageSize = pageSize;
        this.messages = [];
        this.hasMore = false;
        this.loading = false;
        this.unread = 0;
        this.viewport = new ConversationViewport(bottomThreshold);
    }

    reset() {
        this.messages = [];
        this.hasMore = false;
        this.loading = false;
        this.unread = 0;
        this.viewport.follow();
    }

    add(message) {
        if (this.messages.some(row => String(row.id) === String(message.id))) return false;
        this.messages.push(message);
        return true;
    }

    async load(store, memberNumber, isCurrent) {
        const target = Number(memberNumber);
        this.loading = true;
        try {
            const page = await store.page(target, { limit: this.pageSize });
            if (!isCurrent(target)) return false;
            this.messages = normalizeConversationPage(page.messages);
            this.hasMore = page.hasMore;
            this.unread = 0;
            this.viewport.follow();
            return true;
        } finally { this.loading = false; }
    }

    async loadOlder(store, memberNumber, isCurrent) {
        if (this.loading || !this.hasMore || !this.messages.length) return null;
        const target = Number(memberNumber);
        this.loading = true;
        try {
            const page = await store.page(target, { before: this.messages[0].timestamp, limit: this.pageSize });
            if (!isCurrent(target)) return null;
            if (!page.messages.length) {
                this.hasMore = false;
                return null;
            }
            this.messages = mergeOlderMessages(this.messages, page.messages);
            this.hasMore = page.hasMore;
            return this.messages;
        } finally { this.loading = false; }
    }
}

export { ChatConversationController };

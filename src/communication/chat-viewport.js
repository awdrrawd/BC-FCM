class ConversationViewport {
    constructor(threshold = 40) {
        this.threshold = threshold;
        this.followingLatest = true;
    }

    isNearBottom(element) {
        return !!element && element.scrollHeight - element.scrollTop - element.clientHeight <= this.threshold;
    }

    shouldFollow(element, direction) {
        return direction === 'out' || this.followingLatest || this.isNearBottom(element);
    }

    updateFromScroll(element) {
        this.followingLatest = this.isNearBottom(element);
        return this.followingLatest;
    }

    follow() {
        this.followingLatest = true;
    }

    leave() {
        this.followingLatest = false;
    }

    scrollToLatest(element) {
        if (!element) return;
        element.scrollTop = element.scrollHeight;
    }
}

export { ConversationViewport };

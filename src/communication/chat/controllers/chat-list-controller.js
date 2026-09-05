function createChatListController({ getRoot, renderListHtml, renderVisibleScrollHtml, isForwardTargetsActive, bindForwardTargets, bindListEvents, bindMemberRows, hydrateAvatars, installDragScroll }) {
    function refreshVisible() {
        if (isForwardTargetsActive()) return;
        const html = renderVisibleScrollHtml();
        const scroll = getRoot()?.querySelector('.fcm-chat-list .fcm-chat-scroll');
        if (html === null || !scroll) return;
        const scrollTop = scroll.scrollTop;
        scroll.innerHTML = html;
        scroll.scrollTop = scrollTop;
        bindMemberRows(scroll);
        hydrateAvatars();
    }

    function refresh({ preserveScroll = false } = {}) {
        const list = getRoot()?.querySelector('.fcm-chat-list');
        if (!list) return;
        const scrollTop = preserveScroll ? list.querySelector('.fcm-chat-scroll')?.scrollTop || 0 : 0;
        list.innerHTML = renderListHtml();
        if (isForwardTargetsActive()) bindForwardTargets();
        else bindListEvents(list);
        hydrateAvatars();
        installDragScroll(list, '.fcm-chat-scroll');
        if (preserveScroll) {
            const scroll = list.querySelector('.fcm-chat-scroll');
            if (scroll) scroll.scrollTop = scrollTop;
        }
    }

    return { refresh, refreshVisible };
}

export { createChatListController };

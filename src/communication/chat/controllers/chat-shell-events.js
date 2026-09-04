function createChatShellEvents({ getRoot, panelControls, setActiveView, resetSelection, setStackedDetail, rerender, bindListNavigation, bindConversation, bindForwardTargets, setStatus, bindSettings, bindProfile }) {
    function bind() {
        const root = getRoot();
        const panel = root?.querySelector('#fcm-chat-panel');
        if (!panel) return;
        panelControls.bind(panel);
        root.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
            setActiveView(button.dataset.view);
            resetSelection();
            setStackedDetail(false);
            rerender();
        }));
        bindListNavigation(root);
        bindConversation();
        bindForwardTargets();
        panel.addEventListener('click', event => {
            if (!event.target.closest('.fcm-chat-message')) panel.querySelectorAll('.fcm-chat-message.selected').forEach(element => element.classList.remove('selected'));
        });
        root.querySelector('[data-status]')?.addEventListener('click', () => root.querySelector('.fcm-chat-status-menu')?.classList.toggle('open'));
        root.querySelectorAll('[data-status-value]').forEach(button => button.addEventListener('click', () => setStatus(button.dataset.statusValue)));
        bindSettings();
        bindProfile();
    }

    return { bind };
}

export { createChatShellEvents };

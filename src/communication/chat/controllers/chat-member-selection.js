function createChatMemberSelection({ getRoot, getMemberNumber, setMemberNumber, resetSelection, clearReply, closeContactCard, setStackedDetail, chatStore, setMessageIndex, loadConversation, refreshList, refreshBadges, getLayout, refreshConversation, isPinned = () => false, togglePin = () => {}, text = key => key }) {
    let justOpenedMember = null;
    let clearTimer = 0;

    function getJustOpenedMember() {
        return justOpenedMember;
    }

    async function select(memberNumber) {
        const target = Number(memberNumber);
        if (!target) return;
        setMemberNumber(target);
        resetSelection();
        clearReply({ focus: false });
        closeContactCard();
        justOpenedMember = target;
        setStackedDetail(true);
        await chatStore.markRead(target);
        if (Number(getMemberNumber()) !== target) return;
        const messageIndex = await chatStore.recentIndex();
        if (Number(getMemberNumber()) !== target) return;
        setMessageIndex(messageIndex);
        refreshList();
        refreshBadges();
        await loadConversation(target);
        if (Number(getMemberNumber()) !== target) return;
        const root = getRoot();
        const stacked = getLayout() === 'stacked';
        root?.querySelector('.fcm-chat-list')?.classList.toggle('slide-out', stacked);
        root?.querySelector('.fcm-chat-main')?.classList.toggle('slide-in', stacked);
        refreshConversation();
        clearTimeout(clearTimer);
        clearTimer = window.setTimeout(() => {
            if (justOpenedMember === target) justOpenedMember = null;
        }, 350);
    }

    let menuTarget = null;
    let outsideBound = false;
    let suppressClickUntil = 0;

    function menuElement() {
        return getRoot()?.querySelector('.fcm-chat-member-menu') || null;
    }

    function hideMenu() {
        const menu = menuElement();
        if (menu) menu.hidden = true;
        menuTarget = null;
    }

    function showMenu(memberNumber, clientX, clientY) {
        const menu = menuElement(), panel = getRoot()?.querySelector('#fcm-chat-panel');
        if (!menu || !panel) return;
        menuTarget = Number(memberNumber);
        menu.querySelector('[data-member-pin]').textContent = text(isPinned(menuTarget) ? 'chatUnpin' : 'chatPin');
        menu.hidden = false;
        const rect = panel.getBoundingClientRect();
        menu.style.left = `${Math.max(8, Math.min(clientX - rect.left, rect.width - menu.offsetWidth - 8))}px`;
        menu.style.top = `${Math.max(8, Math.min(clientY - rect.top, rect.height - menu.offsetHeight - 8))}px`;
        if (!outsideBound) {
            outsideBound = true;
            document.addEventListener('pointerdown', event => { if (!event.target.closest?.('.fcm-chat-member-menu')) hideMenu(); }, true);
        }
        const pin = menu.querySelector('[data-member-pin]');
        menu.querySelector('[data-member-open]').onclick = () => { const target = menuTarget; hideMenu(); if (target) select(target); };
        pin.onclick = () => { const target = menuTarget; hideMenu(); if (target) { togglePin(target); refreshList(); } };
        menu.querySelector('[data-member-cancel]').onclick = hideMenu;
    }

    function bind(scope = getRoot()) {
        scope?.querySelectorAll('[data-member]').forEach(button => {
            button.addEventListener('click', event => {
                if (Date.now() < suppressClickUntil) { event.preventDefault(); return; }
                select(button.dataset.member);
            });
            button.addEventListener('contextmenu', event => {
                event.preventDefault();
                showMenu(button.dataset.member, event.clientX, event.clientY);
            });
            // iOS Safari has no contextmenu on long press, so mirror it with a touch timer.
            let holdTimer = 0, startX = 0, startY = 0;
            const cancelHold = () => { clearTimeout(holdTimer); holdTimer = 0; };
            button.addEventListener('touchstart', event => {
                const touch = event.touches[0];
                if (!touch || event.touches.length > 1) return;
                startX = touch.clientX; startY = touch.clientY;
                holdTimer = window.setTimeout(() => { suppressClickUntil = Date.now() + 700; showMenu(button.dataset.member, startX, startY); }, 550);
            }, { passive: true });
            button.addEventListener('touchmove', event => {
                const touch = event.touches[0];
                if (touch && Math.hypot(touch.clientX - startX, touch.clientY - startY) > 8) cancelHold();
            }, { passive: true });
            button.addEventListener('touchend', cancelHold);
            button.addEventListener('touchcancel', cancelHold);
        });
    }

    return { bind, getJustOpenedMember, select };
}

export { createChatMemberSelection };

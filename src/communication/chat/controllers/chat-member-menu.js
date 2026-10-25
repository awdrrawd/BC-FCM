// Right-click / long-press menu for the member rows in the CHAT list.
// Items: chat, pin/unpin, assign to group (inline list), go to room, cancel.
const ROOM_POLL_MS = 600;
const ROOM_POLL_TRIES = 8;

function createChatMemberMenu({
    getRoot, text, isPinned, togglePin, openChat, getGroups, getMemberGroups, toggleGroup, createGroup,
    getRoomAccess, requestRoomName, goToRoom, refreshList,
}) {
    let target = null;
    let outsideBound = false;
    let pollTimer = 0;

    const menu = () => getRoot()?.querySelector('.fcm-chat-member-menu') || null;
    const q = (selector) => menu()?.querySelector(selector) || null;

    function stopPoll() {
        clearTimeout(pollTimer);
        pollTimer = 0;
    }

    function hide() {
        stopPoll();
        const element = menu();
        if (element) element.hidden = true;
        q('[data-member-groups]')?.setAttribute('hidden', '');
        target = null;
    }

    function paintRoom(loading) {
        const button = q('[data-member-room]');
        if (!button || target === null) return true;
        const access = getRoomAccess(target);
        button.hidden = !!access.hideRoom;
        button.disabled = !access.canOpenRoom;
        button.textContent = text(!access.canOpenRoom && loading ? 'chatGoRoomLoading' : 'chatGoRoom');
        button.title = access.canOpenRoom || loading ? '' : text('chatGoRoomUnknown');
        return access.canOpenRoom || access.hideRoom;
    }

    // The room name is only known after the server reports online friends, so ask for it in the
    // background and enable "go to room" as soon as it arrives.
    function pollRoomName(member, tries = ROOM_POLL_TRIES) {
        stopPoll();
        if (target !== member) return;
        if (paintRoom(tries > 0)) return;
        if (tries <= 0) return;
        pollTimer = window.setTimeout(() => pollRoomName(member, tries - 1), ROOM_POLL_MS);
    }

    function paintGroups() {
        const box = q('[data-member-groups]');
        if (!box || target === null) return;
        const assigned = new Set(getMemberGroups(target));
        const esc = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
        box.innerHTML = getGroups().map(([id, label]) => `<button data-member-group="${esc(id)}">${assigned.has(id) ? '✓ ' : ''}${esc(label)}</button>`).join('')
            + `<button data-member-group-new>＋ ${esc(text('chatNewGroup'))}</button>`;
        box.querySelectorAll('[data-member-group]').forEach(button => { button.onclick = () => { const member = target; hide(); if (member) { toggleGroup(member, button.dataset.memberGroup); refreshList(); } }; });
        box.querySelector('[data-member-group-new]').onclick = async () => {
            const member = target;
            hide();
            const id = member ? await createGroup() : '';
            if (id) { toggleGroup(member, id, true); refreshList(); }
        };
    }

    function show(memberNumber, clientX, clientY) {
        const element = menu(), panel = getRoot()?.querySelector('#fcm-chat-panel');
        if (!element || !panel) return;
        stopPoll();
        target = Number(memberNumber);
        const member = target;
        q('[data-member-pin]').textContent = text(isPinned(member) ? 'chatUnpin' : 'chatPin');
        q('[data-member-groups]')?.setAttribute('hidden', '');
        element.hidden = false;
        const rect = panel.getBoundingClientRect();
        element.style.left = `${Math.max(8, Math.min(clientX - rect.left, rect.width - element.offsetWidth - 8))}px`;
        element.style.top = `${Math.max(8, Math.min(clientY - rect.top, rect.height - element.offsetHeight - 8))}px`;
        if (!outsideBound) {
            outsideBound = true;
            document.addEventListener('pointerdown', event => { if (!event.target.closest?.('.fcm-chat-member-menu')) hide(); }, true);
        }
        q('[data-member-open]').onclick = () => { hide(); openChat(member); };
        q('[data-member-pin]').onclick = () => { hide(); togglePin(member); refreshList(); };
        q('[data-member-group-toggle]').onclick = () => {
            const box = q('[data-member-groups]');
            if (!box) return;
            if (box.hidden) paintGroups();
            box.hidden = !box.hidden;
        };
        q('[data-member-room]').onclick = () => { hide(); goToRoom(member); };
        q('[data-member-cancel]').onclick = hide;
        if (!paintRoom(false)) {
            requestRoomName(member);
            pollRoomName(member);
        }
    }

    return { hide, show };
}

export { createChatMemberMenu };

import { T } from '../i18n/i18n.js';
import { amAdmin, getDisplayName } from '../data/data.js';
import { makeAvEl } from './panel-widgets.js';
import { CROWN_ICON } from '../ui/icons.js';
import { beginPanelView, disposePanelView } from './panel-lifecycle.js';

let mode = 'swap';
const readOrder = () => (globalThis.ChatRoomCharacter || []).map(c => c.MemberNumber);
const sameOrder = (a, b) => a.length === b.length && a.every((member, i) => member === b[i]);

// Preview and drop share one rule. BC's arrays remain server-authoritative.
function reordered(order, source, target, method) {
    const result = [...order], from = order.indexOf(source), to = order.indexOf(target);
    if (from < 0 || to < 0 || from === to) return result;
    if (method === 'swap') [result[from], result[to]] = [result[to], result[from]];
    else if (method === 'insert') { result.splice(from, 1); result.splice(to, 0, source); }
    return result;
}

// BC's native admin protocol; request silent movement with Publish=false.
function orderCommands(order, source, target, method, playerId) {
    const from = order.indexOf(source), to = order.indexOf(target);
    if (from < 0 || to < 0 || from === to) return [];
    if (method === 'swap') return [{ MemberNumber: playerId, TargetMemberNumber: source, DestinationMemberNumber: target, Action: 'Swap', Publish: false }];
    if (method !== 'insert') return [];
    return Array.from({ length: Math.abs(from - to) }, () => ({
        MemberNumber: source, Action: from > to ? 'MoveLeft' : 'MoveRight', Publish: false,
    }));
}


function renderRoomOrder(container) {
    disposePanelView(container);
    let order = readOrder(), displayed = order;
    const room = globalThis.ChatRoomData, allowed = amAdmin();
    const section = document.createElement('section'); section.className = 'fcm-room-order';
    const toolbar = document.createElement('div'); toolbar.className = 'fcm-toolbar';
    const label = document.createElement('label'); label.textContent = T('roomOrderMode');
    const select = document.createElement('select'); select.className = 'fcm-sel'; select.disabled = !allowed;
    for (const value of ['swap', 'insert']) {
        const option = document.createElement('option'); option.value = value; option.textContent = T('roomOrder_' + value); select.append(option);
    }
    select.value = mode; select.onchange = () => { cancelDrag(); mode = select.value; };
    label.append(select); toolbar.append(label); section.append(toolbar);
    const refresh = document.createElement('button'); refresh.type = 'button'; refresh.className = 'fcm-btn fcm-btn-round'; refresh.textContent = '↻';
    refresh.onclick = reload; toolbar.append(refresh);
    const status = document.createElement('p'); status.setAttribute('role', 'status'); section.append(status);
    const board = document.createElement('div'); board.className = 'fcm-order-board'; section.append(board);
    let selected = null, drag = null, pending = null, pendingTimer = null, suppressNextClick = false;
    const cards = new Map(), slots = [];
    let disposed = false;

    function reload() { dispose(); section.remove(); renderRoomOrder(container); }

    function clearSelection() {
        selected = null;
        for (const { card } of cards.values()) { card.classList.remove('selected'); card.setAttribute('aria-pressed', 'false'); }
    }
    function paint(next) {
        displayed = next;
        const rects = slots.map(slot => slot.getBoundingClientRect());
        next.forEach((member, index) => {
            const { card, position, name, origin } = cards.get(member);
            const from = rects[origin], to = rects[index], displayName = getDisplayName(member);
            card.style.transform = `translate(${to.left - from.left}px,${to.top - from.top}px)`;
            card.style.width = `${to.width}px`;
            position.textContent = String(index + 1);
            name.textContent = displayName;
            card.title = `${index + 1}. ${displayName} (${member})`;
        });
    }
    function setPending(value) {
        pending = value; select.disabled = !allowed || !!value;
        for (const { card } of cards.values()) card.disabled = !allowed || !!value;
        clearTimeout(pendingTimer); pendingTimer = null;
    }
    function endDrag() {
        const old = drag; drag = null;
        old?.ghost?.remove();
        if (old) cards.get(old.source)?.card.classList.remove('drag-source');
        if (old && board.hasPointerCapture(old.id)) board.releasePointerCapture(old.id);
        clearSelection();
    }
    function cancelDrag() { endDrag(); if (section.isConnected) paint(pending || order); }
    function sync() {
        if (disposed || !section.isConnected || globalThis.ChatRoomData !== room || amAdmin() !== allowed) return false;
        const current = readOrder();
        if (current.length !== order.length || current.some(member => !cards.has(member))) return false;
        // Multi-step insert acknowledgements must not flash intermediate positions.
        if (pending && !sameOrder(current, pending)) return true;
        if (pending) { setPending(null); status.textContent = ''; }
        if (!sameOrder(current, order)) { order = current; endDrag(); }
        if (!drag) paint(order);
        return true;
    }
    function submit(source, target) {
        if (disposed || pending || !section.isConnected || !amAdmin()) return;
        const current = readOrder();
        if (globalThis.ChatRoomData !== room || !sameOrder(current, order)) { paint(order); clearSelection(); status.textContent = T('roomOrderChanged'); return; }
        const commands = orderCommands(order, source, target, mode, globalThis.Player?.ID);
        if (!commands.length) { paint(order); return; }
        clearSelection(); setPending(reordered(order, source, target, mode)); paint(pending);
        status.textContent = T('roomOrderWaiting');
        // One bounded timeout reconciles rejection/lost acknowledgement, not polling.
        pendingTimer = setTimeout(() => {
            if (disposed || !section.isConnected) return;
            const acknowledged = sameOrder(readOrder(), pending);
            setPending(null);
            if (!sync()) reload();
            else status.textContent = acknowledged ? '' : T('roomOrderChanged');
        }, 3000);
        try { for (const command of commands) globalThis.ServerSend('ChatRoomAdmin', command); }
        catch { setPending(null); if (!sync()) reload(); else status.textContent = T('roomOrderFailed'); }
    }

    for (let base = 0; base < Math.max(20, order.length); base += 10) {
        const group = document.createElement('div'); group.className = 'fcm-order-group'; board.append(group);
        for (let index = base; index < base + 10; index++) {
            const slot = document.createElement('div'); slot.className = 'fcm-order-slot'; slots.push(slot); group.append(slot);
            const member = order[index];
            const card = document.createElement('button'); card.type = 'button'; card.className = 'fcm-order-card';
            card.disabled = !allowed || member === undefined;
            const position = document.createElement('strong'); position.textContent = String(index + 1); card.append(position);
            if (member !== undefined) {
                card.dataset.orderMember = String(member); card.setAttribute('aria-pressed', 'false');
                const avatar = document.createElement('div'); avatar.className = 'fcm-order-avatar'; avatar.append(makeAvEl(member));
                if (member === globalThis.Player?.MemberNumber) {
                    const crown = document.createElement('span'); crown.className = 'fcm-order-crown'; crown.innerHTML = CROWN_ICON;
                    crown.setAttribute('aria-hidden', 'true'); avatar.append(crown);
                }
                card.append(avatar);
                const text = document.createElement('span'); text.textContent = getDisplayName(member); card.append(text);
                const id = document.createElement('small'); id.textContent = `#${member}`; card.append(id);
                cards.set(member, { card, position, name: text, origin: index });
                card.onclick = () => {
                    if (pending || !amAdmin()) return;
                    if (selected === null) { selected = member; card.classList.add('selected'); card.setAttribute('aria-pressed', 'true'); }
                    else if (selected === member) clearSelection();
                    else submit(selected, member);
                };
            } else { card.classList.add('empty'); const text = document.createElement('span'); text.textContent = '—'; card.append(text); }
            slot.append(card);
        }
    }
    // Hit-test fixed slots rather than animated cards to avoid oscillating previews.
    function targetAt(event) {
        const index = slots.findIndex(slot => {
            const rect = slot.getBoundingClientRect();
            return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
        });
        return order[index] ?? null;
    }
    board.addEventListener('pointerdown', event => {
        const card = event.target.closest('[data-order-member]');
        if (!card || card.disabled || !event.isPrimary || event.button !== 0 || drag) return;
        suppressNextClick = false;
        drag = { id: event.pointerId, source: Number(card.dataset.orderMember), x: event.clientX, y: event.clientY, moved: false };
        card.setPointerCapture(event.pointerId);
    });
    board.addEventListener('pointermove', event => {
        if (!drag || drag.id !== event.pointerId) return;
        if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 6 && !drag.moved) return;
        event.preventDefault();
        if (!drag.moved) {
            drag.moved = true; clearSelection();
            const { card } = cards.get(drag.source), rect = card.getBoundingClientRect();
            drag.offsetX = drag.x - rect.left; drag.offsetY = drag.y - rect.top;
            const ghost = card.cloneNode(true); ghost.classList.add('drag-ghost'); ghost.removeAttribute('data-order-member');
            ghost.setAttribute('aria-hidden', 'true'); ghost.tabIndex = -1;
            ghost.style.width = `${rect.width}px`; ghost.style.height = `${rect.height}px`; ghost.style.transform = 'none';
            section.append(ghost); drag.ghost = ghost;
            card.classList.add('drag-source'); board.setPointerCapture(event.pointerId);
        }
        const rect = section.getBoundingClientRect();
        drag.ghost.style.left = `${event.clientX - rect.left + section.scrollLeft - drag.offsetX}px`;
        drag.ghost.style.top = `${event.clientY - rect.top + section.scrollTop - drag.offsetY}px`;
        const target = targetAt(event);
        paint(target === null ? order : reordered(order, drag.source, target, mode));
    });
    board.addEventListener('pointerup', event => {
        if (!drag || drag.id !== event.pointerId) return;
        const done = drag, target = targetAt(event);
        if (!done.moved) { drag = null; return; }
        suppressNextClick = true; endDrag();
        if (target !== null) submit(done.source, target); else paint(order);
    });
    board.addEventListener('click', event => {
        if (suppressNextClick && event.detail !== 0) { suppressNextClick = false; event.preventDefault(); event.stopImmediatePropagation(); }
    }, true);
    board.addEventListener('pointercancel', cancelDrag);
    board.addEventListener('lostpointercapture', event => { if (event.target === board && drag?.id === event.pointerId) cancelDrag(); });
    board.addEventListener('keydown', event => { event.stopPropagation(); if (event.key === 'Escape') { suppressNextClick = true; cancelDrag(); } });
    const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { if (!disposed && section.isConnected) paint(displayed); }) : null;
    function dispose() {
        if (disposed) return;
        disposed = true;
        clearTimeout(pendingTimer); resize?.disconnect(); endDrag();
    }
    container.append(section); paint(order); resize?.observe(board);
    beginPanelView(container, { update: sync, dispose });
}

export { renderRoomOrder, orderCommands, reordered };

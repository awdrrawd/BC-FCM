import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const hooks = registerHooks({ load(url, context, next) {
    const source = url.endsWith('/i18n/i18n.js') ? 'export const T = key => key;'
        : url.endsWith('/ui/icons.js') ? 'export const CROWN_ICON = "<svg></svg>";'
        : url.endsWith('/data/data.js') ? 'export const amAdmin = () => globalThis.allowed; export const getDisplayName = String;'
        : url.endsWith('/panel/panel-widgets.js') ? 'export const makeAvEl = () => document.createElement("div");' : null;
    return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });
const { orderCommands, renderRoomOrder, updateRoomOrder, disposeRoomOrder, reordered } = await import('../src/panel/panel-room-order.js');
hooks.deregister();

function applyCommands(order, commands) {
    const result = [...order];
    for (const command of commands) {
        const from = result.indexOf(command.Action === 'Swap' ? command.TargetMemberNumber : command.MemberNumber);
        const to = command.Action === 'Swap' ? result.indexOf(command.DestinationMemberNumber) : from + (command.Action === 'MoveLeft' ? -1 : 1);
        [result[from], result[to]] = [result[to], result[from]];
    }
    return result;
}
test('native insertion shifts only intervening players; swap exchanges endpoints', () => {
    const order = Array.from({ length: 11 }, (_, i) => i + 1);
    const left = orderCommands(order, 10, 2, 'insert', 0);
    assert.deepEqual(applyCommands(order, left), [1, 10, 2, 3, 4, 5, 6, 7, 8, 9, 11]);
    assert.equal(left.length, 8);
    assert.ok(left.every(c => c.Publish === false));
    assert.deepEqual(reordered(order, 10, 2, 'insert'), applyCommands(order, left));
    assert.deepEqual(applyCommands(order, orderCommands(order, 2, 10, 'insert', 0)), [1, 3, 4, 5, 6, 7, 8, 9, 10, 2, 11]);
    const swap = orderCommands(order, 10, 2, 'swap', 0);
    assert.deepEqual(swap, [{ MemberNumber: 0, TargetMemberNumber: 10, DestinationMemberNumber: 2, Action: 'Swap', Publish: false }]);
    assert.deepEqual(applyCommands(order, swap), [1, 10, 3, 4, 5, 6, 7, 8, 9, 2, 11]);
    for (const args of [[2, 2, 'swap'], [12, 2, 'insert'], [2, 12, 'swap'], [1, 2, 'invalid']]) assert.deepEqual(orderCommands(order, ...args, 0), []);
    assert.deepEqual(order, Array.from({ length: 11 }, (_, i) => i + 1));
});

class Element {
    children = []; dataset = {}; attributes = {}; listeners = {}; parent = null; className = ''; style = {}; scrollLeft = 0; scrollTop = 0;
    classes = new Set();
    classList = { add: (...values) => values.forEach(v => this.classes.add(v)), remove: (...values) => values.forEach(v => this.classes.delete(v)) };
    get firstElementChild() { return this.children[0]; }
    get isConnected() { return this.root || !!this.parent?.isConnected; }
    append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
    setAttribute(key, value) { this.attributes[key] = value; }
    removeAttribute(key) { delete this.attributes[key]; }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(c => c !== this); this.parent = null; }
    cloneNode() { const copy = new Element(); copy.className = this.className; return copy; }
    getBoundingClientRect() {
        if (this.className === 'fcm-order-slot') {
            const index = this.parent.children.indexOf(this), group = this.parent.parent.children.indexOf(this.parent);
            const left = group * 520 + index % 5 * 100, top = Math.floor(index / 5) * 140;
            return { left, top, right: left + 90, bottom: top + 128, width: 90, height: 128 };
        }
        return this.parent?.getBoundingClientRect() || { left: 0, top: 0, width: 1000, height: 600 };
    }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    removeEventListener(name) { delete this.listeners[name]; }
    setPointerCapture() {}
    hasPointerCapture() { return false; }
    contains(node) { return node === this || this.children.some(child => child.contains(node)); }
    closest() { return this.dataset.orderMember ? this : this.parent?.closest(); }
    click() { if (!this.disabled) this.onclick?.(); }
}
function boardFixture(allowed = true) {
    const sent = [];
    const timers = new Map(); let timer = 0;
    globalThis.setTimeout = fn => { timers.set(++timer, fn); return timer; };
    globalThis.clearTimeout = id => timers.delete(id);
    globalThis.allowed = allowed;
    globalThis.ChatRoomData = {};
    globalThis.ChatRoomCharacter = Array.from({ length: 11 }, (_, i) => ({ MemberNumber: i + 1 }));
    globalThis.Player = { ID: 0, MemberNumber: 10 };
    globalThis.ServerSend = (type, packet) => sent.push({ type, packet });
    globalThis.document = { createElement: () => new Element() };
    const root = new Element(); root.root = true;
    renderRoomOrder(root);
    const section = root.children[0], board = section.children.at(-1);
    const cards = board.children.flatMap(group => group.children.map(slot => slot.firstElementChild));
    const select = section.children[0].children[0].children[0];
    select.value = 'swap'; select.onchange();
    return { sent, cards, section, board, select, root, timers };
}
test('20 positions form two sequential ten-player groups; empty and non-admin cards are disabled', () => {
    const { board, cards } = boardFixture();
    assert.deepEqual(board.children.map(group => group.children.map(slot => Number(slot.firstElementChild.firstElementChild.textContent))),
        [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]]);
    assert.equal(cards.filter(c => c.disabled).length, 9);
    const denied = boardFixture(false);
    assert.ok(denied.select.disabled);
    assert.ok(denied.cards.every(c => c.disabled));
    denied.cards[0].click(); denied.cards[1].click();
    assert.equal(denied.sent.length, 0);
});
test('order toolbar uses the standard round button, has no hint and crowns only self', () => {
    const { cards, section } = boardFixture();
    assert.equal(section.children[0].children[1].className, 'fcm-btn fcm-btn-round');
    assert.ok(section.children.every(child => child.className !== 'fcm-order-hint'));
    const crowns = cards.slice(0, 11).map(card => card.children[1].children.filter(child => child.className === 'fcm-order-crown').length);
    assert.deepEqual(crowns, [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0]);
});
test('click reorder waits for server; duplicate, revoked, stale and detached submissions are blocked', () => {
    const f = boardFixture();
    f.cards[9].click(); f.cards[1].click(); f.cards[0].click(); f.cards[2].click();
    assert.equal(f.sent.length, 1);
    assert.equal(f.sent[0].type, 'ChatRoomAdmin');
    assert.equal(globalThis.ChatRoomCharacter[9].MemberNumber, 10);
    for (const invalidate of [() => { globalThis.allowed = false; }, () => { globalThis.ChatRoomCharacter.reverse(); },
        () => { globalThis.ChatRoomData = {}; }, section => { section.parent.root = false; }]) {
        const fixture = boardFixture(); fixture.cards[0].click(); invalidate(fixture.section); fixture.cards[1].click();
        assert.equal(fixture.sent.length, 0);
    }
});
test('pointer drag previews insertion, shows a ghost and commits the same order immediately', () => {
    const { sent, cards, board, select } = boardFixture();
    select.value = 'insert'; select.onchange();
    document.elementFromPoint = () => cards[1];
    const event = { target: cards[9], isPrimary: true, button: 0, pointerId: 1, clientX: 450, clientY: 150, preventDefault() {} };
    board.listeners.pointerdown(event);
    board.listeners.pointermove({ ...event, clientX: 150, clientY: 10 });
    assert.ok(cards[9].classes.has('drag-source'));
    assert.equal(cards[9].firstElementChild.textContent, '2');
    assert.equal(cards[1].firstElementChild.textContent, '3');
    assert.equal(cards[10].firstElementChild.textContent, '11');
    assert.equal(sent.length, 0);
    board.listeners.pointerup({ ...event, clientX: 150, clientY: 10 });
    assert.ok(!cards[9].classes.has('drag-source'));
    assert.equal(cards[9].firstElementChild.textContent, '2');
    assert.equal(sent.length, 8);
    assert.ok(sent.every(c => c.packet.Action === 'MoveLeft'));
});

test('all preview destinations match the native commands', () => {
    const order = Array.from({ length: 20 }, (_, i) => i + 1);
    for (const method of ['swap', 'insert']) for (const from of order) for (const to of order) {
        assert.deepEqual(reordered(order, from, to, method), applyCommands(order, orderCommands(order, from, to, method, 0)));
    }
});
test('intermediate acknowledgements keep the preview; final sync updates existing cards and unlocks', () => {
    const f = boardFixture(); f.select.value = 'insert'; f.select.onchange();
    f.cards[9].click(); f.cards[1].click();
    const expected = reordered(readMembers(), 10, 2, 'insert');
    globalThis.ChatRoomCharacter = applyCommands(readMembers(), [f.sent[0].packet]).map(MemberNumber => ({ MemberNumber }));
    assert.equal(updateRoomOrder(f.root), true);
    assert.equal(f.cards[9].firstElementChild.textContent, '2');
    assert.ok(f.cards[9].disabled);
    globalThis.ChatRoomCharacter = expected.map(MemberNumber => ({ MemberNumber }));
    assert.equal(updateRoomOrder(f.root), true);
    assert.equal(f.root.children[0], f.section);
    assert.equal(f.cards[9].disabled, false);
    assert.equal(f.timers.size, 0);
});
const readMembers = () => globalThis.ChatRoomCharacter.map(c => c.MemberNumber);
test('explicit disposal cancels acknowledgement timer and unregisters the view', () => {
    const f = boardFixture(); f.cards[0].click(); f.cards[1].click();
    assert.equal(f.timers.size, 1);
    disposeRoomOrder(f.root); disposeRoomOrder(f.root);
    assert.equal(f.timers.size, 0);
    assert.equal(updateRoomOrder(f.root), false);
});
test('explicit disposal removes the drag ghost before the section is detached', () => {
    const f = boardFixture();
    const event = { target: f.cards[9], isPrimary: true, button: 0, pointerId: 1, clientX: 450, clientY: 150, preventDefault() {} };
    f.board.listeners.pointerdown(event);
    f.board.listeners.pointermove({ ...event, clientX: 150, clientY: 10 });
    disposeRoomOrder(f.root);
    assert.equal(f.section.children.length, 3);
    assert.ok(!f.cards[9].classes.has('drag-source'));
    assert.equal(f.sent.length, 0);
});
test('rejected move rolls back on timeout; Escape and outside drop cancel without sending', () => {
    const f = boardFixture(); f.cards[9].click(); f.cards[1].click();
    assert.equal(f.cards[9].firstElementChild.textContent, '2');
    [...f.timers.values()][0]();
    assert.equal(f.cards[9].firstElementChild.textContent, '10');
    assert.equal(f.cards[9].disabled, false);
    for (const cancel of ['escape', 'outside']) {
        const g = boardFixture();
        const event = { target: g.cards[9], isPrimary: true, button: 0, pointerId: 1, clientX: 450, clientY: 150, preventDefault() {} };
        g.board.listeners.pointerdown(event);
        g.board.listeners.pointermove({ ...event, clientX: 150, clientY: 10 });
        assert.equal(g.section.children.length, 4);
        if (cancel === 'escape') g.board.listeners.keydown({ key: 'Escape', stopPropagation() {} });
        else g.board.listeners.pointerup({ ...event, clientX: -100 });
        assert.equal(g.sent.length, 0);
        assert.equal(g.cards[9].firstElementChild.textContent, '10');
        assert.equal(g.section.children.length, 3);
    }
});

// Exercise the coordinator's actual refresh policy without loading the game's UI graph.
const panelSource = readFileSync(new URL('../src/panel/panel.js', import.meta.url), 'utf8');
const policy = panelSource.slice(panelSource.indexOf('    let eventRefresh'), panelSource.indexOf('    // ═', panelSource.indexOf('    let eventRefresh')));
function refreshFixture(tab) {
    const timers = new Map(); let timer = 0;
    const ctx = vm.createContext({ uiTab: tab, panelOpen: true, panelMini: false, renders: 0,
        panelEl: null, updateRoomOrder: () => false,
        onlineFriends: [{ MemberNumber: 1 }], buildFriendList: () => [{ mn: 1 }, { mn: 2 }], inRoomFn: () => false,
        ChatRoomData: { Name: 'room', Admin: [1] }, ChatRoomCharacter: [{ MemberNumber: 1, Name: 'Alice' }],
        setTimeout: fn => { timers.set(++timer, fn); return timer; }, clearTimeout: id => timers.delete(id) });
    vm.runInContext(policy + '\nfunction renderCurrent() { renders++; renderedState = panelState(); } renderedState = panelState();', ctx);
    return { ctx, timers, notify: kind => vm.runInContext(`notifyPanelChange(${JSON.stringify(kind)})`, ctx),
        flush() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn()); } };
}
test('identical presence and appearance updates do not redraw; room changes coalesce', () => {
    const f = refreshFixture('room');
    f.notify('presence'); f.notify('room');
    f.ctx.ChatRoomCharacter[0].Appearance = [{ Asset: {} }]; f.notify('room');
    assert.equal(f.timers.size, 0);
    f.ctx.ChatRoomCharacter.push({ MemberNumber: 2 }); f.notify('room');
    f.ctx.ChatRoomData.Admin = [2]; f.notify('room');
    f.ctx.ChatRoomCharacter.reverse(); f.notify('room');
    assert.equal(f.timers.size, 1); f.flush(); assert.equal(f.ctx.renders, 1);
    f.notify('room'); assert.equal(f.timers.size, 0);
});
test('friends redraw only on relevant presence changes; query pages ignore background events', () => {
    const f = refreshFixture('friends');
    f.notify('presence'); f.ctx.onlineFriends.push({ MemberNumber: 99 }); f.notify('presence');
    assert.equal(f.timers.size, 0);
    f.ctx.onlineFriends = []; f.notify('presence'); f.flush(); assert.equal(f.ctx.renders, 1);
    f.notify('relations'); f.flush(); assert.equal(f.ctx.renders, 2);
    for (const tab of ['roomSearch', 'people']) {
        const page = refreshFixture(tab);
        for (const kind of ['room', 'presence', 'relations']) page.notify(kind);
        assert.equal(page.timers.size, 0);
    }
    f.notify('relations'); f.ctx.uiTab = 'people'; f.flush(); assert.equal(f.ctx.renders, 2);
    f.ctx.uiTab = 'friends'; f.ctx.panelMini = true; f.notify('relations'); assert.equal(f.timers.size, 0);
});

test('leaving people search during database initialization cannot append stale UI', async () => {
    const source = readFileSync(new URL('../src/panel/panel-people.js', import.meta.url), 'utf8')
        .replace(/^import .*;\r?$/gm, '').replace(/^export .*;\r?$/gm, '');
    for (const ready of [true, false]) {
        let resolve;
        const ctx = vm.createContext({ PDB: { init: () => new Promise(done => { resolve = done; }) },
            getRenderToken: () => 2,
            document: { createElement() { assert.fail('stale render touched the DOM'); } } });
        vm.runInContext(source, ctx);
        const pending = ctx.renderPeople({ isConnected: true }, 1);
        resolve(ready);
        await pending;
    }
});

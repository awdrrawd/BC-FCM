import assert from 'node:assert/strict';
import test from 'node:test';
import { installDragScroll } from '../src/ui/drag-scroll.js';
import { createChatRenderer } from '../src/communication/chat/controllers/chat-renderer.js';

globalThis.bcModSdk = { getModsInfo: () => [], registerMod: () => ({}) };
globalThis.window = { Liko: { FCM: {} } };
const { isMobile, cfg, loadCfg } = await import('../src/core/config.js');

test('BC boolean selects mobile defaults but preserves a saved layout', () => {
    globalThis.Player = { ExtensionSettings: {} };
    for (const flag of [undefined, false, true]) {
        globalThis.CommonIsMobile = flag;
        assert.equal(isMobile(), flag === true);
        loadCfg();
        assert.equal(cfg.chatLayout, flag === true ? 'stacked' : 'split');
    }
    for (const flag of [false, true]) {
        globalThis.CommonIsMobile = flag;
        for (const layout of ['stacked', 'split']) {
            Player.ExtensionSettings = { FCM: { settings: { chatLayout: layout } } };
            loadCfg();
            assert.equal(cfg.chatLayout, layout);
        }
    }
});

test('message drag ignores desktop pointers and clicks; mobile still drags', () => {
    globalThis.Element = class {
        listeners = new Map();
        scrollTop = 100; scrollLeft = 0; scrollHeight = 900; clientHeight = 200;
        classList = { add() {}, remove() {} };
        addEventListener(name, fn) { this.listeners.set(name, fn); }
        matches(selector) { return selector === '.fcm-chat-messages'; }
        closest() { return null; }
        contains(node) { return node === this; }
        setPointerCapture() {}
    };
    globalThis.Node = Element;
    globalThis.window = { setTimeout() {} };
    const area = new Element();
    const emit = (name, extra = {}) => {
        const event = { target: area, isPrimary: true, button: 0, pointerId: 1, clientX: 0, clientY: 100,
            prevented: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() {}, ...extra };
        area.listeners.get(name)?.(event);
        return event;
    };
    installDragScroll(area, '.fcm-chat-messages', { enabled: isMobile });
    installDragScroll(area, '.fcm-chat-messages', { enabled: isMobile });
    assert.equal(area.listeners.size, 5);
    globalThis.CommonIsMobile = false;
    emit('pointerdown');
    assert.equal(emit('pointermove', { clientY: 50 }).prevented, false);
    assert.equal(area.scrollTop, 100);
    emit('pointerup');
    assert.equal(emit('click').prevented, false);
    assert.equal(area.listeners.has('wheel'), false);
    globalThis.CommonIsMobile = true;
    emit('pointerdown');
    assert.equal(emit('pointermove', { clientY: 50 }).prevented, true);
    assert.equal(area.scrollTop, 150);
    emit('pointerup');
    assert.equal(emit('click').prevented, true);
});

test('full render and conversation refresh use the same mobile-only message policy', () => {
    const calls = [];
    const noop = () => {};
    const main = { querySelector: () => null };
    const root = { querySelector: selector => selector === '.fcm-chat-main' ? main : null };
    globalThis.requestAnimationFrame = noop;
    const renderer = createChatRenderer({
        getRoot: () => root, getActiveView: () => 'chat', getMaximized: () => false,
        getStackedDetail: () => false, getConfig: () => ({}), getPlayer: () => ({}),
        colors: () => [], fontFamily: noop, panelSession: { inlineSizeStyle: noop },
        profileSuggestion: { reset: noop }, historyViewport: { reset: noop }, forwardTargets: { isActive: () => false },
        avatarHtml: noop, unreadBadgeHtml: noop, listHtml: noop, conversationHtml: noop, shellHtml: noop,
        bindShellEvents: noop, bindConversationEvents: noop, installDragScroll: (...args) => calls.push(args), isMobile,
        conversationPresence: { refreshRoomMeta: noop }, hydrateAvatars: noop, syncBalloonVisibility: noop,
    });
    renderer.render();
    renderer.refreshConversation();
    const messages = calls.filter(([, selector]) => selector.includes('.fcm-chat-messages'));
    assert.equal(messages.length, 2);
    assert.deepEqual(messages.map(([scope]) => scope), [root, main]);
    for (const [, selector, options] of messages) {
        assert.equal(selector, '.fcm-chat-messages');
        assert.equal(options.enabled, isMobile);
    }
    assert.equal(calls[0][2], undefined); // Other chat areas retain drag scrolling.
});

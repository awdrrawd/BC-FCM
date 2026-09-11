import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';

const hooks = registerHooks({ load(url, context, next) {
    const source = url.endsWith('/core/config.js') ? 'export const cfg = {}; export const saveCfg = () => {};'
        : url.endsWith('/ui/icons.js') ? 'export const FCM_ICON_SVG = "";'
        : url.endsWith('/services/chat-content.js') ? 'export const esc = String;' : null;
    return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });
const { cfg } = await import('../src/core/config.js');
const { createChatBalloonController } = await import('../src/communication/chat/controllers/chat-balloon.js');
hooks.deregister();

function fixture() {
    const elements = [];
    globalThis.innerWidth = 1000; globalThis.innerHeight = 800;
    globalThis.getComputedStyle = () => ({ display: 'block' });
    globalThis.requestAnimationFrame = () => 1;
    globalThis.document = {
        body: { appendChild: el => elements.push(el) },
        getElementById: id => elements.find(el => el.id === id),
        querySelectorAll: selector => elements.filter(el => selector.includes('#fcm-chat-balloon') || el.className === 'fcm-chat-user-balloon'),
        createElement: () => {
            const classes = new Set();
            return {
                style: { setProperty() {} }, dataset: {}, offsetWidth: 54, offsetHeight: 54, offsetTop: 22,
                get offsetLeft() { return this.getBoundingClientRect().left; },
                matches: () => true, addEventListener() {}, setAttribute() {},
                classList: {
                    toggle(name, on) { if (on) classes.add(name); else classes.delete(name); },
                    add: name => classes.add(name), contains: name => classes.has(name),
                },
                getBoundingClientRect() {
                    return { left: this.style.left !== 'auto' ? parseFloat(this.style.left) : innerWidth - 54 - parseFloat(this.style.right) };
                },
            };
        },
    };
    Object.assign(cfg, { communicationEnabled: true, balloonPlacement: 'bottom-left', userBalloonPlacement: 'top-left',
        chatBalloonPosition: null, chatUserBalloonPositions: {}, notificationAnimation: false });
    let maximized = false;
    const controller = createChatBalloonController({
        chatColors: () => ['black', 'white', 'purple'], getRoot: () => ({ isConnected: true, style: {}, querySelector: () => null }),
        isMaximized: () => maximized, waterShapeHtml: () => '', unreadBadge: () => '', avatarHtml: () => '',
        getDisplayName: String, balloonPreviewText: String, hydrateAvatars: async () => {},
    });
    return { controller, elements, maximize: value => { maximized = value; } };
}

test('main balloon initializes preview direction on first placement and saved-position restoration', () => {
    const { controller, elements } = fixture();
    controller.ensure();
    assert.ok(elements[0].classList.contains('preview-right'));
    cfg.chatBalloonPosition = { x: 900, y: 100 }; controller.ensure();
    assert.equal(elements[0].classList.contains('preview-right'), false);
    cfg.chatBalloonPosition = { x: 8, y: 100 }; controller.ensure();
    assert.ok(elements[0].classList.contains('preview-right'));
});

test('player balloon preview is correct before collision frame or any drag, and after showing again', () => {
    const { controller, elements, maximize } = fixture();
    controller.showIncoming({ memberNumber: 7, content: 'hello' });
    const player = elements.find(el => el.id === 'fcm-chat-user-7');
    assert.ok(player.classList.contains('preview-right'));
    cfg.chatUserBalloonPositions[7] = { x: 900, y: 100 };
    controller.showIncoming({ memberNumber: 7, content: 'again' });
    assert.equal(player.classList.contains('preview-right'), false);
    maximize(true); controller.syncVisibility();
    player.style.left = '8px';
    maximize(false); controller.syncVisibility();
    assert.ok(player.classList.contains('preview-right'));
});

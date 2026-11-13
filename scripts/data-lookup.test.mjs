import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const hooks = registerHooks({ load(url, context, next) {
    const source = url.endsWith('/i18n/i18n.js') ? 'export const T = key => key;'
        : url.endsWith('/core/config.js') ? 'export const cfg = {}; export const saveCfg = () => {};' : null;
    return source ? { format: 'module', source, shortCircuit: true } : next(url, context);
} });
const data = await import('../src/data/data.js');
hooks.deregister();

test('online lookups follow complete server replacements without retaining departed members', () => {
    const previous = { Player: globalThis.Player, ChatRoomCharacter: globalThis.ChatRoomCharacter };
    globalThis.Player = { MemberNumber: 1 };
    globalThis.ChatRoomCharacter = [];
    try {
        const friend = { MemberNumber: 42, MemberName: 'Alice', Type: 'Friend', ChatRoomName: 'First' };
        data.setOnlineFriends([friend, { ...friend, MemberName: 'Duplicate' }]);
        assert.equal(data.getOnlineFriend('42'), friend);
        assert.equal(data.getDisplayName(42), 'Alice');
        assert.equal(data.getRel(42), 'friend');
        assert.equal(data.getRoomInfo(42).name, 'First');
        data.setOnlineFriends([{ ...friend, ChatRoomName: 'Second' }]);
        assert.equal(data.getRoomInfo(42).name, 'Second');
        data.setOnlineFriends([]);
        assert.equal(data.getOnlineFriend(42), undefined);
        assert.equal(data.getRoomInfo(42), null);
        assert.equal(data.getRel(42), 'none');
        data.setOnlineFriends([friend]);
        assert.equal(data.getOnlineFriend(42), friend);
    } finally {
        data.setOnlineFriends([]);
        Object.assign(globalThis, previous);
    }
});

test('shared profile text measurement restores the canvas font even when measuring fails', () => {
    const source = readFileSync(new URL('../src/core/hooks.js', import.meta.url), 'utf8');
    const helpers = source.slice(source.indexOf('function _fittedTextWidth'), source.indexOf('function registerHooks'));
    const canvas = { font: 'original', textAlign: 'center', measureText: () => ({ width: 120 }) };
    const context = vm.createContext({ MainCanvas: canvas, DrawingGetTextSize: () => ['Name (42)', '24'], CommonGetFont: size => size });
    vm.runInContext(helpers, context);
    const region = context._measureRelRegion('Name (42)', 100, 80, 300);
    assert.equal(region.mn, 42);
    assert.equal(region.x, 35);
    assert.equal(region.w, 130);
    assert.equal(canvas.font, 'original');
    canvas.measureText = () => { throw Error('unavailable'); };
    assert.equal(context._fittedTextWidth('Name', 300).w, 72);
    assert.equal(canvas.font, 'original');
});

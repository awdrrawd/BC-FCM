import test from 'node:test';
import assert from 'node:assert/strict';
import { beginPanelView, disposePanelView, updatePanelView } from '../src/panel/panel-lifecycle.js';
test('replacement invalidates async scopes and disposes once', () => {
    const container = { isConnected: true }; let cleanups = 0;
    const first = beginPanelView(container, { dispose: () => cleanups++ });
    const second = beginPanelView(container, { update: () => true });
    assert.equal(first(), false); assert.equal(second(), true); assert.equal(cleanups, 1);
    assert.equal(updatePanelView(container), true);
    disposePanelView(container); disposePanelView(container);
    assert.equal(second(), false); assert.equal(updatePanelView(container), false);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { createRelationIndex } from '../src/data/relation-index.js';

const profile = (id, extra = {}, seen = 100) => ({ memberNumber: id, name: `Person ${id}`, seen,
    characterBundle: JSON.stringify({ MemberNumber: id, ...extra }) });

test('relationship index deduplicates lovers and preserves directional ownership and missing-profile references', () => {
    const index = createRelationIndex();
    index.add(profile(1, { Lovership: [{ MemberNumber: 2, Stage: 1 }] }));
    index.add(profile(2, { Ownership: { MemberNumber: 3 }, Lovership: [{ MemberNumber: 1, Stage: 2 }] }, 200));
    assert.deepEqual(index.finish(), { profiles: 2, edges: 2, invalid: 0 });
    const graph = index.graph({ id: 2 });
    assert.equal(graph.edges.filter(edge => edge.type === 'lover').length, 1);
    assert.deepEqual(graph.edges.find(edge => edge.type === 'owner').from, 3);
    assert.deepEqual(graph.edges.find(edge => edge.type === 'owner').to, 2);
    assert.equal(graph.nodes.find(node => node.id === 3).missing, true);
    assert.equal(index.search('3')[0].id, 3);
});

test('newer snapshots remove prior relationships and malformed profiles do not break indexing', () => {
    const index = createRelationIndex();
    index.add(profile(1, { Ownership: { MemberNumber: 2 } }));
    index.add(profile(1, {}, 200));
    index.add(profile(1, { Ownership: { MemberNumber: 3 } }, 50));
    index.add({ memberNumber: 4, characterBundle: '{broken' });
    index.add({ ...profile(5), memberNumber: 6 });
    index.add(null);
    index.add(profile(7, { Ownership: { MemberNumber: -1 }, Lovership: [{ MemberNumber: 0 }, { MemberNumber: 7 }] }));
    assert.deepEqual(index.finish(), { profiles: 2, edges: 0, invalid: 3 });
    assert.equal(index.graph({ id: 1 }).nodes.length, 1);
});

test('depth and edge filters isolate the requested neighborhood; search caps broad queries', () => {
    const index = createRelationIndex();
    for (let id = 1; id <= 50; id++) index.add(profile(id, { Ownership: { MemberNumber: id + 1 } }));
    index.finish();
    assert.equal(index.search('Person').length, 30);
    assert.equal(index.search('20')[0].id, 20);
    assert.equal(index.graph({ id: 1, depth: 1 }).nodes.length, 2);
    assert.equal(index.graph({ id: 1, depth: 2 }).nodes.length, 3);
    assert.equal(index.graph({ id: 1, depth: 5 }).nodes.length, 6);
    assert.equal(index.graph({ id: 1, depth: 99 }).nodes.length, 51);
    assert.equal(index.graph({ id: 1, depth: 8 }).nodes.length, 9);
    assert.deepEqual(index.graph({ id: 1, depth: 5 }).nodes.map(node => node.level), [0, 1, 2, 3, 4, 5]);
    assert.equal(index.graph({ id: 1, owner: false }).nodes.length, 1);
    assert.equal(index.graph({ id: 999 }).nodes.length, 0);
});

test('large neighborhoods preserve all nodes and edges', () => {
    const index = createRelationIndex();
    for (let id = 1; id <= 1000; id++) index.add(profile(id, { Lovership: Array.from({ length: 10 }, (_, n) => ({ MemberNumber: n + 1 })) }));
    index.finish();
    const graph = index.graph({ id: 1, depth: 2 });
    assert.equal(graph.nodes.length, 1000);
    assert.equal(graph.edges.length, 9945);
});

test('social edges use only the explicit own-player lists and default off', () => {
    const index = createRelationIndex();
    index.add(profile(1, { FriendList: [999], WhiteList: [888] }));
    index.finish({ id: 1, friend: [2, 2], whitelist: [3] });
    assert.deepEqual(index.graph({ id: 1 }).nodes.map(n => n.id), [1]);
    assert.deepEqual(index.graph({ id: 1, friend: true }).nodes.map(n => n.id), [1, 2]);
    assert.deepEqual(index.graph({ id: 1, whitelist: true }).nodes.map(n => n.id), [1, 3]);
    assert.equal(index.graph({ id: 999, friend: true }).nodes.length, 0);
});

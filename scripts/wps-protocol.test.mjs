import assert from 'node:assert/strict';
import test from 'node:test';
import {
    PROFILE_SHARE_PREFIX, SHARE_LIMITS, buildShareMessages, chunkSizeFor, createShareAssembler, fromBase64Utf8, toBase64Utf8,
} from '../src/chat/wps-protocol.js';

const bundleOf = (memberNumber, filler = 0) => JSON.stringify({ MemberNumber: memberNumber, Name: 'Tester', Appearance: [], Filler: 'x'.repeat(filler) });
const payloadOf = (overrides = {}, memberNumber = 77, filler = 0) => ({
    sharedAt: 1_700_000_000_000,
    from: { memberNumber: 5, name: 'Alice' },
    profile: { memberNumber, name: 'Tester', lastNick: '測試', seen: 1_700_000_000_000, characterBundle: bundleOf(memberNumber, filler), ...overrides },
});
const feed = (assembler, sender, contents) => contents.map(content => assembler.accept(sender, content));

test('encoding is bit-identical to the legacy btoa(unescape(encodeURIComponent())) form', () => {
    const text = JSON.stringify({ name: '測試 🐈‍⬛ café', n: 1 });
    assert.equal(toBase64Utf8(text), btoa(unescape(encodeURIComponent(text))));
    assert.equal(fromBase64Utf8(toBase64Utf8(text)), text);
});

test('chunk size follows the BC message limit and falls back to the legacy 800', () => {
    assert.equal(chunkSizeFor(2000), 1800);
    assert.equal(chunkSizeFor(1000), 800);
    assert.equal(chunkSizeFor(undefined), 800);
    assert.equal(chunkSizeFor(NaN), 800);
});

for (const size of [800, 1500, 1800]) {
    test(`round trip with ${size}-character chunks (LCE sends up to 1800)`, () => {
        const built = buildShareMessages(payloadOf({}, 77, 20_000), 'abc123', size);
        assert.ok(built.contents.length > 1);
        const results = feed(createShareAssembler(), 5, built.contents);
        assert.deepEqual(results.slice(0, -1).map(r => r.status), new Array(built.contents.length - 1).fill('pending'));
        const done = results.at(-1);
        assert.equal(done.status, 'complete');
        assert.equal(done.payload.profile.memberNumber, 77);
        assert.equal(done.payload.profile.lastNick, '測試');
        assert.equal(done.payload.fromName, 'Alice');
    });
}

test('out-of-order and duplicate chunks still assemble once', () => {
    const built = buildShareMessages(payloadOf({}, 77, 6_000), 'ord-1', 800);
    const shuffled = [...built.contents].reverse();
    const assembler = createShareAssembler();
    const results = feed(assembler, 5, [shuffled[0], shuffled[0], ...shuffled.slice(1)]);
    assert.equal(results.filter(r => r.status === 'complete').length, 1);
    assert.equal(assembler.size(), 0);
});

test('non-share content is ignored; malformed share chunks are rejected', () => {
    const assembler = createShareAssembler();
    assert.equal(assembler.accept(5, 'hello').status, 'ignored');
    for (const bad of [
        `${PROFILE_SHARE_PREFIX} id 1000000000/1 AAAA`,   // 舊版曾因此卡死頁面
        `${PROFILE_SHARE_PREFIX} id 0/3 AAAA`,
        `${PROFILE_SHARE_PREFIX} id 4/3 AAAA`,
        `${PROFILE_SHARE_PREFIX} id 1/401 AAAA`,
        `${PROFILE_SHARE_PREFIX} bad!id 1/2 AAAA`,
        `${PROFILE_SHARE_PREFIX} id 1/2 not base64!`,
        `${PROFILE_SHARE_PREFIX} id 1/2 ${'A'.repeat(SHARE_LIMITS.maxChunkChars + 1)}`,
    ]) assert.equal(assembler.accept(5, bad).status, 'rejected', bad);
    assert.equal(assembler.accept(0, `${PROFILE_SHARE_PREFIX} id 1/2 AAAA`).status, 'rejected');
    assert.equal(assembler.size(), 0);
});

test('assemblies are keyed by sender so nobody can inject chunks into your share', () => {
    const built = buildShareMessages(payloadOf({}, 77, 6_000), 'same-id', 800);
    const assembler = createShareAssembler();
    assembler.accept(5, built.contents[0]);
    const forged = built.contents[1].replace(/^(\S+ \S+ \d+\/\d+ ).*$/, `$1${'A'.repeat(100)}`);
    assert.equal(assembler.accept(6, forged).status, 'pending');   // 另一位送出者 → 另一份組裝
    const results = feed(assembler, 5, built.contents.slice(1));
    assert.equal(results.at(-1).status, 'complete');
});

test('assembly capacity is bounded and stale assemblies expire', () => {
    let t = 0;
    const assembler = createShareAssembler({ now: () => t });
    for (let i = 1; i <= 3; i++) assembler.accept(5, `${PROFILE_SHARE_PREFIX} s${i} 1/2 AAAA`);
    assert.equal(assembler.size(), SHARE_LIMITS.maxPerSender);
    for (let sender = 10; sender < 30; sender++) assembler.accept(sender, `${PROFILE_SHARE_PREFIX} s 1/2 AAAA`);
    assert.ok(assembler.size() <= SHARE_LIMITS.maxAssemblies);
    t = SHARE_LIMITS.ttlMs + 1;
    assembler.accept(99, `${PROFILE_SHARE_PREFIX} fresh 1/2 AAAA`);
    assert.equal(assembler.size(), 1);
});

test('payload validation: bundle must match, name required, seen is clamped to now', () => {
    const run = payload => feed(createShareAssembler({ now: () => 2_000_000_000_000 }), 5, buildShareMessages(payload, 'v1', 1800).contents).at(-1);
    assert.equal(run(payloadOf({ characterBundle: bundleOf(78) }, 77)).status, 'rejected');   // MemberNumber 不一致
    assert.equal(run(payloadOf({ name: '' })).status, 'rejected');
    assert.equal(run(payloadOf({ characterBundle: '[]' })).status, 'rejected');
    assert.equal(run(payloadOf({ memberNumber: -1 })).status, 'rejected');
    const future = run(payloadOf({ seen: 9_999_999_999_999 }));
    assert.equal(future.status, 'complete');
    assert.equal(future.payload.profile.seen, 2_000_000_000_000);
});

test('a share over the chunk limit is refused by the sender instead of being sent', () => {
    const built = buildShareMessages(payloadOf({}, 77, 400_000), 'big', 800);
    assert.equal(built.tooLarge, true);
    assert.equal(built.limit, SHARE_LIMITS.maxChunks * 800);
    assert.ok(buildShareMessages(payloadOf({}, 77, 400_000), 'big', 1800).contents);
});

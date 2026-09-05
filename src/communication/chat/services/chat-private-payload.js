const PRIVATE_TAG = 'FCM::CHAT::PRIVATE';
const PRIVATE_BEEP = 'FCMChatPrivate';
const META_TAG = 'FCM::CHAT::META';
const CHUNK_SIZE = 800;
const MAX_CHUNKS = 512;
const TTL = 2 * 60 * 1000;
const validId = value => typeof value === 'string' && /^[a-z0-9-]{6,64}$/i.test(value);

function profileMentionIds(content) {
    return [...new Set([...String(content).matchAll(/@([^@\n()]*?)\s*\((\d+)\)|@(\d+)/gu)]
        .map(match => Number(match[2] || match[3])).filter(value => Number.isSafeInteger(value) && value > 0))];
}

function validPrivatePayload(value) {
    if (!value || !validId(value.id) || !Number.isSafeInteger(value.target) || value.target <= 0
        || typeof value.content !== 'string' || !value.content || value.content.length > 10000
        || !Array.isArray(value.profiles) || value.profiles.length > 6
        || typeof value.replyPreview !== 'string' || value.replyPreview.length > 200
        || typeof value.replyToId !== 'string' || value.replyToId.length > 128) return false;
    if (value.wireContent !== undefined && (typeof value.wireContent !== 'string' || value.wireContent.length > 10000)) return false;
    const mentioned = new Set(profileMentionIds(value.content));
    const seen = new Set();
    return value.profiles.every(profile => {
        if (!profile || !Number.isFinite(profile.seen) || profile.seen <= 0 || !mentioned.has(profile.memberNumber) || seen.has(profile.memberNumber)
            || typeof profile.characterBundle !== 'string' || profile.characterBundle.length > CHUNK_SIZE * MAX_CHUNKS) return false;
        seen.add(profile.memberNumber);
        try {
            const bundle = JSON.parse(profile.characterBundle);
            return !!bundle && !Array.isArray(bundle) && Number(bundle.MemberNumber) === profile.memberNumber
                && typeof bundle.Name === 'string' && Array.isArray(bundle.Appearance);
        } catch { return false; }
    });
}

function privatePackets(payload) {
    if (!validPrivatePayload(payload)) throw new Error('Invalid private profile message');
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    const total = Math.ceil(encoded.length / CHUNK_SIZE);
    if (total > MAX_CHUNKS) throw new Error('Private profile message is too large');
    return Array.from({ length: total }, (_, index) => JSON.stringify({
        v: 1, id: payload.id, to: payload.target, i: index, n: total,
        body: encoded.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
    }));
}

// Only completed, bounded transfers addressed to this account can be consumed.
// Whisper attachments additionally require an exact in-message reference.
function createPrivatePayloadReceiver({ getSelf, now = Date.now }) {
    const pending = new Map();
    const completed = new Map();
    let owner = null;
    function prune() {
        const self = Number(getSelf());
        if (owner !== self) { pending.clear(); completed.clear(); owner = self; }
        for (const map of [pending, completed]) {
            for (const [key, entry] of map) if (now() - entry.updatedAt > TTL) map.delete(key);
        }
    }
    function receive(sender, source, channel) {
        prune();
        if (!owner || !Number.isSafeInteger(sender) || sender <= 0 || sender === owner
            || typeof source !== 'string' || source.length > 1000) return null;
        try {
            const packet = JSON.parse(source);
            if (packet.v !== 1 || packet.to !== owner || !validId(packet.id)
                || !Number.isInteger(packet.i) || !Number.isInteger(packet.n) || packet.n < 1 || packet.n > MAX_CHUNKS
                || packet.i < 0 || packet.i >= packet.n || typeof packet.body !== 'string'
                || !/^[A-Za-z0-9+/=]+$/.test(packet.body) || packet.body.length > CHUNK_SIZE) return null;
            const key = `${sender}:${channel}:${packet.id}`;
            if (completed.has(key)) return null;
            if (!pending.has(key)) {
                if (pending.size >= 24 || [...pending.keys()].filter(id => id.startsWith(`${sender}:`)).length >= 4) return null;
                pending.set(key, { parts: new Array(packet.n), count: 0, updatedAt: now() });
            }
            const entry = pending.get(key);
            if (entry.parts.length !== packet.n || (entry.parts[packet.i] && entry.parts[packet.i] !== packet.body)) {
                pending.delete(key);
                return null;
            }
            if (!entry.parts[packet.i]) entry.count++;
            entry.parts[packet.i] = packet.body;
            entry.updatedAt = now();
            if (entry.count !== packet.n) return null;
            pending.delete(key);
            const payload = JSON.parse(decodeURIComponent(escape(atob(entry.parts.join('')))));
            if (!validPrivatePayload(payload) || payload.id !== packet.id || payload.target !== owner) return null;
            completed.set(key, { payload, updatedAt: now() });
            while (completed.size > 32) completed.delete(completed.keys().next().value);
            return payload;
        } catch { return null; }
    }
    function consume(sender, id, channel = 'whisper') {
        prune();
        const entry = completed.get(`${sender}:${channel}:${id}`);
        const payload = entry?.payload;
        if (entry) entry.payload = null;
        return payload || null;
    }
    function consumeBeep(sender, content) {
        prune();
        for (const [key, entry] of completed) {
            if (key.startsWith(`${sender}:beep:`) && entry.payload?.content === content) {
                const payload = entry.payload;
                entry.payload = null;
                return payload;
            }
        }
        return null;
    }
    return { receive, consume, consumeBeep };
}

export { PRIVATE_TAG, PRIVATE_BEEP, META_TAG, privatePackets, profileMentionIds, validPrivatePayload, createPrivatePayloadReceiver };

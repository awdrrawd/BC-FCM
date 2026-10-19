// PROFILESHARE 線路協定：編碼、分塊與「安全的接收組裝」。純邏輯，不碰 DOM 與 BC 全域。
//
// 線路格式與 Liko-WPS / LCE 互通，不可更動：
//   Hidden 聊天訊息 Content = `[PROFILESHARE] <shareId> <i>/<n> <chunk>`（i 從 1 起算）
//   所有 chunk 依序串接 = base64( UTF-8( JSON.stringify(payload) ) )
//   payload = { sharedAt, from: { memberNumber, name }, profile: { memberNumber, name, lastNick, seen, characterBundle } }
// 每塊大小只由送出端決定，接收端靠 i/n 重組。LCE 會依 BC 單則訊息上限送出最大 1800 字元的分塊，
// 所以接收端必須接受到 2000 字元（舊版 FCM 只收 800，會靜默丟掉 LCE 的分享）。
//
// 接收端的訊息來自房內任何人，一律視為不可信：嚴格解析、以「送出者 + shareId」為鍵、
// 同時組裝數／每人組裝數／總字元數／存活時間皆有上限、組完後逐欄驗證。

export const PROFILE_SHARE_PREFIX = '[PROFILESHARE]';

const MAX_CHUNKS = 400;
const MAX_CHUNK_CHARS = 2000;
export const SHARE_LIMITS = Object.freeze({
    maxChunks: MAX_CHUNKS,
    maxChunkChars: MAX_CHUNK_CHARS,
    maxChars: MAX_CHUNKS * MAX_CHUNK_CHARS,
    ttlMs: 60_000,
    maxAssemblies: 8,
    maxPerSender: 2,
});

const LEGACY_CHUNK = 800;
const MAX_CHUNK = 1800;
const MIN_CHUNK = 400;
const RESERVED = 200;

const CHUNK_RE = /^\[PROFILESHARE\] ([A-Za-z0-9_-]{1,40}) (\d{1,4})\/(\d{1,4}) ([A-Za-z0-9+/=]*)$/;
const BASE64_RE = /^[A-Za-z0-9+/]*={0,2}$/;

export function toBase64Utf8(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(binary);
}

export function fromBase64Utf8(b64) {
    if (!BASE64_RE.test(b64) || b64.length % 4 === 1) throw new Error('invalid base64');
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

/** 依 BC 單則訊息上限決定每塊大小；讀不到就沿用舊值 800。 */
export function chunkSizeFor(maxMessageChars) {
    if (!Number.isFinite(maxMessageChars) || maxMessageChars <= 0) return LEGACY_CHUNK;
    return Math.max(MIN_CHUNK, Math.min(MAX_CHUNK, Math.floor(maxMessageChars) - RESERVED));
}

/** 分塊數超過上限時回傳 { tooLarge: true, chars, limit }，呼叫端應提示使用者而不是送出。 */
export function buildShareMessages(payload, shareId, chunkSize = LEGACY_CHUNK) {
    const encoded = toBase64Utf8(JSON.stringify(payload));
    const total = Math.ceil(encoded.length / chunkSize);
    if (total > SHARE_LIMITS.maxChunks) return { tooLarge: true, chars: encoded.length, limit: SHARE_LIMITS.maxChunks * chunkSize };
    const contents = [];
    for (let i = 0; i < total; i++) {
        contents.push(`${PROFILE_SHARE_PREFIX} ${shareId} ${i + 1}/${total} ${encoded.slice(i * chunkSize, (i + 1) * chunkSize)}`);
    }
    return { contents, chars: encoded.length };
}

const isInt = v => Number.isSafeInteger(v) && v > 0;
const str = (v, max) => (typeof v === 'string' && v.length <= max ? v : undefined);

/**
 * 逐欄驗證組好的 payload；任何必要欄位不合格就回傳 null。
 * seen 不得晚於現在：否則一份「未來時間」的個資會讓之後所有真正的更新都被「只收較新」的規則擋掉。
 */
export function normalizeSharedProfile(raw, now = Date.now()) {
    const p = raw?.profile;
    if (!p || typeof p !== 'object') return null;
    if (!isInt(p.memberNumber)) return null;
    const name = str(p.name, 100);
    if (name === undefined || !name) return null;
    if (typeof p.characterBundle !== 'string' || !p.characterBundle || p.characterBundle.length > SHARE_LIMITS.maxChars) return null;
    if (!Number.isFinite(p.seen) || p.seen < 0) return null;

    let bundle;
    try { bundle = JSON.parse(p.characterBundle); } catch { return null; }
    if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle) || bundle.MemberNumber !== p.memberNumber) return null;

    return {
        profile: {
            memberNumber: p.memberNumber,
            name,
            lastNick: str(p.lastNick, 100),
            seen: Math.min(p.seen, now),
            characterBundle: p.characterBundle,
        },
        fromName: str(raw?.from?.name, 40) ?? '',
    };
}

/**
 * accept(sender, content) → { status: 'ignored' | 'rejected' | 'pending' | 'complete', payload? }
 * ignored：不是分享訊息；rejected：是分享訊息但不合格（呼叫端一樣要吞掉，別讓它進聊天室）。
 */
export function createShareAssembler({ now = () => Date.now(), limits = SHARE_LIMITS } = {}) {
    const assemblies = new Map();

    const purge = t => { for (const [key, a] of assemblies) if (t - a.createdAt > limits.ttlMs) assemblies.delete(key); };
    const oldest = pred => {
        let pick = null;
        for (const [key, a] of assemblies) if (pred(a) && (!pick || a.createdAt < pick.a.createdAt)) pick = { key, a };
        return pick?.key;
    };

    return {
        size: () => assemblies.size,
        accept(sender, content) {
            if (typeof content !== 'string' || !content.startsWith(PROFILE_SHARE_PREFIX)) return { status: 'ignored' };
            if (!Number.isSafeInteger(sender) || sender <= 0) return { status: 'rejected' };
            if (content.length > limits.maxChunkChars + 80) return { status: 'rejected' };
            const m = CHUNK_RE.exec(content);
            if (!m) return { status: 'rejected' };
            const [, shareId, idxText, totalText, chunk] = m;
            const idx = Number(idxText), total = Number(totalText);
            if (total < 1 || total > limits.maxChunks || idx < 1 || idx > total) return { status: 'rejected' };
            if (chunk.length > limits.maxChunkChars) return { status: 'rejected' };

            const t = now();
            purge(t);
            const key = `${sender}:${shareId}`;
            let entry = assemblies.get(key);
            if (!entry) {
                let mine = 0;
                for (const a of assemblies.values()) if (a.sender === sender) mine++;
                if (mine >= limits.maxPerSender) assemblies.delete(oldest(a => a.sender === sender));
                if (assemblies.size >= limits.maxAssemblies) assemblies.delete(oldest(() => true));
                entry = { sender, total, chunks: new Array(total), received: 0, chars: 0, createdAt: t };
                assemblies.set(key, entry);
            }
            if (entry.total !== total) { assemblies.delete(key); return { status: 'rejected' }; }

            if (entry.chunks[idx - 1] === undefined) {
                entry.chunks[idx - 1] = chunk;
                entry.received++;
                entry.chars += chunk.length;
                if (entry.chars > limits.maxChars) { assemblies.delete(key); return { status: 'rejected' }; }
            }
            if (entry.received < entry.total) return { status: 'pending' };

            assemblies.delete(key);
            try {
                const raw = JSON.parse(fromBase64Utf8(entry.chunks.join('')));
                const payload = normalizeSharedProfile(raw, t);
                return payload ? { status: 'complete', payload } : { status: 'rejected' };
            } catch { return { status: 'rejected' }; }
        },
    };
}

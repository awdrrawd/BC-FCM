// Per-contact unsent drafts: kept in memory and mirrored to localStorage (per account) so a half-typed
// message survives switching conversations, re-renders and reloads. Cleared once the message is sent.
import { warnLimited } from '../../../core/logger.js';

const MAX_DRAFTS = 200;

function createChatDrafts({ getRoot, getMemberNumber, getOwner = () => Number(globalThis.Player?.MemberNumber) || 0, storage = () => globalThis.localStorage }) {
    let loadedFor = 0;
    let drafts = new Map();

    const storageKey = owner => `FCM_chat_drafts_${owner}`;

    function load() {
        const owner = getOwner();
        if (!owner) { drafts = new Map(); loadedFor = 0; return; }
        if (loadedFor === owner) return;
        loadedFor = owner;
        drafts = new Map();
        try {
            const rows = JSON.parse(storage()?.getItem(storageKey(owner)) || '[]');
            for (const [member, content] of Array.isArray(rows) ? rows : []) {
                if (Number(member) && typeof content === 'string' && content) drafts.set(Number(member), content);
            }
        } catch (error) { warnLimited('chat draft read failed', error); }
    }

    function persist() {
        const owner = getOwner();
        if (!owner) return;
        try { storage()?.setItem(storageKey(owner), JSON.stringify([...drafts])); }
        catch (error) { warnLimited('chat draft write failed', error); }
    }

    function get(memberNumber) {
        load();
        return drafts.get(Number(memberNumber)) || '';
    }

    function set(memberNumber, content) {
        load();
        const member = Number(memberNumber);
        if (!member) return;
        const value = String(content ?? '');
        if (!value.trim()) {
            if (!drafts.delete(member)) return;
        } else {
            drafts.delete(member);                       // re-insert so the newest draft is last
            drafts.set(member, value);
            while (drafts.size > MAX_DRAFTS) drafts.delete(drafts.keys().next().value);
        }
        persist();
    }

    function clear(memberNumber) {
        set(memberNumber, '');
    }

    // Called whenever the conversation pane is (re)built: put the saved draft back into an empty input.
    function restore() {
        const member = Number(getMemberNumber());
        const input = getRoot()?.querySelector('[data-input]');
        if (!member || !input || input.value) return;
        const draft = get(member);
        if (draft) input.value = draft;
    }

    function bindInput(input) {
        input?.addEventListener('input', () => set(getMemberNumber(), input.value));
    }

    return { bindInput, clear, get, restore, set };
}

export { createChatDrafts };

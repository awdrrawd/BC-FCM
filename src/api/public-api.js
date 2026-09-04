import { PDB, Snapshot, loadAvatarFromBundle, syncRoomAvatar, updateOwnAvatarSnapshot } from '../data/profile-db.js';
import { wpsShareProfile } from '../chat/wps-share.js';
import { warnLimited } from '../core/logger.js';

function memberNumberOf(value) {
    const memberNumber = Number(value);
    return Number.isSafeInteger(memberNumber) && memberNumber > 0 ? memberNumber : null;
}

function roomCharacter(memberNumber) {
    return globalThis.ChatRoomCharacter?.find(character => Number(character?.MemberNumber) === memberNumber) || null;
}

function copyProfile(profile) {
    if (!profile) return null;
    if (typeof structuredClone === 'function') return structuredClone(profile);
    return JSON.parse(JSON.stringify(profile));
}

async function getAvatar(memberNumber) {
    const target = memberNumberOf(memberNumber);
    if (!target) return null;
    if (target === Number(globalThis.Player?.MemberNumber)) {
        const shared = globalThis.Player?.OnlineSharedSettings?.FCM;
        if (shared?.avatarMode === 'url' && shared.avatarUrl) return shared.avatarUrl;
        if (shared?.avatarMode !== 'none' && shared?.avatarSnapshot) return shared.avatarSnapshot;
    }
    const live = roomCharacter(target);
    if (live) await syncRoomAvatar(live);
    return Snapshot.get(target);
}

async function refreshAvatar(memberNumber) {
    const target = memberNumberOf(memberNumber);
    if (!target) return null;
    if (target === Number(globalThis.Player?.MemberNumber)) {
        return await updateOwnAvatarSnapshot()
            ? globalThis.Player?.OnlineSharedSettings?.FCM?.avatarSnapshot || null
            : null;
    }

    const live = roomCharacter(target);
    if (live) {
        try {
            globalThis.CharacterLoadCanvas?.(live);
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            const dataUrl = PDB._face(live, 100);
            if (dataUrl?.length > 800) {
                await Snapshot.save(target, dataUrl, { source: 'api-refresh' });
                return Snapshot.get(target);
            }
        } catch (error) { warnLimited(`public avatar refresh failed (${target})`, error); }
    }
    const profile = await PDB.get(target);
    return loadAvatarFromBundle(target, profile);
}

async function openProfile(memberNumber) {
    const target = memberNumberOf(memberNumber);
    if (!target) return false;
    const live = roomCharacter(target);
    if (live && typeof globalThis.InformationSheetLoadCharacter === 'function') {
        globalThis.InformationSheetLoadCharacter(live);
        return true;
    }
    const profile = await PDB.get(target);
    if (!profile?.characterBundle || typeof globalThis.CharacterLoadOnline !== 'function'
        || typeof globalThis.InformationSheetLoadCharacter !== 'function') return false;
    try {
        const character = globalThis.CharacterLoadOnline(JSON.parse(profile.characterBundle), target);
        if (!character) return false;
        globalThis.InformationSheetLoadCharacter(character);
        return true;
    } catch (error) {
        warnLimited(`public profile open failed (${target})`, error);
        return false;
    }
}

function createPublicApi() {
    const avatar = Object.freeze({
        get: getAvatar,
        refresh: refreshAvatar,
        remove: memberNumber => {
            const target = memberNumberOf(memberNumber);
            return target ? Snapshot.delete(target).then(() => true) : Promise.resolve(false);
        },
    });
    const profiles = Object.freeze({
        get: async memberNumber => {
            const target = memberNumberOf(memberNumber);
            return target ? copyProfile(await PDB.get(target)) : null;
        },
        has: async memberNumber => {
            const target = memberNumberOf(memberNumber);
            return target ? !!(await PDB.get(target)) : false;
        },
        open: openProfile,
        share: memberNumber => wpsShareProfile(memberNumberOf(memberNumber)),
    });
    return Object.freeze({ avatar, profiles });
}

export { createPublicApi, openProfile };

import { isSupportedAvatarUrl } from './chat-avatar-url.js';
import { esc } from './chat-content.js';

function createChatContactService({ config, snapshot, syncRoomAvatar, displayName, inRoom, isFriend, getPlayer, getRoomCharacters, getOnlineFriends, getRemoteProfiles }) {
    const readyAvatars = new Map();
    const pendingAvatars = new Map();
    const pendingMembers = new Map();
    const character = memberNumber => getRoomCharacters()?.find(item => Number(item.MemberNumber) === Number(memberNumber));
    const getDisplayName = memberNumber => displayName(memberNumber, true);
    const isOnline = memberNumber => {
        const target = Number(memberNumber);
        if (inRoom(target)) return true;
        if (!isFriend(target)) return false;
        return getOnlineFriends().some(friend => Number(friend.MemberNumber) === target);
    };
    const capability = memberNumber => config.mergeWhispers !== false && inRoom(Number(memberNumber)) ? 'whisper' : isFriend(memberNumber) && isOnline(memberNumber) ? 'beep' : 'none';
    const sharedProfile = memberNumber => Number(memberNumber) === Number(getPlayer()?.MemberNumber)
        ? getPlayer()?.OnlineSharedSettings?.FCM || {}
        : character(memberNumber)?.OnlineSharedSettings?.FCM || {};
    const biography = memberNumber => {
        const shared = sharedProfile(memberNumber);
        if (typeof shared.signature === 'string' && shared.signature) return shared.signature;
        const lian = Number(memberNumber) === Number(getPlayer()?.MemberNumber)
            ? getPlayer()?.OnlineSharedSettings?.LCData?.MessageSetting
            : character(memberNumber)?.OnlineSharedSettings?.LCData?.MessageSetting;
        if (typeof lian?.Signature === 'string' && lian.Signature) return lian.Signature;
        return getRemoteProfiles().get(Number(memberNumber))?.signature || '';
    };
    // Anything a *remote* player controls (shared settings, profile payload) must be a
    // supported avatar host or an inline image, and is normalised so raw quote
    // characters can never reach markup. Locally generated sources are trusted as-is.
    const remoteAvatar = url => {
        if (typeof url !== 'string' || !url) return '';
        if (url.startsWith('data:image/')) return url;
        return isSupportedAvatarUrl(url) ? new URL(url).href : '';
    };
    const avatarUrl = memberNumber => {
        const shared = sharedProfile(memberNumber);
        if (Number(memberNumber) === Number(getPlayer()?.MemberNumber) && config.chatAvatarMode !== 'follow') {
            if (config.chatAvatarMode === 'url') return config.chatAvatarUrl || config.avatarUrl || '';
            if (config.chatAvatarMode === 'game') return snapshot._cache[Number(memberNumber)] || shared.avatarSnapshot || '';
        }
        const sharedUrl = shared.avatarMode === 'url' ? remoteAvatar(shared.avatarUrl) : '';
        if (sharedUrl) return sharedUrl;   // rejected URLs fall through to the local snapshot
        return snapshot._cache[Number(memberNumber)]
            || (shared.avatarMode !== 'none' && remoteAvatar(shared.avatarSnapshot))
            || remoteAvatar(getRemoteProfiles().get(Number(memberNumber))?.avatarUrl) || '';
    };
    const avatarHtml = (memberNumber, size = 34, variant = 'normal') => {
        // Both chat and balloons show only a fully decoded image; keep the previous one during refresh.
        const url = readyAvatars.get(Number(memberNumber)) || '';
        const mine = Number(memberNumber) === Number(getPlayer()?.MemberNumber);
        const status = mine ? (config.chatStatus || 'online') : isOnline(memberNumber) ? (sharedProfile(memberNumber).status || 'online') : 'offline';
        return `<span class="fcm-chat-avatar fcm-chat-avatar-${variant} ${config.chatAvatarShape === 'round' ? 'round' : 'square'}" data-avatar-member="${Number(memberNumber)}" style="width:${size}px;height:${size}px">${url ? `<img src="${esc(url)}" draggable="false">` : esc(getDisplayName(memberNumber).slice(0, 2))}<i class="${esc(status)}"></i></span>`;
    };
    const updateAvatar = async memberNumber => {
        const url = avatarUrl(memberNumber);
        if (!url) return;
        snapshot.retainUrl(url);
        try {
            if (readyAvatars.get(memberNumber) !== url) {
                if (!pendingAvatars.has(url)) {
                    const image = new Image();
                    image.referrerPolicy = 'no-referrer';
                    image.src = url;
                    const pending = image.decode().finally(() => pendingAvatars.delete(url));
                    pendingAvatars.set(url, pending);
                }
                await pendingAvatars.get(url);
            }
            if (avatarUrl(memberNumber) !== url) return;
            const previousUrl = readyAvatars.get(memberNumber);
            if (previousUrl !== url) {
                snapshot.retainUrl(url);
                readyAvatars.set(memberNumber, url);
            }
            // Balloons live outside the chat root, but share the same avatar components.
            document.querySelectorAll(`.fcm-chat-avatar[data-avatar-member="${memberNumber}"]`).forEach(element => {
                const previous = element.querySelector('img');
                if (previous?.getAttribute('src') === url) return;
                const image = document.createElement('img');
                image.draggable = false;
                image.referrerPolicy = 'no-referrer';
                image.src = url;
                if (previous) previous.replaceWith(image);
                else element.insertBefore(image, element.firstChild);
                [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).forEach(node => node.remove());
            });
            if (previousUrl !== url) snapshot.releaseUrl(previousUrl);
        } catch { /* Keep the last decoded image if the new source cannot load. */ }
        finally { snapshot.releaseUrl(url); }
    };
    const hydrateAvatars = async () => {
        const members = [...new Set([...document.querySelectorAll('.fcm-chat-avatar[data-avatar-member]')]
            .map(element => Number(element.dataset.avatarMember)).filter(Boolean))];
        await Promise.all(members.map(memberNumber => {
            if (!pendingMembers.has(memberNumber)) {
                const pending = (async () => {
                    try {
                        const liveCharacter = character(memberNumber);
                        if (liveCharacter) await syncRoomAvatar(liveCharacter);
                        await snapshot.get(memberNumber);
                        await updateAvatar(memberNumber);
                    } catch { /* Retain existing avatars while storage or network is unavailable. */ }
                })().finally(() => pendingMembers.delete(memberNumber));
                pendingMembers.set(memberNumber, pending);
            }
            return pendingMembers.get(memberNumber);
        }));
    };
    window.addEventListener('fcm-avatar-updated', event => {
        const memberNumber = Number(event.detail?.memberNumber);
        if (memberNumber) void updateAvatar(memberNumber);
    });
    return { avatarHtml, avatarUrl, biography, capability, character, getDisplayName, hydrateAvatars, isOnline, sharedProfile };
}

export { createChatContactService };

import { esc } from '../../chat-content.js';

function createChatContactService({ config, snapshot, syncRoomAvatar, displayName, inRoom, isFriend, getPlayer, getRoomCharacters, getOnlineFriends, getRemoteProfiles, getRoot }) {
    const character = memberNumber => getRoomCharacters()?.find(item => Number(item.MemberNumber) === Number(memberNumber));
    const getDisplayName = memberNumber => displayName(memberNumber, true);
    const isOnline = memberNumber => {
        const target = Number(memberNumber);
        if (inRoom(target)) return true;
        if (!isFriend(target)) return false;
        return getOnlineFriends().some(friend => Number(friend.MemberNumber) === target);
    };
    const capability = memberNumber => inRoom(Number(memberNumber)) ? 'whisper' : isFriend(memberNumber) && isOnline(memberNumber) ? 'beep' : 'none';
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
    const avatarUrl = memberNumber => {
        const shared = sharedProfile(memberNumber);
        if (Number(memberNumber) === Number(getPlayer()?.MemberNumber) && config.chatAvatarMode !== 'follow') {
            if (config.chatAvatarMode === 'url') return config.chatAvatarUrl || config.avatarUrl || '';
            if (config.chatAvatarMode === 'game') return shared.avatarSnapshot || snapshot._cache[Number(memberNumber)] || '';
        }
        if (shared.avatarMode === 'url' && shared.avatarUrl) return shared.avatarUrl;
        if (shared.avatarMode !== 'none' && shared.avatarSnapshot) return shared.avatarSnapshot;
        return getRemoteProfiles().get(Number(memberNumber))?.avatarUrl || snapshot._cache[Number(memberNumber)] || '';
    };
    const avatarHtml = (memberNumber, size = 34, variant = 'normal') => {
        const url = avatarUrl(memberNumber);
        const mine = Number(memberNumber) === Number(getPlayer()?.MemberNumber);
        const status = mine ? (config.chatStatus || 'online') : isOnline(memberNumber) ? (sharedProfile(memberNumber).status || 'online') : 'offline';
        return `<span class="fcm-chat-avatar fcm-chat-avatar-${variant} ${config.chatAvatarShape === 'round' ? 'round' : 'square'}" data-avatar-member="${Number(memberNumber)}" style="width:${size}px;height:${size}px">${url ? `<img src="${esc(url)}" draggable="false">` : esc(getDisplayName(memberNumber).slice(0, 2))}<i class="${esc(status)}"></i></span>`;
    };
    const hydrateAvatars = async () => {
        const root = getRoot();
        const avatars = [...(root?.querySelectorAll('[data-avatar-member]') || [])];
        const self = Number(getPlayer()?.MemberNumber);
        const members = [...new Set(avatars.map(element => Number(element.dataset.avatarMember)).filter(memberNumber => memberNumber && memberNumber !== self))];
        await Promise.all(members.map(async memberNumber => {
            const liveCharacter = character(memberNumber);
            if (liveCharacter) await syncRoomAvatar(liveCharacter);
            const url = await snapshot.get(memberNumber);
            if (!url) return;
            root?.querySelectorAll(`[data-avatar-member="${memberNumber}"]`).forEach(element => {
                let image = element.querySelector('img');
                if (!image) { image = document.createElement('img'); image.draggable = false; element.insertBefore(image, element.firstChild); }
                if (image.src !== url) image.src = url;
                [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).forEach(node => node.remove());
            });
        }));
    };
    return { avatarHtml, avatarUrl, biography, capability, character, getDisplayName, hydrateAvatars, isOnline, sharedProfile };
}

export { createChatContactService };

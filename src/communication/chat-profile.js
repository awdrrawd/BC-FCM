const SUPPORTED_AVATAR_HOSTS = ['github.io', 'gitlab.io', 'ibb.co', 'imgbb.com', 'imgchest.com', 'imgur.com', 'postimg.cc', 'hd-r.icu'];

function isSupportedAvatarUrl(value) {
    if (!value) return true;
    try {
        const url = new URL(value);
        const host = url.hostname.toLowerCase();
        return ['http:', 'https:'].includes(url.protocol)
            && SUPPORTED_AVATAR_HOSTS.some(domain => host === domain || host.endsWith(`.${domain}`));
    } catch { return false; }
}

function profileHtml({ Player, cfg, T, TH, esc, avatarHtml, editIcon }) {
    const mine = Player?.OnlineSharedSettings?.FCM || {};
    const signature = mine.signature || Player?.OnlineSharedSettings?.LCData?.MessageSetting?.Signature || '';
    const nickname = Player?.Nickname || '';
    let canEditNickname = true;
    try { canEditNickname = typeof globalThis.CharacterCanChangeNickname !== 'function' || globalThis.CharacterCanChangeNickname(Player); } catch {}
    return `<div class="fcm-chat-profile">
        <div class="fcm-chat-profile-overview">
            <div class="fcm-chat-profile-avatar-column">${avatarHtml(Player?.MemberNumber || 0, 88, 'profile')}<button class="fcm-chat-profile-snapshot" data-profile-snapshot>${TH('chatProfileSnapshot')}</button></div>
            <div class="fcm-chat-profile-identity">
                <div class="fcm-chat-profile-line"><span>${TH('chatProfileNameId')}</span><b>${esc(Player?.Name || '')} (#${Number(Player?.MemberNumber || 0)})</b></div>
                <div class="fcm-chat-profile-line"><span>${TH('chatProfileNickname')}</span><div class="fcm-profile-nickname-display"><b data-profile-nickname-text>${esc(nickname || '—')}</b><button class="fcm-profile-edit" data-profile-nickname-edit ${canEditNickname ? '' : 'disabled'} title="${TH('chatProfileEditNickname')}">${editIcon}</button></div><div class="fcm-profile-nickname-editor" data-profile-nickname-editor hidden><input data-profile-nickname maxlength="20" value="${esc(nickname)}"><button data-profile-nickname-confirm>✓</button><button data-profile-nickname-cancel>×</button></div></div>
                <div class="fcm-chat-profile-line"><span>${TH('chatProfileStatus')}</span><div class="fcm-profile-statuses" data-profile-statuses data-value="${esc(cfg.chatStatus || 'online')}"><button class="${cfg.chatStatus === 'online' ? 'active' : ''}" data-profile-status="online"><i class="online"></i>${TH('chatStatusOnline')}</button><button class="${cfg.chatStatus === 'busy' ? 'active' : ''}" data-profile-status="busy"><i class="busy"></i>${TH('chatStatusBusy')}</button><button class="${cfg.chatStatus === 'afk' ? 'active' : ''}" data-profile-status="afk"><i class="afk"></i>${TH('chatStatusAFK')}</button></div></div>
            </div>
        </div>
        <label class="fcm-chat-profile-field"><span class="fcm-profile-url-label">${TH('chatProfileUrlAvatar')} <span class="fcm-profile-help-wrap"><button type="button" class="fcm-profile-help" aria-label="${esc(T('chatAvatarUrlHelp'))}">?</button><span class="fcm-profile-help-popup" role="tooltip">${esc(T('chatAvatarUrlHelp'))}</span></span></span><input data-profile-avatar-url value="${esc(cfg.chatAvatarUrl || cfg.avatarUrl || '')}" placeholder="https://…"></label>
        <label class="fcm-chat-profile-field"><span>${TH('chatProfileSignature')}</span><textarea data-profile-signature maxlength="100" rows="3">${esc(signature)}</textarea></label>
        <div class="fcm-chat-profile-field"><span>${TH('chatProfileStatusMessage')}</span><div class="fcm-profile-auto-replies">
            <label><b>${TH('chatBusyMessage')}</b><textarea data-profile-busy rows="3">${esc(cfg.busyMessage || mine.busyMessage || '')}</textarea><button class="fcm-chat-switch ${cfg.busyAutoReply ? 'on' : ''}" data-profile-reply="busy"><i></i></button></label>
            <label><b>${TH('chatAfkMessage')}</b><textarea data-profile-afk rows="3">${esc(cfg.afkMessage || mine.afkMessage || '')}</textarea><button class="fcm-chat-switch ${cfg.afkAutoReply ? 'on' : ''}" data-profile-reply="afk"><i></i></button></label>
        </div></div>
        <button data-save-profile>${TH('chatSaveProfile')}</button>
    </div>`;
}

export { isSupportedAvatarUrl, profileHtml };

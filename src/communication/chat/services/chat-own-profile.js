import { isSupportedAvatarUrl } from './chat-avatar-url.js';

function createChatOwnProfileService({ config, saveConfig, getRoot, getPlayer, text, queueAccountUpdate, warn, onSaved }) {
    function save() {
        const root = getRoot();
        const player = getPlayer();
        if (!root || !player) return;
        const signature = root.querySelector('[data-profile-signature]')?.value.trim() || '';
        const avatarInput = root.querySelector('[data-profile-avatar-url]');
        const avatarUrl = avatarInput?.value.trim() || '';
        avatarInput?.setCustomValidity(isSupportedAvatarUrl(avatarUrl) ? '' : text('chatAvatarUrlUnsupported'));
        if (avatarInput && !avatarInput.reportValidity()) return;

        config.avatarUrl = config.chatAvatarUrl = avatarUrl;
        config.busyMessage = root.querySelector('[data-profile-busy]')?.value.trim() || '';
        config.afkMessage = root.querySelector('[data-profile-afk]')?.value.trim() || '';
        config.chatStatus = root.querySelector('[data-profile-statuses]')?.dataset.value || 'online';
        config.avatarMode = config.chatAvatarMode === 'url' ? 'url' : 'game';
        saveConfig();

        try {
            player.OnlineSharedSettings ??= {};
            player.OnlineSharedSettings.FCM ??= {};
            const updatedAt = Date.now();
            Object.assign(player.OnlineSharedSettings.FCM, {
                signature,
                nickname: player.Nickname || '',
                status: config.chatStatus,
                busyMessage: config.busyMessage,
                afkMessage: config.afkMessage,
                avatarMode: config.avatarMode,
                avatarUrl: config.avatarMode === 'url' ? config.avatarUrl : '',
                profileUpdatedAt: updatedAt,
                updatedAt,
            });
            player.OnlineSharedSettings.LCData ??= {};
            player.OnlineSharedSettings.LCData.MessageSetting ??= {};
            Object.assign(player.OnlineSharedSettings.LCData.MessageSetting, {
                Signature: signature,
                Avatar: config.avatarMode === 'url' ? config.avatarUrl : '',
            });
            queueAccountUpdate({ OnlineSharedSettings: player.OnlineSharedSettings });
        } catch (error) {
            warn('LianChat compatibility settings sync failed', error);
        }
        onSaved();
    }

    return { save };
}

export { createChatOwnProfileService };

function createChatPresenceService({ config, saveConfig, getPlayer, syncSharedSettings, onError }) {
    let onlineSignature = '';

    function updateOnlineRows(rows) {
        if (!Array.isArray(rows)) return false;
        const signature = rows
            .map(row => `${Number(row.MemberNumber)}:${row.ChatRoomName || ''}:${row.ChatRoomSpace || ''}:${row.Private ? 1 : 0}`)
            .sort()
            .join('|');
        if (signature === onlineSignature) return false;
        onlineSignature = signature;
        return true;
    }

    function setStatus(status) {
        config.chatStatus = status;
        saveConfig();
        try {
            const player = getPlayer();
            player.OnlineSharedSettings ??= {};
            player.OnlineSharedSettings.FCM ??= {};
            player.OnlineSharedSettings.FCM.status = status;
            player.OnlineSharedSettings.FCM.updatedAt = Date.now();
            syncSharedSettings?.();
        } catch (error) {
            onError(error);
        }
    }

    return { setStatus, updateOnlineRows };
}

export { createChatPresenceService };

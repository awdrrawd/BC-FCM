function createChatRuntime({ config, chatStore, setMessageIndex, getMessageIndex, cleanMessage, profileDb, initAudio, injectStyles, balloons, getRoot, render, refreshSettings, text, contactCard, presence, refreshList, refreshConversationPresence, offlineDelivery, closeChat }) {
    let initPromise = null;
    let blockedNoticeTimer = 0;

    function isVisible() {
        const root = getRoot();
        return !!root?.isConnected && root.style.display !== 'none';
    }

    async function initialize() {
        await chatStore.init();
        setMessageIndex(await chatStore.recentIndex());
        if (config.saveMode !== 'off') {
            await profileDb.init();
            await profileDb.batchGet([...new Set(getMessageIndex().map(message => Number(message.memberNumber)).filter(Boolean))]);
        }
        setMessageIndex(getMessageIndex().map(message => ({ ...message, content: cleanMessage(message.content) })));
        await initAudio();
        injectStyles();
        balloons.ensure();
        window.addEventListener('fcm-theme-change', refreshSettings);
        window.addEventListener('fcm-language-change', () => {
            if (isVisible()) render();
            balloons.ensure();
        });
        window.addEventListener('fcm:bcx-send-blocked', event => {
            const notice = getRoot()?.querySelector('[data-bcx-compose-notice]');
            if (!notice) return;
            notice.textContent = text(event.detail?.channel === 'whisper' ? 'bcxWhisperBlocked' : 'bcxBeepBlocked');
            notice.hidden = false;
            clearTimeout(blockedNoticeTimer);
            blockedNoticeTimer = window.setTimeout(() => { if (notice.isConnected) notice.hidden = true; }, 4000);
        });
        document.addEventListener('pointerdown', contactCard.handleOutsidePointer, true);
    }

    function init() {
        if (!initPromise) initPromise = initialize().catch(error => {
            initPromise = null;
            throw error;
        });
        return initPromise;
    }

    async function updateOnlineFriends(result) {
        if (!config.communicationEnabled || !Array.isArray(result)) return;
        if (presence.updateOnlineRows(result) && isVisible()) {
            refreshList();
            refreshConversationPresence();
        }
        offlineDelivery.dispatch(result);
    }

    function setStatus(status, rerender = true) {
        presence.setStatus(status);
        const dot = getRoot()?.querySelector('.fcm-chat-rail [data-status] .fcm-status-dot');
        if (dot) dot.className = `fcm-status-dot ${status}`;
        if (rerender) render();
    }

    function applySettings() {
        balloons.ensure();
        document.querySelectorAll('.fcm-chat-user-balloon').forEach(balloons.paint);
        document.getElementById('fcm-chat-balloon')?.classList.toggle('persistent', !!config.communicationEnabled && config.balloonPlacement !== 'off');
        if (config.userBalloonPlacement === 'off') document.querySelectorAll('.fcm-chat-user-balloon').forEach(balloon => balloon.remove());
        if (!config.communicationEnabled) {
            closeChat();
            document.querySelectorAll('.fcm-chat-user-balloon').forEach(balloon => balloon.remove());
        } else if (isVisible()) render();
    }

    return { applySettings, init, setStatus, updateOnlineFriends };
}

export { createChatRuntime };

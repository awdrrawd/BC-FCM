function createChatContactCardController({ getRoot, getMemberNumber, loadProfile, renderHtml, hydrateAvatars, findLiveCharacter, deleteSnapshot, loadCharacterCanvas, nextPaint, createFaceSnapshot, saveSnapshot, loadAvatarFromBundle, addFriend, displayName, openProfile }) {
    let openMemberNumber = null;

    function isOpen() {
        return openMemberNumber !== null;
    }

    function close() {
        openMemberNumber = null;
        getRoot()?.querySelector('.fcm-chat-contact-card')?.remove();
    }

    function bind() {
        const root = getRoot();
        root?.querySelector('[data-card-refresh]')?.addEventListener('click', refreshSnapshot);
        root?.querySelector('[data-card-add-friend]')?.addEventListener('click', event => {
            event.stopPropagation();
            const memberNumber = getMemberNumber();
            addFriend(memberNumber, `${displayName(memberNumber)} (${memberNumber})`, false);
        });
        root?.querySelector('[data-card-profile]')?.addEventListener('click', event => {
            event.stopPropagation();
            openProfile(getMemberNumber());
        });
    }

    async function toggle() {
        const root = getRoot();
        const main = root?.querySelector('.fcm-chat-main');
        if (main?.querySelector('.fcm-chat-contact-card')) {
            close();
            return;
        }
        const memberNumber = Number(getMemberNumber());
        if (!memberNumber) return;
        await loadProfile(memberNumber);
        if (Number(getMemberNumber()) !== memberNumber || !main?.isConnected) return;
        openMemberNumber = memberNumber;
        main.querySelector('.fcm-chat-conversation-header')?.insertAdjacentHTML('afterend', renderHtml());
        bind();
        hydrateAvatars();
    }

    async function refreshSnapshot(event) {
        const button = event.currentTarget;
        if (button.disabled) return;
        const memberNumber = Number(getMemberNumber());
        button.disabled = true;
        const avatar = getRoot()?.querySelector('.fcm-chat-contact-card .fcm-chat-avatar');
        avatar?.classList.add('fcm-avatar-loading');
        avatar?.setAttribute('aria-busy', 'true');
        try {
            await deleteSnapshot(memberNumber);
            const live = findLiveCharacter(memberNumber);
            if (live) {
                if (live.MustDraw) loadCharacterCanvas?.(live);
                await nextPaint();
                const fresh = createFaceSnapshot(live, 100);
                if (fresh) await saveSnapshot(memberNumber, fresh, { source: 'manual-room-refresh', sourceUpdatedAt: Date.now() });
            } else {
                await loadAvatarFromBundle(memberNumber, await loadProfile(memberNumber));
            }
            if (Number(getMemberNumber()) !== memberNumber) return;
            const card = getRoot()?.querySelector('.fcm-chat-contact-card');
            if (card) {
                card.outerHTML = renderHtml();
                bind();
                hydrateAvatars();
            }
        } finally {
            button.disabled = false;
            avatar?.classList.remove('fcm-avatar-loading');
            avatar?.removeAttribute('aria-busy');
        }
    }

    function handleOutsidePointer(event) {
        if (!isOpen() || event.target.closest('.fcm-chat-contact-card') || event.target.closest('.fcm-chat-conversation-header > [data-avatar-member]')) return;
        close();
    }

    return { bind, close, handleOutsidePointer, isOpen, toggle };
}

export { createChatContactCardController };

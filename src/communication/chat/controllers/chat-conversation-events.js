function createChatConversationEvents({ getRoot, getMemberNumber, config, saveConfig, closeStackedDetail, composer, historyViewport, forwardTargets, selectedActions, messageSelection, bindMessageActions, replyController, profileSuggestion, conversationActions, roomActions, showRoomJoin, getCachedRoomInfo, contactCard, promptGroupName, createGroup, rerender }) {
    function openHeaderRoom(element) {
        if (!element?.dataset.roomName) return;
        const cached = getCachedRoomInfo(element.dataset.roomName);
        showRoomJoin({
            room: element.dataset.roomName, creator: cached?.Creator || '', count: cached?.MemberCount ?? null,
            limit: cached?.MemberLimit ?? null, desc: cached?.Description || '', priv: !!cached?.Private,
        });
    }

    function assignGroup(groupId, main) {
        const memberNumber = Number(getMemberNumber());
        if (!memberNumber || !groupId) return;
        config.chatMemberGroups ||= {};
        config.chatMemberGroups[memberNumber] ||= [];
        if (!config.chatMemberGroups[memberNumber].includes(groupId)) config.chatMemberGroups[memberNumber].push(groupId);
        saveConfig();
        main.querySelector('[data-assign-menu]')?.classList.remove('open');
    }

    function bind() {
        const root = getRoot();
        const main = root?.querySelector('.fcm-chat-main');
        if (!main) return;
        main.querySelector('[data-back]')?.addEventListener('click', closeStackedDetail);
        main.querySelector('[data-send]')?.addEventListener('click', composer.send);
        historyViewport.bind(main.querySelector('.fcm-chat-messages'), main.querySelector('[data-new-messages]'));
        main.querySelector('[data-multi-forward-contact]')?.addEventListener('click', forwardTargets.show);
        main.querySelector('[data-multi-forward-room]')?.addEventListener('click', selectedActions.forwardToRoom);
        main.querySelectorAll('[data-multi-export]').forEach(button => button.addEventListener('click', () => selectedActions.exportMessages(button.dataset.multiExport)));
        main.querySelector('[data-multi-cancel]')?.addEventListener('click', messageSelection.exit);
        if (messageSelection.isActive()) messageSelection.updateUi();
        bindMessageActions();
        main.querySelector('[data-cancel-reply]')?.addEventListener('click', replyController.clear);
        main.querySelector('[data-input]')?.addEventListener('keydown', composer.handleKeydown);
        main.querySelector('[data-input]')?.addEventListener('input', profileSuggestion.update);
        main.querySelector('[data-delete]')?.addEventListener('click', conversationActions.deleteCurrent);
        main.querySelectorAll('[data-export]').forEach(button => button.addEventListener('click', () => conversationActions.exportCurrent(button.dataset.export)));
        main.querySelector('[data-invite]')?.addEventListener('click', roomActions.inviteCurrent);
        main.querySelector('[data-summon]')?.addEventListener('click', roomActions.summonCurrent);
        main.querySelector('[data-toggle-tools]')?.addEventListener('click', event => {
            event.stopPropagation();
            event.currentTarget.closest('.fcm-chat-tools')?.classList.toggle('open');
        });
        main.querySelectorAll('[data-join-room]').forEach(button => button.addEventListener('click', () => {
            if (button.dataset.joinRoom) showRoomJoin({ room: button.dataset.joinRoom });
        }));
        main.querySelector('[data-room-meta]')?.addEventListener('click', event => openHeaderRoom(event.currentTarget));
        main.querySelector('[data-room-meta]')?.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                openHeaderRoom(event.currentTarget);
            }
        });
        main.querySelector('.fcm-chat-conversation-header > [data-avatar-member]')?.addEventListener('click', contactCard.toggle);
        contactCard.bind();
        const assign = main.querySelector('.fcm-chat-assign');
        assign?.addEventListener('pointerdown', event => event.stopPropagation());
        assign?.addEventListener('click', event => event.stopPropagation());
        main.querySelector('[data-toggle-assign]')?.addEventListener('click', event => {
            event.stopPropagation();
            main.querySelector('[data-assign-menu]')?.classList.toggle('open');
        });
        main.querySelectorAll('button[data-assign-group]').forEach(button => button.addEventListener('click', () => assignGroup(button.dataset.assignGroup, main)));
        main.querySelector('[data-create-group-from-chat]')?.addEventListener('click', async () => {
            const label = await promptGroupName();
            if (!label) return;
            createGroup(label, 'groups');
            rerender();
        });
    }

    return { bind };
}

export { createChatConversationEvents };

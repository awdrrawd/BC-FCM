function createNativeChatTags({ getSelf, openProfile, displayName, text }) {
    function jump(peer, id) {
        const rows = document.querySelectorAll('#TextAreaChatLog [data-fcm-message-id]');
        const target = [...rows].find(row => row.dataset.fcmPeer === String(peer) && row.dataset.fcmMessageId === id);
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.animate?.([{ outline: '2px solid currentColor' }, { outline: '2px solid transparent' }], { duration: 1600 });
    }

    function decorate(element, payload, peer) {
        if (!element || !payload?.id || element.dataset.fcmMessageId) return;
        element.dataset.fcmMessageId = payload.id;
        element.dataset.fcmPeer = String(peer);
        const content = element.querySelector('.chat-room-message-content');
        if (content) {
            const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
            const nodes = [];
            while (walker.nextNode()) {
                if (!walker.currentNode.parentElement.closest('button,a')) nodes.push(walker.currentNode);
            }
            for (const node of nodes) {
                const fragment = document.createDocumentFragment();
                let last = 0;
                for (const match of node.textContent.matchAll(/@([^@\n()]*?)\s*\((\d+)\)|@(\d+)/gu)) {
                    const memberNumber = Number(match[2] || match[3]);
                    const profile = payload.profiles?.find(row => row.memberNumber === memberNumber);
                    if (!profile) continue;
                    fragment.append(node.textContent.slice(last, match.index));
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'fcm-native-profile-tag';
                    button.style.cssText = 'font:inherit;color:inherit;background:transparent;border:0;padding:0 2px;text-decoration:underline;cursor:pointer;';
                    button.textContent = match[0];
                    button.addEventListener('click', event => { event.stopPropagation(); openProfile(memberNumber, profile); });
                    fragment.append(button);
                    last = match.index + match[0].length;
                }
                if (last) { fragment.append(node.textContent.slice(last)); node.replaceWith(fragment); }
            }
        }
        if (payload.replyPreview && payload.replyToId && !element.querySelector('.chat-room-message-reply')) {
            const reply = document.createElement('button');
            reply.type = 'button';
            reply.className = 'chat-room-message-reply fcm-native-reply-tag';
            reply.textContent = `↪ ${payload.replyPreview}`;
            reply.addEventListener('click', event => { event.stopPropagation(); jump(peer, payload.replyToId); });
            element.prepend(reply);
        }
    }

    function appendBeep(payload, peer, outgoing = false) {
        const log = document.getElementById('TextAreaChatLog');
        if (!log) return;
        if ([...log.querySelectorAll('[data-fcm-message-id]')].some(row => row.dataset.fcmPeer === String(peer) && row.dataset.fcmMessageId === payload.id)) return;
        const row = document.createElement('div');
        row.className = 'ChatMessage ChatMessageLocalMessage ChatMessageNonDialogue ChatMessageBeep';
        row.dataset.sender = String(outgoing ? getSelf() : peer);
        row.dataset.target = String(outgoing ? peer : getSelf());
        row.append(`${text(outgoing ? 'chatSent' : 'chatReceived')} · ${displayName(peer)} (${peer}): `);
        const content = document.createElement('span');
        content.className = 'chat-room-message-content';
        content.textContent = payload.content;
        row.append(content);
        decorate(row, payload, peer);
        if (typeof globalThis.ChatRoomAppendChat === 'function') globalThis.ChatRoomAppendChat(row);
        else log.append(row);
    }

    function decorateBeep(element, payload, peer) {
        if (!element?.classList.contains('ChatMessageBeep') || Number(element.dataset.sender) !== peer
            || Number(element.dataset.target) !== Number(getSelf())) return;
        const preview = element.querySelector('.beep-link');
        if (preview) {
            const content = document.createElement('span');
            content.className = 'chat-room-message-content';
            content.textContent = payload.content;
            preview.replaceWith(document.createTextNode(`${displayName(peer)} (${peer}): `), content);
        }
        decorate(element, payload, peer);
    }

    return { decorate, decorateBeep, appendBeep };
}

export { createNativeChatTags };

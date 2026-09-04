import { cfg, saveCfg } from '../../../core/config.js';
import { updateOwnAvatarProfile, updateOwnAvatarSnapshot } from '../../../data/profile-db.js';
import { T } from '../../../i18n/i18n.js';
import { isSupportedAvatarUrl } from '../services/chat-avatar-url.js';

function bindChatProfileEvents({ root, getPlayer, renderChat, saveOwnProfile, setStatus }) {
    root.querySelector('[data-save-profile]')?.addEventListener('click', saveOwnProfile);
    root.querySelector('[data-profile-nickname-edit]')?.addEventListener('click', () => {
        const editor = root.querySelector('[data-profile-nickname-editor]');
        const text = root.querySelector('[data-profile-nickname-text]');
        editor.hidden = false;
        text.hidden = true;
        root.querySelector('[data-profile-nickname-edit]').hidden = true;
        editor.querySelector('input')?.focus();
    });
    root.querySelector('[data-profile-nickname-cancel]')?.addEventListener('click', renderChat);
    root.querySelector('[data-profile-nickname]')?.addEventListener('input', event => {
        const player = getPlayer();
        const value = event.target.value.trim();
        const status = value && typeof globalThis.CharacterValidateNickname === 'function'
            ? globalThis.CharacterValidateNickname(player, value, false)
            : null;
        event.target.setCustomValidity(status ? (typeof globalThis.TextGet === 'function' ? globalThis.TextGet(status) : status) : '');
    });
    root.querySelector('[data-profile-nickname-confirm]')?.addEventListener('click', () => {
        const player = getPlayer();
        const input = root.querySelector('[data-profile-nickname]');
        const nickname = input?.value.trim() || '';
        const status = typeof globalThis.CharacterSetNickname === 'function' ? globalThis.CharacterSetNickname(player, nickname) : null;
        if (status && status !== 'NicknameLocked') {
            input.setCustomValidity(typeof globalThis.TextGet === 'function' ? globalThis.TextGet(status) : status);
            input.reportValidity();
            return;
        }
        cfg.profileNickname = player?.Nickname || nickname;
        saveCfg();
        renderChat();
    });
    root.querySelector('[data-profile-snapshot]')?.addEventListener('click', async event => {
        const player = getPlayer();
        const button = event.currentTarget;
        button.disabled = true;
        const updated = await updateOwnAvatarSnapshot();
        if (updated) {
            const snapshot = player?.OnlineSharedSettings?.FCM?.avatarSnapshot || '';
            const avatar = root.querySelector(`.fcm-chat-profile [data-avatar-member="${Number(player?.MemberNumber)}"]`);
            if (snapshot && avatar) {
                let image = avatar.querySelector('img');
                if (!image) {
                    image = document.createElement('img');
                    image.draggable = false;
                    avatar.insertBefore(image, avatar.firstChild);
                }
                image.src = snapshot;
                [...avatar.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).forEach(node => node.remove());
            }
        }
        button.textContent = updated ? T('chatProfileSnapshotDone') : T('ownAvatarUpdateFailed');
        setTimeout(() => {
            if (button.isConnected) {
                button.disabled = false;
                button.textContent = T('chatProfileSnapshot');
            }
        }, 1800);
    });
    root.querySelector('[data-profile-avatar-url]')?.addEventListener('change', async event => {
        const value = event.target.value.trim();
        event.target.setCustomValidity(isSupportedAvatarUrl(value) ? '' : T('chatAvatarUrlUnsupported'));
        if (!event.target.reportValidity()) return;
        cfg.avatarUrl = cfg.chatAvatarUrl = value;
        saveCfg();
        if (cfg.chatAvatarMode === 'url') {
            await updateOwnAvatarProfile('url', value);
            renderChat();
        }
    });
    root.querySelectorAll('[data-profile-status]').forEach(button => button.addEventListener('click', () => {
        const box = root.querySelector('[data-profile-statuses]');
        box.dataset.value = button.dataset.profileStatus;
        box.querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
        setStatus(button.dataset.profileStatus, false);
    }));
    root.querySelectorAll('[data-profile-reply]').forEach(button => button.addEventListener('click', () => {
        const key = button.dataset.profileReply === 'busy' ? 'busyAutoReply' : 'afkAutoReply';
        cfg[key] = !cfg[key];
        saveCfg();
        button.classList.toggle('on', cfg[key]);
    }));
}

export { bindChatProfileEvents };

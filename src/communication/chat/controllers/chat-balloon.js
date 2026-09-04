import { cfg } from '../../../core/config.js';
import { Snapshot } from '../../../data/profile-db.js';
import { FCM_ICON_SVG } from '../../../ui/icons.js';
import { esc } from '../services/chat-content.js';
import { installChatDrag, resolveBalloonCollision } from './chat-drag.js';

function createChatBalloonController(context) {
    function paint(element) {
        const [panel, text, accent] = context.chatColors();
        element.style.setProperty('--s', panel);
        element.style.setProperty('--tx', text);
        element.style.setProperty('--ac', accent);
    }

    function syncVisibility() {
        const root = context.getRoot();
        const chatVisible = !!root?.isConnected && root.style.display !== 'none';
        const hidden = context.isMaximized() && chatVisible;
        document.querySelectorAll('#fcm-chat-balloon,.fcm-chat-user-balloon').forEach(balloon => {
            balloon.classList.toggle('fcm-hidden-by-chat-maximized', hidden);
            balloon.setAttribute('aria-hidden', hidden ? 'true' : 'false');
        });
    }

    function refreshBadges() {
        const root = context.getRoot();
        const railButton = root?.querySelector('.fcm-chat-rail [data-view="notifications"]');
        const railBadge = railButton?.querySelector('.fcm-chat-unread');
        if (railBadge) {
            const count = context.unreadCount();
            railBadge.textContent = Math.min(count, 99);
            railBadge.classList.toggle('hidden', !count);
        }
        const main = document.querySelector('#fcm-chat-balloon .fcm-chat-unread');
        if (main) {
            const count = context.unreadCount();
            main.textContent = Math.min(count, 99);
            main.classList.toggle('hidden', !count);
        }
        document.querySelectorAll('.fcm-chat-user-balloon').forEach(balloon => {
            const badge = balloon.querySelector('.fcm-chat-unread');
            const count = context.unreadCount(balloon.id.replace('fcm-chat-user-', ''));
            if (badge) {
                badge.textContent = Math.min(count, 99);
                badge.classList.toggle('hidden', !count);
            }
        });
    }

    function place(element, placement, index = 0) {
        const gap = 22 + index * 58;
        element.style.left = element.style.right = element.style.top = element.style.bottom = 'auto';
        if (placement.endsWith('left')) element.style.left = '22px'; else element.style.right = '22px';
        if (placement.startsWith('top')) element.style.top = `${gap}px`;
        else if (placement.startsWith('middle')) element.style.top = `calc(50% - 27px + ${index * 58}px)`;
        else element.style.bottom = `${gap}px`;
        element.style.transform = 'none';
    }

    function placeSaved(element, saved) {
        const maxX = Math.max(0, innerWidth - element.offsetWidth);
        const maxY = Math.max(0, innerHeight - element.offsetHeight);
        element.style.left = `${Math.max(0, Math.min(maxX, saved.x))}px`;
        element.style.top = `${Math.max(0, Math.min(maxY, saved.y))}px`;
        element.style.right = element.style.bottom = 'auto';
    }

    function ensure(force = false) {
        let created = false;
        let balloon = document.getElementById('fcm-chat-balloon');
        if (!balloon) {
            created = true;
            balloon = document.createElement('button');
            balloon.id = 'fcm-chat-balloon';
            balloon.innerHTML = `${context.waterShapeHtml()}<span class="fcm-balloon-icon">${FCM_ICON_SVG}</span>${context.unreadBadge()}<span class="fcm-balloon-preview"><strong>FCM Chat</strong></span>`;
            balloon.title = 'FCM Chat';
            balloon.addEventListener('click', () => { if (!balloon.dataset.dragMoved) context.toggleChat(); });
            document.body.appendChild(balloon);
            installChatDrag(balloon, balloon, { configKey: 'chatBalloonPosition', isMaximized: context.isMaximized });
        }
        paint(balloon);
        const saved = cfg.chatBalloonPosition;
        if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) placeSaved(balloon, saved);
        else place(balloon, cfg.balloonPlacement === 'off' ? 'bottom-right' : cfg.balloonPlacement);
        balloon.classList.toggle('persistent', !!cfg.communicationEnabled && (cfg.balloonPlacement !== 'off' || force));
        syncVisibility();
        if (created) resolveBalloonCollision(balloon);
    }

    function animate(balloon) {
        balloon.classList.add('visible');
        syncVisibility();
        if (!cfg.notificationAnimation) return;
        balloon.classList.remove('notify');
        void balloon.offsetWidth;
        balloon.classList.add('notify');
        balloon.addEventListener('animationend', () => balloon.classList.remove('notify'), { once: true });
    }

    function showIncoming(message) {
        if (cfg.userBalloonPlacement !== 'off') {
            ensure();
            let balloon = document.getElementById(`fcm-chat-user-${message.memberNumber}`);
            if (!balloon) {
                balloon = document.createElement('button');
                balloon.id = `fcm-chat-user-${message.memberNumber}`;
                balloon.className = 'fcm-chat-user-balloon';
                balloon.addEventListener('click', () => { if (!balloon.dataset.dragMoved) context.toggleChat(message.memberNumber); });
                document.body.appendChild(balloon);
                installChatDrag(balloon, balloon, { configKey: 'chatUserBalloonPositions', isMaximized: context.isMaximized });
            }
            paint(balloon);
            const saved = cfg.chatUserBalloonPositions?.[message.memberNumber];
            if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) placeSaved(balloon, saved);
            else place(balloon, cfg.userBalloonPlacement, [...document.querySelectorAll('.fcm-chat-user-balloon')].indexOf(balloon));
            const content = () => `${context.waterShapeHtml()}${context.avatarHtml(message.memberNumber, 50)}${context.unreadBadge(message.memberNumber)}<span class="fcm-balloon-preview"><strong>${esc(context.getDisplayName(message.memberNumber))}</strong>${esc(context.balloonPreviewText(message.content))}</span>`;
            balloon.innerHTML = content();
            requestAnimationFrame(() => resolveBalloonCollision(balloon));
            if (!context.avatarUrl(message.memberNumber)) Snapshot.get(message.memberNumber).then(url => { if (url && balloon.isConnected) balloon.innerHTML = content(); });
            animate(balloon);
        } else if (cfg.balloonPlacement !== 'off') {
            ensure();
            const balloon = document.getElementById('fcm-chat-balloon');
            balloon.querySelector('.fcm-balloon-preview').innerHTML = '<strong>FCM Chat</strong>';
            const badge = balloon.querySelector('.fcm-chat-unread');
            const count = context.unreadCount();
            if (badge) {
                badge.textContent = Math.min(count, 99);
                badge.classList.toggle('hidden', !count);
            }
            animate(balloon);
        }
    }

    return { ensure, paint, refreshBadges, showIncoming, syncVisibility };
}

export { createChatBalloonController };

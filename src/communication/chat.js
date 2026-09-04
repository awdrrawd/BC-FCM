import { cfg, saveCfg } from '../core/config.js';
import { getDisplayName as getSharedDisplayName, getRoomInfo, inRoomFn, onlineFriends, requestOnlineFriends, buildFriendList, getAllRels, isFav, isFriendOf } from '../data/data.js';
import { getCachedRoomInfo, queryRoomInfo } from '../panel/panel-rooms-data.js';
import { PDB, _pc, Snapshot, loadAvatarFromBundle, syncRoomAvatar, updateOwnAvatarSnapshot, updateOwnAvatarProfile } from '../data/profile-db.js';
import { ChatStore, OfflineQueue } from './chat-store.js';
import { T, TH, FCM_LANGS, FCM_LANG_NAMES, FCM_LANG_FLAGS, ensureLang } from '../i18n/i18n.js';
import { chatFontFamily, availableFontChoices } from './chat-font.js';
import { isSupportedAvatarUrl, profileHtml as renderProfileHtml } from './chat-profile.js';
import { chatPanelSession } from './chat-panel-session.js';
import { installDragScroll } from '../ui/drag-scroll.js';
import { applyTheme } from '../panel/styles.js';
import { THEME_KEYS, themeColors } from '../core/themes.js';
import { showAddFriendConfirm, showRoomJoinConfirm, showIncomingRoomInvite } from '../chat/actions.js';
import { canSendBcxWhisper, sendBcxAwareBeep, sendBcxAwareWhisper } from './bcx-compat.js';
import { normalizedImageOrigin, trustImageOrigin } from './image-trust.js';
import { injectChatStyles } from './chat-styles.js';
import { warnLimited } from '../core/logger.js';
import { balloonPreviewText, cleanMessage, esc, messageContentHtml, parseRoomInvite } from './chat-content.js';
import { exportConversation as exportConversationFile } from './chat-export.js';
import { hasCustomNotificationSound, initChatAudio, playNotificationSound, saveCustomNotificationSound } from './chat-audio.js';
import { installChatDrag, resetBalloonInteraction } from './chat-drag.js';
import { ConversationViewport } from './chat-viewport.js';
import { createChatBalloonController } from './chat-balloon.js';
import {
    CHAT_ICON, NOTIFICATION_ICON, GROUP_ICON,
    ALARM_MUTED_ICON, ALARM_ACTIVE_ICON, EXIT_ICON, DOWNLOAD_ICON,
    TRASH_ICON, SPLIT_ICON, MERGE_ICON, EDIT_ICON, SETTINGS_ICON,
    SUMMON_ICON, INVITE_ICON, WATER_ICON, FOLDER_ICON, MAXIMIZE_ICON, REPLY_ICON, ADD_FRIEND_ICON, SEARCH_ICON,
} from '../ui/icons.js';

let root = null;
let selectedMember = null;
let messages = [];
let conversationMessages = [];
let conversationHasMore = false;
let conversationLoading = false;
let conversationUnread = 0;
let historyDateFrame = 0;
const conversationViewport = new ConversationViewport(40);
const CONVERSATION_PAGE_SIZE = 50;
let search = '';
let presenceFilter = 'online';
let relationFilter = '';
let activeView = 'chat';
let notificationTab = 'recent';
let notificationSearch = '';
let selectedGroup = 'room';
let groupMode = 'room';
let groupSearch = '';
let channel = 'beep';
let maximized = false;
let stackedDetail = false;
let suppressOutgoing = 0;
let justOpenedMember = null;
let replyTarget = null;
let contactCardOpen = false;
let bcxNoticeTimer = 0;
let closeContextMenuListener = null;
const pendingReplyTags = new Map();
const pendingMessageIds = new Map();
let onlinePresenceSignature = '';
const autoReplyTimes = new Map();
const offlineQueueInFlight = new Set();
const remoteProfiles = new Map();
const bypassedIncomingWhispers = new WeakSet();

// CHAT 固定使用「暱稱優先、沒有暱稱才用 BC 名稱」，不跟隨 FCM 主面板的名稱切換。
const getDisplayName = memberNumber => getSharedDisplayName(memberNumber, true);
let initialized = false;
const waterShapeHtml = () => `<span class="fcm-water-shape" aria-hidden="true">${WATER_ICON}</span>`;
const chatBalloons = createChatBalloonController({
    avatarHtml: (...args) => avatarHtml(...args),
    avatarUrl: memberNumber => avatarUrl(memberNumber),
    balloonPreviewText,
    chatColors: () => chatColors(),
    getDisplayName,
    getRoot: () => root,
    isMaximized: () => maximized,
    toggleChat: memberNumber => toggleChat(memberNumber),
    unreadBadge: memberNumber => unreadBadge(memberNumber),
    unreadCount: memberNumber => unreadCount(memberNumber),
    waterShapeHtml,
});

function isOnline(memberNumber) {
    const mn = Number(memberNumber);
    if (inRoomFn(mn)) return true;
    if (!isFriendOf(mn)) return false;
    return onlineFriends.some(friend => Number(friend.MemberNumber) === mn);
}

function capability(memberNumber) {
    if (inRoomFn(Number(memberNumber))) return 'whisper';
    if (!isFriendOf(memberNumber)) return 'none';
    return isOnline(memberNumber) ? 'beep' : 'none';
}

function character(memberNumber) {
    return ChatRoomCharacter?.find(c => Number(c.MemberNumber) === Number(memberNumber));
}

function sharedProfile(memberNumber) {
    if (Number(memberNumber) === Number(Player?.MemberNumber)) return Player?.OnlineSharedSettings?.FCM || {};
    return character(memberNumber)?.OnlineSharedSettings?.FCM || {};
}

function biography(memberNumber) {
    const shared = sharedProfile(memberNumber);
    if (typeof shared.signature === 'string' && shared.signature) return shared.signature;
    const lian = Number(memberNumber) === Number(Player?.MemberNumber)
        ? Player?.OnlineSharedSettings?.LCData?.MessageSetting
        : character(memberNumber)?.OnlineSharedSettings?.LCData?.MessageSetting;
    if (typeof lian?.Signature === 'string' && lian.Signature) return lian.Signature;
    return remoteProfiles.get(Number(memberNumber))?.signature || '';
}

function avatarUrl(memberNumber) {
    const shared = sharedProfile(memberNumber);
    if (Number(memberNumber) === Number(Player?.MemberNumber) && cfg.chatAvatarMode !== 'follow') {
        if (cfg.chatAvatarMode === 'url') return cfg.chatAvatarUrl || cfg.avatarUrl || '';
        if (cfg.chatAvatarMode === 'game') return shared.avatarSnapshot || Snapshot._cache[Number(memberNumber)] || '';
    }
    if (shared.avatarMode === 'url' && shared.avatarUrl) return shared.avatarUrl;
    if (shared.avatarMode !== 'none' && shared.avatarSnapshot) return shared.avatarSnapshot;
    return remoteProfiles.get(Number(memberNumber))?.avatarUrl || Snapshot._cache[Number(memberNumber)] || '';
}

function avatarHtml(memberNumber, size = 34, variant = 'normal') {
    const url = avatarUrl(memberNumber);
    const mine = Number(memberNumber) === Number(Player?.MemberNumber);
    const status = mine ? (cfg.chatStatus || 'online') : (isOnline(memberNumber) ? (sharedProfile(memberNumber).status || 'online') : 'offline');
    return `<span class="fcm-chat-avatar fcm-chat-avatar-${variant} ${cfg.chatAvatarShape === 'round' ? 'round' : 'square'}" data-avatar-member="${Number(memberNumber)}" style="width:${size}px;height:${size}px">
        ${url ? `<img src="${esc(url)}" draggable="false">` : esc(getDisplayName(memberNumber).slice(0, 2))}
        <i class="${esc(status)}"></i>
    </span>`;
}

async function hydrateChatAvatars() {
    const avatars = [...(root?.querySelectorAll('[data-avatar-member]') || [])];
    const selfMemberNumber = Number(Player?.MemberNumber);
    const members = [...new Set(avatars.map(element => Number(element.dataset.avatarMember)).filter(memberNumber => memberNumber && memberNumber !== selfMemberNumber))];
    await Promise.all(members.map(async memberNumber => {
        const liveCharacter = character(memberNumber);
        if (liveCharacter) await syncRoomAvatar(liveCharacter);
        const url = await Snapshot.get(memberNumber);
        if (!url) return;
        root?.querySelectorAll(`[data-avatar-member="${memberNumber}"]`).forEach(element => {
            let img = element.querySelector('img');
            if (!img) { img = document.createElement('img'); img.draggable = false; element.insertBefore(img, element.firstChild); }
            if (img.src !== url) img.src = url;
            [...element.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).forEach(node => node.remove());
        });
    }));
}

function chatColors() {
    if (cfg.chatThemeMode === 'custom') return [cfg.chatPanelColor, cfg.chatFontColor, cfg.chatAccentColor];
    return cfg.chatThemeMode === 'preset' ? themeColors(cfg.chatThemePreset) : [cfg.panelColor, cfg.fontColor, cfg.accentColor];
}

async function initChat() {
    if (initialized) return;
    initialized = true;
    await ChatStore.init();
    messages = await ChatStore.prune();
    if (cfg.saveMode !== 'off') {
        await PDB.init();
        await PDB.batchGet([...new Set(messages.map(message => Number(message.memberNumber)).filter(Boolean))]);
    }
    // 舊版本曾把完整隱藏尾碼寫入 IndexedDB；讀取時一併淨化，避免舊資料再次洩漏。
    messages = messages.map(message => ({ ...message, content: cleanMessage(message.content) }));
    await initChatAudio();
    injectChatStyles();
    chatBalloons.ensure();
    // FCM 與 CHAT 是同一套設定的兩個畫面：任一邊改主題/語言都要讓另一邊即時反映，
    // 不必（也不應該）整個重建 — 分別掛勾兩個共用事件，各自只重繪自己負責的畫面。
    window.addEventListener('fcm-theme-change', refreshChatSettings);
    window.addEventListener('fcm-language-change', () => { if (root?.isConnected && root.style.display !== 'none') renderChat(); chatBalloons.ensure(); });
    window.addEventListener('fcm:bcx-send-blocked', event => {
        const notice = root?.querySelector('[data-bcx-compose-notice]');
        if (!notice) return;
        notice.textContent = T(event.detail?.channel === 'whisper' ? 'bcxWhisperBlocked' : 'bcxBeepBlocked');
        notice.hidden = false;
        clearTimeout(bcxNoticeTimer);
        bcxNoticeTimer = window.setTimeout(() => { if (notice.isConnected) notice.hidden = true; }, 4000);
    });
    document.addEventListener('pointerdown', event => {
        if (!contactCardOpen || event.target.closest('.fcm-chat-contact-card') || event.target.closest('.fcm-chat-conversation-header > [data-avatar-member]')) return;
        contactCardOpen = false;
        root?.querySelector('.fcm-chat-contact-card')?.remove();
    }, true);
}

function normalizeMessage(data) {
    return {
        id: data.id || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
        memberNumber: Number(data.memberNumber),
        direction: data.direction,
        channel: data.channel,
        content: cleanMessage(data.content),
        roomName: data.roomName || '',
        name: getDisplayName(data.memberNumber),
        timestamp: Number(data.timestamp) || Date.now(),
        read: data.direction === 'out' || Number(data.memberNumber) === selectedMember,
        queued: !!data.queued,
        queueId: data.queueId || '',
        nativeMsgId: data.nativeMsgId || '',
        translatedContent: cleanMessage(data.translatedContent || ''),
        replyPreview: cleanMessage(data.replyPreview || ''),
        replyToId: data.replyToId || '',
        sharedMsgId: data.sharedMsgId || '',
    };
}

async function recordMessage(data, { notify = true } = {}) {
    if (!cfg.communicationEnabled || !data?.memberNumber) return;
    const message = normalizeMessage(data);
    if (!message.content) return;
    await ChatStore.put(message);
    messages = await ChatStore.prune();
    if (root?.isConnected && root.style.display !== 'none') {
        if (Number(message.memberNumber) === Number(selectedMember)) {
            if (!conversationMessages.some(row => row.id === message.id)) conversationMessages.push(message);
            appendConversationMessage(message);
        }
        refreshVisibleChatScroll();
    }
    if (notify && message.direction === 'in') {
        chatBalloons.showIncoming(message);
        playNotificationSound();
        sendStatusAutoReply(message);
    }
}

function sendStatusAutoReply(message) {
    const status = cfg.chatStatus;
    const content = status === 'busy' && cfg.busyAutoReply ? cfg.busyMessage : status === 'afk' && cfg.afkAutoReply ? cfg.afkMessage : '';
    if (!content || Date.now() - (autoReplyTimes.get(message.memberNumber) || 0) < 60000) return;
    autoReplyTimes.set(message.memberNumber, Date.now());
    suppressOutgoing++;
    let sent = false;
    try {
        if (message.channel === 'whisper' && inRoomFn(message.memberNumber)) sent = sendBcxAwareWhisper({ Type: 'Whisper', Target: message.memberNumber, Content: content });
        else if (isOnline(message.memberNumber)) sent = sendBcxAwareBeep({ MemberNumber: message.memberNumber, BeepType: '', Message: content });
    } finally { suppressOutgoing--; }
    if (sent) recordMessage({ memberNumber: message.memberNumber, direction: 'out', channel: message.channel, content }, { notify: false });
}

function handleIncomingBeep(data) {
    if (!data || !data.Message) return;
    if (data.BeepType === 'LCPlayerInfo' || data.BeepType === 'FCMPlayerInfo') {
        try {
            const info = JSON.parse(data.Message);
            remoteProfiles.set(Number(data.MemberNumber), { avatarUrl: info.avatarUrl || info.Avatar || '', signature: info.signature || info.Signature || '', status: info.status || 'online', updatedAt: Number(info.updatedAt || info.UpdateTime) || Date.now() });
        } catch (error) { warnLimited('LianChat profile payload parse failed', error); }
        return;
    }
    const invite = parseRoomInvite(data.Message);
    if (invite) {
        const roomName = invite.roomName || data.ChatRoomName;
        const content = roomName;
        recordMessage({ memberNumber: data.MemberNumber, name: data.MemberName, direction: 'in', channel: 'beep', content, roomName });
        showIncomingRoomInvite(data.MemberNumber, getDisplayName(data.MemberNumber), { room: roomName, creator: invite.creator || '', count: invite.count ?? null, limit: invite.limit ?? null, desc: invite.desc || '', priv: !!invite.priv, type: invite.type || '' });
        return;
    }
    // Ordinary private messages can arrive as BeepType "Message".
    if (data.BeepType && !['Message', 'Beep'].includes(data.BeepType)) return;
    recordMessage({ memberNumber: data.MemberNumber, name: data.MemberName, direction: 'in', channel: 'beep', content: data.Message });
}

function handleIncomingWhisper(data) {
    if (!data || data.Type !== 'Whisper' || !data.Content || Number(data.Sender) === Number(Player?.MemberNumber)) return;
    recordMessage({ memberNumber: data.Sender, direction: 'in', channel: 'whisper', content: data.Content, timestamp: data.Time });
    bypassedIncomingWhispers.add(data);
}

function handleIncomingWhisperDisplay(data, displayedMessage, senderCharacter) {
    if (!data || data.Type !== 'Whisper') return;
    if (bypassedIncomingWhispers.delete(data)) return;
    const idEntry = Array.isArray(data.Dictionary) ? data.Dictionary.find(entry => entry?.Tag === 'MsgId' && entry.MsgId) : null;
    if (Number(data.Sender) === Number(Player?.MemberNumber)) {
        const target = Number(data.Target);
        const pending = [...messages].reverse().find(message => message.direction === 'out' && message.channel === 'whisper'
            && message.memberNumber === target && !message.nativeMsgId && Date.now() - message.timestamp < 30000);
        if (pending && idEntry?.MsgId) {
            pending.nativeMsgId = idEntry.MsgId;
            ChatStore.put(pending);
            root?.querySelector(`[data-msg-id="${CSS.escape(String(pending.id))}"]`)?.setAttribute('data-native-msg-id', idEntry.MsgId);
        }
        return;
    }
    let content = String(displayedMessage ?? data.Content ?? '');
    const garble = Array.isArray(data.Dictionary)
        ? data.Dictionary.find(entry => Array.isArray(entry?.Effects) && entry.Effects.includes('gagGarble') && entry.Original)
        : null;
    const translatedContent = garble?.Original && cleanMessage(garble.Original) !== cleanMessage(content) ? garble.Original : '';
    const nativeReply = Array.isArray(data.Dictionary) ? data.Dictionary.find(entry => entry?.Tag === 'ReplyId')?.ReplyId : '';
    const pendingTag = pendingReplyTags.get(Number(data.Sender));
    const replyTag = pendingTag && (!nativeReply || !pendingTag.replyId || pendingTag.replyId === nativeReply) ? pendingTag : null;
    if (replyTag) pendingReplyTags.delete(Number(data.Sender));
    const sharedMsgId = pendingMessageIds.get(Number(data.Sender)) || '';
    pendingMessageIds.delete(Number(data.Sender));
    recordMessage({ memberNumber: senderCharacter?.MemberNumber ?? data.Sender, direction: 'in', channel: 'whisper', content, translatedContent, timestamp: data.Time, nativeMsgId: idEntry?.MsgId || '', replyPreview: replyTag?.preview || '', replyToId: replyTag?.targetSharedId || '', sharedMsgId });
}

function handleIncomingChatTag(data) {
    const tag = Array.isArray(data?.Dictionary) ? data.Dictionary.find(entry => entry?.Tag === 'FCM::CHAT::TAG') : null;
    if (!tag || !data.Sender) return false;
    pendingReplyTags.set(Number(data.Sender), { preview: cleanMessage(tag.Preview || ''), replyId: tag.ReplyId || '', targetSharedId: tag.TargetSharedId || '' });
    return true;
}

function handleIncomingChatMessageId(data) {
    const tag = Array.isArray(data?.Dictionary) ? data.Dictionary.find(entry => entry?.Tag === 'FCM::CHAT::MESSAGE') : null;
    if (!tag?.MessageId || !data.Sender) return false;
    pendingMessageIds.set(Number(data.Sender), String(tag.MessageId));
    return true;
}

function handleIncomingFriendRequestNotice(data) {
    recordMessage({ memberNumber: data.MemberNumber, name: getDisplayName(data.MemberNumber), direction: 'in', channel: 'beep', content: `📩 ${TH('friendReqIncoming', `${getDisplayName(data.MemberNumber)} (${data.MemberNumber})`)}` });
}

function handleOutgoingServerSend(type, data) {
    if (!cfg.communicationEnabled || suppressOutgoing || !data) return;
    if (type === 'AccountBeep' && data.MemberNumber && data.Message && !data.BeepType) {
        recordMessage({ memberNumber: data.MemberNumber, direction: 'out', channel: 'beep', content: data.Message }, { notify: false });
    } else if (type === 'ChatRoomChat' && data.Type === 'Whisper' && data.Target && data.Content) {
        recordMessage({ memberNumber: data.Target, direction: 'out', channel: 'whisper', content: data.Content }, { notify: false });
    }
}

function conversations() {
    const map = new Map();
    const self = Number(Player?.MemberNumber);
    for (const message of messages) {
        if (Number(message.memberNumber) === self) continue;
        const row = map.get(message.memberNumber);
        if (!row || row.timestamp < message.timestamp) map.set(message.memberNumber, { ...message, unread: row?.unread || 0 });
        if (message.direction === 'in' && !message.read) map.get(message.memberNumber).unread++;
    }
    for (const friend of buildFriendList()) {
        if (Number(friend.mn) === self) continue;
        if (!map.has(Number(friend.mn))) map.set(Number(friend.mn), { memberNumber: Number(friend.mn), content: '', timestamp: 0, unread: 0 });
    }
    return [...map.values()].sort((a, b) => b.timestamp - a.timestamp);
}

function unreadCount(memberNumber = null) {
    return messages.filter(message => message.direction === 'in' && !message.read && (memberNumber == null || message.memberNumber === Number(memberNumber))).length;
}

function unreadBadge(memberNumber = null) {
    const count = unreadCount(memberNumber);
    return `<b class="fcm-chat-unread ${count ? '' : 'hidden'}">${Math.min(count, 99)}</b>`;
}

function recentConversations() {
    return conversations().filter(row => row.timestamp).slice(0, 30);
}

function historyMessages() {
    const self = Number(Player?.MemberNumber);
    return messages.filter(message => Number(message.memberNumber) !== self).sort((a, b) => b.timestamp - a.timestamp).slice(0, 100);
}

async function openChat(memberNumber = null) {
    if (!cfg.communicationEnabled) return false;
    if (Number(memberNumber) === Number(Player?.MemberNumber)) memberNumber = null;
    if (memberNumber) {
        selectedMember = Number(memberNumber);
        replyTarget = null;
        channel = inRoomFn(selectedMember) ? 'whisper' : 'beep';
        stackedDetail = true;
    }
    if (!root?.isConnected) {
        root = document.createElement('div');
        root.id = 'fcm-chat-root';
        document.body.appendChild(root);
    }
    root.style.display = 'block';
    requestOnlineFriends();
    if (selectedMember) await ChatStore.markRead(selectedMember);
    messages = await ChatStore.prune();
    if (selectedMember) await loadConversation(selectedMember);
    chatBalloons.refreshBadges();
    renderChat();
    return true;
}

function toggleChat(memberNumber = null) {
    if (root?.isConnected && root.style.display !== 'none') minimizeChat();
    else {
        if (memberNumber) activeView = 'chat';
        else { activeView = 'notifications'; stackedDetail = false; }
        openChat(memberNumber);
    }
}

function minimizeChat() {
    if (root) root.style.display = 'none';
    chatBalloons.syncVisibility();
    chatBalloons.ensure(true);
}

function filteredNotificationRows(rows) {
    const query = notificationSearch.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter(row => `${getDisplayName(row.memberNumber)} ${row.memberNumber} ${biography(row.memberNumber)} ${cleanMessage(row.content)}`.toLowerCase().includes(query));
}

function closeChat() {
    const memberToClose = selectedMember;
    selectedMember = null;
    replyTarget = null;
    stackedDetail = false;
    if (root) root.style.display = 'none';
    chatBalloons.syncVisibility();
    document.querySelectorAll('#fcm-chat-balloon,.fcm-chat-user-balloon').forEach(resetBalloonInteraction);
    if (memberToClose) document.getElementById(`fcm-chat-user-${memberToClose}`)?.remove();
    const balloon = document.getElementById('fcm-chat-balloon');
    if (!cfg.persistentBalloon) balloon?.remove();
    else if (!balloon) chatBalloons.ensure();
    else {
        // 關閉視窗只恢復外觀，不重新套用儲存座標或執行貼邊落位。
        chatBalloons.paint(balloon);
        balloon.classList.toggle('persistent', !!cfg.communicationEnabled);
    }
}

function filteredContacts() {
    return conversations().filter(row => {
        if (presenceFilter === 'online' ? !isOnline(row.memberNumber) : isOnline(row.memberNumber)) return false;
        if (relationFilter === 'follow' && !isFav(row.memberNumber)) return false;
        if (relationFilter && relationFilter !== 'follow') {
            const roles = getAllRels(row.memberNumber);
            if (relationFilter === 'owner' ? !roles.some(role => role === 'owner' || role === 'lover') : !roles.includes(relationFilter)) return false;
        }
        return !search || `${getDisplayName(row.memberNumber)} ${biography(row.memberNumber)}`.toLowerCase().includes(search.toLowerCase());
    });
}

function contactRows(rows, { history = false } = {}) {
    return rows.map(row => {
        const memberNumber = Number(row.memberNumber);
        const direction = row.direction === 'out' ? T('chatSent') : T('chatReceived');
        const subtitle = history ? `${direction}: ${cleanMessage(row.content)}` : biography(memberNumber);
        return `<button class="fcm-chat-row ${selectedMember === memberNumber ? 'selected' : ''} ${justOpenedMember === memberNumber ? 'just-opened' : ''}" data-member="${memberNumber}">
            ${avatarHtml(memberNumber)}
            <span class="fcm-chat-row-meta"><b>${esc(getDisplayName(memberNumber))}</b><small>${esc(subtitle)}</small></span>
            ${history || row.timestamp ? `<time>${row.timestamp ? new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</time>` : ''}
            ${row.unread ? `<em>${row.unread}</em>` : ''}
        </button>`;
    }).join('');
}

function notificationsHtml() {
    const rows = filteredNotificationRows(notificationTab === 'recent' ? recentConversations() : historyMessages());
    return `<div class="fcm-chat-search"><input data-notification-search value="${esc(notificationSearch)}" placeholder="${TH('chatSearchPlayers')}"></div>
    <div class="fcm-chat-subtabs">
        <button class="${notificationTab === 'recent' ? 'active' : ''}" data-notification-tab="recent">${TH('chatRecent')}</button>
        <button class="${notificationTab === 'history' ? 'active' : ''}" data-notification-tab="history">${TH('chatHistory')}</button>
    </div>
    <div class="fcm-chat-scroll">${contactRows(rows, { history: true }) || `<div class="fcm-chat-empty">${TH('chatNoRecord')}</div>`}</div>`;
}

function groupDefinitions() {
    const roomMembers = (ChatRoomCharacter || []).filter(c => Number(c.MemberNumber) !== Number(Player?.MemberNumber)).map(c => Number(c.MemberNumber));
    const favorites = buildFriendList().map(f => Number(f.mn)).filter(isFav);
    const contacts = buildFriendList().map(f => Number(f.mn));
    const manual = Object.entries(cfg.chatGroups || {}).map(([id, label]) => ({
        id, label, members: Object.entries(cfg.chatMemberGroups || {}).filter(([, groups]) => Array.isArray(groups) && groups.includes(id)).map(([mn]) => Number(mn)),
    }));
    return { room: { id: 'room', label: T('chatRoom'), members: roomMembers }, groups: [
        { id: 'favorites', label: T('chatFavorites'), members: favorites },
        { id: 'contacts', label: T('chatAllContacts'), members: contacts }, ...manual,
    ] };
}

function groupsHtml() {
    const definitions = groupDefinitions();
    const group = groupMode === 'room' ? definitions.room : (definitions.groups.find(item => item.id === selectedGroup) || definitions.groups[0]);
    const rows = filteredGroupRows(group);
    return `<div class="fcm-chat-search"><input data-group-search value="${esc(groupSearch)}" placeholder="${TH('chatSearchPlayers')}"></div>
        <div class="fcm-chat-subtabs"><button class="${groupMode === 'room' ? 'active' : ''}" data-group-mode="room">${TH('chatRoom')}</button><button class="${groupMode === 'groups' ? 'active' : ''}" data-group-mode="groups">${TH('chatGroupsTab')}</button></div>
        ${groupMode === 'groups' ? `<div class="fcm-chat-group-tabs"><button class="fcm-chat-group-add" data-add-group>＋</button>${definitions.groups.map(item => `<button class="${item.id === group.id ? 'active' : ''}" data-group="${item.id}">${esc(item.label)}</button>`).join('')}</div>` : ''}
        <div class="fcm-chat-scroll">${contactRows(rows) || `<div class="fcm-chat-empty">${TH('chatGroupEmpty')}</div>`}</div>`;
}

function settingsHtml() {
    const languageOpts = FCM_LANGS.map(value => `<option value="${esc(value)}" ${String(cfg.lang || 'auto').toLowerCase() === value.toLowerCase() ? 'selected' : ''}>${esc(FCM_LANG_FLAGS[value] || '')} ${esc(FCM_LANG_NAMES[value] || value)}</option>`).join('');
    const sounds = [['', T('off')], ['Audio/BeepAlarm.mp3','BeepAlarm'], ['Audio/BellMedium.mp3','BellMedium'], ['Audio/Belt1.mp3','Belt1'], ['Audio/VibrationTone4ShortLoop.mp3','VibrationTone4ShortLoop'], ['custom', T('chatSoundCustom')]];
    const soundEnabled = !!cfg.notificationAudio && !!cfg.notificationSound && (cfg.notificationSound !== 'custom' || hasCustomNotificationSound());
    const themeKeys = THEME_KEYS;
    const placementOptions = current => [['off', T('balloonOff')], ['top-left', `⬉ ${T('balloonTopLeft')}`], ['middle-left', `⭠ ${T('balloonMiddleLeft')}`], ['bottom-left', `⬋ ${T('balloonBottomLeft')}`], ['top-right', `⬈ ${T('balloonTopRight')}`], ['middle-right', `⭢ ${T('balloonMiddleRight')}`], ['bottom-right', `⬊ ${T('balloonBottomRight')}`]]
        .map(([value, label]) => `<option value="${esc(value)}" ${current === value ? 'selected' : ''}>${esc(label)}</option>`).join('');
    const currentThemeName = cfg.chatThemeMode === 'follow' ? T('chatThemeFollow') : cfg.chatThemeMode === 'custom' ? T('themeCustom') : T(`themePreset_${cfg.chatThemePreset || 'violet'}`);
    const fontFamilies = availableFontChoices();
    return `<div class="fcm-chat-settings fcm-set-like">
            <div class="fcm-chat-setting-row"><span><b>${TH('langLabel')}</b></span><select class="fcm-chat-language" data-chat-language>${languageOpts}</select></div>
            <div class="fcm-chat-setting-row"><span><b>${TH('themeSettingsLabel')}</b><small>${TH('chatThemeNote')}</small></span><button class="fcm-chat-theme-manage" data-chat-theme-manage>${TH('themeSettingsLabel')} · ${esc(currentThemeName)}</button></div>
            <div class="fcm-chat-theme-options" data-chat-theme-options hidden><div class="fcm-chat-theme-presets"><button class="${cfg.chatThemeMode === 'follow' ? 'active' : ''}" data-chat-theme-follow>${TH('chatThemeFollow')}</button>${themeKeys.map(value => `<button class="${cfg.chatThemeMode === 'preset' && cfg.chatThemePreset === value ? 'active' : ''}" data-chat-theme-preset="${value}">${TH(`themePreset_${value}`)}</button>`).join('')}</div><div class="fcm-chat-theme-colors"><label>${TH('themePanelColor')}<input type="color" data-chat-theme-color="chatPanelColor" value="${esc(cfg.chatPanelColor)}"></label><label>${TH('themeFontColor')}<input type="color" data-chat-theme-color="chatFontColor" value="${esc(cfg.chatFontColor)}"></label><label>${TH('themeAccentColor')}<input type="color" data-chat-theme-color="chatAccentColor" value="${esc(cfg.chatAccentColor)}"></label></div></div>
            <div class="fcm-chat-setting-row"><span><b>${TH('chatFontFamily')}</b><small>${TH('chatFontFamilyNote')}</small></span><div class="fcm-chat-font-controls"><input data-chat-font-size type="number" min="10" max="24" step="1" value="${Number(cfg.chatFontSize) || 13}" title="${TH('chatFontSize')}"><select data-chat-font-family>${fontFamilies.map(([value,label]) => `<option value="${esc(value)}" ${cfg.chatFontFamily === value ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></div></div>
            <div class="fcm-chat-setting-row"><span><b>${TH('chatTakeover')}</b><small>${TH('chatTakeoverNote')}</small></span><button class="fcm-chat-switch ${cfg.takeoverFcmChatButtons ? 'on' : ''}" data-setting="takeover"><i></i></button></div>
            <div class="fcm-chat-setting-row"><span><b>${TH('bypassBcxCommunication')}</b><small>${TH('bypassBcxCommunicationNote')}</small></span><button class="fcm-chat-switch ${cfg.bypassBcxCommunication ? 'on' : ''}" data-setting="bcxBypass"><i></i></button></div>
            <div class="fcm-chat-setting-row"><span><b>${TH('chatPersistentBalloon')}</b><small>${TH('chatPersistentBalloonNote')}</small></span><select data-balloon-placement>${placementOptions(cfg.balloonPlacement)}</select></div>
            <div class="fcm-chat-setting-row"><span><b>${TH('chatIndividualBalloons')}</b><small>${TH('chatIndividualBalloonsNote')}</small></span><select data-user-balloon-placement>${placementOptions(cfg.userBalloonPlacement)}</select></div>
            <div class="fcm-chat-setting-row"><span><b>${TH('balloonSnap')}</b><small>${TH('balloonSnapNote')}</small></span><button class="fcm-chat-switch ${cfg.balloonSnap ? 'on' : ''}" data-setting="balloonSnap"><i></i></button></div>
            <div class="fcm-chat-setting-row"><span><b>${TH('chatNotifyAnim')}</b><small>${TH('chatNotifyAnimNote')}</small></span><button class="fcm-chat-switch ${cfg.notificationAnimation ? 'on' : ''}" data-setting="animation"><i></i></button></div>
            <div class="fcm-chat-setting-row"><span><b>${TH('chatSoundLabel')}</b><small>${TH('chatSoundNote')}</small></span><div class="fcm-chat-sound-control"><button data-preview-sound ${soundEnabled ? '' : 'disabled'}>${soundEnabled ? ALARM_ACTIVE_ICON : ALARM_MUTED_ICON}</button><select data-chat-sound>${sounds.map(([value,label]) => `<option value="${esc(value)}" ${(!cfg.notificationAudio && !value) || (cfg.notificationAudio && cfg.notificationSound === value) ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select><input data-custom-sound type="file" accept="audio/*" hidden></div></div>
            <div class="fcm-chat-setting-row"><span><b>${TH('chatAvatarShapeLabel')}</b><small>${TH('chatAvatarShapeNote')}</small></span><select data-chat-avatar-shape><option value="round" ${cfg.chatAvatarShape === 'round' ? 'selected' : ''}>${TH('chatAvatarShapeRound')}</option><option value="square" ${cfg.chatAvatarShape !== 'round' ? 'selected' : ''}>${TH('chatAvatarShapeSquare')}</option></select></div>
            <div class="fcm-chat-setting-row"><span><b>${TH('chatAvatarSourceLabel')}</b><small>${TH('chatAvatarSourceNote')}</small></span><select data-chat-avatar-mode><option value="follow" ${cfg.chatAvatarMode === 'follow' ? 'selected' : ''}>${TH('chatAvatarFollow')}</option><option value="url" ${cfg.chatAvatarMode === 'url' ? 'selected' : ''}>${TH('chatAvatarUrl')}</option><option value="game" ${cfg.chatAvatarMode === 'game' ? 'selected' : ''}>${TH('chatAvatarGame')}</option></select></div>
            <div class="fcm-chat-setting-row"><span><b>${TH('chatAvatarUrlLabel')}</b><small>${TH('chatAvatarUrlNote')}</small></span><input data-chat-avatar-url value="${esc(cfg.chatAvatarUrl || '')}" placeholder="https://…"></div>
        </div>`;
}

function profileHtml() {
    return renderProfileHtml({ Player, cfg, T, TH, esc, avatarHtml, editIcon: EDIT_ICON });
}

function chatListHtml() {
    return `<div class="fcm-chat-search"><input data-search value="${esc(search)}" placeholder="${TH('chatSearchPlayers')}"></div>
        <div class="fcm-chat-subtabs"><button class="${presenceFilter === 'online' ? 'active' : ''}" data-presence="online">${TH('chatPresenceOnline')}</button><button class="${presenceFilter === 'offline' ? 'active' : ''}" data-presence="offline">${TH('chatPresenceOffline')}</button></div>
        <div class="fcm-chat-tags"><button class="${relationFilter === 'owner' ? 'active' : ''}" data-rel="owner">${TH('chatRelOwnerLover')}</button><button class="${relationFilter === 'sub' ? 'active' : ''}" data-rel="sub">${TH('chatRelSub')}</button><button class="${relationFilter === 'follow' ? 'active' : ''}" data-rel="follow">${TH('chatRelFollow')}</button></div>
        <div class="fcm-chat-scroll">${contactRows(filteredContacts()) || `<div class="fcm-chat-empty">${TH('chatEmptyCategory')}</div>`}</div>`;
}

function listHtml() {
    if (activeView === 'profile') return profileHtml();
    if (activeView === 'notifications') return notificationsHtml();
    if (activeView === 'groups') return groupsHtml();
    if (activeView === 'settings') return settingsHtml();
    return chatListHtml();
}

function conversationRoomState(memberNumber) {
    const roomInfo = getRoomInfo(memberNumber);
    const sameRoom = inRoomFn(Number(memberNumber));
    const friend = isFriendOf(memberNumber);
    const privateRoom = friend && !!roomInfo?.isPrivate && !roomInfo?.isCurrent;
    const roomText = sameRoom
        ? (roomInfo?.name || ChatRoomData?.Name || T('chatMainHall'))
        : !friend
            ? T('chatNotFriend')
            : privateRoom
                ? T('roomPrivateLabel')
                : roomInfo?.name || (isOnline(memberNumber) ? T('chatMainHall') : T('chatOffline'));
    return {
        roomInfo,
        roomText,
        friend,
        sameRoom,
        unavailable: !sameRoom && !friend,
        canOpenRoom: friend && !!roomInfo?.name && !privateRoom,
    };
}

function conversationHtml() {
    if (!selectedMember) return `<div class="fcm-chat-empty">${TH('chatSelectPlayer')}</div>`;
    const available = capability(selectedMember);
    const { roomInfo, roomText: baseRoomText, canOpenRoom, unavailable } = conversationRoomState(selectedMember);
    const cachedRoom = roomInfo?.name ? getCachedRoomInfo(roomInfo.name) : null;
    const memberCount = roomInfo?.isCurrent ? (ChatRoomCharacter?.length ?? null) : (roomInfo?.memberCount ?? cachedRoom?.MemberCount ?? null);
    const memberLimit = roomInfo?.isCurrent ? (ChatRoomData?.MemberLimit ?? null) : (roomInfo?.memberLimit ?? cachedRoom?.MemberLimit ?? null);
    const roomCount = memberCount !== null && memberCount !== undefined ? ` ＜${memberCount}${memberLimit !== null && memberLimit !== undefined ? `/${memberLimit}` : ''}＞` : '';
    const roomText = canOpenRoom ? `${roomInfo.name}${roomCount}` : baseRoomText;
    const rows = conversationMessages;
    const online = available !== 'none';
    const showNotFriendBadge = !isFriendOf(selectedMember) && !unavailable;
    const inputPlaceholder = unavailable ? T('noBeepNotFriend') : !online ? T('chatOfflineQueuePlaceholder') : available === 'whisper' ? T('chatWhisperInputPlaceholder') : T('chatPrivateInputPlaceholder');
    return `<header class="fcm-chat-conversation-header">
        ${cfg.chatLayout === 'stacked' ? `<button class="fcm-chat-back fcm-chat-icon-action" data-back title="${TH('chatBack')}">${EXIT_ICON}</button>` : ''}
        ${avatarHtml(selectedMember, 38, 'conversation')}
        <span class="fcm-chat-conversation-meta"><span class="fcm-chat-name-line"><b>${esc(getDisplayName(selectedMember))} (${selectedMember})${showNotFriendBadge ? `<i class="fcm-chat-not-friend">${TH('chatNotFriend')}</i>` : ''}</b><small data-room-meta="${selectedMember}" title="${esc(roomText)}" ${canOpenRoom ? `data-room-name="${esc(roomInfo.name)}" role="button" tabindex="0"` : ''}>${esc(roomText)}</small></span><small class="fcm-chat-bio"><i>${esc(biography(selectedMember) || '-')}</i></small></span>
        <button class="fcm-chat-header-action fcm-chat-icon-action" data-summon ${!ChatRoomData || !online || inRoomFn(selectedMember) ? 'disabled' : ''} title="${TH('beepSummon')}">${SUMMON_ICON}</button>
        <div class="fcm-chat-assign"><button class="fcm-chat-rail-button" data-toggle-assign title="${TH('chatAssignGroup')}">${GROUP_ICON}</button><div class="fcm-chat-assign-menu" data-assign-menu>${Object.entries(cfg.chatGroups || {}).map(([id,label]) => `<button data-assign-group="${esc(id)}">${esc(label)}</button>`).join('')}<button class="create" data-create-group-from-chat>＋ ${TH('chatNewGroup')}</button></div></div>
    </header>
    ${contactCardOpen ? contactCardHtml() : ''}
    <div class="fcm-chat-messages">${conversationMessagesHtml(rows) || `<div class="fcm-chat-empty">${TH('chatNoMessages')}</div>`}</div>
    <div class="fcm-chat-history-date" data-history-date hidden></div>
    <button class="fcm-chat-new-messages" data-new-messages ${conversationUnread ? '' : 'hidden'}>${TH('chatNewUnread', conversationUnread)}</button>
    <div class="fcm-chat-actions"><button class="fcm-chat-icon-action" data-invite ${available === 'none' || inRoomFn(selectedMember) ? 'disabled' : ''} title="${TH('chatInviteRoom')}" aria-label="${TH('chatInviteRoom')}">${INVITE_ICON}</button><span></span><div class="fcm-chat-tools"><div class="fcm-chat-tools-menu"><button class="fcm-chat-icon-action" data-export="html" title="${TH('chatExportHtml')}">${DOWNLOAD_ICON}<span>${TH('chatExportHtml')}</span></button><button class="fcm-chat-icon-action" data-export="json" title="${TH('chatExportJson')}">${DOWNLOAD_ICON}<span>${TH('chatExportJson')}</span></button><button class="fcm-chat-icon-action" data-delete title="${TH('chatDeleteAll')}">${TRASH_ICON}<span>${TH('chatDeleteAll')}</span></button></div><button class="fcm-chat-icon-action" data-toggle-tools title="${TH('chatMessageTools')}">${FOLDER_ICON}</button></div></div>
    <div class="fcm-chat-compose">
        <div class="fcm-chat-compose-notice" data-bcx-compose-notice hidden></div>
        <div class="fcm-chat-channels ${online ? '' : 'offline'}"><button class="${available === 'whisper' ? 'active' : ''}" data-channel="whisper" ${available !== 'whisper' ? 'disabled' : ''}>${TH('btnWhisper')}</button><button class="${available === 'beep' ? 'active' : ''}" data-channel="beep" ${available !== 'beep' ? 'disabled' : ''}>${TH('btnBeep')}</button></div>
        <div class="fcm-chat-input-wrap">${replyTarget ? `<div class="fcm-chat-reply-indicator"><span>${TH('chatReply')}: ${esc(replyTarget.preview)}</span><button data-cancel-reply title="${TH('chatCancel')}">×</button></div>` : ''}<div class="fcm-chat-profile-suggest" data-profile-suggest hidden></div><textarea data-input rows="2" placeholder="${esc(inputPlaceholder)}"></textarea></div>
        <button data-send ${unavailable ? 'disabled' : ''}>${online ? TH('chatSend') : TH('chatQueueSend')}</button>
    </div>`;
}

function messageHtml(message) {
    const kind = message.channel === 'whisper' && cleanMessage(message.content).startsWith('*') ? ' emote' : message.channel === 'whisper' && cleanMessage(message.content).startsWith('(') ? ' ooc' : '';
    return `<div class="fcm-chat-message ${message.direction}${kind} ${message.queued ? 'queued' : ''}" data-msg-id="${esc(message.id)}" data-message-date="${esc(messageDateKey(message.timestamp))}" data-shared-msg-id="${esc(message.sharedMsgId || message.id)}" data-native-msg-id="${esc(message.nativeMsgId || '')}"><button class="fcm-chat-message-reply" data-message-reply title="${TH('chatReply')}">${REPLY_ICON}</button>${message.replyPreview ? `<button class="fcm-chat-tag-preview" data-reply-jump="${esc(message.replyToId || '')}">${REPLY_ICON}<i>${esc(message.replyPreview)}</i></button>` : ''}<span class="fcm-chat-content">${profileMentionsHtml(cleanMessage(message.content))}</span>${message.translatedContent ? `<span class="fcm-chat-message-original">[${esc(cleanMessage(message.translatedContent))}]</span>` : ''}${message.roomName ? `<button class="fcm-chat-room-join" data-join-room="${esc(message.roomName)}">${TH('roomJoinRoomBtn')}</button>` : ''}<time>${message.channel === 'whisper' ? TH('chatChannelWhisper') : TH('chatChannelPrivate')} · ${new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${message.queued ? ` · ${TH('chatQueued')}` : ''}</time></div>`;
}

function contactCardHtml() {
    const hasProfile = !!_pc[Number(selectedMember)]?.characterBundle;
    return `<section class="fcm-chat-contact-card">${avatarHtml(selectedMember, 100, 'card')}<div><b>${esc(getDisplayName(selectedMember))} (${selectedMember})</b><small>${esc(biography(selectedMember) || T('chatNoBiography'))}</small><span class="fcm-chat-card-actions"><button data-card-refresh>${TH('chatProfileSnapshot')}</button>${hasProfile ? `<button class="fcm-chat-card-search" data-card-profile title="${TH('btnViewProfile')}">${SEARCH_ICON}</button>` : ''}${isFriendOf(selectedMember) ? '' : `<button data-card-add-friend title="${TH('addFriend')}">${ADD_FRIEND_ICON}${TH('addFriend')}</button>`}</span></div></section>`;
}

function profileMentionsHtml(content) {
    const pattern = /@([^@\n()]*?)\s*\((\d+)\)|@(\d+)/gu;
    let html = '', last = 0;
    for (const match of String(content).matchAll(pattern)) {
        html += messageContentHtml(String(content).slice(last, match.index));
        const mn = match[2] || match[3];
        html += `<button class="fcm-chat-profile-mention" data-profile-member="${mn}">${esc(match[0])}</button>`;
        last = match.index + match[0].length;
    }
    return html + messageContentHtml(String(content).slice(last));
}

function expandProfileMentions(content) {
    return String(content).replace(/@(\d+)/gu, (all, id) => `@${getDisplayName(Number(id))} (${id})`);
}

function messageDateKey(timestamp) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function messageDateLabel(timestamp) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

function conversationMessagesHtml(rows) {
    let previousDate = '';
    return rows.map(message => {
        const date = messageDateKey(message.timestamp);
        const separator = date !== previousDate ? `<div class="fcm-chat-date-separator" data-message-date="${esc(date)}"><span>${esc(messageDateLabel(message.timestamp))}</span></div>` : '';
        previousDate = date;
        return separator + messageHtml(message);
    }).join('');
}

function visibleChatScrollHtml() {
    if (activeView === 'notifications') {
        const rows = filteredNotificationRows(notificationTab === 'recent' ? recentConversations() : historyMessages());
        return contactRows(rows, { history: true }) || `<div class="fcm-chat-empty">${TH('chatNoRecord')}</div>`;
    }
    if (activeView === 'chat') return contactRows(filteredContacts()) || `<div class="fcm-chat-empty">${TH('chatEmptyCategory')}</div>`;
    if (activeView === 'groups') {
        const definitions = groupDefinitions();
        const group = groupMode === 'room' ? definitions.room : (definitions.groups.find(item => item.id === selectedGroup) || definitions.groups[0]);
        return contactRows(filteredGroupRows(group)) || `<div class="fcm-chat-empty">${TH('chatGroupEmpty')}</div>`;
    }
    return null;
}

function filteredGroupRows(group) {
    return (group?.members || []).filter(memberNumber => !groupSearch || `${getDisplayName(memberNumber)} ${biography(memberNumber)}`.toLowerCase().includes(groupSearch.toLowerCase())).map(memberNumber => ({ memberNumber, timestamp: 0, unread: 0 }));
}

function refreshVisibleChatScroll() {
    const html = visibleChatScrollHtml();
    const scroll = root?.querySelector('.fcm-chat-list .fcm-chat-scroll');
    if (html === null || !scroll) return;
    const scrollTop = scroll.scrollTop;
    scroll.innerHTML = html;
    scroll.scrollTop = scrollTop;
    bindMemberRows(scroll);
    hydrateChatAvatars();
}

function bindMessageImages(scope, log) {
    scope?.querySelectorAll?.('.fcm-chat-image').forEach(image => {
        image.addEventListener('load', () => {
            // Image decoding can increase the message height after the message was
            // appended. Keep following only while the user has not left the bottom.
            if (log && conversationViewport.followingLatest) conversationViewport.scrollToLatest(log);
        }, { once: true });
        image.addEventListener('error', () => {
            const link = image.closest('a');
            if (!link) return;
            link.className = 'fcm-chat-link';
            link.textContent = link.href;
        }, { once: true });
    });
    scope?.querySelectorAll?.('[data-trust-image-origin]').forEach(button => {
        button.addEventListener('click', async () => {
            const origin = normalizedImageOrigin(button.dataset.trustImageOrigin);
            if (!origin || !await showFcmConfirm(T('chatTrustImagePrompt', origin), T('chatTrustImage'))) return;
            trustImageOrigin(origin);
            renderChat();
        });
    });
}

function appendConversationMessage(message) {
    const log = root?.querySelector('.fcm-chat-main .fcm-chat-messages');
    if (!log || log.querySelector(`[data-msg-id="${CSS.escape(String(message.id))}"]`)) return;
    // This must be captured before inserting the new row. Measuring afterwards
    // makes the new row itself look like the user scrolled away from the bottom.
    const shouldFollowLatest = conversationViewport.shouldFollow(log, message.direction);
    log.querySelector(':scope > .fcm-chat-empty')?.remove();
    const previousElement = [...log.querySelectorAll(':scope > .fcm-chat-message')].at(-1);
    const previousMessage = previousElement ? conversationMessages.find(row => String(row.id) === previousElement.dataset.msgId) : null;
    if (!previousMessage || messageDateKey(previousMessage.timestamp) !== messageDateKey(message.timestamp)) {
        log.insertAdjacentHTML('beforeend', `<div class="fcm-chat-date-separator" data-message-date="${esc(messageDateKey(message.timestamp))}"><span>${esc(messageDateLabel(message.timestamp))}</span></div>`);
    }
    log.insertAdjacentHTML('beforeend', messageHtml(message));
    const inserted = log.lastElementChild;
    inserted?.querySelector('[data-join-room]')?.addEventListener('click', event => {
        const room = event.currentTarget.dataset.joinRoom;
        if (room) showRoomJoinConfirm({ room });
    });
    bindMessageImages(inserted, log);
    if (shouldFollowLatest) {
        conversationViewport.follow();
        conversationUnread = 0;
        requestAnimationFrame(() => { conversationViewport.scrollToLatest(log); updateConversationUnreadNotice(); });
    } else {
        conversationUnread++;
        updateConversationUnreadNotice();
    }
}

async function loadConversation(memberNumber) {
    const target = Number(memberNumber);
    conversationLoading = true;
    const page = await ChatStore.page(target, { limit: CONVERSATION_PAGE_SIZE });
    if (Number(selectedMember) === target) {
        conversationMessages = page.messages.map(message => ({ ...message, content: cleanMessage(message.content) }));
        conversationHasMore = page.hasMore;
        conversationUnread = 0;
        conversationViewport.follow();
    }
    conversationLoading = false;
}

async function loadOlderConversation(log) {
    if (!selectedMember || conversationLoading || !conversationHasMore || !conversationMessages.length) return;
    conversationLoading = true;
    const target = Number(selectedMember);
    const oldHeight = log.scrollHeight;
    const oldTop = log.scrollTop;
    const page = await ChatStore.page(target, { before: conversationMessages[0].timestamp, limit: CONVERSATION_PAGE_SIZE });
    if (Number(selectedMember) === target && page.messages.length) {
        const existing = new Set(conversationMessages.map(message => message.id));
        const older = page.messages.filter(message => !existing.has(message.id));
        conversationMessages = [...older, ...conversationMessages];
        log.innerHTML = conversationMessagesHtml(conversationMessages);
        bindMessageImages(log, log);
        log.querySelectorAll('[data-join-room]').forEach(button => button.addEventListener('click', () => {
            if (button.dataset.joinRoom) showRoomJoinConfirm({ room: button.dataset.joinRoom });
        }));
        log.scrollTop = oldTop + (log.scrollHeight - oldHeight);
        updateHistoryDateBubble(log);
        conversationHasMore = page.hasMore;
    } else if (Number(selectedMember) === target) conversationHasMore = false;
    conversationLoading = false;
}

function updateConversationUnreadNotice() {
    const button = root?.querySelector('[data-new-messages]');
    if (!button) return;
    button.hidden = !conversationUnread;
    button.textContent = T('chatNewUnread', conversationUnread);
}

function updateHistoryDateBubble(log) {
    const bubble = root?.querySelector('[data-history-date]');
    if (!log || !bubble) return;
    cancelAnimationFrame(historyDateFrame);
    historyDateFrame = requestAnimationFrame(() => {
        const distanceFromLatest = log.scrollHeight - log.scrollTop - log.clientHeight;
        if (distanceFromLatest <= 24) {
            bubble.hidden = true;
            return;
        }
        const logTop = log.getBoundingClientRect().top;
        const current = [...log.querySelectorAll(':scope > .fcm-chat-message')].find(message => message.getBoundingClientRect().bottom > logTop + 4);
        if (!current?.dataset.messageDate) {
            bubble.hidden = true;
            return;
        }
        const [year, month, day] = current.dataset.messageDate.split('-');
        bubble.textContent = `${year}/${month}/${day}`;
        bubble.hidden = false;
    });
}

function refreshConversationRoomMeta() {
    if (!selectedMember) return;
    const { roomInfo, canOpenRoom } = conversationRoomState(selectedMember);
    if (!canOpenRoom || roomInfo.isCurrent || roomInfo.isPrivate) return;
    const friend = onlineFriends.find(item => Number(item.MemberNumber) === selectedMember);
    queryRoomInfo(roomInfo.name, friend?.ChatRoomSpace, data => {
        const meta = root?.querySelector(`[data-room-meta="${selectedMember}"]`);
        if (!meta || selectedMember !== Number(meta.dataset.roomMeta)) return;
        const count = data?.MemberCount;
        const limit = data?.MemberLimit;
        const roomText = `${roomInfo.name}${count !== null && count !== undefined ? ` ＜${count}${limit !== null && limit !== undefined ? `/${limit}` : ''}＞` : ''}`;
        meta.textContent = roomText;
        meta.title = roomText;
    });
}

function refreshConversationPresence() {
    if (!selectedMember) return;
    const available = capability(selectedMember);
    const { roomInfo, roomText, canOpenRoom, unavailable } = conversationRoomState(selectedMember);
    const meta = root?.querySelector(`[data-room-meta="${selectedMember}"]`);
    if (meta) {
        meta.textContent = roomText;
        meta.title = roomText;
        if (canOpenRoom) {
            meta.dataset.roomName = roomInfo.name;
            meta.setAttribute('role', 'button');
            meta.tabIndex = 0;
        } else {
            delete meta.dataset.roomName;
            meta.removeAttribute('role');
            meta.removeAttribute('tabindex');
        }
    }
    const online = available !== 'none';
    if (available !== 'none') channel = available;
    const status = online ? (sharedProfile(selectedMember).status || 'online') : 'offline';
    const dot = root?.querySelector(`.fcm-chat-conversation-header [data-avatar-member="${selectedMember}"] i`);
    if (dot) dot.className = status;
    const summon = root?.querySelector('[data-summon]');
    if (summon) summon.disabled = !ChatRoomData || !online || inRoomFn(selectedMember);
    const whisper = root?.querySelector('[data-channel="whisper"]');
    const beep = root?.querySelector('[data-channel="beep"]');
    if (whisper) { whisper.disabled = available !== 'whisper'; whisper.classList.toggle('active', available === 'whisper'); }
    if (beep) { beep.disabled = available !== 'beep'; beep.classList.toggle('active', available === 'beep'); }
    const input = root?.querySelector('[data-input]');
    if (input) input.placeholder = unavailable ? T('noBeepNotFriend') : !online ? T('chatOfflineQueuePlaceholder') : channel === 'whisper' && inRoomFn(selectedMember) ? T('chatWhisperInputPlaceholder') : T('chatPrivateInputPlaceholder');
    const send = root?.querySelector('[data-send]');
    if (send) {
        send.textContent = online ? T('chatSend') : T('chatQueueSend');
        send.disabled = unavailable;
    }
    refreshConversationRoomMeta();
}

function renderChat() {
    if (!root) return;
    const settingsScrollTop = activeView === 'settings' ? root.querySelector('.fcm-chat-list')?.scrollTop : null;
    const [chatPanel, chatText, chatAccent] = chatColors();
    const sessionSizeStyle = chatPanelSession.inlineSizeStyle();
    root.innerHTML = `<div id="fcm-chat-panel" class="${maximized ? 'maximized' : ''}" data-layout-mode="${esc(cfg.chatLayout || 'split')}" data-theme="${esc(cfg.chatThemeMode === 'preset' ? cfg.chatThemePreset : cfg.chatThemeMode === 'custom' ? 'custom' : cfg.themePreset || 'violet')}" style="${sessionSizeStyle}--s:${esc(chatPanel)};--tx:${esc(chatText)};--ac:${esc(chatAccent)};--chat-font-size:${Number(cfg.chatFontSize) || 13}px;--chat-font-family:${esc(chatFontFamily())}">
        <div class="fcm-chat-titlebar"><b>FCM-Chat</b><span></span><button class="fcm-chat-icon-action ${cfg.chatLayout === 'stacked' ? 'active' : ''}" data-layout title="${TH('chatToggleLayout')}">${cfg.chatLayout === 'stacked' ? SPLIT_ICON : MERGE_ICON}<i>${cfg.chatLayout === 'stacked' ? TH('chatLayoutSplit') : TH('chatLayoutMerged')}</i></button><button class="fcm-chat-icon-action ${maximized ? 'active' : ''}" data-max title="${TH('chatToggleMax')}">${MAXIMIZE_ICON}<i>${maximized ? TH('chatRestore') : TH('chatMaximize')}</i></button><button class="fcm-chat-icon-action" data-min title="${TH('chatMinimize')}">—</button><button class="fcm-chat-icon-action" data-close title="${TH('chatClose')}">×</button></div>
        <div class="fcm-chat-body view-${esc(activeView)} ${cfg.chatLayout === 'stacked' ? 'stacked' : ''} ${activeView === 'profile' || activeView === 'settings' ? 'wide-view' : ''}">
            <nav class="fcm-chat-rail">
                <button class="fcm-chat-rail-button fcm-chat-self ${activeView === 'profile' ? 'active' : ''}" data-view="profile" title="${TH('chatProfileTab')}">${avatarHtml(Player?.MemberNumber || 0, 34, 'toolbar')}</button>
                <button class="fcm-chat-rail-button ${activeView === 'notifications' ? 'active' : ''}" data-view="notifications" title="${TH('chatNotificationsTab')}">${NOTIFICATION_ICON}${unreadBadge()}</button>
                <button class="fcm-chat-rail-button ${activeView === 'chat' ? 'active' : ''}" data-view="chat" title="${TH('chatChatTab')}">${CHAT_ICON}</button>
                <button class="fcm-chat-rail-button ${activeView === 'groups' ? 'active' : ''}" data-view="groups" title="${TH('chatGroupsTab')}">${GROUP_ICON}</button>
                <span></span>
                <button class="fcm-chat-rail-button" data-status title="${TH('chatStatusTab')}"><i class="fcm-status-dot ${esc(cfg.chatStatus || 'online')}"></i></button>
                <button class="fcm-chat-rail-button ${activeView === 'settings' ? 'active' : ''}" data-view="settings" title="${TH('chatSettingsTab')}">${SETTINGS_ICON}</button>
            </nav>
            <aside class="fcm-chat-list ${stackedDetail ? 'slide-out' : ''}">${listHtml()}</aside>
            <main class="fcm-chat-main ${stackedDetail ? 'slide-in' : ''}">${conversationHtml()}</main>
        </div>
        <div class="fcm-chat-status-menu"><button data-status-value="online"><i class="online"></i>${TH('chatStatusOnline')}</button><button data-status-value="busy"><i class="busy"></i>${TH('chatStatusBusy')}</button><button data-status-value="afk"><i class="afk"></i>${TH('chatStatusAFK')}</button></div>
        <div class="fcm-chat-context-menu" hidden><button data-context-reply>${TH('chatReply')}</button><button data-context-select>${TH('chatSelectMessage')}</button><button data-context-copy>${TH('chatCopy')}</button><button data-context-cancel>${TH('chatCancel')}</button></div>
    </div>`;
    positionPanel();
    chatBalloons.syncVisibility();
    bindEvents();
    installDragScroll(root, '.fcm-chat-scroll,.fcm-chat-messages,.fcm-chat-profile,.fcm-chat-body.view-settings .fcm-chat-list');
    refreshConversationRoomMeta();
    hydrateChatAvatars();
    const log = root.querySelector('.fcm-chat-messages');
    if (log) {
        bindMessageImages(log, log);
        conversationViewport.follow();
        conversationViewport.scrollToLatest(log);
    }
    if (settingsScrollTop !== null && settingsScrollTop !== undefined) {
        const settingsList = root.querySelector('.fcm-chat-list');
        if (settingsList) settingsList.scrollTop = settingsScrollTop;
    }
    requestAnimationFrame(() => { const bio = root?.querySelector('.fcm-chat-bio'); if (bio) bio.classList.toggle('marquee', bio.scrollWidth > bio.clientWidth); });
}

function animateLayoutChange(list, main, beforeList, beforeMain, stacked, showDetail) {
    if (!list || !main || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const duration = 320;
    const easing = 'cubic-bezier(.4,0,.2,1)';
    const afterList = list.getBoundingClientRect();
    const afterMain = main.getBoundingClientRect();
    if (stacked && showDetail) {
        const visibleWidth = Math.max(1, beforeList.width);
        const hiddenRight = Math.max(0, afterList.width - visibleWidth);
        list.style.visibility = 'visible';
        const listAnimation = list.animate([
            { transform: 'translateX(0)', clipPath: `inset(0 ${hiddenRight}px 0 0)`, opacity: 1 },
            { transform: `translateX(-${visibleWidth}px)`, clipPath: `inset(0 ${hiddenRight}px 0 0)`, opacity: .35 },
        ], { duration, easing });
        const resetVisibility = () => { list.style.visibility = ''; };
        listAnimation.onfinish = resetVisibility;
        listAnimation.oncancel = resetVisibility;
        main.animate([
            { transformOrigin: 'right center', transform: `translateX(${beforeMain.left - afterMain.left}px) scaleX(${Math.max(.01, beforeMain.width / afterMain.width)})` },
            { transformOrigin: 'right center', transform: 'none' },
        ], { duration, easing });
    } else if (!stacked && beforeMain.width > afterMain.width) {
        list.animate([
            { transform: `translateX(-${afterList.width}px)`, opacity: .35 },
            { transform: 'translateX(0)', opacity: 1 },
        ], { duration, easing });
        main.animate([
            { transformOrigin: 'right center', transform: `translateX(${beforeMain.left - afterMain.left}px) scaleX(${Math.max(.01, beforeMain.width / afterMain.width)})` },
            { transformOrigin: 'right center', transform: 'none' },
        ], { duration, easing });
    }
}

function animatePanelSize(panel, before) {
    if (!panel) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { panel.classList.remove('fcm-size-animating'); return; }
    const after = panel.getBoundingClientRect();
    const beforeCenterX = before.left + before.width / 2;
    const beforeCenterY = before.top + before.height / 2;
    const afterCenterX = after.left + after.width / 2;
    const afterCenterY = after.top + after.height / 2;
    const animation = panel.animate([
        { translate: `${beforeCenterX - afterCenterX}px ${beforeCenterY - afterCenterY}px`, scale: `${before.width / after.width} ${before.height / after.height}` },
        { translate: '0 0', scale: '1 1' },
    ], { duration: 360, easing: 'cubic-bezier(.2,.8,.2,1)' });
    const finish = () => panel.classList.remove('fcm-size-animating');
    animation.onfinish = finish;
    animation.oncancel = finish;
}

function bindMemberRows(scope = root) {
    scope?.querySelectorAll('[data-member]').forEach(button => button.addEventListener('click', async () => {
        selectedMember = Number(button.dataset.member);
        replyTarget = null;
        contactCardOpen = false;
        justOpenedMember = selectedMember;
        channel = inRoomFn(selectedMember) ? 'whisper' : 'beep';
        stackedDetail = true;
        await ChatStore.markRead(selectedMember);
        messages = await ChatStore.prune();
        await loadConversation(selectedMember);
        chatBalloons.refreshBadges();
        renderChat();
        setTimeout(() => { justOpenedMember = null; }, 350);
    }));
}

function bindEvents() {
    const panel = root.querySelector('#fcm-chat-panel');
    chatPanelSession.observe(panel, () => maximized);
    installChatDrag(panel, panel.querySelector('.fcm-chat-titlebar'), { configKey: 'chatPanelPosition', isMaximized: () => maximized });
    root.querySelector('[data-close]')?.addEventListener('click', closeChat);
    root.querySelector('[data-min]')?.addEventListener('click', minimizeChat);
    root.querySelector('[data-max]')?.addEventListener('click', event => {
        event.stopPropagation();
        const before = panel.getBoundingClientRect();
        panel.classList.add('fcm-size-animating');
        maximized = !maximized; panel.classList.toggle('maximized', maximized);
        event.currentTarget.classList.toggle('active', maximized); const label=event.currentTarget.querySelector('i'); if(label) label.textContent=maximized?T('chatRestore'):T('chatMaximize');
        chatBalloons.syncVisibility();
        animatePanelSize(panel, before);
    });
    root.querySelector('button[data-layout]')?.addEventListener('click', event => {
        event.stopPropagation();
        const body = panel.querySelector('.fcm-chat-body');
        const list = body?.querySelector('.fcm-chat-list');
        const main = body?.querySelector('.fcm-chat-main');
        const beforeList = list?.getBoundingClientRect();
        const beforeMain = main?.getBoundingClientRect();
        cfg.chatLayout = cfg.chatLayout === 'stacked' ? 'split' : 'stacked';
        stackedDetail = cfg.chatLayout === 'stacked' && !!selectedMember;
        saveCfg();
        const stacked = cfg.chatLayout === 'stacked';
        const button = event.currentTarget;
        panel.dataset.layoutMode = cfg.chatLayout;
        button.classList.toggle('active', stacked);
        button.innerHTML = `${stacked ? SPLIT_ICON : MERGE_ICON}<i>${stacked ? TH('chatLayoutSplit') : TH('chatLayoutMerged')}</i>`;
        body?.classList.toggle('stacked', stacked);
        list?.classList.toggle('slide-out', stackedDetail);
        main?.classList.toggle('slide-in', stackedDetail);
        syncConversationBackButton(main, stacked);
        if (beforeList && beforeMain) animateLayoutChange(list, main, beforeList, beforeMain, stacked, stackedDetail);
    });
    root.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => { activeView = button.dataset.view; stackedDetail = false; renderChat(); }));
    root.querySelectorAll('[data-notification-tab]').forEach(button => button.addEventListener('click', () => { notificationTab = button.dataset.notificationTab; renderChat(); }));
    root.querySelectorAll('[data-group]').forEach(button => button.addEventListener('click', () => { selectedGroup = button.dataset.group; renderChat(); }));
    root.querySelector('[data-add-group]')?.addEventListener('click', async () => {
        const label = await showGroupNameDialog(); if (!label) return;
        const id = `group-${Date.now().toString(36)}`; cfg.chatGroups ||= {}; cfg.chatGroups[id] = label; selectedGroup = id; saveCfg(); renderChat();
    });
    root.querySelectorAll('[data-group-mode]').forEach(button => button.addEventListener('click', () => { groupMode = button.dataset.groupMode; renderChat(); }));
    root.querySelector('[data-group-search]')?.addEventListener('input', event => { groupSearch = event.target.value; refreshVisibleChatScroll(); });
    root.querySelector('[data-notification-search]')?.addEventListener('input', event => { notificationSearch = event.target.value; refreshVisibleChatScroll(); });
    root.querySelector('[data-search]')?.addEventListener('input', event => {
        search = event.target.value; refreshVisibleChatScroll();
    });
    root.querySelectorAll('[data-presence]').forEach(button => button.addEventListener('click', () => { presenceFilter = button.dataset.presence; renderChat(); }));
    root.querySelectorAll('[data-rel]').forEach(button => button.addEventListener('click', () => { relationFilter = relationFilter === button.dataset.rel ? '' : button.dataset.rel; renderChat(); }));
    bindMemberRows();
    root.querySelector('[data-back]')?.addEventListener('click', () => { stackedDetail = false; renderChat(); });
    root.querySelectorAll('[data-channel]').forEach(button => button.addEventListener('click', () => { if (!button.disabled) { channel = button.dataset.channel; renderChat(); } }));
    root.querySelector('[data-send]')?.addEventListener('click', sendCurrentMessage);
    const conversationLog = root.querySelector('.fcm-chat-messages');
    conversationLog?.addEventListener('scroll', () => {
        if (conversationLog.scrollTop < 80) loadOlderConversation(conversationLog);
        if (conversationViewport.updateFromScroll(conversationLog) && conversationUnread) {
            conversationUnread = 0;
            updateConversationUnreadNotice();
        }
        updateHistoryDateBubble(conversationLog);
    });
    root.querySelector('[data-new-messages]')?.addEventListener('click', () => {
        conversationViewport.follow();
        conversationViewport.scrollToLatest(conversationLog);
        conversationUnread = 0;
        updateConversationUnreadNotice();
    });
    bindMessageActions();
    root.querySelector('[data-cancel-reply]')?.addEventListener('click', clearReplyTarget);
    root.querySelector('[data-input]')?.addEventListener('keydown', event => { event.stopPropagation(); if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendCurrentMessage(); } });
    root.querySelector('[data-input]')?.addEventListener('input', updateProfileSuggestion);
    root.querySelector('[data-delete]')?.addEventListener('click', deleteConversation);
    root.querySelectorAll('[data-export]').forEach(button => button.addEventListener('click', () => exportConversationFile(button.dataset.export, {
        memberNumber: selectedMember,
        getDisplayName,
        biography,
        avatarUrl,
        chatColors,
    })));
    root.querySelector('[data-invite]')?.addEventListener('click', inviteCurrent);
    root.querySelector('[data-summon]')?.addEventListener('click', summonCurrent);
    root.querySelector('[data-toggle-tools]')?.addEventListener('click', event => { event.stopPropagation(); event.currentTarget.closest('.fcm-chat-tools')?.classList.toggle('open'); });
    root.querySelectorAll('[data-join-room]').forEach(button => button.addEventListener('click', () => {
        if (button.dataset.joinRoom) showRoomJoinConfirm({ room: button.dataset.joinRoom });
    }));
    const openHeaderRoom = element => {
        if (!element?.dataset.roomName) return;
        const cached = getCachedRoomInfo(element.dataset.roomName);
        showRoomJoinConfirm({ room: element.dataset.roomName, creator: cached?.Creator || '', count: cached?.MemberCount ?? null, limit: cached?.MemberLimit ?? null, desc: cached?.Description || '', priv: !!cached?.Private });
    };
    root.querySelector('[data-room-meta]')?.addEventListener('click', event => openHeaderRoom(event.currentTarget));
    root.querySelector('[data-room-meta]')?.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openHeaderRoom(event.currentTarget); } });
    root.querySelector('.fcm-chat-conversation-header > [data-avatar-member]')?.addEventListener('click', toggleContactCard);
    bindContactCardEvents();
    panel.addEventListener('click', event => {
        if (contactCardOpen && !event.target.closest('.fcm-chat-contact-card') && !event.target.closest('.fcm-chat-conversation-header > [data-avatar-member]')) {
            contactCardOpen = false;
            root.querySelector('.fcm-chat-contact-card')?.remove();
        }
        if (!event.target.closest('.fcm-chat-message')) panel.querySelectorAll('.fcm-chat-message.selected').forEach(element => element.classList.remove('selected'));
    });
    const assign = root.querySelector('.fcm-chat-assign');
    assign?.addEventListener('pointerdown', event => event.stopPropagation());
    assign?.addEventListener('click', event => event.stopPropagation());
    root.querySelector('[data-toggle-assign]')?.addEventListener('click', event => { event.stopPropagation(); root.querySelector('[data-assign-menu]')?.classList.toggle('open'); });
    root.querySelectorAll('button[data-assign-group]').forEach(button => button.addEventListener('click', () => {
        if (!selectedMember || !button.dataset.assignGroup) return;
        cfg.chatMemberGroups ||= {}; cfg.chatMemberGroups[selectedMember] ||= [];
        if (!cfg.chatMemberGroups[selectedMember].includes(button.dataset.assignGroup)) cfg.chatMemberGroups[selectedMember].push(button.dataset.assignGroup);
        saveCfg(); root.querySelector('[data-assign-menu]')?.classList.remove('open');
    }));
    root.querySelector('[data-create-group-from-chat]')?.addEventListener('click', async () => {
        const label = await showGroupNameDialog(); if (!label) return;
        const id = `group-${Date.now().toString(36)}`; cfg.chatGroups ||= {}; cfg.chatGroups[id] = label; selectedGroup = id; groupMode = 'groups'; saveCfg(); renderChat();
    });
    root.querySelector('[data-status]')?.addEventListener('click', () => root.querySelector('.fcm-chat-status-menu')?.classList.toggle('open'));
    root.querySelectorAll('[data-status-value]').forEach(button => button.addEventListener('click', () => setStatus(button.dataset.statusValue)));
    root.querySelectorAll('[data-setting]').forEach(button => button.addEventListener('click', () => {
        if (button.dataset.setting === 'takeover') cfg.takeoverFcmChatButtons = !cfg.takeoverFcmChatButtons;
        if (button.dataset.setting === 'bcxBypass') cfg.bypassBcxCommunication = !cfg.bypassBcxCommunication;
        if (button.dataset.setting === 'animation') cfg.notificationAnimation = !cfg.notificationAnimation;
        if (button.dataset.setting === 'balloonSnap') cfg.balloonSnap = !cfg.balloonSnap;
        saveCfg(); refreshChatSettings(); if (root?.style.display !== 'none') renderChat();
    }));
    root.querySelector('[data-balloon-placement]')?.addEventListener('change', event => {
        cfg.balloonPlacement = event.target.value; cfg.persistentBalloon = cfg.balloonPlacement !== 'off'; cfg.chatBalloonPosition = null; saveCfg(); refreshChatSettings();
    });
    root.querySelector('[data-user-balloon-placement]')?.addEventListener('change', event => {
        cfg.userBalloonPlacement = event.target.value; cfg.individualBalloons = cfg.userBalloonPlacement !== 'off'; cfg.chatUserBalloonPositions = {}; saveCfg(); refreshChatSettings();
    });
    root.querySelector('[data-chat-language]')?.addEventListener('change', async event => {
        cfg.lang = event.target.value; saveCfg(); await ensureLang(cfg.lang); renderChat();
        window.dispatchEvent(new CustomEvent('fcm-language-change'));
    });
    root.querySelector('[data-chat-sound]')?.addEventListener('change', event => {
        const value = event.target.value;
        if (value === 'custom' && !hasCustomNotificationSound()) { event.target.value = cfg.notificationAudio ? (cfg.notificationSound || '') : ''; root.querySelector('[data-custom-sound]')?.click(); return; }
        cfg.notificationSound = value; cfg.notificationAudio = !!value; saveCfg(); renderChat();
    });
    root.querySelector('[data-preview-sound]')?.addEventListener('click', playNotificationSound);
    root.querySelector('[data-custom-sound]')?.addEventListener('change', async event => {
        if (!await saveCustomNotificationSound(event.target.files?.[0])) return;
        renderChat();
    });
    root.querySelector('[data-chat-avatar-shape]')?.addEventListener('change', event => { cfg.chatAvatarShape = event.target.value; saveCfg(); renderChat(); refreshChatSettings(); });
    root.querySelector('[data-chat-theme-manage]')?.addEventListener('click', () => { const box = root.querySelector('[data-chat-theme-options]'); box.hidden = !box.hidden; });
    root.querySelector('[data-chat-theme-follow]')?.addEventListener('click', () => { cfg.chatThemeMode = 'follow'; saveCfg(); renderChat(); refreshChatSettings(); });
    root.querySelectorAll('button[data-chat-theme-preset]').forEach(button => button.addEventListener('click', () => { cfg.chatThemePreset = button.dataset.chatThemePreset; cfg.chatThemeMode = 'preset'; saveCfg(); renderChat(); refreshChatSettings(); }));
    root.querySelectorAll('[data-chat-theme-color]').forEach(input => input.addEventListener('input', () => { cfg[input.dataset.chatThemeColor] = input.value; cfg.chatThemeMode = 'custom'; saveCfg(); refreshChatSettings(); const [p,t,a]=chatColors(); const panel=root.querySelector('#fcm-chat-panel'); panel.style.setProperty('--s',p); panel.style.setProperty('--tx',t); panel.style.setProperty('--ac',a); const button=root.querySelector('[data-chat-theme-manage]'); if(button) button.textContent=`${T('themeSettingsLabel')} · ${T('themeCustom')}`; }));
    // 字體大小／字型是 FCM 與 CHAT 共用的同一組設定：改這裡也要讓 FCM 面板（若已開啟）跟著即時更新，
    //  不必等使用者手動切一次分頁或重開才看得到。
    root.querySelector('[data-chat-font-size]')?.addEventListener('change', event => { cfg.chatFontSize = Math.max(10, Math.min(24, Number(event.target.value) || 13)); saveCfg(); renderChat(); applyTheme(); });
    root.querySelector('[data-chat-font-family]')?.addEventListener('change', event => { cfg.chatFontFamily = event.target.value; saveCfg(); renderChat(); applyTheme(); });
    root.querySelector('[data-chat-avatar-mode]')?.addEventListener('change', event => { cfg.chatAvatarMode = event.target.value; saveCfg(); renderChat(); });
    root.querySelector('[data-chat-avatar-url]')?.addEventListener('change', event => { cfg.chatAvatarUrl = event.target.value.trim(); saveCfg(); renderChat(); });
    root.querySelector('[data-save-profile]')?.addEventListener('click', saveOwnProfile);
    root.querySelector('[data-profile-nickname-edit]')?.addEventListener('click', () => {
        const editor = root.querySelector('[data-profile-nickname-editor]'); const text = root.querySelector('[data-profile-nickname-text]');
        editor.hidden = false; text.hidden = true; root.querySelector('[data-profile-nickname-edit]').hidden = true; editor.querySelector('input')?.focus();
    });
    root.querySelector('[data-profile-nickname-cancel]')?.addEventListener('click', () => renderChat());
    root.querySelector('[data-profile-nickname]')?.addEventListener('input', event => {
        const value = event.target.value.trim();
        const status = value && typeof globalThis.CharacterValidateNickname === 'function' ? globalThis.CharacterValidateNickname(Player, value, false) : null;
        event.target.setCustomValidity(status ? (typeof globalThis.TextGet === 'function' ? globalThis.TextGet(status) : status) : '');
    });
    root.querySelector('[data-profile-nickname-confirm]')?.addEventListener('click', () => {
        const input = root.querySelector('[data-profile-nickname]'); const nickname = input?.value.trim() || '';
        const status = typeof globalThis.CharacterSetNickname === 'function' ? globalThis.CharacterSetNickname(Player, nickname) : null;
        if (status && status !== 'NicknameLocked') { input.setCustomValidity(typeof globalThis.TextGet === 'function' ? globalThis.TextGet(status) : status); input.reportValidity(); return; }
        cfg.profileNickname = Player?.Nickname || nickname; saveCfg(); renderChat();
    });
    root.querySelector('[data-profile-snapshot]')?.addEventListener('click', async event => {
        const button = event.currentTarget; button.disabled = true;
        const updated = await updateOwnAvatarSnapshot();
        if (updated) {
            const snapshot = Player?.OnlineSharedSettings?.FCM?.avatarSnapshot || '';
            const avatar = root.querySelector(`.fcm-chat-profile [data-avatar-member="${Number(Player?.MemberNumber)}"]`);
            if (snapshot && avatar) {
                let img = avatar.querySelector('img');
                if (!img) { img = document.createElement('img'); img.draggable = false; avatar.insertBefore(img, avatar.firstChild); }
                img.src = snapshot;
                [...avatar.childNodes].filter(node => node.nodeType === Node.TEXT_NODE).forEach(node => node.remove());
            }
        }
        button.textContent = updated ? T('chatProfileSnapshotDone') : T('ownAvatarUpdateFailed');
        setTimeout(() => { if (button.isConnected) { button.disabled = false; button.textContent = T('chatProfileSnapshot'); } }, 1800);
    });
    root.querySelector('[data-profile-avatar-url]')?.addEventListener('change', async event => {
        const value = event.target.value.trim();
        event.target.setCustomValidity(isSupportedAvatarUrl(value) ? '' : T('chatAvatarUrlUnsupported'));
        if (!event.target.reportValidity()) return;
        cfg.avatarUrl = cfg.chatAvatarUrl = value;
        saveCfg();
        if (cfg.chatAvatarMode === 'url') { await updateOwnAvatarProfile('url', value); renderChat(); }
    });
    root.querySelectorAll('[data-profile-status]').forEach(button => button.addEventListener('click', () => {
        const box = root.querySelector('[data-profile-statuses]'); box.dataset.value = button.dataset.profileStatus;
        box.querySelectorAll('button').forEach(item => item.classList.toggle('active', item === button));
        setStatus(button.dataset.profileStatus, false);
    }));
    root.querySelectorAll('[data-profile-reply]').forEach(button => button.addEventListener('click', () => { const key=button.dataset.profileReply==='busy'?'busyAutoReply':'afkAutoReply'; cfg[key]=!cfg[key]; saveCfg(); button.classList.toggle('on',cfg[key]); }));
}

function syncConversationBackButton(main, stacked) {
    const header = main?.querySelector('.fcm-chat-conversation-header');
    if (!header) return;
    const existing = header.querySelector('[data-back]');
    if (!stacked) { existing?.remove(); return; }
    if (existing) return;
    const button = document.createElement('button');
    button.className = 'fcm-chat-back fcm-chat-icon-action';
    button.dataset.back = '';
    button.title = T('chatBack');
    button.innerHTML = EXIT_ICON;
    button.addEventListener('click', () => {
        stackedDetail = false;
        root.querySelector('.fcm-chat-list')?.classList.remove('slide-out');
        root.querySelector('.fcm-chat-main')?.classList.remove('slide-in');
    });
    header.prepend(button);
}

function positionPanel() {
    const panel = root.querySelector('#fcm-chat-panel');
    if (!maximized && cfg.chatPanelPosition) {
        panel.style.left = `${cfg.chatPanelPosition.x}px`;
        panel.style.top = `${cfg.chatPanelPosition.y}px`;
        panel.style.transform = 'none';
    }
}

async function openSharedProfile(memberNumber) {
    const mn = Number(memberNumber);
    const live = character(mn);
    if (live && typeof globalThis.InformationSheetLoadCharacter === 'function') { globalThis.InformationSheetLoadCharacter(live); return; }
    const profile = await PDB.get(mn);
    if (!profile?.characterBundle) return;
    try {
        const loaded = globalThis.CharacterLoadOnline(JSON.parse(profile.characterBundle), mn);
        globalThis.InformationSheetLoadCharacter?.(loaded);
    } catch (error) { warnLimited(`saved chat profile open failed (${mn})`, error); }
}

async function updateProfileSuggestion(event) {
    const input = event.currentTarget;
    const suggest = root?.querySelector('[data-profile-suggest]');
    const match = input.value.match(/(?:^|\s)@(\d*)$/u);
    if (!suggest || !match) { if (suggest) suggest.hidden = true; return; }
    const query = match[1];
    let candidates = [];
    if (query) {
        const mn = Number(query);
        const profile = character(mn) || await PDB.get(mn);
        if (profile) candidates = [{ mn, name: getDisplayName(mn) }];
    } else {
        const ids = [selectedMember, ...buildFriendList().map(row => Number(row.mn))].filter(Boolean);
        candidates = [...new Set(ids)].slice(0, 6).map(mn => ({ mn, name: getDisplayName(mn) }));
    }
    suggest.innerHTML = candidates.length
        ? candidates.map(row => `<button data-insert-profile="${row.mn}">${avatarHtml(row.mn, 28)}<span><b>${esc(row.name)} (${row.mn})</b><small>${TH('chatShareProfile')}</small></span></button>`).join('')
        : `<span>${TH('chatProfileNotFound')}</span>`;
    suggest.hidden = false;
    suggest.querySelectorAll('[data-insert-profile]').forEach(button => button.addEventListener('click', () => {
        input.value = input.value.replace(/@\d*$/u, `@${button.dataset.insertProfile}`);
        suggest.hidden = true;
        input.focus();
    }));
}

function sendCurrentMessage() {
    const input = root?.querySelector('[data-input]');
    const content = expandProfileMentions(input?.value.trim() || '');
    if (!content || !selectedMember) return;
    const available = capability(selectedMember);
    if (available === 'none' && !isFriendOf(selectedMember)) return;
    if (available === 'none') {
        const queued = OfflineQueue.add(selectedMember, content);
        recordMessage({ memberNumber: selectedMember, direction: 'out', channel: 'beep', content, queued: true, queueId: queued.id }, { notify: false });
        input.value = '';
        return;
    }
    const selectedChannel = available;
    const replyId = selectedChannel === 'whisper' ? replyTarget?.nativeMsgId : '';
    const outgoingId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    suppressOutgoing++;
    try {
        if (selectedChannel === 'whisper') {
            if (!canSendBcxWhisper(selectedMember)) return;
            ServerSend('ChatRoomChat', { Type: 'Hidden', Target: selectedMember, Content: 'FCM::CHAT::MESSAGE', Dictionary: [{ Tag: 'FCM::CHAT::MESSAGE', MessageId: outgoingId }] });
            if (replyTarget) ServerSend('ChatRoomChat', { Type: 'Hidden', Target: selectedMember, Content: 'FCM::CHAT::TAG', Dictionary: [{ Tag: 'FCM::CHAT::TAG', ReplyId: replyId, TargetSharedId: replyTarget.sharedMsgId, Preview: replyTarget.preview }] });
            const data = typeof globalThis.ChatRoomGenerateChatRoomChatMessage === 'function'
                ? globalThis.ChatRoomGenerateChatRoomChatMessage('Whisper', content, replyId)
                : { Type: 'Whisper', Content: content, Dictionary: replyId ? [{ Tag: 'ReplyId', ReplyId: replyId }] : [] };
            data.Target = selectedMember;
            ServerSend('ChatRoomChat', data);
        }
        else if (!sendBcxAwareBeep({ MemberNumber: selectedMember, BeepType: '', Message: content })) return;
    } finally { suppressOutgoing--; }
    recordMessage({ id: outgoingId, sharedMsgId: outgoingId, memberNumber: selectedMember, direction: 'out', channel: selectedChannel, content, replyPreview: replyTarget?.preview || '', replyToId: replyTarget?.sharedMsgId || '' }, { notify: false });
    replyTarget = null;
    input.value = '';
    root?.querySelector('.fcm-chat-reply-indicator')?.remove();
}

function clearReplyTarget() {
    replyTarget = null;
    root?.querySelector('.fcm-chat-reply-indicator')?.remove();
    root?.querySelector('[data-input]')?.focus();
}

function showReplyIndicator() {
    const wrap = root?.querySelector('.fcm-chat-input-wrap');
    if (!wrap || !replyTarget) return;
    let indicator = wrap.querySelector('.fcm-chat-reply-indicator');
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'fcm-chat-reply-indicator';
        wrap.prepend(indicator);
    }
    indicator.innerHTML = `<span>${TH('chatReply')}: ${esc(replyTarget.preview)}</span><button data-cancel-reply title="${TH('chatCancel')}">×</button>`;
    indicator.querySelector('[data-cancel-reply]').addEventListener('click', clearReplyTarget);
}

function replyToMessage(messageElement) {
    const nativeMsgId = messageElement?.dataset.nativeMsgId;
    replyTarget = { nativeMsgId, sharedMsgId: messageElement?.dataset.sharedMsgId || messageElement?.dataset.msgId || '', preview: cleanMessage(messageElement.querySelector('.fcm-chat-content')?.textContent || '').slice(0, 80) };
    showReplyIndicator();
    const input = root?.querySelector('[data-input]');
    if (input) { input.focus(); input.setSelectionRange(input.value.length, input.value.length); }
}

async function toggleContactCard() {
    const main = root?.querySelector('.fcm-chat-main');
    const existing = main?.querySelector('.fcm-chat-contact-card');
    if (existing) { existing.remove(); contactCardOpen = false; return; }
    await PDB.get(selectedMember);
    contactCardOpen = true;
    main?.querySelector('.fcm-chat-conversation-header')?.insertAdjacentHTML('afterend', contactCardHtml());
    bindContactCardEvents();
    hydrateChatAvatars();
}

function bindContactCardEvents() {
    root?.querySelector('[data-card-refresh]')?.addEventListener('click', async event => {
        const button = event.currentTarget;
        if (button.disabled) return;
        button.disabled = true;
        const avatar = root?.querySelector('.fcm-chat-contact-card .fcm-chat-avatar');
        avatar?.classList.add('fcm-avatar-loading');
        avatar?.setAttribute('aria-busy', 'true');
        const live = character(selectedMember);
        try {
            await Snapshot.delete(selectedMember);
            if (live) {
                if (live.MustDraw && typeof globalThis.CharacterLoadCanvas === 'function') globalThis.CharacterLoadCanvas(live);
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                const fresh = PDB._face(live, 100);
                if (fresh) await Snapshot.save(selectedMember, fresh, { source: 'manual-room-refresh', sourceUpdatedAt: Date.now() });
            }
            else await loadAvatarFromBundle(selectedMember, await PDB.get(selectedMember));
            const card = root?.querySelector('.fcm-chat-contact-card');
            if (card) { card.outerHTML = contactCardHtml(); bindContactCardEvents(); hydrateChatAvatars(); }
        } finally {
            button.disabled = false;
            avatar?.classList.remove('fcm-avatar-loading');
            avatar?.removeAttribute('aria-busy');
        }
    });
    root?.querySelector('[data-card-add-friend]')?.addEventListener('click', event => {
        event.stopPropagation();
        showAddFriendConfirm(selectedMember, `${getDisplayName(selectedMember)} (${selectedMember})`, false);
    });
    root?.querySelector('[data-card-profile]')?.addEventListener('click', event => {
        event.stopPropagation();
        openSharedProfile(selectedMember);
    });
}

function selectMessageText(messageElement) {
    const content = messageElement?.querySelector('.fcm-chat-content');
    if (!content) return;
    const lastContent = messageElement.querySelector('.fcm-chat-message-original') || content;
    const selection = getSelection();
    const range = document.createRange();
    range.setStartBefore(content);
    range.setEndAfter(lastContent);
    selection.removeAllRanges();
    selection.addRange(range);
}

function bindMessageActions() {
    const log = root?.querySelector('.fcm-chat-messages');
    const menu = root?.querySelector('.fcm-chat-context-menu');
    if (!log || !menu) return;
    let target = null;
    const hide = () => { menu.hidden = true; target = null; };
    if (closeContextMenuListener) document.removeEventListener('pointerdown', closeContextMenuListener, true);
    closeContextMenuListener = event => { if (!event.target.closest('.fcm-chat-context-menu')) hide(); };
    document.addEventListener('pointerdown', closeContextMenuListener, true);
    log.addEventListener('click', event => {
        const profile = event.target.closest('[data-profile-member]');
        if (profile) { openSharedProfile(profile.dataset.profileMember); return; }
        const jump = event.target.closest('[data-reply-jump]');
        if (jump) {
            const targetMessage = log.querySelector(`[data-shared-msg-id="${CSS.escape(jump.dataset.replyJump)}"]`);
            if (targetMessage) {
                targetMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetMessage.classList.add('reply-highlight');
                setTimeout(() => targetMessage.classList.remove('reply-highlight'), 1600);
            }
            return;
        }
        const button = event.target.closest('[data-message-reply]');
        if (button) { event.stopPropagation(); replyToMessage(button.closest('.fcm-chat-message')); return; }
        const message = event.target.closest('.fcm-chat-message');
        if (message) {
            const selected = message.classList.contains('selected');
            log.querySelectorAll('.fcm-chat-message.selected').forEach(element => element.classList.remove('selected'));
            message.classList.toggle('selected', !selected);
        }
    });
    log.addEventListener('contextmenu', event => {
        const message = event.target.closest('.fcm-chat-message');
        if (!message) return;
        event.preventDefault();
        target = message;
        menu.hidden = false;
        const panelRect = root.querySelector('#fcm-chat-panel').getBoundingClientRect();
        menu.style.left = `${Math.max(8, Math.min(event.clientX - panelRect.left, panelRect.width - menu.offsetWidth - 8))}px`;
        menu.style.top = `${Math.max(8, Math.min(event.clientY - panelRect.top, panelRect.height - menu.offsetHeight - 8))}px`;
    });
    menu.querySelector('[data-context-reply]').onclick = () => { const message = target; hide(); replyToMessage(message); };
    menu.querySelector('[data-context-select]').onclick = () => { const message = target; hide(); selectMessageText(message); };
    menu.querySelector('[data-context-copy]').onclick = async () => {
        const parts = target ? [...target.querySelectorAll('.fcm-chat-content,.fcm-chat-message-original')].map(element => element.textContent) : [];
        hide();
        if (parts.length) await navigator.clipboard.writeText(parts.join('\n'));
    };
    menu.querySelector('[data-context-cancel]').onclick = hide;
}

function saveOwnProfile() {
    const signature = root.querySelector('[data-profile-signature]')?.value.trim() || '';
    const avatarInput = root.querySelector('[data-profile-avatar-url]');
    const avatarUrlValue = avatarInput?.value.trim() || '';
    avatarInput?.setCustomValidity(isSupportedAvatarUrl(avatarUrlValue) ? '' : T('chatAvatarUrlUnsupported'));
    if (avatarInput && !avatarInput.reportValidity()) return;
    cfg.avatarUrl = cfg.chatAvatarUrl = avatarUrlValue;
    cfg.busyMessage = root.querySelector('[data-profile-busy]')?.value.trim() || '';
    cfg.afkMessage = root.querySelector('[data-profile-afk]')?.value.trim() || '';
    cfg.chatStatus = root.querySelector('[data-profile-statuses]')?.dataset.value || 'online';
    cfg.avatarMode = cfg.chatAvatarMode === 'url' ? 'url' : 'game';
    saveCfg();
    try {
        Player.OnlineSharedSettings ??= {}; Player.OnlineSharedSettings.FCM ??= {};
        Object.assign(Player.OnlineSharedSettings.FCM, { signature, nickname: Player?.Nickname || '', status: cfg.chatStatus, busyMessage: cfg.busyMessage, afkMessage: cfg.afkMessage,
            avatarMode: cfg.avatarMode, avatarUrl: cfg.avatarMode === 'url' ? cfg.avatarUrl : '', profileUpdatedAt: Date.now(), updatedAt: Date.now() });
        Player.OnlineSharedSettings.LCData ??= {}; Player.OnlineSharedSettings.LCData.MessageSetting ??= {};
        Object.assign(Player.OnlineSharedSettings.LCData.MessageSetting, { Signature: signature, Avatar: cfg.avatarMode === 'url' ? cfg.avatarUrl : '' });
        ServerAccountUpdate.QueueData({ OnlineSharedSettings: Player.OnlineSharedSettings });
    } catch (error) { warnLimited('LianChat compatibility settings sync failed', error); }
    renderChat();
}

function showFcmConfirm(message, confirmLabel = T('chatConfirmDelete')) {
    return new Promise(resolve => {
        const overlay = document.createElement('div'); overlay.className = 'fcm-chat-modal-overlay';
        overlay.style.cssText = `--s:${cfg.panelColor};--tx:${cfg.fontColor};--ac:${cfg.accentColor}`;
        overlay.innerHTML = `<div class="fcm-chat-modal"><div>${esc(message)}</div><div><button data-modal-cancel>${TH('chatCancel')}</button><button data-modal-ok>${esc(confirmLabel)}</button></div></div>`;
        const finish = value => { overlay.remove(); resolve(value); };
        overlay.querySelector('[data-modal-cancel]').addEventListener('click', () => finish(false));
        overlay.querySelector('[data-modal-ok]').addEventListener('click', () => finish(true));
        overlay.addEventListener('click', event => { if (event.target === overlay) finish(false); });
        document.body.appendChild(overlay);
    });
}

async function deleteConversation() {
    if (!selectedMember || !await showFcmConfirm(T('chatConfirmDeleteConv', getDisplayName(selectedMember)))) return;
    await ChatStore.deleteMember(selectedMember);
    OfflineQueue.removeMember(selectedMember);
    messages = messages.filter(message => message.memberNumber !== selectedMember);
    conversationMessages = [];
    conversationHasMore = false;
    conversationUnread = 0;
    renderChat();
}

function inviteCurrent() {
    if (!selectedMember || capability(selectedMember) !== 'beep' || !ChatRoomData?.Name) return;
    const room = ChatRoomData;
    const count = ChatRoomCharacter?.length ?? room.MemberCount ?? null;
    const limit = room.MemberLimit ?? null;
    const description = String(room.Description || '').trim();
    const message = `|${room.Name}| - ${room.Creator || '?'} ＜${count ?? 0}/${limit ?? 0}＞${description ? `\n${description}` : ''}`;
    suppressOutgoing++;
    try { if (!sendBcxAwareBeep({ MemberNumber: selectedMember, BeepType: '', IsSecret: false, Message: message })) return; }
    finally { suppressOutgoing--; }
    recordMessage({ memberNumber: selectedMember, direction: 'out', channel: 'beep', content: room.Name, roomName: room.Name }, { notify: false });
}

async function summonCurrent() {
    if (!selectedMember || capability(selectedMember) !== 'beep' || !ChatRoomData?.Name) return;
    if (!await showFcmConfirm(T('beepSummonTitle'), T('beepSummon'))) return;
    suppressOutgoing++;
    try {
        if (!sendBcxAwareBeep({ MemberNumber: selectedMember, BeepType: '', Message: 'summon', ChatRoomName: ChatRoomData.Name, ChatRoomSpace: ChatRoomData.Space })) return;
    } finally { suppressOutgoing--; }
    recordMessage({ memberNumber: selectedMember, direction: 'out', channel: 'beep', content: 'summon', roomName: ChatRoomData.Name }, { notify: false });
}

async function handleOnlineFriendsUpdate(result) {
    if (!cfg.communicationEnabled || !Array.isArray(result)) return;
    const signature = result.map(row => `${Number(row.MemberNumber)}:${row.ChatRoomName || ''}:${row.ChatRoomSpace || ''}:${row.Private ? 1 : 0}`).sort().join('|');
    if (signature !== onlinePresenceSignature) {
        onlinePresenceSignature = signature;
        if (root?.isConnected && root.style.display !== 'none') {
            refreshVisibleChatScroll();
            refreshConversationPresence();
        }
    }
    const online = new Set(result.map(row => Number(row.MemberNumber)).filter(Boolean));
    const ready = OfflineQueue.all().filter(row => isFriendOf(row.memberNumber) && online.has(Number(row.memberNumber)) && !offlineQueueInFlight.has(row.id));
    if (!ready.length) return;
    ready.forEach(row => offlineQueueInFlight.add(row.id));
    ready.forEach((row, index) => setTimeout(async () => {
        let delivered = false;
        suppressOutgoing++;
        try { delivered = sendBcxAwareBeep({ MemberNumber: row.memberNumber, BeepType: '', Message: row.content }); }
        catch (error) { console.warn('🐈‍⬛ [FCM] offline message delivery failed:', error); }
        finally { suppressOutgoing--; }
        if (delivered) {
            OfflineQueue.remove([row.id]);
            const stored = (await ChatStore.all()).find(message => message.queueId === row.id);
            if (stored) await ChatStore.put({ ...stored, queued: false, deliveredAt: Date.now() });
            messages = await ChatStore.prune();
            if (root?.isConnected && root.style.display !== 'none') {
                const element = root.querySelector(`[data-msg-id="${CSS.escape(String(stored?.id || ''))}"]`);
                element?.classList.remove('queued');
                refreshVisibleChatScroll();
            }
        }
        offlineQueueInFlight.delete(row.id);
    }, index * 350));
}

function setStatus(status, rerender = true) {
    cfg.chatStatus = status;
    saveCfg();
    try {
        Player.OnlineSharedSettings ??= {};
        Player.OnlineSharedSettings.FCM ??= {};
        Player.OnlineSharedSettings.FCM.status = status;
        Player.OnlineSharedSettings.FCM.updatedAt = Date.now();
        globalThis.ServerPlayerOnlineSharedSettingsSync?.();
    } catch (error) { warnLimited('chat presence sync failed', error); }
    const dot = root?.querySelector('.fcm-chat-rail [data-status] .fcm-status-dot');
    if (dot) dot.className = `fcm-status-dot ${status}`;
    if (rerender) renderChat();
}

function showGroupNameDialog() {
    return new Promise(resolve => {
        const overlay = document.createElement('div'); overlay.className = 'fcm-chat-modal-overlay';
        overlay.style.cssText = `--s:${cfg.panelColor};--tx:${cfg.fontColor};--ac:${cfg.accentColor}`;
        overlay.innerHTML = `<div class="fcm-chat-modal fcm-chat-group-dialog"><div>${TH('chatNewGroup')}</div><input data-new-group-name maxlength="24" placeholder="${TH('chatNewGroup')}"><div><button data-modal-cancel>${TH('chatCancel')}</button><button data-modal-ok>${TH('btnConfirm')}</button></div></div>`;
        const input = overlay.querySelector('[data-new-group-name]');
        const finish = value => { overlay.remove(); resolve(value); };
        overlay.querySelector('[data-modal-cancel]').addEventListener('click', () => finish(''));
        overlay.querySelector('[data-modal-ok]').addEventListener('click', () => finish(input.value.trim()));
        input.addEventListener('keydown', event => { event.stopPropagation(); if (event.key === 'Enter') finish(input.value.trim()); else if (event.key === 'Escape') finish(''); });
        document.body.appendChild(overlay); input.focus();
    });
}

function refreshChatSettings() {
    chatBalloons.ensure();
    document.querySelectorAll('.fcm-chat-user-balloon').forEach(chatBalloons.paint);
    document.getElementById('fcm-chat-balloon')?.classList.toggle('persistent', !!cfg.communicationEnabled && cfg.balloonPlacement !== 'off');
    if (cfg.userBalloonPlacement === 'off') document.querySelectorAll('.fcm-chat-user-balloon').forEach(balloon => balloon.remove());
    if (!cfg.communicationEnabled) {
        closeChat();
        document.querySelectorAll('.fcm-chat-user-balloon').forEach(balloon => balloon.remove());
    } else if (root?.isConnected && root.style.display !== 'none') renderChat();
}

export { initChat, openChat, closeChat, refreshChatSettings, handleIncomingBeep, handleIncomingChatMessageId, handleIncomingChatTag, handleIncomingFriendRequestNotice, handleIncomingWhisper, handleIncomingWhisperDisplay, handleOutgoingServerSend, handleOnlineFriendsUpdate, playNotificationSound, saveCustomNotificationSound };

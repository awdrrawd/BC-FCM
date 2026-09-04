import { cfg, saveCfg } from '../core/config.js';
import { getDisplayName as getSharedDisplayName, getRoomInfo, inRoomFn, onlineFriends, requestOnlineFriends, buildFriendList, getAllRels, isFav, isFriendOf } from '../data/data.js';
import { getCachedRoomInfo, queryRoomInfo } from '../panel/panel-rooms-data.js';
import { PDB, _pc, Snapshot, loadAvatarFromBundle, syncRoomAvatar } from '../data/profile-db.js';
import { ChatStore, OfflineQueue } from './chat/data/chat-store.js';
import { T, TH } from '../i18n/i18n.js';
import { chatFontFamily } from './chat-font.js';
import { isSupportedAvatarUrl } from './chat/services/chat-avatar-url.js';
import { profileHtml as renderProfileHtml } from './chat/views/chat-profile-view.js';
import { chatPanelSession } from './chat/controllers/chat-panel-session.js';
import { installDragScroll } from '../ui/drag-scroll.js';
import { themeColors } from '../core/themes.js';
import { showAddFriendConfirm, showRoomJoinConfirm, showIncomingRoomInvite } from '../chat/actions.js';
import { canSendBcxWhisper, sendBcxAwareBeep, sendBcxAwareWhisper } from './bcx-compat.js';
import { normalizedImageOrigin, trustImageOrigin } from './image-trust.js';
import { injectChatStyles } from './chat/views/chat-styles.js';
import { warnLimited } from '../core/logger.js';
import { balloonPreviewText, cleanMessage, esc } from './chat/services/chat-content.js';
import { exportConversation as exportConversationFile } from './chat/services/chat-export.js';
import { initChatAudio, playNotificationSound } from './chat-audio.js';
import { installChatDrag, resetBalloonInteraction } from './chat/controllers/chat-drag.js';
import { createChatBalloonController } from './chat/controllers/chat-balloon.js';
import { createDialogHost } from '../ui/dialog.js';
import { buildForwardTargetGroups, forEachForwardedMessage, forwardedMessageText, selectedMessages } from './chat/data/chat-selection.js';
import { bindForwardTargetEvents, forwardTargetsHtml as renderForwardTargetsHtml, updateMultiSelectUi as syncMultiSelectUi } from './chat/views/chat-selection-view.js';
import { installMessageActions } from './chat/events/chat-message-actions.js';
import { bindChatSettingsEvents } from './chat/events/chat-settings-events.js';
import { bindChatProfileEvents } from './chat/events/chat-profile-events.js';
import { chatListHtml as renderChatListHtml, contactRowsHtml, groupsHtml as renderGroupsHtml, notificationsHtml as renderNotificationsHtml } from './chat/views/chat-list-view.js';
import { settingsHtml as renderSettingsHtml } from './chat/views/chat-settings-view.js';
import { conversationMessagesHtml, messageDateKey, messageDateLabel, messageHtml } from './chat/views/chat-message-view.js';
import { contactCardHtml as renderContactCardHtml, conversationHtml as renderConversationHtml } from './chat/views/chat-conversation-view.js';
import { WhisperMetadata, classifyIncomingBeep, findPendingOutgoingWhisper, normalizeMessage as normalizeTransportMessage } from './chat/services/chat-transport.js';
import { conversationRows, historyMessageRows, recentConversationRows, unreadMessageCount } from './chat/data/chat-conversation-data.js';
import { ChatConversationController } from './chat/controllers/chat-conversation-controller.js';
import { createChatContactService } from './chat/services/chat-contact-service.js';
import { animateLayoutChange, animatePanelSize, positionPanel as applyPanelPosition, syncConversationBackButton as syncBackButton } from './chat/controllers/chat-panel-layout.js';
import { createChatAutoReplyService } from './chat/services/chat-auto-reply.js';
import {
    CHAT_ICON, NOTIFICATION_ICON, GROUP_ICON,
    EXIT_ICON, LAYOUT_ICON, EDIT_ICON, SETTINGS_ICON,
    WATER_ICON, MAXIMIZE_ICON,
} from '../ui/icons.js';

let root = null;
let selectedMember = null;
let messages = [];
let historyDateFrame = 0;
const conversation = new ChatConversationController(50, 40);
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
let cleanupMessageActions = null;
let multiSelectMode = false;
let forwardTargetMode = false;
let forwardTargetTab = 'room';
const selectedMessageIds = new Set();
const whisperMetadata = new WhisperMetadata();
let onlinePresenceSignature = '';
const offlineQueueInFlight = new Set();
const remoteProfiles = new Map();

function resetMessageSelectionState() {
    multiSelectMode = false;
    forwardTargetMode = false;
    forwardTargetTab = 'room';
    selectedMessageIds.clear();
}

const contactService = createChatContactService({
    config: cfg, snapshot: Snapshot, syncRoomAvatar, displayName: getSharedDisplayName, inRoom: inRoomFn, isFriend: isFriendOf,
    getPlayer: () => Player, getRoomCharacters: () => ChatRoomCharacter, getOnlineFriends: () => onlineFriends,
    getRemoteProfiles: () => remoteProfiles, getRoot: () => root,
});
const { avatarHtml, avatarUrl, biography, capability, character, getDisplayName, hydrateAvatars: hydrateChatAvatars, isOnline, sharedProfile } = contactService;
const runWithoutOutgoingCapture = callback => {
    suppressOutgoing++;
    try { return callback(); }
    finally { suppressOutgoing--; }
};
const autoReply = createChatAutoReplyService({
    config: cfg, inRoom: inRoomFn, isOnline, sendWhisper: sendBcxAwareWhisper, sendBeep: sendBcxAwareBeep,
    recordMessage: (...args) => recordMessage(...args), runWithoutOutgoingCapture,
});
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

function chatColors() {
    if (cfg.chatThemeMode === 'custom') return [cfg.chatPanelColor, cfg.chatFontColor, cfg.chatAccentColor];
    return cfg.chatThemeMode === 'preset' ? themeColors(cfg.chatThemePreset) : [cfg.panelColor, cfg.fontColor, cfg.accentColor];
}

async function initChat() {
    if (initialized) return;
    initialized = true;
    await ChatStore.init();
    messages = await ChatStore.recentIndex();
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
    return normalizeTransportMessage(data, { displayName: getDisplayName, selectedMember });
}

async function recordMessage(data, { notify = true } = {}) {
    if (!cfg.communicationEnabled || !data?.memberNumber) return;
    const message = normalizeMessage(data);
    if (!message.content) return;
    await ChatStore.put(message);
            messages = await ChatStore.recentIndex();
    if (root?.isConnected && root.style.display !== 'none') {
        if (Number(message.memberNumber) === Number(selectedMember)) {
            conversation.add(message);
            appendConversationMessage(message);
        }
        refreshVisibleChatScroll();
    }
    if (notify && message.direction === 'in') {
        chatBalloons.showIncoming(message);
        playNotificationSound();
        autoReply.handle(message);
    }
}

function handleIncomingBeep(data) {
    const incoming = classifyIncomingBeep(data);
    if (incoming.type === 'profile') {
        remoteProfiles.set(Number(data.MemberNumber), incoming.profile);
        return;
    }
    if (incoming.type === 'invalid-profile') {
        warnLimited('LianChat profile payload parse failed', incoming.error);
        return;
    }
    if (incoming.type === 'invite') {
        const { invite, roomName } = incoming;
        recordMessage({ memberNumber: data.MemberNumber, name: data.MemberName, direction: 'in', channel: 'beep', content: roomName, roomName });
        showIncomingRoomInvite(data.MemberNumber, getDisplayName(data.MemberNumber), { room: roomName, creator: invite.creator || '', count: invite.count ?? null, limit: invite.limit ?? null, desc: invite.desc || '', priv: !!invite.priv, type: invite.type || '' });
        return;
    }
    if (incoming.type !== 'message') return;
    recordMessage({ memberNumber: data.MemberNumber, name: data.MemberName, direction: 'in', channel: 'beep', content: data.Message });
}

function handleIncomingWhisper(data) {
    if (!data || data.Type !== 'Whisper' || !data.Content || Number(data.Sender) === Number(Player?.MemberNumber)) return;
    recordMessage({ memberNumber: data.Sender, direction: 'in', channel: 'whisper', content: data.Content, timestamp: data.Time });
    whisperMetadata.markBypassed(data);
}

function handleIncomingWhisperDisplay(data, displayedMessage, senderCharacter) {
    if (!data || data.Type !== 'Whisper') return;
    if (whisperMetadata.consumeBypassed(data)) return;
    const idEntry = Array.isArray(data.Dictionary) ? data.Dictionary.find(entry => entry?.Tag === 'MsgId' && entry.MsgId) : null;
    if (Number(data.Sender) === Number(Player?.MemberNumber)) {
        const target = Number(data.Target);
        const pending = findPendingOutgoingWhisper(messages, target);
        if (pending && idEntry?.MsgId) {
            pending.nativeMsgId = idEntry.MsgId;
            ChatStore.put(pending);
            root?.querySelector(`[data-msg-id="${CSS.escape(String(pending.id))}"]`)?.setAttribute('data-native-msg-id', idEntry.MsgId);
        }
        return;
    }
    const metadata = whisperMetadata.consumeDisplay(data, displayedMessage);
    recordMessage({ memberNumber: senderCharacter?.MemberNumber ?? data.Sender, direction: 'in', channel: 'whisper', ...metadata, timestamp: data.Time });
}

function handleIncomingChatTag(data) {
    return whisperMetadata.receiveReplyTag(data);
}

function handleIncomingChatMessageId(data) {
    return whisperMetadata.receiveMessageId(data);
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
    return conversationRows(messages, buildFriendList(), Player?.MemberNumber);
}

function unreadCount(memberNumber = null) {
    return unreadMessageCount(messages, memberNumber);
}

function unreadBadge(memberNumber = null) {
    const count = unreadCount(memberNumber);
    return `<b class="fcm-chat-unread ${count ? '' : 'hidden'}">${Math.min(count, 99)}</b>`;
}

function recentConversations() {
    return recentConversationRows(conversations());
}

function historyMessages() {
    return historyMessageRows(messages, Player?.MemberNumber);
}

async function openChat(memberNumber = null) {
    if (!cfg.communicationEnabled) return false;
    if (Number(memberNumber) === Number(Player?.MemberNumber)) memberNumber = null;
    if (memberNumber) {
        selectedMember = Number(memberNumber);
        resetMessageSelectionState();
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
    messages = await ChatStore.recentIndex();
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
    cleanupMessageActions?.();
    cleanupMessageActions = null;
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
    resetMessageSelectionState();
    replyTarget = null;
    stackedDetail = false;
    cleanupMessageActions?.();
    cleanupMessageActions = null;
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
    return contactRowsHtml(rows, { history, selectedMember, justOpenedMember, avatarHtml, displayName: getDisplayName, biography, cleanMessage, esc, text: T });
}

function notificationsHtml() {
    const rows = filteredNotificationRows(notificationTab === 'recent' ? recentConversations() : historyMessages());
    return renderNotificationsHtml({ rowsHtml: contactRows(rows, { history: true }), notificationTab, notificationSearch, esc, text: TH });
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
    return renderGroupsHtml({ definitions, group, rowsHtml: contactRows(rows), groupMode, groupSearch, esc, text: TH });
}

function settingsHtml() {
    return renderSettingsHtml();
}

function profileHtml() {
    return renderProfileHtml({ Player, cfg, T, TH, esc, avatarHtml, editIcon: EDIT_ICON });
}

function chatListHtml() {
    return renderChatListHtml({ rowsHtml: contactRows(filteredContacts()), search, presenceFilter, relationFilter, esc, text: TH });
}

function forwardTargetsHtml() {
    const groups = buildForwardTargetGroups({
        roomCharacters: ChatRoomCharacter,
        friendRows: buildFriendList(),
        selfMemberNumber: Player?.MemberNumber,
        conversationMemberNumber: selectedMember,
        isFriend: isFriendOf,
        isOnline,
    });
    return renderForwardTargetsHtml({ groups, activeTab: forwardTargetTab, avatarHtml, displayName: getDisplayName, esc, text: TH });
}

function listHtml() {
    if (forwardTargetMode) return forwardTargetsHtml();
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
    if (!selectedMember) return renderConversationHtml({ memberNumber: null });
    const available = capability(selectedMember);
    const { roomInfo, roomText: baseRoomText, canOpenRoom, unavailable } = conversationRoomState(selectedMember);
    const cachedRoom = roomInfo?.name ? getCachedRoomInfo(roomInfo.name) : null;
    const memberCount = roomInfo?.isCurrent ? (ChatRoomCharacter?.length ?? null) : (roomInfo?.memberCount ?? cachedRoom?.MemberCount ?? null);
    const memberLimit = roomInfo?.isCurrent ? (ChatRoomData?.MemberLimit ?? null) : (roomInfo?.memberLimit ?? cachedRoom?.MemberLimit ?? null);
    const roomCount = memberCount !== null && memberCount !== undefined ? ` ＜${memberCount}${memberLimit !== null && memberLimit !== undefined ? `/${memberLimit}` : ''}＞` : '';
    const roomText = canOpenRoom ? `${roomInfo.name}${roomCount}` : baseRoomText;
    const online = available !== 'none';
    const showNotFriendBadge = !isFriendOf(selectedMember) && !unavailable;
    const inputPlaceholder = unavailable ? T('noBeepNotFriend') : !online ? T('chatOfflineQueuePlaceholder') : available === 'whisper' ? T('chatWhisperInputPlaceholder') : T('chatPrivateInputPlaceholder');
    return renderConversationHtml({
        memberNumber: selectedMember, stacked: cfg.chatLayout === 'stacked', avatarHtml,
        displayName: getDisplayName(selectedMember), biography: biography(selectedMember), showNotFriendBadge,
        roomText, roomName: roomInfo?.name || '', canOpenRoom,
        canSummon: !!ChatRoomData && online && !inRoomFn(selectedMember), groups: Object.entries(cfg.chatGroups || {}),
        contactCardHtml: contactCardOpen ? contactCardHtml() : '', messagesHtml: conversationMessagesHtml(conversation.messages),
        unread: conversation.unread, multiSelect: multiSelectMode, available, online,
        canInvite: available !== 'none' && !inRoomFn(selectedMember), inputPlaceholder, unavailable,
        replyTarget, selectedCount: selectedMessageIds.size, canForwardToRoom: !!ChatRoomData,
    });
}

function contactCardHtml() {
    const hasProfile = !!_pc[Number(selectedMember)]?.characterBundle;
    return renderContactCardHtml({ memberNumber: selectedMember, avatarHtml, displayName: getDisplayName(selectedMember), biography: biography(selectedMember), hasProfile, isFriend: isFriendOf(selectedMember) });
}

function expandProfileMentions(content) {
    return String(content).replace(/@(\d+)/gu, (all, id) => `@${getDisplayName(Number(id))} (${id})`);
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

function refreshChatList({ preserveScroll = false } = {}) {
    const list = root?.querySelector('.fcm-chat-list');
    if (!list) return;
    const scrollTop = preserveScroll ? list.querySelector('.fcm-chat-scroll')?.scrollTop || 0 : 0;
    list.innerHTML = listHtml();
    if (forwardTargetMode) bindForwardTargetRows();
    else bindChatListEvents(list);
    hydrateChatAvatars();
    installDragScroll(list, '.fcm-chat-scroll');
    if (preserveScroll) {
        const scroll = list.querySelector('.fcm-chat-scroll');
        if (scroll) scroll.scrollTop = scrollTop;
    }
}

function bindMessageImages(scope, log) {
    scope?.querySelectorAll?.('.fcm-chat-image').forEach(image => {
        image.addEventListener('load', () => {
            // Image decoding can increase the message height after the message was
            // appended. Keep following only while the user has not left the bottom.
            if (log && conversation.viewport.followingLatest) conversation.viewport.scrollToLatest(log);
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
    const shouldFollowLatest = conversation.viewport.shouldFollow(log, message.direction);
    log.querySelector(':scope > .fcm-chat-empty')?.remove();
    const previousElement = [...log.querySelectorAll(':scope > .fcm-chat-message')].at(-1);
    const previousMessage = previousElement ? conversation.messages.find(row => String(row.id) === previousElement.dataset.msgId) : null;
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
        conversation.viewport.follow();
        conversation.unread = 0;
        requestAnimationFrame(() => { conversation.viewport.scrollToLatest(log); updateConversationUnreadNotice(); });
    } else {
        conversation.unread++;
        updateConversationUnreadNotice();
    }
}

async function loadConversation(memberNumber) {
    await conversation.load(ChatStore, memberNumber, target => Number(selectedMember) === target);
}

async function loadOlderConversation(log) {
    if (!selectedMember) return;
    const oldHeight = log.scrollHeight;
    const oldTop = log.scrollTop;
    const loaded = await conversation.loadOlder(ChatStore, selectedMember, target => Number(selectedMember) === target);
    if (loaded) {
        log.innerHTML = conversationMessagesHtml(conversation.messages);
        bindMessageImages(log, log);
        updateMultiSelectUi();
        log.querySelectorAll('[data-join-room]').forEach(button => button.addEventListener('click', () => {
            if (button.dataset.joinRoom) showRoomJoinConfirm({ room: button.dataset.joinRoom });
        }));
        log.scrollTop = oldTop + (log.scrollHeight - oldHeight);
        updateHistoryDateBubble(log);
    }
}

function updateConversationUnreadNotice() {
    const button = root?.querySelector('[data-new-messages]');
    if (!button) return;
    button.hidden = !conversation.unread;
    button.textContent = T('chatNewUnread', conversation.unread);
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
        <div class="fcm-chat-titlebar"><b>FCM-Chat</b><span></span><button class="fcm-chat-icon-action ${cfg.chatLayout === 'stacked' ? 'active' : ''}" data-layout title="${TH('chatToggleLayout')}">${LAYOUT_ICON}<i>${cfg.chatLayout === 'stacked' ? TH('chatLayoutSplit') : TH('chatLayoutMerged')}</i></button><button class="fcm-chat-icon-action ${maximized ? 'active' : ''}" data-max title="${TH('chatToggleMax')}">${MAXIMIZE_ICON}<i>${maximized ? TH('chatRestore') : TH('chatMaximize')}</i></button><button class="fcm-chat-icon-action" data-min title="${TH('chatMinimize')}">—</button><button class="fcm-chat-icon-action" data-close title="${TH('chatClose')}">×</button></div>
        <div class="fcm-chat-body view-${esc(activeView)} ${cfg.chatLayout === 'stacked' ? 'stacked' : ''} ${activeView === 'profile' || activeView === 'settings' ? 'wide-view' : ''} ${forwardTargetMode ? 'forward-target-mode' : ''}">
            <nav class="fcm-chat-rail">
                <button class="fcm-chat-rail-button fcm-chat-self ${activeView === 'profile' ? 'active' : ''}" data-view="profile" title="${TH('chatProfileTab')}">${avatarHtml(Player?.MemberNumber || 0, 34, 'toolbar')}</button>
                <button class="fcm-chat-rail-button ${activeView === 'notifications' ? 'active' : ''}" data-view="notifications" title="${TH('chatNotificationsTab')}">${NOTIFICATION_ICON}${unreadBadge()}</button>
                <button class="fcm-chat-rail-button ${activeView === 'chat' ? 'active' : ''}" data-view="chat" title="${TH('chatChatTab')}">${CHAT_ICON}</button>
                <button class="fcm-chat-rail-button ${activeView === 'groups' ? 'active' : ''}" data-view="groups" title="${TH('chatGroupsTab')}">${GROUP_ICON}</button>
                <span></span>
                <button class="fcm-chat-rail-button" data-status title="${TH('chatStatusTab')}"><i class="fcm-status-dot ${esc(cfg.chatStatus || 'online')}"></i></button>
                <button class="fcm-chat-rail-button ${activeView === 'settings' ? 'active' : ''}" data-view="settings" title="${TH('chatSettingsTab')}">${SETTINGS_ICON}</button>
            </nav>
            <aside class="fcm-chat-list ${stackedDetail && !forwardTargetMode ? 'slide-out' : ''}">${listHtml()}</aside>
            <main class="fcm-chat-main ${stackedDetail && !forwardTargetMode ? 'slide-in' : ''}">${conversationHtml()}</main>
        </div>
        <div class="fcm-chat-status-menu"><button data-status-value="online"><i class="online"></i>${TH('chatStatusOnline')}</button><button data-status-value="busy"><i class="busy"></i>${TH('chatStatusBusy')}</button><button data-status-value="afk"><i class="afk"></i>${TH('chatStatusAFK')}</button></div>
        <div class="fcm-chat-context-menu" hidden><button data-context-select>${TH('chatSelectMessage')}</button><button data-context-copy>${TH('chatCopy')}</button><button data-context-multi>${TH('chatMultiSelect')}</button><button data-context-reply>${TH('chatReply')}</button><button data-context-cancel>${TH('chatCancel')}</button></div>
    </div>`;
    applyPanelPosition(root.querySelector('#fcm-chat-panel'), maximized, cfg.chatPanelPosition);
    chatBalloons.syncVisibility();
    bindEvents();
    installDragScroll(root, '.fcm-chat-scroll,.fcm-chat-messages,.fcm-chat-profile,.fcm-chat-body.view-settings .fcm-chat-list');
    refreshConversationRoomMeta();
    hydrateChatAvatars();
    const log = root.querySelector('.fcm-chat-messages');
    if (log) {
        bindMessageImages(log, log);
        conversation.viewport.follow();
        conversation.viewport.scrollToLatest(log);
    }
    if (settingsScrollTop !== null && settingsScrollTop !== undefined) {
        const settingsList = root.querySelector('.fcm-chat-list');
        if (settingsList) settingsList.scrollTop = settingsScrollTop;
    }
    requestAnimationFrame(() => { const bio = root?.querySelector('.fcm-chat-bio'); if (bio) bio.classList.toggle('marquee', bio.scrollWidth > bio.clientWidth); });
}

function bindMemberRows(scope = root) {
    scope?.querySelectorAll('[data-member]').forEach(button => button.addEventListener('click', async () => {
        selectedMember = Number(button.dataset.member);
        resetMessageSelectionState();
        replyTarget = null;
        contactCardOpen = false;
        justOpenedMember = selectedMember;
        channel = inRoomFn(selectedMember) ? 'whisper' : 'beep';
        stackedDetail = true;
        await ChatStore.markRead(selectedMember);
        messages = await ChatStore.recentIndex();
        await loadConversation(selectedMember);
        chatBalloons.refreshBadges();
        root?.querySelectorAll('[data-member]').forEach(row => row.classList.toggle('selected', Number(row.dataset.member) === selectedMember));
        const list = root?.querySelector('.fcm-chat-list');
        const main = root?.querySelector('.fcm-chat-main');
        list?.classList.toggle('slide-out', cfg.chatLayout === 'stacked');
        main?.classList.toggle('slide-in', cfg.chatLayout === 'stacked');
        refreshConversationMain();
        const unread = root?.querySelector('[data-view="notifications"] .fcm-chat-unread');
        const count = unreadCount();
        if (unread) {
            unread.textContent = Math.min(count, 99);
            unread.classList.toggle('hidden', !count);
        }
        setTimeout(() => { justOpenedMember = null; }, 350);
    }));
}

function bindChatListEvents(scope = root) {
    scope?.querySelectorAll('[data-notification-tab]').forEach(button => button.addEventListener('click', () => { notificationTab = button.dataset.notificationTab; refreshChatList(); }));
    scope?.querySelectorAll('[data-group]').forEach(button => button.addEventListener('click', () => { selectedGroup = button.dataset.group; refreshChatList(); }));
    scope?.querySelector('[data-add-group]')?.addEventListener('click', async () => {
        const label = await showGroupNameDialog(); if (!label) return;
        const id = `group-${Date.now().toString(36)}`; cfg.chatGroups ||= {}; cfg.chatGroups[id] = label; selectedGroup = id; saveCfg(); refreshChatList();
    });
    scope?.querySelectorAll('[data-group-mode]').forEach(button => button.addEventListener('click', () => { groupMode = button.dataset.groupMode; refreshChatList(); }));
    scope?.querySelector('[data-group-search]')?.addEventListener('input', event => { groupSearch = event.target.value; refreshVisibleChatScroll(); });
    scope?.querySelector('[data-notification-search]')?.addEventListener('input', event => { notificationSearch = event.target.value; refreshVisibleChatScroll(); });
    scope?.querySelector('[data-search]')?.addEventListener('input', event => { search = event.target.value; refreshVisibleChatScroll(); });
    scope?.querySelectorAll('[data-presence]').forEach(button => button.addEventListener('click', () => { presenceFilter = button.dataset.presence; refreshChatList(); }));
    scope?.querySelectorAll('[data-rel]').forEach(button => button.addEventListener('click', () => { relationFilter = relationFilter === button.dataset.rel ? '' : button.dataset.rel; refreshChatList({ preserveScroll: true }); }));
    bindMemberRows(scope);
}

function bindConversationEvents() {
    const main = root?.querySelector('.fcm-chat-main');
    if (!main) return;
    main.querySelector('[data-back]')?.addEventListener('click', () => {
        stackedDetail = false;
        root.querySelector('.fcm-chat-list')?.classList.remove('slide-out');
        main.classList.remove('slide-in');
    });
    main.querySelectorAll('[data-channel]').forEach(button => button.addEventListener('click', () => {
        if (!button.disabled) {
            channel = button.dataset.channel;
            refreshConversationPresence();
        }
    }));
    main.querySelector('[data-send]')?.addEventListener('click', sendCurrentMessage);
    const conversationLog = main.querySelector('.fcm-chat-messages');
    conversationLog?.addEventListener('scroll', () => {
        if (conversationLog.scrollTop < 80) loadOlderConversation(conversationLog);
        if (conversation.viewport.updateFromScroll(conversationLog) && conversation.unread) {
            conversation.unread = 0;
            updateConversationUnreadNotice();
        }
        updateHistoryDateBubble(conversationLog);
    });
    main.querySelector('[data-new-messages]')?.addEventListener('click', () => {
        conversation.viewport.follow();
        conversation.viewport.scrollToLatest(conversationLog);
        conversation.unread = 0;
        updateConversationUnreadNotice();
    });
    main.querySelector('[data-multi-forward-contact]')?.addEventListener('click', showForwardTargetList);
    main.querySelector('[data-multi-forward-room]')?.addEventListener('click', forwardSelectedToRoom);
    main.querySelectorAll('[data-multi-export]').forEach(button => button.addEventListener('click', () => exportSelectedMessages(button.dataset.multiExport)));
    main.querySelector('[data-multi-cancel]')?.addEventListener('click', exitMultiSelect);
    if (multiSelectMode) updateMultiSelectUi();
    bindMessageActions();
    main.querySelector('[data-cancel-reply]')?.addEventListener('click', clearReplyTarget);
    main.querySelector('[data-input]')?.addEventListener('keydown', event => { event.stopPropagation(); if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendCurrentMessage(); } });
    main.querySelector('[data-input]')?.addEventListener('input', updateProfileSuggestion);
    main.querySelector('[data-delete]')?.addEventListener('click', deleteConversation);
    main.querySelectorAll('[data-export]').forEach(button => button.addEventListener('click', () => exportConversationFile(button.dataset.export, {
        memberNumber: selectedMember, getDisplayName, biography, avatarUrl, chatColors,
    })));
    main.querySelector('[data-invite]')?.addEventListener('click', inviteCurrent);
    main.querySelector('[data-summon]')?.addEventListener('click', summonCurrent);
    main.querySelector('[data-toggle-tools]')?.addEventListener('click', event => { event.stopPropagation(); event.currentTarget.closest('.fcm-chat-tools')?.classList.toggle('open'); });
    main.querySelectorAll('[data-join-room]').forEach(button => button.addEventListener('click', () => {
        if (button.dataset.joinRoom) showRoomJoinConfirm({ room: button.dataset.joinRoom });
    }));
    const openHeaderRoom = element => {
        if (!element?.dataset.roomName) return;
        const cached = getCachedRoomInfo(element.dataset.roomName);
        showRoomJoinConfirm({ room: element.dataset.roomName, creator: cached?.Creator || '', count: cached?.MemberCount ?? null, limit: cached?.MemberLimit ?? null, desc: cached?.Description || '', priv: !!cached?.Private });
    };
    main.querySelector('[data-room-meta]')?.addEventListener('click', event => openHeaderRoom(event.currentTarget));
    main.querySelector('[data-room-meta]')?.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openHeaderRoom(event.currentTarget); } });
    main.querySelector('.fcm-chat-conversation-header > [data-avatar-member]')?.addEventListener('click', toggleContactCard);
    bindContactCardEvents();
    const assign = main.querySelector('.fcm-chat-assign');
    assign?.addEventListener('pointerdown', event => event.stopPropagation());
    assign?.addEventListener('click', event => event.stopPropagation());
    main.querySelector('[data-toggle-assign]')?.addEventListener('click', event => { event.stopPropagation(); main.querySelector('[data-assign-menu]')?.classList.toggle('open'); });
    main.querySelectorAll('button[data-assign-group]').forEach(button => button.addEventListener('click', () => {
        if (!selectedMember || !button.dataset.assignGroup) return;
        cfg.chatMemberGroups ||= {}; cfg.chatMemberGroups[selectedMember] ||= [];
        if (!cfg.chatMemberGroups[selectedMember].includes(button.dataset.assignGroup)) cfg.chatMemberGroups[selectedMember].push(button.dataset.assignGroup);
        saveCfg(); main.querySelector('[data-assign-menu]')?.classList.remove('open');
    }));
    main.querySelector('[data-create-group-from-chat]')?.addEventListener('click', async () => {
        const label = await showGroupNameDialog(); if (!label) return;
        const id = `group-${Date.now().toString(36)}`; cfg.chatGroups ||= {}; cfg.chatGroups[id] = label; selectedGroup = id; groupMode = 'groups'; saveCfg(); renderChat();
    });
}

function refreshConversationMain({ scrollToLatest = true } = {}) {
    const main = root?.querySelector('.fcm-chat-main');
    if (!main) return;
    main.innerHTML = conversationHtml();
    bindConversationEvents();
    installDragScroll(main, '.fcm-chat-messages');
    refreshConversationRoomMeta();
    hydrateChatAvatars();
    const log = main.querySelector('.fcm-chat-messages');
    if (log) {
        bindMessageImages(log, log);
        if (scrollToLatest) {
            conversation.viewport.follow();
            conversation.viewport.scrollToLatest(log);
        }
    }
    requestAnimationFrame(() => { const bio = main.querySelector('.fcm-chat-bio'); if (bio) bio.classList.toggle('marquee', bio.scrollWidth > bio.clientWidth); });
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
        button.innerHTML = `${LAYOUT_ICON}<i>${stacked ? TH('chatLayoutSplit') : TH('chatLayoutMerged')}</i>`;
        body?.classList.toggle('stacked', stacked);
        list?.classList.toggle('slide-out', stackedDetail);
        main?.classList.toggle('slide-in', stackedDetail);
        syncBackButton(main, stacked, {
            title: T('chatBack'), icon: EXIT_ICON,
            onBack: () => {
                stackedDetail = false;
                root.querySelector('.fcm-chat-list')?.classList.remove('slide-out');
                root.querySelector('.fcm-chat-main')?.classList.remove('slide-in');
            },
        });
        if (beforeList && beforeMain) animateLayoutChange(list, main, beforeList, beforeMain, stacked, stackedDetail);
    });
    root.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => { activeView = button.dataset.view; resetMessageSelectionState(); stackedDetail = false; renderChat(); }));
    bindChatListEvents();
    bindConversationEvents();
    bindForwardTargetRows();
    panel.addEventListener('click', event => {
        if (contactCardOpen && !event.target.closest('.fcm-chat-contact-card') && !event.target.closest('.fcm-chat-conversation-header > [data-avatar-member]')) {
            contactCardOpen = false;
            root.querySelector('.fcm-chat-contact-card')?.remove();
        }
        if (!event.target.closest('.fcm-chat-message')) panel.querySelectorAll('.fcm-chat-message.selected').forEach(element => element.classList.remove('selected'));
    });
    root.querySelector('[data-status]')?.addEventListener('click', () => root.querySelector('.fcm-chat-status-menu')?.classList.toggle('open'));
    root.querySelectorAll('[data-status-value]').forEach(button => button.addEventListener('click', () => setStatus(button.dataset.statusValue)));
    bindChatSettingsEvents({ root, renderChat, refreshChatSettings, chatColors });
    bindChatProfileEvents({ root, getPlayer: () => Player, renderChat, saveOwnProfile, setStatus });
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
    const sent = runWithoutOutgoingCapture(() => {
        if (selectedChannel === 'whisper') {
            if (!canSendBcxWhisper(selectedMember)) return false;
            ServerSend('ChatRoomChat', { Type: 'Hidden', Target: selectedMember, Content: 'FCM::CHAT::MESSAGE', Dictionary: [{ Tag: 'FCM::CHAT::MESSAGE', MessageId: outgoingId }] });
            if (replyTarget) ServerSend('ChatRoomChat', { Type: 'Hidden', Target: selectedMember, Content: 'FCM::CHAT::TAG', Dictionary: [{ Tag: 'FCM::CHAT::TAG', ReplyId: replyId, TargetSharedId: replyTarget.sharedMsgId, Preview: replyTarget.preview }] });
            const data = typeof globalThis.ChatRoomGenerateChatRoomChatMessage === 'function'
                ? globalThis.ChatRoomGenerateChatRoomChatMessage('Whisper', content, replyId)
                : { Type: 'Whisper', Content: content, Dictionary: replyId ? [{ Tag: 'ReplyId', ReplyId: replyId }] : [] };
            data.Target = selectedMember;
            ServerSend('ChatRoomChat', data);
            return true;
        }
        return sendBcxAwareBeep({ MemberNumber: selectedMember, BeepType: '', Message: content });
    });
    if (!sent) return;
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

function selectedMessageRecords() {
    return selectedMessages(conversation.messages, selectedMessageIds);
}

function updateMultiSelectUi() {
    syncMultiSelectUi(root?.querySelector('#fcm-chat-panel'), {
        active: multiSelectMode,
        selectedIds: selectedMessageIds,
        canForwardToRoom: !!ChatRoomData,
        selectedCountText: count => TH('chatSelectedCount', count),
    });
}

function enterMultiSelect(messageElement) {
    multiSelectMode = true;
    if (messageElement?.dataset.msgId) selectedMessageIds.add(String(messageElement.dataset.msgId));
    root?.querySelectorAll('.fcm-chat-message.selected').forEach(message => message.classList.remove('selected'));
    updateMultiSelectUi();
}

function exitMultiSelect() {
    closeForwardTargetList();
    resetMessageSelectionState();
    updateMultiSelectUi();
}

function formatForwardedMessage(message) {
    return forwardedMessageText(message, { player: Player, conversationMemberNumber: selectedMember, displayName: getDisplayName, cleanContent: cleanMessage });
}

async function forwardSelectedTo(memberNumber) {
    const target = Number(memberNumber);
    const available = capability(target);
    if (!target || (available === 'none' && !isFriendOf(target))) return;
    const selected = selectedMessageRecords();
    await forEachForwardedMessage(selected, async message => {
        const content = formatForwardedMessage(message);
        if (available === 'none') {
            const queued = OfflineQueue.add(target, content);
            await recordMessage({ memberNumber: target, direction: 'out', channel: 'beep', content, queued: true, queueId: queued.id }, { notify: false });
            return;
        }
        const sent = runWithoutOutgoingCapture(() => available === 'whisper'
            ? sendBcxAwareWhisper({ Type: 'Whisper', Target: target, Content: content })
            : sendBcxAwareBeep({ MemberNumber: target, BeepType: '', Message: content }));
        if (sent) await recordMessage({ memberNumber: target, direction: 'out', channel: available, content }, { notify: false });
    });
    exitMultiSelect();
}

function showForwardTargetList() {
    if (!selectedMessageIds.size) return;
    const list = root?.querySelector('.fcm-chat-list');
    if (!list || forwardTargetMode) return;
    forwardTargetMode = true;
    forwardTargetTab = 'room';
    refreshForwardTargetList();
    root.querySelector('.fcm-chat-body')?.classList.add('forward-target-mode');
    list.classList.remove('slide-out');
    root.querySelector('.fcm-chat-main')?.classList.remove('slide-in');
}

function closeForwardTargetList() {
    if (!forwardTargetMode) return;
    const list = root?.querySelector('.fcm-chat-list');
    forwardTargetMode = false;
    root?.querySelector('.fcm-chat-body')?.classList.remove('forward-target-mode');
    if (list) {
        refreshChatList();
        if (stackedDetail) {
            list.classList.add('slide-out');
            root?.querySelector('.fcm-chat-main')?.classList.add('slide-in');
        }
    }
}

function bindForwardTargetRows() {
    bindForwardTargetEvents(root, {
        onCancel: closeForwardTargetList,
        onSelect: forwardSelectedTo,
        onTab: tab => {
            forwardTargetTab = tab;
            refreshForwardTargetList();
        },
    });
}

function refreshForwardTargetList() {
    const list = root?.querySelector('.fcm-chat-list');
    if (!list || !forwardTargetMode) return;
    list.innerHTML = forwardTargetsHtml();
    hydrateChatAvatars();
    bindForwardTargetRows();
}

async function forwardSelectedToRoom() {
    if (!ChatRoomData || !selectedMessageIds.size) return;
    const selected = selectedMessageRecords();
    await forEachForwardedMessage(selected, message => ServerSend('ChatRoomChat', { Type: 'Chat', Content: formatForwardedMessage(message) }));
    exitMultiSelect();
}

function exportSelectedMessages(format) {
    const selected = selectedMessageRecords();
    if (!selected.length) return;
    exportConversationFile(format, { memberNumber: selectedMember, messages: selected, getDisplayName, biography, avatarUrl, chatColors });
}

function bindMessageActions() {
    const log = root?.querySelector('.fcm-chat-messages');
    const menu = root?.querySelector('.fcm-chat-context-menu');
    cleanupMessageActions?.();
    cleanupMessageActions = installMessageActions({
        root,
        log,
        menu,
        isMultiSelectActive: () => multiSelectMode,
        selectedIds: selectedMessageIds,
        updateMultiSelectUi,
        openProfile: openSharedProfile,
        replyToMessage,
        enterMultiSelect,
        isMobile: () => typeof globalThis.CommonIsMobile === 'function' && globalThis.CommonIsMobile(),
    });
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
        const host = createDialogHost({ overlayClass: 'fcm-chat-modal-overlay', dialogClass: 'fcm-chat-modal', overlayStyle: `--s:${cfg.panelColor};--tx:${cfg.fontColor};--ac:${cfg.accentColor}`, onClose: value => resolve(!!value) });
        host.dialog.innerHTML = `<div>${esc(message)}</div><div><button data-modal-cancel>${TH('chatCancel')}</button><button data-modal-ok>${esc(confirmLabel)}</button></div>`;
        host.listen(host.dialog.querySelector('[data-modal-cancel]'), 'click', () => host.close(false));
        host.listen(host.dialog.querySelector('[data-modal-ok]'), 'click', () => host.close(true));
        host.mount();
    });
}

async function deleteConversation() {
    if (!selectedMember || !await showFcmConfirm(T('chatConfirmDeleteConv', getDisplayName(selectedMember)))) return;
    await ChatStore.deleteMember(selectedMember);
    OfflineQueue.removeMember(selectedMember);
    messages = messages.filter(message => message.memberNumber !== selectedMember);
    conversation.reset();
    renderChat();
}

function inviteCurrent() {
    if (!selectedMember || capability(selectedMember) !== 'beep' || !ChatRoomData?.Name) return;
    const room = ChatRoomData;
    const count = ChatRoomCharacter?.length ?? room.MemberCount ?? null;
    const limit = room.MemberLimit ?? null;
    const description = String(room.Description || '').trim();
    const message = `|${room.Name}| - ${room.Creator || '?'} ＜${count ?? 0}/${limit ?? 0}＞${description ? `\n${description}` : ''}`;
    const sent = runWithoutOutgoingCapture(() => sendBcxAwareBeep({ MemberNumber: selectedMember, BeepType: '', IsSecret: false, Message: message }));
    if (!sent) return;
    recordMessage({ memberNumber: selectedMember, direction: 'out', channel: 'beep', content: room.Name, roomName: room.Name }, { notify: false });
}

async function summonCurrent() {
    if (!selectedMember || capability(selectedMember) !== 'beep' || !ChatRoomData?.Name) return;
    if (!await showFcmConfirm(T('beepSummonTitle'), T('beepSummon'))) return;
    const sent = runWithoutOutgoingCapture(() => sendBcxAwareBeep({ MemberNumber: selectedMember, BeepType: '', Message: 'summon', ChatRoomName: ChatRoomData.Name, ChatRoomSpace: ChatRoomData.Space }));
    if (!sent) return;
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
        try { delivered = runWithoutOutgoingCapture(() => sendBcxAwareBeep({ MemberNumber: row.memberNumber, BeepType: '', Message: row.content })); }
        catch (error) { console.warn('🐈‍⬛ [FCM] offline message delivery failed:', error); }
        if (delivered) {
            OfflineQueue.remove([row.id]);
            const stored = (await ChatStore.all()).find(message => message.queueId === row.id);
            if (stored) await ChatStore.put({ ...stored, queued: false, deliveredAt: Date.now() });
        messages = await ChatStore.recentIndex();
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
        const host = createDialogHost({ overlayClass: 'fcm-chat-modal-overlay', dialogClass: 'fcm-chat-modal fcm-chat-group-dialog', overlayStyle: `--s:${cfg.panelColor};--tx:${cfg.fontColor};--ac:${cfg.accentColor}`, onClose: value => resolve(value || '') });
        host.dialog.innerHTML = `<div>${TH('chatNewGroup')}</div><input data-new-group-name maxlength="24" placeholder="${TH('chatNewGroup')}"><div><button data-modal-cancel>${TH('chatCancel')}</button><button data-modal-ok>${TH('btnConfirm')}</button></div>`;
        const input = host.dialog.querySelector('[data-new-group-name]');
        host.listen(host.dialog.querySelector('[data-modal-cancel]'), 'click', () => host.close(''));
        host.listen(host.dialog.querySelector('[data-modal-ok]'), 'click', () => host.close(input.value.trim()));
        host.listen(input, 'keydown', event => { event.stopPropagation(); if (event.key === 'Enter') host.close(input.value.trim()); else if (event.key === 'Escape') host.close(''); });
        host.mount(); input.focus();
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

export { initChat, openChat, closeChat, refreshChatSettings, handleIncomingBeep, handleIncomingChatMessageId, handleIncomingChatTag, handleIncomingFriendRequestNotice, handleIncomingWhisper, handleIncomingWhisperDisplay, handleOutgoingServerSend, handleOnlineFriendsUpdate };

import { cfg, saveCfg } from '../core/config.js';
import { getDisplayName as getSharedDisplayName, getRoomInfo, inRoomFn, onlineFriends, requestOnlineFriends, buildFriendList, getAllRels, isFav, isFriendOf } from '../data/data.js';
import { getCachedRoomInfo, queryRoomInfo } from '../panel/panel-rooms-data.js';
import { PDB, _pc, Snapshot, loadAvatarFromBundle, syncRoomAvatar } from '../data/profile-db.js';
import { ChatStore, OfflineQueue } from './chat/data/chat-store.js';
import { T, TH } from '../i18n/i18n.js';
import { chatFontFamily } from './chat-font.js';
import { profileHtml as renderProfileHtml } from './chat/views/chat-profile-view.js';
import { chatPanelSession } from './chat/controllers/chat-panel-session.js';
import { installDragScroll } from '../ui/drag-scroll.js';
import { themeColors } from '../core/themes.js';
import { showAddFriendConfirm, showRoomJoinConfirm, showIncomingRoomInvite } from '../chat/actions.js';
import { canSendBcxWhisper, sendBcxAwareBeep, sendBcxAwareWhisper } from './bcx-compat.js';
import { injectChatStyles } from './chat/views/chat-styles.js';
import { warnLimited } from '../core/logger.js';
import { balloonPreviewText, cleanMessage, esc } from './chat/services/chat-content.js';
import { exportConversation as exportConversationFile } from './chat/services/chat-export.js';
import { initChatAudio, playNotificationSound } from './chat-audio.js';
import { installChatDrag, resetBalloonInteraction } from './chat/controllers/chat-drag.js';
import { createChatBalloonController } from './chat/controllers/chat-balloon.js';
import { updateMultiSelectUi as syncMultiSelectUi } from './chat/views/chat-selection-view.js';
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
import { createOfflineDeliveryService } from './chat/services/chat-offline-delivery.js';
import { createChatSender } from './chat/services/chat-sender.js';
import { createChatMessageRecorder } from './chat/services/chat-message-recorder.js';
import { createChatPresenceService } from './chat/services/chat-presence.js';
import { createChatRoomStateService } from './chat/services/chat-room-state.js';
import { buildGroupDefinitions, filterContactRows, filterGroupRows, filterNotificationRows, selectedGroupDefinition } from './chat/data/chat-list-data.js';
import { createProfileSuggestionController } from './chat/controllers/chat-profile-suggest.js';
import { createChatReplyController } from './chat/controllers/chat-reply.js';
import { createChatContactCardController } from './chat/controllers/chat-contact-card.js';
import { createChatHistoryViewportController } from './chat/controllers/chat-history-viewport.js';
import { createChatMessageSelectionController } from './chat/controllers/chat-message-selection.js';
import { createChatForwardTargetsController } from './chat/controllers/chat-forward-targets.js';
import { createChatSelectedActions } from './chat/services/chat-selected-actions.js';
import { createChatOwnProfileService } from './chat/services/chat-own-profile.js';
import { createChatDialogs } from './chat/controllers/chat-dialogs.js';
import { createChatRoomActions } from './chat/services/chat-room-actions.js';
import { createChatConversationActions } from './chat/services/chat-conversation-actions.js';
import { createChatMessageImagesController } from './chat/controllers/chat-message-images.js';
import {
    CHAT_ICON, NOTIFICATION_ICON, GROUP_ICON,
    EXIT_ICON, LAYOUT_ICON, EDIT_ICON, SETTINGS_ICON,
    WATER_ICON, MAXIMIZE_ICON,
} from '../ui/icons.js';

let root = null;
let selectedMember = null;
let messages = [];
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
let bcxNoticeTimer = 0;
let cleanupMessageActions = null;
const whisperMetadata = new WhisperMetadata();
const remoteProfiles = new Map();

function resetMessageSelectionState() {
    messageSelection.reset();
    forwardTargets.reset();
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
const messageRecorder = createChatMessageRecorder({
    config: cfg,
    normalizeMessage: data => normalizeTransportMessage(data, { displayName: getDisplayName, selectedMember }),
    chatStore: ChatStore,
    conversation,
    isPanelVisible: () => !!root?.isConnected && root.style.display !== 'none',
    isSelectedMember: memberNumber => Number(memberNumber) === Number(selectedMember),
    setMessageIndex: value => { messages = value; },
    appendMessage: message => appendConversationMessage(message),
    refreshList: () => refreshVisibleChatScroll(),
    notifyIncoming: message => {
        chatBalloons.showIncoming(message);
        playNotificationSound();
        autoReply.handle(message);
    },
});
const autoReply = createChatAutoReplyService({
    config: cfg, inRoom: inRoomFn, isOnline, sendWhisper: sendBcxAwareWhisper, sendBeep: sendBcxAwareBeep,
    recordMessage: (...args) => recordMessage(...args), runWithoutOutgoingCapture,
});
const offlineDelivery = createOfflineDeliveryService({
    offlineQueue: OfflineQueue, chatStore: ChatStore, isFriend: isFriendOf, sendBeep: sendBcxAwareBeep, runWithoutOutgoingCapture,
    onDelivered: async stored => {
        messages = await ChatStore.recentIndex();
        if (root?.isConnected && root.style.display !== 'none') {
            const element = root.querySelector(`[data-msg-id="${CSS.escape(String(stored?.id || ''))}"]`);
            element?.classList.remove('queued');
            refreshVisibleChatScroll();
        }
    },
    onError: error => console.warn('🐈‍⬛ [FCM] offline message delivery failed:', error),
});
const chatSender = createChatSender({
    offlineQueue: OfflineQueue, canSendWhisper: canSendBcxWhisper, sendServer: (...args) => ServerSend(...args),
    sendBeep: sendBcxAwareBeep, recordMessage: (...args) => recordMessage(...args), runWithoutOutgoingCapture,
});
const presence = createChatPresenceService({
    config: cfg, saveConfig: saveCfg, getPlayer: () => Player,
    syncSharedSettings: () => globalThis.ServerPlayerOnlineSharedSettingsSync?.(),
    onError: error => warnLimited('chat presence sync failed', error),
});
const roomState = createChatRoomStateService({
    getRoomInfo, inRoom: inRoomFn, isFriend: isFriendOf, isOnline,
    getCurrentRoom: () => ChatRoomData, text: T,
});
const profileSuggestion = createProfileSuggestionController({
    getRoot: () => root, getSelectedMember: () => selectedMember, getFriendRows: buildFriendList,
    findLiveCharacter: character, loadProfile: memberNumber => PDB.get(memberNumber), displayName: getDisplayName,
    avatarHtml, text: TH,
});
const replyController = createChatReplyController({ getRoot: () => root, cleanMessage, text: TH });
const contactCard = createChatContactCardController({
    getRoot: () => root, getMemberNumber: () => selectedMember, loadProfile: memberNumber => PDB.get(memberNumber),
    renderHtml: contactCardHtml, hydrateAvatars: hydrateChatAvatars, findLiveCharacter: character,
    deleteSnapshot: memberNumber => Snapshot.delete(memberNumber),
    loadCharacterCanvas: characterValue => globalThis.CharacterLoadCanvas?.(characterValue),
    nextPaint: () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    createFaceSnapshot: (characterValue, size) => PDB._face(characterValue, size),
    saveSnapshot: (...args) => Snapshot.save(...args), loadAvatarFromBundle,
    addFriend: showAddFriendConfirm, displayName: getDisplayName, openProfile: openSharedProfile,
});
const historyViewport = createChatHistoryViewportController({
    getRoot: () => root, getMemberNumber: () => selectedMember, conversation, store: ChatStore,
    renderMessages: conversationMessagesHtml, bindImages: (...args) => messageImages.bind(...args), syncSelection: () => messageSelection.updateUi(),
    joinRoom: showRoomJoinConfirm, text: T,
});
const forwardTargets = createChatForwardTargetsController({
    getRoot: () => root, getRoomCharacters: () => ChatRoomCharacter, getFriendRows: buildFriendList,
    getSelfMemberNumber: () => Player?.MemberNumber, getConversationMemberNumber: () => selectedMember,
    isFriend: isFriendOf, isOnline, avatarHtml, displayName: getDisplayName, text: TH,
    hasSelection: () => messageSelection.size() > 0, isStackedDetail: () => stackedDetail,
    refreshChatList, hydrateAvatars: hydrateChatAvatars, onSelect: memberNumber => selectedActions.forwardTo(memberNumber),
});
const messageSelection = createChatMessageSelectionController({
    getPanel: () => root?.querySelector('#fcm-chat-panel'), getMessages: () => conversation.messages,
    canForwardToRoom: () => !!ChatRoomData, renderUi: syncMultiSelectUi,
    selectedCountText: count => TH('chatSelectedCount', count), onExit: forwardTargets.close,
});
const selectedActions = createChatSelectedActions({
    selection: messageSelection, getPlayer: () => Player, getConversationMemberNumber: () => selectedMember,
    displayName: getDisplayName, cleanContent: cleanMessage, capability, isFriend: isFriendOf,
    offlineQueue: OfflineQueue, recordMessage: (...args) => recordMessage(...args), runWithoutOutgoingCapture,
    sendWhisper: sendBcxAwareWhisper, sendBeep: sendBcxAwareBeep, getRoom: () => ChatRoomData,
    sendRoomMessage: (...args) => ServerSend(...args), exportConversation: exportConversationFile,
    biography, avatarUrl, chatColors,
});
const ownProfile = createChatOwnProfileService({
    config: cfg, saveConfig: saveCfg, getRoot: () => root, getPlayer: () => Player,
    text: T, queueAccountUpdate: data => ServerAccountUpdate.QueueData(data), warn: warnLimited, onSaved: renderChat,
});
const chatDialogs = createChatDialogs({ colors: () => [cfg.panelColor, cfg.fontColor, cfg.accentColor], text: T, htmlText: TH });
const messageImages = createChatMessageImagesController({
    getViewport: () => conversation.viewport, confirm: chatDialogs.confirm, text: T, rerender: renderChat,
});
const roomActions = createChatRoomActions({
    getMemberNumber: () => selectedMember, getRoom: () => ChatRoomData, getRoomCharacters: () => ChatRoomCharacter,
    capability, confirm: chatDialogs.confirm, text: T, runWithoutOutgoingCapture, sendBeep: sendBcxAwareBeep,
    recordMessage: (...args) => recordMessage(...args),
});
const conversationActions = createChatConversationActions({
    getMemberNumber: () => selectedMember, displayName: getDisplayName, confirm: chatDialogs.confirm, text: T,
    chatStore: ChatStore, offlineQueue: OfflineQueue,
    removeFromIndex: memberNumber => { messages = messages.filter(message => Number(message.memberNumber) !== memberNumber); },
    resetConversation: () => conversation.reset(), exportConversation: exportConversationFile,
    biography, avatarUrl, chatColors, onDeleted: renderChat,
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
    document.addEventListener('pointerdown', contactCard.handleOutsidePointer, true);
}

function recordMessage(data, options) {
    return messageRecorder.record(data, options);
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
        replyController.clear({ focus: false });
        contactCard.close();
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
    return filterNotificationRows(rows, notificationSearch, { displayName: getDisplayName, biography, cleanMessage });
}

function closeChat() {
    const memberToClose = selectedMember;
    selectedMember = null;
    resetMessageSelectionState();
    replyController.clear({ focus: false });
    contactCard.close();
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
    return filterContactRows(conversations(), { presence: presenceFilter, relation: relationFilter, search }, {
        isOnline, isFavorite: isFav, getRelations: getAllRels, displayName: getDisplayName, biography,
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
    return buildGroupDefinitions({ roomCharacters: ChatRoomCharacter, selfMemberNumber: Player?.MemberNumber, friendRows: buildFriendList(), isFavorite: isFav, groups: cfg.chatGroups, memberGroups: cfg.chatMemberGroups, text: T });
}

function groupsHtml() {
    const definitions = groupDefinitions();
    const group = selectedGroupDefinition(definitions, groupMode, selectedGroup);
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

function listHtml() {
    if (forwardTargets.isActive()) return forwardTargets.html();
    if (activeView === 'profile') return profileHtml();
    if (activeView === 'notifications') return notificationsHtml();
    if (activeView === 'groups') return groupsHtml();
    if (activeView === 'settings') return settingsHtml();
    return chatListHtml();
}

function conversationHtml() {
    if (!selectedMember) return renderConversationHtml({ memberNumber: null });
    const available = capability(selectedMember);
    const { roomInfo, roomText: baseRoomText, canOpenRoom, unavailable } = roomState.get(selectedMember);
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
        contactCardHtml: contactCard.isOpen() ? contactCardHtml() : '', messagesHtml: conversationMessagesHtml(conversation.messages),
        unread: conversation.unread, multiSelect: messageSelection.isActive(), available, online,
        canInvite: available !== 'none' && !inRoomFn(selectedMember), inputPlaceholder, unavailable,
        replyTarget: replyController.get(), selectedCount: messageSelection.size(), canForwardToRoom: !!ChatRoomData,
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
        const group = selectedGroupDefinition(definitions, groupMode, selectedGroup);
        return contactRows(filteredGroupRows(group)) || `<div class="fcm-chat-empty">${TH('chatGroupEmpty')}</div>`;
    }
    return null;
}

function filteredGroupRows(group) {
    return filterGroupRows(group, groupSearch, getDisplayName, biography);
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
    if (forwardTargets.isActive()) forwardTargets.bind();
    else bindChatListEvents(list);
    hydrateChatAvatars();
    installDragScroll(list, '.fcm-chat-scroll');
    if (preserveScroll) {
        const scroll = list.querySelector('.fcm-chat-scroll');
        if (scroll) scroll.scrollTop = scrollTop;
    }
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
    messageImages.bind(inserted, log);
    if (shouldFollowLatest) {
        conversation.viewport.follow();
        conversation.unread = 0;
        requestAnimationFrame(() => { conversation.viewport.scrollToLatest(log); historyViewport.updateUnreadNotice(); });
    } else {
        conversation.unread++;
        historyViewport.updateUnreadNotice();
    }
}

async function loadConversation(memberNumber) {
    await conversation.load(ChatStore, memberNumber, target => Number(selectedMember) === target);
}

function refreshConversationRoomMeta() {
    if (!selectedMember) return;
    const { roomInfo, canOpenRoom } = roomState.get(selectedMember);
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
    const { roomInfo, roomText, canOpenRoom, unavailable } = roomState.get(selectedMember);
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
    profileSuggestion.reset();
    historyViewport.reset();
    const settingsScrollTop = activeView === 'settings' ? root.querySelector('.fcm-chat-list')?.scrollTop : null;
    const [chatPanel, chatText, chatAccent] = chatColors();
    const sessionSizeStyle = chatPanelSession.inlineSizeStyle();
    root.innerHTML = `<div id="fcm-chat-panel" class="${maximized ? 'maximized' : ''}" data-layout-mode="${esc(cfg.chatLayout || 'split')}" data-theme="${esc(cfg.chatThemeMode === 'preset' ? cfg.chatThemePreset : cfg.chatThemeMode === 'custom' ? 'custom' : cfg.themePreset || 'violet')}" style="${sessionSizeStyle}--s:${esc(chatPanel)};--tx:${esc(chatText)};--ac:${esc(chatAccent)};--chat-font-size:${Number(cfg.chatFontSize) || 13}px;--chat-font-family:${esc(chatFontFamily())}">
        <div class="fcm-chat-titlebar"><b>FCM-Chat</b><span></span><button class="fcm-chat-icon-action ${cfg.chatLayout === 'stacked' ? 'active' : ''}" data-layout title="${TH('chatToggleLayout')}">${LAYOUT_ICON}<i>${cfg.chatLayout === 'stacked' ? TH('chatLayoutSplit') : TH('chatLayoutMerged')}</i></button><button class="fcm-chat-icon-action ${maximized ? 'active' : ''}" data-max title="${TH('chatToggleMax')}">${MAXIMIZE_ICON}<i>${maximized ? TH('chatRestore') : TH('chatMaximize')}</i></button><button class="fcm-chat-icon-action" data-min title="${TH('chatMinimize')}">—</button><button class="fcm-chat-icon-action" data-close title="${TH('chatClose')}">×</button></div>
        <div class="fcm-chat-body view-${esc(activeView)} ${cfg.chatLayout === 'stacked' ? 'stacked' : ''} ${activeView === 'profile' || activeView === 'settings' ? 'wide-view' : ''} ${forwardTargets.isActive() ? 'forward-target-mode' : ''}">
            <nav class="fcm-chat-rail">
                <button class="fcm-chat-rail-button fcm-chat-self ${activeView === 'profile' ? 'active' : ''}" data-view="profile" title="${TH('chatProfileTab')}">${avatarHtml(Player?.MemberNumber || 0, 34, 'toolbar')}</button>
                <button class="fcm-chat-rail-button ${activeView === 'notifications' ? 'active' : ''}" data-view="notifications" title="${TH('chatNotificationsTab')}">${NOTIFICATION_ICON}${unreadBadge()}</button>
                <button class="fcm-chat-rail-button ${activeView === 'chat' ? 'active' : ''}" data-view="chat" title="${TH('chatChatTab')}">${CHAT_ICON}</button>
                <button class="fcm-chat-rail-button ${activeView === 'groups' ? 'active' : ''}" data-view="groups" title="${TH('chatGroupsTab')}">${GROUP_ICON}</button>
                <span></span>
                <button class="fcm-chat-rail-button" data-status title="${TH('chatStatusTab')}"><i class="fcm-status-dot ${esc(cfg.chatStatus || 'online')}"></i></button>
                <button class="fcm-chat-rail-button ${activeView === 'settings' ? 'active' : ''}" data-view="settings" title="${TH('chatSettingsTab')}">${SETTINGS_ICON}</button>
            </nav>
            <aside class="fcm-chat-list ${stackedDetail && !forwardTargets.isActive() ? 'slide-out' : ''}">${listHtml()}</aside>
            <main class="fcm-chat-main ${stackedDetail && !forwardTargets.isActive() ? 'slide-in' : ''}">${conversationHtml()}</main>
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
        messageImages.bind(log, log);
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
        replyController.clear({ focus: false });
        contactCard.close();
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
        const label = await chatDialogs.promptGroupName(); if (!label) return;
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
    historyViewport.bind(conversationLog, main.querySelector('[data-new-messages]'));
    main.querySelector('[data-multi-forward-contact]')?.addEventListener('click', forwardTargets.show);
    main.querySelector('[data-multi-forward-room]')?.addEventListener('click', selectedActions.forwardToRoom);
    main.querySelectorAll('[data-multi-export]').forEach(button => button.addEventListener('click', () => selectedActions.exportMessages(button.dataset.multiExport)));
    main.querySelector('[data-multi-cancel]')?.addEventListener('click', messageSelection.exit);
    if (messageSelection.isActive()) messageSelection.updateUi();
    bindMessageActions();
    main.querySelector('[data-cancel-reply]')?.addEventListener('click', replyController.clear);
    main.querySelector('[data-input]')?.addEventListener('keydown', event => { event.stopPropagation(); if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendCurrentMessage(); } });
    main.querySelector('[data-input]')?.addEventListener('input', profileSuggestion.update);
    main.querySelector('[data-delete]')?.addEventListener('click', conversationActions.deleteCurrent);
    main.querySelectorAll('[data-export]').forEach(button => button.addEventListener('click', () => conversationActions.exportCurrent(button.dataset.export)));
    main.querySelector('[data-invite]')?.addEventListener('click', roomActions.inviteCurrent);
    main.querySelector('[data-summon]')?.addEventListener('click', roomActions.summonCurrent);
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
    main.querySelector('.fcm-chat-conversation-header > [data-avatar-member]')?.addEventListener('click', contactCard.toggle);
    contactCard.bind();
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
        const label = await chatDialogs.promptGroupName(); if (!label) return;
        const id = `group-${Date.now().toString(36)}`; cfg.chatGroups ||= {}; cfg.chatGroups[id] = label; selectedGroup = id; groupMode = 'groups'; saveCfg(); renderChat();
    });
}

function refreshConversationMain({ scrollToLatest = true } = {}) {
    const main = root?.querySelector('.fcm-chat-main');
    if (!main) return;
    profileSuggestion.reset();
    historyViewport.reset();
    main.innerHTML = conversationHtml();
    bindConversationEvents();
    installDragScroll(main, '.fcm-chat-messages');
    refreshConversationRoomMeta();
    hydrateChatAvatars();
    const log = main.querySelector('.fcm-chat-messages');
    if (log) {
        messageImages.bind(log, log);
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
    forwardTargets.bind();
    panel.addEventListener('click', event => {
        if (!event.target.closest('.fcm-chat-message')) panel.querySelectorAll('.fcm-chat-message.selected').forEach(element => element.classList.remove('selected'));
    });
    root.querySelector('[data-status]')?.addEventListener('click', () => root.querySelector('.fcm-chat-status-menu')?.classList.toggle('open'));
    root.querySelectorAll('[data-status-value]').forEach(button => button.addEventListener('click', () => setStatus(button.dataset.statusValue)));
    bindChatSettingsEvents({ root, renderChat, refreshChatSettings, chatColors });
    bindChatProfileEvents({ root, getPlayer: () => Player, renderChat, saveProfile: ownProfile.save, setStatus });
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

function sendCurrentMessage() {
    const input = root?.querySelector('[data-input]');
    const content = expandProfileMentions(input?.value.trim() || '');
    if (!content || !selectedMember) return;
    const available = capability(selectedMember);
    if (available === 'none' && !isFriendOf(selectedMember)) return;
    const sent = chatSender.send({ memberNumber: selectedMember, content, channel: available, replyTarget: replyController.get() });
    if (!sent) return;
    replyController.clear({ focus: false });
    input.value = '';
}

function bindMessageActions() {
    const log = root?.querySelector('.fcm-chat-messages');
    const menu = root?.querySelector('.fcm-chat-context-menu');
    cleanupMessageActions?.();
    cleanupMessageActions = installMessageActions({
        root,
        log,
        menu,
        isMultiSelectActive: messageSelection.isActive,
        selectedIds: messageSelection.ids,
        updateMultiSelectUi: messageSelection.updateUi,
        openProfile: openSharedProfile,
        replyToMessage: replyController.select,
        enterMultiSelect: messageSelection.enter,
        isMobile: () => typeof globalThis.CommonIsMobile === 'function' && globalThis.CommonIsMobile(),
    });
}

async function handleOnlineFriendsUpdate(result) {
    if (!cfg.communicationEnabled || !Array.isArray(result)) return;
    if (presence.updateOnlineRows(result)) {
        if (root?.isConnected && root.style.display !== 'none') {
            refreshVisibleChatScroll();
            refreshConversationPresence();
        }
    }
    offlineDelivery.dispatch(result);
}

function setStatus(status, rerender = true) {
    presence.setStatus(status);
    const dot = root?.querySelector('.fcm-chat-rail [data-status] .fcm-status-dot');
    if (dot) dot.className = `fcm-status-dot ${status}`;
    if (rerender) renderChat();
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

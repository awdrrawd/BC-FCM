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
import { resetBalloonInteraction } from './chat/controllers/chat-drag.js';
import { createChatBalloonController } from './chat/controllers/chat-balloon.js';
import { updateMultiSelectUi as syncMultiSelectUi } from './chat/views/chat-selection-view.js';
import { installMessageActions } from './chat/events/chat-message-actions.js';
import { bindChatSettingsEvents } from './chat/events/chat-settings-events.js';
import { bindChatProfileEvents } from './chat/events/chat-profile-events.js';
import { settingsHtml as renderSettingsHtml } from './chat/views/chat-settings-view.js';
import { conversationMessagesHtml } from './chat/views/chat-message-view.js';
import { normalizeMessage as normalizeTransportMessage } from './chat/services/chat-transport.js';
import { ChatConversationController } from './chat/controllers/chat-conversation-controller.js';
import { createChatContactService } from './chat/services/chat-contact-service.js';
import { positionPanel as applyPanelPosition } from './chat/controllers/chat-panel-layout.js';
import { createChatAutoReplyService } from './chat/services/chat-auto-reply.js';
import { createOfflineDeliveryService } from './chat/services/chat-offline-delivery.js';
import { createChatSender } from './chat/services/chat-sender.js';
import { createChatMessageRecorder } from './chat/services/chat-message-recorder.js';
import { createChatPresenceService } from './chat/services/chat-presence.js';
import { createChatRoomStateService } from './chat/services/chat-room-state.js';
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
import { createChatProfileViewer } from './chat/services/chat-profile-viewer.js';
import { createChatComposer } from './chat/controllers/chat-composer.js';
import { createChatTransportHandler } from './chat/services/chat-transport-handler.js';
import { createChatListPresenter } from './chat/views/chat-list-presenter.js';
import { createChatConversationPresenter } from './chat/views/chat-conversation-presenter.js';
import { createChatConversationPresence } from './chat/controllers/chat-conversation-presence.js';
import { createChatMessageAppender } from './chat/controllers/chat-message-appender.js';
import { createChatListController } from './chat/controllers/chat-list-controller.js';
import { createChatListNavigation } from './chat/controllers/chat-list-navigation.js';
import { createChatMemberSelection } from './chat/controllers/chat-member-selection.js';
import { chatShellHtml } from './chat/views/chat-shell-view.js';
import { createChatPanelControls } from './chat/controllers/chat-panel-controls.js';
import { createChatConversationEvents } from './chat/controllers/chat-conversation-events.js';
import { createChatShellEvents } from './chat/controllers/chat-shell-events.js';
import { EDIT_ICON, WATER_ICON } from '../ui/icons.js';

let root = null;
let selectedMember = null;
let messages = [];
const conversation = new ChatConversationController(50, 40);
let activeView = 'chat';
let maximized = false;
let stackedDetail = false;
let suppressOutgoing = 0;
let bcxNoticeTimer = 0;
let cleanupMessageActions = null;
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
    appendMessage: message => messageAppender.append(message),
    refreshList: () => chatList.refreshVisible(),
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
            chatList.refreshVisible();
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
const composer = createChatComposer({
    getRoot: () => root, getMemberNumber: () => selectedMember, displayName: getDisplayName,
    capability, isFriend: isFriendOf, sender: chatSender, getReplyTarget: replyController.get,
    clearReplyTarget: replyController.clear,
});
const profileViewer = createChatProfileViewer({
    findLiveCharacter: character, loadProfile: memberNumber => PDB.get(memberNumber),
    loadCharacter: (bundle, memberNumber) => globalThis.CharacterLoadOnline(bundle, memberNumber),
    showInformationSheet: characterValue => globalThis.InformationSheetLoadCharacter?.(characterValue), warn: warnLimited,
});
const contactCard = createChatContactCardController({
    getRoot: () => root, getMemberNumber: () => selectedMember, loadProfile: memberNumber => PDB.get(memberNumber),
    renderHtml: () => conversationPresenter.contactCardHtml(), hydrateAvatars: hydrateChatAvatars, findLiveCharacter: character,
    deleteSnapshot: memberNumber => Snapshot.delete(memberNumber),
    loadCharacterCanvas: characterValue => globalThis.CharacterLoadCanvas?.(characterValue),
    nextPaint: () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))),
    createFaceSnapshot: (characterValue, size) => PDB._face(characterValue, size),
    saveSnapshot: (...args) => Snapshot.save(...args), loadAvatarFromBundle,
    addFriend: showAddFriendConfirm, displayName: getDisplayName, openProfile: profileViewer.open,
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
    refreshChatList: () => chatList.refresh(), hydrateAvatars: hydrateChatAvatars, onSelect: memberNumber => selectedActions.forwardTo(memberNumber),
});
const messageSelection = createChatMessageSelectionController({
    getPanel: () => root?.querySelector('#fcm-chat-panel'), getMessages: () => conversation.messages,
    canForwardToRoom: () => !!ChatRoomData, renderUi: syncMultiSelectUi,
    selectedCountText: count => TH('chatSelectedCount', count), onExit: forwardTargets.close,
});
const conversationPresenter = createChatConversationPresenter({
    getMemberNumber: () => selectedMember, getConfig: () => cfg, getRoom: () => ChatRoomData,
    getRoomCharacters: () => ChatRoomCharacter, getCachedRoomInfo, capability, roomState,
    isFriend: isFriendOf, inRoom: inRoomFn, avatarHtml, displayName: getDisplayName, biography,
    hasSavedProfile: memberNumber => !!_pc[memberNumber]?.characterBundle,
    isContactCardOpen: contactCard.isOpen, getMessages: () => conversation.messages,
    getUnread: () => conversation.unread, isMultiSelect: messageSelection.isActive,
    getReplyTarget: replyController.get, getSelectedCount: messageSelection.size, text: T,
});
const conversationPresence = createChatConversationPresence({
    getRoot: () => root, getMemberNumber: () => selectedMember, getRoom: () => ChatRoomData,
    getOnlineFriends: () => onlineFriends, roomState, capability, inRoom: inRoomFn, sharedProfile,
    text: T, queryRoomInfo,
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
const messageAppender = createChatMessageAppender({
    getRoot: () => root, conversation, bindImages: (...args) => messageImages.bind(...args),
    updateUnreadNotice: historyViewport.updateUnreadNotice, joinRoom: showRoomJoinConfirm,
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
const transportHandler = createChatTransportHandler({
    getPlayer: () => Player, getMessages: () => messages, getRoot: () => root,
    recordMessage: (...args) => recordMessage(...args), chatStore: ChatStore,
    setRemoteProfile: (memberNumber, profile) => remoteProfiles.set(memberNumber, profile), displayName: getDisplayName,
    showRoomInvite: showIncomingRoomInvite, htmlText: TH, warn: warnLimited,
    isEnabled: () => cfg.communicationEnabled, isOutgoingSuppressed: () => suppressOutgoing > 0,
});
const memberSelection = createChatMemberSelection({
    getRoot: () => root, getMemberNumber: () => selectedMember, setMemberNumber: value => { selectedMember = value; },
    resetSelection: resetMessageSelectionState, clearReply: replyController.clear, closeContactCard: contactCard.close,
    setStackedDetail: value => { stackedDetail = value; }, chatStore: ChatStore,
    setMessageIndex: value => { messages = value; }, loadConversation,
    refreshBadges: () => chatBalloons.refreshBadges(), getLayout: () => cfg.chatLayout,
    refreshConversation: refreshConversationMain, unreadCount: () => listPresenter.unreadCount(),
});
const listNavigation = createChatListNavigation({
    config: cfg, saveConfig: saveCfg, promptGroupName: chatDialogs.promptGroupName,
    refreshList: options => chatList.refresh(options), refreshVisible: () => chatList.refreshVisible(),
    bindMemberRows: memberSelection.bind,
});
const listPresenter = createChatListPresenter({
    getMessages: () => messages, getFriendRows: buildFriendList, getPlayerMemberNumber: () => Player?.MemberNumber,
    getSelectedMember: () => selectedMember, getJustOpenedMember: memberSelection.getJustOpenedMember,
    getRoomCharacters: () => ChatRoomCharacter, getConfig: () => cfg,
    getState: () => ({ activeView, ...listNavigation.getState() }),
    avatarHtml, displayName: getDisplayName, biography, cleanMessage, isOnline, isFavorite: isFav,
    getRelations: getAllRels, text: T, htmlText: TH,
});
const chatList = createChatListController({
    getRoot: () => root, renderListHtml: listHtml, renderVisibleScrollHtml: listPresenter.visibleScrollHtml,
    isForwardTargetsActive: forwardTargets.isActive, bindForwardTargets: forwardTargets.bind,
    bindListEvents: listNavigation.bind, bindMemberRows: memberSelection.bind, hydrateAvatars: hydrateChatAvatars, installDragScroll,
});
const handleIncomingBeep = transportHandler.incomingBeep;
const handleIncomingWhisper = transportHandler.incomingWhisper;
const handleIncomingWhisperDisplay = transportHandler.incomingWhisperDisplay;
const handleIncomingChatTag = transportHandler.receiveReplyTag;
const handleIncomingChatMessageId = transportHandler.receiveMessageId;
const handleIncomingFriendRequestNotice = transportHandler.incomingFriendRequest;
const handleOutgoingServerSend = transportHandler.outgoing;
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
    unreadCount: memberNumber => listPresenter.unreadCount(memberNumber),
    waterShapeHtml,
});
const panelControls = createChatPanelControls({
    getRoot: () => root, config: cfg, saveConfig: saveCfg, panelSession: chatPanelSession,
    getMaximized: () => maximized, setMaximized: value => { maximized = value; },
    setStackedDetail: value => { stackedDetail = value; },
    getSelectedMember: () => selectedMember, closeChat, minimizeChat,
    syncBalloonVisibility: chatBalloons.syncVisibility, text: T, htmlText: TH,
});
const conversationEvents = createChatConversationEvents({
    getRoot: () => root, getMemberNumber: () => selectedMember, config: cfg, saveConfig: saveCfg,
    closeStackedDetail: panelControls.closeStackedDetail, composer, historyViewport, forwardTargets,
    selectedActions, messageSelection, bindMessageActions, replyController, profileSuggestion,
    conversationActions, roomActions, showRoomJoin: showRoomJoinConfirm, getCachedRoomInfo, contactCard,
    promptGroupName: chatDialogs.promptGroupName, createGroup: listNavigation.createGroup, rerender: renderChat,
});
const shellEvents = createChatShellEvents({
    getRoot: () => root, panelControls, setActiveView: value => { activeView = value; },
    resetSelection: resetMessageSelectionState, setStackedDetail: value => { stackedDetail = value; }, rerender: renderChat,
    bindListNavigation: listNavigation.bind, bindConversation: conversationEvents.bind, bindForwardTargets: forwardTargets.bind,
    setStatus, bindSettings: () => bindChatSettingsEvents({ root, renderChat, refreshChatSettings, chatColors }),
    bindProfile: () => bindChatProfileEvents({ root, getPlayer: () => Player, renderChat, saveProfile: ownProfile.save, setStatus }),
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

function unreadBadge(memberNumber = null) {
    const count = listPresenter.unreadCount(memberNumber);
    return `<b class="fcm-chat-unread ${count ? '' : 'hidden'}">${Math.min(count, 99)}</b>`;
}

async function openChat(memberNumber = null) {
    if (!cfg.communicationEnabled) return false;
    if (Number(memberNumber) === Number(Player?.MemberNumber)) memberNumber = null;
    if (memberNumber) {
        selectedMember = Number(memberNumber);
        resetMessageSelectionState();
        replyController.clear({ focus: false });
        contactCard.close();
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

function settingsHtml() {
    return renderSettingsHtml();
}

function profileHtml() {
    return renderProfileHtml({ Player, cfg, T, TH, esc, avatarHtml, editIcon: EDIT_ICON });
}

function listHtml() {
    if (forwardTargets.isActive()) return forwardTargets.html();
    if (activeView === 'profile') return profileHtml();
    if (activeView === 'settings') return settingsHtml();
    return listPresenter.viewHtml() || '';
}

async function loadConversation(memberNumber) {
    await conversation.load(ChatStore, memberNumber, target => Number(selectedMember) === target);
}

function renderChat() {
    if (!root) return;
    profileSuggestion.reset();
    historyViewport.reset();
    const settingsScrollTop = activeView === 'settings' ? root.querySelector('.fcm-chat-list')?.scrollTop : null;
    const [chatPanel, chatText, chatAccent] = chatColors();
    const sessionSizeStyle = chatPanelSession.inlineSizeStyle();
    root.innerHTML = chatShellHtml({
        maximized, layout: cfg.chatLayout, theme: cfg.chatThemeMode === 'preset' ? cfg.chatThemePreset : cfg.chatThemeMode === 'custom' ? 'custom' : cfg.themePreset || 'violet',
        sizeStyle: sessionSizeStyle, panelColor: chatPanel, textColor: chatText, accentColor: chatAccent,
        fontSize: cfg.chatFontSize, fontFamily: chatFontFamily(), activeView, stackedDetail,
        forwardTargetMode: forwardTargets.isActive(), selfAvatarHtml: avatarHtml(Player?.MemberNumber || 0, 34, 'toolbar'),
        unreadBadgeHtml: unreadBadge(), status: cfg.chatStatus, listHtml: listHtml(),
        conversationHtml: conversationPresenter.html(), text: TH,
    });
    applyPanelPosition(root.querySelector('#fcm-chat-panel'), maximized, cfg.chatPanelPosition);
    chatBalloons.syncVisibility();
    shellEvents.bind();
    installDragScroll(root, '.fcm-chat-scroll,.fcm-chat-messages,.fcm-chat-profile,.fcm-chat-body.view-settings .fcm-chat-list');
    conversationPresence.refreshRoomMeta();
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

function refreshConversationMain({ scrollToLatest = true } = {}) {
    const main = root?.querySelector('.fcm-chat-main');
    if (!main) return;
    profileSuggestion.reset();
    historyViewport.reset();
    main.innerHTML = conversationPresenter.html();
    conversationEvents.bind();
    installDragScroll(main, '.fcm-chat-messages');
    conversationPresence.refreshRoomMeta();
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
        openProfile: profileViewer.open,
        replyToMessage: replyController.select,
        enterMultiSelect: messageSelection.enter,
        isMobile: () => typeof globalThis.CommonIsMobile === 'function' && globalThis.CommonIsMobile(),
    });
}

async function handleOnlineFriendsUpdate(result) {
    if (!cfg.communicationEnabled || !Array.isArray(result)) return;
    if (presence.updateOnlineRows(result)) {
        if (root?.isConnected && root.style.display !== 'none') {
            chatList.refreshVisible();
            conversationPresence.refresh();
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

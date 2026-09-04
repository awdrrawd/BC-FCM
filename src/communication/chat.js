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
import { createChatRenderer } from './chat/controllers/chat-renderer.js';
import { createChatLifecycle } from './chat/controllers/chat-lifecycle.js';
import { createChatRuntime } from './chat/controllers/chat-runtime.js';
import { EDIT_ICON, WATER_ICON } from '../ui/icons.js';

let root = null;
let selectedMember = null;
let messages = [];
const conversation = new ChatConversationController(50, 40);
let activeView = 'chat';
let maximized = false;
let stackedDetail = false;
let suppressOutgoing = 0;
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
const chatRenderer = createChatRenderer({
    getRoot: () => root, getActiveView: () => activeView, getMaximized: () => maximized,
    getStackedDetail: () => stackedDetail, getConfig: () => cfg, getPlayer: () => Player,
    colors: chatColors, fontFamily: chatFontFamily, panelSession: chatPanelSession,
    profileSuggestion, historyViewport, forwardTargets, avatarHtml, unreadBadgeHtml: unreadBadge,
    listHtml, conversationHtml: conversationPresenter.html, shellHtml: chatShellHtml,
    bindShellEvents: shellEvents.bind, bindConversationEvents: conversationEvents.bind, installDragScroll,
    conversationPresence, hydrateAvatars: hydrateChatAvatars, messageImages, conversation,
    syncBalloonVisibility: chatBalloons.syncVisibility, text: TH,
});
const chatLifecycle = createChatLifecycle({
    config: cfg, getRoot: () => root, setRoot: value => { root = value; },
    getSelectedMember: () => selectedMember, setSelectedMember: value => { selectedMember = value; },
    getPlayerMemberNumber: () => Player?.MemberNumber, setActiveView: value => { activeView = value; },
    setStackedDetail: value => { stackedDetail = value; }, resetSelection: resetMessageSelectionState,
    clearReply: replyController.clear, closeContactCard: contactCard.close,
    cleanupMessageActions: () => { cleanupMessageActions?.(); cleanupMessageActions = null; },
    requestOnlineFriends, chatStore: ChatStore, setMessageIndex: value => { messages = value; }, loadConversation,
    refreshBadges: chatBalloons.refreshBadges, render: chatRenderer.render,
    syncBalloonVisibility: chatBalloons.syncVisibility, ensureBalloons: chatBalloons.ensure,
    resetBalloonInteraction, paintBalloon: chatBalloons.paint,
});
const chatRuntime = createChatRuntime({
    config: cfg, chatStore: ChatStore, setMessageIndex: value => { messages = value; }, getMessageIndex: () => messages,
    cleanMessage, profileDb: PDB, initAudio: initChatAudio, injectStyles: injectChatStyles,
    balloons: chatBalloons, getRoot: () => root, render: chatRenderer.render,
    refreshSettings: () => refreshChatSettings(), text: T, contactCard, presence,
    refreshList: chatList.refreshVisible, refreshConversationPresence: conversationPresence.refresh,
    offlineDelivery, closeChat: chatLifecycle.close,
});

function chatColors() {
    if (cfg.chatThemeMode === 'custom') return [cfg.chatPanelColor, cfg.chatFontColor, cfg.chatAccentColor];
    return cfg.chatThemeMode === 'preset' ? themeColors(cfg.chatThemePreset) : [cfg.panelColor, cfg.fontColor, cfg.accentColor];
}

async function initChat() {
    return chatRuntime.init();
}

function recordMessage(data, options) {
    return messageRecorder.record(data, options);
}

function unreadBadge(memberNumber = null) {
    const count = listPresenter.unreadCount(memberNumber);
    return `<b class="fcm-chat-unread ${count ? '' : 'hidden'}">${Math.min(count, 99)}</b>`;
}

async function openChat(memberNumber = null) {
    return chatLifecycle.open(memberNumber);
}

function toggleChat(memberNumber = null) {
    chatLifecycle.toggle(memberNumber);
}

function minimizeChat() {
    chatLifecycle.minimize();
}

function closeChat() {
    chatLifecycle.close();
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
    chatRenderer.render();
}

function refreshConversationMain({ scrollToLatest = true } = {}) {
    chatRenderer.refreshConversation({ scrollToLatest });
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
    return chatRuntime.updateOnlineFriends(result);
}

function setStatus(status, rerender = true) {
    chatRuntime.setStatus(status, rerender);
}

function refreshChatSettings() {
    chatRuntime.applySettings();
}

export { initChat, openChat, closeChat, refreshChatSettings, handleIncomingBeep, handleIncomingChatMessageId, handleIncomingChatTag, handleIncomingFriendRequestNotice, handleIncomingWhisper, handleIncomingWhisperDisplay, handleOutgoingServerSend, handleOnlineFriendsUpdate };

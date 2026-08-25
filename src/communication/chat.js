import { cfg, saveCfg, FCM_ICON_SVG } from '../core/config.js';
import { getDisplayName, getRoomInfo, inRoomFn, onlineFriends, buildFriendList, getAllRels, isFav, isFriendOf } from '../data/data.js';
import { getCachedRoomInfo, queryRoomInfo } from '../panel/panel-rooms-data.js';
import { Snapshot, syncRoomAvatar, updateOwnAvatarSnapshot, updateOwnAvatarProfile } from '../data/profile-db.js';
import { ChatStore, AudioStore, OfflineQueue } from './chat-store.js';
import { T, FCM_LANGS, FCM_LANG_NAMES, FCM_LANG_FLAGS, ensureLang } from '../i18n/i18n.js';
import { chatFontFamily, availableFontChoices } from './chat-font.js';
import { isSupportedAvatarUrl, profileHtml as renderProfileHtml } from './chat-profile.js';
import { chatPanelSession } from './chat-panel-session.js';
import { installDragScroll } from '../ui/drag-scroll.js';
import { applyTheme } from '../panel/styles.js';
import { THEME_KEYS, themeColors } from '../core/themes.js';
import { showRoomJoinConfirm, showIncomingRoomInvite } from '../chat/actions.js';
import CHAT_ICON from '../../assets/icons/chat.svg?raw';
import NOTIFICATION_ICON from '../../assets/icons/notification.svg?raw';
import GROUP_ICON from '../../assets/icons/group.svg?raw';
import ALARM_MUTED_ICON from '../../assets/icons/alarm-muted.svg?raw';
import ALARM_ACTIVE_ICON from '../../assets/icons/alarm-active.svg?raw';
import EXIT_ICON from '../../assets/icons/exit.svg?raw';
import DOWNLOAD_ICON from '../../assets/icons/download.svg?raw';
import TRASH_ICON from '../../assets/icons/trash.svg?raw';
import INVITE_ICON from '../../invite.svg?raw';
import WATER_ICON from '../../icons8-water-100.svg?raw';
import SPLIT_ICON from '../../assets/icons/split.svg?raw';
import EDIT_ICON from '../../assets/icons/edit.svg?raw';
const MERGE_ICON = SPLIT_ICON;
const SETTINGS_ICON = '<svg class="fcm-outline-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.96 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.03H3v-4h.08A1.7 1.7 0 0 0 4.6 8.96a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 8.96 4.6 1.7 1.7 0 0 0 10 3.08V3h4v.08a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06a1.7 1.7 0 0 0-.34 1.88A1.7 1.7 0 0 0 20.92 10H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z"/></svg>';
const SUMMON_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 10v4h3l7 4V6l-7 4H4Z"/><path d="M7 14l1.5 5h3L10 16M17 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"/></svg>';

let root = null;
let selectedMember = null;
let messages = [];
let search = '';
let presenceFilter = 'online';
let relationFilter = '';
let activeView = 'chat';
let notificationTab = 'recent';
let selectedGroup = 'room';
let groupMode = 'room';
let groupSearch = '';
let channel = 'beep';
let maximized = false;
let stackedDetail = false;
let suppressOutgoing = 0;
let customAudioUrl = '';
let justOpenedMember = null;
const autoReplyTimes = new Map();
const offlineQueueInFlight = new Set();
const remoteProfiles = new Map();
let initialized = false;
const esc = value => {
    const el = document.createElement('div');
    el.textContent = String(value ?? '');
    return el.innerHTML;
};
const waterShapeHtml = () => `<span class="fcm-water-shape" aria-hidden="true">${WATER_ICON}</span>`;

function cleanMessage(value) {
    let text = String(value ?? '');
    // 相容舊版曾使用的 U+F124 隱藏尾碼，避免既有歷史資料重新洩漏。
    const hiddenIndex = text.indexOf('\uf124');
    if (hiddenIndex >= 0) text = text.slice(0, hiddenIndex);
    const legacyIndex = text.indexOf('{"messageType"');
    if (legacyIndex > 0) text = text.slice(0, legacyIndex);
    return text.replace(/[\r\n]+$/g, '').trim();
}

function parseRoomInvite(value) {
    const lines = String(value ?? '').replace(/\r\n?/g, '\n').split('\n');
    // 最小協議只需要 |房名|；由 FCM 按鈕發送時，後方再附房主與人數等完整資料。
    const match = lines[0]?.trim().match(/^\|([^|]+)\|(.*)$/u);
    if (!match?.[1]?.trim()) return null;
    const full = (match[2] || '').match(/^\s*-\s*(.*?)\s*＜(\d+)\/(\d+)＞\s*$/u);
    return {
        roomName: match[1].trim(),
        creator: full?.[1]?.trim() || '',
        count: full?.[2] == null ? null : Number(full[2]),
        limit: full?.[3] == null ? null : Number(full[3]),
        desc: lines.slice(1).join('\n').trim(),
    };
}

function isOnline(memberNumber) {
    const mn = Number(memberNumber);
    return !!ChatRoomCharacter?.some(c => Number(c.MemberNumber) === mn)
        || onlineFriends.some(f => Number(f.MemberNumber) === mn);
}

function capability(memberNumber) {
    if (inRoomFn(Number(memberNumber))) return 'whisper';
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
    // 舊版本曾把完整隱藏尾碼寫入 IndexedDB；讀取時一併淨化，避免舊資料再次洩漏。
    messages = messages.map(message => ({ ...message, content: cleanMessage(message.content) }));
    const customSound = await AudioStore.get();
    if (customSound?.blob) customAudioUrl = URL.createObjectURL(customSound.blob);
    injectStyles();
    ensureBalloon();
    // FCM 與 CHAT 是同一套設定的兩個畫面：任一邊改主題/語言都要讓另一邊即時反映，
    // 不必（也不應該）整個重建 — 分別掛勾兩個共用事件，各自只重繪自己負責的畫面。
    window.addEventListener('fcm-theme-change', refreshChatSettings);
    window.addEventListener('fcm-language-change', () => { if (root?.isConnected && root.style.display !== 'none') renderChat(); ensureBalloon(); });
}

function normalizeMessage(data) {
    return {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
        memberNumber: Number(data.memberNumber),
        direction: data.direction,
        channel: data.channel,
        content: cleanMessage(data.content),
        roomName: data.roomName || '',
        name: data.name || getDisplayName(data.memberNumber),
        timestamp: Number(data.timestamp) || Date.now(),
        read: data.direction === 'out' || Number(data.memberNumber) === selectedMember,
        queued: !!data.queued,
        queueId: data.queueId || '',
    };
}

async function recordMessage(data, { notify = true } = {}) {
    if (!cfg.communicationEnabled || !data?.memberNumber) return;
    const message = normalizeMessage(data);
    if (!message.content) return;
    await ChatStore.put(message);
    messages = await ChatStore.prune();
    if (root?.isConnected && root.style.display !== 'none') {
        if (activeView === 'chat' && Number(message.memberNumber) === Number(selectedMember)) appendConversationMessage(message);
        else renderChat();
    }
    if (notify && message.direction === 'in') {
        showIncomingBalloon(message);
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
    try {
        if (message.channel === 'whisper' && inRoomFn(message.memberNumber)) ServerSend('ChatRoomChat', { Type: 'Whisper', Target: message.memberNumber, Content: content });
        else if (isOnline(message.memberNumber)) ServerSend('AccountBeep', { MemberNumber: message.memberNumber, BeepType: '', Message: content });
    } finally { suppressOutgoing--; }
    recordMessage({ memberNumber: message.memberNumber, direction: 'out', channel: message.channel, content }, { notify: false });
}

function handleIncomingBeep(data) {
    if (!data || !data.Message) return;
    if (data.BeepType === 'LCPlayerInfo' || data.BeepType === 'FCMPlayerInfo') {
        try {
            const info = JSON.parse(data.Message);
            remoteProfiles.set(Number(data.MemberNumber), { avatarUrl: info.avatarUrl || info.Avatar || '', signature: info.signature || info.Signature || '', status: info.status || 'online', updatedAt: Number(info.updatedAt || info.UpdateTime) || Date.now() });
        } catch {}
        return;
    }
    const invite = parseRoomInvite(data.Message);
    if (invite) {
        const roomName = invite.roomName || data.ChatRoomName;
        const content = roomName;
        recordMessage({ memberNumber: data.MemberNumber, name: data.MemberName, direction: 'in', channel: 'beep', content, roomName });
        showIncomingRoomInvite(data.MemberNumber, data.MemberName, { room: roomName, creator: invite.creator || '', count: invite.count ?? null, limit: invite.limit ?? null, desc: invite.desc || '', priv: !!invite.priv, type: invite.type || '' });
        return;
    }
    // Ordinary private messages can arrive as BeepType "Message".
    if (data.BeepType && !['Message', 'Beep'].includes(data.BeepType)) return;
    recordMessage({ memberNumber: data.MemberNumber, name: data.MemberName, direction: 'in', channel: 'beep', content: data.Message });
}

function handleIncomingWhisper(data) {
    if (!data || data.Type !== 'Whisper' || !data.Content || Number(data.Sender) === Number(Player?.MemberNumber)) return;
    recordMessage({ memberNumber: data.Sender, direction: 'in', channel: 'whisper', content: data.Content, timestamp: data.Time });
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
        channel = inRoomFn(selectedMember) ? 'whisper' : 'beep';
        stackedDetail = true;
    }
    if (!root?.isConnected) {
        root = document.createElement('div');
        root.id = 'fcm-chat-root';
        document.body.appendChild(root);
    }
    root.style.display = 'block';
    if (selectedMember) await ChatStore.markRead(selectedMember);
    messages = await ChatStore.prune();
    refreshBalloonBadges();
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
    ensureBalloon(true);
}

function closeChat() {
    selectedMember = null;
    stackedDetail = false;
    if (root) root.style.display = 'none';
    document.querySelectorAll('.fcm-chat-user-balloon').forEach(balloon => balloon.remove());
    if (cfg.persistentBalloon) ensureBalloon();
    else document.getElementById('fcm-chat-balloon')?.remove();
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
        const subtitle = history ? cleanMessage(row.content) : biography(memberNumber);
        return `<button class="fcm-chat-row ${selectedMember === memberNumber ? 'selected' : ''} ${justOpenedMember === memberNumber ? 'just-opened' : ''}" data-member="${memberNumber}">
            ${avatarHtml(memberNumber)}
            <span class="fcm-chat-row-meta"><b>${esc(getDisplayName(memberNumber))}</b><small>${esc(subtitle)}</small></span>
            ${history || row.timestamp ? `<time>${row.timestamp ? new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</time>` : ''}
            ${row.unread ? `<em>${row.unread}</em>` : ''}
        </button>`;
    }).join('');
}

function notificationsHtml() {
    const rows = notificationTab === 'recent' ? recentConversations() : historyMessages();
    return `<div class="fcm-chat-subtabs">
        <button class="${notificationTab === 'recent' ? 'active' : ''}" data-notification-tab="recent">${T('chatRecent')}</button>
        <button class="${notificationTab === 'history' ? 'active' : ''}" data-notification-tab="history">${T('chatHistory')}</button>
    </div>
    <div class="fcm-chat-scroll">${contactRows(rows, { history: true }) || `<div class="fcm-chat-empty">${T('chatNoRecord')}</div>`}</div>`;
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
    const rows = group.members.filter(memberNumber => !groupSearch || `${getDisplayName(memberNumber)} ${biography(memberNumber)}`.toLowerCase().includes(groupSearch.toLowerCase())).map(memberNumber => ({ memberNumber, timestamp: 0, unread: 0 }));
    return `<div class="fcm-chat-list-title">${T('chatGroups')}</div>
        <div class="fcm-chat-group-create"><input data-group-search value="${esc(groupSearch)}" placeholder="${T('chatSearchPlayers')}"></div>
        <div class="fcm-chat-presence fcm-chat-group-mode"><button class="${groupMode === 'room' ? 'active' : ''}" data-group-mode="room">${T('chatRoom')}</button><button class="${groupMode === 'groups' ? 'active' : ''}" data-group-mode="groups">${T('chatGroupsTab')}</button></div>
        ${groupMode === 'groups' ? `<div class="fcm-chat-group-tabs"><button class="fcm-chat-group-add" data-add-group>＋</button>${definitions.groups.map(item => `<button class="${item.id === group.id ? 'active' : ''}" data-group="${item.id}">${esc(item.label)}</button>`).join('')}</div>` : ''}
        <div class="fcm-chat-scroll">${contactRows(rows) || `<div class="fcm-chat-empty">${T('chatGroupEmpty')}</div>`}</div>`;
}

function settingsHtml() {
    const languageOpts = FCM_LANGS.map(value => `<option value="${value}" ${String(cfg.lang || 'auto').toLowerCase() === value.toLowerCase() ? 'selected' : ''}>${FCM_LANG_FLAGS[value] || ''} ${FCM_LANG_NAMES[value] || value}</option>`).join('');
    const sounds = [['', T('off')], ['Audio/BeepAlarm.mp3','BeepAlarm'], ['Audio/BellMedium.mp3','BellMedium'], ['Audio/Belt1.mp3','Belt1'], ['Audio/VibrationTone4ShortLoop.mp3','VibrationTone4ShortLoop'], ['custom', T('chatSoundCustom')]];
    const soundEnabled = !!cfg.notificationAudio && !!cfg.notificationSound && (cfg.notificationSound !== 'custom' || !!customAudioUrl);
    const themeKeys = THEME_KEYS;
    const placementOptions = current => [['off', T('balloonOff')], ['top-left', `⬉ ${T('balloonTopLeft')}`], ['middle-left', `⭠ ${T('balloonMiddleLeft')}`], ['bottom-left', `⬋ ${T('balloonBottomLeft')}`], ['top-right', `⬈ ${T('balloonTopRight')}`], ['middle-right', `⭢ ${T('balloonMiddleRight')}`], ['bottom-right', `⬊ ${T('balloonBottomRight')}`]]
        .map(([value, label]) => `<option value="${value}" ${current === value ? 'selected' : ''}>${label}</option>`).join('');
    const currentThemeName = cfg.chatThemeMode === 'follow' ? T('chatThemeFollow') : cfg.chatThemeMode === 'custom' ? T('themeCustom') : T(`themePreset_${cfg.chatThemePreset || 'violet'}`);
    const fontFamilies = availableFontChoices();
    return `<div class="fcm-chat-list-title">${T('chatSettingsTitle')}</div>
        <div class="fcm-chat-settings fcm-set-like">
            <div class="fcm-chat-setting-row"><span><b>${T('langLabel')}</b></span><select class="fcm-chat-language" data-chat-language>${languageOpts}</select></div>
            <div class="fcm-chat-setting-row"><span><b>${T('themeSettingsLabel')}</b><small>${T('chatThemeNote')}</small></span><button class="fcm-chat-theme-manage" data-chat-theme-manage>${T('themeSettingsLabel')} · ${currentThemeName}</button></div>
            <div class="fcm-chat-theme-options" data-chat-theme-options hidden><div class="fcm-chat-theme-presets"><button class="${cfg.chatThemeMode === 'follow' ? 'active' : ''}" data-chat-theme-follow>${T('chatThemeFollow')}</button>${themeKeys.map(value => `<button class="${cfg.chatThemeMode === 'preset' && cfg.chatThemePreset === value ? 'active' : ''}" data-chat-theme-preset="${value}">${T(`themePreset_${value}`)}</button>`).join('')}</div><div class="fcm-chat-theme-colors"><label>${T('themePanelColor')}<input type="color" data-chat-theme-color="chatPanelColor" value="${esc(cfg.chatPanelColor)}"></label><label>${T('themeFontColor')}<input type="color" data-chat-theme-color="chatFontColor" value="${esc(cfg.chatFontColor)}"></label><label>${T('themeAccentColor')}<input type="color" data-chat-theme-color="chatAccentColor" value="${esc(cfg.chatAccentColor)}"></label></div></div>
            <div class="fcm-chat-setting-row"><span><b>${T('chatFontFamily')}</b><small>${T('chatFontFamilyNote')}</small></span><div class="fcm-chat-font-controls"><input data-chat-font-size type="number" min="10" max="24" step="1" value="${Number(cfg.chatFontSize) || 13}" title="${T('chatFontSize')}"><select data-chat-font-family>${fontFamilies.map(([value,label]) => `<option value="${value}" ${cfg.chatFontFamily === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div></div>
            <div class="fcm-chat-setting-row"><span><b>${T('chatTakeover')}</b><small>${T('chatTakeoverNote')}</small></span><button class="fcm-chat-switch ${cfg.takeoverFcmChatButtons ? 'on' : ''}" data-setting="takeover"><i></i></button></div>
            <div class="fcm-chat-setting-row"><span><b>${T('chatPersistentBalloon')}</b><small>${T('chatPersistentBalloonNote')}</small></span><select data-balloon-placement>${placementOptions(cfg.balloonPlacement)}</select></div>
            <div class="fcm-chat-setting-row"><span><b>${T('chatIndividualBalloons')}</b><small>${T('chatIndividualBalloonsNote')}</small></span><select data-user-balloon-placement>${placementOptions(cfg.userBalloonPlacement)}</select></div>
            <div class="fcm-chat-setting-row"><span><b>${T('balloonSnap')}</b><small>${T('balloonSnapNote')}</small></span><button class="fcm-chat-switch ${cfg.balloonSnap ? 'on' : ''}" data-setting="balloonSnap"><i></i></button></div>
            <div class="fcm-chat-setting-row"><span><b>${T('chatNotifyAnim')}</b><small>${T('chatNotifyAnimNote')}</small></span><button class="fcm-chat-switch ${cfg.notificationAnimation ? 'on' : ''}" data-setting="animation"><i></i></button></div>
            <div class="fcm-chat-setting-row"><span><b>${T('chatSoundLabel')}</b><small>${T('chatSoundNote')}</small></span><div class="fcm-chat-sound-control"><button data-preview-sound ${soundEnabled ? '' : 'disabled'}>${soundEnabled ? ALARM_ACTIVE_ICON : ALARM_MUTED_ICON}</button><select data-chat-sound>${sounds.map(([value,label]) => `<option value="${value}" ${(!cfg.notificationAudio && !value) || (cfg.notificationAudio && cfg.notificationSound === value) ? 'selected' : ''}>${label}</option>`).join('')}</select><input data-custom-sound type="file" accept="audio/*" hidden></div></div>
            <div class="fcm-chat-setting-row"><span><b>${T('chatAvatarShapeLabel')}</b><small>${T('chatAvatarShapeNote')}</small></span><select data-chat-avatar-shape><option value="round" ${cfg.chatAvatarShape === 'round' ? 'selected' : ''}>${T('chatAvatarShapeRound')}</option><option value="square" ${cfg.chatAvatarShape !== 'round' ? 'selected' : ''}>${T('chatAvatarShapeSquare')}</option></select></div>
            <div class="fcm-chat-setting-row"><span><b>${T('chatAvatarSourceLabel')}</b><small>${T('chatAvatarSourceNote')}</small></span><select data-chat-avatar-mode><option value="follow" ${cfg.chatAvatarMode === 'follow' ? 'selected' : ''}>${T('chatAvatarFollow')}</option><option value="url" ${cfg.chatAvatarMode === 'url' ? 'selected' : ''}>${T('chatAvatarUrl')}</option><option value="game" ${cfg.chatAvatarMode === 'game' ? 'selected' : ''}>${T('chatAvatarGame')}</option></select></div>
            <div class="fcm-chat-setting-row"><span><b>${T('chatAvatarUrlLabel')}</b><small>${T('chatAvatarUrlNote')}</small></span><input data-chat-avatar-url value="${esc(cfg.chatAvatarUrl || '')}" placeholder="https://…"></div>
        </div>`;
}

function profileHtml() {
    return renderProfileHtml({ Player, cfg, T, esc, avatarHtml, editIcon: EDIT_ICON });
}

function chatListHtml() {
    return `<div class="fcm-chat-search"><input data-search value="${esc(search)}" placeholder="${T('chatSearchPlayers')}"></div>
        <div class="fcm-chat-presence"><button class="${presenceFilter === 'online' ? 'active' : ''}" data-presence="online">${T('chatPresenceOnline')}</button><button class="${presenceFilter === 'offline' ? 'active' : ''}" data-presence="offline">${T('chatPresenceOffline')}</button></div>
        <div class="fcm-chat-tags"><button class="${relationFilter === 'owner' ? 'active' : ''}" data-rel="owner">${T('chatRelOwnerLover')}</button><button class="${relationFilter === 'sub' ? 'active' : ''}" data-rel="sub">${T('chatRelSub')}</button><button class="${relationFilter === 'follow' ? 'active' : ''}" data-rel="follow">${T('chatRelFollow')}</button></div>
        <div class="fcm-chat-scroll">${contactRows(filteredContacts()) || `<div class="fcm-chat-empty">${T('chatEmptyCategory')}</div>`}</div>`;
}

function listHtml() {
    if (activeView === 'profile') return profileHtml();
    if (activeView === 'notifications') return notificationsHtml();
    if (activeView === 'groups') return groupsHtml();
    if (activeView === 'settings') return settingsHtml();
    return chatListHtml();
}

function conversationHtml() {
    if (!selectedMember) return `<div class="fcm-chat-empty">${T('chatSelectPlayer')}</div>`;
    const available = capability(selectedMember);
    const roomInfo = getRoomInfo(selectedMember);
    const cachedRoom = roomInfo?.name ? getCachedRoomInfo(roomInfo.name) : null;
    const memberCount = roomInfo?.isCurrent ? (ChatRoomCharacter?.length ?? null) : (roomInfo?.memberCount ?? cachedRoom?.MemberCount ?? null);
    const memberLimit = roomInfo?.isCurrent ? (ChatRoomData?.MemberLimit ?? null) : (roomInfo?.memberLimit ?? cachedRoom?.MemberLimit ?? null);
    const roomCount = memberCount !== null && memberCount !== undefined ? ` ＜${memberCount}${memberLimit !== null && memberLimit !== undefined ? `/${memberLimit}` : ''}＞` : '';
    const roomText = roomInfo?.name ? `${roomInfo.name}${roomCount}` : (isOnline(selectedMember) ? T('chatOnlineDiffRoom') : T('chatOffline'));
    const rows = messages.filter(message => message.memberNumber === selectedMember);
    const online = isOnline(selectedMember);
    const inputPlaceholder = !online ? T('chatOfflineQueuePlaceholder') : channel === 'whisper' && inRoomFn(selectedMember) ? T('chatWhisperInputPlaceholder') : T('chatPrivateInputPlaceholder');
    return `<header class="fcm-chat-conversation-header">
        ${cfg.chatLayout === 'stacked' ? `<button class="fcm-chat-back fcm-chat-icon-action" data-back title="${T('chatBack')}">${EXIT_ICON}</button>` : ''}
        ${avatarHtml(selectedMember, 38, 'conversation')}
        <span class="fcm-chat-conversation-meta"><b>${esc(getDisplayName(selectedMember))}${isFriendOf(selectedMember) ? '' : `<i class="fcm-chat-not-friend">${T('chatNotFriend')}</i>`}</b><small data-room-meta="${selectedMember}" ${roomInfo?.name ? `data-room-name="${esc(roomInfo.name)}" role="button" tabindex="0"` : ''}>${esc(roomText)}</small></span>
        <button class="fcm-chat-header-action fcm-chat-icon-action" data-summon ${!ChatRoomData || !online || inRoomFn(selectedMember) ? 'disabled' : ''} title="${T('beepSummon')}">${SUMMON_ICON}</button>
        <div class="fcm-chat-assign"><button class="fcm-chat-rail-button" data-toggle-assign title="${T('chatAssignGroup')}">${GROUP_ICON}</button><div class="fcm-chat-assign-menu" data-assign-menu>${Object.entries(cfg.chatGroups || {}).map(([id,label]) => `<button data-assign-group="${esc(id)}">${esc(label)}</button>`).join('')}<button class="create" data-create-group-from-chat>＋ ${T('chatNewGroup')}</button></div></div>
    </header>
    <div class="fcm-chat-messages">${rows.map(messageHtml).join('') || `<div class="fcm-chat-empty">${T('chatNoMessages')}</div>`}</div>
    <div class="fcm-chat-actions"><button class="fcm-chat-icon-action" data-invite ${available === 'none' || inRoomFn(selectedMember) ? 'disabled' : ''} title="${T('chatInviteRoom')}" aria-label="${T('chatInviteRoom')}">${INVITE_ICON}</button><span></span><div class="fcm-chat-tools"><div class="fcm-chat-tools-menu"><button class="fcm-chat-icon-action" data-export title="${T('chatSaveMessages')}">${DOWNLOAD_ICON}<span>${T('chatSaveMessages')}</span></button><button class="fcm-chat-icon-action" data-delete title="${T('chatDeleteAll')}">${TRASH_ICON}<span>${T('chatDeleteAll')}</span></button></div><button class="fcm-chat-icon-action" data-toggle-tools title="${T('chatMessageTools')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h7l2 2h9v11H3z"/><path d="M12 11v6M9 14h6"/></svg></button></div></div>
    <div class="fcm-chat-compose">
        <div class="fcm-chat-channels ${online ? '' : 'offline'}"><button class="${online && channel === 'whisper' ? 'active' : ''}" data-channel="whisper" ${!inRoomFn(selectedMember) ? 'disabled' : ''}>Whisper</button><button class="${online && channel === 'beep' ? 'active' : ''}" data-channel="beep" ${!online ? 'disabled' : ''}>BEEP</button></div>
        <textarea data-input rows="2" placeholder="${inputPlaceholder}"></textarea>
        <button data-send>${online ? T('chatSend') : T('chatQueueSend')}</button>
    </div>`;
}

function messageHtml(message) {
    return `<div class="fcm-chat-message ${message.direction} ${message.queued ? 'queued' : ''}" data-msg-id="${esc(message.id)}"><span class="fcm-chat-content">${esc(cleanMessage(message.content))}</span>${message.roomName ? `<button class="fcm-chat-room-join" data-join-room="${esc(message.roomName)}">${T('roomJoinRoomBtn')}</button>` : ''}<time>${message.channel === 'whisper' ? T('chatChannelWhisper') : T('chatChannelPrivate')} · ${new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}${message.queued ? ` · ${T('chatQueued')}` : ''}</time></div>`;
}

function appendConversationMessage(message) {
    const log = root?.querySelector('.fcm-chat-main .fcm-chat-messages');
    if (!log || log.querySelector(`[data-msg-id="${CSS.escape(String(message.id))}"]`)) return;
    log.querySelector(':scope > .fcm-chat-empty')?.remove();
    log.insertAdjacentHTML('beforeend', messageHtml(message));
    const inserted = log.lastElementChild;
    inserted?.querySelector('[data-join-room]')?.addEventListener('click', event => {
        const room = event.currentTarget.dataset.joinRoom;
        if (room) showRoomJoinConfirm({ room });
    });
    requestAnimationFrame(() => { log.scrollTop = log.scrollHeight; });
}

function refreshConversationRoomMeta() {
    if (!selectedMember) return;
    const roomInfo = getRoomInfo(selectedMember);
    if (!roomInfo?.name || roomInfo.isCurrent) return;
    const friend = onlineFriends.find(item => Number(item.MemberNumber) === selectedMember);
    queryRoomInfo(roomInfo.name, friend?.ChatRoomSpace, data => {
        const meta = root?.querySelector(`[data-room-meta="${selectedMember}"]`);
        if (!meta || selectedMember !== Number(meta.dataset.roomMeta)) return;
        const count = data?.MemberCount;
        const limit = data?.MemberLimit;
        meta.textContent = `${roomInfo.name}${count !== null && count !== undefined ? ` ＜${count}${limit !== null && limit !== undefined ? `/${limit}` : ''}＞` : ''}`;
    });
}

function renderChat() {
    if (!root) return;
    const [chatPanel, chatText, chatAccent] = chatColors();
    const sessionSizeStyle = chatPanelSession.inlineSizeStyle();
    root.innerHTML = `<div id="fcm-chat-panel" class="${maximized ? 'maximized' : ''}" data-layout-mode="${esc(cfg.chatLayout || 'split')}" data-theme="${esc(cfg.chatThemeMode === 'preset' ? cfg.chatThemePreset : cfg.chatThemeMode === 'custom' ? 'custom' : cfg.themePreset || 'violet')}" style="${sessionSizeStyle}--s:${esc(chatPanel)};--tx:${esc(chatText)};--ac:${esc(chatAccent)};--chat-font-size:${Number(cfg.chatFontSize) || 13}px;--chat-font-family:${esc(chatFontFamily())}">
        <div class="fcm-chat-titlebar"><b>FCM-Chat</b><span></span><button class="fcm-chat-icon-action ${cfg.chatLayout === 'stacked' ? 'active' : ''}" data-layout title="${T('chatToggleLayout')}">${cfg.chatLayout === 'stacked' ? SPLIT_ICON : MERGE_ICON}<i>${cfg.chatLayout === 'stacked' ? T('chatLayoutSplit') : T('chatLayoutMerged')}</i></button><button class="fcm-chat-icon-action ${maximized ? 'active' : ''}" data-max title="${T('chatToggleMax')}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg><i>${maximized ? T('chatRestore') : T('chatMaximize')}</i></button><button class="fcm-chat-icon-action" data-min title="${T('chatMinimize')}">—</button><button class="fcm-chat-icon-action" data-close title="${T('chatClose')}">×</button></div>
        <div class="fcm-chat-body view-${esc(activeView)} ${cfg.chatLayout === 'stacked' ? 'stacked' : ''} ${activeView === 'profile' || activeView === 'settings' ? 'wide-view' : ''}">
            <nav class="fcm-chat-rail">
                <button class="fcm-chat-rail-button fcm-chat-self ${activeView === 'profile' ? 'active' : ''}" data-view="profile" title="${T('chatProfileTab')}">${avatarHtml(Player?.MemberNumber || 0, 34, 'toolbar')}</button>
                <button class="fcm-chat-rail-button ${activeView === 'notifications' ? 'active' : ''}" data-view="notifications" title="${T('chatNotificationsTab')}">${NOTIFICATION_ICON}</button>
                <button class="fcm-chat-rail-button ${activeView === 'chat' ? 'active' : ''} ${unreadCount() ? 'has-unread' : ''}" data-view="chat" title="${T('chatChatTab')}">${CHAT_ICON}${unreadBadge()}</button>
                <button class="fcm-chat-rail-button ${activeView === 'groups' ? 'active' : ''}" data-view="groups" title="${T('chatGroupsTab')}">${GROUP_ICON}</button>
                <span></span>
                <button class="fcm-chat-rail-button" data-status title="${T('chatStatusTab')}"><i class="fcm-status-dot ${esc(cfg.chatStatus || 'online')}"></i></button>
                <button class="fcm-chat-rail-button ${activeView === 'settings' ? 'active' : ''}" data-view="settings" title="${T('chatSettingsTab')}">${SETTINGS_ICON}</button>
            </nav>
            <aside class="fcm-chat-list ${stackedDetail ? 'slide-out' : ''}">${listHtml()}</aside>
            <main class="fcm-chat-main ${stackedDetail ? 'slide-in' : ''}">${conversationHtml()}</main>
        </div>
        <div class="fcm-chat-status-menu"><button data-status-value="online"><i class="online"></i>${T('chatStatusOnline')}</button><button data-status-value="busy"><i class="busy"></i>${T('chatStatusBusy')}</button><button data-status-value="afk"><i class="afk"></i>${T('chatStatusAFK')}</button></div>
    </div>`;
    positionPanel();
    bindEvents();
    installDragScroll(root, '.fcm-chat-scroll,.fcm-chat-messages,.fcm-chat-profile,.fcm-chat-body.view-settings .fcm-chat-list');
    refreshConversationRoomMeta();
    hydrateChatAvatars();
    const log = root.querySelector('.fcm-chat-messages');
    if (log) log.scrollTop = log.scrollHeight;
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

function bindEvents() {
    const panel = root.querySelector('#fcm-chat-panel');
    chatPanelSession.observe(panel, () => maximized);
    makeDraggable(panel, panel.querySelector('.fcm-chat-titlebar'), 'chatPanelPosition');
    root.querySelector('[data-close]')?.addEventListener('click', closeChat);
    root.querySelector('[data-min]')?.addEventListener('click', minimizeChat);
    root.querySelector('[data-max]')?.addEventListener('click', event => {
        event.stopPropagation();
        const before = panel.getBoundingClientRect();
        panel.classList.add('fcm-size-animating');
        maximized = !maximized; panel.classList.toggle('maximized', maximized);
        event.currentTarget.classList.toggle('active', maximized); const label=event.currentTarget.querySelector('i'); if(label) label.textContent=maximized?T('chatRestore'):T('chatMaximize');
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
        button.innerHTML = `${stacked ? SPLIT_ICON : MERGE_ICON}<i>${stacked ? T('chatLayoutSplit') : T('chatLayoutMerged')}</i>`;
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
    root.querySelector('[data-group-search]')?.addEventListener('input', event => { groupSearch = event.target.value; const caret=event.target.selectionStart??groupSearch.length; renderChat(); const input=root.querySelector('[data-group-search]'); input?.focus(); input?.setSelectionRange(caret,caret); });
    root.querySelector('[data-search]')?.addEventListener('input', event => {
        search = event.target.value; const caret = event.target.selectionStart ?? search.length; renderChat();
        const input = root.querySelector('[data-search]'); input?.focus(); input?.setSelectionRange(caret, caret);
    });
    root.querySelectorAll('[data-presence]').forEach(button => button.addEventListener('click', () => { presenceFilter = button.dataset.presence; renderChat(); }));
    root.querySelectorAll('[data-rel]').forEach(button => button.addEventListener('click', () => { relationFilter = relationFilter === button.dataset.rel ? '' : button.dataset.rel; renderChat(); }));
    root.querySelectorAll('[data-member]').forEach(button => button.addEventListener('click', async () => {
        selectedMember = Number(button.dataset.member);
        justOpenedMember = selectedMember;
        channel = inRoomFn(selectedMember) ? 'whisper' : 'beep';
        stackedDetail = true;
        await ChatStore.markRead(selectedMember);
        messages = await ChatStore.prune();
        refreshBalloonBadges();
        renderChat();
        setTimeout(() => { justOpenedMember = null; }, 350);
    }));
    root.querySelector('[data-back]')?.addEventListener('click', () => { stackedDetail = false; renderChat(); });
    root.querySelectorAll('[data-channel]').forEach(button => button.addEventListener('click', () => { if (!button.disabled) { channel = button.dataset.channel; renderChat(); } }));
    root.querySelector('[data-send]')?.addEventListener('click', sendCurrentMessage);
    root.querySelector('[data-input]')?.addEventListener('keydown', event => { event.stopPropagation(); if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendCurrentMessage(); } });
    root.querySelector('[data-delete]')?.addEventListener('click', deleteConversation);
    root.querySelector('[data-export]')?.addEventListener('click', exportConversation);
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
    root.querySelector('[data-room-meta][data-room-name]')?.addEventListener('click', event => openHeaderRoom(event.currentTarget));
    root.querySelector('[data-room-meta][data-room-name]')?.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openHeaderRoom(event.currentTarget); } });
    root.querySelector('.fcm-chat-conversation-header > [data-avatar-member]')?.addEventListener('click', async event => {
        const memberNumber = Number(event.currentTarget.dataset.avatarMember);
        const live = character(memberNumber);
        await Snapshot.delete(memberNumber);
        if (live) await syncRoomAvatar(live);
        renderChat();
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
        if (value === 'custom' && !customAudioUrl) { event.target.value = cfg.notificationAudio ? (cfg.notificationSound || '') : ''; root.querySelector('[data-custom-sound]')?.click(); return; }
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

function makeDraggable(element, handle, configKey, memberNumber = null) {
    if (!element || !handle) return;
    handle.addEventListener('pointerdown', event => {
        if ((event.target.closest('button') && handle !== element) || maximized) return;
        const rect = element.getBoundingClientRect();
        const offsetX = event.clientX - rect.left;
        const offsetY = event.clientY - rect.top;
        let moved = false;
        const isBalloon = element.matches('#fcm-chat-balloon,.fcm-chat-user-balloon');
        const startX = event.clientX;
        const startY = event.clientY;
        let lastX = event.clientX;
        let lastY = event.clientY;
        if (isBalloon) element.classList.remove('released');
        handle.setPointerCapture(event.pointerId);
        const move = next => {
            if (isBalloon && !moved) {
                if (Math.hypot(next.clientX - startX, next.clientY - startY) < 6) return;
                moved = true;
                element.classList.add('dragging');
            } else if (!isBalloon) moved = true;
            const dx = next.clientX - lastX;
            const dy = next.clientY - lastY;
            lastX = next.clientX;
            lastY = next.clientY;
            const nextLeft = isBalloon ? next.clientX - element.offsetWidth / 2 : next.clientX - offsetX;
            const nextTop = isBalloon ? next.clientY + 20 : next.clientY - offsetY;
            element.style.left = `${Math.max(0, Math.min(innerWidth - element.offsetWidth, nextLeft))}px`;
            element.style.top = `${Math.max(0, Math.min(innerHeight - element.offsetHeight, nextTop))}px`;
            element.style.right = element.style.bottom = 'auto';
            if (isBalloon) {
                const speed = Math.min(0.22, Math.hypot(dx, dy) / 90);
                element.style.setProperty('--drag-angle', `${Math.max(-7, Math.min(7, dx * .3))}deg`);
                element.style.setProperty('--drag-stretch', `${1 + speed}`);
                element.style.setProperty('--drag-squash', `${1 - speed * .55}`);
                stirNearbyBalloons(element, dx, dy);
            } else element.style.transform = 'none';
            updateBalloonPreviewSide(element);
        };
        const up = next => {
            handle.releasePointerCapture(next.pointerId);
            handle.removeEventListener('pointermove', move);
            handle.removeEventListener('pointerup', up);
            if (isBalloon && moved) {
                element.style.setProperty('--release-angle', element.style.getPropertyValue('--drag-angle') || '0deg');
                element.classList.remove('dragging');
                element.classList.add('released');
                element.style.removeProperty('--drag-angle');
                element.style.removeProperty('--drag-stretch');
                element.style.removeProperty('--drag-squash');
                settleStirredBalloons();
                setTimeout(() => {
                    element.classList.remove('released');
                    element.style.removeProperty('--release-angle');
                }, 150); //水滴動畫總時長，時間太短沒有抖動效果，太長復原又不流暢，先設定短時間
            }
            if (!moved) return;
            element.dataset.dragMoved = '1';
            setTimeout(() => { delete element.dataset.dragMoved; }, 0);
            if (cfg.balloonSnap) snapBalloonToNearestEdge(element);
            resolveBalloonCollision(element);
            const position = { x: element.offsetLeft, y: element.offsetTop };
            if (memberNumber) { cfg[configKey] ||= {}; cfg[configKey][memberNumber] = position; }
            else cfg[configKey] = position;
            saveCfg();
        };
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', up);
    });
}

function stirNearbyBalloons(dragged, dx, dy) {
    const source = dragged.getBoundingClientRect();
    const sx = source.left + source.width / 2;
    const sy = source.top + source.height / 2;
    document.querySelectorAll('#fcm-chat-balloon,.fcm-chat-user-balloon').forEach(other => {
        if (other === dragged || getComputedStyle(other).display === 'none') return;
        const rect = other.getBoundingClientRect();
        const ox = rect.left + rect.width / 2;
        const oy = rect.top + rect.height / 2;
        const distance = Math.hypot(ox - sx, oy - sy);
        if (distance > 150) return;
        const force = (1 - distance / 150) * 13;
        const length = Math.hypot(dx, dy) || 1;
        other.style.setProperty('--stir-x', `${dx / length * force}px`);
        other.style.setProperty('--stir-y', `${dy / length * force}px`);
        other.style.setProperty('--stir-angle', `${Math.max(-9, Math.min(9, dx * .35))}deg`);
        other.classList.add('stirred');
    });
}

function settleStirredBalloons() {
    document.querySelectorAll('.stirred').forEach(balloon => {
        balloon.classList.remove('stirred');
        balloon.style.removeProperty('--stir-x');
        balloon.style.removeProperty('--stir-y');
        balloon.style.removeProperty('--stir-angle');
    });
}

function snapBalloonToNearestEdge(element) {
    if (!element?.matches?.('#fcm-chat-balloon,.fcm-chat-user-balloon')) return;
    const rect = element.getBoundingClientRect();
    const distances = { left: rect.left, right: innerWidth - rect.right, top: rect.top, bottom: innerHeight - rect.bottom };
    const edge = Object.entries(distances).sort((a, b) => a[1] - b[1])[0][0];
    const margin = 8;
    element.dataset.snapEdge = edge;
    element.style.right = element.style.bottom = 'auto';
    if (edge === 'left') element.style.left = `${margin}px`;
    else if (edge === 'right') element.style.left = `${Math.max(margin, innerWidth - element.offsetWidth - margin)}px`;
    else if (edge === 'top') element.style.top = `${margin}px`;
    else element.style.top = `${Math.max(margin, innerHeight - element.offsetHeight - margin)}px`;
    updateBalloonPreviewSide(element);
}

function resolveBalloonCollision(element) {
    if (!element.matches('#fcm-chat-balloon,.fcm-chat-user-balloon')) return;
    const others = [...document.querySelectorAll('#fcm-chat-balloon,.fcm-chat-user-balloon')].filter(other => other !== element && getComputedStyle(other).display !== 'none');
    let rect = element.getBoundingClientRect();
    for (let pass = 0; pass < 12 && others.some(other => { const r = other.getBoundingClientRect(); return rect.left < r.right + 6 && rect.right + 6 > r.left && rect.top < r.bottom + 6 && rect.bottom + 6 > r.top; }); pass++) {
        const horizontal = ['top', 'bottom'].includes(element.dataset.snapEdge);
        if (horizontal) {
            const nextLeft = rect.right + 8;
            element.style.left = `${nextLeft + rect.width <= innerWidth ? nextLeft : Math.max(0, rect.left - rect.width - 8)}px`;
            element.style.right = 'auto';
        } else {
            const nextTop = rect.bottom + 8;
            element.style.top = `${nextTop + rect.height <= innerHeight ? nextTop : Math.max(0, rect.top - rect.height - 8)}px`;
            element.style.bottom = 'auto';
        }
        rect = element.getBoundingClientRect();
    }
    updateBalloonPreviewSide(element);
}

function updateBalloonPreviewSide(element) {
    if (!element?.matches?.('#fcm-chat-balloon,.fcm-chat-user-balloon')) return;
    const rect = element.getBoundingClientRect();
    element.classList.toggle('preview-right', rect.left < innerWidth * 0.25);
}

function sendCurrentMessage() {
    const input = root?.querySelector('[data-input]');
    const content = input?.value.trim();
    if (!content || !selectedMember) return;
    if (!isOnline(selectedMember)) {
        const queued = OfflineQueue.add(selectedMember, content);
        recordMessage({ memberNumber: selectedMember, direction: 'out', channel: 'beep', content, queued: true, queueId: queued.id }, { notify: false });
        input.value = '';
        return;
    }
    const selectedChannel = channel === 'whisper' && inRoomFn(selectedMember) ? 'whisper' : 'beep';
    suppressOutgoing++;
    try {
        if (selectedChannel === 'whisper') ServerSend('ChatRoomChat', { Type: 'Whisper', Target: selectedMember, Content: content });
        else ServerSend('AccountBeep', { MemberNumber: selectedMember, BeepType: '', Message: content });
    } finally { suppressOutgoing--; }
    recordMessage({ memberNumber: selectedMember, direction: 'out', channel: selectedChannel, content }, { notify: false });
    input.value = '';
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
    } catch {}
    renderChat();
}

function showFcmConfirm(message, confirmLabel = T('chatConfirmDelete')) {
    return new Promise(resolve => {
        const overlay = document.createElement('div'); overlay.className = 'fcm-chat-modal-overlay';
        overlay.style.cssText = `--s:${cfg.panelColor};--tx:${cfg.fontColor};--ac:${cfg.accentColor}`;
        overlay.innerHTML = `<div class="fcm-chat-modal"><div>${esc(message)}</div><div><button data-modal-cancel>${T('chatCancel')}</button><button data-modal-ok>${confirmLabel}</button></div></div>`;
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
    renderChat();
}

function exportConversation() {
    const text = messages.filter(message => message.memberNumber === selectedMember).map(message =>
        `[${new Date(message.timestamp).toLocaleString()}] ${message.direction === 'out' ? 'Me' : getDisplayName(selectedMember)} (${message.channel}): ${message.content}`
    ).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    link.download = `FCM-Chat-${selectedMember}-${Date.now()}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function inviteCurrent() {
    if (!selectedMember || !isOnline(selectedMember) || inRoomFn(selectedMember) || !ChatRoomData?.Name) return;
    const room = ChatRoomData;
    const count = ChatRoomCharacter?.length ?? room.MemberCount ?? null;
    const limit = room.MemberLimit ?? null;
    const description = String(room.Description || '').trim();
    const message = `|${room.Name}| - ${room.Creator || '?'} ＜${count ?? 0}/${limit ?? 0}＞${description ? `\n${description}` : ''}`;
    suppressOutgoing++;
    try { ServerSend('AccountBeep', { MemberNumber: selectedMember, BeepType: '', IsSecret: false, Message: message }); }
    finally { suppressOutgoing--; }
    recordMessage({ memberNumber: selectedMember, direction: 'out', channel: 'beep', content: room.Name, roomName: room.Name }, { notify: false });
}

async function summonCurrent() {
    if (!selectedMember || !isOnline(selectedMember) || inRoomFn(selectedMember) || !ChatRoomData?.Name) return;
    if (!await showFcmConfirm(T('beepSummonTitle'), T('beepSummon'))) return;
    suppressOutgoing++;
    try {
        ServerSend('AccountBeep', { MemberNumber: selectedMember, BeepType: '', Message: 'summon', ChatRoomName: ChatRoomData.Name, ChatRoomSpace: ChatRoomData.Space });
    } finally { suppressOutgoing--; }
    recordMessage({ memberNumber: selectedMember, direction: 'out', channel: 'beep', content: 'summon', roomName: ChatRoomData.Name }, { notify: false });
}

async function handleOnlineFriendsUpdate(result) {
    if (!cfg.communicationEnabled || !Array.isArray(result)) return;
    const online = new Set(result.map(row => Number(row.MemberNumber)).filter(Boolean));
    const ready = OfflineQueue.all().filter(row => online.has(Number(row.memberNumber)) && !offlineQueueInFlight.has(row.id));
    if (!ready.length) return;
    ready.forEach(row => offlineQueueInFlight.add(row.id));
    ready.forEach((row, index) => setTimeout(async () => {
        let delivered = false;
        suppressOutgoing++;
        try { ServerSend('AccountBeep', { MemberNumber: row.memberNumber, BeepType: '', Message: row.content }); delivered = true; }
        catch (error) { console.warn('🐈‍⬛ [FCM] offline message delivery failed:', error); }
        finally { suppressOutgoing--; }
        if (delivered) {
            OfflineQueue.remove([row.id]);
            const stored = (await ChatStore.all()).find(message => message.queueId === row.id);
            if (stored) await ChatStore.put({ ...stored, queued: false, deliveredAt: Date.now() });
            messages = await ChatStore.prune();
            if (root?.isConnected && root.style.display !== 'none') renderChat();
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
    } catch {}
    const dot = root?.querySelector('.fcm-chat-rail [data-status] .fcm-status-dot');
    if (dot) dot.className = `fcm-status-dot ${status}`;
    if (rerender) renderChat();
}

function paintBalloon(element) {
    const [panel, text, accent] = chatColors();
    element.style.setProperty('--s', panel);
    element.style.setProperty('--tx', text);
    element.style.setProperty('--ac', accent);
}

function refreshBalloonBadges() {
    const railButton = root?.querySelector('.fcm-chat-rail [data-view="chat"]');
    const railBadge = railButton?.querySelector('.fcm-chat-unread');
    if (railBadge) {
        const count = unreadCount();
        railBadge.textContent = Math.min(count, 99);
        railBadge.classList.toggle('hidden', !count);
        railButton.classList.toggle('has-unread', !!count);
    }
    const main = document.querySelector('#fcm-chat-balloon .fcm-chat-unread');
    if (main) { const count = unreadCount(); main.textContent = Math.min(count, 99); main.classList.toggle('hidden', !count); }
    document.querySelectorAll('.fcm-chat-user-balloon').forEach(balloon => {
        const badge = balloon.querySelector('.fcm-chat-unread'); const count = unreadCount(balloon.id.replace('fcm-chat-user-', ''));
        if (badge) { badge.textContent = Math.min(count, 99); badge.classList.toggle('hidden', !count); }
    });
}

function placeBalloon(element, placement, index = 0) {
    const gap = 22 + index * 58;
    element.style.left = element.style.right = element.style.top = element.style.bottom = 'auto';
    if (placement.endsWith('left')) element.style.left = '22px'; else element.style.right = '22px';
    if (placement.startsWith('top')) element.style.top = `${gap}px`;
    else if (placement.startsWith('middle')) element.style.top = `calc(50% - 27px + ${index * 58}px)`;
    else element.style.bottom = `${gap}px`;
    element.style.transform = 'none';
    delete element.dataset.snapEdge;
}

function ensureBalloon(force = false) {
    let created = false;
    let balloon = document.getElementById('fcm-chat-balloon');
    if (!balloon) {
        created = true;
        balloon = document.createElement('button');
        balloon.id = 'fcm-chat-balloon';
        balloon.innerHTML = `${waterShapeHtml()}<span class="fcm-balloon-icon">${FCM_ICON_SVG}</span>${unreadBadge()}<span class="fcm-balloon-preview"><strong>FCM Chat</strong></span>`;
        balloon.title = 'FCM Chat';
        balloon.addEventListener('click', () => { if (!balloon.dataset.dragMoved) toggleChat(); });
        document.body.appendChild(balloon);
        makeDraggable(balloon, balloon, 'chatBalloonPosition');
    }
    paintBalloon(balloon);
    const saved = cfg.chatBalloonPosition;
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
        balloon.style.left = `${saved.x}px`; balloon.style.top = `${saved.y}px`; balloon.style.right = balloon.style.bottom = 'auto';
    } else placeBalloon(balloon, cfg.balloonPlacement === 'off' ? 'bottom-right' : cfg.balloonPlacement);
    balloon.classList.toggle('persistent', !!cfg.communicationEnabled && (cfg.balloonPlacement !== 'off' || force));
    if (created) resolveBalloonCollision(balloon);
}

function showIncomingBalloon(message) {
    if (cfg.userBalloonPlacement !== 'off') {
        ensureBalloon();
        let balloon = document.getElementById(`fcm-chat-user-${message.memberNumber}`);
        if (!balloon) {
            balloon = document.createElement('button');
            balloon.id = `fcm-chat-user-${message.memberNumber}`;
            balloon.className = 'fcm-chat-user-balloon';
            balloon.addEventListener('click', () => { if (!balloon.dataset.dragMoved) toggleChat(message.memberNumber); });
            document.body.appendChild(balloon);
            makeDraggable(balloon, balloon, 'chatUserBalloonPositions', String(message.memberNumber));
        }
        paintBalloon(balloon);
        const saved = cfg.chatUserBalloonPositions?.[message.memberNumber];
        if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
            balloon.style.left = `${saved.x}px`; balloon.style.top = `${saved.y}px`; balloon.style.right = balloon.style.bottom = 'auto';
        } else placeBalloon(balloon, cfg.userBalloonPlacement, [...document.querySelectorAll('.fcm-chat-user-balloon')].indexOf(balloon));
        balloon.innerHTML = `${waterShapeHtml()}${avatarHtml(message.memberNumber, 50)}${unreadBadge(message.memberNumber)}<span class="fcm-balloon-preview"><strong>${esc(getDisplayName(message.memberNumber))}</strong>${esc(message.content)}</span>`;
        requestAnimationFrame(() => resolveBalloonCollision(balloon));
        if (!avatarUrl(message.memberNumber)) Snapshot.get(message.memberNumber).then(url => { if (url && balloon.isConnected) balloon.innerHTML = `${waterShapeHtml()}${avatarHtml(message.memberNumber, 50)}${unreadBadge(message.memberNumber)}<span class="fcm-balloon-preview"><strong>${esc(getDisplayName(message.memberNumber))}</strong>${esc(message.content)}</span>`; });
        showBalloon(balloon);
    } else if (cfg.balloonPlacement !== 'off') {
        ensureBalloon();
        const balloon = document.getElementById('fcm-chat-balloon');
        balloon.querySelector('.fcm-balloon-preview').innerHTML = '<strong>FCM Chat</strong>';
        const badge = balloon.querySelector('.fcm-chat-unread'); const count = unreadCount(); if (badge) { badge.textContent = Math.min(count, 99); badge.classList.toggle('hidden', !count); }
        showBalloon(balloon);
    }
}

function showBalloon(balloon) {
    balloon.classList.add('visible');
    if (cfg.notificationAnimation) {
        balloon.classList.remove('notify');
        void balloon.offsetWidth;
        balloon.classList.add('notify');
        balloon.addEventListener('animationend', () => balloon.classList.remove('notify'), { once: true });
    }
}

function playNotificationSound() {
    if (!cfg.notificationAudio) return;
    try { const source = cfg.notificationSound === 'custom' ? customAudioUrl : (cfg.notificationSound || 'Audio/BeepAlarm.mp3'); if (!source) return; const audio = new Audio(source); audio.volume = 0.8; audio.play().catch(() => {}); } catch {}
}

function showGroupNameDialog() {
    return new Promise(resolve => {
        const overlay = document.createElement('div'); overlay.className = 'fcm-chat-modal-overlay';
        overlay.style.cssText = `--s:${cfg.panelColor};--tx:${cfg.fontColor};--ac:${cfg.accentColor}`;
        overlay.innerHTML = `<div class="fcm-chat-modal fcm-chat-group-dialog"><div>${T('chatNewGroup')}</div><input data-new-group-name maxlength="24" placeholder="${T('chatNewGroup')}"><div><button data-modal-cancel>${T('chatCancel')}</button><button data-modal-ok>${T('btnConfirm')}</button></div></div>`;
        const input = overlay.querySelector('[data-new-group-name]');
        const finish = value => { overlay.remove(); resolve(value); };
        overlay.querySelector('[data-modal-cancel]').addEventListener('click', () => finish(''));
        overlay.querySelector('[data-modal-ok]').addEventListener('click', () => finish(input.value.trim()));
        input.addEventListener('keydown', event => { event.stopPropagation(); if (event.key === 'Enter') finish(input.value.trim()); else if (event.key === 'Escape') finish(''); });
        document.body.appendChild(overlay); input.focus();
    });
}

async function saveCustomNotificationSound(file) {
    if (!file || !await AudioStore.save(file)) return false;
    if (customAudioUrl) URL.revokeObjectURL(customAudioUrl);
    customAudioUrl = URL.createObjectURL(file);
    cfg.notificationSound = 'custom'; cfg.notificationAudio = true; saveCfg();
    return true;
}

function refreshChatSettings() {
    ensureBalloon();
    document.querySelectorAll('.fcm-chat-user-balloon').forEach(paintBalloon);
    document.getElementById('fcm-chat-balloon')?.classList.toggle('persistent', !!cfg.communicationEnabled && cfg.balloonPlacement !== 'off');
    if (cfg.userBalloonPlacement === 'off') document.querySelectorAll('.fcm-chat-user-balloon').forEach(balloon => balloon.remove());
    if (!cfg.communicationEnabled) {
        closeChat();
        document.querySelectorAll('.fcm-chat-user-balloon').forEach(balloon => balloon.remove());
    } else if (root?.isConnected && root.style.display !== 'none') renderChat();
}

function injectStyles() {
    if (document.getElementById('fcm-chat-css')) return;
    const style = document.createElement('style');
    style.id = 'fcm-chat-css';
    style.textContent = `
#fcm-chat-root,#fcm-chat-root *,#fcm-chat-balloon,#fcm-chat-balloon *,body>.fcm-chat-user-balloon,body>.fcm-chat-user-balloon *{box-sizing:border-box;user-select:none;-webkit-user-select:none;-webkit-user-drag:none}
#fcm-chat-root{position:fixed;inset:0;z-index:99992;pointer-events:none;font-family:-apple-system,"Segoe UI",sans-serif}
#fcm-chat-panel{--surface-alt:color-mix(in srgb,var(--s) 86%,#000);--surface-raised:color-mix(in srgb,var(--s) 82%,var(--ac));--dim:color-mix(in srgb,var(--tx) 62%,var(--s));--border:color-mix(in srgb,var(--ac) 38%,var(--s));position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:min(900px,94vw);height:min(590px,88vh);min-width:min(720px,98vw);min-height:min(480px,96vh);max-width:98vw;max-height:96vh;background:var(--s);color:var(--tx);border:1px solid var(--ac);border-radius:12px;box-shadow:0 14px 55px #000a;overflow:hidden;resize:both;pointer-events:auto;transition:width .32s cubic-bezier(.4,0,.2,1),height .32s cubic-bezier(.4,0,.2,1)}
#fcm-chat-panel.maximized{left:0!important;top:0!important;width:100vw!important;height:100vh!important;max-width:none!important;max-height:none!important;transform:none!important;resize:none;border-radius:0}
#fcm-chat-panel.fcm-size-animating{transform-origin:50% 50%!important;transition:none!important;will-change:translate,scale}
#fcm-chat-root *{scrollbar-color:var(--ac) rgba(0,0,0,.55)!important;scrollbar-width:thin}#fcm-chat-root *::-webkit-scrollbar{width:10px;height:10px}#fcm-chat-root *::-webkit-scrollbar-track{background:rgba(0,0,0,.55)!important}#fcm-chat-root *::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--ac) 65%,transparent)!important;border:0!important;border-radius:4px}#fcm-chat-root *::-webkit-scrollbar-thumb:hover{background:var(--ac)!important}
.fcm-chat-titlebar{height:44px;display:flex;align-items:center;gap:6px;padding:0 10px;background:var(--surface-alt);border-bottom:1px solid var(--ac);cursor:move;touch-action:none}.fcm-chat-titlebar b{color:var(--ac)}.fcm-chat-titlebar>span{flex:1}.fcm-chat-titlebar button{width:30px;height:30px;padding:0;background:transparent!important;color:var(--dim);border:1px solid var(--ac);border-radius:6px;font-size:16px;line-height:1;display:flex;align-items:center;justify-content:center}
.fcm-chat-body{height:calc(100% - 44px);min-height:0;display:grid;grid-template-columns:54px 260px minmax(0,1fr);grid-template-rows:minmax(0,1fr);position:relative;overflow:hidden}.fcm-chat-rail{min-height:0;background:var(--surface-alt);border-right:1px solid var(--border);display:flex;flex-direction:column;align-items:center;gap:6px;padding:10px 0;z-index:5;overflow:visible}.fcm-chat-rail>span{flex:1}.fcm-chat-rail-button{position:relative;width:36px!important;height:36px!important;min-width:36px;flex:0 0 36px;padding:0!important;background:transparent;border:1px solid transparent;border-radius:7px;color:var(--dim);font-size:18px;line-height:1;display:flex;align-items:center;justify-content:center;overflow:visible}.fcm-chat-rail-button:hover,.fcm-chat-rail-button.active,.fcm-chat-rail-button.has-unread{color:var(--ac);border-color:var(--ac);background:color-mix(in srgb,var(--ac) 14%,transparent)}.fcm-chat-self .fcm-chat-avatar{width:34px!important;height:34px!important;border-radius:7px}
.fcm-chat-list{min-width:0;min-height:0;height:100%;display:flex;flex-direction:column;border-right:1px solid var(--border);overflow:hidden}.fcm-chat-main{min-width:0;min-height:0;height:100%;display:flex;flex-direction:column;overflow:hidden}.fcm-chat-list-title{padding:10px 12px 6px;color:var(--dim);font-size:11px;text-transform:uppercase;letter-spacing:.08em}.fcm-chat-scroll{flex:1;min-height:0;overflow:auto;padding:2px 6px 6px;scrollbar-color:var(--ac) var(--surface-alt)}
.fcm-chat-search{padding:8px 10px}.fcm-chat-search input{width:100%;padding:7px 8px;background:var(--surface-alt);color:var(--tx);border:1px solid var(--border);border-radius:7px}.fcm-chat-search input:focus{outline:0;border-color:var(--ac)}.fcm-chat-presence,.fcm-chat-tags,.fcm-chat-group-tabs,.fcm-chat-subtabs{display:flex;gap:5px;padding:0 10px 8px}.fcm-chat-presence button,.fcm-chat-tags button,.fcm-chat-group-tabs button,.fcm-chat-subtabs button{flex:1;padding:5px 4px;background:transparent;color:var(--dim);border:1px solid var(--border);border-radius:7px;font-size:11px}.fcm-chat-presence button.active,.fcm-chat-tags button.active,.fcm-chat-group-tabs button.active,.fcm-chat-subtabs button.active{color:var(--ac);border-color:var(--ac);background:color-mix(in srgb,var(--ac) 14%,transparent)}.fcm-chat-subtabs{padding-top:8px;border-bottom:1px solid var(--border)}
.fcm-chat-row{width:100%;display:flex;align-items:center;gap:8px;padding:7px 6px;background:transparent;color:var(--tx);border:1px solid transparent;border-radius:7px;text-align:left}.fcm-chat-row:hover{background:var(--surface-raised)}.fcm-chat-row.selected{background:color-mix(in srgb,var(--ac) 14%,transparent);border-color:var(--border)}.fcm-chat-row-meta{flex:1;min-width:0;display:flex;flex-direction:column}.fcm-chat-row-meta b,.fcm-chat-row-meta small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fcm-chat-row-meta small,.fcm-chat-row time{font-size:10.5px;color:var(--dim)}.fcm-chat-row em{background:var(--ac);color:var(--s);border-radius:9px;padding:2px 6px;font-style:normal}
.fcm-chat-avatar{position:relative;display:inline-flex;flex:none;align-items:center;justify-content:center;border-radius:7px;overflow:visible;background:var(--surface-alt);color:var(--ac);border:1px solid var(--border);font-size:11px;font-weight:700}.fcm-chat-avatar img{width:100%;height:100%;border-radius:inherit;object-fit:cover;pointer-events:none}.fcm-chat-avatar i{position:absolute;right:-4px;bottom:-4px;width:15px;height:15px;border:2px solid var(--s);border-radius:50%;background:#58c878}.fcm-chat-avatar i.busy,.fcm-status-dot.busy,.fcm-chat-status-menu i.busy{background:#e85d68}.fcm-chat-avatar i.afk,.fcm-status-dot.afk,.fcm-chat-status-menu i.afk{background:#e9bd4b}.fcm-chat-avatar i.offline,.fcm-status-dot.offline,.fcm-chat-status-menu i.offline{background:#777}
.fcm-chat-conversation-header{padding:10px 14px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border);animation:fcm-chat-rise .3s cubic-bezier(.2,.8,.2,1) both}.fcm-chat-conversation-header>span{display:flex;flex-direction:column}.fcm-chat-conversation-header small{color:var(--dim)}.fcm-chat-conversation-header small[data-room-name]{cursor:pointer}.fcm-chat-conversation-header small[data-room-name]:hover{color:var(--ac);text-decoration:underline}.fcm-chat-not-friend{margin-left:8px;color:var(--dim);font-size:.85em;font-style:normal;font-weight:400}.fcm-chat-conversation-header>.fcm-chat-avatar{cursor:pointer}.fcm-chat-messages{flex:1;min-height:0;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:8px;scrollbar-color:var(--ac) var(--surface-alt)}.fcm-chat-message{max-width:70%;padding:7px 10px;border-radius:7px;border:1px solid transparent;animation:fcm-chat-rise .32s cubic-bezier(.2,.8,.2,1) both}.fcm-chat-message.in{align-self:flex-start;background:var(--surface-alt)}.fcm-chat-message.out{align-self:flex-end;background:color-mix(in srgb,var(--ac) 14%,transparent);border-color:var(--ac)}.fcm-chat-message time{display:block;margin-top:3px;font-size:9px;color:var(--dim)}.fcm-chat-actions{display:flex;flex-shrink:0;gap:6px;padding:6px 12px 0;border-top:1px solid var(--border);animation:fcm-chat-rise .3s cubic-bezier(.2,.8,.2,1) .06s both}.fcm-chat-actions button{padding:4px 8px;background:transparent;color:var(--dim);border:1px solid var(--border);border-radius:7px}.fcm-chat-compose{display:flex;flex-shrink:0;gap:8px;padding:6px 12px 10px;animation:fcm-chat-rise .3s cubic-bezier(.2,.8,.2,1) .1s both}.fcm-chat-compose textarea{flex:1;resize:none;padding:8px;background:var(--surface-alt);color:var(--tx);border:1px solid var(--border);border-radius:7px;user-select:text!important;-webkit-user-select:text!important}.fcm-chat-compose>button{padding:0 16px;background:transparent;color:var(--ac);border:1px solid var(--ac);border-radius:7px}.fcm-chat-channels{display:flex;flex-direction:column;gap:3px}.fcm-chat-channels button{min-width:66px;flex:1;background:transparent;color:var(--dim);border:1px solid var(--border);border-radius:7px}.fcm-chat-channels button.active{color:var(--ac);border-color:var(--ac);background:color-mix(in srgb,var(--ac) 14%,transparent)}.fcm-chat-channels button:disabled{opacity:1;color:var(--dim);cursor:default}
.fcm-chat-actions>span{flex:1}.fcm-chat-tools{position:relative}.fcm-chat-tools-menu{position:absolute;right:0;bottom:calc(100% + 7px);display:flex;flex-direction:column;align-items:stretch;gap:5px;padding:5px;opacity:0;visibility:hidden;transform:translateY(8px);background:var(--s);border:1px solid var(--ac);border-radius:8px;box-shadow:0 8px 24px #0009;transition:.18s ease}.fcm-chat-tools-menu button{justify-content:flex-start!important;gap:7px;white-space:nowrap}.fcm-chat-tools.open .fcm-chat-tools-menu{opacity:1;visibility:visible;transform:translateY(0)}.fcm-chat-tools.open>[data-toggle-tools]{color:var(--ac);border-color:var(--ac)}.fcm-chat-channels.offline button{color:#777!important;border-color:#555!important;background:#7771!important;box-shadow:none!important}.fcm-chat-message.queued{opacity:.68;border-style:dashed}.fcm-chat-message.queued time{color:#e9bd4b}.fcm-chat-header-action{width:38px;height:38px;padding:6px;background:transparent;color:var(--dim);border:1px solid var(--border);border-radius:7px}.fcm-chat-header-action:disabled{opacity:.35}.fcm-chat-header-action svg,.fcm-chat-rail-button svg,.fcm-chat-actions svg{width:18px;height:18px;fill:currentColor}
.fcm-chat-settings{padding:8px 10px;display:flex;flex-direction:column;gap:7px}.fcm-chat-setting-row{display:flex;align-items:center;gap:10px;padding:10px 8px;border:0}.fcm-chat-setting-row>span{flex:1;display:flex;flex-direction:column}.fcm-chat-setting-row small{color:var(--dim)}.fcm-chat-switch{width:34px;height:18px;padding:2px;background:var(--surface-alt);border:1px solid var(--ac);border-radius:10px}.fcm-chat-switch i{display:block;width:12px;height:12px;border-radius:50%;background:var(--dim);transition:transform .18s ease}.fcm-chat-switch.on{border-color:var(--ac);background:color-mix(in srgb,var(--ac) 18%,transparent)}.fcm-chat-switch.on i{background:var(--ac);transform:translateX(14px)}.fcm-chat-main-settings{padding:7px;background:transparent;color:var(--ac);border:1px solid var(--ac);border-radius:7px}
.fcm-chat-status-menu{display:none;position:absolute;left:58px;bottom:45px;z-index:10;padding:4px;background:var(--s);border:1px solid var(--ac);border-radius:7px;box-shadow:0 6px 20px #0008}.fcm-chat-status-menu.open{display:flex;flex-direction:column;animation:fcm-chat-pop .12s ease}.fcm-chat-status-menu button{display:flex;align-items:center;gap:8px;padding:6px 10px;background:transparent;color:var(--tx);border:1px solid transparent;border-radius:6px}.fcm-chat-status-menu button:hover{border-color:var(--ac);background:color-mix(in srgb,var(--ac) 14%,transparent)}.fcm-chat-status-menu i,.fcm-status-dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#58c878}.fcm-chat-empty{margin:auto;padding:20px;text-align:center;color:var(--dim)}
.fcm-chat-titlebar button,.fcm-chat-rail-button,.fcm-chat-row,.fcm-chat-presence button,.fcm-chat-tags button,.fcm-chat-group-tabs button,.fcm-chat-subtabs button,.fcm-chat-actions button,.fcm-chat-channels button,.fcm-chat-compose>button,.fcm-chat-status-menu button,.fcm-chat-main-settings{cursor:pointer;transition:background-color .15s ease,border-color .15s ease,color .15s ease,transform .1s ease,box-shadow .15s ease}.fcm-chat-titlebar button:active,.fcm-chat-rail-button:active,.fcm-chat-row:active,.fcm-chat-tags button:active,.fcm-chat-group-tabs button:active,.fcm-chat-subtabs button:active,.fcm-chat-actions button:active,.fcm-chat-channels button:not(:disabled):active,.fcm-chat-compose>button:not(:disabled):active{transform:scale(.95)}
.fcm-chat-body.stacked:not(.wide-view) .fcm-chat-list,.fcm-chat-body.stacked:not(.wide-view) .fcm-chat-main{position:absolute;top:0;bottom:0;left:54px;width:calc(100% - 54px);visibility:visible;pointer-events:auto;transition:transform .32s cubic-bezier(.4,0,.2,1),visibility 0s linear 0s,pointer-events 0s linear 0s}.fcm-chat-body.stacked:not(.wide-view) .fcm-chat-list{transform:translateX(0);z-index:2}.fcm-chat-body.stacked:not(.wide-view) .fcm-chat-list.slide-out{transform:translateX(-100%);visibility:hidden;pointer-events:none;transition:transform .32s cubic-bezier(.4,0,.2,1),visibility 0s linear .32s,pointer-events 0s linear .32s}.fcm-chat-body.stacked:not(.wide-view) .fcm-chat-main{transform:translateX(100%);visibility:hidden;pointer-events:none;z-index:3;transition:transform .32s cubic-bezier(.4,0,.2,1),visibility 0s linear .32s,pointer-events 0s linear .32s}.fcm-chat-body.stacked:not(.wide-view) .fcm-chat-main.slide-in{transform:translateX(0);visibility:visible;pointer-events:auto;transition:transform .32s cubic-bezier(.4,0,.2,1),visibility 0s linear 0s,pointer-events 0s linear 0s}
#fcm-chat-balloon,.fcm-chat-user-balloon{--s:#1a1821;--tx:#f1ecff;--ac:#7648fe;display:none;position:fixed;right:22px;bottom:22px;z-index:99991;width:54px;height:54px;border-radius:50%;background:var(--s);color:var(--ac);border:2px solid var(--ac);font-size:22px;cursor:move;box-shadow:0 6px 24px #0008;touch-action:none}#fcm-chat-balloon.visible,#fcm-chat-balloon.persistent,.fcm-chat-user-balloon.visible{display:flex;align-items:center;justify-content:center}#fcm-chat-balloon>span,.fcm-chat-user-balloon>span{display:none;position:absolute;right:60px;bottom:0;width:260px;padding:9px;text-align:left;background:var(--s);color:var(--tx);border:1px solid var(--ac);border-radius:9px;font-size:13px}#fcm-chat-balloon>span strong,.fcm-chat-user-balloon>span strong{display:block;color:var(--ac)}#fcm-chat-balloon:hover>span,.fcm-chat-user-balloon:hover>span{display:block}.fcm-chat-user-balloon .fcm-chat-avatar i{display:none}
@keyframes fcm-chat-rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}@keyframes fcm-chat-pop{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}@keyframes fcm-chat-notify{0%{transform:scale(1) rotate(0)}18%{transform:scale(.86,1.15) rotate(-7deg)}38%{transform:scale(1.24,.83) rotate(8deg);box-shadow:0 0 0 10px color-mix(in srgb,var(--ac) 20%,transparent)}58%{transform:scale(.94,1.08) rotate(-4deg)}76%{transform:scale(1.06,.96) rotate(2deg)}100%{transform:scale(1) rotate(0);box-shadow:0 6px 24px #0008}}.notify{animation:fcm-chat-notify .78s cubic-bezier(.2,.8,.2,1)}
#fcm-chat-root textarea,#fcm-chat-root input{user-select:none!important;-webkit-user-select:none!important}
.fcm-chat-titlebar button{position:relative}
[data-group-name],[data-profile-avatar-url]{background:var(--surface-alt)!important;color:var(--tx)!important;border-color:var(--border)!important;caret-color:var(--ac)!important}[data-group-name]::placeholder,[data-profile-avatar-url]::placeholder{color:var(--dim)!important}[data-group-name]:-webkit-autofill,[data-profile-avatar-url]:-webkit-autofill{-webkit-text-fill-color:var(--tx)!important;box-shadow:0 0 0 1000px var(--surface-alt) inset!important}
.fcm-chat-titlebar button svg{width:13px;height:13px}.fcm-chat-titlebar button>i{position:absolute;top:calc(100% + 6px);right:0;z-index:20;opacity:0;max-height:0;overflow:hidden;pointer-events:none;padding:3px 8px;background:var(--surface-raised);color:var(--tx);border:1px solid var(--ac);border-radius:7px;box-shadow:0 6px 16px #0006;font-size:10px;font-style:normal;white-space:nowrap;transform:translateY(-4px);transition:opacity .18s ease,transform .22s cubic-bezier(.4,0,.2,1),max-height .22s cubic-bezier(.4,0,.2,1)}.fcm-chat-titlebar button:hover>i,.fcm-chat-titlebar button:focus-visible>i{opacity:1;max-height:22px;transform:translateY(0)}.fcm-chat-titlebar button:hover,.fcm-chat-titlebar button:focus-visible,.fcm-chat-titlebar button.active{background:transparent!important;border-color:var(--ac);color:var(--ac);outline:0;box-shadow:0 0 10px color-mix(in srgb,var(--ac) 42%,transparent),0 0 0 1px color-mix(in srgb,var(--ac) 35%,transparent) inset}.fcm-chat-titlebar [data-max] svg{transition:transform .32s cubic-bezier(.4,0,.2,1)}.fcm-chat-titlebar [data-max].active svg{transform:rotate(180deg)}
.fcm-chat-row.just-opened{animation:fcm-chat-row-pop .32s cubic-bezier(.4,0,.2,1)}@keyframes fcm-chat-row-pop{0%{transform:scale(1)}40%{transform:scale(.965);background:color-mix(in srgb,var(--ac) 18%,transparent)}100%{transform:scale(1)}}
#fcm-chat-balloon>svg{width:27px;height:27px;pointer-events:none}.fcm-chat-unread{position:absolute;right:-6px;top:-6px;z-index:3;min-width:19px;height:19px;padding:0 5px;display:flex;align-items:center;justify-content:center;border-radius:10px;background:#e34b62;color:#fff;border:2px solid var(--s);font-size:10px;line-height:1}.fcm-chat-unread.hidden{display:none}
.fcm-chat-search input{background:var(--surface-alt)!important;color:var(--tx)!important;border-color:var(--border)!important;caret-color:var(--ac);color-scheme:dark}.fcm-chat-search input::placeholder{color:var(--dim)!important}.fcm-chat-search input:-webkit-autofill{-webkit-text-fill-color:var(--tx)!important;box-shadow:0 0 0 1000px var(--surface-alt) inset!important}
.fcm-chat-avatar.round,.fcm-chat-avatar.round img{border-radius:50%}.fcm-chat-avatar.square,.fcm-chat-avatar.square img{border-radius:7px}.fcm-chat-profile .fcm-chat-avatar,.fcm-chat-profile .fcm-chat-avatar img{border-radius:7px!important}
.fcm-chat-body.wide-view .fcm-chat-list{grid-column:2/4;border-right:0}.fcm-chat-body.wide-view .fcm-chat-main{display:none}.fcm-chat-profile{height:100%;padding:24px 40px;overflow:auto;display:flex;flex-direction:column;gap:13px}.fcm-chat-profile-head{display:flex;align-items:center;gap:18px;margin-bottom:4px}.fcm-chat-profile-head>div{display:flex;flex-direction:column}.fcm-chat-profile-head b{font-size:16px;color:var(--ac)}.fcm-chat-profile-head small{color:var(--dim)}.fcm-chat-profile label{display:flex;flex-direction:column;gap:5px;max-width:520px;font-size:11px;color:var(--dim)}.fcm-chat-profile input,.fcm-chat-profile textarea,.fcm-chat-profile select,.fcm-chat-settings select,.fcm-chat-actions select,.fcm-chat-group-create input{padding:7px 9px;background:var(--surface-alt);color:var(--tx);border:1px solid var(--border);border-radius:7px}.fcm-chat-profile input:focus,.fcm-chat-profile textarea:focus{outline:0;border-color:var(--ac)}.fcm-chat-profile>button{align-self:flex-start;padding:7px 18px;background:transparent;color:var(--ac);border:1px solid var(--ac);border-radius:7px}.fcm-chat-group-create{display:flex;gap:5px;padding:0 10px 8px}.fcm-chat-group-create input{flex:1;min-width:0}.fcm-chat-group-create button{width:30px;background:transparent;color:var(--ac);border:1px solid var(--ac);border-radius:7px}
.fcm-chat-modal-overlay{position:fixed;inset:0;z-index:100020;display:flex;align-items:center;justify-content:center;background:#0009;user-select:none}.fcm-chat-modal{width:min(400px,90vw);padding:24px;background:var(--s);color:var(--tx);border:2px solid var(--ac);border-radius:14px;box-shadow:0 8px 40px #000c;text-align:center}.fcm-chat-modal>div:last-child{display:flex;gap:10px;margin-top:18px}.fcm-chat-modal button{flex:1;padding:10px;background:transparent;color:var(--ac);border:1px solid var(--ac);border-radius:8px}.fcm-chat-modal [data-modal-ok]{background:color-mix(in srgb,var(--ac) 18%,transparent)}
.fcm-chat-body.stacked.view-chat:not(.wide-view) .fcm-chat-list:not(.slide-out) .fcm-chat-scroll,.fcm-chat-body.stacked.view-groups:not(.wide-view) .fcm-chat-list:not(.slide-out) .fcm-chat-scroll{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));align-content:start;gap:4px;padding:6px 10px}.fcm-chat-body.stacked.view-chat .fcm-chat-row,.fcm-chat-body.stacked.view-groups .fcm-chat-row{min-width:0}
.fcm-chat-back{width:22px;height:22px;padding:0;background:transparent;color:var(--dim);border:1px solid transparent;border-radius:7px;display:flex;align-items:center;justify-content:center}.fcm-chat-back:hover{color:var(--ac);border-color:var(--ac);background:color-mix(in srgb,var(--ac) 14%,transparent)}.fcm-chat-back svg{width:14px;height:14px}
.fcm-balloon-icon{display:flex!important;position:relative!important;right:auto!important;bottom:auto!important;width:34px!important;height:34px!important;padding:0!important;background:transparent!important;border:0!important;align-items:center;justify-content:center;pointer-events:none}.fcm-balloon-icon svg{width:34px!important;height:34px!important;display:block}.fcm-chat-user-balloon>.fcm-chat-avatar{display:inline-flex!important;position:relative!important;right:auto!important;bottom:auto!important;width:50px!important;height:50px!important;padding:0!important;text-align:center!important;background:var(--surface-alt)!important;border:1px solid var(--ac)!important}.fcm-chat-user-balloon:hover>.fcm-chat-avatar{display:inline-flex!important}
.fcm-chat-main.slide-in .fcm-chat-conversation-header,.fcm-chat-main.slide-in .fcm-chat-messages,.fcm-chat-main.slide-in .fcm-chat-actions,.fcm-chat-main.slide-in .fcm-chat-compose{animation:fcm-chat-enter-right .32s cubic-bezier(.2,.8,.2,1) both}.fcm-chat-list:not(.slide-out) .fcm-chat-scroll{animation:fcm-chat-enter-left .32s cubic-bezier(.2,.8,.2,1) both}@keyframes fcm-chat-enter-right{from{opacity:0;transform:translateX(18px)}to{opacity:1;transform:translateX(0)}}@keyframes fcm-chat-enter-left{from{opacity:0;transform:translateX(-18px)}to{opacity:1;transform:translateX(0)}}
.fcm-chat-user-balloon>.fcm-chat-avatar{background:color-mix(in srgb,var(--s) 82%,var(--ac))!important}
body>.fcm-chat-user-balloon{border:0!important;box-shadow:0 0 15px color-mix(in srgb,var(--ac) 78%,transparent),0 6px 24px #0008}body>.fcm-chat-user-balloon:has(.fcm-chat-unread:not(.hidden)){box-shadow:0 0 18px color-mix(in srgb,#e34b62 88%,transparent),0 0 7px #e34b62,0 6px 24px #0008}.fcm-chat-user-balloon>.fcm-chat-avatar{border:0!important}
.fcm-chat-rail-button svg{width:23px!important;height:23px!important;display:block}.fcm-chat-rail-button svg path,.fcm-chat-rail-button svg circle,.fcm-chat-rail-button svg rect{fill:currentColor!important;stroke:currentColor!important}.fcm-profile-statuses{display:flex;align-items:center;gap:12px;max-width:620px}.fcm-profile-statuses>span{width:110px;color:var(--dim)}.fcm-profile-statuses button{display:flex;align-items:center;gap:5px;background:transparent;color:var(--dim);border:1px solid transparent;border-radius:7px;padding:5px 8px}.fcm-profile-statuses button.active{color:var(--ac);border-color:var(--ac);background:color-mix(in srgb,var(--ac) 14%,transparent)}.fcm-profile-statuses button>i{width:15px;height:15px;border-radius:50%;background:#58c878}.fcm-profile-statuses button>i.busy{background:#e85d68}.fcm-profile-statuses button>i.afk{background:#e9bd4b}.fcm-profile-message{max-width:620px!important;display:grid!important;grid-template-columns:110px minmax(0,1fr) 34px;align-items:center;gap:10px}.fcm-profile-message textarea{grid-column:2}.fcm-profile-message .fcm-chat-switch{grid-column:3;grid-row:1/3}.fcm-chat-settings input[type="file"],.fcm-chat-settings input[type="text"],.fcm-chat-settings [data-chat-avatar-url]{max-width:240px;background:var(--surface-alt);color:var(--tx);border:1px solid var(--border);border-radius:7px;padding:6px}
.fcm-chat-setting-row{border-radius:8px;transition:background-color .16s ease,border-color .16s ease,box-shadow .16s ease}.fcm-chat-setting-row:hover{background:color-mix(in srgb,var(--ac) 9%,transparent);border-color:color-mix(in srgb,var(--ac) 45%,transparent);box-shadow:0 0 0 1px color-mix(in srgb,var(--ac) 20%,transparent) inset}.fcm-chat-sound-control{display:flex;align-items:center;gap:6px}.fcm-chat-sound-control>button{width:32px;height:32px;padding:5px;border-radius:8px;background:transparent;color:var(--ac);border:1px solid var(--border);display:flex;align-items:center;justify-content:center}.fcm-chat-sound-control>button:not(:disabled):hover{background:color-mix(in srgb,var(--ac) 14%,transparent);border-color:var(--ac)}.fcm-chat-sound-control>button:disabled{color:var(--dim);opacity:.65}.fcm-chat-sound-control svg{width:20px;height:20px}
.fcm-chat-rail-button svg{width:25px!important;height:25px!important}.fcm-chat-rail-button svg *,.fcm-chat-sound-control svg *{fill:currentColor!important;stroke:currentColor!important}
.fcm-chat-rail-button svg.fcm-outline-icon *{fill:none!important;stroke:currentColor!important}
.fcm-chat-profile input,.fcm-chat-profile textarea,.fcm-chat-settings input:not([type=file]),.fcm-chat-group-create input,.fcm-chat-search input,.fcm-chat-compose textarea{transition:border-color .15s ease,box-shadow .15s ease}.fcm-chat-profile input:focus,.fcm-chat-profile textarea:focus,.fcm-chat-settings input:focus,.fcm-chat-group-create input:focus,.fcm-chat-search input:focus,.fcm-chat-compose textarea:focus{outline:0;border-color:var(--ac)!important;box-shadow:0 0 0 2px color-mix(in srgb,var(--ac) 22%,transparent)}
.fcm-chat-settings select,.fcm-chat-actions select{appearance:none;-webkit-appearance:none;padding-right:28px!important;background-color:var(--surface-alt)!important;background-image:linear-gradient(45deg,transparent 50%,var(--ac) 50%),linear-gradient(135deg,var(--ac) 50%,transparent 50%)!important;background-position:calc(100% - 13px) 50%,calc(100% - 9px) 50%!important;background-size:4px 4px,4px 4px!important;background-repeat:no-repeat!important;border-color:var(--ac)!important;color-scheme:dark;outline:0!important;scrollbar-color:var(--ac) rgba(0,0,0,.55)!important;transition:border-color .15s ease,box-shadow .15s ease}.fcm-chat-settings select:hover,.fcm-chat-settings select:focus,.fcm-chat-settings select:focus-visible,.fcm-chat-actions select:hover,.fcm-chat-actions select:focus,.fcm-chat-actions select:focus-visible{outline:0!important;border-color:var(--ac)!important;box-shadow:0 0 0 1px var(--ac),0 0 10px color-mix(in srgb,var(--ac) 28%,transparent)!important}.fcm-chat-settings select option,.fcm-chat-actions select option{background:var(--surface-alt)!important;color:var(--tx)!important}.fcm-chat-settings select::-webkit-scrollbar,.fcm-chat-actions select::-webkit-scrollbar{width:10px}.fcm-chat-settings select::-webkit-scrollbar-track,.fcm-chat-actions select::-webkit-scrollbar-track{background:rgba(0,0,0,.55)!important}.fcm-chat-settings select::-webkit-scrollbar-thumb,.fcm-chat-actions select::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--ac) 65%,transparent)!important;border:0!important;border-radius:4px}.fcm-chat-settings select::-webkit-scrollbar-thumb:hover,.fcm-chat-actions select::-webkit-scrollbar-thumb:hover{background:var(--ac)!important}
#fcm-chat-panel[data-theme="jp"] select,#fcm-chat-panel[data-theme="minimalwhite"] select{color-scheme:light}
.fcm-chat-actions button:not(:disabled):hover,.fcm-chat-compose>button:hover,.fcm-chat-channels button:not(:disabled):hover,.fcm-chat-group-create button:hover,.fcm-chat-group-tabs button:hover,.fcm-chat-presence button:hover,.fcm-chat-tags button:hover{color:var(--ac);border-color:var(--ac);background:color-mix(in srgb,var(--ac) 14%,transparent);box-shadow:0 0 10px color-mix(in srgb,var(--ac) 18%,transparent)}.fcm-chat-message:hover{border-color:var(--ac);box-shadow:0 0 12px color-mix(in srgb,var(--ac) 15%,transparent);filter:brightness(1.08)}
#fcm-chat-panel{font-family:var(--chat-font-family)}.fcm-chat-content,.fcm-chat-compose textarea{font-family:var(--chat-font-family);font-size:var(--chat-font-size)}.fcm-chat-content{white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word}
.fcm-chat-avatar i{right:-2px;bottom:-2px;width:9px;height:9px}.fcm-chat-avatar-profile i{right:-4px;bottom:-4px;width:15px;height:15px}.fcm-chat-avatar-toolbar i{right:-1px;bottom:-1px;width:8px;height:8px;border-width:1.5px}
.fcm-chat-subtabs button,.fcm-chat-presence button{position:relative;border-color:transparent!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;transition:color .18s ease,transform .18s ease}.fcm-chat-subtabs button::after,.fcm-chat-presence button::after{content:"";position:absolute;left:50%;right:50%;bottom:-1px;height:2px;background:var(--ac);transition:left .22s ease,right .22s ease,box-shadow .22s ease}.fcm-chat-subtabs button:hover,.fcm-chat-presence button:hover{color:var(--ac);transform:translateY(-1px)}.fcm-chat-subtabs button.active,.fcm-chat-presence button.active{color:var(--ac)!important}.fcm-chat-subtabs button.active::after,.fcm-chat-presence button.active::after{left:8px;right:8px;box-shadow:0 0 8px var(--ac)}
.fcm-chat-theme-manage{padding:6px 10px;background:transparent;color:var(--ac);border:1px solid var(--ac);border-radius:7px}.fcm-chat-theme-options{margin:-3px 8px 7px;padding:10px;background:var(--surface-alt);border:1px solid var(--ac);border-radius:8px}.fcm-chat-theme-options[hidden]{display:none}.fcm-chat-theme-presets{display:flex;flex-wrap:wrap;gap:6px}.fcm-chat-theme-presets button{padding:5px 9px;background:transparent;color:var(--dim);border:1px solid var(--ac);border-radius:7px}.fcm-chat-theme-presets button:hover,.fcm-chat-theme-presets button.active{color:var(--ac);border-color:var(--ac);background:color-mix(in srgb,var(--ac) 12%,transparent)}.fcm-chat-theme-colors{display:flex;flex-wrap:wrap;gap:12px;margin-top:10px}.fcm-chat-theme-colors label{display:flex;align-items:center;gap:5px;color:var(--dim);font-size:11px}.fcm-chat-theme-colors input{width:30px;height:24px;padding:1px!important}
.fcm-chat-conversation-header{position:relative;z-index:100;overflow:visible}.fcm-chat-conversation-header>span{flex:1;min-width:0}.fcm-chat-assign{position:relative;margin-left:auto;z-index:200}.fcm-chat-assign>button{width:30px;height:30px;padding:5px;background:transparent;color:var(--ac);border:1px solid var(--ac);border-radius:7px}.fcm-chat-assign svg{width:18px;height:18px}.fcm-chat-assign-menu{display:none;position:absolute;right:0;top:100%;z-index:1000;width:180px;padding:5px;background:var(--s);border:1px solid var(--ac);border-radius:8px;box-shadow:0 8px 24px #0009;pointer-events:none}.fcm-chat-assign-menu.open{display:flex;flex-direction:column;pointer-events:auto}.fcm-chat-assign-menu button{position:relative;z-index:1;padding:7px 9px;text-align:left;background:transparent;color:var(--tx);border:0;border-radius:5px;pointer-events:auto}.fcm-chat-assign-menu button:hover{color:var(--ac);background:color-mix(in srgb,var(--ac) 14%,transparent)}.fcm-chat-assign-menu .create{margin-top:4px;padding-top:8px;border-top:1px solid var(--ac);color:var(--ac)}
.fcm-chat-settings option:checked,.fcm-chat-actions option:checked{background:var(--ac) linear-gradient(0deg,var(--ac),var(--ac))!important;color:var(--s)!important}
.fcm-chat-language,.fcm-chat-language option{font-family:"Twemoji Country Flags",-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans TC",sans-serif!important}
.fcm-chat-row{position:relative}.fcm-chat-row em{position:absolute;right:-2px;top:-4px;z-index:3;min-width:20px;min-height:20px;padding:2px 6px;text-align:center;border:2px solid var(--s);border-radius:999px;box-shadow:0 2px 7px #0007;line-height:1.1}.fcm-chat-user-balloon>.fcm-chat-avatar,.fcm-chat-user-balloon>.fcm-chat-avatar img{border-radius:50%!important}
.fcm-chat-conversation-header .fcm-chat-avatar.round,.fcm-chat-conversation-header .fcm-chat-avatar.round img{border-radius:50%!important}.fcm-chat-conversation-header .fcm-chat-avatar.square,.fcm-chat-conversation-header .fcm-chat-avatar.square img{border-radius:7px!important}
.fcm-chat-assign>button{cursor:pointer;display:flex;align-items:center;justify-content:center}.fcm-chat-assign-menu{padding:7px;gap:3px}.fcm-chat-assign-menu button{display:block;width:100%;min-height:34px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.fcm-chat-group-dialog input{width:100%;margin-top:14px;padding:8px 10px;background:var(--surface-alt,#17151d);color:var(--tx);border:1px solid var(--ac);border-radius:7px;outline:none}
.fcm-chat-body.view-settings .fcm-chat-list{overflow-y:auto;overflow-x:hidden;scrollbar-color:var(--ac) var(--surface-alt)}.fcm-chat-body.view-settings .fcm-chat-settings{flex:none}.fcm-chat-scroll,.fcm-chat-messages,.fcm-chat-profile,.fcm-chat-body.view-settings .fcm-chat-list{cursor:default}.drag-scrolling{cursor:grabbing!important;scroll-behavior:auto!important;user-select:none!important}
.fcm-chat-group-add{flex:0 0 32px!important;color:var(--ac)!important;border-color:var(--ac)!important}.fcm-chat-group-mode{padding-top:2px}
.fcm-chat-scroll::-webkit-scrollbar,.fcm-chat-messages::-webkit-scrollbar,.fcm-chat-profile::-webkit-scrollbar,.fcm-chat-body.view-settings .fcm-chat-list::-webkit-scrollbar{width:10px;height:10px}.fcm-chat-scroll::-webkit-scrollbar-track,.fcm-chat-messages::-webkit-scrollbar-track,.fcm-chat-profile::-webkit-scrollbar-track,.fcm-chat-body.view-settings .fcm-chat-list::-webkit-scrollbar-track{background:rgba(0,0,0,.55)}.fcm-chat-scroll::-webkit-scrollbar-thumb,.fcm-chat-messages::-webkit-scrollbar-thumb,.fcm-chat-profile::-webkit-scrollbar-thumb,.fcm-chat-body.view-settings .fcm-chat-list::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--ac) 65%,transparent);border:0;border-radius:4px}.fcm-chat-scroll::-webkit-scrollbar-thumb:hover,.fcm-chat-messages::-webkit-scrollbar-thumb:hover,.fcm-chat-profile::-webkit-scrollbar-thumb:hover{background:var(--ac)}
.fcm-chat-setting-row>button:not(.fcm-chat-switch):hover,.fcm-chat-theme-manage:hover,.fcm-chat-assign>button:hover{color:var(--ac);border-color:var(--ac);background:color-mix(in srgb,var(--ac) 14%,transparent);box-shadow:0 0 10px color-mix(in srgb,var(--ac) 20%,transparent)}[data-chat-font-size]{color:var(--ac)!important;border-color:var(--border)!important;background:var(--surface-alt)!important}
.fcm-chat-conversation-header>span.fcm-chat-conversation-meta{display:flex;flex:1;min-width:0;flex-direction:column}.fcm-chat-conversation-header>.fcm-chat-avatar{flex:0 0 38px!important;width:38px!important;height:38px!important;min-width:38px!important;max-width:38px!important}.fcm-chat-avatar-conversation i{width:13px!important;height:13px!important;right:-3px!important;bottom:-3px!important;border-width:2px!important}
.fcm-chat-assign{position:relative;margin-left:auto;flex:0 0 auto;isolation:isolate;z-index:200}.fcm-chat-assign>button{width:34px;height:34px;padding:6px}.fcm-chat-assign-menu{right:-4px;top:100%;z-index:1000;width:200px;padding:10px 7px 7px}.fcm-chat-assign-menu button{min-height:36px;padding:8px 10px}
.fcm-chat-message{position:relative;margin-top:6px;border-color:var(--ac)}.fcm-chat-message::before{content:"";position:absolute;top:10px;width:10px;height:10px;transform:rotate(45deg)}.fcm-chat-message.in{background:color-mix(in srgb,var(--ac) 14%,var(--surface-alt))}.fcm-chat-message.in::before{left:-6px;background:color-mix(in srgb,var(--ac) 14%,var(--surface-alt));border-left:1px solid var(--ac);border-bottom:1px solid var(--ac)}.fcm-chat-message.out{background:color-mix(in srgb,var(--ac) 14%,var(--s))}.fcm-chat-message.out::before{right:-6px;background:color-mix(in srgb,var(--ac) 14%,var(--s));border-top:1px solid var(--ac);border-right:1px solid var(--ac)}
.fcm-chat-font-controls{display:flex;align-items:center;gap:10px}.fcm-chat-font-controls select,.fcm-chat-font-controls input{height:34px!important;min-height:34px!important;margin:0!important}.fcm-chat-font-controls select{min-width:150px}.fcm-chat-font-controls input{width:58px!important;padding:7px 6px!important;text-align:center;border-color:var(--ac)!important;border-radius:7px!important}
.fcm-chat-profile-overview{display:grid;grid-template-columns:110px minmax(0,1fr);gap:22px;align-items:start;max-width:680px;margin-bottom:8px}.fcm-chat-profile-avatar-column{display:flex;flex-direction:column;align-items:center;gap:9px}.fcm-chat-profile-avatar-column .fcm-chat-avatar{width:88px!important;height:88px!important}.fcm-chat-profile-snapshot{width:88px;padding:6px 8px;background:transparent;color:var(--ac);border:1px solid var(--ac);border-radius:7px}.fcm-chat-profile-identity{display:flex;flex-direction:column;gap:8px}.fcm-chat-profile-line,.fcm-chat-profile label.fcm-chat-profile-line{display:grid!important;grid-template-columns:92px minmax(0,1fr) auto;align-items:center;gap:9px;max-width:none!important;min-height:32px;color:var(--dim)}.fcm-chat-profile-line>b{color:var(--tx);font-size:14px}.fcm-chat-profile-line>input{width:100%;max-width:none!important}.fcm-chat-profile-line>em{color:var(--ac);font-size:10px;font-style:normal;white-space:nowrap}.fcm-chat-profile-line .fcm-profile-statuses{max-width:none;gap:6px}.fcm-chat-profile-line .fcm-profile-statuses button{padding:5px 7px}.fcm-chat-profile>label:not(.fcm-chat-profile-line){max-width:680px}.fcm-chat-profile>[data-save-profile]{align-self:flex-end;margin-right:max(0px,calc(100% - 680px));min-width:110px}.fcm-chat-profile-snapshot:hover,.fcm-chat-profile>[data-save-profile]:hover{background:color-mix(in srgb,var(--ac) 14%,transparent);box-shadow:0 0 10px color-mix(in srgb,var(--ac) 22%,transparent)}
.fcm-chat-profile{--profile-label-width:193px}.fcm-chat-profile :is(.fcm-chat-profile-line>span,.fcm-chat-profile-field>span,.fcm-profile-auto-replies label>b,.fcm-profile-edit){font-size:16px!important}.fcm-chat-profile-line>b{font-size:13px}.fcm-profile-edit{padding:5px 8px;background:transparent;color:var(--ac);border:1px solid var(--ac);border-radius:6px}.fcm-profile-nickname-editor[hidden]{display:none!important}.fcm-profile-nickname-editor{grid-column:2/4;display:flex;align-items:center;gap:6px}.fcm-profile-nickname-editor input{flex:1;min-width:0}.fcm-profile-nickname-editor button{width:30px;height:30px;padding:0;background:transparent;color:var(--ac);border:1px solid var(--ac);border-radius:6px}.fcm-chat-profile-field,.fcm-chat-profile label.fcm-chat-profile-field{display:grid!important;grid-template-columns:var(--profile-label-width) minmax(0,1fr);align-items:start;gap:10px;max-width:680px!important;color:var(--dim)}.fcm-chat-profile-field>span{padding-top:8px}.fcm-chat-profile-field>input,.fcm-chat-profile-field>textarea{width:100%;max-width:none}.fcm-profile-auto-replies{display:grid;grid-template-columns:1fr 1fr;gap:12px}.fcm-chat-profile .fcm-profile-auto-replies>label{position:relative;display:grid!important;grid-template-columns:1fr auto;gap:6px;max-width:none}.fcm-profile-auto-replies label>b{align-self:center;color:var(--dim)}.fcm-profile-auto-replies textarea{grid-column:1/3;width:100%}.fcm-profile-auto-replies .fcm-chat-switch{grid-column:2;grid-row:1}.fcm-chat-avatar i,.fcm-status-dot,.fcm-chat-status-menu i,.fcm-profile-statuses button>i{box-shadow:0 0 7px 2px color-mix(in srgb,#58c878 70%,transparent)}.fcm-chat-avatar i.busy,.fcm-status-dot.busy,.fcm-chat-status-menu i.busy,.fcm-profile-statuses button>i.busy{box-shadow:0 0 7px 2px color-mix(in srgb,#e85d68 70%,transparent)}.fcm-chat-avatar i.afk,.fcm-status-dot.afk,.fcm-chat-status-menu i.afk,.fcm-profile-statuses button>i.afk{box-shadow:0 0 7px 2px color-mix(in srgb,#e9bd4b 70%,transparent)}.fcm-chat-avatar i.offline,.fcm-status-dot.offline{box-shadow:0 0 6px 1px #7778}
.fcm-chat-icon-action{display:inline-flex!important;align-items:center;justify-content:center;min-width:30px;min-height:30px}.fcm-chat-icon-action svg{width:17px!important;height:17px!important;display:block;fill:currentColor}.fcm-chat-back{width:30px;height:30px}
.fcm-chat-conversation-header>.fcm-chat-back,.fcm-chat-conversation-header>.fcm-chat-header-action,.fcm-chat-conversation-header>.fcm-chat-assign>button{width:38px!important;height:38px!important;min-width:38px!important;min-height:38px!important;flex:0 0 38px!important;padding:6px!important}.fcm-chat-conversation-header>.fcm-chat-avatar{width:38px!important;height:38px!important;flex:0 0 38px}.fcm-chat-rail .fcm-chat-unread{pointer-events:none;right:-7px;top:-7px}.fcm-chat-rail-button.has-unread{box-shadow:0 0 10px color-mix(in srgb,var(--ac) 38%,transparent)}.fcm-balloon-icon svg [id="Path 0"]{display:none}
.fcm-chat-switch{transition:border-color .16s ease,background .16s ease,box-shadow .16s ease}.fcm-chat-switch i{transition:transform .18s ease,background .16s ease}.fcm-chat-switch:hover{border-color:var(--ac);background:color-mix(in srgb,var(--ac) 14%,var(--surface-alt));box-shadow:0 0 9px color-mix(in srgb,var(--ac) 22%,transparent)}.fcm-chat-switch:hover i{background:color-mix(in srgb,var(--ac) 70%,var(--tx))}
#fcm-chat-balloon,.fcm-chat-user-balloon{z-index:100010}.fcm-balloon-preview{display:none!important;position:absolute!important;right:60px!important;left:auto!important;bottom:0!important;z-index:100011!important;width:260px!important;padding:9px!important;text-align:left!important;background:var(--s)!important;color:var(--tx)!important;border:1px solid var(--ac)!important;border-radius:9px!important;font-size:13px!important;pointer-events:none}.preview-right>.fcm-balloon-preview{right:auto!important;left:60px!important}.fcm-balloon-preview strong{display:block;color:var(--ac)}#fcm-chat-balloon:hover>.fcm-balloon-preview,.fcm-chat-user-balloon:hover>.fcm-balloon-preview{display:block!important}
#fcm-chat-balloon,.fcm-chat-user-balloon{transform-origin:50% 65%;will-change:transform,left,top;transition:transform .34s cubic-bezier(.2,1.45,.35,1),left .14s ease-out,top .14s ease-out,border-radius .24s ease,box-shadow .24s ease}#fcm-chat-balloon.dragging,.fcm-chat-user-balloon.dragging{transform:rotate(var(--drag-angle,0deg)) scale(var(--drag-stretch,1),var(--drag-squash,1))!important;transform-origin:50% 20%;border-radius:46% 46% 58% 58% / 36% 36% 68% 68%;box-shadow:0 14px 28px #0009,0 0 16px color-mix(in srgb,var(--ac) 35%,transparent);transition:border-radius .16s ease,box-shadow .16s ease}#fcm-chat-balloon.released,.fcm-chat-user-balloon.released{animation:fcm-balloon-release .5s cubic-bezier(.2,.8,.2,1)}#fcm-chat-balloon.stirred,.fcm-chat-user-balloon.stirred{transform:translate(var(--stir-x,0),var(--stir-y,0)) rotate(var(--stir-angle,0deg)) scale(.96,1.04)!important;transition:transform .12s ease-out}@keyframes fcm-balloon-release{0%{transform:scale(1.16,.82)}28%{transform:scale(.9,1.13)}52%{transform:scale(1.07,.94)}74%{transform:scale(.97,1.04)}100%{transform:scale(1)}}
.fcm-water-shape{display:none!important}.dragging>.fcm-water-shape,.released>.fcm-water-shape{display:block!important;position:absolute!important;z-index:0!important;left:-15px!important;top:-20px!important;right:auto!important;bottom:auto!important;width:84px!important;height:84px!important;padding:0!important;background:transparent!important;border:0!important;pointer-events:none}.fcm-water-shape svg{display:block;width:100%;height:100%}.fcm-water-shape svg *{fill:var(--ac)!important;stroke:var(--s)!important;stroke-width:3px;paint-order:stroke fill}.dragging::before,.released::before{content:none!important}#fcm-chat-balloon.dragging,.fcm-chat-user-balloon.dragging{transform:rotate(var(--drag-angle,0deg)) scale(var(--drag-squash,1),var(--drag-stretch,1))!important;transform-origin:50% 0;background:transparent;border-color:transparent;border-radius:50%;box-shadow:none}#fcm-chat-balloon.released,.fcm-chat-user-balloon.released{transform-origin:50% 0;background:transparent;border-color:transparent;border-radius:50%;box-shadow:none}#fcm-chat-balloon.dragging>.fcm-balloon-icon,.fcm-chat-user-balloon.dragging>.fcm-chat-avatar,#fcm-chat-balloon.released>.fcm-balloon-icon,.fcm-chat-user-balloon.released>.fcm-chat-avatar{z-index:1;transform:translateY(10px);transition:transform .08s linear}#fcm-chat-balloon:not(.dragging):not(.released)>.fcm-balloon-icon,.fcm-chat-user-balloon:not(.dragging):not(.released)>.fcm-chat-avatar{transition:transform .3s cubic-bezier(.2,1.4,.3,1)}
.fcm-chat-header-action:not(:disabled){color:var(--ac);border-color:var(--ac)}.fcm-chat-header-action:not(:disabled):hover{color:var(--tx);background:color-mix(in srgb,var(--ac) 20%,transparent);border-color:var(--ac);box-shadow:0 0 11px color-mix(in srgb,var(--ac) 35%,transparent)}.fcm-chat-header-action:disabled,.fcm-chat-actions button:disabled{opacity:.35;cursor:not-allowed;box-shadow:none}
.fcm-water-shape svg *{paint-order:fill stroke}
@keyframes fcm-water-return{0%{opacity:1;transform:scale(1)}48%{opacity:.88;transform:scale(.94,1.08)}72%{opacity:.42;transform:scale(1.05,.93)}100%{opacity:0;transform:scale(.98)}}@keyframes fcm-shell-return{0%,45%{background-color:transparent;border-color:transparent;box-shadow:none}72%{background-color:color-mix(in srgb,var(--s) 72%,transparent);border-color:color-mix(in srgb,var(--ac) 55%,transparent);box-shadow:0 4px 14px #0005}100%{background-color:var(--s);border-color:var(--ac);border-radius:50%;box-shadow:0 6px 24px #0008}}@keyframes fcm-content-return{0%{transform:translateY(10px) rotate(var(--release-angle,0deg))}38%{transform:translateY(-3px) rotate(-3deg)}68%{transform:translateY(2px) rotate(1deg)}100%{transform:translateY(0) rotate(0)}}#fcm-chat-balloon.released,.fcm-chat-user-balloon.released{animation:fcm-balloon-release .52s cubic-bezier(.2,.8,.2,1) both,fcm-shell-return .52s ease-out both}.released>.fcm-water-shape{animation:fcm-water-return .52s ease-out both}#fcm-chat-balloon.released>.fcm-balloon-icon,.fcm-chat-user-balloon.released>.fcm-chat-avatar{animation:fcm-content-return .52s cubic-bezier(.2,.85,.25,1.25) both}
#fcm-chat-panel{font-family:var(--chat-font-family)}.fcm-chat-content,.fcm-chat-compose textarea{font-family:var(--chat-font-family);font-size:var(--chat-font-size)}
.fcm-chat-profile{--profile-label-width:90px}.fcm-chat-profile :is(.fcm-chat-profile-line>span,.fcm-chat-profile-line>b,.fcm-chat-profile-field>span,.fcm-profile-statuses button){font-size:13px!important}.fcm-chat-profile-field,.fcm-chat-profile label.fcm-chat-profile-field{margin-left:132px;grid-template-columns:var(--profile-label-width) minmax(0,1fr);max-width:548px!important}.fcm-profile-nickname-display{display:flex;align-items:center;gap:7px;min-width:0}.fcm-profile-nickname-display>b{font-size:13px}.fcm-profile-edit{width:24px;height:24px;padding:3px;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;border-color:transparent}.fcm-profile-edit svg{width:16px;height:16px}.fcm-profile-edit:hover{border-color:var(--ac);background:color-mix(in srgb,var(--ac) 14%,transparent)}.fcm-profile-auto-replies{grid-template-columns:1fr;gap:10px}.fcm-chat-profile .fcm-profile-auto-replies>label{grid-template-columns:1fr auto}.fcm-profile-auto-replies label>b{font-size:13px!important}.fcm-layout-merge svg{transform:scaleX(-1)}.fcm-chat-room-join{display:block;margin-top:8px;padding:5px 12px;background:transparent;color:var(--ac);border:1px solid var(--ac);border-radius:7px}.fcm-chat-room-join:hover{background:color-mix(in srgb,var(--ac) 14%,transparent);box-shadow:0 0 9px color-mix(in srgb,var(--ac) 24%,transparent)}
#fcm-chat-panel .fcm-chat-profile{--profile-label-width:110px;font-family:inherit!important;font-size:12pt!important;line-height:1.35!important;font-stretch:normal!important;text-size-adjust:100%;-webkit-text-size-adjust:100%}#fcm-chat-panel .fcm-chat-profile :is(span,b,button,input,textarea,label){font-family:inherit!important;font-size:inherit!important;line-height:inherit!important;font-stretch:inherit!important}#fcm-chat-panel .fcm-chat-profile-line{grid-template-columns:110px minmax(0,1fr) auto!important;min-height:40px!important;overflow:visible!important}#fcm-chat-panel .fcm-chat-profile-line>b,#fcm-chat-panel .fcm-profile-nickname-display>b{color:var(--tx)!important}#fcm-chat-panel .fcm-profile-nickname-display{min-height:32px;color:var(--tx);overflow:visible}#fcm-chat-panel .fcm-chat-profile-field>span{padding-top:0!important}#fcm-chat-panel .fcm-profile-url-label{display:flex;align-items:center;gap:5px}#fcm-chat-panel .fcm-profile-help-wrap{position:relative;display:inline-flex}#fcm-chat-panel .fcm-profile-help{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;padding:0;border:1px solid var(--ac);border-radius:50%;background:transparent;color:var(--ac);line-height:1!important;cursor:help}#fcm-chat-panel .fcm-profile-help-popup{position:absolute;left:30px;top:50%;z-index:1200;width:max-content;max-width:min(440px,55vw);padding:8px 10px;transform:translateY(-50%);visibility:hidden;opacity:0;pointer-events:none;background:var(--surface-alt);color:var(--tx);border:1px solid var(--ac);border-radius:8px;box-shadow:0 6px 20px #0009;font-size:inherit!important;line-height:1.35!important;transition:opacity .06s linear}#fcm-chat-panel .fcm-profile-help-wrap:hover .fcm-profile-help-popup,#fcm-chat-panel .fcm-profile-help:focus-visible+.fcm-profile-help-popup{visibility:visible;opacity:1}
#fcm-chat-panel[data-layout-mode="split"] [data-layout]>svg{transform:scaleX(-1)}
@media(max-width:650px){#fcm-chat-panel{width:96vw}.fcm-chat-body{grid-template-columns:48px 210px minmax(0,1fr)}}
`;
    document.head.appendChild(style);
}

export { initChat, openChat, closeChat, refreshChatSettings, handleIncomingBeep, handleIncomingWhisper, handleOutgoingServerSend, handleOnlineFriendsUpdate, playNotificationSound, saveCustomNotificationSound };

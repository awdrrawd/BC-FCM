import { cleanMessage } from '../services/chat-content.js';

function conversationRows(messages, friendRows, selfMemberNumber) {
    const rows = new Map();
    const self = Number(selfMemberNumber);
    for (const message of messages) {
        const memberNumber = Number(message.memberNumber);
        if (!memberNumber || memberNumber === self) continue;
        const current = rows.get(memberNumber);
        if (!current || current.timestamp < message.timestamp) rows.set(memberNumber, { ...message, memberNumber, unread: current?.unread || 0 });
        if (message.direction === 'in' && !message.read) rows.get(memberNumber).unread++;
    }
    for (const friend of friendRows) {
        const memberNumber = Number(friend.mn);
        if (!memberNumber || memberNumber === self || rows.has(memberNumber)) continue;
        rows.set(memberNumber, { memberNumber, content: '', timestamp: 0, unread: 0 });
    }
    return [...rows.values()].sort((a, b) => b.timestamp - a.timestamp);
}

function unreadMessageCount(messages, memberNumber = null) {
    const target = memberNumber == null ? null : Number(memberNumber);
    return messages.filter(message => message.direction === 'in' && !message.read && (target === null || Number(message.memberNumber) === target)).length;
}

function recentConversationRows(rows, limit = 30) {
    return rows.filter(row => row.timestamp).slice(0, limit);
}

function historyMessageRows(messages, selfMemberNumber, limit = 100) {
    const self = Number(selfMemberNumber);
    return messages.filter(message => Number(message.memberNumber) !== self).sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}

function normalizeConversationPage(messages) {
    return messages.map(message => ({ ...message, content: cleanMessage(message.content) }));
}

function mergeOlderMessages(current, older) {
    const existing = new Set(current.map(message => String(message.id)));
    return [...older.filter(message => !existing.has(String(message.id))), ...current];
}

export { conversationRows, historyMessageRows, mergeOlderMessages, normalizeConversationPage, recentConversationRows, unreadMessageCount };

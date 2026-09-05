import { profileMentionIds } from './chat-private-payload.js';

function createOfflineDeliveryService({ offlineQueue, chatStore, isFriend, sendBeep, runWithoutOutgoingCapture, onDelivered, onError, interval = 350 }) {
    const inFlight = new Set();

    async function deliver(row, owner) {
        try {
            if (offlineQueue.key() !== owner || !isFriend(row.memberNumber) || !offlineQueue.all().some(item => item.id === row.id)) return;
            const delivered = runWithoutOutgoingCapture(() => sendBeep({ MemberNumber: row.memberNumber, BeepType: '', Message: row.content }));
            if (!delivered) return;
            offlineQueue.remove([row.id]);
            const stored = (await chatStore.all()).find(message => message.queueId === row.id);
            if (stored) await chatStore.put({ ...stored, queued: false, deliveredAt: Date.now() });
            await onDelivered(stored);
        } catch (error) {
            onError(error, row);
        } finally {
            inFlight.delete(row.id);
        }
    }

    function dispatch(onlineRows) {
        const owner = offlineQueue.key();
        if (!owner) return 0;
        const online = new Set(onlineRows.map(row => Number(row.MemberNumber)).filter(Boolean));
        const ready = offlineQueue.all().filter(row => !row.payload?.profiles?.length && !profileMentionIds(row.content).length && isFriend(row.memberNumber) && online.has(Number(row.memberNumber)) && !inFlight.has(row.id));
        ready.forEach(row => inFlight.add(row.id));
        ready.forEach((row, index) => setTimeout(() => deliver(row, owner), index * interval));
        return ready.length;
    }

    return { dispatch };
}

export { createOfflineDeliveryService };

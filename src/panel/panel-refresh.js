export function panelSnapshot(tab, { room, characters = [], friends = [], online = [], inRoom = () => false }) {
    if (tab === 'friends') {
        const present = new Set(online.map(row => Number(row.MemberNumber)));
        return JSON.stringify(friends.map(row => [row.mn, inRoom(row.mn) || present.has(Number(row.mn))]).sort((a, b) => a[0] - b[0]));
    }
    if (tab !== 'room') return '';
    if (!room) return 'no-room';
    return JSON.stringify([room.Name, room.Description, room.Background, room.Admin, room.Whitelist, room.Ban,
        room.Limit, room.Private, room.Locked, room.Language, room.Space, room.Game, room.BlockCategory,
        room.Access, room.Visibility, room.MapType, characters.map(c => [c.MemberNumber, c.Name, c.Nickname])]);
}

export function createPanelRefresh({ getView, snapshot, render, update, schedule = setTimeout, cancel = clearTimeout }) {
    let timer = null, rendered = '';
    function dispose() { cancel(timer); timer = null; }
    function capture() { dispose(); rendered = snapshot(); }
    function notify(kind) {
        const { tab, visible } = getView();
        if (!visible) return;
        const relevant = kind === 'relations' ? ['friends', 'room'].includes(tab)
            : kind === 'presence' ? tab === 'friends' : kind === 'room' && tab === 'room';
        if (!relevant || (kind !== 'relations' && snapshot() === rendered)) return;
        if (kind === 'room' && update()) { capture(); return; }
        dispose();
        timer = schedule(() => { timer = null; const current = getView(); if (current.visible && current.tab === tab) render(); }, 60);
    }
    return { capture, notify, dispose };
}

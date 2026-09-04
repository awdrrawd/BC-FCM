function matchesContactSearch(memberNumber, query, displayName, biography) {
    if (!query) return true;
    return `${displayName(memberNumber)} ${biography(memberNumber)}`.toLowerCase().includes(query.trim().toLowerCase());
}

function filterNotificationRows(rows, query, { displayName, biography, cleanMessage }) {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter(row => `${displayName(row.memberNumber)} ${row.memberNumber} ${biography(row.memberNumber)} ${cleanMessage(row.content)}`.toLowerCase().includes(normalized));
}

function filterContactRows(rows, filters, helpers) {
    return rows.filter(row => {
        const memberNumber = Number(row.memberNumber);
        if (filters.presence === 'online' ? !helpers.isOnline(memberNumber) : helpers.isOnline(memberNumber)) return false;
        if (filters.relation === 'follow' && !helpers.isFavorite(memberNumber)) return false;
        if (filters.relation && filters.relation !== 'follow') {
            const roles = helpers.getRelations(memberNumber);
            const matches = filters.relation === 'owner'
                ? roles.some(role => role === 'owner' || role === 'lover')
                : roles.includes(filters.relation);
            if (!matches) return false;
        }
        return matchesContactSearch(memberNumber, filters.search, helpers.displayName, helpers.biography);
    });
}

function buildGroupDefinitions({ roomCharacters, selfMemberNumber, friendRows, isFavorite, groups, memberGroups, text }) {
    const self = Number(selfMemberNumber);
    const roomMembers = (roomCharacters || []).map(character => Number(character.MemberNumber)).filter(memberNumber => memberNumber && memberNumber !== self);
    const contacts = friendRows.map(friend => Number(friend.mn)).filter(Boolean);
    const manual = Object.entries(groups || {}).map(([id, label]) => ({
        id,
        label,
        members: Object.entries(memberGroups || {}).filter(([, assigned]) => Array.isArray(assigned) && assigned.includes(id)).map(([memberNumber]) => Number(memberNumber)),
    }));
    return {
        room: { id: 'room', label: text('chatRoom'), members: roomMembers },
        groups: [
            { id: 'favorites', label: text('chatFavorites'), members: contacts.filter(isFavorite) },
            { id: 'contacts', label: text('chatAllContacts'), members: contacts },
            ...manual,
        ],
    };
}

function selectedGroupDefinition(definitions, mode, selectedId) {
    return mode === 'room' ? definitions.room : definitions.groups.find(group => group.id === selectedId) || definitions.groups[0];
}

function filterGroupRows(group, query, displayName, biography) {
    return (group?.members || [])
        .filter(memberNumber => matchesContactSearch(memberNumber, query, displayName, biography))
        .map(memberNumber => ({ memberNumber, timestamp: 0, unread: 0 }));
}

export { buildGroupDefinitions, filterContactRows, filterGroupRows, filterNotificationRows, selectedGroupDefinition };

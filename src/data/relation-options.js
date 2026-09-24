export const relationStyles = ['solid', 'dashed', 'chain', 'none', 'rope', 'dotted'];
const defaults = {
    master: { color: '#ffb347', style: 'chain' },
    sub: { color: '#6ac9ff', style: 'rope' },
    lover: { color: '#ff69b4', style: 'solid' },
    social: { color: '#62cf85', style: 'dashed' },
};
export function relationOptions(value = {}) {
    value ??= {};
    const result = {
        depth: Number.isSafeInteger(value.depth) && value.depth > 0 ? Math.min(10, value.depth) : 2,
        showNames: value.showNames !== false,
        width: Number.isFinite(value.width) && value.width >= 1 && value.width <= 6 ? value.width : 2,
        warnLarge: value.warnLarge !== false,
    };
    for (const [role, fallback] of Object.entries(defaults)) result[role] = {
        color: /^#[\da-f]{6}$/i.test(value[role]?.color) ? value[role].color : fallback.color,
        style: relationStyles.includes(value[role]?.style) ? value[role].style : fallback.style,
    };
    return result;
}

export function ownSocialRelations(player) {
    const ids = values => [...new Set(Array.from(values || []).map(Number).filter(id => Number.isSafeInteger(id) && id > 0))];
    return { id: player?.MemberNumber,
        friend: ids([...(player?.FriendList || []), ...(player?.FriendNames?.keys?.() || [])]),
        whitelist: ids(player?.WhiteList) };
}

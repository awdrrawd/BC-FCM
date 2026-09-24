export const panelTabs = [['friends', 'tabFriends'], ['room', 'tabRoom'], ['roomSearch', 'tabRoomSearch'],
    ['people', 'tabPeople'], ['relations', 'tabRelations'], ['settings', 'tabSettings'], ['help', 'tabHelp']];
export function tabPreferences(value = {}) {
    const keys = panelTabs.map(([key]) => key);
    return {
        order: [...new Set([...(Array.isArray(value?.order) ? value.order : []), ...keys])].filter(key => keys.includes(key)),
        hidden: [...new Set(Array.isArray(value?.hidden) ? value.hidden : [])].filter(key => keys.includes(key)),
    };
}

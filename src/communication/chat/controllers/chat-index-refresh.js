function createChatIndexRefresh({ store, getOwner, setIndex, refreshList, refreshBadges }) {
    let generation = 0;
    async function refresh() {
        const request = ++generation;
        const owner = Number(getOwner());
        if (!owner) return false;
        const rows = await store.recentIndex();
        if (request !== generation || Number(getOwner()) !== owner || !Array.isArray(rows)) return false;
        setIndex(rows);
        refreshList();
        refreshBadges();
        return true;
    }
    return { refresh };
}

export { createChatIndexRefresh };

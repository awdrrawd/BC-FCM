// Self-contained so the same model can run inside a worker and in unit tests.
export function createRelationIndex() {
    const members = new Map(), edges = new Map(), adjacency = new Map();
    let invalid = 0;
    const validId = id => Number.isSafeInteger(Number(id)) && Number(id) > 0;
    function add(row) {
        if (!validId(row?.memberNumber)) { invalid++; return; }
        const id = Number(row.memberNumber);
        try {
            const bundle = row.characterBundle ? JSON.parse(row.characterBundle) : {};
            if (bundle.MemberNumber != null && Number(bundle.MemberNumber) !== id) { invalid++; return; }
            const seen = Number(row.seen || row.savedAt) || 0;
            if (members.has(id) && members.get(id).seen >= seen) return;
            members.set(id, { id, name: String(row.lastNick || bundle.Nickname || row.name || bundle.Name || id),
                search: `${id} ${row.name || ''} ${row.lastNick || ''} ${bundle.Nickname || ''}`.toLowerCase(),
                seen, owner: bundle.Ownership?.MemberNumber,
                lovers: Array.isArray(bundle.Lovership) ? bundle.Lovership.map(lover => lover?.MemberNumber) : [] });
        } catch { invalid++; }
    }
    function finish(social = {}) {
        edges.clear(); adjacency.clear();
        const connect = (source, target, type) => {
            if (!validId(target) || Number(target) === source) return;
            target = Number(target);
            const from = type === 'owner' ? target : Math.min(source, target);
            const to = type === 'owner' ? source : Math.max(source, target);
            const key = `${type}:${from}:${to}`;
            if (!edges.has(key)) edges.set(key, { id: key, from, to, type });
        };
        for (const member of members.values()) {
            connect(member.id, member.owner, 'owner');
            for (const lover of member.lovers) connect(member.id, lover, 'lover');
        }
        if (validId(social.id)) for (const type of ['friend', 'whitelist']) {
            for (const target of social[type] || []) connect(Number(social.id), target, type);
        }
        for (const edge of edges.values()) for (const id of [edge.from, edge.to]) {
            if (!adjacency.has(id)) adjacency.set(id, []);
            adjacency.get(id).push(edge);
        }
        return { profiles: members.size, edges: edges.size, invalid };
    }
    function node(id) {
        const member = members.get(id);
        return { id, name: member?.name || `#${id}`, seen: member?.seen || 0, missing: !member };
    }
    function search(query) {
        query = String(query).trim().toLowerCase();
        if (!query) return [];
        const found = [];
        if (validId(query) && (members.has(Number(query)) || adjacency.has(Number(query)))) found.push(node(Number(query)));
        for (const member of members.values()) {
            if (member.id !== Number(query) && member.search.includes(query)) found.push(node(member.id));
            if (found.length >= 30) break;
        }
        return found;
    }
    function graph({ id, depth = 2, owner = true, master = owner, sub = owner, lover = true, friend = false, whitelist = false }) {
        id = Number(id);
        if (!members.has(id) && !adjacency.has(id)) return { nodes: [], edges: [] };
        const levels = new Map([[id, 0]]), queue = [id];
        depth = Number.isSafeInteger(Number(depth)) && Number(depth) > 0 ? Number(depth) : 2;
        const enabled = { owner, lover, friend, whitelist };
        const allowed = (edge, current) => edge.type === 'owner'
            ? (edge.to === current ? master : sub) : enabled[edge.type];
        for (let i = 0; i < queue.length; i++) {
            const current = queue[i], level = levels.get(current);
            if (level >= depth) continue;
            for (const edge of adjacency.get(current) || []) {
                if (!allowed(edge, current)) continue;
                const other = edge.from === current ? edge.to : edge.from;
                if (levels.has(other)) continue;
                levels.set(other, level + 1); queue.push(other);
            }
        }
        const visibleEdges = new Map();
        for (const current of queue) for (const edge of adjacency.get(current) || []) {
            if (!allowed(edge, current) || !levels.has(edge.from) || !levels.has(edge.to) || visibleEdges.has(edge.id)) continue;
            visibleEdges.set(edge.id, edge);
        }
        return { nodes: queue.map(id => ({ ...node(id), level: levels.get(id) })), edges: [...visibleEdges.values()] };
    }
    return { add, finish, search, graph };
}

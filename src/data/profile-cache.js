// Shared in-memory profile cache. Kept separate so data helpers and IndexedDB
// storage do not import each other and create an initialization cycle.
const profileCache = Object.create(null);

export { profileCache };

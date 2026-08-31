const warningState = new Map();
const DEFAULT_INTERVAL = 10_000;

function warningMessage(error) {
    if (error instanceof Error) return error.stack || error.message;
    return String(error ?? 'unknown error');
}

function warnLimited(scope, error, interval = DEFAULT_INTERVAL) {
    const key = String(scope || 'unknown');
    const now = Date.now();
    const previous = warningState.get(key);
    if (previous && now - previous.time < interval) {
        previous.suppressed++;
        return;
    }
    const suppressed = previous?.suppressed || 0;
    warningState.set(key, { time: now, suppressed: 0 });
    console.warn(`🐈‍⬛ [FCM] ${key}${suppressed ? ` (${suppressed} repeated warnings suppressed)` : ''}:`, warningMessage(error));
}

export { warnLimited };

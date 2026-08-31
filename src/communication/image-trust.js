const trustedImageOrigins = new Set();

function normalizedImageOrigin(value) {
    try {
        const url = value instanceof URL ? value : new URL(value);
        return ['http:', 'https:'].includes(url.protocol) ? url.origin : null;
    } catch { return null; }
}

function lceAlwaysTrusts(origin) {
    try {
        const api = window.Liko?.LCE?.TrustedImageOrigins;
        return typeof api?.isPermanentlyTrusted === 'function' && !!api.isPermanentlyTrusted(origin);
    } catch { return false; }
}

function imageOriginTrusted(value) {
    const origin = normalizedImageOrigin(value);
    return !!origin && (trustedImageOrigins.has(origin) || lceAlwaysTrusts(origin));
}

function trustImageOrigin(value) {
    const origin = normalizedImageOrigin(value);
    if (!origin) return false;
    trustedImageOrigins.add(origin);
    return true;
}

export { imageOriginTrusted, normalizedImageOrigin, trustImageOrigin };

const SUPPORTED_AVATAR_HOSTS = ['github.io', 'gitlab.io', 'ibb.co', 'imgbb.com', 'imgchest.com', 'imgur.com', 'postimg.cc', 'hd-r.icu'];

function isSupportedAvatarUrl(value) {
    if (!value) return true;
    try {
        const url = new URL(value);
        const host = url.hostname.toLowerCase();
        return ['http:', 'https:'].includes(url.protocol)
            && SUPPORTED_AVATAR_HOSTS.some(domain => host === domain || host.endsWith(`.${domain}`));
    } catch { return false; }
}

export { isSupportedAvatarUrl };

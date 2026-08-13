// Keep this bootstrap free of static imports so the duplicate guard runs
// before ModSDK registration or any other FCM module side effect.
window.Liko = window.Liko ?? {};

if (window.Liko.FCM) {
    console.warn('[FCM] Already loaded, skipping duplicate import.');
} else {
    const fcmNamespace = window.Liko.FCM = {};

    import('./app.js').catch((error) => {
        // A successful ModSDK registration writes the version in config.js.
        // Only release the namespace if loading failed before that point.
        if (window.Liko.FCM === fcmNamespace && !fcmNamespace.version) {
            delete window.Liko.FCM;
        }
        console.error('[FCM] Failed to load:', error);
    });
}

// Keep this bootstrap free of static imports so duplicate detection runs first.
window.Liko = window.Liko ?? {};

if (window.Liko.FCM) {
    console.warn('🐈‍⬛ [FCM] Already loaded, skipping duplicate init.');
} else {
    const namespace = window.Liko.FCM = {};
    import('./app.js').catch(error => {
        if (window.Liko.FCM === namespace && !namespace.version) delete window.Liko.FCM;
        console.error('🐈‍⬛ [FCM] Failed to load:', error);
    });
}

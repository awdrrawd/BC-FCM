import { T } from '../i18n/i18n.js';

function showProfileImportProgress() {
    document.querySelector('#fcm-profile-import-progress[aria-busy="false"]')?.remove();
    const panel = document.createElement('div');
    panel.id = 'fcm-profile-import-progress';
    panel.setAttribute('role', 'status');
    panel.setAttribute('aria-live', 'polite');
    panel.setAttribute('aria-busy', 'true');
    panel.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:2147483647;max-width:min(420px,90vw);padding:16px;background:#191326;color:#eee;border:1px solid #a078e8;border-radius:10px;box-shadow:0 4px 20px #0008;font:14px sans-serif;user-select:none;-webkit-user-select:none;';
    const duration = globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180;
    const label = document.createElement('div');
    const progress = document.createElement('progress');
    progress.style.cssText = 'display:block;width:100%;margin-top:10px;accent-color:#a078e8;';
    panel.append(label, progress);
    document.body.append(panel);
    panel.animate([
        { opacity: 0, transform: 'translateY(12px)' },
        { opacity: 1, transform: 'translateY(0)' },
    ], { duration, easing: 'ease-out' });
    return {
        update({ phase, processed, total }) {
            label.textContent = phase === 'merging' ? T('importProgress', processed, total)
                : T(phase === 'parsing' ? 'importParsing' : 'importReading');
            if (phase === 'merging' && total > 0) { progress.max = total; progress.value = processed; }
            else progress.removeAttribute('value');
        },
        finish(message) {
            panel.setAttribute('aria-busy', 'false');
            label.textContent = message;
            progress.remove();
            setTimeout(() => {
                panel.animate([
                    { opacity: 1, transform: 'translateY(0)' },
                    { opacity: 0, transform: 'translateY(12px)' },
                ], { duration, easing: 'ease-in', fill: 'forwards' });
                setTimeout(() => panel.remove(), duration);
            }, 3000);
        },
    };
}

export { showProfileImportProgress };

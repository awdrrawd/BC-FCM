import { cfg } from '../core/config.js';
import { _getWhisperTargetMN, getDisplayName, inRoomFn } from '../data/data.js';
import { Snapshot } from '../data/profile-db.js';
import { T } from '../i18n/i18n.js';
// ════════════════════════════════════════
//  FCM module: chat-fx.js
//  (split from Plugins/liko-FCM.user.js)
// ════════════════════════════════════════

    let _wavLastMN = null;        // last rendered MN
    let _wavImageCache = null;    // offscreen Image/canvas to blit
    let _wavImageMN   = null;

    function _removeWhisperAvatar() {
        _wavLastMN = null;
        _wavImageCache = null;
        _wavImageMN   = null;
    }

    // Build an offscreen 80×80 px image from live canvas / snapshot / initials
    async function _buildWavImage(mn) {
        mn = parseInt(mn);
        const SZ = 80;

        // 1. Live canvas face crop
        const C = ChatRoomCharacter && ChatRoomCharacter.find(c => c.MemberNumber === mn);
        if (C && C.Canvas && C.Canvas.width > 0) {
            try {
                const cv = document.createElement('canvas'); cv.width = cv.height = SZ;
                const ctx = cv.getContext('2d'), src = C.Canvas;
                const cropSize = 210;
                ctx.drawImage(src, src.width / 2 - cropSize / 2, 740, cropSize, cropSize, 0, 0, SZ, SZ);
                return cv;
            } catch {}
        }

        // 2. Snapshot DB
        const snap = Snapshot._cache[mn] || await Snapshot.get(mn);
        if (snap && snap.length > 800) {
            return new Promise(res => {
                const img = new Image(); img.onload = () => res(img); img.onerror = () => res(null); img.src = snap;
            });
        }

        // 3. Initials fallback — draw onto offscreen canvas
        const cv = document.createElement('canvas'); cv.width = cv.height = SZ;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = '#201838'; ctx.fillRect(0, 0, SZ, SZ);
        ctx.strokeStyle = '#7060a0'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, SZ-2, SZ-2);
        const name = getDisplayName(mn);
        ctx.fillStyle = '#a080c8'; ctx.font = 'bold 28px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(name.trim().slice(0, 2).toUpperCase() || '?', SZ/2, SZ/2);
        return cv;
    }

    // Draw whisper avatar onto BC's main canvas.
    // BC canvas is 2000×1000 in logical units; the <canvas> element is scaled by CSS.
    // We place the box just to the left of the InputChat area, bottom of screen.
    // Logical position: x = 1000 - BOX_W - margin, y = 1000 - BOX_H - margin
    function _drawWavOnCanvas() {
        if (!cfg.whisperAvatar || !_wavImageCache) return;
        try {
            // Get BC's main canvas element
            const cvEl = document.getElementById('MainCanvas') || document.querySelector('canvas');
            if (!cvEl) return;
            const ctx = cvEl.getContext('2d');
            if (!ctx) return;

            // BC logical → pixel scale
            const scaleX = cvEl.width  / 2000;
            const scaleY = cvEl.height / 1000;

            const BOX  = 80;  // logical units
            const MRGN = 10;
            // Place bottom-left of viewport (to the left of InputChat which is roughly x=1000..2000 bottom area)
            const lx = 1000 - BOX - MRGN;
            const ly = 1000 - BOX - MRGN;
            const px = lx * scaleX;
            const py = ly * scaleY;
            const pw = BOX * scaleX;
            const ph = BOX * scaleY;

            ctx.save();

            // Background
            ctx.fillStyle = 'rgba(20,10,40,0.88)';
            const r = 8 * Math.min(scaleX, scaleY);
            _roundRect(ctx, px - 4*scaleX, py - 20*scaleY, pw + 8*scaleX, ph + 24*scaleY, r);
            ctx.fill();

            // Border
            ctx.strokeStyle = '#7060c0';
            ctx.lineWidth = 1.5;
            _roundRect(ctx, px - 4*scaleX, py - 20*scaleY, pw + 8*scaleX, ph + 24*scaleY, r);
            ctx.stroke();

            // Whether the whisper target has left the room (covers all three
            // detection paths: clicked name, /w, /whisper, /beep — they all
            // resolve to the same _wavLastMN, so a single inRoomFn check here
            // is enough to cover every case).
            const offline = !inRoomFn(_wavLastMN);

            // Avatar image — grayscale it out when the target isn't in the room
            if (offline) ctx.filter = 'grayscale(100%) brightness(0.55)';
            ctx.drawImage(_wavImageCache, px, py, pw, ph);
            if (offline) ctx.filter = 'none';

            if (offline) {
                // Dim overlay + "No signal" label on top of the avatar
                ctx.fillStyle = 'rgba(0,0,0,0.45)';
                ctx.fillRect(px, py, pw, ph);
                const nsFontSize = Math.max(9, Math.round(9 * Math.min(scaleX, scaleY) * 2));
                ctx.fillStyle = '#c0c0c0';
                ctx.font = `bold ${nsFontSize}px sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(T('whisperNoSignal'), px + pw / 2, py + ph / 2);
            }

            // Name label
            const name = getDisplayName(_wavLastMN);
            const fontSize = Math.max(10, Math.round(11 * Math.min(scaleX, scaleY) * 2));
            ctx.fillStyle = offline ? '#888888' : '#d0a8f0';
            ctx.font = `bold ${fontSize}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const labelX = px + pw / 2;
            const labelY = py - 11 * scaleY;
            ctx.fillText(name.length > 10 ? name.slice(0, 9) + '…' : name, labelX, labelY);

            ctx.restore();
        } catch { /* silent */ }
    }

    function _roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    function _updateWhisperAvatar() {
        if (!cfg.whisperAvatar) { _removeWhisperAvatar(); return; }
        const mn = _getWhisperTargetMN();
        if (!mn) { _removeWhisperAvatar(); return; }
        if (_wavLastMN === mn) return; // same target, image still valid
        _wavLastMN = mn;
        _wavImageCache = null;
        _wavImageMN = mn;
        _buildWavImage(mn).then(img => {
            if (_wavImageMN === mn) _wavImageCache = img; // only store if still same target
        });
    }
    function _isWhisperMode() {
        try {
            if (typeof ChatRoomTargetMemberNumber !== 'undefined' && ChatRoomTargetMemberNumber > 0) return true;
            const el = document.getElementById('InputChat');
            if (el && /^\/(w|whisper|beep)\s/i.test(el.value)) return true;
        } catch {}
        return false;
    }

    function _flashOocBlocked() {
        const el = document.getElementById('InputChat');
        if (!el) return;
        el.classList.remove('fcm-ooc-blocked');
        void el.offsetWidth; // force reflow to restart animation
        el.classList.add('fcm-ooc-blocked');
        setTimeout(() => el.classList.remove('fcm-ooc-blocked'), 1000);
    }

    const _oocKeyHandler = (e) => {
        if (!cfg.oocProtect) return;
        if (e.key === 'Enter' && e.ctrlKey) {
            if (_isWhisperMode()) {
                e.preventDefault();
                e.stopImmediatePropagation();
                _flashOocBlocked();
            }
        }
    };

    function _installOocProtect() {
        document.removeEventListener('keydown', _oocKeyHandler, true);
        document.addEventListener('keydown', _oocKeyHandler, true);
    }
    function _uninstallOocProtect() {
        document.removeEventListener('keydown', _oocKeyHandler, true);
    }
    function _applyWhisperStyle() {
        try {
            const el = document.getElementById('InputChat'); if (!el) return;
            const val = el.value || '';
            const isCmd = /^\/(w|whisper|beep)\s/i.test(val);
            const isTgt = typeof ChatRoomTargetMemberNumber !== 'undefined' && ChatRoomTargetMemberNumber > 0;
            const wc = cfg.whisperColor || '#b070e8';
            if (cfg.whisperIndicator && (isCmd || isTgt)) {
                el.style.setProperty('box-shadow', `0 0 0 3px ${wc}cc, 0 0 14px ${wc}88`, 'important');
                el.style.setProperty('border', `2px solid ${wc}`, 'important');
                el.style.setProperty('outline', `1px solid ${wc}66`, 'important');
            } else {
                el.style.removeProperty('box-shadow'); el.style.removeProperty('border'); el.style.removeProperty('outline');
            }
        } catch {}
    }
export { _removeWhisperAvatar, _updateWhisperAvatar, _drawWavOnCanvas, _applyWhisperStyle, _installOocProtect, _uninstallOocProtect };

import { cfg, saveCfg } from '../../../core/config.js';

const SELECTOR = '#fcm-chat-balloon,.fcm-chat-user-balloon';
const GAP = 8;
const SNAP_MS = 220;
const snapFrames = new WeakMap();

function resetBalloonInteraction(el) {
    cancelSnap(el);
    stopJelly(el);
    el?.classList.remove('dragging', 'released', 'release-water', 'collision-pushed', 'notify');
    ['--drag-angle', '--drag-stretch', '--drag-squash'].forEach(name => el?.style.removeProperty(name));
}

function updateBalloonPreviewSide(el, left = null) {
    if (!el?.matches?.(SELECTOR)) return;
    el.classList.toggle('preview-right', (left ?? el.getBoundingClientRect().left) < innerWidth * .25);
}

function visibleBalloons() {
    return [...document.querySelectorAll(SELECTOR)].filter(el => getComputedStyle(el).display !== 'none');
}

function createBodies() {
    return visibleBalloons().map(element => ({
        element, x: element.offsetLeft, y: element.offsetTop,
        width: element.offsetWidth, height: element.offsetHeight, moved: false,
    }));
}

function moveBody(body, dx, dy) {
    const oldX = body.x, oldY = body.y;
    body.x = Math.max(0, Math.min(innerWidth - body.width, body.x + dx));
    body.y = Math.max(0, Math.min(innerHeight - body.height, body.y + dy));
    const actual = { x: body.x - oldX, y: body.y - oldY };
    if (Math.abs(actual.x) > .05 || Math.abs(actual.y) > .05) body.moved = true;
    return actual;
}

function pushBody(body, dx, dy) {
    const actual = moveBody(body, dx, dy);
    const requested = Math.hypot(dx, dy);
    const achieved = requested ? Math.abs((actual.x * dx + actual.y * dy) / requested) : 0;
    const remainder = requested - achieved;
    if (remainder < .1) return;
    // When the direct route is blocked by a viewport edge, slide tangentially.
    if (Math.abs(dx) >= Math.abs(dy)) {
        const down = innerHeight - body.y - body.height;
        moveBody(body, 0, (down >= body.y ? 1 : -1) * remainder);
    } else {
        const right = innerWidth - body.x - body.width;
        moveBody(body, (right >= body.x ? 1 : -1) * remainder, 0);
    }
}

function separateBodies(bodies, fixed = null, direction = { x: 1, y: 0 }) {
    const pushed = new Set();
    for (let pass = 0; pass < Math.max(8, bodies.length * 7); pass++) {
        let overlaps = 0;
        for (let a = 0; a < bodies.length; a++) for (let b = a + 1; b < bodies.length; b++) {
            const first = bodies[a], second = bodies[b];
            let dx = second.x + second.width / 2 - first.x - first.width / 2;
            let dy = second.y + second.height / 2 - first.y - first.height / 2;
            let distance = Math.hypot(dx, dy);
            const minimum = (Math.max(first.width, first.height) + Math.max(second.width, second.height)) / 2 + GAP;
            if (distance >= minimum - .1) continue;
            overlaps++;
            if (distance < .01) {
                dx = direction.x || (b % 2 ? 1 : -1);
                dy = direction.y || (b % 3 ? 0 : 1);
                distance = Math.hypot(dx, dy) || 1;
            }
            const ux = dx / distance, uy = dy / distance;
            const overlap = minimum - distance + .15;
            const firstFixed = first.element === fixed, secondFixed = second.element === fixed;
            if (!firstFixed) {
                pushBody(first, -ux * overlap * (secondFixed ? 1 : .5), -uy * overlap * (secondFixed ? 1 : .5));
                pushed.add(first.element);
            }
            if (!secondFixed) {
                pushBody(second, ux * overlap * (firstFixed ? 1 : .5), uy * overlap * (firstFixed ? 1 : .5));
                pushed.add(second.element);
            }
        }
        if (!overlaps) break;
    }
    return pushed;
}

function applyBodies(bodies) {
    for (const body of bodies) {
        if (!body.moved) continue;
        body.element.style.left = `${body.x}px`;
        body.element.style.top = `${body.y}px`;
        body.element.style.right = body.element.style.bottom = 'auto';
        updateBalloonPreviewSide(body.element, body.x);
    }
}

function animatePushed(el) {
    el.classList.remove('collision-pushed');
    void el.offsetWidth;
    el.classList.add('collision-pushed');
    el.addEventListener('animationend', () => el.classList.remove('collision-pushed'), { once: true });
}

function saveBalloonPositions(balloons = visibleBalloons()) {
    for (const balloon of balloons) {
        const position = { x: balloon.offsetLeft, y: balloon.offsetTop };
        if (balloon.id === 'fcm-chat-balloon') cfg.chatBalloonPosition = position;
        else if (balloon.id.startsWith('fcm-chat-user-')) {
            cfg.chatUserBalloonPositions ||= {};
            cfg.chatUserBalloonPositions[balloon.id.slice('fcm-chat-user-'.length)] = position;
        }
    }
    saveCfg();
}

function resolveBalloonCollision(anchor, { persist = true, animate = true, direction = { x: 1, y: 0 } } = {}) {
    if (!anchor?.matches?.(SELECTOR)) return false;
    const bodies = createBodies();
    if (bodies.length < 2) return false;
    const pushed = separateBodies(bodies, anchor, direction);
    applyBodies(bodies);
    if (animate) pushed.forEach(animatePushed);
    if (persist && pushed.size) saveBalloonPositions(bodies.map(body => body.element));
    return pushed.size > 0;
}

function snapTarget(body) {
    const distances = { left: body.x, right: innerWidth - body.x - body.width, top: body.y, bottom: innerHeight - body.y - body.height };
    const edge = Object.entries(distances).sort((a, b) => a[1] - b[1])[0][0];
    const target = { edge, x: body.x, y: body.y };
    if (edge === 'left') target.x = 8;
    else if (edge === 'right') target.x = Math.max(8, innerWidth - body.width - 8);
    else if (edge === 'top') target.y = 8;
    else target.y = Math.max(8, innerHeight - body.height - 8);
    return target;
}

function cancelSnap(el) {
    const frame = snapFrames.get(el);
    if (frame) cancelAnimationFrame(frame);
    snapFrames.delete(el);
}

function animateBalloonSnap(el, done) {
    cancelSnap(el);
    const bodies = createBodies();
    const anchor = bodies.find(body => body.element === el);
    if (!anchor) return;
    const start = { x: anchor.x, y: anchor.y };
    const target = snapTarget(anchor);
    const direction = { x: target.x - start.x, y: target.y - start.y };
    const pushed = new Set();
    let startedAt;
    el.style.setProperty('--water-angle', { bottom: '0deg', top: '180deg', left: '90deg', right: '-90deg' }[target.edge]);
    const frame = now => {
        startedAt ??= now;
        const progress = Math.min(1, (now - startedAt) / SNAP_MS);
        const eased = 1 - Math.pow(1 - progress, 3);
        anchor.x = start.x + direction.x * eased;
        anchor.y = start.y + direction.y * eased;
        anchor.moved = true;
        separateBodies(bodies, el, direction).forEach(balloon => pushed.add(balloon));
        applyBodies(bodies);
        if (progress < 1) return snapFrames.set(el, requestAnimationFrame(frame));
        snapFrames.delete(el);
        pushed.forEach(animatePushed);
        saveBalloonPositions(bodies.map(body => body.element));
        done?.(EDGE_NORMAL[target.edge]);
    };
    snapFrames.set(el, requestAnimationFrame(frame));
}

function playBalloonRelease(el, normal = [0, 1]) {
    el.classList.remove('release-water', 'released');
    jellyLand(el, normal[0], normal[1]);
}

// Jelly deformation. Two damped springs (fixed 1/240s step, frame-rate independent):
//  - drag spring (x,y): body lags behind the pointer -> stretch along motion + drop tilt
//  - landing spring (q):  hitting the edge squashes along the impact axis, then bounces back
// Both keep ringing from their current state after release instead of replaying a keyframe.
const JELLY_STEP = 1 / 240, JELLY_K = 900, JELLY_D = 26, JELLY_LIMIT = 18;
const LAND_K = 700, LAND_D = 15, LAND_LIMIT = .3, LAND_KICK = 9;
const jellies = new WeakMap();
const EDGE_NORMAL = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };

function stopJelly(el) {
    const j = jellies.get(el);
    if (j?.raf) cancelAnimationFrame(j.raf);
    jellies.delete(el);
    el?.classList.remove('jelly');
    el?.style.removeProperty('--jelly');
    el?.style.removeProperty('--water-tilt');
}

function runJelly(el) {
    let j = jellies.get(el);
    if (!j) jellies.set(el, j = { x: 0, y: 0, vx: 0, vy: 0, q: 0, qv: 0, qa: 0, acc: 0, last: 0, raf: 0 });
    if (j.raf) return j;
    el.classList.add('jelly');
    j.last = performance.now();
    const tick = now => {
        j.acc += Math.min(.04, (now - j.last) / 1000); j.last = now;
        while (j.acc >= JELLY_STEP) {
            j.vx += (-JELLY_K * j.x - JELLY_D * j.vx) * JELLY_STEP;
            j.vy += (-JELLY_K * j.y - JELLY_D * j.vy) * JELLY_STEP;
            j.x += j.vx * JELLY_STEP; j.y += j.vy * JELLY_STEP;
            j.qv += (-LAND_K * j.q - LAND_D * j.qv) * JELLY_STEP;
            j.q += j.qv * JELLY_STEP;
            j.acc -= JELLY_STEP;
        }
        const len = Math.hypot(j.x, j.y);
        const soft = JELLY_LIMIT * (1 - Math.exp(-len / JELLY_LIMIT));   // soft cap, never over-deforms
        const s = 1 + soft / 90, a = Math.atan2(j.y, j.x);                // gentle stretch; the drop tilt carries the pull
        const q = LAND_LIMIT * Math.tanh(j.q / LAND_LIMIT), f = Math.exp(-q);
        el.style.setProperty('--jelly',
            `rotate(${a}rad) scale(${s},${1 / s}) rotate(${-a}rad) rotate(${j.qa}rad) scale(${f},${1 / f}) rotate(${-j.qa}rad)`);
        // dragging right -> j.x < 0 -> the drop swings left (and the other way round)
        el.style.setProperty('--water-tilt', `${Math.max(-40, Math.min(40, -j.x * 1.8))}deg`);
        if (len < .05 && Math.hypot(j.vx, j.vy) < .5 && Math.abs(j.q) < .002 && Math.abs(j.qv) < .05) { stopJelly(el); return; }
        j.raf = requestAnimationFrame(tick);
    };
    j.raf = requestAnimationFrame(tick);
    return j;
}

function jellyKick(el, dx, dy) {
    const j = runJelly(el);
    j.vx -= dx * 30; j.vy -= dy * 30;      // the body lags behind the pointer
}

// landing: squash along the impact axis (nx, ny), then bounce
function jellyLand(el, nx, ny) {
    const j = runJelly(el);
    j.qa = Math.atan2(ny, nx); j.qv += LAND_KICK;
}

function installChatDrag(element, handle, { configKey, isMaximized = () => false } = {}) {
    if (!element || !handle || !configKey) return;
    handle.addEventListener('pointerdown', event => {
        if ((event.target.closest('button') && handle !== element) || isMaximized()) return;
        const rect = element.getBoundingClientRect();
        const offsetX = event.clientX - rect.left, offsetY = event.clientY - rect.top;
        const isBalloon = element.matches(SELECTOR);
        const startX = event.clientX, startY = event.clientY;
        let lastX = event.clientX, lastY = event.clientY, moved = false, queued, moveFrame = 0, dir = [0, 1];
        if (isBalloon) { cancelSnap(element); element.classList.remove('released', 'release-water'); }
        handle.setPointerCapture(event.pointerId);

        const renderMove = next => {
            if (isBalloon && !moved) {
                if (Math.hypot(next.clientX - startX, next.clientY - startY) < 6) return;
                moved = true; element.classList.add('dragging');
            } else if (!isBalloon) moved = true;
            const dx = next.clientX - lastX, dy = next.clientY - lastY;
            lastX = next.clientX; lastY = next.clientY;
            if (dx || dy) { const n = Math.hypot(dx, dy); dir = [dx / n, dy / n]; }
            const left = isBalloon ? next.clientX - element.offsetWidth / 2 : next.clientX - offsetX;
            const top = isBalloon ? next.clientY + 20 : next.clientY - offsetY;
            element.style.left = `${Math.max(0, Math.min(innerWidth - element.offsetWidth, left))}px`;
            element.style.top = `${Math.max(0, Math.min(innerHeight - element.offsetHeight, top))}px`;
            element.style.right = element.style.bottom = 'auto';
            if (isBalloon) {
                jellyKick(element, dx, dy);
                resolveBalloonCollision(element, { persist: false, animate: false, direction: { x: dx, y: dy } });
            } else element.style.transform = 'none';
            updateBalloonPreviewSide(element);
        };
        const move = next => {
            queued = next;
            if (!moveFrame) moveFrame = requestAnimationFrame(() => { moveFrame = 0; const latest = queued; queued = null; renderMove(latest); });
        };
        const up = next => {
            handle.removeEventListener('pointermove', move);
            handle.removeEventListener('pointerup', up);
            handle.removeEventListener('pointercancel', cancel);
            handle.removeEventListener('lostpointercapture', cancel);
            if (moveFrame) cancelAnimationFrame(moveFrame);
            if (queued) renderMove(queued);
            try { if (handle.hasPointerCapture(next.pointerId)) handle.releasePointerCapture(next.pointerId); } catch { /* pointer capture may already be released */ }
            if (isBalloon && moved) {
                element.classList.remove('dragging');
                element.classList.add('release-water');
                ['--drag-angle', '--drag-stretch', '--drag-squash'].forEach(name => element.style.removeProperty(name));
            }
            if (!moved) return;
            element.dataset.dragMoved = '1';
            setTimeout(() => { delete element.dataset.dragMoved; }, 0);
            if (isBalloon && cfg.balloonSnap) animateBalloonSnap(element, normal => playBalloonRelease(element, normal));
            else if (isBalloon) {
                resolveBalloonCollision(element, { persist: false });
                saveBalloonPositions();
                setTimeout(() => element.classList.remove('release-water'), 150);
                jellyLand(element, dir[0], dir[1]);
            }
            else { cfg[configKey] = { x: element.offsetLeft, y: element.offsetTop }; saveCfg(); }
        };
        const cancel = next => up(next);
        handle.addEventListener('pointermove', move);
        handle.addEventListener('pointerup', up);
        handle.addEventListener('pointercancel', cancel);
        handle.addEventListener('lostpointercapture', cancel);
    });
}

export { installChatDrag, resetBalloonInteraction, resolveBalloonCollision, updateBalloonPreviewSide };

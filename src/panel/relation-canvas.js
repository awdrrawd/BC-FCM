// Draw the dense edge layer without creating/rebuilding SVG paths per strand.
// Interactive nodes and accessible names remain in SVG above this canvas.
export function createRelationCanvas(canvas) {
    const segmentWidth = 20, segmentHeight = 20, stripWidth = 4080;
    const context = canvas.getContext('2d'), patterns = new Map(), texts = new Map();
    function pattern(style, color, width, ratio) {
        const key = `${style}:${color}:${width}:${ratio}`;
        if (patterns.has(key)) return patterns.get(key);
        const tile = document.createElement('canvas'); tile.width = Math.ceil(segmentWidth * ratio); tile.height = Math.ceil(segmentHeight * ratio);
        const ctx = tile.getContext('2d'); ctx.scale(tile.width / segmentWidth, tile.height / segmentHeight); ctx.strokeStyle = color;
        // Compact silhouettes inspired by chain.svg / rope.svg. The tile is
        // measured in screen pixels and cached, so zoom never stretches a link.
        if (style === 'chain') {
            ctx.lineWidth = Math.min(3, Math.max(1.4, width * .9));
            ctx.lineJoin = ctx.lineCap = 'round';
            ctx.beginPath(); ctx.roundRect(2, 5, 16, 10, 5); ctx.stroke();
            // The narrow, edge-on link bridges the open face of adjacent links.
            ctx.beginPath(); ctx.moveTo(-4, 10); ctx.lineTo(4, 10);
            ctx.moveTo(16, 10); ctx.lineTo(24, 10); ctx.stroke();
        } else {
            const radius = Math.min(5, Math.max(3, width * 2));
            ctx.fillStyle = color; ctx.fillRect(0, 10 - radius, segmentWidth, radius * 2);
            ctx.save(); ctx.beginPath(); ctx.rect(0, 10 - radius, segmentWidth, radius * 2); ctx.clip();
            // Closely packed diagonal strands, with a seam and a small highlight.
            // No separated sine waves: the rope remains one continuous body.
            ctx.lineWidth = Math.max(1, width * .65);
            for (let x = -10; x <= segmentWidth; x += 10) {
                ctx.strokeStyle = '#00000080';
                ctx.beginPath(); ctx.moveTo(x, 10 - radius); ctx.lineTo(x + 7, 10 + radius); ctx.stroke();
                ctx.strokeStyle = '#ffffff40'; ctx.lineWidth *= .6;
                ctx.beginPath(); ctx.moveTo(x + 2, 10 - radius); ctx.lineTo(x + 9, 10 + radius); ctx.stroke();
                ctx.lineWidth /= .6;
            }
            ctx.restore();
        }
        const strip = document.createElement('canvas'); strip.width = Math.ceil(stripWidth * ratio); strip.height = tile.height;
        const brush = strip.getContext('2d'); brush.fillStyle = brush.createPattern(tile, 'repeat'); brush.fillRect(0, 0, strip.width, strip.height);
        patterns.set(key, strip); return strip;
    }
    function textSprite(text, ratio, colors) {
        const key = `${text}:${ratio}:${colors.text}:${colors.background}:${colors.font}`;
        if (texts.has(key)) return texts.get(key);
        context.font = `12px ${colors.font}`;
        const width = Math.ceil(context.measureText(text).width) + 8, height = 24;
        const image = document.createElement('canvas'); image.width = Math.ceil(width * ratio); image.height = Math.ceil(height * ratio);
        const ctx = image.getContext('2d'); ctx.scale(ratio,ratio); ctx.font = context.font;
        ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = colors.background; ctx.fillStyle = colors.text;
        ctx.strokeText(text,4,16); ctx.fillText(text,4,16);
        const sprite = {image,width,height}; texts.set(key,sprite); return sprite;
    }
    function paint(edges, view, width, height, lineWidth, labels = [], colors = {}) {
        if (!width || !height) return;
        const ratio = Math.min(2, globalThis.devicePixelRatio || 1);
        const pixelWidth = Math.round(width * ratio), pixelHeight = Math.round(height * ratio);
        if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) { canvas.width = pixelWidth; canvas.height = pixelHeight; }
        context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, width, height);
        const scale = Math.min(width / view.w, height / view.h);
        const ox = (width - view.w * scale) / 2 - view.x * scale, oy = (height - view.h * scale) / 2 - view.y * scale;
        for (const edge of edges) {
            if (edge.style === 'none') continue;
            const ax = edge.a.x * scale + ox, ay = edge.a.y * scale + oy;
            const bx = edge.b.x * scale + ox, by = edge.b.y * scale + oy;
            if (Math.max(ax, bx) < -60 || Math.min(ax, bx) > width + 60 || Math.max(ay, by) < -60 || Math.min(ay, by) > height + 60) continue;
            const dx = bx - ax, dy = by - ay, length = Math.hypot(dx, dy) || 1, gap = Math.min(length / 3, 14);
            const x1 = ax + dx * gap / length, y1 = ay + dy * gap / length;
            const x2 = bx - dx * gap / length, y2 = by - dy * gap / length;
            const textured = edge.style === 'chain' || edge.style === 'rope';
            context.save(); context.globalAlpha = edge.muted ? .18 : 1;
            context.strokeStyle = context.fillStyle = edge.color; context.lineWidth = lineWidth;
            if (textured) {
                context.translate(x1, y1); context.rotate(Math.atan2(dy, dx));
                const strip = pattern(edge.style, edge.color, lineWidth, ratio);
                for (let offset = 0; offset < length - gap * 2; offset += stripWidth) {
                    const size = Math.min(stripWidth, length - gap * 2 - offset);
                    context.drawImage(strip, 0, 0, size * ratio, strip.height, offset, -segmentHeight / 2, size, segmentHeight);
                }
                context.restore();
                context.save(); context.globalAlpha = edge.muted ? .18 : 1; context.fillStyle = edge.color;
            } else {
                context.setLineDash(edge.style === 'dashed' ? [8, 5] : edge.style === 'dotted' ? [1, 5] : []);
                context.lineCap = edge.style === 'dotted' ? 'round' : 'butt';
                context.beginPath(); context.moveTo(x1, y1);
                if (edge.bend) context.quadraticCurveTo((ax + bx) / 2 - dy / length * edge.bend, (ay + by) / 2 + dx / length * edge.bend, x2, y2);
                else context.lineTo(x2, y2);
                context.stroke();
            }
            if (edge.type === 'owner') {
                context.translate(x2, y2); context.rotate(Math.atan2(dy, dx));
                context.beginPath(); context.moveTo(0, 0); context.lineTo(-9, -4); context.lineTo(-9, 4); context.closePath(); context.fill();
            }
            context.restore();
        }
        for (const node of labels) {
            if (node.hideLabel || node.group.classList.contains('fcm-graph-muted') || node.group.style.display === 'none') continue;
            const x = node.pos.x * scale + ox, y = node.pos.y * scale + oy;
            const sprite = textSprite(node.label.textContent, ratio, colors);
            context.save(); context.translate(x,y);
            let lx = -sprite.width/2, ly = (node.center ? 11 : 7) + 15 - 16;
            if (node.radial) {
                const angle = Math.atan2(node.pos.y,node.pos.x), left = Math.cos(angle) < 0;
                context.rotate(left ? angle + Math.PI : angle);
                lx = left ? -13 - sprite.width + 4 : 13 - 4; ly = -12;
            }
            context.drawImage(sprite.image, lx, ly, sprite.width, sprite.height); context.restore();
        }
    }
    return { paint, reset() { texts.clear(); } };
}

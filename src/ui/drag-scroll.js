function installDragScroll(scope, selector) {
    scope?.querySelectorAll(selector).forEach(element => {
        if (element.dataset.dragScroll) return;
        element.dataset.dragScroll = '1';
        let startX = 0;
        let startY = 0;
        let scrollLeft = 0;
        let scrollTop = 0;
        let tracking = false;
        let dragging = false;

        element.addEventListener('pointerdown', event => {
            if (event.button !== 0 || event.target.closest('button,input,textarea,select,a')) return;
            startX = event.clientX;
            startY = event.clientY;
            scrollLeft = element.scrollLeft;
            scrollTop = element.scrollTop;
            tracking = true;
        });
        element.addEventListener('pointermove', event => {
            if (!tracking) return;
            const dx = event.clientX - startX;
            const dy = event.clientY - startY;
            if (!dragging && Math.abs(dx) + Math.abs(dy) <= 3) return;
            if (!dragging) {
                dragging = true;
                element.setPointerCapture(event.pointerId);
                element.classList.add('drag-scrolling');
            }
            event.preventDefault();
            element.scrollLeft = scrollLeft - dx;
            element.scrollTop = scrollTop - dy;
        });
        const stop = () => {
            tracking = false;
            dragging = false;
            element.classList.remove('drag-scrolling');
        };
        element.addEventListener('pointerup', stop);
        element.addEventListener('pointercancel', stop);
        element.addEventListener('lostpointercapture', stop);
    });
}

export { installDragScroll };

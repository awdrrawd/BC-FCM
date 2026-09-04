function reducedMotion() {
    return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function animateLayoutChange(list, main, beforeList, beforeMain, stacked, showDetail) {
    if (!list || !main || reducedMotion()) return;
    const duration = 320;
    const easing = 'cubic-bezier(.4,0,.2,1)';
    const afterList = list.getBoundingClientRect();
    const afterMain = main.getBoundingClientRect();
    if (stacked && showDetail) {
        const visibleWidth = Math.max(1, beforeList.width);
        const hiddenRight = Math.max(0, afterList.width - visibleWidth);
        list.style.visibility = 'visible';
        const listAnimation = list.animate([
            { transform: 'translateX(0)', clipPath: `inset(0 ${hiddenRight}px 0 0)`, opacity: 1 },
            { transform: `translateX(-${visibleWidth}px)`, clipPath: `inset(0 ${hiddenRight}px 0 0)`, opacity: .35 },
        ], { duration, easing });
        const resetVisibility = () => { list.style.visibility = ''; };
        listAnimation.onfinish = resetVisibility;
        listAnimation.oncancel = resetVisibility;
        main.animate([
            { transformOrigin: 'right center', transform: `translateX(${beforeMain.left - afterMain.left}px) scaleX(${Math.max(.01, beforeMain.width / afterMain.width)})` },
            { transformOrigin: 'right center', transform: 'none' },
        ], { duration, easing });
    } else if (!stacked && beforeMain.width > afterMain.width) {
        list.animate([{ transform: `translateX(-${afterList.width}px)`, opacity: .35 }, { transform: 'translateX(0)', opacity: 1 }], { duration, easing });
        main.animate([
            { transformOrigin: 'right center', transform: `translateX(${beforeMain.left - afterMain.left}px) scaleX(${Math.max(.01, beforeMain.width / afterMain.width)})` },
            { transformOrigin: 'right center', transform: 'none' },
        ], { duration, easing });
    }
}

function animatePanelSize(panel, before) {
    if (!panel) return;
    if (reducedMotion()) { panel.classList.remove('fcm-size-animating'); return; }
    const after = panel.getBoundingClientRect();
    const beforeCenterX = before.left + before.width / 2;
    const beforeCenterY = before.top + before.height / 2;
    const afterCenterX = after.left + after.width / 2;
    const afterCenterY = after.top + after.height / 2;
    const animation = panel.animate([
        { translate: `${beforeCenterX - afterCenterX}px ${beforeCenterY - afterCenterY}px`, scale: `${before.width / after.width} ${before.height / after.height}` },
        { translate: '0 0', scale: '1 1' },
    ], { duration: 360, easing: 'cubic-bezier(.2,.8,.2,1)' });
    const finish = () => panel.classList.remove('fcm-size-animating');
    animation.onfinish = finish;
    animation.oncancel = finish;
}

function positionPanel(panel, maximized, savedPosition) {
    if (!panel || maximized || !savedPosition) return;
    panel.style.left = `${savedPosition.x}px`;
    panel.style.top = `${savedPosition.y}px`;
    panel.style.transform = 'none';
}

function syncConversationBackButton(main, stacked, { title, icon, onBack }) {
    const header = main?.querySelector('.fcm-chat-conversation-header');
    if (!header) return;
    const existing = header.querySelector('[data-back]');
    if (!stacked) { existing?.remove(); return; }
    if (existing) return;
    const button = document.createElement('button');
    button.className = 'fcm-chat-back fcm-chat-icon-action';
    button.dataset.back = '';
    button.title = title;
    button.innerHTML = icon;
    button.addEventListener('click', onBack);
    header.prepend(button);
}

export { animateLayoutChange, animatePanelSize, positionPanel, syncConversationBackButton };

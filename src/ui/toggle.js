export function mkToggle(on, onChange) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'fcm-tog' + (on ? ' on' : '');
    button.setAttribute('role', 'switch'); button.setAttribute('aria-checked', String(!!on));
    const dot = document.createElement('span'); dot.className = 'fcm-tog-dot'; button.append(dot);
    button.addEventListener('click', () => {
        const value = !button.classList.contains('on');
        button.classList.toggle('on', value); button.setAttribute('aria-checked', String(value)); onChange(value);
    });
    return button;
}

import { T } from '../i18n/i18n.js';

function attachSearchClear(input, { onInput, onClear, hideWhenEmpty = false } = {}) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'fcm-clear-btn';
    button.textContent = '×';
    button.title = T('chatClearSearch');
    button.setAttribute('aria-label', button.title);
    const sync = () => { button.hidden = hideWhenEmpty && !input.value; };
    input.addEventListener('input', () => { sync(); onInput?.(input.value); });
    input.addEventListener('keydown', event => event.stopPropagation());
    button.addEventListener('click', event => {
        event.stopPropagation();
        input.value = '';
        sync();
        input.focus();
        onInput?.('');
        onClear?.();
    });
    input.parentElement.appendChild(button);
    sync();
    return button;
}

// Shared FCM search field: sizing, clear action, and isolation from game shortcuts.
function makeSearchWrap(initialValue, placeholder, onInput, extraClass, onClear) {
    const wrap = document.createElement('div'); wrap.className = 'fcm-search-wrap';
    const inp = document.createElement('input'); inp.className = 'fcm-search';
    if (extraClass) inp.classList.add(extraClass);
    inp.placeholder = placeholder; inp.value = initialValue; inp.setAttribute('aria-label', placeholder);
    wrap.append(inp); attachSearchClear(inp, { onInput, onClear });
    return { wrap, inp };
}

export { attachSearchClear, makeSearchWrap };

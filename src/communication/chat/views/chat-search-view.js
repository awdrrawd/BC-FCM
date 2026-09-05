function searchHtml(value, esc, text) {
    return `<div class="fcm-chat-search"><input data-search value="${esc(value)}" placeholder="${text('chatSearchPlayers')}"><button type="button" data-clear-search aria-label="${text('chatClearSearch')}" title="${text('chatClearSearch')}" ${value ? '' : 'hidden'}>×</button></div>`;
}

function bindSearch(scope, onSearch) {
    const input = scope?.querySelector('[data-search]');
    if (!input) return;
    const clear = input.parentElement.querySelector('[data-clear-search]');
    const update = () => {
        if (clear) clear.hidden = !input.value;
        onSearch(input.value);
    };
    input.addEventListener('input', update);
    clear?.addEventListener('click', () => {
        input.value = '';
        update();
        input.focus();
    });
}

export { bindSearch, searchHtml };

import { attachSearchClear } from '../../../ui/search-clear.js';

function searchHtml(value, esc, text) {
    return `<div class="fcm-chat-search"><input data-search value="${esc(value)}" placeholder="${text('chatSearchPlayers')}"></div>`;
}

function bindSearch(scope, onSearch) {
    const input = scope?.querySelector('[data-search]');
    if (input) attachSearchClear(input, { onInput: onSearch, hideWhenEmpty: true });
}

export { bindSearch, searchHtml };

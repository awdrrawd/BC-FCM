import { esc } from '../services/chat-content.js';

function createProfileSuggestionController({ getRoot, getSelectedMember, getFriendRows, findLiveCharacter, loadProfile, displayName, avatarHtml, text, limit = 6 }) {
    let requestVersion = 0;

    async function update(event) {
        const version = ++requestVersion;
        const input = event.currentTarget;
        const suggest = getRoot()?.querySelector('[data-profile-suggest]');
        const match = input.value.match(/(?:^|\s)@(\d*)$/u);
        if (!suggest || !match) {
            if (suggest) suggest.hidden = true;
            return;
        }

        const query = match[1];
        let candidates = [];
        if (query) {
            const memberNumber = Number(query);
            const profile = findLiveCharacter(memberNumber) || await loadProfile(memberNumber);
            if (profile) candidates = [{ memberNumber, name: displayName(memberNumber) }];
        } else {
            const ids = [getSelectedMember(), ...getFriendRows().map(row => Number(row.mn))].filter(Boolean);
            candidates = [...new Set(ids)].slice(0, limit).map(memberNumber => ({ memberNumber, name: displayName(memberNumber) }));
        }
        if (version !== requestVersion || !input.isConnected) return;

        suggest.innerHTML = candidates.length
            ? candidates.map(row => `<button data-insert-profile="${row.memberNumber}">${avatarHtml(row.memberNumber, 28)}<span><b>${esc(row.name)} (${row.memberNumber})</b><small>${text('chatShareProfile')}</small></span></button>`).join('')
            : `<span>${text('chatProfileNotFound')}</span>`;
        suggest.hidden = false;
        suggest.querySelectorAll('[data-insert-profile]').forEach(button => button.addEventListener('click', () => {
            input.value = input.value.replace(/@\d*$/u, `@${button.dataset.insertProfile}`);
            suggest.hidden = true;
            input.focus();
        }));
    }

    function reset() {
        requestVersion++;
    }

    return { reset, update };
}

export { createProfileSuggestionController };

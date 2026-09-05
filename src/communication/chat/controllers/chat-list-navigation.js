import { bindSearch } from '../views/chat-search-view.js';

function createChatListNavigation({ config, saveConfig, promptGroupName, refreshList, refreshVisible, bindMemberRows, getActiveView }) {
    const state = {
        search: '', presenceFilter: 'online', relationFilter: '', notificationTab: 'recent',
        notificationSearch: '', selectedGroup: 'room', groupMode: 'room', groupSearch: '',
    };

    function getState() {
        return state;
    }

    function createGroup(label, groupMode = state.groupMode) {
        if (!label) return '';
        const id = `group-${Date.now().toString(36)}`;
        config.chatGroups ||= {};
        config.chatGroups[id] = label;
        state.selectedGroup = id;
        state.groupMode = groupMode;
        saveConfig();
        return id;
    }

    function bind(scope) {
        scope?.querySelectorAll('[data-notification-tab]').forEach(button => button.addEventListener('click', () => {
            state.notificationTab = button.dataset.notificationTab;
            refreshList();
        }));
        scope?.querySelectorAll('[data-group]').forEach(button => button.addEventListener('click', () => {
            state.selectedGroup = button.dataset.group;
            refreshList();
        }));
        scope?.querySelector('[data-add-group]')?.addEventListener('click', async () => {
            const label = await promptGroupName();
            if (createGroup(label)) refreshList();
        });
        scope?.querySelectorAll('[data-group-mode]').forEach(button => button.addEventListener('click', () => {
            state.groupMode = button.dataset.groupMode;
            refreshList();
        }));
        bindSearch(scope, value => {
            const key = { notifications: 'notificationSearch', groups: 'groupSearch', chat: 'search' }[getActiveView()];
            if (!key) return;
            state[key] = value;
            refreshVisible();
        });
        scope?.querySelectorAll('[data-presence]').forEach(button => button.addEventListener('click', () => {
            state.presenceFilter = button.dataset.presence;
            refreshList();
        }));
        scope?.querySelectorAll('[data-rel]').forEach(button => button.addEventListener('click', () => {
            state.relationFilter = state.relationFilter === button.dataset.rel ? '' : button.dataset.rel;
            refreshList({ preserveScroll: true });
        }));
        bindMemberRows(scope);
    }

    return { bind, createGroup, getState };
}

export { createChatListNavigation };

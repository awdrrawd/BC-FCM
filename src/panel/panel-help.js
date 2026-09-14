import { T } from '../i18n/i18n.js';
import { MOD_VER } from '../core/config.js';
// ════════════════════════════════════════
//  FCM module: panel-help.js  (split from panel.js)
//  說明頁：純靜態內容，無共用狀態耦合。
// ════════════════════════════════════════

function renderHelp(container) {
    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'padding:16px 20px;overflow-y:auto;display:flex;flex-direction:column;gap:0;height:100%;';
    const sections = [
        { icon: '🎛', title: T('helpIntroTitle'), body: T('helpIntroText') },
        { icon: '⚙', title: T('helpSettingsTitle'), items: [
            T('helpSaveText'), T('setAvatarsNote'), T('whisperAvatarNote'),
            T('whisperIndicatorNote'), T('oocProtectNote'), T('ghostHideNote'),
        ] },
        { icon: '👥', title: T('helpRelationsTitle'), body: T('helpRelationsText') },
        { icon: '🏠', title: T('tabRoom'), body: T('helpRoomText') },
        { icon: '📍', title: T('beepSummon'), body: T('helpSummonText') },
        { icon: '📜', title: T('tabPeople'), body: T('helpPeopleText') },
        { icon: '🖼', title: T('setAvatars'), body: T('helpAvatarsText') },
        { icon: '🔑', title: T('btnVisibilityLabel'), items: [
            T('btnShowChatRoom'), T('btnShowMainHall'), T('btnShowProfile'), T('btnVisibilityNote'),
        ] },
    ];
    sections.forEach(sec => {
        const card = document.createElement('div'); card.className = 'fcm-help-card';
        card.style.cssText = 'background:#1a1230;border:1px solid #2e2458;border-radius:10px;padding:12px 16px;margin-bottom:8px;transition:border-color .15s;';
        card.addEventListener('mouseenter', () => { card.style.borderColor = '#5a48a8'; });
        card.addEventListener('mouseleave', () => { card.style.borderColor = '#2e2458'; });
        const titleRow = document.createElement('div');
        titleRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:6px;';
        const iconEl = document.createElement('span'); iconEl.style.cssText = 'font-size:15px;flex-shrink:0;'; iconEl.textContent = sec.icon;
        const titleEl = document.createElement('div'); titleEl.className = 'fcm-help-title'; titleEl.style.cssText = 'color:#e0c8ff;font-size:13px;font-weight:700;'; titleEl.textContent = sec.title;
        titleRow.appendChild(iconEl); titleRow.appendChild(titleEl); card.appendChild(titleRow);
        if (sec.body) { const p = document.createElement('div'); p.className = 'fcm-help-text'; p.style.cssText = 'color:#a090c0;font-size:12px;line-height:1.7;'; p.textContent = sec.body; card.appendChild(p); }
        if (sec.items) {
            const ul = document.createElement('div'); ul.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
            sec.items.forEach(item => {
                const li = document.createElement('div'); li.className = 'fcm-help-item'; li.style.cssText = 'color:#a090c0;font-size:12px;line-height:1.6;display:flex;gap:6px;';
                const dot = document.createElement('span'); dot.className = 'fcm-help-dot'; dot.style.cssText = 'color:#5a48a0;flex-shrink:0;'; dot.textContent = '•';
                const txt = document.createElement('span'); txt.textContent = item;
                li.appendChild(dot); li.appendChild(txt); ul.appendChild(li);
            });
            card.appendChild(ul);
        }
        wrap.appendChild(card);
    });
    const footer = document.createElement('div'); footer.className = 'fcm-help-footer';
    footer.style.cssText = 'margin-top:4px;padding:10px 0;text-align:center;color:#4a3870;font-size:11px;letter-spacing:1px;';
    footer.textContent = `FCM v${MOD_VER}  ·  Liko - Friends & Chatroom Manager`;
    wrap.appendChild(footer);
    container.appendChild(wrap);
}

export { renderHelp };

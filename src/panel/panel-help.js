import { isZh } from '../i18n/i18n.js';
import { MOD_VER } from '../core/config.js';
// ════════════════════════════════════════
//  FCM module: panel-help.js  (split from panel.js)
//  說明頁：純靜態內容，無共用狀態耦合。
// ════════════════════════════════════════

function renderHelp(container) {
    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'padding:16px 20px;overflow-y:auto;display:flex;flex-direction:column;gap:0;height:100%;';
    const zh = isZh();
    const sections = zh ? [
        { icon: '🎛', title: 'FCM 是什麼？',
         body: 'FCM（Friends & Chatroom Manager）是一個好友與聊天室管理工具，讓你在同一面板中查看好友狀態、管理房間成員、搜尋房間，以及查詢曾遇過的角色。' },
        { icon: '⚙', title: '部分功能需在「設定」頁面手動啟用',
         items: [
             '【顯示頭像】— 預設關閉。啟用後在各列表顯示角色頭像（需曾同房或擁有完整資料）。',
             '【私聊時顯示對象頭像】— 進入悄悄話 / BEEP 模式時，在畫面左下角顯示對象頭像。僅在聊天室主畫面顯示，查看角色資料、衣櫃等覆蓋畫面時自動隱藏。',
             '【儲存模式】— 預設「不儲存」。建議至少選「僅名稱」，否則離線好友將無法顯示名稱，人員查詢頁也沒有資料。',
             '【私聊 / BEEP 輸入框提示色】— 輸入 /w 或進入悄悄話模式時，輸入框顯示顏色邊框。',
             '【OOC 保護】— 悄悄話模式下封鎖 Ctrl+Enter，防止 OOC 內容被誤發為普通對話。',
             '【幽靈名單隱身】— 幽靈名單中的角色在聊天室不顯示身體（只對自己有效）。',
         ]},
        { icon: '👥', title: '好友關係顯示「單向好友」是正常的',
         body: '對方剛添加你時，BC 伺服器尚未將更新資料推送到你的客戶端，所以顯示為「單向好友」。重新登入或等待伺服器同步後即可顯示正確關係。' },
        { icon: '🏠', title: '房間管理',
         items: [
             '「房間管理」頁需要你目前在某個聊天室中才能使用。',
             '管理員功能（踢人、封禁、白名單等）需要你擁有該房間的管理員權限。',
             '房間搜尋頁可以搜尋公開房間，並以星號標記最愛房間。',
         ]},
        { icon: '📍', title: '召喚功能（BEEP 視窗中的「召喚」按鈕）',
         body: '按下「召喚」會傳送附帶當前房間資訊的 BEEP。對方必須在 BC 中設定有接受召喚的規則才能自動傳送；否則對方只會收到文字訊息「summon」。需在房間中才能使用。' },
        { icon: '📜', title: '人員查詢與 Profile 分享',
         items: [
             '「人員查詢」頁顯示你曾在同一房間遇過的角色（需啟用儲存模式）。',
             '擁有完整資料（完整模式）的角色可點「分享」，將 Profile 傳送給當前聊天室的其他人。',
             '與 WCE（bce-past-profiles）完全相容。若已安裝 WCE 建議儲存模式設為「不儲存」以避免重複儲存。',
         ]},
        { icon: '🖼', title: '頭像說明',
         items: [
             '頭像從角色的 BC 畫布截取臉部，需有完整外觀資料才能生成。',
             '若頭像顯示文字縮寫，可點擊頭像格子強制重新截取。',
             '設定頁的「頭像快取管理」可清除所有頭像或批次載入好友頭像。',
         ]},
        { icon: '🔑', title: 'FCM 按鈕位置',
         items: [
             '聊天室右側工具列 — 貓頭圖示按鈕',
             '大廳畫面右上角 — 貓頭圖示按鈕',
             '自己的個人檔案頁 — 右側按鈕',
             '可在設定頁的「按鈕顯示設定」中分別開關各位置的按鈕（至少須保留一個）。',
         ]},
    ] : [
        { icon: '🎛', title: 'What is FCM?',
         body: "FCM (Friends & Chatroom Manager) is a companion tool for Bondage Club. View friend status, manage room members, search rooms, and look up characters you've encountered — all in one panel." },
        { icon: '⚙', title: 'Some features must be enabled in Settings first',
         items: [
             '[Show Avatars] — Off by default. Shows portraits in lists (requires having been in the same room or having full profile data).',
             '[Save Mode] — Defaults to "Off". Set to at least "Name only" so offline friend names display and the People tab has data.',
             "[Show target avatar during whisper] — Displays the target's avatar bottom-left when in whisper/BEEP mode. Only on chatroom main screen; hidden during profile/wardrobe views.",
             '[Whisper/BEEP Input Glow] — Shows a colored glow on chat input when /w is typed or whisper mode is active.',
             '[OOC Protection] — Blocks Ctrl+Enter in whisper mode to prevent OOC content from being sent as normal chat.',
             '[Ghost List Hide] — Characters on your ghost list are hidden in the chatroom (only affects your view).',
         ]},
        { icon: '👥', title: '"One-way" relationship is normal',
         body: "If someone shows as One-way friend, it means they recently added you but BC's server hasn't synced yet. Re-logging or waiting will fix it." },
        { icon: '🏠', title: 'Room Management',
         items: [
             'The Room Management tab only works while you are in a chatroom.',
             'Admin actions (kick, ban, whitelist, etc.) require admin rights in the room.',
             'Room Search lets you search public rooms and star favorites.',
         ]},
        { icon: '📍', title: 'Summon (button in the BEEP dialog)',
         body: 'Clicking "Summon" sends a BEEP with your current room info. The target must have a summon rule in BC to be teleported automatically — otherwise they only receive "summon". Must be in a room.' },
        { icon: '📜', title: 'People tab & Profile sharing',
         items: [
             "The People tab shows characters you've encountered (requires Save Mode).",
             'Characters with full profile data can be shared to the chatroom via the Share button.',
             "Fully compatible with WCE's bce-past-profiles DB. Use Save Mode \"Off\" if WCE is installed.",
         ]},
        { icon: '🖼', title: 'Avatars',
         items: [
             "Avatars are cropped from the character's BC canvas — full appearance data required.",
             'Click the avatar cell to force a reload.',
             'Use "Avatar Cache" in Settings to clear or batch-load avatars.',
         ]},
        { icon: '🔑', title: 'FCM button locations',
         items: [
             'ChatRoom toolbar — cat icon on the right',
             'Main Hall — cat icon top-right',
             'Your own profile page — right side button',
             'Toggle each in Settings → Button Visibility.',
         ]},
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

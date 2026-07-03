<h1 align="center">👥 Liko-FCM — Friends & ChatRoom Manager</h1>
<div align="center">
   
![Version](https://img.shields.io/badge/version-1.4.2-purple.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)
![BondageClub](https://img.shields.io/badge/BondageClub-Compatible-pink.svg)

</div>

一個 BondageClub UserScript 插件，提供完整的好友關係管理、房間管理、個人資料保存與查詢功能。  
A BondageClub UserScript plugin for managing friends, rooms, profiles, and more.

---

## ✨ 功能 · Features

**👥 個人關係 · Relations**

統一檢視所有好友、主人、戀人、奴隸、白名單、黑名單、幽靈名單。  
View all friends, owners, lovers, subs, whitelist, blacklist, and ghost list in one place.

顯示在線狀態、所在區域、所在房間，可直接點擊房間名傳送。  
Shows online status, zone, and current room — click a room name to teleport.

支援暱稱顯示、排序（關係 / ID / 名稱 / 添加時間 / 最後見面）。  
Supports nickname display and sorting by relation / ID / name / added time / last seen.

一鍵操作：查看資料、BEEP、悄悄話、加好友、移除好友、調整名單。  
One-click actions: view profile, BEEP, whisper, add/remove friend, manage lists.

---

**🏠 房間管理 · Room Management**

查看房內人員列表、管理者、白名單、黑名單。  
View room members, admins, whitelist, and blacklist.

管理員操作：升/降管理、加/移白名單、封禁/解禁、逐出。  
Admin actions: promote/demote, whitelist/unwhitelist, ban/unban, kick.

搜尋並加入公開房間。  
Search and join public rooms.

---

**📋 個人資料保存 · Profile Storage**

自動儲存遇見過的角色資料（名稱、暱稱、外觀、BIO 等）。  
Auto-saves encountered characters (name, nickname, appearance, BIO, etc.).

與 WCE `bce-past-profiles` 資料庫完全相容，互相共用。  
Fully compatible with WCE `bce-past-profiles` database — shared storage, no conflicts.

支援四種儲存模式：不儲存 / 僅名稱 / 名稱與頭像 / 完整資料。  
Four save modes: Off / Name only / Name + Avatar / Full profile.

可匯出 / 匯入 JSON 備份。  
Export and import profiles as JSON backup.

---

**🖼️ 頭像快照 · Avatar Snapshot**

遇見角色時自動截取頭像，存入獨立的 `fcm-snapshot` 資料庫。  
Automatically captures avatars on encounter and stores them in a separate `fcm-snapshot` database.

可手動載入所有好友頭像，或清除頭像快取。  
Manually load all friend avatars or clear the avatar cache.

---

**🔍 人員查詢 · People Search**

搜尋曾見過的角色（名稱或 ID），可直接執行好友、白名單、黑名單等操作。  
Search encountered characters by name or ID, and take actions directly from results.

---

**📜 Profile 分享 · Profile Share**

透過 LIKOSHARE 協議，在房間內將角色資料分享給其他人。  
Share character profiles with others in the room via the LIKOSHARE protocol.

與 Liko-WPS 插件相容。  
Compatible with the Liko-WPS plugin.

---

**💬 輸入框增強 · Input Enhancements**

悄悄話 / BEEP 模式時顯示紫色邊框提示。  
Shows a purple glow on the chat input when in whisper / BEEP mode.

悄悄話時可在輸入框旁顯示對象頭像。  
Optionally displays the target's avatar beside the input box during whisper mode.

OOC 保護：悄悄話模式下封鎖 Ctrl+Enter，防止誤發。  
OOC Protection: blocks Ctrl+Enter in whisper mode to prevent accidental out-of-character messages.

---

**👻 幽靈名單隱身 · Ghost Hide**

幽靈名單中的角色在聊天室不顯示身體（僅對自己有效）。  
Characters on your ghost list are hidden in the chatroom — only affects your own view.

---

## 📦 安裝方式 · Installation

### 🧩 透過 PCM 管理器（推薦） · Via PCM Managerr (Recommended)

若你已安裝 [Liko PCM](https://awdrrawd.github.io/liko-Plugin-Repository/)，可在插件列表中直接啟用 FCM，無需單獨安裝。  
If you have [Liko PCM](https://awdrrawd.github.io/liko-Plugin-Repository/) installed, enable FCM directly from the plugin list — no separate install needed.

---

### 🔌 透過 FUSAM（推薦） · Via FUSAMr (Recommended)

1. 安裝 FUSAM（若尚未安裝）：https://sidiousious.gitlab.io/bc-addon-loader/  
   Install FUSAM if you don't have it yet: https://sidiousious.gitlab.io/bc-addon-loader/

2. 登入 BondageClub 後，前往主設定頁面點擊頂部的 **ADD-ON**。  
   After logging into BondageClub, click **ADD-ON** at the top of the main settings page.

3. 在列表中找到 **Liko-FCM**，選擇版本後點擊 **Save**。  
   Find **Liko-FCM** in the list, select your preferred branch, and click **Save**.

4. 重新載入 BC。  
   Reload BondageClub.

---

### 🐵 直接安裝 · Direct installation
Tampermonkey / Violentmonkey

點擊以下連結直接安裝：  
Click the link below to install:

👉 **[Install Liko-FCM.user.js](https://github.com/awdrrawd/liko-Plugin-Repository/raw/refs/heads/main/Plugins/Liko-FCM.user.js)**

---

### 🔖 書籤安裝 · Bookmarklet

建立新書籤，將以下程式碼貼入網址欄，在 BC 頁面點擊書籤即可載入：  
Create a new bookmark, paste the code below as the URL, then click it while on the BondageClub page:

```javascript
javascript:(function(){
  var s=document.createElement('script');
  s.src="https://github.com/awdrrawd/liko-Plugin-Repository/raw/refs/heads/main/Plugins/Liko-FCM.user.js?"+Date.now();
  s.type="text/javascript";
  s.crossOrigin="anonymous";
  document.head.appendChild(s);
})();
```

---

### 💻 瀏覽器控制台 · Browser Console

開啟 F12，在 Console 分頁貼上以下程式碼：  
Open F12 DevTools and paste the following into the Console tab:

```javascript
import(`https://github.com/awdrrawd/liko-Plugin-Repository/raw/refs/heads/main/Plugins/Liko-FCM.user.js?v=${(Date.now()/10000).toFixed(0)}`);
```

---


## 📄 授權 · License

MIT License © Likolisu

使用本插件的程式碼時，請附上來源連結或保留版權聲明。  
When using code from this project, please include a link to the source or retain the copyright notice.

---

🐾 Made with 🐾 by **Likolisu**

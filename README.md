<h1 align="center">👥 Liko-FCM — Friends & ChatRoom Manager</h1>
<h3 align="center">好友與房間管理</h3>

<div align="center">

![Version](https://img.shields.io/badge/version-1.6.9-purple.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-purple.svg)
![BondageClub](https://img.shields.io/badge/BondageClub-Compatible-pink.svg)
![Languages](https://img.shields.io/badge/i18n-11%20languages-blue.svg)

</div>

Bondage Club UserScript：好友關係管理、房間管理與玩家排序、個人資料與頭像保存、關係圖，以及內建的私訊系統 **FCM CHAT**（BEEP／悄悄話對話）。  
A Bondage Club UserScript for managing friends and rooms, saving profiles and avatars, exploring relationship graphs, and chatting through the bundled **FCM CHAT** (BEEP / whisper conversations).

---

## ✨ 功能 · Features

### 🎛 主面板 · Main Panel
點擊聊天室、大廳或個人資料頁上的 FCM 圖示開啟。分頁可在設定中排序與隱藏。  
Open it from the FCM icon in the chat room, main hall or profile screen. Tabs can be reordered and hidden in Settings.

| 分頁 Tab | 說明 Description |
|---|---|
| **個人關係 Relations** | 好友、主人、戀人、奴隸、白名單、黑名單、幽靈名單一覽；在線狀態、區域、所在房間（點擊可傳送）。可依置頂／關係／ID／名稱／加入時間／最後見面排序，切換暱稱或 BC 名稱。 |
| **房間管理 Room Mgmt** | 房內成員、管理員、白名單、黑名單；升降管理、白名單、封禁、逐出；房管可**拖曳或點選調整玩家順序**（交換／插入）；分享房間到聊天。 |
| **房間查詢 Search Rooms** | 搜尋並加入公開房間，依區域篩選，收藏常用房間。 |
| **人員查詢 People** | 搜尋曾遇見的角色（名稱或 ID），直接加好友、操作名單、分享 Profile；支援 `/profiles <名稱或ID>` 指令。 |
| **關係圖 Relations Graph** | 依已保存的 Profile 繪製人際關係圖：搜尋人物、調整層數（1–100）、線條樣式與顏色；圖過大時會先警告。 |
| **設定 Settings** | 主設定／通訊／聊天三組設定。 |
| **說明 Help** | 常見問題與使用提示。 |

一鍵操作：查看資料、BEEP、訊息、加／移好友（同房時可通知對方）、調整名單、**召喚**（附上目前房間資訊的 BEEP，對方需有對應的 BC 召喚規則才會傳送）。  
One-click actions: view profile, BEEP, message, add/remove friend (the other party can be notified when in the same room), list management, and **Summon** (a BEEP carrying your room info).

### 📋 個人資料與頭像 · Profiles & Avatars
- **四種保存模式**：不儲存／僅名稱／僅頭像／完整資料；預設不儲存。  
  Four save modes: Off / Name only / Avatar only / Full profile (default: Off).
- 完整模式與 WCE 的 `bce-past-profiles` 資料庫**共用**，偵測到 WCE 時自動設為完整模式。若 WCE 已在保存，請關閉 FCM 的保存以避免重複寫入。  
  Full mode shares WCE's `bce-past-profiles` database. If WCE already saves profiles, turn FCM saving off.
- 頭像快照存於獨立的 `fcm-snapshot` 資料庫；可批次載入好友頭像、清除快取、更新自己的頭像；頭像來源可選 URL／遊戲／無，並有方形或圓形外觀。  
  Avatar snapshots live in a separate `fcm-snapshot` database.
- Profile 匯出／匯入 JSON（WCE 相容，衝突時以較新的 `seen` 為準）。
- 個人資料頁顯示「最後見面」時間；開啟 **Profile 關係人快速搜尋** 後，主人／戀人 ID 會變成可點按鈕，直接帶入人員查詢（與 [AFC](https://github.com/awdrrawd/BC-AFC) 的拓展戀人面板相容）。

### 💬 FCM CHAT 通訊 · FCM CHAT
通訊總開關在設定中，**預設關閉**。  
Master switch in Settings — **off by default**.

- **對話**：BEEP 與悄悄話合併於同一份對話（可關閉合併，只處理 BEEP）；最近聯絡人、置頂、依關係分類、自訂快速群組；人員右鍵可開啟聊天、置頂／取消置頂、加入群組、前往對方所在房間；每位聯絡人各自保留未送出的草稿；對方離線時，一般文字會排隊並在對方回來後送出。
- **訊息工具**：回覆、複製、轉傳給聯絡人或聊天室、翻譯（需安裝 Liko MAT 插件）；訊息右鍵「匯出信息」可多選後匯出 HTML／JSON，「刪除信息」可多選刪除本機紀錄（只對自己有效，對方仍看得到）。
- **Profile 分享**：在私訊中以 `@ID` 分享已保存的完整 Profile；收到後直接保存，只保留較新的資料。
- **狀態與自動回覆**：上線／離開／忙碌，離開與忙碌可設定自動回覆訊息。
- **通知**：浮動氣球（六個位置、可拖曳與吸附、可為每位對象建立獨立氣球）、通知動畫與音效（可上傳自訂音效）。
- **外觀**：七組預設主題（絢紫、歐式、電子、日式、中式、靜黑、簡白）與自訂配色、字型與字級、方形或圓形頭像；聊天可跟隨 FCM 主題或使用獨立主題。
- **圖片**：只載入已信任來源的圖片；圖片上傳與影片播放由選用的 Liko 插件提供。
- **BCX**：預設遵守 BCX 的私訊／悄悄話限制；設定中有預設關閉的繞過選項。

### 🗣 聊天室增強 · Chat Room Enhancements
- 悄悄話／BEEP 模式時，輸入框顯示紫色光暈，可選擇顯示對象頭像。  
- **OOC 保護**：悄悄話模式下封鎖 Ctrl+Enter，避免誤發。  
- **幽靈名單隱身**：幽靈名單中的角色在聊天室不顯示身體（僅影響你自己的畫面）。  

### 📜 分享 · Sharing
透過 PROFILESHARE 協定在房間內分享 Profile，與 LCE 及獨立 Liko-WPS 互通；接收優先序為 FCM > LCE > 獨立 WPS。  
Profile sharing in the room uses PROFILESHARE, interoperable with LCE and the standalone Liko-WPS.

### 🌐 多語系 · i18n
繁體中文、簡體中文、英文、德文、法文、俄文、烏克蘭文、西班牙文、日文、韓文、越南文。語言預設跟隨遊戲，可在設定中手動指定。

---

## 📦 安裝 · Installation

| 方式 | 步驟 |
|---|---|
| **Liko PCM**（推薦） | 在 [Liko PCM](https://awdrrawd.github.io/liko-Plugin-Repository/) 插件列表啟用 FCM |
| **FUSAM**（推薦） | 安裝 [FUSAM](https://sidiousious.gitlab.io/bc-addon-loader/) → 登入 BC → 設定頁頂部 **ADD-ON** → 找到 **Liko-FCM** → 選分支 → **Save** → 重新載入 |
| **Tampermonkey / Violentmonkey** | 安裝 **[loader.user.js](https://github.com/awdrrawd/BC-FCM/raw/refs/heads/main/loader.user.js)**，載入器會抓取 CI 發佈在 GitHub Pages 的最新版 |
| **瀏覽器控制台** | F12 → Console 貼上下方程式碼 |

```javascript
import(`https://awdrrawd.github.io/BC-FCM/assets/main.js?v=${Date.now()}`);
```

相依：[bcModSdk](https://github.com/Jomshir98/bondage-club-mod-sdk)（由 loader 載入）。選用整合：WCE（Profile 資料庫）、LCE（圖片信任、PROFILESHARE）、AFC（Profile 關係人）、Liko MAT（翻譯）、BCX。詳見 [整合說明](docs/integrations.md)。

---

## 🛠️ 開發 · Development

ES 模組位於 `src/`，由 Vite 打包為 `dist/assets/main.js`（入口）與 `app.js`（本體），推送到 `main` 後由 GitHub Actions 驗證並部署到 Pages。

```bash
npm ci
npm run dev          # build --watch + preview :5176，搭配 loader.local.user.js
npm run check        # 專案驗證 + lint + 單元測試 + 建置
npm run test:browser # Playwright 瀏覽器回歸（需先 npx playwright install chromium）
npm run hooks:install   # 啟用本機 commit / push 檢查
npm run check:bc -- --bc-dir <BC 原始碼>   # 檢查被掛鉤的 BC 函式是否改變
```

本地開發：安裝 `loader.local.user.js`（讀 `http://localhost:5176/assets/main.js`），執行 `npm run dev` 後重整 BC。

## 📚 文件 · Documentation

架構、公開 API、整合與自動化說明見 **[docs/](docs/README.md)**；互動式架構圖見 [fcm-architecture.html](docs/fcm-architecture.html)。

## 📄 授權 · License

MIT License © Likolisu。使用本專案程式碼時請附上來源連結或保留版權聲明。

🐾 Made with 🐾 by **Likolisu**

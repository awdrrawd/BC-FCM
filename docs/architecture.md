# FCM 架構與功能分支圖

互動式架構圖：[開啟 FCM 功能分支圖](./fcm-architecture.html)

左側選擇功能，右側顯示「功能 → 模組責任 → 實際檔案」。點擊節點可查看完整路徑。

## 啟動與公開邊界

- `main.js`：防止重複載入並建立 `window.Liko.FCM`。
- `app.js`：組合面板、FCM CHAT 與公開 API。
- `api/public-api.js`：穩定的頭像與 Profiles 整合介面；資料庫、HTML 和封包細節不對外暴露。

## 模組邊界

- `core/`：初始化、Hooks、設定、主題、版本與生命週期銜接。
- `panel/`：好友、人物、房間、公開房搜尋、設定及主面板控制；列表共用 `panel-widgets.js` 的分頁元件。
- `communication/chat.js`：FCM CHAT 的 composition root，只負責組合依賴與公開聊天入口。
- `communication/chat/controllers/`：聊天互動、選取、導覽、視窗、歷史載入及生命週期。
- `communication/chat/services/`：發送、接收、離線投遞、聯絡人、匯出及內容轉換。
- `communication/chat/views/`：CHAT 的 HTML presenter 與集中樣式。
- `communication/chat/data/`：對話索引、選取狀態及 IndexedDB 訊息儲存。
- `communication/chat/events/`：訊息選單、設定與個人頁事件綁定。
- `chat/`：BC 原生聊天操作、房間分享及 WPS Profile 分享協定。
- `data/`：關係資料、共用搜尋正規化與相關性排序、Profile 快取、Profile DB 與頭像 Snapshot DB。
- `ui/`：圖示入口、主題選單、Dialog 與共用拖曳捲動。主面板和 CHAT 都使用 `ui/drag-scroll.js`。
- `i18n/`：語言載入、翻譯引擎及 fallback。

各 CHAT 子目錄的 `index.js` 是分類匯入入口，不承載行為。完整公開介面另見 [FCM public API](./public-api.md)。

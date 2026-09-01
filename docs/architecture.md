# FCM 架構與功能分支圖

互動式架構圖：[開啟 FCM 功能分支圖](./fcm-architecture.html)

左側選擇功能，右側顯示「功能 → 模組責任 → 實際檔案」。點擊節點可查看完整路徑。

## 模組邊界

- `panel/`：好友、人物、房間、搜尋、設定及主面板。
- `communication/`：自訂聊天視窗、內容、狀態、字型、匯出及圖片信任。
- `chat/`：BC 聊天操作與 WPS 分享。
- `data/`：人物資料、快取與 IndexedDB。
- `core/`：初始化、Hooks、設定、主題與版本。
- `i18n/`：翻譯引擎及 fallback。


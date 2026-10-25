# FCM 架構

互動式架構圖：[fcm-architecture.html](./fcm-architecture.html)（左側選功能，右側顯示「功能 → 模組責任 → 實際檔案」）。公開介面見 [public-api.md](public-api.md)。

## 啟動與公開邊界

- `main.js`：沒有靜態 import，先做重複載入檢查並建立 `window.Liko.FCM`，再動態載入 `app.js`。
- `app.js`：註冊公開物件（`apiVersion`、`version`、`open/close/toggle`、`openChat/closeChat`、`avatar`、`profiles`），安裝主題選單並呼叫 `init()`。
- `core/config.js`：註冊 Mod SDK（重複註冊會中止）、設定預設值與按鈕座標。
- `core/core-init.js`：等到 `Player.MemberNumber` 出現才初始化 → 合併玩家設定 → 載入 i18n → 開啟 Profile／Snapshot 資料庫 → 建面板 → `initChat()` → 安裝 Hooks 與 `/profiles` 指令。
- `api/public-api.js`：只暴露頭像與 Profiles 的穩定介面；資料庫、HTML、封包與氣球互動細節不對外。

## 模組邊界

| 目錄 | 責任 |
|---|---|
| `core/` | 設定、版本、主題、日誌、初始化、**所有 BC Hook**（`hooks.js`） |
| `panel/` | 主面板：好友、房間、房間查詢、人員、關係圖、設定、說明；共用元件在 `panel-widgets.js` |
| `data/` | 關係資料、Profile DB／Snapshot DB、記憶體快取、匯入、關係索引與 worker、IndexedDB 開庫 |
| `chat/` | BC 原生聊天操作（房間／好友分享）、聊天室增強（`chat-fx.js`）、PROFILESHARE 協定 |
| `communication/` | FCM CHAT；`chat.js` 是 composition root，只組合依賴與公開聊天入口 |
| `ui/` | 圖示入口、主題選單、Dialog、拖曳捲動、搜尋清除 |
| `i18n/` | 翻譯入口、引擎、離線 fallback |
| `assets/icons/` | kebab-case SVG 原始素材 |

### FCM CHAT 分層（`communication/chat/`）

| 層 | 責任 |
|---|---|
| `controllers/` | 互動、選取、導覽、視窗、歷史載入、氣球、拖曳、生命週期 |
| `services/` | 發送、接收、離線投遞、聯絡人、匯出、翻譯、私密 Profile 封包、狀態與自動回覆 |
| `views/` | HTML presenter 與集中樣式（`chat-styles.js`） |
| `data/` | 對話索引、選取狀態、IndexedDB 訊息儲存（`chat-store.js`）、保留規則 |
| `events/` | 訊息選單、設定與個人頁事件綁定 |

各子目錄的 `index.js` 只是分類匯入入口，不承載行為。`communication/` 根目錄另有 `bcx-compat.js`、`image-trust.js`、`chat-audio.js`、`chat-font.js`。

## BC Hooks（`core/hooks.js`）

FCM 掛鉤 21 個 BC 函式；改版後是否仍有效由 [bc-compat.md](bc-compat.md) 的巡檢處理。

| 範圍 | 函式 | 備註 |
|---|---|---|
| 訊息與連線 | `ServerAccountBeep`(10/0)、`ServerSend`(10)、`ServerAccountQueryResult` | 優先序 10 用於明確啟用的 BCX 繞過 |
| 聊天 | `ChatRoomMessage`(10/0)、`ChatRoomMessageDisplay`(99) | 0 處理 WPS 隱藏分享訊息 |
| 房間 | `ChatRoomSync`、`…MemberJoin/Leave/RoomProperties/ReorderPlayers/Single`、`ChatRoomClick`、`ChatRoomLeave` | 面板更新來源；離房會關閉面板 |
| 畫面 | `DrawProcess`、`DrawCharacter`、`DrawTextFit`、`MainHallRun/Click` | FCM 按鈕與幽靈隱身 |
| 個人資料頁 | `InformationSheetRun`(9/8/5)、`InformationSheetClick`(8/5) | 9：補畫最後見面；5：擷取原生關係列；8：疊加關係人底線並**優先吃點擊** |
| 語言 | `TranslationSwitchLanguage` | 取代輪詢 |

與 [AFC](https://github.com/awdrrawd/BC-AFC) 共存時，AFC 以 priority 7 繪製拓展戀人面板，FCM 以 priority 8 繪製於其上並先處理點擊；FCM 只經 `window.Liko.AFC` 的公開 API 取得區塊座標。

## 面板更新與生命週期

`core/hooks.js` 接收 BC 的線上名單、人員進出、房間資料與順序同步；`panel.js` 的 `notifyPanelChange` 統一判斷目前分頁與顯示資料是否有變化，**不輪詢重建 DOM**。

- `panel-refresh.js`：資料快照與事件合併策略，以依賴注入取得資料與計時器，可直接測試。
- `panel-lifecycle.js`：容器管理當前頁面的更新、清理與有效範圍；每次載入建立新範圍，慢速讀取不會覆蓋新頁。
- 非同步查詢使用 render token／查詢序號，舊結果不覆蓋新分頁。
- 設定、關係圖、房間查詢、說明是**延遲載入的獨立 chunk**（`panel.js` 的 `lazyTabs`），首次進入才下載；chunk 名稱含雜湊，`app.js` 保持固定檔名（`main.js` 會 import）。載入失敗顯示可重試提示，下次進入會重試。

| 分頁 | 自動更新條件 |
|---|---|
| 個人關係 | 訪問、相關玩家上下線、使用者修改關係 |
| 房間管理 | 訪問、人員進出、房間資料／順序變更、使用者修改關係 |
| 房間查詢 | 訪問、切換區域、搜尋 |
| 人員查詢 | 訪問、搜尋 |

一般房間事件以 60 ms 合併；玩家排序能就地同步時直接更新現有卡片。手動刷新有 5 秒冷卻；開啟面板只主動查詢一次線上資料。

## 玩家排序（`panel/panel-room-order.js`）

- `reordered`：交換／插入純函式，預覽與放下共用同一規則。
- `orderCommands`：轉成原生 `Swap` 或連續 `MoveLeft`／`MoveRight`，封包帶 `Publish: false`（要求伺服器不公告移動）。
- 只有房管能操作，送出前再次確認權限與名單順序；放下後先更新 FCM 卡片，**不修改 BC 的遊戲陣列**（以伺服器為準）。
- 等待確認期間禁止重複送出；3 秒未確認則依遊戲實際順序回復（單次確認期限，不是輪詢）。
- 版面：一般寬度左右各十人、每組五欄兩排；700 px 以下改上下兩組。拖曳以位置命中判斷，尊重 `prefers-reduced-motion`。

## 關係圖

`panel-relations.js`（UI）+ `data/relation-index.js`（純邏輯模型，worker 與單元測試共用）+ `data/relation-worker.js`（唯讀讀取 `bce-past-profiles`，**不建立也不升級共用資料庫**）+ `panel/relation-canvas.js`（以單一 canvas 層繪製密集連線）。資料來源是已保存的 Profile 快照而非即時關係。

## 資料與持久化

| 位置 | 內容 |
|---|---|
| `Player.ExtensionSettings.FCM.settings` | 私人偏好；設定屬於 BC 帳號，不再鏡像到 localStorage（舊鍵 `LikoFCM` 登入後清除） |
| `Player.OnlineSharedSettings.FCM` | 其他房間成員需要的公開資料：URL 頭像、手動更新的遊戲頭像快照、簽名、狀態與時間戳；同時相容 LianChat 的 `LCData.MessageSetting` |
| IndexedDB `bce-past-profiles` | Profile（與 WCE／LCE 共用） |
| IndexedDB `fcm-snapshot` | 頭像快照 |
| IndexedDB `fcm-chat` | 聊天訊息；索引範圍為 7 天內、最近聯絡人 15 人、每次載入 100 則（`chat-retention.js`） |
| IndexedDB `fcm-chat-audio` | 自訂通知音效 |

### IndexedDB 存取規則

四個資料庫都經 `data/idb-open.js` 的 `openVersionless` 開啟：

- **不指定版本**，避免 FCM 引發升版而破壞共用同一資料庫的其他插件。FCM 不指定 PROFILES 版本；LCE 固定版本，變更前必須先討論。
- 只在資料庫不存在時以版本 1 建立 store；之後要新增 store 或索引，**建立新資料庫**，不要提高既有資料庫版本。
- 收到 `versionchange` 立即關閉連線，不阻擋其他插件升版；擁有者丟棄 handle 並惰性重連（`init()` 冪等，並行呼叫共用同一次開啟）。
- 開啟被他人阻擋的升版而排隊超過 15 秒時，結果回傳 `null`，不無限等待。

### Profile 保存流程

來源（遊戲快照／分享／匯入）→ `PDB`（capture、save、`receiveShared`、importBackup）→ IndexedDB → 交易成功後更新記憶體快取。功能頁不直接建立 transaction；頭像使用獨立資料庫。`PDB.receiveShared` 是分享資料的唯一入口，寫入前 `seen` 一律不晚於現在。保存模式：`name` 保留完整資料；`avatar` 只寫頭像庫。匯入備份的 `dbVersion` 只供參考，不補建 store。

## 通訊

私密 Profile 封包、PROFILESHARE 分塊與離線投遞規則見 [chat-private-sharing.md](chat-private-sharing.md)；與其他插件的整合見 [integrations.md](integrations.md)。

- 發送：悄悄話為 `Whisper`，BEEP 為 `AccountBeep`；一般 BEEP 只含可見文字，不附 metadata。
- 離線：一般文字排隊，對方回來後送出；Profile 提及無法排隊，輸入框保留文字供手動分享。
- 氣球：`chat-balloon.js` 管理定位與內容，`chat-drag.js` 管理拖曳、碰撞、吸附；顯示、還原位置與拖曳共用 `updateBalloonPreviewSide`（靠近畫面左側四分之一時向右顯示，其他向左）。
- 聊天訊息區依 `CommonIsMobile` 啟用拖動；電腦模式保留原生捲軸與滾輪。
- 聯絡人卡片與按鈕圖示經 `ui/icons.js` 引入，使用 `currentColor`，不以局部 CSS 覆蓋素材內的固定顏色。

## 設計原則與注意事項

1. **BC Hook 只放 `core/hooks.js`**（i18n 引擎的 L10N 例外），其餘模組透過事件或函式介入。
2. **不信任對方資料**：動態內容以 `chat-content.js` 的跳脫函式處理（文字節點與引號屬性皆安全）；圖片來源須先信任；PROFILESHARE 接收端限制分塊大小與數量。
3. **IndexedDB 不升版、不阻擋、不無限等待**（見上）。
4. **資料庫 schema 與公開 API 變更必須先討論**；公開 API 以 `apiVersion` 判斷。
5. **新增 UI 文字同步 11 語系**；所有語系必須包含 EN 字典的所有鍵與相同的 `{0}` 佔位符（`roomPublic` 刻意留空）。非 i18n 模組不得寫死中文字串。
6. **SVG 只經 `ui/icons.js` 引入**；`validate-icons.mjs` 在開發與建置前檢查結構、安全性與引用完整性。
7. 測試以邏輯與模擬環境為主，不取代實際遊戲的觸控、視覺與伺服器相容性驗證（見 [verification.md](verification.md)）。

## 驗證

```sh
npm run check          # validate:project + lint + 單元測試 + 建置
npm run test:browser   # Playwright 瀏覽器回歸
```

`tests/browser` 使用正式版 view、styles、拖曳與生命週期，替換遊戲與資料邊界；測試伺服器只綁定 loopback、阻止外部請求、不登入遊戲，也不進入正式 dist。CI 與 hooks 見 [automation.md](automation.md)。

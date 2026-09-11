# FCM 架構與功能分支圖

互動式架構圖：[開啟 FCM 功能分支圖](./fcm-architecture.html)

左側選擇功能，右側顯示「功能 → 模組責任 → 實際檔案」。點擊節點可查看完整路徑。

## 啟動與公開邊界

- `main.js`：防止重複載入並建立 `window.Liko.FCM`。
- `app.js`：組合面板與 FCM CHAT，並直接公開兩者的開關。
- `api/public-api.js`：建立穩定的頭像與 Profiles 整合介面。它與 `app.js` 共同組成 `window.Liko.FCM`；資料庫、HTML、封包與氣球互動細節不對外暴露。

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
- `assets/icons/`：使用 kebab-case 命名的 SVG 原始素材；`scripts/validate-icons.mjs` 會在開發及建置前檢查結構、安全性與引用完整性。

各 CHAT 子目錄的 `index.js` 是分類匯入入口，不承載行為。完整公開介面另見 [FCM public API](./public-api.md)。

## 面板更新與生命週期

`core/hooks.js` 接收 BC 的線上名單、人員進出、房間資料及順序同步；`panel.js` 的 `notifyPanelChange` 統一判斷目前分頁與顯示資料是否有變化，不輪詢重建 DOM。

| 分頁 | 自動更新條件 |
| --- | --- |
| 個人關係 | 訪問、相關玩家上下線變化、使用者修改關係 |
| 房間管理 | 訪問、人員進出、房間資料／順序變更、使用者修改關係 |
| 房間查詢 | 訪問、切換區域、搜尋 |
| 人員查詢 | 訪問、搜尋 |

手動刷新、排序、篩選、分頁與語言切換仍會更新對應 UI。一般房間事件以 60 ms 合併；玩家排序能就地同步時直接更新現有卡片。非同步查詢使用 render token／查詢序號，避免舊結果覆蓋新分頁。

## 玩家排序

`panel/panel-room-order.js` 保留為單一功能模組，內含排序規則、BC 指令轉換及互動狀態；不另拆成單函式工具檔。

- `reordered`：交換／插入的純函式，預覽與放下後顯示共用同一規則。
- `orderCommands`：轉成原生 `Swap` 或連續 `MoveLeft`／`MoveRight`。封包帶 `Publish: false`，要求伺服器不公告移動。
- `renderRoomOrder`：建立固定位置與卡片引用；拖曳以位置命中判斷，避免移動中的卡片造成預覽反覆切換。點選與拖曳共用送出流程。
- `updateRoomOrder`：同步就地確認；忽略插入過程中的中間位置，保留已預覽的最終順序。
- `disposeRoomOrder`：在重建、換頁、關閉、最小化時明確清除拖曳影像、ResizeObserver 與待確認計時器；不依賴 observer 推測頁面是否被移除。

只有房管能操作，送出前再次確認權限及名單順序。放下後先更新 FCM 卡片，不修改 BC 遊戲陣列；等待確認期間禁止重複送出，3 秒未確認則依遊戲實際順序回復。計時器是單次確認期限，不是刷新輪詢。

一般寬度採左右各十人、每組五欄兩排；700 px 以下改上下兩組。自己的頭像有皇冠，重整使用共用 32×32 圓形按鈕；拖曳包含半透明影像與讓位動畫，尊重 `prefers-reduced-motion`。

## 聯絡人卡片與氣球

- `chat-conversation-view.js` 產生卡片；`chat-contact-card.js` 負責開關、拍照與人物操作。`chat-styles.js` 統一控制尺寸與換行，按鈕文字不斷行，必要時整顆按鈕換行。
- SVG 經 `ui/icons.js` 引入；相機、放大鏡、好友圖示都使用 `currentColor`，不以局部 CSS 覆蓋素材內的固定黑色。皇冠則由排序樣式指定金色。
- `chat-balloon.js` 管理氣球定位、顯示與內容；`chat-drag.js` 管理拖曳、碰撞、吸附及共用 `updateBalloonPreviewSide`。
- 顯示生命週期在初次定位、恢復儲存位置及重新顯示後更新預覽方向；拖曳／碰撞移動也使用同一函式。靠近畫面左側四分之一時向右顯示，其他位置向左，無須先拖移。

## 驗證與相關文件

```sh
npm test
npm run lint
npm run build
```

`scripts/panel-room.test.mjs` 驗證排列、拖曳預覽、權限、同步／回復、清理及面板刷新；`scripts/chat-balloon.test.mjs` 驗證初始位置與恢復顯示的方向。其他測試涵蓋 Profile DB、頭像、聊天及私密分享。這些是自動化邏輯測試，不取代實際遊戲的觸控、視覺與伺服器相容性驗證。

- [公開 API](./public-api.md)
- [私密 Profile 分享](./chat-private-sharing.md)
- [圖片來源信任](./image-domain-trust.md)
- [LianChat 相容性](./lianchat-compatibility.md)

本輪不變更上述協定、公開 API 或資料庫 schema；FCM 仍不指定 PROFILES 開庫版本。

# FCM 公開 API

FCM 將穩定的外部整合介面掛載在 `window.Liko.FCM`。外部插件應先確認
`apiVersion`，再使用較新的功能。目前公開 API 版本為 `1`。

```js
const FCM = window.Liko?.FCM;
if (FCM?.apiVersion >= 1) {
    // 使用 FCM API
}
```

玩家編號可使用正整數或僅含數字的字串。無效編號會依介面回傳 `null`、
`false`，或不開啟指定對話。

## 版本資訊

```js
const modVersion = Liko.FCM.version;
const apiVersion = Liko.FCM.apiVersion;
```

- `version`：目前安裝的 FCM 版本字串。
- `apiVersion`：公開 API 的相容性版本。

## 主面板

```js
Liko.FCM.open();
Liko.FCM.close();
Liko.FCM.toggle();
```

- `open()`：開啟或還原 FCM 主面板。
- `close()`：關閉 FCM 主面板。
- `toggle()`：切換主面板的開啟狀態。

## FCM CHAT

```js
Liko.FCM.openChat(123456);
Liko.FCM.openChat();
Liko.FCM.closeChat();
```

- `openChat(memberNumber)`：開啟 FCM CHAT，並在編號有效時開啟該玩家的對話。
- `openChat()`：只開啟聊天面板。
- `closeChat()`：關閉 FCM CHAT。

這些函式只控制 FCM 介面，不直接公開聊天資料庫或封包傳輸器。

## 頭像

```js
const url = await Liko.FCM.avatar.get(123456);
const refreshedUrl = await Liko.FCM.avatar.refresh(123456);
const removed = await Liko.FCM.avatar.remove(123456);
```

### `avatar.get(memberNumber)`

取得玩家頭像。自己的頭像優先採用目前分享設定中的 URL 或快照；對方在同一
房間時先同步其分享頭像，否則讀取 FCM 保存的快照。沒有資料或編號無效時回傳
`null`。

### `avatar.refresh(memberNumber)`

強制重新取得頭像，不會因已有快照而略過。對方在同一房間時使用目前人物；
否則嘗試從已保存的完整 Profile 重建人物、等待素材後再拍攝。無法更新時回傳
`null`。

### `avatar.remove(memberNumber)`

只刪除 FCM 保存的該玩家頭像快照，不會刪除 Profile。有效玩家編號回傳
`true`，無效編號回傳 `false`。

FCM 回傳的 `blob:` URL 由 FCM 管理，呼叫端不得自行執行
`URL.revokeObjectURL()`。

## Profiles

```js
const profile = await Liko.FCM.profiles.get(123456);
const exists = await Liko.FCM.profiles.has(123456);
const opened = await Liko.FCM.profiles.open(123456);
const shared = await Liko.FCM.profiles.share(123456);
```

### `profiles.get(memberNumber)`

取得已保存 Profile 的獨立副本。修改回傳物件不會更動 FCM 快取；沒有紀錄或
編號無效時回傳 `null`。

### `profiles.has(memberNumber)`

判斷是否存在該玩家的 Profile 紀錄，回傳布林值。

### `profiles.open(memberNumber)`

開啟玩家的 `InformationSheet`。優先使用同一房間內的即時人物，否則從已保存
Profile 重建。成功回傳 `true`，資料不足或編號無效時回傳 `false`。

### `profiles.share(memberNumber)`

透過 FCM 的房間分享協定分享已保存的完整 Profile。未在聊天室、編號無效，或
沒有完整 Profile 時回傳 `false`。

## 非公開邊界

下列內容屬於內部實作，不保證跨版本相容：

- Profile 與 Snapshot 資料庫物件
- FCM CHAT 訊息儲存及離線佇列
- HTML presenter 與 DOM controller
- 伺服器封包、WPS 接收處理器
- 氣球拖曳、吸附與碰撞函式
- 內部快取及底線開頭的暫存物件

外部插件應只依賴本頁列出的 `window.Liko.FCM` 介面。

# 與其他插件的整合

## WCE／LCE：Profile 資料庫

FCM 與 WCE、LCE 共用 `bce-past-profiles`。FCM **不指定開庫版本**；LCE 固定 v31 並公開 `Liko.LCE.profileDatabase`，這只是相容資訊，不觸發升版。若 WCE 已保存 Profile，FCM 應設為不儲存以免重複寫入。需要 schema 變更的新功能必須先討論，開庫規則見 [architecture.md](architecture.md#indexeddb-存取規則)。

## PROFILESHARE：房內分享

與 LCE、獨立 Liko-WPS 互通；接收優先序 **FCM > LCE > 獨立 WPS**（FCM 載入時其餘兩者讓出接收）。分享機制與私聊分享一致，細節見 [chat-private-sharing.md](chat-private-sharing.md#與-profileshare、lce、獨立-wps-的一致性)。

## 圖片來源信任

聊天中的圖片網址在來源受信任前**一律不載入**。

- LCE 提供信任 API 時，先呼叫 `Liko.LCE.TrustedImageOrigins.isPermanentlyTrusted()`。
- FCM 另維護只在目前頁面階段有效的記憶體白名單；接受提示只加入此集合，重新整理即清除。
- 拒絕或關閉提示會保留信任按鈕，誤點不會造成永久變更。
- FCM 刻意不提供自己的永久信任儲存，永久信任由 LCE 透過公開 API 管理。

## LianChat：公開資料欄位

FCM 的私人偏好在 `ExtensionSettings.FCM`；其他房間成員需要的資料發布在 `OnlineSharedSettings.FCM`（URL 頭像、手動更新的遊戲頭像快照、簽名、狀態，以及頭像／資料各自的更新時間）。FCM 繼續辨識 LianChat 在 `OnlineSharedSettings.LCData.MessageSetting` 的既有欄位與 `LCPlayerInfo` 帳號 beep；URL 頭像與簽名是共同相容的部分，FCM 的遊戲頭像快照與在線狀態是選用擴充，舊版 LianChat 預期會忽略不認識的欄位。

收到的圖片以 Blob 快取在 IndexedDB；取得 URL 或解碼 data URL 之前，先比對 `avatarUpdatedAt` 與快取紀錄。只有在沒有共享的 FCM 資料也沒有本機快取頭像時，才從遊戲 canvas 擷取房間成員；手動更新刻意略過此規則。

## AFC：個人資料頁

FCM 的 Profile 關係人快速搜尋會把主人／戀人 ID 疊成可點區域，包括 AFC 拓展戀人面板中的條目：AFC 以 priority 7 繪製，FCM 以 priority 8 疊加並優先處理點擊，區塊座標只經 `window.Liko.AFC.getProfileLoverRegions()` 取得。

## Liko MAT／圖片與影片插件

- 翻譯：呼叫 `Liko.MAT.translate`；沒有 MAT 時翻譯按鈕不顯示。MAT 的設定尚未就緒時回傳 `not_ready`，不重試。
- 圖片上傳：使用 `Liko.ImageUploader`；對話在上傳完成前已切換時，以提示框保留連結。
- 影片／媒體播放：由 `LikoVideoPlayerInstance` 處理訊息內容；FCM 負責 UI、路由與草稿。

## BCX

預設遵守 BCX 對私訊與悄悄話的限制（顯示「BCX 阻止發送」）。設定中有預設關閉的繞過選項，啟用後 FCM 以 priority 10 的 Hook 在 BCX 的 priority 5 規則之前處理收發。

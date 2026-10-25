# 翻譯 KEY 清理紀錄

分析方式：逐一比對 `Translation/*.json` 的 key 與 `src/` 內 `T()` / `text()` / `TH()` 等呼叫；動態拼接前綴（`themePreset_*` `graphStyle_*` `roomTab_*` `roomOrder_*` `saveModeDesc_*`）視為使用中。

## 已刪除（29 個，11 個語言檔與 `i18n-fallback.js` 同步）

已確認有新 key 取代，或整段功能已不存在，且全專案（含測試、文件、HTML）無任何引用：

`dbOk` `dbNo` `langNote` `wceDetected` `wceNotDetected` `roomSearchBtn` `roomFavLabel` `fGhost` `roomPrivate` `confirmRoom` `roomGo` `roomReenterConfirm` `roomShareNeedRoom` `friendReqNeedRoom` `sortSeen` `setProfiles` `setProfilesNote` `loadingFriendAvatars` `peopleUnknownName` `themeColorLabel` `chatProfileEditStatus` `chatFontSizeNote` `chatInputPlaceholder` `chatOnlineDiffRoom` `chatPlayerOffline` `chatSaveMessages` `chatSettingsTitle` `chatGroups` `chatThemeLabel`

## 待觀察（保留，下次再確認）

目前沒有程式碼引用，但可能是功能重構中途或之後會回來，故先保留。

### 整組 CHAT 翻譯設定

`chatTranslateAuto` `chatTranslateAutoNote` `chatTranslateEnable` `chatTranslateEnableNote` `chatTranslateEndpoint` `chatTranslateKey` `chatTranslateKeyNote` `chatTranslateProvider` `chatTranslateTarget` `chatTranslateTitle` `chatProvMyMemory` `chatProvLibre` `chatProvCustom` `chatProvDeepl` `chatProvGoogle`

目前翻譯走 MAT（`chat-translation.js`），設定 UI 看似已移除；確認不再自建翻譯服務後可整組刪除。

### 通知音

`notificationAudio` `notificationAudioNote` `chatNotifyAudio` `chatNotifyAudioNote` `chatSoundCustomNote`

`cfg.notificationAudio` 設定仍存在，但文字改用 `chatSoundLabel` / `chatSoundNote`；確認設定頁不再需要後可刪。

### CHAT 主題與圖片網域

`chatThemePreset` `chatThemePresetLabel` `chatThemePresetNote` `chatTrustImageDomain`

主題改用 `themePreset_*`；`image-trust.js` 仍在，需確認其對話框不使用這些字串。

### Profiles 管理與匯入

`profilesTitle` `profilesHint` `profilesEmpty` `profilesTotal` `searchProfiles` `profileRelTitle` `importDone` `importWorking`

`manageProfiles` 與 `importParsing` / `importReading` 仍在使用，這組可能是舊版管理視窗；確認該視窗不再回歸後可刪。

### 房間公開標籤

`roomPublic`

`scripts/validate-project.mjs` 特別註明公開房間不顯示標籤（允許空字串），刪除前需同步調整該檢查。

## 後續建議

- `validate-project.mjs` 目前只檢查「缺 key」；確認清理完成後可加入「未引用 key」檢查（需把上述動態前綴列為白名單）。
- 待觀察項目確認後，直接從 11 個語言檔與 `i18n-fallback.js` 一併刪除，並更新本文件。

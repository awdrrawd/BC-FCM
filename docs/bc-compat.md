# BC 函式掛鉤追蹤（check:bc）

FCM 透過 ModSDK 掛鉤 21 個 BC 函式（`ChatRoomSync`、`ChatRoomMessage`、`InformationSheetRun` 等）。
官方改了函式內容，掛鉤可能悄悄失效，因此用腳本比對。做法移植自 BC-AEE。

- `scripts/check-bc-compat.mjs`：掃描 `src/` 的 `hookFunction`／`patchFunction`／`callOriginal` 呼叫，
  在 BC 原始碼中找出對應的頂層函式，以 ModSDK 相同的 CRC32 計算雜湊。
- `scripts/bc-compat-baseline.json`：目前基準為 R133。
- `.github/workflows/bc-compat.yml`：每週一比對；有差異時建立標籤為 `bc-compat` 的 issue；差異內容改變時更新內文並留言，差異消失後自動關閉。不阻擋 PR 與部署。
- `scripts/bc-compat-issue.mjs`：由 workflow 呼叫，負責建立／更新／關閉 issue（以差異內容簽章去重，內容沒變不重複通知）。
- `scripts/bc-compat.test.mjs`：由 `npm test` 執行。

```sh
npm run check:bc -- --bc-dir <BC 原始碼資料夾>            # 與基準比對；有差異時結束碼為 1
npm run check:bc -- --bc-dir <BC 原始碼資料夾> --update   # 確認掛鉤仍正確後更新基準
```

「已改變」只代表函式內容不同，需人工判斷掛鉤是否仍成立；「不再存在」代表掛鉤會安裝失敗。

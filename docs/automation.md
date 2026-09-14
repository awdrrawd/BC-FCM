# 自動化與維護設定

## GitHub Actions

`.github/workflows/deploy.yml` 在 PR、main push 或手動觸發時執行 `quality`：

1. Node 24、`npm ci` 安裝 lockfile 指定版本。
2. `npm run check`：文件引用／靜態匯入循環／翻譯缺漏檢查、Lint、單元測試、正式建置與 SVG 檢查。
3. 安裝 Chromium，執行 `npm run test:browser`。
4. 失敗時保存瀏覽器截圖、trace 與報告 7 天。

只有 main 的非 PR 執行能在全部檢查成功後部署 Pages；PR 沒有 Pages 或 OIDC 寫入權限。測試 fixture 不進入正式 dist。

使用者需要設定：

- 將修改提交／推送至 GitHub；本機修改不會啟動遠端 CI。
- Repository → Settings → Actions：允許此工作流程所用的官方 GitHub Actions。
- Settings → Pages → Source：選擇 GitHub Actions。
- 建議在 main 的 Ruleset／Branch protection 要求 PR 與 `quality` 檢查成功，禁止略過檢查；檢查名稱需在 workflow 首次執行後選取。
- 若 `github-pages` environment 有人工審核要求，發布仍須由你批准。不要為了 CI 移除你原有的保護規則。

不需要額外設定遊戲帳號、密碼或 API key。工作流程的內建 token 只在部署 job 取得必要權限。

## 本機驗證

```sh
npm ci
npx playwright install chromium
npm run check
npm run test:browser
```

若 Windows 的 Chromium 下載受網路限制，可以使用已安裝的 Edge：

```powershell
$env:FCM_TEST_CHANNEL = 'msedge'
npm run test:browser
```

測試工具使用獨立瀏覽器環境，不接管使用者的遊戲分頁。失敗報告在 `playwright-report`／`test-results`，兩個目錄均不提交 Git。CI 固定使用 Chromium，不依賴本機 Edge。尚無跨作業系統的像素基準圖；目前用實際排版位置、CSS 狀態及互動斷言，失敗時附截圖。

## 文件與翻譯检查

`npm run validate:project` 檢查 docs 相對連結、架構圖模組引用、src 的靜態相對匯入與循環，以及 EN 字典的翻譯缺漏。外部連結不發網路請求。DE／ES／FR／JA／KO／RU／UA／VI 的 7 個排序字串已補齊；所有 11 個語系都必須包含 EN 字典的鍵，不再保留缺漏例外。這不是完整 JavaScript 語意或動態依賴分析，仍搭配正式建置檢查。

## 每週相容性巡檢

Codex 排程附在目前任務，預定台北時間每週一 10:00。檢查 BC、LCE、WCE 與 FCM 相關介面、PROFILES 版本契約及依賴安全公告。對比前次巡檢證據，只在出現有意義的變更、失敗或需要決策時報告。

- 執行時電腦需開機、Codex 桌面程式需運作，專案與相關原始碼路徑須存在。
- 公開上游查詢需要網路權限；私有來源需要已有的授權，不能取得時會報告缺少的權限，不會繞過。
- 排程只讀、不修改 checkout、不提交／推送、不部署、不發送遊戲操作、不自動升版資料庫或套件。FCM 不指定 PROFILES 版本；LCE 固定版本的變更必須先討論。
- 可在桌面程式的排程頁調整時間或暫停。GitHub CI 與此本機排程是獨立機制。

官方執行條件：[Scheduled tasks](https://learn.chatgpt.com/docs/automations?surface=app)。

## 本次驗證注意事項

2026-09-14 翻譯巡檢：頭像下拉、字型選單、關注提示與說明頁統一使用翻譯字典；66 個原先僅存在 TW／EN 備援字庫的鍵已補至全部 11 語系。說明頁重用設定頁的已翻譯說明，不再維護中英文分支。字型正式名稱、語言自稱、品牌及開發註解不視為漏翻譯。

`scripts/i18n.test.mjs` 檢查非 i18n 模組中的寫死中文字串（排除 CSS 註解與字型量測樣本）、靜態翻譯鍵、備援鍵與完整字典的一致性，並在 11 語系驗證說明頁與通用字型名稱。專案驗證另檢查空字串與 `{0}` 等佔位符；`roomPublic` 刻意留空以隱藏公開房間標籤。這些檢查不代表所有動態組合鍵或譯文語意均可自動驗證。

2026-09-14：聊天訊息區依 BC 的 `CommonIsMobile` 布林旗標啟用拖動；電腦模式不攔截拖曳，保留原生捲軸與滾輪，手機模式保留拖動。完整重繪與切換對話採用相同規則；手機預設合併及訊息操作共用同一判斷，已儲存的版面選擇不受影響。`scripts/chat-scroll.test.mjs` 覆蓋旗標、版面保留、拖動與重繪入口。

2026-09-13 的安全維護已修復原先 6 個 high 開發依賴項目。僅更新既有 semver 範圍內的 lockfile，未使用 `--force`、額外 overrides 或跨主要版本升級；當次 npm audit 回報 0 個已知漏洞。此結果只代表當時公告狀態，後續仍需定期檢查。

| 套件 | 原版本 | 修復後版本 |
| --- | --- | --- |
| brace-expansion | 1.1.15 | 1.1.18 |
| concurrently | 9.2.3 | 9.2.4 |
| js-yaml | 4.3.0 | 4.3.2 |
| nanoid | 3.3.15 | 3.3.19 |
| postcss | 8.5.16 | 8.5.28 |
| shell-quote | 1.8.4 | 1.9.0 |

使用 `npm ci` 重現 lockfile，使用 `npm audit` 重新查詢目前公告。瀏覽器測試可驗證模擬同步與 UI，不代表真實 BC 伺服器相容性已驗證。

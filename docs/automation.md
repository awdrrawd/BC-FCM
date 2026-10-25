# 自動化與開發檢查

## 指令

| 指令 | 內容 |
|---|---|
| `npm run check:quick` | 專案驗證 + ESLint（commit 前 hook 使用） |
| `npm run check` | `validate:project` + lint + 單元測試 + 正式建置（含 SVG 檢查） |
| `npm run test:browser` | Playwright 瀏覽器回歸 |
| `npm run check:all` | `check` + `test:browser`（push 前 hook 使用） |
| `npm run check:bc -- --bc-dir <路徑>` | BC 函式掛鉤追蹤，見 [bc-compat.md](bc-compat.md) |

`npm run validate:project` 檢查：docs 的相對連結、架構圖引用的檔案、`src` 的靜態相對匯入與循環、以及 EN 字典的翻譯缺漏（11 語系的鍵、空字串與 `{0}` 佔位符；外部連結不發網路請求）。這不是完整的 JavaScript 語意或動態依賴分析，仍搭配正式建置。`scripts/i18n.test.mjs` 另檢查非 i18n 模組中寫死的中文字串、靜態翻譯鍵與備援鍵一致；字型正式名稱、語言自稱與品牌不視為漏翻譯。

## 本機 Git hooks

使用 Node.js 24 與 Git。首次 clone 後：

```bash
npm ci
npx playwright install chromium
npm run hooks:install
```

`hooks:install` 只設定目前 repository 的 `core.hooksPath`，每個新 clone 都要各自執行；已有自訂 hooks 請先整合，因為此設定會取代原本路徑。macOS／Linux 另需 `chmod +x .githooks/*`。Windows hooks 透過 `cmd.exe` 呼叫 `npm.cmd`，避免 GitHub Desktop 的精簡 Git 環境誤用需要 Bash 的 npm script；安裝 Node.js 後若 Desktop 尚未取得新的 PATH，請重新啟動它。

| 時機 | 工作 | 失敗時 |
|---|---|---|
| `git commit` 前 | `check:quick` | 中止提交 |
| `git push` 前 | `check:all`（檢查、單元測試、建置、瀏覽器回歸） | 中止推送 |

hooks 檢查的是整個工作目錄，不是暫存區或每個待推送 commit 的快照；部分暫存提交與推送其他分支時，以 GitHub 對該 commit 的 CI 為準。只刪除遠端分支的推送不執行驗證。`dist/` 不納入版本控制，發布用的 `main.js`、`app.js` 由 CI 建置後部署。

停用：`git config --local --unset core.hooksPath`（原本有自訂路徑請恢復原值）。不影響 GitHub CI。

### Windows 使用 Edge

Chromium 下載不可用但已安裝 Edge 時，可只為此 clone 設定：

```bash
git config --local fcm.testChannel msedge        # push hook 會讀取；移除用 --unset
```

手動執行測試需在 PowerShell 設定 `$env:FCM_TEST_CHANNEL = 'msedge'`；明確指定的環境變數優先於 git 設定。CI 固定使用 Chromium。測試使用獨立瀏覽器環境，不接管你的遊戲分頁；失敗報告在 `playwright-report`／`test-results`（均不提交 Git）。目前沒有跨作業系統的像素基準圖，改用實際排版位置、CSS 狀態與互動斷言，失敗時附截圖。

## GitHub Actions

`.github/workflows/deploy.yml`（名稱 `quality`）在 PR、main push 或手動觸發時：

1. Node 24、`npm ci`（依 lockfile）。
2. `npm run check`。
3. 安裝 Chromium，執行 `npm run test:browser`；失敗時保存截圖、trace 與報告 7 天。
4. 確認 `dist/` 不含 `tests`（瀏覽器 fixture 不進正式產物）。

只有 main 的非 PR 執行能在全部通過後部署 Pages；PR 沒有 Pages 或 OIDC 寫入權限。不需要設定遊戲帳號、密碼或 API key。

`.github/workflows/bc-compat.yml` 每週一比對 BC 函式雜湊，差異以標籤 `bc-compat` 的 issue 回報，不阻擋 PR 與部署。`dependabot.yml` 負責依賴更新。

### 需要在 GitHub 設定

- Settings → Actions：允許此工作流程使用的官方 Actions。
- Settings → Pages → Source：選擇 **GitHub Actions**。
- 建議在 main 的 Ruleset／Branch protection 要求 PR 與 `quality` 檢查通過（檢查名稱須在 workflow 首次執行後才能選取）；這無法由本機 hooks 強制。
- 若 `github-pages` environment 有人工審核要求，發布仍須你批准，不要為了 CI 移除原有保護。

## 依賴安全

依賴更新用 `npm ci` 重現 lockfile、`npm audit` 查詢目前公告。只更新既有 semver 範圍內的 lockfile，不使用 `--force`、額外 overrides 或跨主要版本升級。

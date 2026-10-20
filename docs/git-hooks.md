# FCM 開發自動化

## 本機啟用

使用 Node.js 24 與 Git。首次 clone 後執行：

```bash
npm ci
npx playwright install chromium
npm run hooks:install
```

`hooks:install` 只設定目前 repository 的 `core.hooksPath`，每個新 clone
都需要各自執行。若已有自訂 hooks，請先整合，因為此設定會取代原本路徑。
macOS/Linux 使用者另需執行 `chmod +x .githooks/*`。

Windows hooks 透過 `cmd.exe` 呼叫 `npm.cmd`，避免 GitHub Desktop 的精簡
Git 環境誤用需要 Bash 的 npm shell script。安裝 Node.js 後，若 Desktop
尚未取得新的 PATH，請重新啟動 Desktop。

## 自動執行的檢查

| 時機 | 工作 | 失敗時 |
| --- | --- | --- |
| `git commit` 前 | 文件引用、模組依賴、翻譯完整性與 ESLint | 中止提交 |
| `git push` 前 | 上述檢查、單元測試、正式建置及 Playwright 瀏覽器回歸 | 中止推送 |
| GitHub PR / main push | 乾淨環境安裝鎖定依賴，執行完整檢查及瀏覽器測試 | workflow 失敗，不部署 |
| main 檢查成功 | 將 dist 部署至 GitHub Pages | 部署結果見 Actions |

本機 hooks 檢查目前整個工作目錄，不是暫存區或每個待推送 commit 的快照。
部分暫存提交及推送其他分支時，以 GitHub 對該 commit 的 CI 結果為準。
建置可能更新已追蹤的 `dist/assets`；請在提交前檢視變更並依發布流程納入。
只刪除遠端分支的推送不執行本機驗證。

可隨時手動執行：

```bash
npm run check:quick
npm run check:all
```

瀏覽器未安裝時執行 `npx playwright install chromium`；
Linux 若缺少系統依賴，使用 `npx playwright install --with-deps chromium`。

Windows 已安裝 Edge 且 Chromium 下載不可用時，可只為此 clone 設定：

```bash
git config --local fcm.testChannel msedge
```

推送 hook 會讀取此設定，明確指定的 `FCM_TEST_CHANNEL` 環境變數優先。
手動測試仍須先在 PowerShell 設定 `$env:FCM_TEST_CHANNEL = 'msedge'`。
使用 `git config --local --unset fcm.testChannel` 可移除此覆寫；CI 不受影響。

## GitHub 設定

既有 workflow 位於 [deploy.yml](../.github/workflows/deploy.yml)，
瀏覽器失敗診斷保留 7 天。GitHub Pages 的來源需設定為 GitHub Actions。
建議 main 分支規則要求 `quality` 狀態通過才允許合併；
此規則需要在 GitHub repository 設定，並非本機 hooks 能強制執行。

## 停用本機 hooks

若此 repository 原本沒有自訂 hooks 路徑：

```bash
git config --local --unset core.hooksPath
```

若原本有自訂路徑，請恢復原值。停用本機 hooks 不影響 GitHub CI。

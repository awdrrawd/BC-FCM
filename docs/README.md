# FCM 技術文件

供維護者與其他插件作者使用；安裝與功能介紹見[專案 README](../README.md)。

**🗺 互動式架構圖：[開啟 FCM 架構與功能分支圖](https://awdrrawd.github.io/BC-FCM/docs/fcm-architecture.html)**（GitHub Pages）  
依「前端 UI → 服務／協定 → 資料 → BC 邊界」列出每個功能的模組與實際檔案，可搜尋、切換深淺色。離線或本機查看請直接開啟 [fcm-architecture.html](fcm-architecture.html)；文字版見 [architecture.md](architecture.md)。

| 文件 | 用途 |
|---|---|
| [architecture.md](architecture.md) | 模組邊界、Hook、面板更新、資料與 IndexedDB 規則、設計原則 |
| [fcm-architecture.html](https://awdrrawd.github.io/BC-FCM/docs/fcm-architecture.html) | 互動式功能分支圖（Pages 線上版；功能 → 模組 → 檔案，依前端到後端排列） |
| [public-api.md](public-api.md) | `window.Liko.FCM` 公開 API（`apiVersion` 1） |
| [chat-private-sharing.md](chat-private-sharing.md) | 私密 Profile 分享與 PROFILESHARE 一致性規則 |
| [integrations.md](integrations.md) | WCE／LCE／LianChat／AFC／MAT／BCX 整合 |
| [bc-compat.md](bc-compat.md) | BC 函式掛鉤追蹤（`check:bc`） |
| [automation.md](automation.md) | 指令、Git hooks、GitHub Actions、依賴安全 |
| [translation-review.md](translation-review.md) | 翻譯 KEY 清理紀錄：已刪除項目與**待觀察**的未引用 key |
| [verification.md](verification.md) | **待辦**：尚需遊戲內驗收的項目 |

## 維護原則

- 文件只描述**現況**；已完成的修補不留流水帳，待驗證項目放 `verification.md`，完成即刪。
- 資料庫 schema 與公開 API 的變更先討論；公開 API 以 `apiVersion` 區分。
- `npm run validate:project` 會檢查本資料夾的相對連結與 `fcm-architecture.html` 內列出的檔案路徑；刪除或改名文件、模組前先執行它。
- 修改後：`npm run check`，涉及介面再執行 `npm run test:browser`。

# 翻譯 KEY 清理

已從 11 個語言檔與內建 fallback 移除 33 個未使用 key，涵蓋舊版翻譯設定、音效標籤、主題、圖片信任、Profiles 管理及空白公開房間標籤。

翻譯目前由 MAT 整合提供，音效與主題設定使用現行介面的 key。清理僅移除未使用文字，不影響已保存的使用者設定。

`npm run validate:project` 檢查 `src/` 的文字引用，內建 fallback 不視為使用來源。動態前綴 `themePreset_*`、`graphStyle_*`、`roomTab_*`、`roomOrder_*`、`saveModeDesc_*` 仍保留；不再為未使用 key 維護暫存白名單。

刪除最後一處介面引用時，需同步刪除語言檔與 fallback 的對應項目。

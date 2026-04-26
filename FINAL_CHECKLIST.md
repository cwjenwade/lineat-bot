# Final Checklist — Vercel Interactive Story Direction

已完成
- 建立互動繪本資料模型規格（`story-schema.md`）。
- 建立示範故事 JSON（`public/stories/example/story.json`）。
- 建立最小可用互動閱讀器（`public/story/index.html`, `app.js`, `styles.css`）。
- 撰寫產品方向與策略文件（`PRODUCT_DIRECTION.md`）。
- 撰寫資產規範（`STORY_ASSET_CONVENTION.md`）與作者邊界（`AUTHORING_BOUNDARY.md`）。
- 撰寫 LINE 導流策略（`LINE_ENTRY_STRATEGY.md`）。
- 建立 Story Module 計畫文件（`STORY_MODULE_PLAN.md`）。
- 建立架構盤點（`ARCHITECTURE_PIVOT_AUDIT.md`）。
- 更新遷移決策（`MIGRATION_DECISIONS.md`）以正式廢止 Cloudflare 為主路線。

待手動處理
- 在 Vercel 中部署網站並測試 `/story?storyId=example` 是否正常。 
- 將現有作者工具輸出（靜態 story 資料與圖片）放入 `public/stories/<story-id>/` 並部署。 
- 將 LINE 回覆邏輯更新為導流（如保留 LINE 功能）。 
- 整理並移除不再使用的 Cloudflare 資源（Cloudflare Dashboard 手動操作）。

執行過的命令（此輪）
- `node` / `grep` 檢索程式碼以找出與 LINE / Cloudflare 相關引用（供風險評估）。
- 建立文件與前端模組檔案（詳下變更清單）。

總結
- 已完成策略轉向的所有文件與最小可用前端讀取器，現階段的重點為把作者端產出物部署到 Vercel，並在 Vercel 上測試互動流程。
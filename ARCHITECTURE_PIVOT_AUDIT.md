# Architecture Pivot Audit

三欄盤點：保留參考、應停止／廢止、移轉到 Vercel 前端互動系統

| 保留作參考（但不作為正式部署） | 應停止維護或廢止（立即停止） | 移轉到 Vercel 前端互動系統（下一步） |
|---|---|---|
| - 原始 Render 專案程式碼（`index.js`, `admin.js`, `lib/lineatRenderer.js`）可作為參考或遷移邏輯範例。 | - Cloudflare Workers 程式（`line-cloudflare-bot`／`wrangler.toml`／`src/index.js`）不再作為正式上線後端。 | - 前端互動繪本模組（路由 `/story`），部署到 Vercel，作為主要閱讀介面。 |
| - Render 上運行時（如仍可存取）作為回滾或比對環境。 | - R2 物件儲存（`story-images`）、`R2_PUBLIC_BASE_URL`、`r2.dev`、`workers.dev` 作為正式儲存或主架構。 | - 靜態資產策略：`public/stories/<story-id>/story.json` 與 `public/stories/<story-id>/images/*`，由 Vercel 靜態提供。 |
| - 本機作者工具（作者端 CLI / admin UI）保留作編輯/產出流程。 | - 以 LINE webhook 關鍵字回應作為核心閱讀引擎。 | - 前端互動閱讀器（單頁應用或輕量 Vanilla JS）讀取靜態 JSON，呈現節點式互動。 |
| - `scriptAnalyzer.js`、`scriptImport.js` 等供內容產製/分析之工具，保留供作者端使用。 | - 把產製流程直接暴露為上線服務（不要把本機 admin 部署到 Vercel 為閱讀 runtime）。 | - Vercel 上的路由 `/story/:storyId` 與封面/導流頁，整合品牌網站首頁/導流按鈕（可從 LINE 或其他渠道導流）。 |

> 備註：此盤點目的是在產品策略轉向下，清楚區分「產製/作者工具」與「正式閱讀 runtime」的責任範圍。所有 Cloudflare 相關資源在此策略下列為不再採用項目。
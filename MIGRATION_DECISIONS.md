# Migration Decisions — Product Pivot to Vercel

本文件正式說明：產品路線已由 Cloudflare-centered 轉向 Vercel-centered。

已決定且正式廢止的項目：

- 不再走 Cloudflare Workers 作為正式上線方案。Workers 仍可作為實驗環境，但不是主架構。 
- 不再使用 R2 作為繪本圖片儲存（立即停止以 R2 為主的設計）。
- 不再依賴 `workers.dev` 或 `r2.dev` 作為正式部署域名。 
- 不再把數位繪本定義為 LINE webhook 關鍵字系統；LINE 僅作為導流入口。 

新的正式架構：

- 產製層：本機作者工具負責內容創作、圖片生成與靜態包輸出（`public/stories/<story-id>/`）。
- 閱讀層：Vercel 承載前端互動繪本（`/story` 路由），讀取靜態輸出。 

策略說明：

- 這是產品策略轉向，不是單純技術替換。目標是降低運維複雜度、提高對讀者的體驗一致性，並明確分工作者端與閱讀端。
- 若未來需要重新引入動態圖片生成或 server-side 功能，必須另行設計獨立服務（例如專用的渲染 microservice），而非回退到舊 Render 或把作者工具當成正式 runtime。
# Migration Decisions（Render -> Cloudflare）

本次遷移策略是：**以全新 Cloudflare 架構取代舊 Render 架構，不做原樣搬移**。

## 正式標註「不再遷移」項目

以下內容在本次方案中明確排除，不納入 Cloudflare Worker 程式：

1. `index.js` 的 Express server 架構
2. `admin.js` 的 child process admin server
3. `lineatRenderer.js` 的 `canvas` / `sharp` / `fs` 動態圖片管線
4. `uploads/` 本機上傳資料夾流程
5. `generated/` 本機生成資產流程
6. 任何本機持久化流程（依賴主機磁碟）

## 新架構原則

- webhook 後端只跑在 Cloudflare Workers。
- 圖片資產改為「離線預先產出 + 上傳至 R2」。
- Worker 僅負責依關鍵字回覆文字或圖片 URL，不進行重度運算。

## 未來擴充聲明

若日後需要恢復動態圖片生成，必須另行設計**非 Render**的新方案（例如獨立圖片服務、批次生成工作流、或其他可行的雲端架構），不得直接回退到舊 Render 寫法。

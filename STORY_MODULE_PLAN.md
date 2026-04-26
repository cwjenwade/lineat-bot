# Story Module Plan

目標：在既有品牌網站中加入互動繪本模組，路由為 `/story`（主入口），並在 Vercel 上部署為同一專案的一部分。

技術棧分析

- 目前專案沒有完整前端 framework（有部分 `public/` 靜態資源與小型 admin HTML）。因此建議採用：
  - 輕量級前端：React 或 Preact（若未來擴充），或先以 Vanilla JS 開發最小可用器（快速上線、易整合）。
  - 部署：Vercel（同一專案）

建議資料夾結構（在專案根目錄）

- `public/stories/`  (靜態輸出)
  - `<story-id>/`
    - `story.json`
    - `images/` (背景、角色、插圖)
- `public/story/` (前端互動入口)
  - `index.html` (路由 `/story`) 
  - `app.js`  (最小互動器)
  - `styles.css`
- `src/story-module/`（可選，若使用框架則放 React code）

路由與整合

- 使用 Vercel 靜態部署，`public/story/index.html` 對應 `/story`。
- 透過網址路徑 ` /story?storyId=<story-id>` 或 ` /story/<story-id>` 加載特定故事。初期建議使用 query 參數以降低路由複雜度。 
- 品牌首頁、LINE 導流連結等，將導向 `https://<site>/story?storyId=<story-id>`。

開發與部署步驟（概要）

1. 建立 `public/stories/<example>/story.json` 與 sample 圖片。 
2. 建立 `public/story/index.html` 與 `app.js`（最小互動閱讀器）。
3. 本地測試（`vercel dev` 或直接打開 `public/story/index.html`）。
4. 部署到 Vercel（同一專案）。

擴充考量

- 若未來需要多人協作或狀態同步，可接入 KV / serverless API，但首階段不建議。 
- 若選擇 React/Preact，可把 `src/story-module/` 作為元件庫，並透過 Vercel 構建流程生成靜態頁面。
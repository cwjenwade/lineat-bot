# Current Runtime Status

## 目前真正可執行的入口
- 入口頁：`public/story/index.html`
- 互動腳本：`public/story/app.js`
- 樣式：`public/story/styles.css`
- 範例故事：`public/stories/example/story.json`

## 如何切換 storyId
- 透過 query string：`/story?storyId=example`
- 也支援路由式路徑：`/story/example`
- 目前預設 storyId 為 `example`

## 目前已驗證成功的能力
- 可從本地靜態伺服器載入 `index.html`
- 可讀取 `app.js`、`styles.css`
- 可讀取 `public/stories/example/story.json`
- 可顯示起始節點 `n1`
- 可顯示角色名稱、對話文字、背景圖、角色圖
- 可顯示選項按鈕並跳轉到下一節點
- 當節點只有 `next`、沒有 `options` 時，可以按「下一步」前進
- 已驗證 `storyId` 路由解析與 `start` / node 對應存在性

## 目前還不能做的事
- 尚未接資料庫或雲端同步
- 尚未接登入系統
- 尚未接後端 API
- 尚未正式部署到 Vercel 網址
- 尚未整合多本實際故事內容（目前只有 example 範例）
- 尚未加入圖片預載、音效、存檔或章節進度保存

## 是否已可部署到 Vercel 測試
- **可以進行靜態測試部署。**
- 目前前端已能以靜態資產方式運作，適合先部署到 Vercel 驗證 `/story` 互動頁。
- 但正式上線前仍需補齊品牌網站整合、更多故事資料與內容產製流程對接。

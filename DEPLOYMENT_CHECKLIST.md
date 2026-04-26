# Deployment Checklist — Vercel First

這份清單用來在正式部署前確認：Vercel 前台、LINE webhook、作者後台、與故事靜態資產的邊界是否清楚。

## 1) Vercel 環境變數

在 Vercel Dashboard 設定以下環境變數：

### 必要
- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`

### 建議設定
- `PUBLIC_BASE_URL` = `https://debbylinehose.vercel.app`
  - 用來產生故事連結、公開網址、以及 webhook 回覆中的絕對 URL。

### 不需要在 Vercel Dashboard 設定的項目
- `dotenv` 相關設定檔
  - Vercel 上線時會直接讀 Dashboard 的環境變數，不依賴本機 `.env`。

## 2) LINE Developers webhook 設定

在 LINE Developers / Messaging API 頁面確認：

- Webhook URL 設為 `https://debbylinehose.vercel.app/webhook`
- Webhook 已啟用
- 若有測試用 URL，請確認也指向同一個 Vercel 網域
- Rich Menu / 圖文選單的連結改指向 Vercel 公開頁
  - 首頁：`https://debbylinehose.vercel.app/`
  - 預設故事：`https://debbylinehose.vercel.app/story`
  - 指定故事：`https://debbylinehose.vercel.app/story/<storyId>`

## 3) 部署後測試步驟

### 前台測試
1. 開啟 `https://debbylinehose.vercel.app/`
2. 確認首頁可載入
3. 開啟 `https://debbylinehose.vercel.app/story`
4. 開啟 `https://debbylinehose.vercel.app/story/example`
5. 確認找不到的故事 ID 會顯示友善錯誤或 fallback 訊息

### 後台測試
1. 開啟 `https://debbylinehose.vercel.app/admin`
2. 確認頁面可正常載入
3. 開啟 `https://debbylinehose.vercel.app/admin-api/logs`
4. 確認回傳 JSON

### webhook 測試
1. 對 `https://debbylinehose.vercel.app/webhook` 發送 GET，確認回傳 `200`
2. 對同一網址送出沒有正確 LINE 簽章的 POST，確認回傳 `401`
3. 用 LINE Developers 的 webhook 驗證或真實 LINE 帳號發送：
   - `開始`
   - `繪本`
   - `今日故事`
   - 一個已知故事關鍵字
4. 確認回覆內容正確，且連結指向 Vercel 網域

### 部署驗證
1. 在 Vercel Dashboard 查看 Function Logs
2. 確認 `/api/webhook` 沒有 500
3. 確認 `/api/admin` 沒有因為寫檔權限失敗而中斷首頁

## 4) 已知限制

- Vercel Function 不是永久 Node server，不能依賴常駐記憶體或背景工作
- `Map` 類 session 僅適合短期快取，不能當作正式持久狀態
- 本機檔案系統在 Vercel function 中不保證持久
- `public/uploads/`、`public/generated/`、`data/story-authoring.json` 這類磁碟寫入，只能視為本機或暫時執行環境行為
- 大量圖片處理、長時間轉檔、批次產圖，不適合放在 Vercel function
- 直接把 Git push / commit 當作線上功能，不適合放在 Vercel runtime
- 高頻率檔案刪除、清理、重建不應依賴 Vercel function

## 5) 不能在 Vercel 上做的事項

以下事項不要把 Vercel function 當成正式持久層：

- 長時間常駐的 Node 伺服器
- 永久檔案儲存
- 需要跨 request 維持的大型 session cache
- 大量圖片生成與轉檔
- 背景排程式清理工作
- 直接依賴本機 `fs` 做正式內容保存
- 需要持續寫入的媒體資產管理

## 6) 目前功能分工

### 可在 Vercel 正常執行
- `/`：首頁與導流頁
- `/story` 與 `/story/:storyId`：靜態繪本閱讀頁
- `/api/webhook`：LINE webhook 訊息處理
- `/admin`：作者介面首頁與輕量操作頁
- `/admin-api/*`：作者介面 API（只要不依賴永久磁碟即可）

### 可暫時執行但不保證持久
- `Map` 型 session cache
- `public/uploads/` 寫檔
- `public/generated/` 寫檔與刪檔
- `data/story-authoring.json` 寫入
- 管理頁中會觸發的短期檔案處理

### 不適合放 Vercel function
- 依賴長駐狀態的 runtime
- 需要可靠持久化的檔案儲存
- 大型圖片批次產生
- 使用 Git 當正式資料庫或正式儲存
- 任何需要背景 process 長時間運作的功能

## 7) 部署前最後確認

- [ ] `vercel.json` rewrites 已更新
- [ ] `api/webhook.js` 可回傳 200 / 401
- [ ] `api/admin.js` 可載入 admin app
- [ ] `README.md` 未把 Render 當正式部署
- [ ] `PUBLIC_BASE_URL` 指向 `https://debbylinehose.vercel.app`
- [ ] LINE webhook URL 已更新
- [ ] 故事頁可讀取 `public/stories/<storyId>/story.json`
- [ ] 沒有把 Vercel function 當永久儲存層使用

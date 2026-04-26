# Cloudflare Workers 部署操作手冊

> 注意：Workers 是短請求執行環境，不適合重運算或大量緩衝工作。

## 1) 安裝 Wrangler

```bash
npm install -g wrangler
wrangler --version
```

## 2) 登入 Cloudflare

```bash
wrangler login
```

## 3) 建立 R2 bucket

```bash
wrangler r2 bucket create story-images
```

## 4) 設定 R2 公開存取或 custom domain

1. 前往 Cloudflare Dashboard。
2. 進入 R2 -> `story-images`。
3. 選擇：
   - 設為公開讀取（public）或
   - 綁定自訂網域（custom domain）。
4. 取得最終公開網址基底（例如 `https://cdn.example.com`）。

## 5) 設定 LINE Access Token（Secret）

```bash
wrangler secret put CHANNEL_ACCESS_TOKEN
```

依提示貼上 LINE Channel Access Token。

## 6) 設定 `R2_PUBLIC_BASE_URL`

### 本機開發

建立 `.dev.vars`（可從 `.dev.vars.example` 複製）：

```bash
cp .dev.vars.example .dev.vars
```

填入：

```dotenv
CHANNEL_ACCESS_TOKEN=你的token
R2_PUBLIC_BASE_URL=https://你的公開R2網域
```

### 正式環境

在 Cloudflare Dashboard 的 Worker 設定 Variables，新增：

- `R2_PUBLIC_BASE_URL`（一般文字變數）

## 7) 本地測試

```bash
wrangler dev
```

## 8) 正式部署

```bash
wrangler deploy
```

## 9) 設定 LINE Webhook URL

1. 複製部署後 Worker URL（例如 `https://line-cloudflare-bot.<subdomain>.workers.dev`）。
2. 到 LINE Developers Console。
3. 將 webhook URL 更新為 Worker URL。
4. 開啟 webhook（如尚未開啟）。

## 10) 驗證 webhook 收送

1. 在 LINE Developers Console 測試 webhook 驗證。
2. 實際在 LINE 聊天室輸入關鍵字：`開始`、`左`、`右`、`再來一次`、`幫助`。
3. 確認文字與圖片回覆正常。
4. 若圖片失敗，先檢查 `R2_PUBLIC_BASE_URL` 與物件公開權限。

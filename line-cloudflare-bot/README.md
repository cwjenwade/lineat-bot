# line-cloudflare-bot

全新 Cloudflare Workers 專案，用來正式取代原先 Render 上的 LINE webhook 後端。

## 架構重點

- 執行環境：Cloudflare Workers（JavaScript ES Modules）
- 入口：`src/index.js`
- 關鍵字節點維護入口：`src/storyMap.js`
- 圖片網址組裝：`src/utils.js`
- 圖片儲存：Cloudflare R2（bucket: `story-images`）

## 重要限制（已正式採用）

- 本系統**不再支援**伺服器端即時圖片生成。
- 所有圖片都必須**預先產出**，再上傳到 R2。
- 本系統不再依賴 `generated/`、`uploads/` 等本機目錄。
- 本系統不使用 Render 的 Node/Express 執行方式。

## 環境變數

請以 `.dev.vars.example` 建立本地 `.dev.vars`：

- `CHANNEL_ACCESS_TOKEN=`
- `R2_PUBLIC_BASE_URL=`

## R2 公開存取說明

- R2 bucket 預設不是公開的。
- 正式環境請設定 **public bucket** 或 **custom domain**。
- `r2.dev` 僅適合非正式用途，不建議直接做正式流量入口。

## 圖片上傳

使用腳本將 `images/` 全部上傳到 R2：

```bash
bash scripts/upload-to-r2.sh
```

腳本會使用 `wrangler r2 object put` 上傳到 `story-images`。

## 本地開發

```bash
wrangler dev
```

## 部署

```bash
wrangler deploy
```

完整流程請看 `DEPLOY_STEPS.md`。

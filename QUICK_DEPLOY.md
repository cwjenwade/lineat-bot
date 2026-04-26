# Quick Deploy — Vercel

這份文件只保留正式上線需要做的最短步驟。

## 1) Vercel 環境變數

在 Vercel Dashboard 設定：

- `LINE_CHANNEL_ACCESS_TOKEN`
- `LINE_CHANNEL_SECRET`
- `PUBLIC_BASE_URL=https://debbylinehose.vercel.app`

## 2) LINE Developers webhook

把 Webhook URL 設為：

```text
https://debbylinehose.vercel.app/webhook
```

並確認：

- Webhook 已啟用
- LINE OA 指向的是正式 Vercel 網域
- Rich Menu 或訊息中的連結也都指向 Vercel 網域

## 3) 部署後測試訊息

部署完成後，從 LINE 傳送以下訊息：

- `開始`
- `繪本`
- `今日故事`
- 一段無法辨識的文字

預期結果：

- `開始` 回首頁或導流頁
- `繪本` 回故事清單
- `今日故事` 回預設故事
- 無法辨識的文字回 fallback 指令說明

## 4) 失敗時檢查項目

若 webhook 或頁面異常，先確認：

- Vercel env 是否已設定
- `PUBLIC_BASE_URL` 是否指向 `https://debbylinehose.vercel.app`
- LINE webhook URL 是否仍指向 `/webhook`
- Vercel Function Logs 是否有 401 / 500
- 故事靜態檔是否存在於 `public/stories/<story-id>/story.json`
- `README.md` 與 `vercel.json` 是否仍符合目前路由

# FINAL_CHECKLIST

| 已完成 | 待手動處理 |
|---|---|
| 建立全新專案資料夾 `line-cloudflare-bot`，未沿用舊 Render 專案入口與依賴。 | Cloudflare Dashboard 建立/確認 R2 公開讀取或 custom domain。 |
| 建立 Cloudflare Workers ES Modules 專案核心檔案：`wrangler.toml`、`src/index.js`、`src/storyMap.js`、`src/utils.js`、`.dev.vars.example`、`README.md`、`DEPLOY_STEPS.md`。 | 以 `wrangler secret put CHANNEL_ACCESS_TOKEN` 寫入正式 Token。 |
| `src/storyMap.js` 為唯一關鍵字節點維護入口，支援 `text` 與 `image` 節點。 | 在 Worker Variables 設定 `R2_PUBLIC_BASE_URL`。 |
| `src/index.js` 使用 Workers `fetch` handler，無 Express、無 Node HTTP server、無本機 `fs`。 | 在 LINE Developers Console 更新 webhook URL 指向 Workers 網址。 |
| `wrangler.toml` 已加入 R2 binding：`BUCKET` -> `story-images`。 | 在 LINE Developers Console 執行 webhook 驗證與開關設定。 |
| `.dev.vars.example` 已包含 `CHANNEL_ACCESS_TOKEN`、`R2_PUBLIC_BASE_URL`。 | 將本地 `images/` 實際內容上傳到 R2（執行上傳腳本）。 |
| 已新增 `scripts/upload-to-r2.sh`，使用 `wrangler r2 object put` 上傳圖片。 | 依實際網域與權限檢查圖片 URL 可公開讀取。 |
| `DEPLOY_STEPS.md` 已完整描述安裝、登入、建桶、權限、測試、部署、LINE 串接流程。 | 進行正式環境 smoke test 與監控告警設定。 |
| `MIGRATION_DECISIONS.md` 已明確宣告舊 Render 架構項目不再遷移。 |  |

## 總結

此新專案已具備作為「完全不依賴 Render」正式替代方案的必要程式結構與部署文件：
- webhook 執行於 Cloudflare Workers
- 圖片走 R2 公開 URL
- 不再依賴舊 Node/Express 執行架構與本機持久化流程

剩餘項目均為平台端與第三方控制台的手動設定步驟。

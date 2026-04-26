# LINE Entry Strategy

定位：LINE 僅作為導流管道，不再作為主要閱讀平台。

策略細節：
- LINE 發送簡短訊息或按鈕卡片，內容以導流為主：`開啟閱讀` 按鈕導向 Vercel 的 `/story?storyId=<id>`。
- LINE 不承擔：故事狀態管理、分頁式圖片載入、大量互動邏輯。

現有程式碼中與 LINE 閱讀主體相關的項目（建議檢視與更新）：
- `line-cloudflare-bot/src/index.js`：目前實作為 webhook reply 的整個系統，若保留僅作導流，應修改回覆內容為導流按鈕或短訊連結。 
- `index.js`（舊 Render 專案）：含 webhook 與 storyRuntime 邏輯，若不再用作閱讀主體，請標註或移除相關文件中將其描述為核心閱讀系統的文字。

建議動作：
1. 把 `line-cloudflare-bot`（或其他 webhook 程式）內的回覆邏輯改為僅回導流短文或 Buttons Template（指向 Vercel URL）。
2. 在文件中清楚註記：LINE 為『入口』而非『閱讀主體』。
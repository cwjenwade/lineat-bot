# Story Asset Convention

規定：所有互動繪本資產必須以靜態檔案佈署於 Vercel 的 `public/stories` 下。

目錄結構：

```
public/stories/<story-id>/
  story.json
  images/
    bg-xxx.jpg
    hero.png
    left.jpg
    right.jpg
```

- `story.json`：故事資料，必須遵守 `story-schema.md`。使用相對路徑引用 `images/` 內的檔案（例如 `images/hero.png`）。
- 圖片檔：避免使用動態生成或依賴私有 bucket。檔名盡量小寫、使用連字號、避免空白。
- 若需高效能 CDN，可在部署後配置 Vercel 的 CDN，但不得依賴外部私有 bucket 或 Cloudflare R2。

# Story Schema

此格式為互動繪本的統一節點式敘事模型（最小可用）

Root object:
- `id` (string): story id
- `title` (string)
- `start` (string): start node id
- `nodes` (array of node objects)

Node schema:
- `id` (string, required)
- `speaker` (string, optional) — 顯示在角色名稱區
- `text` (string, optional) — 對話或敘述文字
- `background` (string, optional) — 背景圖片相對路徑（images/）
- `image` (string, optional) — 角色或插圖相對路徑（images/）
- `next` (string, optional) — 自動前進的單一路徑目標 node id
- `options` (array optional) — 若有分支，列出選項物件

Option schema:
- `label` (string, required) — 顯示在按鈕上的文字
- `target` (string, required) — 指向的 node id

範例 node:
{
  "id": "n1",
  "speaker": "熊熊",
  "text": "你好，歡迎來到故事！",
  "background": "images/bg-forest.jpg",
  "image": "images/hero.png",
  "options": [
    { "label": "左邊", "target": "n2" },
    { "label": "右邊", "target": "n3" }
  ]
}

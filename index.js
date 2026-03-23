require('dotenv').config();

const express = require('express');
const line = require('@line/bot-sdk');
const path = require('path');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};
const port = process.env.PORT || 3001;

const app = express();

if (!config.channelAccessToken || !config.channelSecret) {
  console.error('Missing LINE_CHANNEL_ACCESS_TOKEN or LINE_CHANNEL_SECRET in .env');
  process.exit(1);
}

app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.get('/webhook', (req, res) => {
  res.status(200).send('webhook endpoint is alive');
});

app.post('/webhook', line.middleware(config), (req, res) => {
  console.log('events:', JSON.stringify(req.body.events, null, 2));

  Promise
    .all(req.body.events.map(handleEvent))
    .then(() => res.json({ success: true }))
    .catch((error) => {
      console.error('webhook error:', error);
      res.status(500).end();
    });
});

const client = new line.Client(config);
const userSessions = new Map();
const publicBaseUrl = process.env.PUBLIC_BASE_URL || 'https://lineat-bot.onrender.com';

const storyPages = [
  '封面：\n《小星星找晚安》\n輸入「開始故事」進入第一頁。',
  '第 1 頁：\n小星星住在藍藍的夜空上。\n今天，它想找到一個最溫柔的晚安。',
  '第 2 頁：\n它先飛去問月亮。\n月亮笑著說：「晚安是慢慢發亮的心。」',
  '第 3 頁：\n它又飛去問小雲。\n小雲輕輕飄著說：「晚安是安心地閉上眼睛。」',
  '第 4 頁：\n最後，小星星回到自己的位置。\n它發現，原來晚安就在每一次平靜呼吸裡。',
  '結尾：\n小星星閉上眼睛，整片天空都變得柔柔亮亮的。\n故事說完了。輸入「重來」可以再看一次。'
];

const storyNodes = {
  start: {
    next: {
      '選擇：翻越巨石': 'brave-path',
      '選擇：繞去安全小路': 'careful-path'
    }
  },
  'brave-path': {},
  'careful-path': {}
};
const previewHtml = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>數位繪本對話預覽</title>
  <style>
    :root {
      --bg: #f8efe7;
      --panel: #fffaf5;
      --ink: #2d241b;
      --accent: #f39a2d;
      --accent-2: #7ac6b6;
      --accent-3: #5f87ff;
      --accent-4: #f26d6d;
      --bubble-user: #c7f97a;
      --bubble-bot: #ffffff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "PingFang TC", "Noto Sans TC", sans-serif;
      background:
        radial-gradient(circle at top right, #ffe2b8 0, transparent 28%),
        radial-gradient(circle at bottom left, #ffd2d2 0, transparent 30%),
        var(--bg);
      color: var(--ink);
    }
    .shell {
      max-width: 420px;
      margin: 32px auto;
      background: var(--panel);
      border-radius: 28px;
      padding: 18px;
      box-shadow: 0 24px 60px rgba(45, 36, 27, 0.12);
    }
    .title {
      font-size: 24px;
      font-weight: 700;
      margin: 4px 0 8px;
    }
    .subtitle {
      font-size: 14px;
      opacity: 0.72;
      margin-bottom: 18px;
    }
    .chat {
      height: 520px;
      overflow: auto;
      padding: 8px 4px 16px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .row {
      display: flex;
    }
    .row.user {
      justify-content: flex-end;
    }
    .bubble {
      max-width: 82%;
      padding: 14px 16px;
      border-radius: 20px;
      line-height: 1.5;
      white-space: pre-wrap;
      box-shadow: 0 10px 22px rgba(45, 36, 27, 0.08);
    }
    .user .bubble {
      background: var(--bubble-user);
      border-bottom-right-radius: 6px;
    }
    .bot .bubble {
      background: var(--bubble-bot);
      border-bottom-left-radius: 6px;
    }
    .controls {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-top: 14px;
    }
    button {
      border: 0;
      border-radius: 16px;
      padding: 14px 12px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      color: white;
    }
    button[data-action="開始故事"] { background: var(--accent); }
    button[data-action="下一頁"] { background: var(--accent-2); }
    button[data-action="上一頁"] { background: var(--accent-3); }
    button[data-action="重來"] { background: var(--accent-4); }
  </style>
</head>
<body>
  <main class="shell">
    <div class="title">數位繪本對話預覽</div>
    <div class="subtitle">本機模擬 LINE 對話流程，先看故事翻頁效果。</div>
    <section class="chat" id="chat"></section>
    <section class="controls">
      <button data-action="開始故事">開始故事</button>
      <button data-action="下一頁">下一頁</button>
      <button data-action="上一頁">上一頁</button>
      <button data-action="重來">重來</button>
    </section>
  </main>
  <script>
    const storyPages = ${JSON.stringify(storyPages)};
    let currentPage = 0;
    const chat = document.getElementById('chat');

    function addBubble(role, text) {
      const row = document.createElement('div');
      row.className = 'row ' + role;
      const bubble = document.createElement('div');
      bubble.className = 'bubble';
      bubble.textContent = text;
      row.appendChild(bubble);
      chat.appendChild(row);
      chat.scrollTop = chat.scrollHeight;
    }

    function reply(message) {
      let replyText = '歡迎來到數位繪本。輸入「開始故事」開始，或輸入「下一頁」、「上一頁」、「重來」。';

      if (message === '開始故事') {
        currentPage = 1;
        replyText = storyPages[currentPage];
      } else if (message === '下一頁') {
        currentPage = Math.min(currentPage + 1, storyPages.length - 1);
        replyText = storyPages[currentPage];
      } else if (message === '上一頁') {
        currentPage = Math.max(currentPage - 1, 0);
        replyText = storyPages[currentPage];
      } else if (message === '重來') {
        currentPage = 0;
        replyText = storyPages[currentPage];
      }

      addBubble('user', message);
      window.setTimeout(() => addBubble('bot', replyText), 180);
    }

    addBubble('bot', '歡迎來到數位繪本預覽。請按下方按鈕開始測試。');

    document.querySelectorAll('button[data-action]').forEach((button) => {
      button.addEventListener('click', () => reply(button.dataset.action));
    });
  </script>
</body>
</html>`;

app.get('/', (req, res) => {
  res.status(200).send(previewHtml);
});

app.get('/health', (req, res) => {
  res.status(200).send('ok');
});

function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const userMessage = event.message.text.trim();
  const userId = event.source.userId || event.source.groupId || event.source.roomId || 'default';
  const session = userSessions.get(userId) || { nodeId: 'start', page: 0 };

  if (userMessage === '開始故事') {
    userSessions.set(userId, { nodeId: 'start', page: 0 });

    return client.replyMessage(event.replyToken, [
      {
        type: 'text',
        text: '熊熊在森林的深處醒來，走著走著到了被巨石擋住的山徑。眼前只剩兩條路，他必須做出選擇。'
      },
      createChoiceFlex({
        title: '遇到障礙的你覺得？',
        imageUrl: `${publicBaseUrl}/assets/story-start.png`,
        optionA: {
          label: '翻越巨石',
          text: '選擇：翻越巨石'
        },
        optionB: {
          label: '安全小路',
          text: '選擇：繞去安全小路'
        }
      })
    ]);
  }

  if (userMessage === '目錄') {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '可輸入：開始故事、目錄、重來。選項請直接點卡片按鈕。'
    });
  }

  if (userMessage === '重來') {
    userSessions.set(userId, { nodeId: 'start', page: 0 });

    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '已回到故事起點。輸入「開始故事」重新開始。'
    });
  }

  const nextNodeId = storyNodes[session.nodeId]?.next?.[userMessage];

  if (nextNodeId === 'brave-path') {
    userSessions.set(userId, { nodeId: 'brave-path', page: 0 });

    return client.replyMessage(event.replyToken, [
      {
        type: 'text',
        text: '熊熊決定正面迎戰。他踩上岩石、穩住呼吸，慢慢把眼前的大障礙拆成一小步一小步。'
      },
      createStoryCarousel([
        {
          imageUrl: `${publicBaseUrl}/assets/story-brave-1.png`,
          title: '第 1 幕',
          body: '熊熊抓住突出的石塊，一步一步往上爬。雖然辛苦，但他開始相信自己真的做得到。'
        },
        {
          imageUrl: `${publicBaseUrl}/assets/story-brave-2.png`,
          title: '第 2 幕',
          body: '傍晚時，他成功翻過巨石，看到更遼闊的天空，也看到更強壯的自己。'
        }
      ])
    ]);
  }

  if (nextNodeId === 'careful-path') {
    userSessions.set(userId, { nodeId: 'careful-path', page: 0 });

    return client.replyMessage(event.replyToken, [
      {
        type: 'text',
        text: '熊熊沒有硬衝。他先觀察地形，決定繞去一條較安全的小路，邊走邊為接下來的旅程做準備。'
      },
      createStoryCarousel([
        {
          imageUrl: `${publicBaseUrl}/assets/story-careful-1.png`,
          title: '第 1 幕',
          body: '熊熊在路邊撿起樹枝當手杖，沿著比較平穩的山徑前進，心裡也跟著穩下來。'
        },
        {
          imageUrl: `${publicBaseUrl}/assets/story-careful-2.png`,
          title: '第 2 幕',
          body: '夜幕降臨前，他順利抵達營地。原來慢一點，不代表退縮，而是更懂得照顧自己。'
        }
      ])
    ]);
  }

  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: '輸入「開始故事」開始互動繪本，或輸入「目錄」查看操作。'
  });
}

function createChoiceFlex({ title, imageUrl, optionA, optionB }) {
  return {
    type: 'flex',
    altText: '互動繪本選項',
    contents: {
      type: 'bubble',
      size: 'giga',
      hero: {
        type: 'image',
        url: imageUrl,
        size: 'full',
        aspectRatio: '4:3',
        aspectMode: 'cover'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'text',
            text: title,
            weight: 'bold',
            size: 'xl',
            wrap: true
          },
          {
            type: 'button',
            style: 'primary',
            color: '#F3BD63',
            action: {
              type: 'message',
              label: optionA.label,
              text: optionA.text
            }
          },
          {
            type: 'button',
            style: 'primary',
            color: '#7FA8D1',
            action: {
              type: 'message',
              label: optionB.label,
              text: optionB.text
            }
          }
        ]
      }
    }
  };
}

function createStoryCarousel(cards) {
  return {
    type: 'flex',
    altText: '故事多頁訊息',
    contents: {
      type: 'carousel',
      contents: cards.map((card) => ({
        type: 'bubble',
        hero: {
          type: 'image',
          url: card.imageUrl,
          size: 'full',
          aspectRatio: '1:1',
          aspectMode: 'cover'
        },
        body: {
          type: 'box',
          layout: 'vertical',
          spacing: 'md',
          contents: [
            {
              type: 'text',
              text: card.title,
              weight: 'bold',
              size: 'lg'
            },
            {
              type: 'text',
              text: card.body,
              wrap: true,
              size: 'md'
            }
          ]
        }
      }))
    }
  };
}

app.listen(port, () => {
  console.log(`running on ${port}`);
});

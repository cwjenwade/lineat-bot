require('dotenv').config();

const express = require('express');
const line = require('@line/bot-sdk');
const path = require('path');
const { storyMap, storyStartId } = require('./storyData');

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
app.use('/public', express.static(path.join(__dirname, 'public')));

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
const previewNodes = JSON.stringify(storyMap);
const previewStartId = JSON.stringify(storyStartId);
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
    .row.carousel {
      display: block;
    }
    .carousel-track {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 10px;
      width: 100%;
    }
    .card {
      background: white;
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 10px 22px rgba(45, 36, 27, 0.08);
    }
    .card img {
      width: 100%;
      aspect-ratio: 1 / 1;
      object-fit: cover;
      display: block;
      background: #eee4d8;
    }
    .card-body {
      padding: 12px;
    }
    .card-title {
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 6px;
    }
    .card-copy {
      font-size: 14px;
      line-height: 1.45;
      white-space: pre-wrap;
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
      <button data-slot="0">開始故事</button>
      <button data-slot="1">重來</button>
      <button data-slot="2">目錄</button>
      <button data-slot="3">重來</button>
    </section>
  </main>
  <script>
    const storyMap = ${previewNodes};
    const storyStartId = ${previewStartId};
    let currentNodeId = storyStartId;
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

    function addCarousel(cards) {
      const row = document.createElement('div');
      row.className = 'row carousel';
      const track = document.createElement('div');
      track.className = 'carousel-track';

      cards.forEach((card) => {
        const item = document.createElement('div');
        item.className = 'card';
        item.innerHTML = \`
          <img src="/\${card.image}" alt="\${card.title}">
          <div class="card-body">
            <div class="card-title">\${card.title}</div>
            <div class="card-copy">\${card.body}</div>
          </div>
        \`;
        track.appendChild(item);
      });

      row.appendChild(track);
      chat.appendChild(row);
      chat.scrollTop = chat.scrollHeight;
    }

    function renderNode(nodeId, leadText = '') {
      currentNodeId = nodeId;
      const node = storyMap[nodeId];

      if (leadText) addBubble('bot', leadText);

      node.blocks.forEach((block) => {
        if (block.type === 'text') {
          addBubble('bot', block.text);
        } else if (block.type === 'gallery') {
          addCarousel(block.cards);
        }
      });

      if (node.choice) {
        addBubble('bot', node.choice.prompt);
        updateButtons(node.choice.correct, node.choice.wrong);
      } else if (node.continue) {
        updateButtons(node.continue.label, '重來');
      } else if (node.endingText) {
        addBubble('bot', node.endingText);
        updateButtons('開始故事', '重來');
      }
    }

    function updateButtons(primary, secondary) {
      const buttons = document.querySelectorAll('button[data-slot]');
      buttons[0].textContent = primary;
      buttons[0].dataset.action = primary;
      buttons[1].textContent = secondary;
      buttons[1].dataset.action = secondary;
      buttons[2].textContent = '目錄';
      buttons[2].dataset.action = '目錄';
      buttons[3].textContent = '重來';
      buttons[3].dataset.action = '重來';
    }

    function reply(message) {
      addBubble('user', message);

      window.setTimeout(() => {
        if (message === '開始故事') {
          renderNode(storyStartId);
          return;
        }

        if (message === '目錄') {
          addBubble('bot', '這是《熊熊尋心》的本機預覽。請用按鈕測試互動分支。');
          return;
        }

        if (message === '重來') {
          renderNode(storyStartId, '已回到故事起點。');
          return;
        }

        const node = storyMap[currentNodeId];
        if (!node) return;

        if (node.choice && message === node.choice.wrong) {
          addBubble('bot', node.choice.wrongReply);
          addBubble('bot', node.choice.prompt);
          return;
        }

        if (node.choice && message === node.choice.correct) {
          renderNode(node.choice.next, node.choice.successReply);
          return;
        }

        if (node.continue && message === node.continue.label) {
          renderNode(node.continue.next);
          return;
        }

        addBubble('bot', '請直接使用下方按鈕。');
      }, 180);
    }

    addBubble('bot', '歡迎來到《熊熊尋心》預覽。先按「開始故事」即可在本機模擬互動流程。');
    updateButtons('開始故事', '重來');

    document.querySelectorAll('button[data-slot]').forEach((button) => {
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
  const session = userSessions.get(userId) || { nodeId: storyStartId };

  if (userMessage === '開始故事') {
    userSessions.set(userId, { nodeId: storyStartId });
    return replyWithNode(event.replyToken, storyStartId);
  }

  if (userMessage === '目錄') {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '可輸入：開始故事、目錄、重來。中段會先用圖卡推進劇情，只有關鍵場景才會停下來讓你做選擇。'
    });
  }

  if (userMessage === '重來') {
    userSessions.set(userId, { nodeId: storyStartId });

    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '已回到故事起點。輸入「開始故事」重新開始。'
    });
  }

  const node = storyMap[session.nodeId];

  if (node?.choice && userMessage === node.choice.wrong) {
    return client.replyMessage(event.replyToken, [
      {
        type: 'text',
        text: node.choice.wrongReply
      },
      createChoiceFlex(node.choice)
    ]);
  }

  if (node?.choice && userMessage === node.choice.correct) {
    userSessions.set(userId, { nodeId: node.choice.next });
    return replyWithNode(event.replyToken, node.choice.next, node.choice.successReply);
  }

  if (node?.continue && userMessage === node.continue.label) {
    userSessions.set(userId, { nodeId: node.continue.next });
    return replyWithNode(event.replyToken, node.continue.next);
  }

  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: '輸入「開始故事」開始互動繪本。進行中請直接點按鈕或輸入畫面上的提示文字。'
  });
}

function replyWithNode(replyToken, nodeId, leadText) {
  const node = storyMap[nodeId];
  const messages = [];

  if (leadText) {
    messages.push({
      type: 'text',
      text: leadText
    });
  }

  node.blocks?.forEach((block) => {
    if (block.type === 'text') {
      messages.push({
        type: 'text',
        text: block.text
      });
    } else if (block.type === 'gallery') {
      messages.push(createStoryCarousel(block.cards));
    }
  });

  if (node.choice) {
    messages.push({
      type: 'text',
      text: node.choice.prompt
    });
    messages.push(createChoiceFlex(node.choice));
  } else if (node.continue) {
    messages.push(createContinuePrompt(node.continue.label));
  } else if (node.endingText) {
    messages.push({
      type: 'text',
      text: node.endingText
    });
  }

  return client.replyMessage(replyToken, messages.slice(0, 5));
}

function createChoiceFlex(choice) {
  return {
    type: 'flex',
    altText: '互動繪本選項',
    contents: {
      type: 'bubble',
      size: 'giga',
      hero: {
        type: 'image',
        url: `${publicBaseUrl}/${choice.image}`,
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
            text: choice.prompt,
            weight: 'bold',
            size: 'lg',
            wrap: true
          },
          {
            type: 'button',
            style: 'primary',
            color: '#F3BD63',
            action: {
              type: 'message',
              label: choice.correct,
              text: choice.correct
            }
          },
          {
            type: 'button',
            style: 'primary',
            color: '#7FA8D1',
            action: {
              type: 'message',
              label: choice.wrong,
              text: choice.wrong
            }
          }
        ]
      }
    }
  };
}

function createContinuePrompt(label) {
  return {
    type: 'text',
    text: '看完這一幕後，點下面按鈕繼續。',
    quickReply: {
      items: [
        {
          type: 'action',
          action: {
            type: 'message',
            label,
            text: label
          }
        }
      ]
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
          url: `${publicBaseUrl}/${card.image}`,
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
              size: 'lg',
              wrap: true
            },
            ...(card.body ? [{
              type: 'text',
              text: card.body,
              wrap: true,
              size: 'md'
            }] : [])
          ]
        }
      }))
    }
  };
}

function createStoryBubble(card) {
  return {
    type: 'flex',
    altText: card.title,
    contents: {
      type: 'bubble',
      hero: {
        type: 'image',
        url: `${publicBaseUrl}/${card.image}`,
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
            size: 'lg',
            wrap: true
          },
          ...(card.body ? [{
            type: 'text',
            text: card.body,
            wrap: true,
            size: 'md'
          }] : [])
        ]
      }
    }
  };
}

app.listen(port, () => {
  console.log(`running on ${port}`);
});

require('dotenv').config();

const express = require('express');
const line = require('@line/bot-sdk');
const path = require('path');
const { storyMap, storyStartId } = require('./storyData');
const { mountAdmin } = require('./lib/adminMount');

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
mountAdmin(app, { uiPath: '/admin', apiPath: '/admin-api' });

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
const previewRoleIcons = JSON.stringify({
  bear: '/public/story/01/roles/bear.png',
  'inner-bear': '/public/story/01/roles/inner-bear.png',
  narrator: '/public/story/01/roles/narrator.png',
  lily: '/public/story/01/roles/lily.png',
  dad: '/public/story/01/roles/dad.png',
  mom: '/public/story/01/roles/mom.png',
  dream: '/public/story/01/roles/dream.png',
  friends: '/public/story/01/roles/friends.png',
  villager: '/public/story/01/roles/villager.png',
  beaver: '/public/story/01/roles/beaver.png',
  deer: '/public/story/01/roles/deer.png',
  owl: '/public/story/01/roles/owl.png',
  bee: '/public/story/01/roles/bee.png',
  journey: '/public/story/01/roles/journey.png',
  cave: '/public/story/01/roles/cave.png'
});
const previewRoleThemes = JSON.stringify({
  bear: { border: '#D9B08C', chip: '#8B6A4E', button: '#F3BD63' },
  'inner-bear': { border: '#B7A1D6', chip: '#6E5A8A', button: '#C7B2EA' },
  narrator: { border: '#A8B3BC', chip: '#56616A', button: '#B8C4CC' },
  lily: { border: '#F1B9C7', chip: '#B9687B', button: '#F5C9D4' },
  dad: { border: '#B9D49E', chip: '#5D7A3F', button: '#CFE5B7' },
  mom: { border: '#F0A7A7', chip: '#A95555', button: '#F6C2C2' },
  dream: { border: '#F5D37B', chip: '#9A7A1F', button: '#F6E39C' },
  friends: { border: '#9ED7E4', chip: '#3D7D8D', button: '#BCE7F0' },
  villager: { border: '#D9C089', chip: '#8A6E2A', button: '#E9D7AE' },
  beaver: { border: '#D8AB84', chip: '#8D5A3B', button: '#E9C5A6' },
  deer: { border: '#DCCD8D', chip: '#81722B', button: '#ECE0AC' },
  owl: { border: '#B99A7D', chip: '#6C543D', button: '#D7BCA6' },
  bee: { border: '#F5C74D', chip: '#9D7A00', button: '#F8DD8B' },
  journey: { border: '#B8C8A0', chip: '#5C7240', button: '#D0DCBE' },
  cave: { border: '#B8C1E4', chip: '#58638F', button: '#D1D8F2' }
});
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
      display: flex;
      gap: 10px;
      margin-top: 14px;
    }
    .row.carousel {
      display: block;
    }
    .carousel-track {
      display: flex;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      -webkit-overflow-scrolling: touch;
      gap: 10px;
      width: 100%;
      padding-bottom: 6px;
    }
    .card {
      flex: 0 0 78%;
      scroll-snap-align: start;
      background: white;
      border-radius: 24px;
      overflow: hidden;
      box-shadow: 0 10px 22px rgba(45, 36, 27, 0.08);
      position: relative;
      border: 10px solid #d9b08c;
    }
    .card img {
      width: 100%;
      aspect-ratio: 1 / 1;
      object-fit: cover;
      display: block;
      background: #eee4d8;
    }
    .card-body {
      padding: 14px 14px 16px;
    }
    .card-title {
      display: inline-block;
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 10px;
      padding: 6px 12px;
      border-radius: 999px;
      background: #8b6a4e;
      color: white;
    }
    .card-copy {
      font-size: 15px;
      line-height: 1.55;
      white-space: pre-wrap;
      min-height: 84px;
      padding-right: 66px;
    }
    .role-badge {
      position: absolute;
      right: 12px;
      bottom: 12px;
      width: 56px;
      height: 56px;
      object-fit: contain;
      border-radius: 999px;
      background: rgba(255,255,255,0.92);
      box-shadow: 0 8px 18px rgba(45, 36, 27, 0.15);
    }
    .choice-card {
      width: 100%;
      border-radius: 24px;
      overflow: hidden;
      background: white;
      box-shadow: 0 10px 22px rgba(45, 36, 27, 0.08);
      border: 10px solid #d9b08c;
    }
    .choice-card img {
      width: 100%;
      aspect-ratio: 4 / 3;
      object-fit: cover;
      display: block;
      background: #eee4d8;
    }
    .choice-body {
      padding: 16px;
    }
    .choice-title {
      font-size: 18px;
      font-weight: 800;
      line-height: 1.5;
      margin-bottom: 12px;
    }
    .choice-buttons {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .choice-btn {
      width: 100%;
      border: 0;
      border-radius: 18px;
      padding: 14px 16px;
      font-size: 15px;
      line-height: 1.45;
      font-weight: 700;
      color: #2d241b;
      background: #f3bd63;
      text-align: left;
      cursor: pointer;
    }
    .utility {
      flex: 1;
      background: #2d241b;
      color: white;
    }
  </style>
</head>
<body>
  <main class="shell">
    <div class="title">數位繪本對話預覽</div>
    <div class="subtitle">本機模擬 LINE 對話流程，先看故事翻頁效果。</div>
    <section class="chat" id="chat"></section>
    <section class="controls">
      <button class="choice-btn utility" data-utility="start">開始故事</button>
      <button class="choice-btn utility" data-utility="restart">重來</button>
    </section>
  </main>
  <script>
    const storyMap = ${previewNodes};
    const storyStartId = ${previewStartId};
    const roleIcons = ${previewRoleIcons};
    const roleThemes = ${previewRoleThemes};
    let currentNodeId = storyStartId;
    const chat = document.getElementById('chat');

    function getRoleKey(title) {
      if (title.includes('熊熊的內心')) return 'inner-bear';
      if (title.includes('熊熊')) return 'bear';
      if (title.includes('旁白') || title.includes('早餐') || title.includes('夢境')) return title.includes('夢境') ? 'dream' : 'narrator';
      if (title.includes('莉莉')) return 'lily';
      if (title.includes('熊爸爸')) return 'dad';
      if (title.includes('熊媽媽')) return 'mom';
      if (title.includes('好友')) return 'friends';
      if (title.includes('村民')) return 'villager';
      if (title.includes('河狸')) return 'beaver';
      if (title.includes('鹿')) return 'deer';
      if (title.includes('貓頭鷹')) return 'owl';
      if (title.includes('蜜蜂')) return 'bee';
      if (title.includes('洞穴')) return 'cave';
      if (title.includes('旅') || title.includes('篝火') || title.includes('入口')) return 'journey';
      return 'narrator';
    }
    function getRoleTheme(title) {
      return roleThemes[getRoleKey(title)] || roleThemes.narrator;
    }

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
        const roleIcon = roleIcons[getRoleKey(card.title)] || roleIcons.narrator;
        const theme = getRoleTheme(card.title);
        const item = document.createElement('div');
        item.className = 'card';
        item.style.borderColor = theme.border;
        item.innerHTML = \`
          <img src="/\${card.image}" alt="\${card.title}">
          <div class="card-body">
            <div class="card-title" style="background:\${theme.chip}">\${card.title}</div>
            <div class="card-copy">\${card.body}</div>
          </div>
          <img class="role-badge" src="\${roleIcon}" alt="\${card.title}">
        \`;
        track.appendChild(item);
      });

      row.appendChild(track);
      chat.appendChild(row);
      chat.scrollTop = chat.scrollHeight;
    }

    function addChoiceCard(choice) {
      const row = document.createElement('div');
      row.className = 'row carousel';
      const theme = getRoleTheme(choice.prompt);
      const card = document.createElement('div');
      card.className = 'choice-card';
      card.style.borderColor = theme.border;
      card.innerHTML = \`
        <img src="/\${choice.image}" alt="choice">
        <div class="choice-body">
          <div class="choice-title">\${choice.prompt}</div>
          <div class="choice-buttons">
            <button class="choice-btn" data-inline-action="\${choice.correct}" style="background:\${theme.button}">\${choice.correct}</button>
            <button class="choice-btn" data-inline-action="\${choice.wrong}" style="background:#d8e0ef">\${choice.wrong}</button>
          </div>
        </div>
      \`;
      row.appendChild(card);
      chat.appendChild(row);
      chat.scrollTop = chat.scrollHeight;
      card.querySelectorAll('[data-inline-action]').forEach((button) => {
        button.addEventListener('click', () => reply(button.dataset.inlineAction));
      });
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
        addChoiceCard(node.choice);
      } else if (node.continue) {
        addChoiceCard({
          prompt: '看完這一幕後，繼續往下走吧。',
          image: node.blocks.find((block) => block.type === 'gallery')?.cards?.[0]?.image || 'public/story/01/image01.png',
          correct: node.continue.label,
          wrong: '重來'
        });
      } else if (node.endingText) {
        addBubble('bot', node.endingText);
      }
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
    document.querySelectorAll('[data-utility]').forEach((button) => {
      button.addEventListener('click', () => reply(button.dataset.utility === 'start' ? '開始故事' : '重來'));
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
  const theme = getRoleThemeInfo(choice.prompt);
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
            type: 'box',
            layout: 'vertical',
            backgroundColor: theme.border,
            cornerRadius: '12px',
            paddingAll: '10px',
            contents: [
              {
                type: 'text',
                text: choice.prompt,
                weight: 'bold',
                size: 'md',
                wrap: true,
                color: '#FFFFFF'
              }
            ]
          },
          {
            type: 'button',
            style: 'primary',
            color: theme.button,
            action: {
              type: 'message',
              label: toLineLabel(choice.correct),
              text: choice.correct
            }
          },
          {
            type: 'button',
            style: 'primary',
            color: '#D8E0EF',
            action: {
              type: 'message',
              label: toLineLabel(choice.wrong),
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
            label: toLineLabel(label),
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
      contents: cards.map((card) => createStoryBubble(card).contents)
    }
  };
}

function createStoryBubble(card) {
  const roleIconUrl = `${publicBaseUrl}${getRoleIconPath(card.title)}`;
  const theme = getRoleThemeInfo(card.title);
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
            type: 'box',
            layout: 'vertical',
            backgroundColor: theme.border,
            cornerRadius: '12px',
            paddingAll: '8px',
            contents: [
              {
                type: 'text',
                text: card.title,
                weight: 'bold',
                size: 'sm',
                wrap: true,
                color: '#FFFFFF'
              }
            ]
          },
          ...(card.body ? [{
            type: 'text',
            text: card.body,
            wrap: true,
            size: 'md',
            color: '#2D241B'
          }] : []),
          {
            type: 'box',
            layout: 'horizontal',
            margin: 'md',
            contents: [
              {
                type: 'filler'
              },
              {
                type: 'image',
                url: roleIconUrl,
                size: 'sm',
                aspectMode: 'cover',
                aspectRatio: '1:1'
              }
            ]
          }
        ]
      }
    }
  };
}

function getRoleIconPath(title) {
  if (title.includes('熊熊的內心')) return '/public/story/01/roles/inner-bear.png';
  if (title.includes('熊熊')) return '/public/story/01/roles/bear.png';
  if (title.includes('旁白') || title.includes('早餐')) return '/public/story/01/roles/narrator.png';
  if (title.includes('夢境')) return '/public/story/01/roles/dream.png';
  if (title.includes('莉莉')) return '/public/story/01/roles/lily.png';
  if (title.includes('熊爸爸')) return '/public/story/01/roles/dad.png';
  if (title.includes('熊媽媽')) return '/public/story/01/roles/mom.png';
  if (title.includes('好友')) return '/public/story/01/roles/friends.png';
  if (title.includes('村民')) return '/public/story/01/roles/villager.png';
  if (title.includes('河狸')) return '/public/story/01/roles/beaver.png';
  if (title.includes('鹿')) return '/public/story/01/roles/deer.png';
  if (title.includes('貓頭鷹')) return '/public/story/01/roles/owl.png';
  if (title.includes('蜜蜂')) return '/public/story/01/roles/bee.png';
  if (title.includes('洞穴')) return '/public/story/01/roles/cave.png';
  if (title.includes('旅') || title.includes('篝火') || title.includes('入口')) return '/public/story/01/roles/journey.png';
  return '/public/story/01/roles/narrator.png';
}

function getRoleThemeInfo(title) {
  if (title.includes('熊熊的內心')) return { border: '#8B6FB7', button: '#C7B2EA' };
  if (title.includes('熊熊')) return { border: '#8B6A4E', button: '#F3BD63' };
  if (title.includes('旁白') || title.includes('早餐')) return { border: '#56616A', button: '#B8C4CC' };
  if (title.includes('夢境')) return { border: '#9A7A1F', button: '#F6E39C' };
  if (title.includes('莉莉')) return { border: '#B9687B', button: '#F5C9D4' };
  if (title.includes('熊爸爸')) return { border: '#5D7A3F', button: '#CFE5B7' };
  if (title.includes('熊媽媽')) return { border: '#A95555', button: '#F6C2C2' };
  if (title.includes('好友')) return { border: '#3D7D8D', button: '#BCE7F0' };
  if (title.includes('村民')) return { border: '#8A6E2A', button: '#E9D7AE' };
  if (title.includes('河狸')) return { border: '#8D5A3B', button: '#E9C5A6' };
  if (title.includes('鹿')) return { border: '#81722B', button: '#ECE0AC' };
  if (title.includes('貓頭鷹')) return { border: '#6C543D', button: '#D7BCA6' };
  if (title.includes('蜜蜂')) return { border: '#9D7A00', button: '#F8DD8B' };
  if (title.includes('洞穴')) return { border: '#58638F', button: '#D1D8F2' };
  if (title.includes('旅') || title.includes('篝火') || title.includes('入口')) return { border: '#5C7240', button: '#D0DCBE' };
  return { border: '#56616A', button: '#B8C4CC' };
}

function toLineLabel(text) {
  const compact = text
    .replace(/^熊熊(難過地想|嘆了一口氣|總覺得哪裡不對勁，決定)?[:：]?/, '')
    .replace(/^看到流星的你，會想到什麼？/, '流星心願')
    .replace(/^對於未知的冒險感到焦慮與擔心嗎？/, '未知冒險')
    .trim();

  if (compact.length <= 20) return compact;
  return `${compact.slice(0, 19)}…`;
}

app.listen(port, () => {
  console.log(`running on ${port}`);
});

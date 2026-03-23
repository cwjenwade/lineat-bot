require('dotenv').config();

const express = require('express');
const line = require('@line/bot-sdk');

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

app.get('/', (req, res) => {
  res.status(200).send('ok');
});

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

const storyPages = [
  '封面：\n《小星星找晚安》\n輸入「開始故事」進入第一頁。',
  '第 1 頁：\n小星星住在藍藍的夜空上。\n今天，它想找到一個最溫柔的晚安。',
  '第 2 頁：\n它先飛去問月亮。\n月亮笑著說：「晚安是慢慢發亮的心。」',
  '第 3 頁：\n它又飛去問小雲。\n小雲輕輕飄著說：「晚安是安心地閉上眼睛。」',
  '第 4 頁：\n最後，小星星回到自己的位置。\n它發現，原來晚安就在每一次平靜呼吸裡。',
  '結尾：\n小星星閉上眼睛，整片天空都變得柔柔亮亮的。\n故事說完了。輸入「重來」可以再看一次。'
];

function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const userMessage = event.message.text.trim();
  const userId = event.source.userId || event.source.groupId || event.source.roomId || 'default';
  const currentPage = userSessions.get(userId) ?? 0;
  let nextPage = currentPage;
  let replyText = '歡迎來到數位繪本。輸入「開始故事」開始，或輸入「下一頁」、「上一頁」、「重來」。';

  if (userMessage === '開始故事') {
    nextPage = 1;
    replyText = storyPages[nextPage];
  } else if (userMessage === '下一頁') {
    nextPage = Math.min(currentPage + 1, storyPages.length - 1);
    replyText = storyPages[nextPage];
  } else if (userMessage === '上一頁') {
    nextPage = Math.max(currentPage - 1, 0);
    replyText = storyPages[nextPage];
  } else if (userMessage === '重來') {
    nextPage = 0;
    replyText = storyPages[nextPage];
  } else if (userMessage === '目錄') {
    replyText = '可輸入：開始故事、下一頁、上一頁、重來';
  }

  userSessions.set(userId, nextPage);

  console.log('replyText:', replyText);

  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: replyText
  });
}

app.listen(port, () => {
  console.log(`running on ${port}`);
});

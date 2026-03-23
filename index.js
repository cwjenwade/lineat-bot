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

function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const userMessage = event.message.text.trim();
  console.log('userMessage:', userMessage);
  let replyText = '我目前可以回覆這些關鍵字：你好、課程、費用、預約、地址';

  if (userMessage === '你好') {
    replyText = '你好，我是 LINE 自動回覆機器人。有需要可以輸入：課程、費用、預約、地址';
  } else if (userMessage === '課程') {
    replyText = '目前提供的服務有：個別諮詢、主題工作坊、企業內訓。';
  } else if (userMessage === '費用') {
    replyText = '費用會依服務內容不同而調整，請直接輸入「預約」取得聯絡方式。';
  } else if (userMessage === '預約') {
    replyText = '預約請提供你的姓名、可聯絡時間，以及想詢問的服務項目。';
  } else if (userMessage === '地址') {
    replyText = '請填入你的實體地址，或改成 Google Maps 連結。';
  }

  console.log('replyText:', replyText);

  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: replyText
  });
}

app.listen(port, () => {
  console.log(`running on ${port}`);
});

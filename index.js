require('dotenv').config();

const express = require('express');
const line = require('@line/bot-sdk');
const path = require('path');

const { mountAdmin } = require('./lib/adminMount');
const { recordAction } = require('./lib/storyAuthoringStore');
const { createStoryRuntime } = require('./lib/storyRuntime');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};
const port = process.env.PORT || 3001;
const publicBaseUrl = process.env.PUBLIC_BASE_URL || 'https://lineat-bot.onrender.com';

if (!config.channelAccessToken || !config.channelSecret) {
  console.error('Missing LINE_CHANNEL_ACCESS_TOKEN or LINE_CHANNEL_SECRET in .env');
  process.exit(1);
}

const app = express();
const client = new line.Client(config);
const storyRuntime = createStoryRuntime({
  sessionStore: new Map(),
  publicBaseUrl
});

app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
mountAdmin(app, { uiPath: '/admin', apiPath: '/admin-api' });

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    name: 'lineat',
    admin: '/admin',
    health: '/health'
  });
});

app.get('/health', (_req, res) => {
  res.status(200).send('ok');
});

app.get('/version', (_req, res) => {
  res.json({
    updatedAt: new Date().toISOString()
  });
});

app.get('/webhook', (_req, res) => {
  res.status(200).send('webhook endpoint is alive');
});

app.post('/webhook', line.middleware(config), (req, res) => {
  Promise
    .all(req.body.events.map(handleEvent))
    .then(() => res.json({ success: true }))
    .catch((error) => {
      console.error('webhook error:', error);
      recordAction('webhook.error', {
        actor: 'system',
        role: 'system',
        targetId: 'webhook',
        result: 'failure',
        detail: error.message
      });
      res.status(500).end();
    });
});

function getSessionKey(event) {
  return event.source?.userId || event.source?.groupId || event.source?.roomId || 'anonymous';
}

async function handleTextEvent(event) {
  const sessionKey = getSessionKey(event);
  const text = `${event.message.text || ''}`;
  const result = storyRuntime.processTextInput(text, sessionKey);
  return client.replyMessage(event.replyToken, result.messages);
}

function handleEvent(event) {
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }
  return handleTextEvent(event);
}

app.listen(port, () => {
  console.log(`running on ${port}`);
});

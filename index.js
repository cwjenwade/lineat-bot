require('dotenv').config();

const express = require('express');
const line = require('@line/bot-sdk');
const path = require('path');

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
  publicBaseUrl,
  requirePublishedAssets: true,
  usePublishedAssets: true
});

app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

function isLocalHost(req) {
  const host = `${req.get('host') || ''}`.toLowerCase();
  return host.includes('localhost') || host.includes('127.0.0.1');
}

function localAdminBase(req) {
  const hostname = req.hostname === '127.0.0.1' ? '127.0.0.1' : 'localhost';
  return `http://${hostname}:3002`;
}

app.get('/admin', (req, res) => {
  if (!isLocalHost(req)) {
    return res.status(404).json({ error: 'Admin is served from the standalone admin server.' });
  }
  res.redirect(302, `${localAdminBase(req)}/`);
});

app.use('/admin-api', (req, res) => {
  if (!isLocalHost(req)) {
    return res.status(404).json({ error: 'Admin API is served from the standalone admin server.' });
  }
  const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
  res.redirect(307, `${localAdminBase(req)}/api${req.path}${query}`);
});

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    name: 'lineat',
    admin: 'http://localhost:3002/',
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
  const result = await storyRuntime.processTextInput(text, sessionKey, {
    source: 'webhook'
  });
  console.log('SENDING TO LINE');
  const response = await client.replyMessage(event.replyToken, result.messages);
  console.log('LINE RESPONSE:', response?.status ?? 'unknown', response?.data ?? response ?? null);
  return response;
}

function handleEvent(event) {
  console.log('WEBHOOK EVENT:', JSON.stringify(event, null, 2));
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }
  return handleTextEvent(event);
}

app.listen(port, () => {
  console.log(`running on ${port}`);
});

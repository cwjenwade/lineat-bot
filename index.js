require('dotenv').config();

const express = require('express');
const line = require('@line/bot-sdk');
const path = require('path');

const { readStore, recordAction } = require('./lib/storyAuthoringStore');
const { createStoryRuntime } = require('./lib/storyRuntime');
const { buildRenderResult } = require('./lib/lineatRenderer');

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

function getStoryTriggerKeyword(store, story) {
  return (store?.globalSettings?.triggerBindings || [])
    .find((binding) => binding.storyId === story.id && `${binding.keyword || ''}`.trim())?.keyword || '';
}

async function buildStoryMenuMessages() {
  const store = readStore();
  const stories = (store.stories || [])
    .map((story) => ({
      story,
      triggerKeyword: getStoryTriggerKeyword(store, story)
    }))
    .filter((entry) => entry.story?.startNodeId && entry.triggerKeyword)
    .slice(0, 10);

  if (!stories.length) {
    return [{
      type: 'text',
      text: '目前還沒有可閱讀的故事。'
    }];
  }

  const bubbles = await Promise.all(stories.map(async ({ story, triggerKeyword }) => {
    let imageUrl = '';
    try {
      const render = await buildRenderResult(store, story, story.startNodeId, publicBaseUrl, {
        requirePublishedAssets: true,
        usePublishedAssets: true
      });
      imageUrl = render.images?.[0]?.url || render.image?.url || render.models?.[0]?.renderedImageUrl || '';
    } catch (error) {
      console.warn(`[story-menu] failed to build cover for ${story.id}: ${error.message}`);
    }

    const bodyContents = [
      {
        type: 'text',
        text: story.title || '未命名故事',
        weight: 'bold',
        size: 'lg',
        wrap: true,
        color: '#2D241B'
      },
      {
        type: 'text',
        text: triggerKeyword,
        size: 'sm',
        wrap: true,
        color: '#6D6255'
      }
    ];

    return {
      type: 'bubble',
      size: 'mega',
      ...(imageUrl ? {
        hero: {
          type: 'image',
          url: imageUrl,
          size: 'full',
          aspectRatio: '16:27',
          aspectMode: 'cover'
        }
      } : {}),
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        paddingAll: '18px',
        backgroundColor: '#FFF8EF',
        contents: bodyContents
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingTop: '14px',
        paddingBottom: '18px',
        paddingStart: '18px',
        paddingEnd: '18px',
        backgroundColor: '#FFFDF8',
        contents: [
          {
            type: 'button',
            style: 'primary',
            color: '#C8833D',
            action: {
              type: 'message',
              label: '開始閱讀',
              text: triggerKeyword
            }
          }
        ]
      }
    };
  }));

  return [{
    type: 'flex',
    altText: '繪本故事選單',
    contents: {
      type: 'carousel',
      contents: bubbles
    }
  }];
}

async function handleTextEvent(event) {
  const sessionKey = getSessionKey(event);
  const text = `${event.message.text || ''}`;
  if (text.trim() === '顯示繪本故事') {
    const messages = await buildStoryMenuMessages();
    return client.replyMessage(event.replyToken, messages);
  }
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

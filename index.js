require('dotenv').config();

const express = require('express');
const line = require('@line/bot-sdk');
const path = require('path');

const { recordAction, getHotStoreSnapshot } = require('./lib/storyAuthoringStore');
const { createStoryRuntime } = require('./lib/storyRuntime');
const { resolveKeywordBindingAction } = require('./lib/storyKeywordActions');

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};
const port = process.env.PORT || 3001;
const publicBaseUrl = process.env.PUBLIC_BASE_URL || 'https://lineat-bot.onrender.com';
const fastAckEnabled = process.env.LINE_FAST_ACK === '1';

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
  usePublishedAssets: true,
  getStore: () => getHotStoreSnapshot(),
  resolveKeywordBindingAction,
  onRecord: (...args) => setImmediate(() => {
    try {
      recordAction(...args);
    } catch (error) {
      console.error('[ERROR]', error);
    }
  })
});
app.use('/public', express.static(path.join(__dirname, 'public'), {
  setHeaders(res, filePath) {
    if (filePath.includes(`${path.sep}generated${path.sep}`)) {
      res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
    }
  }
}));
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

function startTimer() {
  return process.hrtime.bigint();
}

function elapsedMs(start) {
  return Number(process.hrtime.bigint() - start) / 1e6;
}

function sanitizePayload(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => sanitizePayload(entry))
      .filter((entry) => entry !== undefined);
  }
  if (!value || typeof value !== 'object') return value;
  const next = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined || entry === null) continue;
    if (key === 'debug' || key === 'metadata') continue;
    const sanitized = sanitizePayload(entry);
    if (sanitized === undefined) continue;
    next[key] = sanitized;
  }
  return next;
}

function sanitizeMessages(messages = []) {
  return sanitizePayload(messages);
}

function logPerf(meta = {}) {
  console.log('[PERF]', {
    kind: meta.kind || 'story',
    text: meta.text || '',
    session: meta.sessionKey || '',
    mode: meta.mode || '',
    messages: meta.messageCount || 0,
    cache: typeof meta.cacheHit === 'boolean' ? (meta.cacheHit ? 'hit' : 'miss') : '',
    reply: Number.isFinite(meta.replyMs) ? Number(meta.replyMs.toFixed(1)) : undefined,
    runtime: Number.isFinite(meta.runtimeMs) ? Number(meta.runtimeMs.toFixed(1)) : undefined,
    push: Number.isFinite(meta.pushMs) ? Number(meta.pushMs.toFixed(1)) : undefined,
    total: Number.isFinite(meta.totalMs) ? Number(meta.totalMs.toFixed(1)) : undefined,
    requestId: meta.requestId || ''
  });
}

function getDeliveryTargetId(event) {
  return event.source?.userId || event.source?.groupId || event.source?.roomId || '';
}

async function replyThenPush(event, runtimeTask, meta = {}) {
  if (!fastAckEnabled) {
    const runtimeStart = startTimer();
    const result = await runtimeTask();
    const runtimeMs = elapsedMs(runtimeStart);
    const replyStart = startTimer();
    const response = await client.replyMessage(event.replyToken, sanitizeMessages(result.messages));
    const replyMs = elapsedMs(replyStart);
    logPerf({
      ...meta,
      cacheHit: result?.cacheHit,
      mode: result?.mode || meta.mode,
      messageCount: result?.messages?.length || 0,
      replyMs,
      runtimeMs,
      pushMs: 0,
      totalMs: runtimeMs + replyMs,
      requestId: response?.headers?.['x-line-request-id'] || response?.headers?.get?.('x-line-request-id') || ''
    });
    return response;
  }

  const t0 = startTimer();
  const deliveryTargetId = getDeliveryTargetId(event);
  const replyResponse = await client.replyMessage(event.replyToken, {
    type: 'text',
    text: '...'
  });
  const replyMs = elapsedMs(t0);

  setImmediate(async () => {
    const runtimeStart = startTimer();
    try {
      const result = await runtimeTask();
      const runtimeMs = elapsedMs(runtimeStart);
      if (!deliveryTargetId || !result?.messages?.length) {
        logPerf({
          ...meta,
          cacheHit: result?.cacheHit,
          mode: result?.mode || meta.mode,
          messageCount: result?.messages?.length || 0,
          replyMs,
          runtimeMs,
          pushMs: 0,
          totalMs: replyMs + runtimeMs,
          requestId: replyResponse?.headers?.['x-line-request-id'] || replyResponse?.headers?.get?.('x-line-request-id') || ''
        });
        return;
      }
      const pushStart = startTimer();
      await client.pushMessage(deliveryTargetId, sanitizeMessages(result.messages));
      const pushMs = elapsedMs(pushStart);
      logPerf({
        ...meta,
        cacheHit: result?.cacheHit,
        mode: result?.mode || meta.mode,
        messageCount: result?.messages?.length || 0,
        replyMs,
        runtimeMs,
        pushMs,
        totalMs: replyMs + runtimeMs + pushMs,
        requestId: replyResponse?.headers?.['x-line-request-id'] || replyResponse?.headers?.get?.('x-line-request-id') || ''
      });
    } catch (error) {
      console.error('[ERROR]', error);
      if (deliveryTargetId) {
        try {
          await client.pushMessage(deliveryTargetId, {
            type: 'text',
            text: '系統忙碌中'
          });
        } catch (pushError) {
          console.error('[ERROR]', pushError);
        }
      }
    }
  });

  return replyResponse;
}

async function handleTextEvent(event) {
  const sessionKey = getSessionKey(event);
  const text = event.type === 'postback'
    ? `${event.postback?.data || ''}`
    : `${event.message?.text || ''}`;
  return replyThenPush(event, () => storyRuntime.processTextInput({
    userId: sessionKey,
    text,
    source: 'webhook'
  }), {
    kind: 'story-runtime',
    text,
    sessionKey
  });
}

function handleEvent(event) {
  if (event.type === 'postback') {
    return handleTextEvent(event);
  }
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }
  return handleTextEvent(event);
}

app.listen(port);

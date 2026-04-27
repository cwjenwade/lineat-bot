const line = require('@line/bot-sdk');

const { createStoryRuntime } = require('../lib/storyRuntime');
const { resolveKeywordBindingAction } = require('../lib/storyKeywordActions');
const { recordAction, getHotStoreSnapshot } = require('../lib/storyAuthoringStore');
const { parseStoryPostbackData } = require('../lib/lineNodeRenderer');

require('dotenv').config();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const publicBaseUrl = process.env.PUBLIC_BASE_URL || 'https://debbylinehose.vercel.app';
const client = new line.Client(config);
const sessionStore = new Map();
const storyRuntime = createStoryRuntime({
  sessionStore,
  publicBaseUrl,
  requirePublishedAssets: true,
  usePublishedAssets: true,
  getStore: () => getHotStoreSnapshot(),
  resolveKeywordBindingAction,
  onRecord: (...args) => {
    try {
      recordAction(...args);
    } catch (error) {
      console.error('[recordAction]', error);
    }
  }
});

async function handleLineEvent(event) {
  if (event.type !== 'message' && event.type !== 'postback') {
    return null;
  }

  const sessionKey = event.source?.userId || event.source?.groupId || event.source?.roomId || 'anonymous';
  const text = event.type === 'postback'
    ? `${event.postback?.data || ''}`
    : `${event.message?.text || ''}`;
  const postback = event.type === 'postback' ? parseStoryPostbackData(text) : {};

  let result;
  try {
    result = await storyRuntime.processTextInput({
      userId: sessionKey,
      sessionKey,
      text,
      action: postback.action || '',
      storyId: postback.storyId || '',
      fromNodeId: postback.fromNodeId || postback.nodeId || '',
      nodeId: postback.nodeId || '',
      choice: postback.choice || '',
      nextNodeId: postback.nextNodeId || '',
      postbackData: text,
      source: 'webhook'
    });
  } catch (error) {
    console.error('[runtime.processTextInput]', error);
    if (!event.replyToken) return null;
    const storyEntryUrl = `${publicBaseUrl.replace(/\/$/, '')}/story`;
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: `目前可以先從數位繪本入口開始閱讀：\n${storyEntryUrl}`
    });
  }

  if (!result?.messages?.length) {
    return null;
  }

  return client.replyMessage(event.replyToken, result.messages);
}

function getHeader(req, name) {
  const headerName = `${name || ''}`.toLowerCase();
  return req.headers?.[headerName] || req.headers?.[name] || '';
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function jsonResponse(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function parseWebhookRequest(req) {
  const rawBody = await readRequestBody(req);
  const signature = getHeader(req, line.LINE_SIGNATURE_HTTP_HEADER_NAME || 'x-line-signature');

  if (!signature) {
    const error = new Error('Missing LINE signature header');
    error.statusCode = 400;
    throw error;
  }

  if (!config.channelSecret) {
    const error = new Error('Missing LINE_CHANNEL_SECRET');
    error.statusCode = 500;
    throw error;
  }

  const isValid = line.validateSignature(rawBody, config.channelSecret, signature);
  if (!isValid) {
    const error = new Error('Invalid LINE signature');
    error.statusCode = 401;
    throw error;
  }

  try {
    return rawBody ? JSON.parse(rawBody) : {};
  } catch (error) {
    error.statusCode = 400;
    throw error;
  }
}

module.exports = async function webhookHandler(req, res) {
  if (req.method === 'GET') {
    return jsonResponse(res, 200, { ok: true, name: 'lineat-webhook', mode: 'vercel' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return jsonResponse(res, 405, { error: 'Method not allowed' });
  }

  if (!config.channelAccessToken || !config.channelSecret) {
    return jsonResponse(res, 500, { error: 'Missing LINE_CHANNEL_ACCESS_TOKEN or LINE_CHANNEL_SECRET' });
  }

  try {
    const body = await parseWebhookRequest(req);
    const events = Array.isArray(body.events) ? body.events : [];
    await Promise.all(events.map(handleLineEvent));
    return jsonResponse(res, 200, { success: true });
  } catch (error) {
    console.error('webhook error:', error);
    try {
      recordAction('webhook.error', {
        actor: 'system',
        role: 'system',
        targetId: 'webhook',
        result: 'failure',
        detail: error.message
      });
    } catch (recordError) {
      console.error('[recordAction]', recordError);
    }
    return jsonResponse(res, error.statusCode || 500, { error: error.message || 'Webhook failed' });
  }
};
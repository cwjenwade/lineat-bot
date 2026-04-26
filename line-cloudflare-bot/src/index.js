import { getStoryNodeByKeyword } from './storyMap.js';
import { buildR2PublicImageUrl } from './utils.js';

const LINE_REPLY_ENDPOINT = 'https://api.line.me/v2/bot/message/reply';
const DEFAULT_REPLY_TEXT = '我暫時聽不懂這個關鍵字，請輸入：開始 或 幫助';

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8'
    }
  });
}

function textResponse(text, status = 200) {
  return new Response(text, {
    status,
    headers: {
      'content-type': 'text/plain; charset=utf-8'
    }
  });
}

async function replyMessage(accessToken, replyToken, messages) {
  const response = await fetch(LINE_REPLY_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      replyToken,
      messages
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`LINE reply failed: ${response.status} ${body}`);
  }
}

function toLineMessageFromNode(node, env) {
  if (!node || typeof node !== 'object') {
    return {
      type: 'text',
      text: DEFAULT_REPLY_TEXT
    };
  }

  if (node.type === 'text') {
    return {
      type: 'text',
      text: `${node.text || DEFAULT_REPLY_TEXT}`
    };
  }

  if (node.type === 'image') {
    const originalContentUrl = buildR2PublicImageUrl(env, node.fileName);
    return {
      type: 'image',
      originalContentUrl,
      previewImageUrl: originalContentUrl
    };
  }

  return {
    type: 'text',
    text: DEFAULT_REPLY_TEXT
  };
}

async function handleWebhookEvent(event, env) {
  if (!event || event.type !== 'message' || event.message?.type !== 'text') {
    return;
  }

  const accessToken = `${env.CHANNEL_ACCESS_TOKEN || ''}`.trim();
  if (!accessToken) {
    throw new Error('Missing required secret: CHANNEL_ACCESS_TOKEN');
  }

  const keyword = `${event.message.text || ''}`.trim();
  const node = getStoryNodeByKeyword(keyword);
  const lineMessage = toLineMessageFromNode(node, env);

  await replyMessage(accessToken, event.replyToken, [lineMessage]);
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return textResponse('LINE webhook worker is running', 200);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400);
    }

    const events = Array.isArray(payload?.events) ? payload.events : [];

    for (const event of events) {
      await handleWebhookEvent(event, env);
    }

    return jsonResponse({ ok: true, handledEvents: events.length }, 200);
  }
};

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

function parseDotEnv(filePath) {
  const out = {};
  if (!fs.existsSync(filePath)) return out;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let value = m[2] || '';
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[m[1]] = value;
  }
  return out;
}

function postSignedWebhook(body, secret) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64');

    const req = https.request(
      {
        hostname: 'debbylinehose-brown.vercel.app',
        path: '/webhook',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-line-signature': signature,
          'Content-Length': Buffer.byteLength(payload)
        }
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let parsed = null;
          try {
            parsed = JSON.parse(text);
          } catch (_error) {
            parsed = text;
          }
          resolve({ status: res.statusCode, body: parsed });
        });
      }
    );

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function loadFirstNodeData(workspaceRoot) {
  const filePath = path.join(workspaceRoot, 'data', 'story-authoring.json');
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const stories = Array.isArray(parsed.stories) ? parsed.stories : [];
  const story = stories.find((s) => s.id === 'example') || stories[0] || null;
  if (!story) {
    return { storyId: '', firstNodeId: '' };
  }
  const firstNodeId = story.startNodeId || (story.nodes?.[0]?.id || '');
  return { storyId: story.id, firstNodeId };
}

async function main() {
  const workspaceRoot = process.cwd();
  const env = {
    ...parseDotEnv(path.join(workspaceRoot, '.env')),
    ...process.env
  };

  const secret = env.LINE_CHANNEL_SECRET;
  if (!secret) {
    throw new Error('LINE_CHANNEL_SECRET is missing');
  }

  const { storyId: detectedStoryId, firstNodeId } = loadFirstNodeData(workspaceRoot);

  const baseEvent = {
    replyToken: '00000000000000000000000000000000',
    source: { type: 'user', userId: 'Utestuser1234567890' },
    timestamp: Date.now(),
    mode: 'active',
    webhookEventId: '01HZXT9TESTEVENTID',
    deliveryContext: { isRedelivery: false }
  };

  const cases = [
    {
      name: 'message event: 顯示繪本故事',
      body: {
        destination: 'Uxxxxxxxx',
        events: [
          {
            ...baseEvent,
            type: 'message',
            message: { id: '100001', type: 'text', text: '顯示繪本故事' }
          }
        ]
      }
    },
    {
      name: 'postback event: start_story example',
      body: {
        destination: 'Uxxxxxxxx',
        events: [
          {
            ...baseEvent,
            type: 'postback',
            postback: { data: 'action=start_story&storyId=example' }
          }
        ]
      }
    },
    {
      name: 'postback event: story_choice example + firstNodeId + A',
      body: {
        destination: 'Uxxxxxxxx',
        events: [
          {
            ...baseEvent,
            type: 'postback',
            postback: {
              data: `action=story_choice&storyId=example&fromNodeId=${encodeURIComponent(firstNodeId)}&choice=A`
            }
          }
        ]
      }
    },
    {
      name: 'postback event: start_story detectedStoryId',
      body: {
        destination: 'Uxxxxxxxx',
        events: [
          {
            ...baseEvent,
            type: 'postback',
            postback: { data: `action=start_story&storyId=${encodeURIComponent(detectedStoryId)}` }
          }
        ]
      }
    }
  ];

  const results = [];
  for (const c of cases) {
    const r = await postSignedWebhook(c.body, secret);
    results.push({ name: c.name, status: r.status, body: r.body });
  }

  console.log(
    JSON.stringify(
      {
        detectedStoryId,
        firstNodeId,
        results
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});

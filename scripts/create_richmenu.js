require('dotenv').config();

const fs = require('fs');

const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;

if (!channelAccessToken) {
  console.error('Missing LINE_CHANNEL_ACCESS_TOKEN in .env');
  process.exit(1);
}

async function lineRequest(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${channelAccessToken}`,
      ...options.headers
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${response.status} ${response.statusText}\n${text}`);
  }

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

async function main() {
  const richMenu = await lineRequest('https://api.line.me/v2/bot/richmenu', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      size: {
        width: 2500,
        height: 843
      },
      selected: true,
      name: 'Digital Picture Book Menu',
      chatBarText: '繪本選單',
      areas: [
        {
          bounds: { x: 0, y: 0, width: 833, height: 843 },
          action: { type: 'message', text: '開始故事' }
        },
        {
          bounds: { x: 833, y: 0, width: 834, height: 843 },
          action: { type: 'message', text: '下一頁' }
        },
        {
          bounds: { x: 1667, y: 0, width: 833, height: 843 },
          action: { type: 'message', text: '重來' }
        }
      ]
    })
  });

  const richMenuId = richMenu.richMenuId;
  const imageBuffer = fs.readFileSync('assets/richmenu.png');

  await lineRequest(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: 'POST',
    headers: {
      'Content-Type': 'image/png'
    },
    body: imageBuffer
  });

  await lineRequest(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, {
    method: 'POST'
  });

  console.log(`Rich menu created and set as default: ${richMenuId}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

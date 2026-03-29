require('dotenv').config();

const fs = require('fs');
const path = require('path');

const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const imagePath = process.env.RICHMENU_IMAGE_PATH
  || '/Users/wade/Documents/圖文選單lineat/圖文選單lineat.001.jpeg';

if (!channelAccessToken) {
  console.error('Missing LINE_CHANNEL_ACCESS_TOKEN in .env');
  process.exit(1);
}

if (!fs.existsSync(imagePath)) {
  console.error(`Rich menu image not found: ${imagePath}`);
  process.exit(1);
}

function imageContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  throw new Error(`Unsupported rich menu image type: ${ext}`);
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
        height: 1686
      },
      selected: true,
      name: 'Ho Se Ong Lai Rich Menu',
      chatBarText: '旺來好勢',
      areas: [
        {
          bounds: { x: 0, y: 0, width: 720, height: 1686 },
          action: { type: 'uri', uri: 'https://hoseonglai.vercel.app/' }
        },
        {
          bounds: { x: 720, y: 0, width: 1780, height: 860 },
          action: { type: 'message', text: '顯示繪本故事' }
        },
        {
          bounds: { x: 720, y: 860, width: 445, height: 826 },
          action: { type: 'uri', uri: 'https://hoseonglai.vercel.app/brand-philosophy' }
        },
        {
          bounds: { x: 1165, y: 860, width: 445, height: 826 },
          action: { type: 'uri', uri: 'https://hoseonglai.vercel.app/heartfelt-momentum' }
        },
        {
          bounds: { x: 1610, y: 860, width: 445, height: 826 },
          action: { type: 'uri', uri: 'https://hoseonglai.vercel.app/fortune-arrives' }
        },
        {
          bounds: { x: 2055, y: 860, width: 445, height: 826 },
          action: { type: 'uri', uri: 'https://hoseonglai.vercel.app/togetherness' }
        }
      ]
    })
  });

  const richMenuId = richMenu.richMenuId;
  const imageBuffer = fs.readFileSync(imagePath);

  await lineRequest(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
    method: 'POST',
    headers: {
      'Content-Type': imageContentType(imagePath)
    },
    body: imageBuffer
  });

  await lineRequest(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, {
    method: 'POST'
  });

  console.log(`Rich menu created and set as default: ${richMenuId}`);
  console.log(`Image: ${imagePath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

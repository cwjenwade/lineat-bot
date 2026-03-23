require('dotenv').config();

const { storyNodes } = require('../storyData');

const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
const publicBaseUrl = process.env.PUBLIC_BASE_URL || 'https://lineat-bot.onrender.com';

function getRoleIconPath(title) {
  if (title.includes('熊熊的內心')) return '/public/story/01/roles/inner-bear.png';
  if (title.includes('熊熊')) return '/public/story/01/roles/bear.png';
  if (title.includes('旁白') || title.includes('早餐')) return '/public/story/01/roles/narrator.png';
  if (title.includes('夢境')) return '/public/story/01/roles/dream.png';
  if (title.includes('莉莉')) return '/public/story/01/roles/lily.png';
  if (title.includes('熊爸爸')) return '/public/story/01/roles/dad.png';
  if (title.includes('熊媽媽')) return '/public/story/01/roles/mom.png';
  if (title.includes('好友')) return '/public/story/01/roles/friends.png';
  if (title.includes('村民')) return '/public/story/01/roles/villager.png';
  if (title.includes('河狸')) return '/public/story/01/roles/beaver.png';
  if (title.includes('鹿')) return '/public/story/01/roles/deer.png';
  if (title.includes('貓頭鷹')) return '/public/story/01/roles/owl.png';
  if (title.includes('蜜蜂')) return '/public/story/01/roles/bee.png';
  if (title.includes('洞穴')) return '/public/story/01/roles/cave.png';
  if (title.includes('旅') || title.includes('篝火') || title.includes('入口')) return '/public/story/01/roles/journey.png';
  return '/public/story/01/roles/narrator.png';
}

function getRoleThemeInfo(title) {
  if (title.includes('熊熊的內心')) return { border: '#8B6FB7', button: '#C7B2EA' };
  if (title.includes('熊熊')) return { border: '#8B6A4E', button: '#F3BD63' };
  if (title.includes('旁白') || title.includes('早餐')) return { border: '#56616A', button: '#B8C4CC' };
  if (title.includes('夢境')) return { border: '#9A7A1F', button: '#F6E39C' };
  if (title.includes('莉莉')) return { border: '#B9687B', button: '#F5C9D4' };
  if (title.includes('熊爸爸')) return { border: '#5D7A3F', button: '#CFE5B7' };
  if (title.includes('熊媽媽')) return { border: '#A95555', button: '#F6C2C2' };
  if (title.includes('好友')) return { border: '#3D7D8D', button: '#BCE7F0' };
  if (title.includes('村民')) return { border: '#8A6E2A', button: '#E9D7AE' };
  if (title.includes('河狸')) return { border: '#8D5A3B', button: '#E9C5A6' };
  if (title.includes('鹿')) return { border: '#81722B', button: '#ECE0AC' };
  if (title.includes('貓頭鷹')) return { border: '#6C543D', button: '#D7BCA6' };
  if (title.includes('蜜蜂')) return { border: '#9D7A00', button: '#F8DD8B' };
  if (title.includes('洞穴')) return { border: '#58638F', button: '#D1D8F2' };
  if (title.includes('旅') || title.includes('篝火') || title.includes('入口')) return { border: '#5C7240', button: '#D0DCBE' };
  return { border: '#56616A', button: '#B8C4CC' };
}

function toLineLabel(text) {
  const compact = text
    .replace(/^熊熊(難過地想|嘆了一口氣|總覺得哪裡不對勁，決定)?[:：]?/, '')
    .replace(/^看到流星的你，會想到什麼？/, '流星心願')
    .replace(/^對於未知的冒險感到焦慮與擔心嗎？/, '未知冒險')
    .trim();

  if (compact.length <= 20) return compact;
  return `${compact.slice(0, 19)}…`;
}

function createChoiceFlex(choice) {
  const theme = getRoleThemeInfo(choice.prompt);
  return {
    type: 'flex',
    altText: '互動繪本選項',
    contents: {
      type: 'bubble',
      size: 'giga',
      hero: {
        type: 'image',
        url: `${publicBaseUrl}/${choice.image}`,
        size: 'full',
        aspectRatio: '4:3',
        aspectMode: 'cover'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        contents: [
          {
            type: 'box',
            layout: 'vertical',
            backgroundColor: theme.border,
            cornerRadius: '12px',
            paddingAll: '10px',
            contents: [
              {
                type: 'text',
                text: choice.prompt,
                weight: 'bold',
                size: 'md',
                wrap: true,
                color: '#FFFFFF'
              }
            ]
          },
          {
            type: 'button',
            style: 'primary',
            color: theme.button,
            action: {
              type: 'message',
              label: toLineLabel(choice.correct),
              text: choice.correct
            }
          },
          {
            type: 'button',
            style: 'primary',
            color: '#D8E0EF',
            action: {
              type: 'message',
              label: toLineLabel(choice.wrong),
              text: choice.wrong
            }
          }
        ]
      }
    }
  };
}

function createStoryBubble(card) {
  const roleIconUrl = `${publicBaseUrl}${getRoleIconPath(card.title)}`;
  const theme = getRoleThemeInfo(card.title);
  return {
    type: 'bubble',
    hero: {
      type: 'image',
      url: `${publicBaseUrl}/${card.image}`,
      size: 'full',
      aspectRatio: '1:1',
      aspectMode: 'cover'
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        {
          type: 'box',
          layout: 'vertical',
          backgroundColor: theme.border,
          cornerRadius: '12px',
          paddingAll: '8px',
          contents: [
            {
              type: 'text',
              text: card.title,
              weight: 'bold',
              size: 'sm',
              wrap: true,
              color: '#FFFFFF'
            }
          ]
        },
        ...(card.body ? [{
          type: 'text',
          text: card.body,
          wrap: true,
          size: 'md',
          color: '#2D241B'
        }] : []),
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'md',
          contents: [
            {
              type: 'filler'
            },
            {
              type: 'image',
              url: roleIconUrl,
              size: 'sm',
              aspectMode: 'cover',
              aspectRatio: '1:1'
            }
          ]
        }
      ]
    }
  };
}

function createStoryCarousel(cards) {
  return {
    type: 'flex',
    altText: '故事多頁訊息',
    contents: {
      type: 'carousel',
      contents: cards.map(createStoryBubble)
    }
  };
}

function createContinuePrompt(label) {
  return {
    type: 'text',
    text: '看完這一幕後，點下面按鈕繼續。',
    quickReply: {
      items: [
        {
          type: 'action',
          action: {
            type: 'message',
            label: toLineLabel(label),
            text: label
          }
        }
      ]
    }
  };
}

function buildMessages(node) {
  const messages = [];
  node.blocks?.forEach((block) => {
    if (block.type === 'text') messages.push({ type: 'text', text: block.text });
    if (block.type === 'gallery') messages.push(createStoryCarousel(block.cards));
  });
  if (node.choice) {
    messages.push({ type: 'text', text: node.choice.prompt });
    messages.push(createChoiceFlex(node.choice));
  } else if (node.continue) {
    messages.push(createContinuePrompt(node.continue.label));
  } else if (node.endingText) {
    messages.push({ type: 'text', text: node.endingText });
  }
  return messages.slice(0, 5);
}

async function validateNode(node) {
  const messages = buildMessages(node);
  const response = await fetch('https://api.line.me/v2/bot/message/validate/reply', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ messages })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${node.id}: ${response.status} ${text}`);
  }

  return `${node.id}: ok`;
}

(async () => {
  for (const node of storyNodes) {
    const result = await validateNode(node);
    console.log(result);
  }
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

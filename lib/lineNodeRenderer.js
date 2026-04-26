const { resolveAssetUrl } = require('./lineatRenderer');

function buildStoryPostbackData(payload = {}) {
  const params = new URLSearchParams();
  const entries = {
    action: `${payload.action || ''}`.trim(),
    storyId: `${payload.storyId || ''}`.trim(),
    fromNodeId: `${payload.fromNodeId || payload.nodeId || ''}`.trim(),
    nodeId: `${payload.nodeId || ''}`.trim(),
    choice: `${payload.choice || ''}`.trim(),
    nextNodeId: `${payload.nextNodeId || ''}`.trim(),
    continueLabel: `${payload.continueLabel || ''}`.trim(),
    choiceLabel: `${payload.choiceLabel || ''}`.trim(),
    triggerKeyword: `${payload.triggerKeyword || ''}`.trim()
  };

  for (const [key, value] of Object.entries(entries)) {
    if (value) params.set(key, value);
  }

  return params.toString();
}

function parseStoryPostbackData(rawData = '') {
  const trimmed = `${rawData || ''}`.trim();
  if (!trimmed) return {};

  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_error) {
      return {};
    }
  }

  const params = new URLSearchParams(trimmed);
  const parsed = {};
  for (const [key, value] of params.entries()) {
    if (parsed[key] === undefined) {
      parsed[key] = value;
    } else if (Array.isArray(parsed[key])) {
      parsed[key].push(value);
    } else {
      parsed[key] = [parsed[key], value];
    }
  }
  return parsed;
}

function resolveStoryHeroImage(story = {}, node = {}, publicBaseUrl = '') {
  const candidatePaths = [
    `${node.imagePath || ''}`.trim(),
    `${node.image || ''}`.trim(),
    `${node.heroImagePath || ''}`.trim(),
    `${story.publishedAssets?.[node.id] || ''}`.trim(),
    `${story.publishedAssets?.[`${node.id}:image`] || ''}`.trim(),
    `${story.publishedAssets?.[`${node.id}:hero`] || ''}`.trim()
  ].filter(Boolean);

  const candidate = candidatePaths[0] || '';
  if (!candidate) return '';
  if (/^https?:\/\//i.test(candidate)) return candidate;
  return resolveAssetUrl(candidate, publicBaseUrl);
}

function createTextBlock(text, options = {}) {
  return {
    type: 'text',
    text,
    wrap: true,
    ...options
  };
}

function createActionButton(label, data) {
  return {
    type: 'button',
    style: 'primary',
    color: '#C8833D',
    action: {
      type: 'postback',
      label: `${label || ''}`.slice(0, 20) || '繼續',
      data,
      displayText: `${label || ''}`.trim() || '繼續'
    }
  };
}

function buildLineNodeMessages(story = {}, node = {}, options = {}) {
  const publicBaseUrl = options.publicBaseUrl || process.env.PUBLIC_BASE_URL || 'https://debbylinehose.vercel.app';
  const storyId = `${story.id || options.storyId || ''}`.trim();
  const nodeTitle = `${node.title || ''}`.trim() || `${story.title || ''}`.trim() || '繪本故事';
  const nodeText = `${node.text || ''}`.trim();
  const nodePrompt = `${node.prompt || ''}`.trim();
  const nodeTransitionText = `${node.transitionText || ''}`.trim();
  const imageUrl = resolveStoryHeroImage(story, node, publicBaseUrl);
  const isChoiceNode = node.type === 'choice';

  const bodyContents = [
    createTextBlock(nodeTitle, {
      weight: 'bold',
      size: 'lg',
      color: '#2D241B'
    })
  ];

  if (nodeText) {
    bodyContents.push(createTextBlock(nodeText, {
      size: 'sm',
      color: '#5F584F',
      margin: 'sm'
    }));
  }

  if (nodePrompt && nodePrompt !== nodeText) {
    bodyContents.push(createTextBlock(nodePrompt, {
      size: 'sm',
      color: '#7A6046',
      margin: 'sm'
    }));
  }

  if (nodeTransitionText && nodeTransitionText !== nodeText && nodeTransitionText !== nodePrompt) {
    bodyContents.push(createTextBlock(nodeTransitionText, {
      size: 'xs',
      color: '#9B7C58',
      margin: 'sm'
    }));
  }

  const footerButtons = [];

  if (isChoiceNode) {
    const optionA = node.optionA || {};
    const optionB = node.optionB || {};
    footerButtons.push(createActionButton(optionA.label || '選項 A', buildStoryPostbackData({
      action: 'story_choice',
      storyId,
      fromNodeId: node.id,
      choice: 'A',
      nextNodeId: optionA.nextNodeId || node.nextNodeId || '',
      choiceLabel: optionA.label || '選項 A'
    })));
    if (optionB.label) {
      footerButtons.push(createActionButton(optionB.label || '選項 B', buildStoryPostbackData({
        action: 'story_choice',
        storyId,
        fromNodeId: node.id,
        choice: 'B',
        nextNodeId: optionB.nextNodeId || node.nextNodeId || '',
        choiceLabel: optionB.label || '選項 B'
      })));
    }
  } else if (node.nextNodeId) {
    const continueLabel = `${node.continueLabel || ''}`.trim() || '下一步';
    footerButtons.push(createActionButton(continueLabel, buildStoryPostbackData({
      action: 'continue_story',
      storyId,
      fromNodeId: node.id,
      nextNodeId: node.nextNodeId,
      continueLabel
    })));
  }

  const bubble = {
    type: 'bubble',
    size: 'mega',
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: '18px',
      backgroundColor: '#FFF8EF',
      contents: bodyContents
    }
  };

  if (imageUrl) {
    bubble.hero = {
      type: 'image',
      url: imageUrl,
      size: 'full',
      aspectRatio: '16:27',
      aspectMode: 'cover'
    };
  }

  if (footerButtons.length) {
    bubble.footer = {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingTop: '14px',
      paddingBottom: '18px',
      paddingStart: '18px',
      paddingEnd: '18px',
      backgroundColor: '#FFFDF8',
      contents: footerButtons
    };
  }

  return [{
    type: 'flex',
    altText: nodeTitle,
    contents: bubble
  }];
}

function buildStoryEndMessages(story = {}, options = {}) {
  const storyId = `${story.id || options.storyId || ''}`.trim();
  const storyTitle = `${story.title || ''}`.trim() || '繪本故事';

  return [
    {
      type: 'text',
      text: `${storyTitle} 先到這裡。`
    },
    {
      type: 'flex',
      altText: '故事結束',
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          paddingAll: '18px',
          spacing: 'md',
          backgroundColor: '#FFF8EF',
          contents: [
            {
              type: 'text',
              text: '故事先告一段落',
              weight: 'bold',
              size: 'lg',
              color: '#2D241B',
              wrap: true
            },
            {
              type: 'text',
              text: '你可以回到故事選單再選一次。',
              size: 'sm',
              color: '#6D6255',
              wrap: true
            }
          ]
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
            createActionButton('回故事選單', buildStoryPostbackData({
              action: 'story_menu',
              storyId
            }))
          ]
        }
      }
    }
  ];
}

module.exports = {
  buildStoryPostbackData,
  parseStoryPostbackData,
  resolveStoryHeroImage,
  buildLineNodeMessages,
  buildStoryEndMessages
};

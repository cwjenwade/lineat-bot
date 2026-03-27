const fs = require('fs');
const path = require('path');

const PUBLIC_ROOT = path.join(__dirname, '..', 'public');

function getNameplatePreset(globalSettings, sizeKey = 'lg') {
  return globalSettings.nameplateSizePresets?.[sizeKey] || globalSettings.nameplateSizePresets?.lg;
}

function getCharacter(globalSettings, characterId) {
  return (globalSettings.characters || []).find((character) => character.id === characterId) || null;
}

function getScopedSettings(store, story) {
  return {
    ...store.globalSettings,
    characters: story.characters?.length ? story.characters : store.globalSettings.characters
  };
}

function resolveAssetUrl(assetPath = '', publicBaseUrl = '') {
  if (!assetPath) return '';
  if (/^https?:\/\//.test(assetPath)) return assetPath;
  if (!assetPath.startsWith('/')) {
    return `${publicBaseUrl}/${assetPath}`.replace(/([^:]\/)\/+/g, '$1');
  }
  return `${publicBaseUrl}${assetPath}`;
}

function assetExists(assetPath = '') {
  if (!assetPath || /^https?:\/\//.test(assetPath)) return true;
  const relative = assetPath.startsWith('/public/')
    ? assetPath.slice('/public/'.length)
    : assetPath.startsWith('public/')
      ? assetPath.slice('public/'.length)
      : assetPath.replace(/^\//, '');
  return fs.existsSync(path.join(PUBLIC_ROOT, relative));
}

function previewFontCss(fontKey = 'default') {
  if (fontKey === 'handwritten') return '"DFKai-SB", "Klee One", "PingFang TC", cursive';
  if (fontKey === 'serif') return '"Songti TC", "Noto Serif TC", serif';
  if (fontKey === 'rounded') return '"Arial Rounded MT Bold", "PingFang TC", sans-serif';
  return '"PingFang TC", "Noto Sans TC", sans-serif';
}

function normalizeLineTextSize(size = 'lg') {
  return ['md', 'lg', 'xl'].includes(size) ? size : 'lg';
}

function createSpeakerMeta(globalSettings, characterId, publicBaseUrl, forceNameplate = true) {
  const character = getCharacter(globalSettings, characterId);
  if (!character) return null;
  return {
    ...character,
    avatarUrl: resolveAssetUrl(character.avatarPath, publicBaseUrl),
    showNameplate: forceNameplate
  };
}

function createDialogueCardModel(source, globalSettings, publicBaseUrl, options = {}) {
  const layout = globalSettings.cardLayouts.dialogue;
  const speaker = createSpeakerMeta(globalSettings, source.speakerCharacterId, publicBaseUrl, true);
  const companion = source.companionCharacterId ? createSpeakerMeta(globalSettings, source.companionCharacterId, publicBaseUrl, false) : null;

  return {
    kind: 'dialogue',
    title: source.title || '',
    imagePath: source.imagePath || '',
    imageUrl: resolveAssetUrl(source.imagePath, publicBaseUrl),
    text: source.text || '',
    previewFont: source.previewFont || globalSettings.defaults.previewFont,
    lineTextSize: normalizeLineTextSize(source.lineTextSize || globalSettings.defaults.lineTextSize),
    lineTextColor: source.lineTextColor || '#2D241B',
    heroImageOpacity: Number.isFinite(source.heroImageOpacity) ? source.heroImageOpacity : 1,
    heroImageScale: Number.isFinite(source.heroImageScale) ? source.heroImageScale : 1,
    nameplateSize: source.nameplateSize || globalSettings.defaults.nameplateSize,
    layout,
    speaker,
    companion
  };
}

function createNarrationCardModel(source, globalSettings, publicBaseUrl) {
  return {
    kind: 'narration',
    title: source.title || '旁白',
    imagePath: source.imagePath || '',
    imageUrl: resolveAssetUrl(source.imagePath, publicBaseUrl),
    text: source.text || '',
    previewFont: source.previewFont || globalSettings.defaults.previewFont,
    lineTextSize: normalizeLineTextSize(source.lineTextSize || globalSettings.defaults.lineTextSize),
    lineTextColor: source.lineTextColor || '#2D241B',
    heroImageOpacity: Number.isFinite(source.heroImageOpacity) ? source.heroImageOpacity : 1,
    heroImageScale: Number.isFinite(source.heroImageScale) ? source.heroImageScale : 1,
    layout: globalSettings.cardLayouts.narration
  };
}

function createChoiceCardModel(node, globalSettings, publicBaseUrl) {
  return {
    kind: 'choice',
    title: node.title || '選項',
    imagePath: node.imagePath || '',
    imageUrl: resolveAssetUrl(node.imagePath, publicBaseUrl),
    prompt: node.prompt || '在這裡輸入選項提問。',
    heroImageOpacity: Number.isFinite(node.heroImageOpacity) ? node.heroImageOpacity : 1,
    heroImageScale: Number.isFinite(node.heroImageScale) ? node.heroImageScale : 1,
    optionA: node.optionA,
    optionB: node.optionB,
    layout: globalSettings.cardLayouts.choice
  };
}

function createHeroImageBox(model, globalSettings) {
  const contents = [
    {
      type: 'image',
      url: model.imageUrl,
      size: 'full',
      aspectRatio: globalSettings.defaults.imageAspectRatio,
      aspectMode: 'cover'
    }
  ];
  if (model.heroImageOpacity < 1) {
    const overlayOpacity = Math.max(0, Math.min(1, 1 - model.heroImageOpacity));
    contents.push({
      type: 'box',
      layout: 'vertical',
      position: 'absolute',
      offsetTop: '0px',
      offsetStart: '0px',
      offsetEnd: '0px',
      offsetBottom: '0px',
      backgroundColor: `rgba(255,255,255,${overlayOpacity.toFixed(2)})`,
      contents: []
    });
  }
  return {
    type: 'box',
    layout: 'vertical',
    height: `${model.layout.heroHeight}px`,
    paddingAll: '0px',
    contents
  };
}

function buildNodeModels(story, node, globalSettings, publicBaseUrl) {
  const models = [];

  if (node.type === 'dialogue') {
    models.push(createDialogueCardModel(node, globalSettings, publicBaseUrl));
  } else if (node.type === 'narration') {
    models.push(createNarrationCardModel(node, globalSettings, publicBaseUrl));
  } else if (node.type === 'carousel') {
    (node.pages || []).forEach((page) => {
      if (page.cardType === 'narration') {
        models.push(createNarrationCardModel(page, globalSettings, publicBaseUrl));
      } else {
        models.push(createDialogueCardModel(page, globalSettings, publicBaseUrl));
      }
    });
  } else if (node.type === 'choice') {
    if (Array.isArray(node.pages) && node.pages.length) {
      node.pages.forEach((page) => {
        if (page.cardType === 'narration') {
          models.push(createNarrationCardModel(page, globalSettings, publicBaseUrl));
        } else {
          models.push(createDialogueCardModel(page, globalSettings, publicBaseUrl));
        }
      });
    } else if (node.speakerCharacterId) {
      models.push(createDialogueCardModel(node, globalSettings, publicBaseUrl));
    } else if (node.text) {
      models.push(createNarrationCardModel(node, globalSettings, publicBaseUrl));
    }
    models.push(createChoiceCardModel(node, globalSettings, publicBaseUrl));
  }

  return models;
}

function buildDialogueOverlay(model, side, globalSettings, includeNameplate) {
  const role = side === 'speaker' ? model.speaker : model.companion;
  if (!role) return [];
  const preset = getNameplatePreset(globalSettings, includeNameplate ? model.nameplateSize : role.nameplateSize);
  const isLeft = role.placement === 'left';

  const avatarNode = {
    type: 'image',
    url: role.avatarUrl,
    size: `${role.avatarSize}px`,
    aspectRatio: '1:1',
    aspectMode: 'cover',
    position: 'absolute',
    offsetTop: `${role.avatarY}px`,
    ...(isLeft ? { offsetStart: `${role.avatarX}px` } : { offsetEnd: `${role.avatarX}px` })
  };

  const nodes = [];
  if (includeNameplate) {
    const nameplateNode = {
      type: 'box',
      layout: 'vertical',
      position: 'absolute',
      offsetTop: `${role.nameplateY}px`,
      backgroundColor: role.nameplateColor,
      cornerRadius: `${preset.cornerRadius}px`,
      paddingTop: `${preset.paddingY}px`,
      paddingBottom: `${preset.paddingY}px`,
      paddingStart: `${preset.paddingX}px`,
      paddingEnd: `${preset.paddingX}px`,
      ...(role.nameplateAnchor === 'right-percent'
        ? { offsetEnd: `${Math.round((model.layout.totalHeight * 0) + role.nameplateRightPercent)}%` }
        : role.nameplateAnchor === 'right-fixed'
          ? { offsetEnd: `${role.nameplateX}px` }
          : { offsetStart: `${role.nameplateX}px` }),
      contents: [
        {
          type: 'text',
          text: role.name,
          weight: 'bold',
          size: preset.fontSize,
          align: 'center',
          color: role.nameplateTextColor,
          wrap: false
        }
      ]
    };
    nodes.push(nameplateNode);
  }

  nodes.push(avatarNode);
  return nodes;
}

function renderDialogueBubble(model, globalSettings) {
  const layout = model.layout;
  const safePaddingStart = model.speaker?.placement === 'left' ? layout.leftSafePadding : layout.bodyPaddingSide;
  const safePaddingEnd = model.speaker?.placement === 'right' ? layout.rightSafePadding : layout.bodyPaddingSide;

  return {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '0px',
      spacing: 'none',
      contents: [
        {
          type: 'box',
          layout: 'vertical',
          height: `${layout.totalHeight}px`,
          paddingAll: '0px',
          backgroundColor: '#F5EEE3',
          contents: [
            {
              ...createHeroImageBox(model, globalSettings)
            },
            {
              type: 'box',
              layout: 'vertical',
              height: `${layout.bodyHeight}px`,
              position: 'absolute',
              offsetTop: `${layout.intersectionY}px`,
              offsetStart: '0px',
              offsetEnd: '0px',
              paddingTop: `${layout.bodyPaddingTop}px`,
              paddingBottom: `${layout.bodyPaddingBottom}px`,
              paddingStart: `${safePaddingStart}px`,
              paddingEnd: `${safePaddingEnd}px`,
              backgroundColor: '#FFFDF8',
              contents: [
                {
                  type: 'text',
                  text: model.text,
                  wrap: true,
                  size: model.lineTextSize,
                  align: 'center',
                  gravity: 'center',
                  lineSpacing: layout.lineSpacing,
                  color: model.lineTextColor
                }
              ]
            },
            ...buildDialogueOverlay(model, 'speaker', globalSettings, true),
            ...buildDialogueOverlay(model, 'companion', globalSettings, false)
          ]
        }
      ]
    }
  };
}

function renderNarrationBubble(model, globalSettings) {
  const layout = model.layout;
  return {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '0px',
      spacing: 'none',
      contents: [
        {
          type: 'box',
          layout: 'vertical',
          height: `${layout.totalHeight}px`,
          paddingAll: '0px',
          backgroundColor: '#F5EEE3',
          contents: [
            {
              ...createHeroImageBox(model, globalSettings)
            },
            {
              type: 'box',
              layout: 'vertical',
              position: 'absolute',
              offsetTop: `${layout.intersectionY}px`,
              offsetStart: '0px',
              offsetEnd: '0px',
              height: `${layout.bodyHeight}px`,
              paddingTop: `${layout.bodyPaddingTop}px`,
              paddingBottom: `${layout.bodyPaddingBottom}px`,
              paddingStart: `${layout.bodyPaddingSide}px`,
              paddingEnd: `${layout.bodyPaddingSide}px`,
              backgroundColor: '#FFFDF8',
              contents: [
                {
                  type: 'text',
                  text: model.text,
                  wrap: true,
                  size: model.lineTextSize,
                  align: 'center',
                  gravity: 'center',
                  lineSpacing: layout.lineSpacing,
                  color: model.lineTextColor
                }
              ]
            }
          ]
        }
      ]
    }
  };
}

function renderChoiceBubble(model, globalSettings) {
  const layout = model.layout;
  return {
    type: 'bubble',
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '0px',
      spacing: 'none',
      contents: [
        {
          type: 'box',
          layout: 'vertical',
          height: `${layout.totalHeight}px`,
          backgroundColor: '#F5EEE3',
          contents: [
            {
              ...createHeroImageBox(model, globalSettings)
            },
            {
              type: 'box',
              layout: 'vertical',
              position: 'absolute',
              offsetTop: `${layout.heroHeight}px`,
              offsetStart: '0px',
              offsetEnd: '0px',
              height: `${layout.questionHeight}px`,
              paddingAll: '18px',
              backgroundColor: '#FFF8EF',
              contents: [
                {
                  type: 'text',
                  text: model.prompt,
                  wrap: true,
                  weight: 'bold',
                  size: 'md',
                  align: 'center',
                  color: '#2D241B'
                }
              ]
            },
            {
              type: 'box',
              layout: 'vertical',
              position: 'absolute',
              offsetTop: `${layout.heroHeight + layout.questionHeight}px`,
              offsetStart: '0px',
              offsetEnd: '0px',
              height: `${layout.actionsHeight}px`,
              paddingTop: '14px',
              paddingBottom: '14px',
              paddingStart: `${layout.bodyPaddingSide}px`,
              paddingEnd: `${layout.bodyPaddingSide}px`,
              spacing: `${layout.buttonSpacing}px`,
              backgroundColor: '#FFFDF8',
              contents: [
                {
                  type: 'button',
                  style: 'primary',
                  color: '#F3BD63',
                  action: {
                    type: 'message',
                    label: model.optionA.label.slice(0, 20),
                    text: model.optionA.label
                  }
                },
                {
                  type: 'button',
                  style: 'primary',
                  color: '#D8E0EF',
                  action: {
                    type: 'message',
                    label: model.optionB.label.slice(0, 20),
                    text: model.optionB.label
                  }
                }
              ]
            }
          ]
        }
      ]
    }
  };
}

function renderCardModelToFlex(model, globalSettings) {
  if (model.kind === 'dialogue') return renderDialogueBubble(model, globalSettings);
  if (model.kind === 'narration') return renderNarrationBubble(model, globalSettings);
  return renderChoiceBubble(model, globalSettings);
}

function createContinueQuickReply(label = '下一步') {
  return {
    type: 'text',
    text: '看完這一幕後，點下面按鈕繼續。',
    quickReply: {
      items: [
        {
          type: 'action',
          action: {
            type: 'message',
            label: label.slice(0, 20),
            text: label
          }
        }
      ]
    }
  };
}

function buildRenderResult(store, story, nodeId, publicBaseUrl) {
  const globalSettings = getScopedSettings(store, story);
  const node = story.nodes.find((entry) => entry.id === nodeId);
  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }

  const models = buildNodeModels(story, node, globalSettings, publicBaseUrl);
  const storyCards = models.filter((model) => model.kind === 'dialogue' || model.kind === 'narration');
  const lineMessages = [];

  if (storyCards.length === 1) {
    lineMessages.push({
      type: 'flex',
      altText: node.title || storyCards[0].title || '故事卡片',
      contents: renderCardModelToFlex(storyCards[0], globalSettings)
    });
  } else if (storyCards.length > 1) {
    lineMessages.push({
      type: 'flex',
      altText: node.title || '故事多頁訊息',
      contents: {
        type: 'carousel',
        contents: storyCards.map((model) => renderCardModelToFlex(model, globalSettings))
      }
    });
  }

  const choiceModel = models.find((model) => model.kind === 'choice');
  if (choiceModel) {
    lineMessages.push({
      type: 'flex',
      altText: choiceModel.prompt || '故事選項',
      contents: renderCardModelToFlex(choiceModel, globalSettings)
    });
  } else if (node.nextNodeId) {
    lineMessages.push(createContinueQuickReply(node.continueLabel || '下一步'));
  }

  return {
    storyId: story.id,
    nodeId: node.id,
    models,
    payload: { messages: lineMessages.slice(0, 5) },
    node
  };
}

function evaluateStoryIssues(story, store) {
  const issues = [];
  const nodeIds = new Set(story.nodes.map((node) => node.id));
  const globalSettings = getScopedSettings(store, story);

  if (!story.startNodeId) {
    issues.push({ level: 'error', scope: 'story', field: 'startNodeId', message: '缺少開始節點' });
  } else if (!nodeIds.has(story.startNodeId)) {
    issues.push({ level: 'error', scope: 'story', field: 'startNodeId', message: '開始節點不存在' });
  }

  story.nodes.forEach((node) => {
    if (!node.title) issues.push({ level: 'error', scope: 'node', nodeId: node.id, field: 'title', message: '缺少節點標題' });
    if ((node.type === 'dialogue' || node.type === 'narration' || node.type === 'choice') && !node.imagePath) {
      issues.push({ level: 'error', scope: 'node', nodeId: node.id, field: 'imagePath', message: '缺少圖片' });
    }
    if (node.imagePath && !assetExists(node.imagePath)) {
      issues.push({ level: 'error', scope: 'node', nodeId: node.id, field: 'imagePath', message: `圖片不存在：${node.imagePath}` });
    }
    if (node.type === 'dialogue' && !node.speakerCharacterId) {
      issues.push({ level: 'error', scope: 'node', nodeId: node.id, field: 'speakerCharacterId', message: '對話卡缺少主講角色' });
    }
    if ((node.type === 'dialogue' || node.type === 'narration') && !node.text) {
      issues.push({ level: 'error', scope: 'node', nodeId: node.id, field: 'text', message: '缺少文字內容' });
    }
    if (node.type === 'choice') {
      if (!node.prompt) issues.push({ level: 'error', scope: 'node', nodeId: node.id, field: 'prompt', message: '缺少選項提問' });
      if (!node.optionA?.label || !node.optionB?.label) issues.push({ level: 'error', scope: 'node', nodeId: node.id, field: 'options', message: '缺少選項文案' });
      if (!node.optionA?.nextNodeId && !node.optionB?.nextNodeId) {
        issues.push({ level: 'error', scope: 'node', nodeId: node.id, field: 'options', message: '至少一個選項必須連到下一節點' });
      }
    }
    if (node.nextNodeId && !nodeIds.has(node.nextNodeId)) {
      issues.push({ level: 'error', scope: 'node', nodeId: node.id, field: 'nextNodeId', message: '下一節點不存在' });
    }
    if (node.type === 'carousel' || node.type === 'choice') {
      (node.pages || []).forEach((page) => {
        if (!page.imagePath) issues.push({ level: 'error', scope: 'page', nodeId: node.id, field: 'imagePath', message: '多頁訊息缺少圖片' });
        if (page.imagePath && !assetExists(page.imagePath)) {
          issues.push({ level: 'error', scope: 'page', nodeId: node.id, field: 'imagePath', message: `圖片不存在：${page.imagePath}` });
        }
        if (!page.text) issues.push({ level: 'error', scope: 'page', nodeId: node.id, field: 'text', message: '多頁訊息缺少文字' });
        if (page.cardType === 'dialogue' && !page.speakerCharacterId) {
          issues.push({ level: 'error', scope: 'page', nodeId: node.id, field: 'speakerCharacterId', message: '多頁對話缺少角色' });
        }
      });
    }
  });

  store.globalSettings.triggerBindings.forEach((binding) => {
    if (binding.storyId === story.id) {
      if (!binding.keyword) issues.push({ level: 'error', scope: 'trigger', field: 'keyword', message: '開始關鍵字未設定' });
      if (!binding.startNodeId || !nodeIds.has(binding.startNodeId)) {
        issues.push({ level: 'error', scope: 'trigger', field: 'startNodeId', message: '開始節點綁定錯誤' });
      }
    }
  });

  (globalSettings.characters || []).forEach((character) => {
    if (character.avatarPath && !assetExists(character.avatarPath)) {
      issues.push({ level: 'error', scope: 'character', field: 'avatarPath', message: `角色圖片不存在：${character.avatarPath}` });
    }
  });

  return issues;
}

async function validateMessagesWithLine(messages, channelAccessToken, mode = 'reply') {
  const endpoint = `https://api.line.me/v2/bot/message/validate/${mode}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${channelAccessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ messages })
  });
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    body: text
  };
}

async function broadcastMessages(messages, channelAccessToken) {
  const response = await fetch('https://api.line.me/v2/bot/message/broadcast', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${channelAccessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ messages })
  });
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    body: text,
    requestId: response.headers.get('x-line-request-id')
  };
}

function findTriggerBinding(store, keyword) {
  return (store.globalSettings.triggerBindings || []).find((binding) => binding.keyword === keyword) || null;
}

function resolveIncomingNodeAdvance(story, node, text) {
  if (!node) return { action: 'none' };
  if (node.type === 'choice') {
    const optionA = node.optionA?.label === text ? node.optionA : null;
    const optionB = node.optionB?.label === text ? node.optionB : null;
    const chosen = optionA || optionB;
    if (!chosen) return { action: 'none' };
    return {
      action: chosen.nextNodeId ? 'advance' : 'feedback',
      nextNodeId: chosen.nextNodeId || node.id,
      feedback: chosen.feedback || ''
    };
  }
  if (node.nextNodeId && [node.continueLabel, '下一步', '繼續'].filter(Boolean).includes(text)) {
    return {
      action: 'advance',
      nextNodeId: node.nextNodeId
    };
  }
  return { action: 'none' };
}

module.exports = {
  resolveAssetUrl,
  assetExists,
  previewFontCss,
  getNameplatePreset,
  buildNodeModels,
  buildRenderResult,
  evaluateStoryIssues,
  validateMessagesWithLine,
  broadcastMessages,
  findTriggerBinding,
  resolveIncomingNodeAdvance,
  getScopedSettings
};

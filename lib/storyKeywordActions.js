const { buildRenderResult, resolveAssetUrl } = require('./lineatRenderer');

function getBindingActionType(binding = {}) {
  return ['story', 'carousel', 'transition'].includes(binding.actionType) ? binding.actionType : 'story';
}

function getBindingScope(binding = {}) {
  return binding.scope === 'account' ? 'account' : 'story';
}

function getStoryTriggerKeyword(store, story) {
  if (`${story?.triggerKeyword || ''}`.trim()) {
    return `${story.triggerKeyword}`.trim();
  }
  const bindings = (store?.globalSettings?.triggerBindings || [])
    .filter((binding) =>
      getBindingActionType(binding) === 'story'
      && binding.storyId === story.id
      && `${binding.keyword || ''}`.trim()
    );
  return bindings.find((binding) => getBindingScope(binding) === 'story')?.keyword
    || bindings[0]?.keyword
    || '';
}

async function buildStoryCarouselMessages(store, publicBaseUrl, binding = {}) {
  const selectedStoryIds = Array.isArray(binding.storyIds)
    ? binding.storyIds.map((storyId) => `${storyId || ''}`.trim()).filter(Boolean)
    : [];
  const allowedStoryIds = selectedStoryIds.length ? new Set(selectedStoryIds) : null;
  const buttonLabel = `${binding.buttonLabel || ''}`.trim() || '開始閱讀';
  const introText = `${binding.messageText || ''}`.trim();
  const altText = `${binding.label || binding.keyword || ''}`.trim() || '繪本故事選單';
  const storyById = new Map((store.stories || []).map((story) => [story.id, story]));
  const configuredItems = Array.isArray(binding.carouselItems) && binding.carouselItems.length
    ? binding.carouselItems
        .slice()
        .sort((left, right) => (left.sortOrder || 0) - (right.sortOrder || 0))
        .map((item) => {
          const story = storyById.get(item.storyId);
          if (!story) return null;
          return {
            item,
            story,
            triggerKeyword: getStoryTriggerKeyword(store, story)
          };
        })
        .filter((entry) => entry?.story?.startNodeId && entry.triggerKeyword)
    : (store.stories || [])
        .map((story) => ({
          item: null,
          story,
          triggerKeyword: getStoryTriggerKeyword(store, story)
        }))
        .filter((entry) => !allowedStoryIds || allowedStoryIds.has(entry.story.id))
        .filter((entry) => entry.story?.startNodeId && entry.triggerKeyword);

  const stories = configuredItems.slice(0, 10);

  if (!stories.length) {
    return [{
      type: 'text',
      text: '目前還沒有可閱讀的故事。'
    }];
  }

  const bubbles = await Promise.all(stories.map(async ({ story, triggerKeyword, item }) => {
    let imageUrl = '';
    if (`${item?.imagePath || ''}`.trim()) {
      imageUrl = resolveAssetUrl(item.imagePath, publicBaseUrl);
    } else {
      try {
        const render = await buildRenderResult(store, story, story.startNodeId, publicBaseUrl, {
          requirePublishedAssets: true,
          usePublishedAssets: true
        });
        imageUrl = render.images?.[0]?.url || render.image?.url || render.models?.[0]?.renderedImageUrl || '';
      } catch (_error) {
        imageUrl = '';
      }
    }
    const cardTitle = `${item?.title || ''}`.trim() || story.title || '未命名故事';
    const cardSubtitle = `${item?.subtitle || ''}`.trim() || story.description || `開始故事「${story.title || '未命名故事'}」`;
    const cardAuthor = `${item?.author || ''}`.trim();
    const cardButtonLabel = `${item?.buttonLabel || ''}`.trim() || buttonLabel;
    const bodyContents = [
      {
        type: 'text',
        text: cardTitle,
        weight: 'bold',
        size: 'lg',
        wrap: true,
        color: '#2D241B'
      }
    ];
    if (cardAuthor) {
      bodyContents.push({
        type: 'text',
        text: `作者｜${cardAuthor}`,
        size: 'xs',
        wrap: true,
        color: '#9B7C58'
      });
    }
    bodyContents.push({
      type: 'text',
      text: cardSubtitle,
      size: 'sm',
      wrap: true,
      color: '#6D6255'
    });

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
              type: 'postback',
              label: cardButtonLabel.slice(0, 20),
              data: triggerKeyword,
              displayText: triggerKeyword
            }
          }
        ]
      }
    };
  }));

  const messages = [{
    type: 'flex',
    altText,
    contents: {
      type: 'carousel',
      contents: bubbles
    }
  }];
  if (introText) {
    messages.unshift({
      type: 'text',
      text: introText
    });
  }
  return messages;
}

async function resolveKeywordBindingAction(binding, context = {}) {
  const actionType = getBindingActionType(binding);
  if (actionType === 'transition') {
    return {
      mode: 'keyword-transition',
      messages: [{
        type: 'text',
        text: `${binding.messageText || ''}`.trim() || '在這裡輸入過場訊息。'
      }]
    };
  }
  if (actionType === 'carousel') {
    return {
      mode: 'keyword-carousel',
      messages: await buildStoryCarouselMessages(context.store, context.publicBaseUrl, binding)
    };
  }
  return null;
}

module.exports = {
  getBindingActionType,
  getBindingScope,
  getStoryTriggerKeyword,
  buildStoryCarouselMessages,
  resolveKeywordBindingAction
};

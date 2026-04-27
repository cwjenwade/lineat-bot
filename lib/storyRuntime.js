const { recordAction, getHotStoreSnapshot } = require('./storyAuthoringStore');
const { buildRenderResult } = require('./lineatRenderer');
const { parseStoryPostbackData } = require('./lineNodeRenderer');

const storeIndexCache = new WeakMap();
const renderResultCache = new WeakMap();
const ABSOLUTE_STORY_CAROUSEL_KEYWORD = '顯示繪本故事';
const STORY_ENTRY_ALIASES = new Set(['開始', '今日故事', '開始故事']);

function normalizeIncomingKeyword(value = '') {
  return `${value || ''}`.replace(/\s+/g, ' ').trim();
}

function getStoreIndex(store) {
  if (!store) {
    return {
      storyById: new Map(),
      nodeById: new Map(),
      triggerByKeyword: new Map(),
      routeByNodeKeyword: new Map(),
      firstTriggerKeyword: ''
    };
  }
  if (storeIndexCache.has(store)) return storeIndexCache.get(store);
  const storyById = new Map((store.stories || []).map((story) => [story.id, story]));
  const nodeById = new Map();
  const triggerByKeyword = new Map();
  const routeByNodeKeyword = new Map();
  let firstTriggerKeyword = '';
  const routeKey = (nodeId, keyword) => `${nodeId}::${keyword}`;
  const registerNodeRoute = (nodeId, keyword, value) => {
    const normalizedKeyword = normalizeIncomingKeyword(keyword);
    if (!normalizedKeyword) return;
    routeByNodeKeyword.set(routeKey(nodeId, normalizedKeyword), value);
  };
  for (const story of (store.stories || [])) {
    for (const node of (story.nodes || [])) {
      nodeById.set(node.id, node);

      if (node.type === 'choice') {
        [
          ['A', node.optionA],
          ['B', node.optionB]
        ].forEach(([, option]) => {
          const route = {
            storyId: story.id,
            sourceNodeId: node.id,
            nextNodeId: option?.nextNodeId || node.id,
            feedback: option?.feedback || '',
            action: option?.nextNodeId ? 'advance' : 'feedback'
          };
          registerNodeRoute(node.id, option?.label, route);
          registerNodeRoute(node.id, option?.feedback, route);
        });
      } else if (node.nextNodeId) {
        registerNodeRoute(node.id, node.transitionText || node.continueLabel || '下一步', {
          storyId: story.id,
          sourceNodeId: node.id,
          nextNodeId: node.nextNodeId,
          feedback: node.transitionText || '',
          action: 'advance'
        });
      }
    }
  }
  for (const entry of (store.globalSettings?.triggerBindings || [])) {
    const keyword = `${entry.keyword || ''}`.trim();
    if (!keyword) continue;
    if (!firstTriggerKeyword) firstTriggerKeyword = keyword;
    if (!triggerByKeyword.has(keyword)) triggerByKeyword.set(keyword, entry);
  }
  const indexed = { storyById, nodeById, triggerByKeyword, routeByNodeKeyword, firstTriggerKeyword };
  storeIndexCache.set(store, indexed);
  return indexed;
}

function findStoryById(store, storyId) {
  return getStoreIndex(store).storyById.get(storyId) || null;
}

function findNodeById(store, nodeId) {
  return getStoreIndex(store).nodeById.get(nodeId) || null;
}

function findFirstTriggerKeyword(store) {
  return getStoreIndex(store).firstTriggerKeyword || '';
}

function findNodeRoute(store, nodeId, keyword) {
  return getStoreIndex(store).routeByNodeKeyword.get(`${nodeId}::${keyword}`) || null;
}

function getRenderCacheBucket(store) {
  if (!store) return new Map();
  if (renderResultCache.has(store)) return renderResultCache.get(store);
  const bucket = new Map();
  renderResultCache.set(store, bucket);
  return bucket;
}

function getRenderCacheKey(storyId, nodeId, baseUrl, runtimeOptions = {}) {
  return JSON.stringify({
    storyId,
    nodeId,
    baseUrl,
    previewBaseUrl: runtimeOptions.previewBaseUrl || baseUrl,
    requirePublishedAssets: runtimeOptions.requirePublishedAssets,
    usePublishedAssets: runtimeOptions.usePublishedAssets,
    previewNonce: runtimeOptions.previewNonce || ''
  });
}

function buildVirtualTransitionsForNode(node) {
  const previews = [];
  if (node?.introTransitionText) {
    previews.push({
      id: `${node.id}:virtual:intro`,
      type: 'transition',
      virtual: true,
      sourceNodeId: node.id,
      text: node.introTransitionText,
      position: 'before',
      fieldTarget: 'intro'
    });
  }
  if (!node) return [];
  if (node.type === 'choice') {
    return previews.concat([
      ['A', node.optionA],
      ['B', node.optionB]
    ]
      .filter(([, option]) => option?.feedback)
      .map(([branch, option]) => ({
        id: `${node.id}:virtual:${branch}`,
        type: 'transition',
        virtual: true,
        sourceNodeId: node.id,
        branch,
        label: option.label || `選項 ${branch}`,
        text: option.feedback,
        nextNodeId: option.nextNodeId || '',
        position: 'after',
        fieldTarget: `choice-${branch.toLowerCase()}`
      })));
  }
  if (!node.transitionText) return previews;
  previews.push({
    id: `${node.id}:virtual`,
    type: 'transition',
    virtual: true,
    sourceNodeId: node.id,
    text: node.transitionText,
    nextNodeId: node.nextNodeId || '',
    position: 'after',
    fieldTarget: 'node'
  });
  return previews;
}

function buildStoryTraversal(story) {
  const byId = new Map((story?.nodes || []).map((node) => [node.id, node]));
  const entries = [];
  const reachableNodeIds = [];
  const reachableSet = new Set();

  function visit(nodeId) {
    if (!nodeId || reachableSet.has(nodeId)) return;
    const node = byId.get(nodeId);
    if (!node) return;
    reachableSet.add(nodeId);
    reachableNodeIds.push(nodeId);
    entries.push({
      id: node.id,
      nodeId: node.id,
      type: node.type,
      virtual: false,
      nextNodeId: node.nextNodeId || '',
      optionA: node.optionA?.nextNodeId || '',
      optionB: node.optionB?.nextNodeId || ''
    });
    buildVirtualTransitionsForNode(node).forEach((entry) => entries.push(entry));

    if (node.type === 'choice') {
      visit(node.optionA?.nextNodeId || '');
      visit(node.optionB?.nextNodeId || '');
      return;
    }
    visit(node.nextNodeId || '');
  }

  visit(story?.startNodeId || '');

  const unreachableNodeIds = (story?.nodes || [])
    .map((node) => node.id)
    .filter((nodeId) => !reachableSet.has(nodeId));

  const deadEndNodeIds = (story?.nodes || [])
    .filter((node) => {
      if (node.type === 'choice') return !node.optionA?.nextNodeId && !node.optionB?.nextNodeId;
      return !node.nextNodeId;
    })
    .map((node) => node.id);

  return {
    entries,
    reachableNodeIds,
    unreachableNodeIds,
    deadEndNodeIds
  };
}

function fallbackHelpMessage(triggerKeyword = '') {
  return [{
    type: 'text',
    text: triggerKeyword
      ? `輸入「${triggerKeyword}」開始故事，或使用當前卡片下方的按鈕繼續。`
      : '請輸入已設定的 trigger keyword 開始故事，或使用當前卡片下方的按鈕繼續。'
  }];
}

function buildStoryEntryUrl(baseUrl, storyId = '') {
  const cleanBase = `${baseUrl || ''}`.replace(/\/$/, '');
  if (!storyId) return `${cleanBase}/story`;
  return `${cleanBase}/story/${encodeURIComponent(storyId)}`;
}

function resolveDefaultStory(store, preferredStoryId = '') {
  const stories = Array.isArray(store?.stories) ? store.stories.filter((story) => story?.startNodeId) : [];
  if (!stories.length) return null;
  if (preferredStoryId) {
    const matched = stories.find((story) => story.id === preferredStoryId);
    if (matched) return matched;
  }
  const envDefaultStoryId = `${process.env.DEFAULT_STORY_ID || ''}`.trim();
  if (envDefaultStoryId) {
    const matched = stories.find((story) => story.id === envDefaultStoryId);
    if (matched) return matched;
  }
  return stories[0] || null;
}

function resolveStartingNodeId(story) {
  if (!story) return '';
  return `${story.startNodeId || story.nodes?.[0]?.id || ''}`.trim();
}

function isPlaceholderText(value = '') {
  const text = `${value || ''}`.trim();
  return ['在這裡輸入內容。', '在這裡輸入選項提問。', '請先建立內容。', '請先建立至少一個節點。'].includes(text);
}

function resolveNodeImageUrl(node, publicBaseUrl = '') {
  const candidate = `${node?.imageUrl || ''}`.trim() || `${node?.imagePath || ''}`.trim();
  if (!candidate) return '';
  if (/^https?:\/\//i.test(candidate)) return candidate;
  const baseUrl = `${publicBaseUrl || ''}`.replace(/\/$/, '');
  if (!baseUrl) return candidate;
  if (candidate.startsWith('/')) {
    return `${baseUrl}${candidate}`;
  }
  return `${baseUrl}/${candidate.replace(/^\/+/, '')}`;
}

function createPostbackQuickReply(label, payload) {
  return {
    type: 'action',
    action: {
      type: 'postback',
      label,
      displayText: payload.displayText || label,
      data: payload.data
    }
  };
}

function buildQuickReplyMessage(text, items = []) {
  const message = {
    type: 'text',
    text
  };
  if (Array.isArray(items) && items.length) {
    message.quickReply = {
      items: items
    };
  }
  return message;
}

function buildNodeMessages(story, node, runtimeOptions = {}) {
  const resolvedPublicBaseUrl = runtimeOptions.publicBaseUrl || publicBaseUrl;
  const storyId = `${story?.id || ''}`.trim();
  const nodeTitle = `${node?.title || ''}`.trim() || `${story?.title || ''}`.trim() || '繪本故事';
  const bodyText = node?.type === 'choice'
    ? `${node?.prompt || ''}`.trim() || (!isPlaceholderText(node?.text) ? `${node?.text || ''}`.trim() : '')
    : !isPlaceholderText(node?.text)
      ? `${node?.text || ''}`.trim()
      : `${node?.prompt || ''}`.trim();
  const transitionText = !isPlaceholderText(node?.transitionText) ? `${node?.transitionText || ''}`.trim() : '';
  const imageUrl = resolveNodeImageUrl(node, resolvedPublicBaseUrl);
  const messages = [];

  if (imageUrl) {
    messages.push({
      type: 'image',
      originalContentUrl: imageUrl,
      previewImageUrl: imageUrl
    });
  }

  const quickReplyItems = [];
  const textLines = [];
  if (bodyText) textLines.push(bodyText);
  if (transitionText && transitionText !== bodyText) textLines.push(transitionText);

  if (node?.type === 'choice') {
    const optionA = node.optionA || {};
    const optionB = node.optionB || {};
    textLines.unshift('請選擇：');
    textLines.push(`A. ${optionA.label || '選項 A'}`);
    textLines.push(`B. ${optionB.label || '選項 B'}`);

    quickReplyItems.push(
      createPostbackQuickReply('A', {
        displayText: `A. ${optionA.label || '選項 A'}`,
        data: `action=story_choice&storyId=${encodeURIComponent(storyId)}&fromNodeId=${encodeURIComponent(node.id || '')}&choice=A&nextNodeId=${encodeURIComponent(optionA.nextNodeId || node.nextNodeId || '')}`
      }),
      createPostbackQuickReply('B', {
        displayText: `B. ${optionB.label || '選項 B'}`,
        data: `action=story_choice&storyId=${encodeURIComponent(storyId)}&fromNodeId=${encodeURIComponent(node.id || '')}&choice=B&nextNodeId=${encodeURIComponent(optionB.nextNodeId || node.nextNodeId || '')}`
      })
    );
  } else if (node?.nextNodeId) {
    quickReplyItems.push(
      createPostbackQuickReply('繼續', {
        displayText: '繼續',
        data: `action=continue_story&storyId=${encodeURIComponent(storyId)}&fromNodeId=${encodeURIComponent(node.id || '')}&nextNodeId=${encodeURIComponent(node.nextNodeId || '')}`
      })
    );
  }

  quickReplyItems.push(
    createPostbackQuickReply('回選單', {
      displayText: '回選單',
      data: `action=story_menu&storyId=${encodeURIComponent(storyId)}`
    })
  );

  if (textLines.length || quickReplyItems.length) {
    messages.push(buildQuickReplyMessage(textLines.join('\n\n') || nodeTitle, quickReplyItems));
  }

  return messages;
}

function buildEndOfStoryMessages(story) {
  const storyId = `${story?.id || ''}`.trim();
  const storyTitle = `${story?.title || ''}`.trim() || '繪本故事';
  return [buildQuickReplyMessage(`${storyTitle} 先到這裡。`, [
    createPostbackQuickReply('回選單', {
      displayText: '回選單',
      data: `action=story_menu&storyId=${encodeURIComponent(storyId)}`
    })
  ])];
}

function findChoiceOption(node, choice) {
  const normalized = `${choice || ''}`.trim().toUpperCase();
  if (normalized === 'A' || normalized === 'OPTIONA') return node?.optionA || null;
  if (normalized === 'B' || normalized === 'OPTIONB') return node?.optionB || null;
  return null;
}

function buildNodeResponse(story, node, runtimeOptions = {}, publicBaseUrl) {
  return {
    messages: buildNodeMessages(story, node, { publicBaseUrl }),
    story,
    node,
    render: null,
    virtualTransitions: buildVirtualTransitionsForNode(node)
  };
}

function buildEndOfStoryResponse(story) {
  return {
    messages: buildEndOfStoryMessages(story),
    story,
    node: null,
    render: null,
    virtualTransitions: []
  };
}

function createStoryRuntime(options = {}) {
  const {
    getStore = () => getHotStoreSnapshot(),
    sessionStore = new Map(),
    publicBaseUrl = process.env.PUBLIC_BASE_URL || 'https://debbylinehose.vercel.app',
    onRecord = recordAction,
    resolveKeywordBindingAction = null,
    requirePublishedAssets = false,
    usePublishedAssets = false
  } = options;
  const sessionRenderCache = new Map();

  function getCachedNodeRender(sessionKey, story, nodeId, runtimeOptions = {}, renderFn) {
    if (runtimeOptions.disableSessionCache) {
      return Promise.resolve().then(renderFn);
    }
    const baseUrl = runtimeOptions.publicBaseUrl || publicBaseUrl;
    const cacheKey = JSON.stringify({
      sessionKey,
      storyId: story?.id || '',
      nodeId,
      baseUrl,
      previewBaseUrl: runtimeOptions.previewBaseUrl || '',
      requirePublishedAssets: runtimeOptions.requirePublishedAssets ?? requirePublishedAssets,
      usePublishedAssets: runtimeOptions.usePublishedAssets ?? usePublishedAssets
    });
    const cached = sessionRenderCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }
    const result = Promise.resolve().then(renderFn);
    sessionRenderCache.set(cacheKey, {
      result,
      expiresAt: Date.now() + 5000
    });
    setTimeout(() => {
      const current = sessionRenderCache.get(cacheKey);
      if (current?.result === result) {
        sessionRenderCache.delete(cacheKey);
      }
    }, 5000);
    return result;
  }

  function buildRenderOptions(runtimeOptions = {}, baseUrl) {
    return {
      requirePublishedAssets,
      usePublishedAssets,
      previewBaseUrl: runtimeOptions.previewBaseUrl || baseUrl
    };
  }

  async function getRenderResult(store, story, nodeId, runtimeOptions = {}) {
    const baseUrl = runtimeOptions.publicBaseUrl || publicBaseUrl;
    const renderOptions = buildRenderOptions(runtimeOptions, baseUrl);
    if (runtimeOptions.disableRenderCache) {
      return buildRenderResult(store, story, nodeId, baseUrl, renderOptions);
    }
    const cacheKey = getRenderCacheKey(story.id, nodeId, baseUrl, renderOptions);
    const bucket = getRenderCacheBucket(store);
    if (bucket.has(cacheKey)) return bucket.get(cacheKey);
    const render = await buildRenderResult(store, story, nodeId, baseUrl, renderOptions);
    bucket.set(cacheKey, render);
    return render;
  }

  async function buildReplyForTrigger(store, binding, sessionKey, runtimeOptions = {}) {
    const story = findStoryById(store, binding.storyId);
    if (!story) return {
      messages: fallbackHelpMessage(findFirstTriggerKeyword(store)),
      story: null,
      node: null,
      render: null
    };

    const nodeId = resolveStartingNodeId(story) || binding.startNodeId || story.startNodeId;
    const node = findNodeById(store, nodeId);
    if (!node) {
      return buildEndOfStoryResponse(story);
    }
    sessionStore.set(sessionKey, { storyId: story.id, currentNodeId: nodeId });
    const resolvedPublicBaseUrl = runtimeOptions.publicBaseUrl || publicBaseUrl;
    return buildNodeResponse(story, node, runtimeOptions, resolvedPublicBaseUrl);
  }

  async function buildReplyForSession(store, session, sessionKey, text, runtimeOptions = {}) {
    const story = findStoryById(store, session.storyId);
    if (!story) {
      sessionStore.delete(sessionKey);
      return {
        messages: fallbackHelpMessage(findFirstTriggerKeyword(store)),
        story: null,
        node: null,
        render: null
      };
    }

    const node = findNodeById(store, session.currentNodeId);
    if (!node) {
      sessionStore.delete(sessionKey);
      return {
        messages: fallbackHelpMessage(findFirstTriggerKeyword(store)),
        story: null,
        node: null,
        render: null
      };
    }

    const resolution = findNodeRoute(store, node.id, text.trim());
    if (resolution?.action === 'feedback') {
      const resolvedPublicBaseUrl = runtimeOptions.publicBaseUrl || publicBaseUrl;
      const current = buildNodeResponse(story, node, runtimeOptions, resolvedPublicBaseUrl);
      const virtualTransition = resolution?.feedback
        ? [{
            id: `${node.id}:runtime-feedback`,
            type: 'transition',
            virtual: true,
            sourceNodeId: node.id,
            text: resolution.feedback,
            nextNodeId: resolution.nextNodeId || node.id
          }]
        : [];
      return {
        messages: [
          ...(resolution.feedback ? [{ type: 'text', text: resolution.feedback }] : []),
          ...current.messages
        ].slice(0, 5),
        story,
        node,
        render: null,
        virtualTransitions: virtualTransition
      };
    }

    if (resolution?.action === 'advance') {
      sessionStore.set(sessionKey, { storyId: story.id, currentNodeId: resolution.nextNodeId });
      const nextNode = findNodeById(store, resolution.nextNodeId);
      if (!nextNode) {
        sessionStore.delete(sessionKey);
        return buildEndOfStoryResponse(story);
      }
      const resolvedPublicBaseUrl = runtimeOptions.publicBaseUrl || publicBaseUrl;
      const next = buildNodeResponse(story, nextNode, runtimeOptions, resolvedPublicBaseUrl);
      const virtualTransition = resolution.feedback
        ? [{
            id: `${node.id}:runtime-transition`,
            type: 'transition',
            virtual: true,
            sourceNodeId: node.id,
            text: resolution.feedback,
            nextNodeId: resolution.nextNodeId
          }]
        : [];
      return {
        messages: [
          ...(resolution.feedback ? [{ type: 'text', text: resolution.feedback }] : []),
          ...next.messages
        ].slice(0, 5),
        story,
        node: nextNode,
        render: null,
        virtualTransitions: virtualTransition
      };
    }

    return {
      messages: [{
        type: 'text',
        text: '請輸入有效選項'
      }],
      story,
      node,
      render: null,
      virtualTransitions: []
    };
  }

  async function processTextInput(textOrInput, sessionKey = 'local-user', runtimeOptions = {}) {
    const isObjectInput = textOrInput && typeof textOrInput === 'object' && !Array.isArray(textOrInput);
    const inputText = isObjectInput ? `${textOrInput.text || ''}` : `${textOrInput || ''}`;
    const actualSessionKey = isObjectInput
      ? (textOrInput.sessionKey || textOrInput.userId || sessionKey || 'local-user')
      : (sessionKey || 'local-user');
    const derivedRuntimeOptions = isObjectInput
      ? {
          ...runtimeOptions,
          ...textOrInput,
          text: undefined,
          userId: undefined,
          sessionKey: undefined
        }
      : runtimeOptions;
    const store = derivedRuntimeOptions.storeOverride || getStore();
    const trimmed = normalizeIncomingKeyword(inputText);
    const postbackPayload = isObjectInput ? parseStoryPostbackData(textOrInput.postbackData || textOrInput.data || inputText) : parseStoryPostbackData(inputText);
    const action = `${derivedRuntimeOptions.action || textOrInput?.action || postbackPayload.action || ''}`.trim();
    const source = derivedRuntimeOptions.source || 'webhook';

    if (source === 'preview') {
      const story = findStoryById(store, derivedRuntimeOptions.storyId) || store.stories[0] || null;
      if (!story) {
        return {
          source,
          mode: 'preview',
          messages: fallbackHelpMessage(findFirstTriggerKeyword(store)),
          session: null,
          render: null,
          traversal: null,
          virtualTransitions: []
        };
      }
      const nodeId = derivedRuntimeOptions.nodeId || story.startNodeId;
      const node = findNodeById(store, nodeId);
      if (!node) {
        throw new Error(`Node not found: ${nodeId}`);
      }
      const render = await getCachedNodeRender(actualSessionKey, story, node.id, derivedRuntimeOptions, () => (
        getRenderResult(store, story, node.id, derivedRuntimeOptions)
      ));
      return {
        source,
        mode: 'preview',
        messages: render.payload.messages,
        session: null,
        render,
        traversal: buildStoryTraversal(story),
        virtualTransitions: buildVirtualTransitionsForNode(node)
      };
    }

    if (action) {
      const actionResult = await handlePostbackAction(store, actualSessionKey, {
        ...postbackPayload,
        ...derivedRuntimeOptions,
        action,
        storyId: derivedRuntimeOptions.storyId || textOrInput?.storyId || postbackPayload.storyId || '',
        fromNodeId: derivedRuntimeOptions.fromNodeId || textOrInput?.fromNodeId || postbackPayload.fromNodeId || '',
        nodeId: derivedRuntimeOptions.nodeId || textOrInput?.nodeId || postbackPayload.nodeId || '',
        choice: derivedRuntimeOptions.choice || textOrInput?.choice || postbackPayload.choice || '',
        nextNodeId: derivedRuntimeOptions.nextNodeId || textOrInput?.nextNodeId || postbackPayload.nextNodeId || ''
      }, derivedRuntimeOptions);
      if (actionResult) {
        return actionResult;
      }
    }

    if (STORY_ENTRY_ALIASES.has(trimmed)) {
      const menuBinding = (store.globalSettings?.triggerBindings || []).find((binding) => `${binding.keyword || ''}`.trim() === ABSOLUTE_STORY_CAROUSEL_KEYWORD)
        || (store.globalSettings?.triggerBindings || []).find((binding) => `${binding.actionType || ''}`.trim() === 'carousel')
        || null;

      if (menuBinding && typeof resolveKeywordBindingAction === 'function') {
        clearSession(actualSessionKey);
        const resolved = await resolveKeywordBindingAction(menuBinding, {
          store,
          sessionKey: actualSessionKey,
          publicBaseUrl: derivedRuntimeOptions.publicBaseUrl || publicBaseUrl,
          previewBaseUrl: derivedRuntimeOptions.previewBaseUrl || derivedRuntimeOptions.publicBaseUrl || publicBaseUrl
        });
        if (resolved?.messages?.length) {
          return {
            source,
            mode: resolved.mode || 'story-menu',
            messages: resolved.messages,
            session: null,
            render: null,
            traversal: null,
            virtualTransitions: []
          };
        }
      }

      const defaultStory = resolveDefaultStory(store, derivedRuntimeOptions.defaultStoryId || process.env.DEFAULT_STORY_ID || '');
      if (defaultStory && resolveStartingNodeId(defaultStory)) {
        clearSession(actualSessionKey);
        const node = findNodeById(store, resolveStartingNodeId(defaultStory));
        if (node) {
          sessionStore.set(actualSessionKey, { storyId: defaultStory.id, currentNodeId: node.id });
          const resolvedPublicBaseUrl = derivedRuntimeOptions.publicBaseUrl || publicBaseUrl;
          return {
            source,
            mode: 'entry-start',
            messages: buildNodeResponse(defaultStory, node, derivedRuntimeOptions, resolvedPublicBaseUrl).messages,
            session: sessionStore.get(actualSessionKey) || null,
            render: null,
            traversal: buildStoryTraversal(defaultStory),
            virtualTransitions: buildVirtualTransitionsForNode(node)
          };
        }
      }

      return {
        source,
        mode: 'story-menu',
        messages: [{ type: 'text', text: '目前還沒有可閱讀的故事。' }],
        session: null,
        render: null,
        traversal: null,
        virtualTransitions: []
      };
    }

    const absoluteCarouselBinding = trimmed.includes(ABSOLUTE_STORY_CAROUSEL_KEYWORD)
      ? (getStoreIndex(store).triggerByKeyword.get(ABSOLUTE_STORY_CAROUSEL_KEYWORD) || null)
      : null;
    const binding = absoluteCarouselBinding || getStoreIndex(store).triggerByKeyword.get(trimmed) || null;
    if (binding) {
      if (binding.actionType && binding.actionType !== 'story' && typeof resolveKeywordBindingAction === 'function') {
        clearSession(actualSessionKey);
        const resolved = await resolveKeywordBindingAction(binding, {
          store,
          sessionKey: actualSessionKey,
          publicBaseUrl: derivedRuntimeOptions.publicBaseUrl || publicBaseUrl,
          previewBaseUrl: derivedRuntimeOptions.previewBaseUrl || derivedRuntimeOptions.publicBaseUrl || publicBaseUrl
        });
        if (resolved?.messages?.length) {
          return {
            source,
            mode: resolved.mode || 'keyword-action',
            messages: resolved.messages,
            session: null,
            render: null,
            traversal: null,
            virtualTransitions: []
          };
        }
      }
      clearSession(actualSessionKey);
      const reply = await buildReplyForTrigger(store, binding, actualSessionKey, derivedRuntimeOptions);
      onRecord('story.trigger', {
        actor: actualSessionKey,
        role: 'user',
        targetId: `${binding.storyId}:${binding.startNodeId}`,
        result: 'success',
        detail: trimmed
      });
      return {
        source,
        mode: 'trigger',
        messages: reply.messages,
        binding,
        session: sessionStore.get(actualSessionKey) || null,
        render: reply.render,
        traversal: reply.story ? buildStoryTraversal(reply.story) : null,
        virtualTransitions: buildVirtualTransitionsForNode(reply.node)
      };
    }

    const session = sessionStore.get(actualSessionKey);
    if (session) {
      const reply = await buildReplyForSession(store, session, actualSessionKey, trimmed, derivedRuntimeOptions);
      return {
        source,
        mode: 'session',
        messages: reply.messages,
        session: sessionStore.get(actualSessionKey) || null,
        render: reply.render,
        traversal: reply.story ? buildStoryTraversal(reply.story) : null,
        virtualTransitions: reply.virtualTransitions?.length
          ? reply.virtualTransitions
          : buildVirtualTransitionsForNode(reply.node)
      };
    }

    const suggestedTrigger = findFirstTriggerKeyword(store);
    return {
      source,
      mode: 'fallback',
      messages: suggestedTrigger
        ? [{ type: 'text', text: `請輸入「${suggestedTrigger}」開始故事` }]
        : [{ type: 'text', text: '請輸入有效選項' }],
      session: null,
      render: null,
      traversal: null,
      virtualTransitions: []
    };
  }

  function clearSession(sessionKey = 'local-user') {
    sessionStore.delete(sessionKey);
    return { sessionKey, cleared: true };
  }

  async function handlePostbackAction(store, sessionKey, payload = {}, runtimeOptions = {}) {
    const action = `${payload.action || ''}`.trim();
    const resolvedPublicBaseUrl = runtimeOptions.publicBaseUrl || publicBaseUrl;

    if (action === 'story_menu') {
      clearSession(sessionKey);
      const menuBinding = (store.globalSettings?.triggerBindings || []).find((binding) => `${binding.keyword || ''}`.trim() === ABSOLUTE_STORY_CAROUSEL_KEYWORD)
        || (store.globalSettings?.triggerBindings || []).find((binding) => `${binding.actionType || ''}`.trim() === 'carousel')
        || null;

      if (menuBinding && typeof resolveKeywordBindingAction === 'function') {
        const resolved = await resolveKeywordBindingAction(menuBinding, {
          store,
          sessionKey,
          publicBaseUrl: resolvedPublicBaseUrl,
          previewBaseUrl: runtimeOptions.previewBaseUrl || resolvedPublicBaseUrl
        });
        if (resolved?.messages?.length) {
          return {
            source: runtimeOptions.source || 'webhook',
            mode: resolved.mode || 'story-menu',
            messages: resolved.messages,
            session: null,
            render: null,
            traversal: null,
            virtualTransitions: []
          };
        }
      }

      return {
        source: runtimeOptions.source || 'webhook',
        mode: 'story-menu',
        messages: [{ type: 'text', text: '目前還沒有可閱讀的故事。' }],
        session: null,
        render: null,
        traversal: null,
        virtualTransitions: []
      };
    }

    const story = resolveDefaultStory(store, payload.storyId);
    if (!story) {
      return {
        source: runtimeOptions.source || 'webhook',
        mode: 'fallback',
        messages: fallbackHelpMessage(findFirstTriggerKeyword(store)),
        session: null,
        render: null,
        traversal: null,
        virtualTransitions: []
      };
    }

    if (action === 'start_story') {
      const nodeId = resolveStartingNodeId(story);
      const node = findNodeById(store, nodeId);
      if (!node) {
        return buildEndOfStoryResponse(story);
      }
      sessionStore.set(sessionKey, { storyId: story.id, currentNodeId: node.id });
      return {
        source: runtimeOptions.source || 'webhook',
        mode: 'start_story',
        messages: buildNodeResponse(story, node, runtimeOptions, resolvedPublicBaseUrl).messages,
        session: sessionStore.get(sessionKey) || null,
        render: null,
        traversal: buildStoryTraversal(story),
        virtualTransitions: buildVirtualTransitionsForNode(node)
      };
    }

    if (action === 'story_choice') {
      const currentNodeId = `${payload.fromNodeId || payload.nodeId || sessionStore.get(sessionKey)?.currentNodeId || ''}`.trim();
      const node = findNodeById(store, currentNodeId);
      if (!node) {
        return buildEndOfStoryResponse(story);
      }
      const option = findChoiceOption(node, payload.choice);
      const nextNodeId = `${payload.nextNodeId || option?.nextNodeId || node.nextNodeId || ''}`.trim();
      if (!nextNodeId) {
        return buildEndOfStoryResponse(story);
      }
      const nextNode = findNodeById(store, nextNodeId);
      if (!nextNode) {
        return buildEndOfStoryResponse(story);
      }
      sessionStore.set(sessionKey, { storyId: story.id, currentNodeId: nextNode.id });
      const messages = [];
      if (option?.feedback) {
        messages.push({ type: 'text', text: option.feedback });
      }
      messages.push(...buildNodeResponse(story, nextNode, runtimeOptions, resolvedPublicBaseUrl).messages);
      return {
        source: runtimeOptions.source || 'webhook',
        mode: 'story_choice',
        messages: messages.slice(0, 5),
        session: sessionStore.get(sessionKey) || null,
        render: null,
        traversal: buildStoryTraversal(story),
        virtualTransitions: buildVirtualTransitionsForNode(node)
      };
    }

    if (action === 'continue_story') {
      const currentNodeId = `${payload.fromNodeId || payload.nodeId || sessionStore.get(sessionKey)?.currentNodeId || ''}`.trim();
      const node = findNodeById(store, currentNodeId);
      if (!node) {
        return buildEndOfStoryResponse(story);
      }
      const nextNodeId = `${payload.nextNodeId || node.nextNodeId || ''}`.trim();
      if (!nextNodeId) {
        return buildEndOfStoryResponse(story);
      }
      const nextNode = findNodeById(store, nextNodeId);
      if (!nextNode) {
        return buildEndOfStoryResponse(story);
      }
      sessionStore.set(sessionKey, { storyId: story.id, currentNodeId: nextNode.id });
      const messages = [];
      if (node.transitionText) {
        messages.push({ type: 'text', text: node.transitionText });
      }
      messages.push(...buildNodeResponse(story, nextNode, runtimeOptions, resolvedPublicBaseUrl).messages);
      return {
        source: runtimeOptions.source || 'webhook',
        mode: 'continue_story',
        messages: messages.slice(0, 5),
        session: sessionStore.get(sessionKey) || null,
        render: null,
        traversal: buildStoryTraversal(story),
        virtualTransitions: buildVirtualTransitionsForNode(node)
      };
    }

    return null;
  }

  return {
    sessionStore,
    processTextInput,
    clearSession,
    fallbackHelpMessage
  };
}

module.exports = {
  createStoryRuntime,
  fallbackHelpMessage,
  buildVirtualTransitionsForNode,
  buildStoryTraversal
};

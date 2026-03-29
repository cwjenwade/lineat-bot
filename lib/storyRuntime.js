const { recordAction, getHotStoreSnapshot } = require('./storyAuthoringStore');
const {
  buildRenderResult,
  resolveIncomingNodeAdvance
} = require('./lineatRenderer');

const storeIndexCache = new WeakMap();
const renderResultCache = new WeakMap();

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
  for (const story of (store.stories || [])) {
    for (const node of (story.nodes || [])) {
      nodeById.set(node.id, node);

      if (node.type === 'choice') {
        [
          ['A', node.optionA],
          ['B', node.optionB]
        ].forEach(([, option]) => {
          const keyword = `${option?.feedback || option?.label || ''}`.trim();
          if (!keyword) return;
          routeByNodeKeyword.set(routeKey(node.id, keyword), {
            storyId: story.id,
            sourceNodeId: node.id,
            nextNodeId: option?.nextNodeId || node.id,
            feedback: option?.feedback || '',
            action: option?.nextNodeId ? 'advance' : 'feedback'
          });
        });
      } else if (node.nextNodeId) {
        const keyword = `${node.transitionText || node.continueLabel || '下一步'}`.trim();
        if (keyword) {
          routeByNodeKeyword.set(routeKey(node.id, keyword), {
            storyId: story.id,
            sourceNodeId: node.id,
            nextNodeId: node.nextNodeId,
            feedback: node.transitionText || '',
            action: 'advance'
          });
        }
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
    usePublishedAssets: runtimeOptions.usePublishedAssets
  });
}

function buildVirtualTransitionsForNode(node) {
  if (!node) return [];
  if (node.type === 'choice') {
    return [
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
        nextNodeId: option.nextNodeId || ''
      }));
  }
  if (!node.transitionText) return [];
  return [{
    id: `${node.id}:virtual`,
    type: 'transition',
    virtual: true,
    sourceNodeId: node.id,
    text: node.transitionText,
    nextNodeId: node.nextNodeId || ''
  }];
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

function createStoryRuntime(options = {}) {
  const {
    getStore = () => getHotStoreSnapshot(),
    sessionStore = new Map(),
    publicBaseUrl = process.env.PUBLIC_BASE_URL || 'https://lineat-bot.onrender.com',
    onRecord = recordAction,
    resolveKeywordBindingAction = null,
    requirePublishedAssets = false,
    usePublishedAssets = false
  } = options;
  const sessionRenderCache = new Map();

  function getCachedNodeRender(sessionKey, story, nodeId, runtimeOptions = {}, renderFn) {
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

    const nodeId = binding.startNodeId || story.startNodeId;
    sessionStore.set(sessionKey, { storyId: story.id, currentNodeId: nodeId });
    const render = await getCachedNodeRender(sessionKey, story, nodeId, runtimeOptions, () => (
      getRenderResult(store, story, nodeId, runtimeOptions)
    ));
    return {
      messages: render.payload.messages,
      story,
      node: findNodeById(store, nodeId),
      render
    };
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
      const current = await getCachedNodeRender(sessionKey, story, node.id, runtimeOptions, () => (
        getRenderResult(store, story, node.id, runtimeOptions)
      ));
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
          ...current.payload.messages
        ].slice(0, 5),
        story,
        node,
        render: current,
        virtualTransitions: virtualTransition
      };
    }

    if (resolution?.action === 'advance') {
      sessionStore.set(sessionKey, { storyId: story.id, currentNodeId: resolution.nextNodeId });
      const next = await getCachedNodeRender(sessionKey, story, resolution.nextNodeId, runtimeOptions, () => (
        getRenderResult(store, story, resolution.nextNodeId, runtimeOptions)
      ));
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
          ...next.payload.messages
        ].slice(0, 5),
        story,
        node: findNodeById(store, resolution.nextNodeId),
        render: next,
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
    const trimmed = inputText.trim();
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

    const binding = getStoreIndex(store).triggerByKeyword.get(trimmed) || null;
    if (binding) {
      if (binding.actionType && binding.actionType !== 'story' && typeof resolveKeywordBindingAction === 'function') {
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
            session: sessionStore.get(actualSessionKey) || null,
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

const { readStore, recordAction, getStoreSnapshot } = require('./storyAuthoringStore');
const {
  buildRenderResult,
  resolveIncomingNodeAdvance
} = require('./lineatRenderer');

const storeIndexCache = new WeakMap();
const renderResultCache = new WeakMap();
const verboseRuntimeLog = process.env.LINEAT_DEBUG_RUNTIME === '1';

function getStoreIndex(store) {
  if (!store) {
    return {
      storyById: new Map(),
      triggerByKeyword: new Map(),
      firstTriggerKeyword: ''
    };
  }
  if (storeIndexCache.has(store)) return storeIndexCache.get(store);
  const storyById = new Map((store.stories || []).map((story) => [story.id, story]));
  const triggerByKeyword = new Map();
  let firstTriggerKeyword = '';
  for (const entry of (store.globalSettings?.triggerBindings || [])) {
    const keyword = `${entry.keyword || ''}`.trim();
    if (!keyword) continue;
    if (!firstTriggerKeyword) firstTriggerKeyword = keyword;
    if (!triggerByKeyword.has(keyword)) triggerByKeyword.set(keyword, entry);
  }
  const indexed = { storyById, triggerByKeyword, firstTriggerKeyword };
  storeIndexCache.set(store, indexed);
  return indexed;
}

function findStoryById(store, storyId) {
  return getStoreIndex(store).storyById.get(storyId) || null;
}

function findFirstTriggerKeyword(store) {
  return getStoreIndex(store).firstTriggerKeyword || '';
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
    getStore = () => getStoreSnapshot(),
    sessionStore = new Map(),
    publicBaseUrl = process.env.PUBLIC_BASE_URL || 'https://lineat-bot.onrender.com',
    onRecord = recordAction,
    requirePublishedAssets = false,
    usePublishedAssets = false
  } = options;

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
    if (verboseRuntimeLog) {
      console.log('SESSION:', sessionStore.get(sessionKey) || null);
    }

    const render = await getRenderResult(store, story, nodeId, runtimeOptions);
    if (verboseRuntimeLog) {
      console.log('PAYLOAD:', JSON.stringify(render.payload.messages));
    }
    return {
      messages: render.payload.messages,
      story,
      node: story.nodes.find((entry) => entry.id === nodeId) || null,
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

    const node = story.nodes.find((entry) => entry.id === session.currentNodeId);
    if (!node) {
      sessionStore.delete(sessionKey);
      return {
        messages: fallbackHelpMessage(findFirstTriggerKeyword(store)),
        story: null,
        node: null,
        render: null
      };
    }

    const resolution = resolveIncomingNodeAdvance(story, node, text.trim());
    if (resolution.action === 'feedback') {
      const current = await getRenderResult(store, story, node.id, runtimeOptions);
      const virtualTransition = resolution.feedback
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

    if (resolution.action === 'advance') {
      sessionStore.set(sessionKey, { storyId: story.id, currentNodeId: resolution.nextNodeId });
      const next = await getRenderResult(store, story, resolution.nextNodeId, runtimeOptions);
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
        node: story.nodes.find((entry) => entry.id === resolution.nextNodeId) || null,
        render: next,
        virtualTransitions: virtualTransition
      };
    }

    return {
      messages: fallbackHelpMessage(findFirstTriggerKeyword(store)),
      story,
      node,
      render: null,
      virtualTransitions: []
    };
  }

  async function processTextInput(text, sessionKey = 'local-user', runtimeOptions = {}) {
    const store = runtimeOptions.storeOverride || getStore();
    const trimmed = `${text || ''}`.trim();
    const source = runtimeOptions.source || 'webhook';
    if (verboseRuntimeLog) {
      console.log('RUNTIME INPUT:', trimmed);
    }

    if (source === 'preview') {
      const story = findStoryById(store, runtimeOptions.storyId) || store.stories[0] || null;
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
      const nodeId = runtimeOptions.nodeId || story.startNodeId;
      const node = story.nodes.find((entry) => entry.id === nodeId);
      if (!node) {
        throw new Error(`Node not found: ${nodeId}`);
      }
      const render = await getRenderResult(store, story, node.id, runtimeOptions);
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
    if (verboseRuntimeLog) {
      console.log('TRIGGER CHECK:', trimmed, '→', binding?.storyId);
    }
    if (binding) {
      clearSession(sessionKey);
      const reply = await buildReplyForTrigger(store, binding, sessionKey, runtimeOptions);
      onRecord('story.trigger', {
        actor: sessionKey,
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
        session: sessionStore.get(sessionKey) || null,
        render: reply.render,
        traversal: reply.story ? buildStoryTraversal(reply.story) : null,
        virtualTransitions: buildVirtualTransitionsForNode(reply.node)
      };
    }

    const session = sessionStore.get(sessionKey);
    if (session) {
      const reply = await buildReplyForSession(store, session, sessionKey, trimmed, runtimeOptions);
      return {
        source,
        mode: 'session',
        messages: reply.messages,
        session: sessionStore.get(sessionKey) || null,
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
      messages: fallbackHelpMessage(suggestedTrigger),
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

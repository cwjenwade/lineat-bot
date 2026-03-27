const { readStore, recordAction } = require('./storyAuthoringStore');
const {
  buildRenderResult,
  findTriggerBinding,
  resolveIncomingNodeAdvance
} = require('./lineatRenderer');

function findStoryById(store, storyId) {
  return store.stories.find((story) => story.id === storyId) || null;
}

function fallbackHelpMessage() {
  return [{
    type: 'text',
    text: '輸入「開始故事」開始閱讀，或使用當前卡片下方的按鈕繼續。'
  }];
}

function createStoryRuntime(options = {}) {
  const {
    getStore = () => readStore(),
    sessionStore = new Map(),
    publicBaseUrl = process.env.PUBLIC_BASE_URL || 'https://lineat-bot.onrender.com',
    onRecord = recordAction
  } = options;

  function buildReplyForTrigger(store, binding, sessionKey) {
    const story = findStoryById(store, binding.storyId);
    if (!story) return fallbackHelpMessage();

    const nodeId = binding.startNodeId || story.startNodeId;
    sessionStore.set(sessionKey, { storyId: story.id, currentNodeId: nodeId });

    const render = buildRenderResult(store, story, nodeId, publicBaseUrl);
    return render.payload.messages;
  }

  function buildReplyForSession(store, session, sessionKey, text) {
    const story = findStoryById(store, session.storyId);
    if (!story) {
      sessionStore.delete(sessionKey);
      return fallbackHelpMessage();
    }

    const node = story.nodes.find((entry) => entry.id === session.currentNodeId);
    if (!node) {
      sessionStore.delete(sessionKey);
      return fallbackHelpMessage();
    }

    const resolution = resolveIncomingNodeAdvance(story, node, text.trim());

    if (resolution.action === 'feedback') {
      const current = buildRenderResult(store, story, node.id, publicBaseUrl);
      return [
        ...(resolution.feedback ? [{ type: 'text', text: resolution.feedback }] : []),
        ...current.payload.messages
      ].slice(0, 5);
    }

    if (resolution.action === 'advance') {
      sessionStore.set(sessionKey, { storyId: story.id, currentNodeId: resolution.nextNodeId });
      const next = buildRenderResult(store, story, resolution.nextNodeId, publicBaseUrl);
      return [
        ...(resolution.feedback ? [{ type: 'text', text: resolution.feedback }] : []),
        ...next.payload.messages
      ].slice(0, 5);
    }

    return fallbackHelpMessage();
  }

  function processTextInput(text, sessionKey = 'local-user') {
    const store = getStore();
    const trimmed = `${text || ''}`.trim();

    const binding = findTriggerBinding(store, trimmed);
    if (binding) {
      const messages = buildReplyForTrigger(store, binding, sessionKey);
      onRecord('story.trigger', {
        actor: sessionKey,
        role: 'user',
        targetId: `${binding.storyId}:${binding.startNodeId}`,
        result: 'success',
        detail: trimmed
      });
      return {
        mode: 'trigger',
        messages,
        binding,
        session: sessionStore.get(sessionKey) || null
      };
    }

    const session = sessionStore.get(sessionKey);
    if (session) {
      const messages = buildReplyForSession(store, session, sessionKey, trimmed);
      return {
        mode: 'session',
        messages,
        session: sessionStore.get(sessionKey) || null
      };
    }

    return {
      mode: 'fallback',
      messages: fallbackHelpMessage(),
      session: null
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
  fallbackHelpMessage
};

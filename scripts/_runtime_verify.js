const fs = require('fs');
const path = require('path');

const { createStoryRuntime } = require('../lib/storyRuntime');
const { getHotStoreSnapshot } = require('../lib/storyAuthoringStore');
const { resolveKeywordBindingAction } = require('../lib/storyKeywordActions');

function flattenActions(value, out = []) {
  if (Array.isArray(value)) {
    value.forEach((item) => flattenActions(item, out));
    return out;
  }
  if (!value || typeof value !== 'object') {
    return out;
  }
  if (value.action && typeof value.action === 'object') {
    const actionType = value.action.type || null;
    out.push(actionType);
  }
  for (const v of Object.values(value)) {
    flattenActions(v, out);
  }
  return out;
}

function hasExternalStoryLink(messages) {
  const text = JSON.stringify(messages || []);
  return /(^|[^A-Za-z0-9_])\/story(\/|\?|"|$)/.test(text);
}

function summarizeResult(name, result) {
  const messages = Array.isArray(result?.messages) ? result.messages : [];
  const actionTypes = flattenActions(messages, []);
  return {
    test: name,
    mode: result?.mode || null,
    messagesCount: messages.length,
    firstMessageType: messages[0]?.type || null,
    hasPostbackActionButton: actionTypes.includes('postback'),
    hasUriActionButton: actionTypes.includes('uri'),
    hasExternalStoryLink: hasExternalStoryLink(messages)
  };
}

function loadStoryMeta() {
  const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data/story-authoring.json'), 'utf8'));
  const stories = Array.isArray(data.stories) ? data.stories : [];
  const story = stories.find((s) => s.id === 'example') || stories[0] || null;
  if (!story) return { storyId: '', firstNodeId: '', firstNodeNextId: '' };
  const firstNodeId = story.startNodeId || story.nodes?.[0]?.id || '';
  const firstNode = (story.nodes || []).find((n) => n.id === firstNodeId) || {};
  return {
    storyId: story.id,
    firstNodeId,
    firstNodeNextId: firstNode.nextNodeId || ''
  };
}

async function main() {
  const runtime = createStoryRuntime({
    sessionStore: new Map(),
    publicBaseUrl: process.env.PUBLIC_BASE_URL || 'https://debbylinehose-brown.vercel.app',
    requirePublishedAssets: false,
    usePublishedAssets: false,
    getStore: () => getHotStoreSnapshot(),
    resolveKeywordBindingAction
  });

  const meta = loadStoryMeta();

  const textCases = [
    '顯示繪本故事',
    '開始',
    '今日故事',
    '開始故事',
    '未知文字'
  ];

  const textResults = [];
  for (const text of textCases) {
    const result = await runtime.processTextInput({
      userId: 'local-test-user',
      sessionKey: 'local-test-session',
      text,
      source: 'webhook'
    });
    textResults.push(summarizeResult(`text:${text}`, result));
  }

  const postbackCases = [
    {
      name: 'start_story',
      input: {
        action: 'start_story',
        storyId: meta.storyId,
        postbackData: `action=start_story&storyId=${encodeURIComponent(meta.storyId)}`
      }
    },
    {
      name: 'story_choice_A',
      input: {
        action: 'story_choice',
        storyId: meta.storyId,
        fromNodeId: meta.firstNodeId,
        choice: 'A',
        postbackData: `action=story_choice&storyId=${encodeURIComponent(meta.storyId)}&fromNodeId=${encodeURIComponent(meta.firstNodeId)}&choice=A`
      }
    },
    {
      name: 'story_choice_B',
      input: {
        action: 'story_choice',
        storyId: meta.storyId,
        fromNodeId: meta.firstNodeId,
        choice: 'B',
        postbackData: `action=story_choice&storyId=${encodeURIComponent(meta.storyId)}&fromNodeId=${encodeURIComponent(meta.firstNodeId)}&choice=B`
      }
    },
    {
      name: 'continue_story',
      input: {
        action: 'continue_story',
        storyId: meta.storyId,
        fromNodeId: meta.firstNodeId,
        nextNodeId: meta.firstNodeNextId,
        postbackData: `action=continue_story&storyId=${encodeURIComponent(meta.storyId)}&fromNodeId=${encodeURIComponent(meta.firstNodeId)}&nextNodeId=${encodeURIComponent(meta.firstNodeNextId)}`
      }
    },
    {
      name: 'story_menu',
      input: {
        action: 'story_menu',
        postbackData: 'action=story_menu'
      }
    }
  ];

  const postbackResults = [];
  for (const c of postbackCases) {
    const result = await runtime.processTextInput({
      userId: 'local-test-user',
      sessionKey: 'local-test-session',
      text: c.input.postbackData,
      source: 'webhook',
      ...c.input
    });
    postbackResults.push(summarizeResult(`postback:${c.name}`, result));
  }

  console.log(
    JSON.stringify(
      {
        storyMeta: meta,
        textResults,
        postbackResults
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});

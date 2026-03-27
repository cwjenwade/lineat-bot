const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const express = require('express');
const multer = require('multer');
const sharp = require('sharp');

const {
  uploadsDir,
  ensureStore,
  readStore,
  writeStore,
  listStories,
  getStory,
  createStory,
  saveStory,
  getGlobalSettings,
  saveGlobalSettings,
  saveTriggerBindings,
  listLogs,
  listVersions,
  recordAction,
  buildDashboardSummary
} = require('./storyAuthoringStore');
const { defaultGlobalSettings, createNodeTemplate, createCarouselPage } = require('./lineatDefaults');
const {
  assetExists,
  buildRenderResult,
  evaluateStoryIssues,
  validateMessagesWithLine,
  broadcastMessages,
  resolveAssetUrl
} = require('./lineatRenderer');
const { createStoryRuntime } = require('./storyRuntime');
const { createDraftNodesFromScript, applyDraftNodeToStory, normalizeName } = require('./scriptImport');

const adminDir = path.join(__dirname, '..', 'admin');
const upload = multer({ storage: multer.memoryStorage() });

function getActorMeta(req) {
  const role = req.get('x-lineat-role') || 'manager';
  const actor = req.get('x-lineat-actor') || role;
  return { role, actor };
}

function requireManager(req, res, next) {
  const actorMeta = getActorMeta(req);
  if (actorMeta.role !== 'manager') {
    return res.status(403).json({ error: 'Manager role required' });
  }
  req.actorMeta = actorMeta;
  next();
}

function withActor(req, _res, next) {
  req.actorMeta = getActorMeta(req);
  next();
}

function getPublicBaseUrl(req) {
  return process.env.PUBLIC_BASE_URL
    || `${req.protocol}://${req.get('host')}`;
}

function getLineBaseUrl() {
  return process.env.PUBLIC_BASE_URL || 'https://lineat-bot.onrender.com';
}

async function inspectAsset(assetPath, req) {
  const readable = assetExists(assetPath);
  const url = resolveAssetUrl(assetPath, getPublicBaseUrl(req));
  let metadata = null;

  if (readable && assetPath && !/^https?:\/\//.test(assetPath)) {
    const relative = assetPath.startsWith('/public/')
      ? assetPath.slice('/public/'.length)
      : assetPath.startsWith('public/')
        ? assetPath.slice('public/'.length)
        : assetPath.replace(/^\//, '');
    const absolute = path.join(__dirname, '..', 'public', relative);
    try {
      metadata = await sharp(absolute).metadata();
    } catch (error) {
      metadata = null;
    }
  }

  return {
    assetPath,
    readable,
    url,
    metadata
  };
}

function attachStoryStatus(story, store) {
  const issues = evaluateStoryIssues(story, store);
  return {
    ...story,
    statusSummary: {
      ok: issues.length === 0,
      errorCount: issues.filter((issue) => issue.level === 'error').length,
      issues
    }
  };
}

function createApiRouter() {
  ensureStore();
  const router = express.Router();
  router.use(express.json({ limit: '12mb' }));
  router.use(withActor);
  const localRuntime = createStoryRuntime({
    sessionStore: new Map(),
    getStore: () => readStore(),
    publicBaseUrl: getLineBaseUrl()
  });

  router.get('/dashboard', (req, res) => {
    const store = readStore();
    const stories = store.stories.map((story) => attachStoryStatus(story, store));
    res.json({
      dashboard: {
        ...buildDashboardSummary({
          recentValidate: stories.map((story) => story.lastValidate).filter(Boolean).sort().slice(-1)[0] || null,
          recentBroadcast: stories.map((story) => story.lastBroadcast).filter(Boolean).sort().slice(-1)[0] || null
        }),
        stories: stories.map((story) => ({
          id: story.id,
          title: story.title,
          startNodeId: story.startNodeId,
          triggerKeyword: story.triggerKeyword || '',
          statusSummary: story.statusSummary
        }))
      }
    });
  });

  router.get('/global-settings', (req, res) => {
    res.json({
      globalSettings: getGlobalSettings(),
      logs: listLogs().slice(0, 20),
      versions: listVersions().slice(0, 20)
    });
  });

  router.put('/global-settings', requireManager, (req, res) => {
    try {
      const globalSettings = saveGlobalSettings(req.body.globalSettings || {}, req.actorMeta);
      res.json({ globalSettings });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.put('/global-settings/triggers', requireManager, (req, res) => {
    try {
      const globalSettings = saveTriggerBindings(req.body.triggerBindings || [], req.actorMeta);
      res.json({ triggerBindings: globalSettings.triggerBindings });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/stories', (req, res) => {
    const store = readStore();
    res.json({
      stories: listStories().map((story) => attachStoryStatus(story, store))
    });
  });

  router.post('/stories', (req, res) => {
    try {
      const story = createStory(req.body?.title || '', req.actorMeta);
      res.status(201).json({ story });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.get('/stories/:storyId', (req, res) => {
    const store = readStore();
    const story = getStory(req.params.storyId);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    res.json({
      story: attachStoryStatus(story, store),
      globalSettings: store.globalSettings
    });
  });

  router.put('/stories/:storyId', (req, res) => {
    try {
      const story = saveStory(req.params.storyId, req.body.story || {}, req.actorMeta);
      res.json({ story });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/stories/:storyId/import-script', (req, res) => {
    const store = readStore();
    const story = store.stories.find((entry) => entry.id === req.params.storyId);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    try {
      const sourceText = `${req.body?.sourceText || ''}`.trim();
      if (!sourceText) {
        return res.status(400).json({ error: '缺少劇本文字' });
      }
      story.draftImport = createDraftNodesFromScript({
        text: sourceText,
        story,
        globalSettings: store.globalSettings
      });
      const saved = saveStory(story.id, story, req.actorMeta);
      res.json({ story: saved, draftImport: saved.draftImport });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/stories/:storyId/import-file', upload.single('file'), (req, res) => {
    const store = readStore();
    const story = store.stories.find((entry) => entry.id === req.params.storyId);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    try {
      if (!req.file) return res.status(400).json({ error: '缺少上傳檔案' });
      const sourceText = req.file.buffer.toString('utf8').trim();
      if (!sourceText) return res.status(400).json({ error: '檔案內容為空' });
      story.draftImport = {
        ...createDraftNodesFromScript({
          text: sourceText,
          story,
          globalSettings: store.globalSettings
        }),
        sourceType: 'file',
        sourceName: req.file.originalname
      };
      const saved = saveStory(story.id, story, req.actorMeta);
      res.json({ story: saved, draftImport: saved.draftImport });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.put('/stories/:storyId/draft', (req, res) => {
    const story = getStory(req.params.storyId);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    try {
      story.draftImport = req.body?.draftImport || story.draftImport;
      const saved = saveStory(story.id, story, req.actorMeta);
      res.json({ story: saved, draftImport: saved.draftImport });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/stories/:storyId/draft/reparse-node', (req, res) => {
    const store = readStore();
    const story = store.stories.find((entry) => entry.id === req.params.storyId);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    try {
      const nodeId = `${req.body?.nodeId || ''}`.trim();
      const draftNode = (story.draftImport?.nodes || []).find((entry) => entry.id === nodeId);
      if (!draftNode) return res.status(404).json({ error: 'Draft node not found' });

      const reparsed = createDraftNodesFromScript({
        text: `PIC ${draftNode.id.replace(/[^\d]/g, '') || 1}\n${draftNode.sourceText || draftNode.text || ''}`,
        story,
        globalSettings: store.globalSettings
      }).nodes[0];

      story.draftImport.nodes = story.draftImport.nodes.map((entry) =>
        entry.id === nodeId
          ? {
              ...entry,
              ...reparsed,
              id: entry.id,
              sourceKey: entry.sourceKey || entry.id,
              status: 'pending'
            }
          : entry
      );
      const saved = saveStory(story.id, story, req.actorMeta);
      res.json({ draftImport: saved.draftImport });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/stories/:storyId/draft/apply', (req, res) => {
    const story = getStory(req.params.storyId);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    try {
      const nodeId = `${req.body?.nodeId || ''}`.trim();
      const applyAll = Boolean(req.body?.applyAll);
      const draftNodes = applyAll
        ? (story.draftImport?.nodes || [])
        : (story.draftImport?.nodes || []).filter((entry) => entry.id === nodeId);
      if (!draftNodes.length) return res.status(400).json({ error: '沒有可套用的 draft node' });

      draftNodes.forEach((draftNode) => applyDraftNodeToStory(story, draftNode));
      story.draftImport.nodes = (story.draftImport.nodes || []).map((entry) =>
        draftNodes.some((draftNode) => draftNode.id === entry.id)
          ? { ...entry, status: 'applied' }
          : entry
      );
      if (!story.startNodeId && story.nodes[0]) story.startNodeId = story.nodes[0].id;
      const saved = saveStory(story.id, story, req.actorMeta);
      res.json({ story: saved, draftImport: saved.draftImport });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/stories/:storyId/characters/match-unbound', (req, res) => {
    const story = getStory(req.params.storyId);
    if (!story) return res.status(404).json({ error: 'Story not found' });
    try {
      const byName = new Map((story.characters || []).map((character) => [normalizeName(character.name), character]));
      story.draftImport.nodes = (story.draftImport?.nodes || []).map((node) => {
        if (!node.unboundCharacterName) return node;
        const matched = byName.get(normalizeName(node.unboundCharacterName));
        if (!matched) return node;
        return {
          ...node,
          speakerCharacterId: node.speakerCharacterId || matched.id,
          unboundCharacterName: ''
        };
      });
      story.draftImport.unboundRoles = Array.from(new Set(
        story.draftImport.nodes
          .map((node) => node.unboundCharacterName)
          .filter(Boolean)
      ));
      const saved = saveStory(story.id, story, req.actorMeta);
      res.json({ draftImport: saved.draftImport, characters: saved.characters });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/stories/:storyId/nodes', (req, res) => {
    const story = getStory(req.params.storyId);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    const type = req.body?.type || 'dialogue';
    const node = createNodeTemplate(type, story.nodes.length + 1);
    if (type === 'carousel' && Number(req.body?.pageCount) > 1) {
      node.pages = Array.from({ length: Number(req.body.pageCount) }, (_, index) => createCarouselPage(index + 1));
    }
    story.nodes.push(node);
    if (!story.startNodeId) story.startNodeId = node.id;
    const saved = saveStory(story.id, story, req.actorMeta);
    res.status(201).json({ node, story: saved });
  });

  router.get('/stories/:storyId/graph', (req, res) => {
    const story = getStory(req.params.storyId);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    res.json({
      graph: {
        nodes: story.nodes.map((node) => ({
          id: node.id,
          title: node.title,
          type: node.type,
          position: node.position,
          nextNodeId: node.nextNodeId || '',
          optionA: node.optionA?.nextNodeId || '',
          optionB: node.optionB?.nextNodeId || ''
        }))
      }
    });
  });

  router.post('/stories/:storyId/render/node', (req, res) => {
    const store = readStore();
    const story = store.stories.find((entry) => entry.id === req.params.storyId);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    try {
      const render = buildRenderResult(store, story, req.body?.nodeId || story.startNodeId, getPublicBaseUrl(req));
      res.json({ render });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/stories/:storyId/render/draft', (req, res) => {
    const store = readStore();
    const savedStory = store.stories.find((entry) => entry.id === req.params.storyId);
    if (!savedStory) {
      return res.status(404).json({ error: 'Story not found' });
    }
    try {
      const draftStore = {
        ...store,
        globalSettings: {
          ...defaultGlobalSettings(),
          ...store.globalSettings,
          ...(req.body?.globalSettings || {})
        },
        stories: store.stories.map((entry) => (entry.id === savedStory.id ? req.body.story || entry : entry))
      };
      const draftStory = draftStore.stories.find((entry) => entry.id === savedStory.id);
      const render = buildRenderResult(draftStore, draftStory, req.body?.nodeId || draftStory.startNodeId, getPublicBaseUrl(req));
      const issues = evaluateStoryIssues(draftStory, draftStore);
      res.json({ render, issues });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/stories/:storyId/render/story', (req, res) => {
    const store = readStore();
    const story = store.stories.find((entry) => entry.id === req.params.storyId);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    try {
      const chain = story.nodes.map((node) => buildRenderResult(store, story, node.id, getLineBaseUrl()));
      res.json({
        story: {
          id: story.id,
          title: story.title,
          nodes: chain
        }
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/stories/:storyId/validate/node', async (req, res) => {
    const store = readStore();
    const story = store.stories.find((entry) => entry.id === req.params.storyId);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    try {
      const render = buildRenderResult(store, story, req.body?.nodeId || story.startNodeId, getLineBaseUrl());
      const validation = await validateMessagesWithLine(render.payload.messages, process.env.LINE_CHANNEL_ACCESS_TOKEN, 'reply');
      recordAction('line.validate.node', {
        actor: req.actorMeta.actor,
        role: req.actorMeta.role,
        targetId: `${story.id}:${render.nodeId}`,
        result: validation.ok ? 'success' : 'failure',
        detail: validation.body
      });
      res.json({ render, validation });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/stories/:storyId/validate/draft', async (req, res) => {
    const store = readStore();
    const savedStory = store.stories.find((entry) => entry.id === req.params.storyId);
    if (!savedStory) {
      return res.status(404).json({ error: 'Story not found' });
    }
    try {
      const draftStore = {
        ...store,
        globalSettings: {
          ...defaultGlobalSettings(),
          ...store.globalSettings,
          ...(req.body?.globalSettings || {})
        },
        stories: store.stories.map((entry) => (entry.id === savedStory.id ? req.body.story || entry : entry))
      };
      const draftStory = draftStore.stories.find((entry) => entry.id === savedStory.id);
      const render = buildRenderResult(draftStore, draftStory, req.body?.nodeId || draftStory.startNodeId, getLineBaseUrl());
      const validation = await validateMessagesWithLine(render.payload.messages, process.env.LINE_CHANNEL_ACCESS_TOKEN, 'reply');
      res.json({ render, validation, issues: evaluateStoryIssues(draftStory, draftStore) });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/stories/:storyId/validate/story', async (req, res) => {
    const store = readStore();
    const story = store.stories.find((entry) => entry.id === req.params.storyId);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    try {
      const results = [];
      for (const node of story.nodes) {
        const render = buildRenderResult(store, story, node.id, getLineBaseUrl());
        const validation = await validateMessagesWithLine(render.payload.messages, process.env.LINE_CHANNEL_ACCESS_TOKEN, 'reply');
        results.push({
          nodeId: node.id,
          ok: validation.ok,
          status: validation.status,
          body: validation.body
        });
      }
      recordAction('line.validate.story', {
        actor: req.actorMeta.actor,
        role: req.actorMeta.role,
        targetId: story.id,
        result: results.every((result) => result.ok) ? 'success' : 'failure',
        detail: JSON.stringify(results)
      });
      res.json({ results });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/stories/:storyId/test/node', requireManager, async (req, res) => {
    const store = readStore();
    const story = store.stories.find((entry) => entry.id === req.params.storyId);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    try {
      const render = buildRenderResult(store, story, req.body?.nodeId || story.startNodeId, getLineBaseUrl());
      const validation = await validateMessagesWithLine(render.payload.messages, process.env.LINE_CHANNEL_ACCESS_TOKEN, 'broadcast');
      if (!validation.ok) {
        recordAction('line.broadcast.node', {
          actor: req.actorMeta.actor,
          role: req.actorMeta.role,
          targetId: `${story.id}:${render.nodeId}`,
          result: 'failure',
          detail: validation.body
        });
        return res.status(400).json({ render, validation });
      }
      const broadcast = await broadcastMessages(render.payload.messages, process.env.LINE_CHANNEL_ACCESS_TOKEN);
      recordAction('line.broadcast.node', {
        actor: req.actorMeta.actor,
        role: req.actorMeta.role,
        targetId: `${story.id}:${render.nodeId}`,
        result: broadcast.ok ? 'success' : 'failure',
        detail: broadcast.body
      });
      res.json({ render, validation, broadcast });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/stories/:storyId/test/trigger', requireManager, async (req, res) => {
    const store = readStore();
    const story = store.stories.find((entry) => entry.id === req.params.storyId);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    try {
      const startNodeId = req.body?.nodeId || story.startNodeId;
      const render = buildRenderResult(store, story, startNodeId, getLineBaseUrl());
      const validation = await validateMessagesWithLine(render.payload.messages, process.env.LINE_CHANNEL_ACCESS_TOKEN, 'broadcast');
      if (!validation.ok) {
        return res.status(400).json({ render, validation });
      }
      const broadcast = await broadcastMessages([
        { type: 'text', text: `開始故事測試：${story.title}` },
        ...render.payload.messages
      ].slice(0, 5), process.env.LINE_CHANNEL_ACCESS_TOKEN);
      recordAction('line.trigger.test', {
        actor: req.actorMeta.actor,
        role: req.actorMeta.role,
        targetId: `${story.id}:${startNodeId}`,
        result: broadcast.ok ? 'success' : 'failure',
        detail: broadcast.body
      });
      res.json({ render, validation, broadcast });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/runtime/simulate', (req, res) => {
    try {
      const sessionKey = `${req.actorMeta.actor}:${req.body?.sessionKey || 'local-user'}`;
      const text = `${req.body?.text || ''}`;
      const result = localRuntime.processTextInput(text, sessionKey);
      res.json({
        simulation: {
          text,
          sessionKey,
          mode: result.mode,
          session: result.session,
          messages: result.messages
        }
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/runtime/reset', (req, res) => {
    try {
      const sessionKey = `${req.actorMeta.actor}:${req.body?.sessionKey || 'local-user'}`;
      const result = localRuntime.clearSession(sessionKey);
      res.json({ simulation: result });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/asset-check', async (req, res) => {
    const asset = await inspectAsset(req.body?.assetPath || '', req);
    res.json({ asset });
  });

  router.post('/upload-image', upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Missing file upload' });
    }

    try {
      const fileName = `${randomUUID()}.jpg`;
      const outputPath = path.join(uploadsDir, fileName);
      const transformed = await sharp(req.file.buffer)
        .rotate()
        .resize({
          width: 1200,
          height: 1200,
          fit: 'inside',
          withoutEnlargement: true
        })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer();

      fs.writeFileSync(outputPath, transformed);
      const meta = await sharp(transformed).metadata();

      res.status(201).json({
        asset: {
          url: `/public/uploads/${fileName}`,
          width: meta.width,
          height: meta.height,
          bytes: transformed.length,
          mimeType: 'image/jpeg'
        }
      });
    } catch (error) {
      res.status(400).json({ error: 'Image transform failed' });
    }
  });

  router.get('/logs', (_req, res) => {
    res.json({ logs: listLogs() });
  });

  router.get('/versions', (_req, res) => {
    res.json({ versions: listVersions() });
  });

  return router;
}

function renderAdminHtml(apiBase, assetBase) {
  const template = fs.readFileSync(path.join(adminDir, 'index.html'), 'utf8');
  return template
    .replace(/__ADMIN_API_BASE__/g, apiBase)
    .replace(/__ADMIN_ASSET_BASE__/g, assetBase);
}

function mountAdmin(app, { uiPath = '/admin', apiPath = '/admin-api' } = {}) {
  ensureStore();
  app.use(apiPath, createApiRouter());
  app.use(uiPath, express.static(adminDir, { index: false }));
  app.get(uiPath, (req, res) => {
    res.type('html').send(renderAdminHtml(apiPath, uiPath));
  });
  app.get(`${uiPath}/`, (req, res) => {
    res.type('html').send(renderAdminHtml(apiPath, uiPath));
  });
}

function createAdminApp() {
  ensureStore();
  const app = express();
  app.use('/public', express.static(path.join(__dirname, '..', 'public')));
  app.use('/api', createApiRouter());
  app.use('/', express.static(adminDir, { index: false }));
  app.get('/', (req, res) => {
    res.type('html').send(renderAdminHtml('/api', ''));
  });
  return app;
}

module.exports = {
  mountAdmin,
  createAdminApp
};

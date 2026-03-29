const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');

const express = require('express');
const multer = require('multer');

let sharpInstance = null;
let rendererModule = null;

const {
  uploadsDir,
  ensureStore,
  getStoreSnapshot,
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

const {
  defaultGlobalSettings,
  createNodeTemplate,
  createCarouselPage
} = require('./lineatDefaults');

const { createStoryRuntime, buildStoryTraversal } = require('./storyRuntime');
const { resolveKeywordBindingAction } = require('./storyKeywordActions');
const {
  createDraftNodesFromScript,
  applyDraftNodeToStory,
  normalizeName
} = require('./scriptImport');

const adminDir = path.join(__dirname, '..', 'admin');
const publicDir = path.join(__dirname, '..', 'public');
const upload = multer({ storage: multer.memoryStorage() });
const execFileAsync = promisify(execFile);
const repoRoot = path.join(__dirname, '..');

function ensureDirSync(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function getSharp() {
  if (sharpInstance) return sharpInstance;
  sharpInstance = require('sharp');
  return sharpInstance;
}

function getRenderer() {
  if (rendererModule) return rendererModule;

  try {
    rendererModule = require('./lineatRenderer');
  } catch (_error) {
    rendererModule = {
      assetExists: () => true,
      buildNode: async (_store, _story, node) => ({
        ok: true,
        nodeId: node?.id || '',
        message: 'Renderer fallback mode'
      }),
      buildRenderResult: async (_store, story, nodeId) => ({
        nodeId,
        storyId: story?.id || '',
        image: '',
        images: [],
        payload: {
          messages: [
            {
              type: 'text',
              text: 'Rendering is unavailable because lineatRenderer could not be loaded.'
            }
          ]
        }
      }),
      publishStoryAssets: async () => ({
        ok: false,
        publishedAssets: {},
        assetPaths: [],
        deletedAssetPaths: [],
        successCount: 0,
        failedCount: 0,
        nodeResults: []
      }),
      evaluateStoryIssues: () => [
        {
          level: 'error',
          message: 'lineatRenderer module not available'
        }
      ],
      validateMessagesWithLine: async () => ({
        ok: false,
        status: 500,
        body: 'LINE validation unavailable because renderer module is missing.'
      }),
      resolveAssetUrl: (assetPath, baseUrl = '') => {
        if (!assetPath) return '';
        if (/^https?:\/\//.test(assetPath)) return assetPath;
        if (!baseUrl) return assetPath;
        return `${baseUrl.replace(/\/$/, '')}/${assetPath.replace(/^\//, '')}`;
      }
    };
  }

  return rendererModule;
}

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
  return process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
}

function getLineBaseUrl() {
  return process.env.PUBLIC_BASE_URL || 'https://lineat-bot.onrender.com';
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function remapStoryCloneIds(story) {
  const nodeIdMap = new Map();
  const pageIdMap = new Map();
  const characterIdMap = new Map();

  (story.characters || []).forEach((character) => {
    characterIdMap.set(character.id, `char-${randomUUID().slice(0, 8)}`);
  });

  (story.nodes || []).forEach((node) => {
    nodeIdMap.set(node.id, `${node.type || 'node'}-${randomUUID().slice(0, 8)}`);
    (node.pages || []).forEach((page) => {
      pageIdMap.set(page.id, `page-${randomUUID().slice(0, 8)}`);
    });
  });

  const remapNodeId = (nodeId = '') => nodeIdMap.get(nodeId) || nodeId || '';
  const remapCharacterId = (characterId = '') => characterIdMap.get(characterId) || characterId || '';

  story.startNodeId = remapNodeId(story.startNodeId || '');

  story.characters = (story.characters || []).map((character) => ({
    ...character,
    id: remapCharacterId(character.id)
  }));

  story.nodes = (story.nodes || []).map((node) => ({
    ...node,
    id: remapNodeId(node.id),
    speakerCharacterId: remapCharacterId(node.speakerCharacterId || ''),
    companionCharacterId: remapCharacterId(node.companionCharacterId || ''),
    nextNodeId: remapNodeId(node.nextNodeId || ''),
    optionA: node.optionA
      ? {
          ...node.optionA,
          nextNodeId: remapNodeId(node.optionA.nextNodeId || '')
        }
      : node.optionA,
    optionB: node.optionB
      ? {
          ...node.optionB,
          nextNodeId: remapNodeId(node.optionB.nextNodeId || '')
        }
      : node.optionB,
    pages: Array.isArray(node.pages)
      ? node.pages.map((page) => ({
          ...page,
          id: pageIdMap.get(page.id) || page.id,
          speakerCharacterId: remapCharacterId(page.speakerCharacterId || ''),
          companionCharacterId: remapCharacterId(page.companionCharacterId || '')
        }))
      : node.pages
  }));

  return story;
}

function isLocalAdminRequest(req) {
  const host = `${req.get('host') || ''}`.toLowerCase();
  return host.includes('localhost') || host.includes('127.0.0.1');
}

async function runGit(args) {
  return execFileAsync('git', args, {
    cwd: repoRoot,
    maxBuffer: 10 * 1024 * 1024
  });
}

async function inspectAsset(assetPath, req) {
  const {
    assetExists,
    resolveAssetUrl
  } = getRenderer();

  const readable = assetExists(assetPath);
  const url = resolveAssetUrl(assetPath, getPublicBaseUrl(req));
  let metadata = null;

  if (readable && assetPath && !/^https?:\/\//.test(assetPath)) {
    const relative = assetPath.startsWith('/public/')
      ? assetPath.slice('/public/'.length)
      : assetPath.startsWith('public/')
        ? assetPath.slice('public/'.length)
        : assetPath.replace(/^\//, '');

    const absolute = path.join(publicDir, relative);

    try {
      const sharp = getSharp();
      metadata = await sharp(absolute).metadata();
    } catch (_error) {
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
  const { evaluateStoryIssues } = getRenderer();
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
  ensureDirSync(publicDir);
  ensureDirSync(uploadsDir);

  const router = express.Router();
  router.use(express.json({ limit: '12mb' }));
  router.use(withActor);

  const localRuntime = createStoryRuntime({
    sessionStore: new Map(),
    getStore: () => getStoreSnapshot(),
    publicBaseUrl: getLineBaseUrl(),
    resolveKeywordBindingAction
  });

  async function buildRenderPreviewResponse(req) {
    const { evaluateStoryIssues } = getRenderer();

    const store = readStore();
    const storyId = req.body?.storyId || req.params.storyId;
    const savedStory = store.stories.find((entry) => entry.id === storyId);

    if (!savedStory) {
      const error = new Error('Story not found');
      error.status = 404;
      throw error;
    }

    const activeStore = req.body?.story || req.body?.globalSettings
      ? {
          ...store,
          globalSettings: {
            ...defaultGlobalSettings(),
            ...store.globalSettings,
            ...(req.body?.globalSettings || {})
          },
          stories: store.stories.map((entry) =>
            entry.id === savedStory.id ? (req.body.story || entry) : entry
          )
        }
      : store;

    const activeStory = activeStore.stories.find((entry) => entry.id === savedStory.id);
    const activeNodeId = req.body?.nodeId || activeStory.startNodeId;
    const activeNode = (activeStory.nodes || []).find((entry) => entry.id === activeNodeId);

    if (!activeNode) {
      const error = new Error('Node not found');
      error.status = 404;
      throw error;
    }

    const result = await localRuntime.processTextInput(
      '',
      `${req.actorMeta.actor}:preview:${activeStory.id}:${activeNode.id}`,
      {
        source: 'preview',
        storeOverride: activeStore,
        storyId: activeStory.id,
        nodeId: activeNode.id,
        previewNonce: `${req.body?.previewNonce || Date.now()}`,
        disableSessionCache: true,
        disableRenderCache: true,
        publicBaseUrl: getLineBaseUrl(),
        previewBaseUrl: getPublicBaseUrl(req)
      }
    );

    const render = {
      ...(result.render || {}),
      transitionPreviews: result.virtualTransitions || result.render?.transitionPreviews || [],
      traversal: result.traversal || null
    };

    return {
      render,
      issues: evaluateStoryIssues(activeStory, activeStore),
      traversal: result.traversal || null,
      virtualTransitions: result.virtualTransitions || []
    };
  }

  router.get('/dashboard', (_req, res) => {
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

  router.get('/global-settings', (_req, res) => {
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

  router.get('/stories', (_req, res) => {
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
      globalSettings: store.globalSettings,
      traversal: buildStoryTraversal(story)
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

  router.post('/stories/:storyId/duplicate', (req, res) => {
    try {
      const store = readStore();
      const sourceIndex = store.stories.findIndex((entry) => entry.id === req.params.storyId);

      if (sourceIndex === -1) {
        return res.status(404).json({ error: 'Story not found' });
      }

      const source = store.stories[sourceIndex];
      const duplicated = cloneJson(source);
      const timestamp = new Date().toISOString();

      duplicated.id = `story-${randomUUID().slice(0, 8)}`;
      duplicated.title = `${req.body?.title || ''}`.trim() || `${source.title} 副本`;
      duplicated.triggerKeyword = '';
      duplicated.publishedAssets = {};
      duplicated.lastValidate = null;
      duplicated.lastBroadcast = null;
      duplicated.createdAt = timestamp;
      duplicated.updatedAt = timestamp;

      remapStoryCloneIds(duplicated);

      store.stories.splice(sourceIndex + 1, 0, duplicated);
      writeStore(store);

      recordAction('story.duplicate', {
        actor: req.actorMeta.actor,
        role: req.actorMeta.role,
        targetId: duplicated.id,
        detail: `from:${source.id}`
      });

      const latestStore = readStore();
      const saved = latestStore.stories.find((entry) => entry.id === duplicated.id) || duplicated;

      res.status(201).json({
        story: attachStoryStatus(saved, latestStore),
        sourceStoryId: source.id
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.delete('/stories/:storyId', (req, res) => {
    try {
      const store = readStore();
      const storyIndex = store.stories.findIndex((entry) => entry.id === req.params.storyId);

      if (storyIndex === -1) {
        return res.status(404).json({ error: 'Story not found' });
      }

      const [deletedStory] = store.stories.splice(storyIndex, 1);

      store.globalSettings.triggerBindings = (store.globalSettings.triggerBindings || [])
        .filter((binding) => binding.storyId !== deletedStory.id);

      writeStore(store);

      recordAction('story.delete', {
        actor: req.actorMeta.actor,
        role: req.actorMeta.role,
        targetId: deletedStory.id
      });

      const latestStore = readStore();
      const nextStory = latestStore.stories[
        Math.min(storyIndex, Math.max(0, latestStore.stories.length - 1))
      ] || null;

      res.json({
        deletedStoryId: deletedStory.id,
        nextStoryId: nextStory?.id || ''
      });
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

      if (!sourceText) {
        return res.status(400).json({ error: '檔案內容為空' });
      }

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

      if (!draftNode) {
        return res.status(404).json({ error: 'Draft node not found' });
      }

      const reparsed = createDraftNodesFromScript({
        text: `PIC ${draftNode.id.replace(/[^\d]/g, '') || 1}\n${draftNode.sourceText || draftNode.text || ''}`,
        story,
        globalSettings: store.globalSettings
      }).nodes[0];

      story.draftImport.nodes = (story.draftImport.nodes || []).map((entry) =>
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

      if (!draftNodes.length) {
        return res.status(400).json({ error: '沒有可套用的 draft node' });
      }

      draftNodes.forEach((draftNode) => applyDraftNodeToStory(story, draftNode));

      story.draftImport.nodes = (story.draftImport?.nodes || []).map((entry) =>
        draftNodes.some((draftNode) => draftNode.id === entry.id)
          ? { ...entry, status: 'applied' }
          : entry
      );

      if (!story.startNodeId && story.nodes[0]) {
        story.startNodeId = story.nodes[0].id;
      }

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
      const byName = new Map(
        (story.characters || []).map((character) => [normalizeName(character.name), character])
      );

      story.draftImport = story.draftImport || {};
      story.draftImport.nodes = (story.draftImport.nodes || []).map((node) => {
        if (!node.unboundCharacterName) return node;

        const matched = byName.get(normalizeName(node.unboundCharacterName));
        if (!matched) return node;

        return {
          ...node,
          speakerCharacterId: node.speakerCharacterId || matched.id,
          unboundCharacterName: ''
        };
      });

      story.draftImport.unboundRoles = Array.from(
        new Set(
          (story.draftImport.nodes || [])
            .map((node) => node.unboundCharacterName)
            .filter(Boolean)
        )
      );

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
      node.pages = Array.from(
        { length: Number(req.body.pageCount) },
        (_, index) => createCarouselPage(index + 1)
      );
    }

    story.nodes.push(node);

    if (!story.startNodeId) {
      story.startNodeId = node.id;
    }

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

  router.post('/stories/:storyId/render/node', async (req, res) => {
    try {
      const { render } = await buildRenderPreviewResponse(req);
      res.json({ render });
    } catch (error) {
      res.status(error.status || 400).json({ error: error.message });
    }
  });

  router.post('/stories/:storyId/render/draft', async (req, res) => {
    try {
      const { render, issues, traversal, virtualTransitions } = await buildRenderPreviewResponse(req);
      res.json({ render, issues, traversal, virtualTransitions });
    } catch (error) {
      res.status(error.status || 400).json({ error: error.message });
    }
  });

  router.post('/render', async (req, res) => {
    try {
      const { render, issues, traversal, virtualTransitions } = await buildRenderPreviewResponse(req);
      res.json({
        image: render.image,
        images: render.images,
        payload: render.payload,
        render,
        issues,
        traversal,
        virtualTransitions
      });
    } catch (error) {
      res.status(error.status || 400).json({ error: error.message });
    }
  });

  router.post('/stories/:storyId/render/story', async (req, res) => {
    const { buildRenderResult } = getRenderer();

    const store = readStore();
    const story = store.stories.find((entry) => entry.id === req.params.storyId);

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    try {
      const chain = await Promise.all(
        story.nodes.map((node) =>
          buildRenderResult(store, story, node.id, getLineBaseUrl(), {
            requirePublishedAssets: false,
            usePublishedAssets: false
          })
        )
      );

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

  router.post('/stories/:storyId/publish-assets', requireManager, async (req, res) => {
    const {
      publishStoryAssets,
      resolveAssetUrl
    } = getRenderer();

    const store = readStore();
    const story = store.stories.find((entry) => entry.id === req.params.storyId);

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    try {
      const published = await publishStoryAssets(store, story, getPublicBaseUrl(req));
      const assetPaths = published.assetPaths || [];
      const deletedAssetPaths = published.deletedAssetPaths || [];
      const nodeResults = published.nodeResults || [];

      const saved = published.ok
        ? saveStory(
            story.id,
            {
              ...story,
              publishedAssets: published.publishedAssets || {}
            },
            req.actorMeta
          )
        : story;

      recordAction('render.publish-assets', {
        actor: req.actorMeta.actor,
        role: req.actorMeta.role,
        targetId: story.id,
        result: published.ok ? 'success' : 'failure',
        detail: JSON.stringify({
          assetCount: assetPaths.length,
          successCount: published.successCount || 0,
          failedCount: published.failedCount || 0
        })
      });

      res.json({
        published: {
          ok: published.ok,
          storyId: story.id,
          nodeCount: story.nodes.length,
          successCount: published.successCount || 0,
          failedCount: published.failedCount || 0,
          nodeResults,
          assetCount: assetPaths.length,
          deletedAssetCount: deletedAssetPaths.length,
          assets: assetPaths.map((assetPath) => resolveAssetUrl(assetPath, getPublicBaseUrl(req))),
          publishedAssets: saved.publishedAssets || {}
        }
      });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/stories/:storyId/build-node', requireManager, async (req, res) => {
    const { buildNode } = getRenderer();

    const store = readStore();
    const story = store.stories.find((entry) => entry.id === req.params.storyId);

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    const node = story.nodes.find((entry) => entry.id === req.body?.nodeId);

    if (!node) {
      return res.status(404).json({ error: 'Node not found' });
    }

    try {
      const built = await buildNode(store, story, node, getPublicBaseUrl(req), {
        requirePublishedAssets: false,
        usePublishedAssets: false
      });

      res.json({
        result: {
          ok: true,
          nodeId: built.nodeId,
          message: built.message
        }
      });
    } catch (_error) {
      res.status(400).json({
        result: {
          ok: false,
          nodeId: node.id,
          message: `[節點 ${node.id}] 重新產圖失敗`
        }
      });
    }
  });

  router.post('/stories/:storyId/deploy', requireManager, async (req, res) => {
    const { publishStoryAssets } = getRenderer();

    if (!isLocalAdminRequest(req)) {
      return res.status(403).json({ error: '只能從本機後台執行部署。' });
    }

    const store = readStore();
    const story = store.stories.find((entry) => entry.id === req.params.storyId);

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    try {
      const published = await publishStoryAssets(store, story, getPublicBaseUrl(req));

      if (!published.ok) {
        throw new Error('尚有節點未完成產圖');
      }

      const assetPaths = published.assetPaths || [];
      const deletedAssetPaths = published.deletedAssetPaths || [];

      saveStory(
        story.id,
        {
          ...story,
          publishedAssets: published.publishedAssets || {}
        },
        req.actorMeta
      );

      await runGit(['add', '-A']);

      const statusBeforeCommit = (await runGit(['status', '--short'])).stdout.trim();
      let commitCreated = false;
      let commitMessage = '';

      if (statusBeforeCommit) {
        commitMessage = req.body?.message?.trim() || `Deploy ${story.title} assets`;
        await runGit(['commit', '-m', commitMessage]);
        commitCreated = true;
      }

      await runGit(['push', 'origin', 'main']);

      const head = (await runGit(['rev-parse', 'HEAD'])).stdout.trim();
      const summary = (await runGit(['log', '-1', '--oneline'])).stdout.trim();
      const statusAfterPush = (await runGit(['status', '--short'])).stdout.trim();

      recordAction('render.deploy', {
        actor: req.actorMeta.actor,
        role: req.actorMeta.role,
        targetId: story.id,
        result: 'success',
        detail: JSON.stringify({
          head,
          assetCount: assetPaths.length,
          deletedAssetCount: deletedAssetPaths.length,
          commitCreated
        })
      });

      res.json({
        deployment: {
          storyId: story.id,
          assetCount: assetPaths.length,
          deletedAssetCount: deletedAssetPaths.length,
          commitCreated,
          commitMessage,
          head,
          summary,
          workingTreeClean: !statusAfterPush
        }
      });
    } catch (error) {
      recordAction('render.deploy', {
        actor: req.actorMeta.actor,
        role: req.actorMeta.role,
        targetId: story.id,
        result: 'failure',
        detail: error.message
      });

      res.status(400).json({ error: error.message });
    }
  });

  router.post('/stories/:storyId/validate/node', async (req, res) => {
    const {
      buildRenderResult,
      validateMessagesWithLine
    } = getRenderer();

    const store = readStore();
    const story = store.stories.find((entry) => entry.id === req.params.storyId);

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    try {
      const render = await buildRenderResult(
        store,
        story,
        req.body?.nodeId || story.startNodeId,
        getLineBaseUrl(),
        {
          requirePublishedAssets: false,
          usePublishedAssets: false
        }
      );

      const validation = await validateMessagesWithLine(
        render.payload.messages,
        process.env.LINE_CHANNEL_ACCESS_TOKEN,
        'reply'
      );

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
    const { validateMessagesWithLine } = getRenderer();

    try {
      const { render, issues } = await buildRenderPreviewResponse(req);
      const validation = await validateMessagesWithLine(
        render.payload.messages,
        process.env.LINE_CHANNEL_ACCESS_TOKEN,
        'reply'
      );

      res.json({ render, validation, issues });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/stories/:storyId/validate/story', async (req, res) => {
    const {
      buildRenderResult,
      validateMessagesWithLine
    } = getRenderer();

    const store = readStore();
    const story = store.stories.find((entry) => entry.id === req.params.storyId);

    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }

    try {
      const results = [];

      for (const node of story.nodes) {
        const render = await buildRenderResult(store, story, node.id, getLineBaseUrl(), {
          requirePublishedAssets: false,
          usePublishedAssets: false
        });

        const validation = await validateMessagesWithLine(
          render.payload.messages,
          process.env.LINE_CHANNEL_ACCESS_TOKEN,
          'reply'
        );

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

  router.post('/stories/:storyId/test/node', requireManager, (_req, res) => {
    res.status(410).json({
      error: '此功能已停用。請改用「模擬事件（走 runtime）」或真實 LINE webhook 驗證 session 流程。'
    });
  });

  router.post('/stories/:storyId/test/trigger', requireManager, (_req, res) => {
    res.status(410).json({
      error: '此功能已停用。請改用「模擬事件（走 runtime）」或真實 LINE webhook 驗證 trigger 與 session。'
    });
  });

  router.post('/runtime/simulate', async (req, res) => {
    try {
      const sessionKey = `${req.actorMeta.actor}:${req.body?.sessionKey || 'local-user'}`;
      const text = `${req.body?.text || ''}`;

      const result = await localRuntime.processTextInput(text, sessionKey, {
        source: 'simulate'
      });

      res.json({
        simulation: {
          text,
          sessionKey,
          mode: result.mode,
          session: result.session,
          messages: result.messages,
          traversal: result.traversal,
          virtualTransitions: result.virtualTransitions
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
      ensureDirSync(uploadsDir);

      const sharp = getSharp();
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
      if (error && /sharp/i.test(error.message || '')) {
        return res.status(500).json({ error: 'Image processing library not available' });
      }

      res.status(400).json({ error: error.message || 'Image transform failed' });
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
  ensureDirSync(publicDir);
  ensureDirSync(uploadsDir);

  app.use(apiPath, createApiRouter());
  app.use(uiPath, express.static(adminDir, { index: false }));

  app.get(uiPath, (_req, res) => {
    res.type('html').send(renderAdminHtml(apiPath, uiPath));
  });

  app.get(`${uiPath}/`, (_req, res) => {
    res.type('html').send(renderAdminHtml(apiPath, uiPath));
  });
}

function createAdminApp() {
  ensureStore();
  ensureDirSync(publicDir);
  ensureDirSync(uploadsDir);

  const app = express();

  app.use(
    '/public',
    express.static(publicDir, {
      setHeaders(res, filePath) {
        if (filePath.includes(`${path.sep}generated${path.sep}`)) {
          res.setHeader('Cache-Control', 'no-store, max-age=0, must-revalidate');
        }
      }
    })
  );

  app.use('/api', createApiRouter());
  app.use('/', express.static(adminDir, { index: false }));

  app.get('/', (_req, res) => {
    res.type('html').send(renderAdminHtml('/api', ''));
  });

  return app;
}

module.exports = {
  mountAdmin,
  createAdminApp
};

if (require.main === module) {
  const app = createAdminApp();
  const port = Number(process.env.PORT || 3000);

  app.listen(port, () => {
    console.log(`Admin server running at http://localhost:${port}`);
  });
}
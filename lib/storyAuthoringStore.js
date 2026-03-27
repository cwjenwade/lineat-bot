const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const {
  STORE_VERSION,
  defaultGlobalSettings,
  defaultStoryTemplate,
  createNodeTemplate,
  createCarouselPage,
  createInitialStore,
  cloneCharacters
} = require('./lineatDefaults');

const dataDir = path.join(__dirname, '..', 'data');
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
const storeFile = path.join(dataDir, 'story-authoring.json');
const legacyBackupFile = path.join(dataDir, 'story-authoring.legacy.json');

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function now() {
  return new Date().toISOString();
}

function roleDefaults(role = 'manager') {
  return {
    role,
    actor: role === 'manager' ? 'manager' : 'editor'
  };
}

function toFiniteNumber(value, fallback) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function normalizeCharacter(character = {}, fallback = {}) {
  return {
    id: character.id || fallback.id || `char-${randomUUID().slice(0, 8)}`,
    name: character.name || fallback.name || '新角色',
    category: character.category || fallback.category || 'supporting',
    sortOrder: toFiniteNumber(character.sortOrder, toFiniteNumber(fallback.sortOrder, 0)),
    avatarPath: character.avatarPath || fallback.avatarPath || '',
    placement: character.placement || fallback.placement || 'left',
    avatarX: toFiniteNumber(character.avatarX, toFiniteNumber(fallback.avatarX, 14)),
    avatarY: toFiniteNumber(character.avatarY, toFiniteNumber(fallback.avatarY, 332)),
    avatarSize: toFiniteNumber(character.avatarSize, toFiniteNumber(fallback.avatarSize, 92)),
    avatarScale: toFiniteNumber(character.avatarScale, toFiniteNumber(fallback.avatarScale, 1)),
    avatarCenterX: toFiniteNumber(character.avatarCenterX, toFiniteNumber(fallback.avatarCenterX, 50)),
    avatarCenterY: toFiniteNumber(character.avatarCenterY, toFiniteNumber(fallback.avatarCenterY, 50)),
    nameplateAnchor: character.nameplateAnchor || fallback.nameplateAnchor || 'left-fixed',
    nameplateX: toFiniteNumber(character.nameplateX, toFiniteNumber(fallback.nameplateX, 110)),
    nameplateRightPercent: toFiniteNumber(character.nameplateRightPercent, toFiniteNumber(fallback.nameplateRightPercent, 30)),
    nameplateY: toFiniteNumber(character.nameplateY, toFiniteNumber(fallback.nameplateY, 346)),
    nameplateColor: character.nameplateColor || fallback.nameplateColor || '#56616A',
    nameplateTextColor: character.nameplateTextColor || fallback.nameplateTextColor || '#FFFFFF',
    nameplateSize: character.nameplateSize || fallback.nameplateSize || 'lg'
  };
}

function normalizePage(page = {}, index = 1) {
  return {
    id: page.id || `page-${randomUUID().slice(0, 8)}`,
    title: page.title || `第 ${index} 頁`,
    cardType: page.cardType || 'dialogue',
    imagePath: page.imagePath || '/public/story/01/image01.png',
    text: page.text || '在這裡輸入內容。',
    previewFont: page.previewFont || 'default',
    lineTextSize: page.lineTextSize || 'lg',
    lineTextColor: page.lineTextColor || '#2D241B',
    heroImageOpacity: Number.isFinite(page.heroImageOpacity) ? page.heroImageOpacity : 1,
    heroImageScale: toFiniteNumber(page.heroImageScale, 1),
    nameplateSize: page.nameplateSize || 'lg',
    speakerCharacterId: page.speakerCharacterId || '',
    companionCharacterId: page.companionCharacterId || ''
  };
}

function normalizeDraftNode(node = {}, index = 1) {
  const normalized = normalizeNode({
    ...node,
    id: node.id || node.sourceKey || `draft-${index}`
  }, index);
  return {
    ...normalized,
    sourceKey: node.sourceKey || normalized.id,
    sourceText: node.sourceText || '',
    parserNotes: Array.isArray(node.parserNotes) ? node.parserNotes : [],
    status: node.status || 'pending',
    unboundCharacterName: node.unboundCharacterName || '',
    diff: node.diff || null
  };
}

function normalizeDraftImport(draftImport = {}) {
  return {
    status: draftImport.status || 'idle',
    sourceType: draftImport.sourceType || '',
    sourceName: draftImport.sourceName || '',
    sourceText: draftImport.sourceText || '',
    importedAt: draftImport.importedAt || null,
    unboundRoles: Array.isArray(draftImport.unboundRoles) ? draftImport.unboundRoles : [],
    nodes: Array.isArray(draftImport.nodes)
      ? draftImport.nodes.map((node, index) => normalizeDraftNode(node, index + 1))
      : []
  };
}

function normalizeNode(node = {}, index = 1) {
  const template = createNodeTemplate(node.type || 'dialogue', index);
  const normalized = {
    ...template,
    ...node,
    id: node.id || template.id,
    title: node.title || template.title,
    type: node.type || template.type,
    imagePath: node.imagePath || template.imagePath,
    text: node.text || template.text,
    previewFont: node.previewFont || template.previewFont,
    lineTextSize: node.lineTextSize || template.lineTextSize,
    lineTextColor: node.lineTextColor || template.lineTextColor || '#2D241B',
    heroImageOpacity: Number.isFinite(node.heroImageOpacity) ? node.heroImageOpacity : (Number.isFinite(template.heroImageOpacity) ? template.heroImageOpacity : 1),
    heroImageScale: toFiniteNumber(node.heroImageScale, toFiniteNumber(template.heroImageScale, 1)),
    nameplateSize: node.nameplateSize || template.nameplateSize,
    speakerCharacterId: node.speakerCharacterId || template.speakerCharacterId || '',
    companionCharacterId: node.companionCharacterId || template.companionCharacterId || '',
    nextNodeId: node.nextNodeId || '',
    continueLabel: node.continueLabel || template.continueLabel || '下一步',
    position: {
      x: Number.isFinite(node.position?.x) ? node.position.x : template.position.x,
      y: Number.isFinite(node.position?.y) ? node.position.y : template.position.y
    }
  };

  if (normalized.type === 'choice') {
    normalized.prompt = node.prompt || template.prompt || '在這裡輸入選項提問。';
    normalized.optionA = {
      label: node.optionA?.label || template.optionA?.label || '選項 A',
      feedback: node.optionA?.feedback || template.optionA?.feedback || '',
      nextNodeId: node.optionA?.nextNodeId || template.optionA?.nextNodeId || ''
    };
    normalized.optionB = {
      label: node.optionB?.label || template.optionB?.label || '選項 B',
      feedback: node.optionB?.feedback || template.optionB?.feedback || '',
      nextNodeId: node.optionB?.nextNodeId || template.optionB?.nextNodeId || ''
    };
    normalized.pages = Array.isArray(node.pages)
      ? node.pages.map((page, pageIndex) => normalizePage(page, pageIndex + 1))
      : [];
  }

  if (normalized.type === 'carousel') {
    normalized.pages = Array.isArray(node.pages) && node.pages.length
      ? node.pages.map((page, pageIndex) => normalizePage(page, pageIndex + 1))
      : [createCarouselPage(1)];
  }

  return normalized;
}

function normalizeStory(story = {}, index = 1, globalSettings = defaultGlobalSettings()) {
  const template = defaultStoryTemplate(index);
  const trigger = (story.triggerKeyword || '').trim();

  return {
    ...template,
    ...story,
    id: story.id || template.id,
    title: story.title || template.title,
    description: story.description || '',
    status: story.status || 'draft',
    triggerKeyword: trigger,
    startNodeId: story.startNodeId || '',
    createdAt: story.createdAt || template.createdAt,
    updatedAt: story.updatedAt || template.updatedAt,
    lastValidate: story.lastValidate || null,
    lastBroadcast: story.lastBroadcast || null,
    characters: Array.isArray(story.characters) && story.characters.length
      ? story.characters.map((character, characterIndex) =>
          normalizeCharacter(character, globalSettings.characters[characterIndex] || {})
        )
      : cloneCharacters(globalSettings.characters),
    draftImport: normalizeDraftImport(story.draftImport),
    nodes: Array.isArray(story.nodes)
      ? story.nodes.map((node, nodeIndex) => normalizeNode(node, nodeIndex + 1, globalSettings))
      : []
  };
}

function normalizeStore(store = {}) {
  const baseGlobal = defaultGlobalSettings();
  const globalSettings = {
    ...baseGlobal,
    ...(store.globalSettings || {})
  };

  globalSettings.defaults = {
    ...baseGlobal.defaults,
    ...(store.globalSettings?.defaults || {})
  };

  globalSettings.nameplateSizePresets = {
    ...baseGlobal.nameplateSizePresets,
    ...(store.globalSettings?.nameplateSizePresets || {})
  };

  globalSettings.cardLayouts = {
    dialogue: {
      ...baseGlobal.cardLayouts.dialogue,
      ...(store.globalSettings?.cardLayouts?.dialogue || {})
    },
    narration: {
      ...baseGlobal.cardLayouts.narration,
      ...(store.globalSettings?.cardLayouts?.narration || {})
    },
    choice: {
      ...baseGlobal.cardLayouts.choice,
      ...(store.globalSettings?.cardLayouts?.choice || {})
    }
  };

  globalSettings.characters = (store.globalSettings?.characters || baseGlobal.characters).map((character, index) =>
    normalizeCharacter(character, baseGlobal.characters[index] || {})
  );
  globalSettings.triggerBindings = Array.isArray(store.globalSettings?.triggerBindings)
    ? store.globalSettings.triggerBindings.map((binding) => ({
        id: binding.id || `trigger-${randomUUID().slice(0, 8)}`,
        keyword: `${binding.keyword || ''}`.trim(),
        storyId: binding.storyId || '',
        startNodeId: binding.startNodeId || ''
      }))
    : clone(baseGlobal.triggerBindings);

  return {
    version: STORE_VERSION,
    globalSettings,
    stories: Array.isArray(store.stories)
      ? store.stories.map((story, index) => normalizeStory(story, index + 1, globalSettings))
      : [],
    logs: Array.isArray(store.logs) ? store.logs : [],
    versions: Array.isArray(store.versions) ? store.versions : []
  };
}

function ensureStore() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });

  if (!fs.existsSync(storeFile)) {
    writeStore(createInitialStore());
    return;
  }

  const raw = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
  if (raw.version === STORE_VERSION && raw.globalSettings) {
    return;
  }

  if (!fs.existsSync(legacyBackupFile)) {
    fs.copyFileSync(storeFile, legacyBackupFile);
  }
  writeStore(createInitialStore());
}

function readStore() {
  ensureStore();
  return normalizeStore(JSON.parse(fs.readFileSync(storeFile, 'utf8')));
}

function writeStore(store) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(storeFile, JSON.stringify(normalizeStore(store), null, 2));
}

function appendLog(store, entry) {
  store.logs.push({
    id: `log-${randomUUID().slice(0, 8)}`,
    createdAt: now(),
    ...entry
  });
  store.logs = store.logs.slice(-200);
}

function appendVersion(store, entry) {
  store.versions.push({
    id: `ver-${randomUUID().slice(0, 8)}`,
    createdAt: now(),
    ...entry
  });
  store.versions = store.versions.slice(-100);
}

function listStories() {
  return readStore().stories;
}

function getStory(storyId) {
  return readStore().stories.find((story) => story.id === storyId) || null;
}

function getGlobalSettings() {
  return readStore().globalSettings;
}

function listLogs() {
  return readStore().logs.slice().reverse();
}

function listVersions() {
  return readStore().versions.slice().reverse();
}

function createStory(title = '', actorMeta = roleDefaults()) {
  const store = readStore();
  const story = normalizeStory({
    ...defaultStoryTemplate(store.stories.length + 1),
    id: `story-${randomUUID().slice(0, 8)}`,
    title: title.trim() || `Story ${store.stories.length + 1}`,
    nodes: [createNodeTemplate('dialogue', 1)]
  }, store.stories.length + 1, store.globalSettings);
  story.startNodeId = story.nodes[0].id;
  store.stories.push(story);
  appendLog(store, { action: 'story.create', actor: actorMeta.actor, role: actorMeta.role, targetId: story.id, result: 'success' });
  appendVersion(store, { action: 'story.create', actor: actorMeta.actor, role: actorMeta.role, targetId: story.id, snapshot: clone(story) });
  writeStore(store);
  return story;
}

function saveStory(storyId, payload, actorMeta = roleDefaults()) {
  const store = readStore();
  const index = store.stories.findIndex((story) => story.id === storyId);
  if (index === -1) {
    throw new Error(`Story not found: ${storyId}`);
  }

  const merged = normalizeStory({
    ...store.stories[index],
    ...payload,
    id: storyId,
    updatedAt: now()
  }, index + 1, store.globalSettings);

  store.stories[index] = merged;
  appendLog(store, { action: 'story.save', actor: actorMeta.actor, role: actorMeta.role, targetId: storyId, result: 'success' });
  appendVersion(store, { action: 'story.save', actor: actorMeta.actor, role: actorMeta.role, targetId: storyId, snapshot: clone(merged) });
  writeStore(store);
  return merged;
}

function saveGlobalSettings(payload, actorMeta = roleDefaults()) {
  const store = readStore();
  store.globalSettings = normalizeStore({
    ...store,
    globalSettings: {
      ...store.globalSettings,
      ...payload
    }
  }).globalSettings;
  appendLog(store, { action: 'global.save', actor: actorMeta.actor, role: actorMeta.role, targetId: 'global-settings', result: 'success' });
  appendVersion(store, { action: 'global.save', actor: actorMeta.actor, role: actorMeta.role, targetId: 'global-settings', snapshot: clone(store.globalSettings) });
  writeStore(store);
  return store.globalSettings;
}

function saveTriggerBindings(bindings, actorMeta = roleDefaults()) {
  return saveGlobalSettings({ triggerBindings: bindings }, actorMeta);
}

function recordAction(action, meta = {}) {
  const store = readStore();
  appendLog(store, {
    action,
    actor: meta.actor || 'system',
    role: meta.role || 'system',
    targetId: meta.targetId || '',
    result: meta.result || 'success',
    detail: meta.detail || ''
  });
  writeStore(store);
}

function buildDashboardSummary(summary = {}) {
  const store = readStore();
  return {
    storyCount: store.stories.length,
    triggerCount: store.globalSettings.triggerBindings.length,
    recentValidate: summary.recentValidate || null,
    recentBroadcast: summary.recentBroadcast || null,
    lastLog: store.logs.slice(-1)[0] || null
  };
}

module.exports = {
  dataDir,
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
  buildDashboardSummary,
  createNodeTemplate,
  createCarouselPage
};

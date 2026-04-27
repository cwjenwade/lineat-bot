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
let cachedStore = null;
let cachedStoreMtimeMs = 0;
const STORY_CAROUSEL_KEYWORD = '顯示繪本故事';
const STORY_CAROUSEL_BINDING_ID = 'trigger-story-carousel';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function now() {
  return new Date().toISOString();
}

function normalizeKeyword(value = '') {
  return `${value || ''}`.replace(/\s+/g, ' ').trim();
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
  const cardType = page.cardType || 'dialogue';
  const isTextTriptych = cardType === 'narration-triptych';
  return {
    id: page.id || `page-${randomUUID().slice(0, 8)}`,
    title: page.title || `第 ${index} 頁`,
    cardType,
    imagePath: page.imagePath || (isTextTriptych ? '' : '/public/story/01/image01.png'),
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

function createStoryCarouselItem(story = {}, index = 0, existing = {}) {
  const title = `${existing.title || story.title || ''}`.trim();
  const subtitle = `${existing.subtitle || story.description || `開始故事「${story.title || '未命名故事'}」`}`;
  return {
    id: existing.id || `carousel-item-${randomUUID().slice(0, 8)}`,
    storyId: `${existing.storyId || story.id || ''}`.trim(),
    title,
    subtitle,
    author: `${existing.author || ''}`.trim(),
    buttonLabel: `${existing.buttonLabel || '開始閱讀'}`.trim(),
    imagePath: `${existing.imagePath || ''}`.trim(),
    sortOrder: Number.isFinite(existing.sortOrder) ? existing.sortOrder : index
  };
}

function ensureAbsoluteStoryCarouselBinding(bindings = [], stories = []) {
  const nextBindings = Array.isArray(bindings) ? bindings.slice() : [];
  const existingIndex = nextBindings.findIndex((binding) => normalizeKeyword(binding.keyword) === STORY_CAROUSEL_KEYWORD);
  const existing = existingIndex >= 0 ? nextBindings[existingIndex] : null;
  const configuredItems = Array.isArray(existing?.carouselItems) ? existing.carouselItems : [];
  const storyIds = configuredItems.length
    ? configuredItems.map((item) => `${item.storyId || ''}`.trim()).filter(Boolean)
    : stories.map((story) => `${story.id || ''}`.trim()).filter(Boolean);
  const carouselItems = (configuredItems.length ? configuredItems : stories.map((story, index) => createStoryCarouselItem(story, index)))
    .map((item, index) => createStoryCarouselItem(
      stories.find((story) => story.id === item.storyId) || {},
      index,
      item
    ));
  const binding = {
    ...(existing || {}),
    id: existing?.id || STORY_CAROUSEL_BINDING_ID,
    scope: 'account',
    keyword: STORY_CAROUSEL_KEYWORD,
    actionType: 'carousel',
    label: `${existing?.label || '繪本故事選單'}`.trim() || '繪本故事選單',
    messageText: `${existing?.messageText || '請選擇你想閱讀的繪本。'}`,
    buttonLabel: `${existing?.buttonLabel || '開始閱讀'}`.trim() || '開始閱讀',
    storyIds: Array.from(new Set(storyIds)),
    carouselItems
  };
  if (existingIndex >= 0) {
    nextBindings[existingIndex] = binding;
  } else {
    nextBindings.unshift(binding);
  }
  return nextBindings;
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
    imageUrl: `${node.imageUrl || ''}`.trim(),
    imageMeta: node.imageMeta && typeof node.imageMeta === 'object' ? node.imageMeta : {},
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
    introTransitionText: node.introTransitionText || '',
    transitionText: node.transitionText || '',
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
  const hasExplicitCharacters = Array.isArray(story.characters);

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
    publishedAssets: story.publishedAssets && typeof story.publishedAssets === 'object'
      ? story.publishedAssets
      : {},
    characters: hasExplicitCharacters
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

  globalSettings.previewFontOptions = Array.from(new Set([
    ...(baseGlobal.previewFontOptions || []),
    ...((store.globalSettings?.previewFontOptions || []))
  ]));
  globalSettings.lineTextSizes = Array.from(new Set([
    ...(baseGlobal.lineTextSizes || []),
    ...((store.globalSettings?.lineTextSizes || []))
  ]));

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
  const storyTriggerKeywordByStoryId = new Map(
    (store.stories || []).map((story) => [story.id, `${story.triggerKeyword || ''}`.trim()])
  );
  globalSettings.triggerBindings = Array.isArray(store.globalSettings?.triggerBindings)
    ? store.globalSettings.triggerBindings.map((binding) => {
        const keyword = `${binding.keyword || ''}`.trim();
        const actionType = ['story', 'carousel', 'transition'].includes(binding.actionType) ? binding.actionType : 'story';
        const storyId = binding.storyId || '';
        const explicitScope = binding.scope === 'account' || binding.scope === 'story' ? binding.scope : '';
        const inferredScope = explicitScope || (
          actionType === 'carousel' || actionType === 'transition'
            ? 'account'
            : (storyId && storyTriggerKeywordByStoryId.get(storyId) === keyword ? 'story' : 'account')
        );
        return {
          id: binding.id || `trigger-${randomUUID().slice(0, 8)}`,
          scope: inferredScope,
          keyword,
          actionType,
          label: `${binding.label || ''}`.trim(),
          messageText: `${binding.messageText || ''}`,
          buttonLabel: `${binding.buttonLabel || ''}`.trim(),
          storyIds: Array.isArray(binding.storyIds)
            ? binding.storyIds.map((storyEntry) => `${storyEntry || ''}`.trim()).filter(Boolean)
            : [],
          carouselItems: Array.isArray(binding.carouselItems)
            ? binding.carouselItems.map((item, index) => ({
                id: item.id || `carousel-item-${randomUUID().slice(0, 8)}`,
                storyId: `${item.storyId || ''}`.trim(),
                title: `${item.title || ''}`.trim(),
                subtitle: `${item.subtitle || ''}`,
                author: `${item.author || ''}`.trim(),
                buttonLabel: `${item.buttonLabel || ''}`.trim(),
                imagePath: `${item.imagePath || ''}`.trim(),
                sortOrder: Number.isFinite(item.sortOrder) ? item.sortOrder : index
              }))
            : [],
          storyId,
          startNodeId: binding.startNodeId || ''
        };
      })
    : clone(baseGlobal.triggerBindings);
  globalSettings.triggerBindings = ensureAbsoluteStoryCarouselBinding(globalSettings.triggerBindings, Array.isArray(store.stories) ? store.stories : []);

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

function invalidateStoreCache() {
  cachedStore = null;
  cachedStoreMtimeMs = 0;
}

function loadNormalizedStoreFromDisk() {
  const stat = fs.statSync(storeFile);
  if (cachedStore && cachedStoreMtimeMs === stat.mtimeMs) {
    return cachedStore;
  }
  const normalized = normalizeStore(JSON.parse(fs.readFileSync(storeFile, 'utf8')));
  cachedStore = normalized;
  cachedStoreMtimeMs = stat.mtimeMs;
  return cachedStore;
}

function getStoreSnapshot() {
  ensureStore();
  return loadNormalizedStoreFromDisk();
}

function getHotStoreSnapshot() {
  ensureStore();
  if (!cachedStore) {
    cachedStore = loadNormalizedStoreFromDisk();
  }
  return cachedStore;
}

function readStore() {
  return clone(getStoreSnapshot());
}

function writeStore(store) {
  fs.mkdirSync(dataDir, { recursive: true });
  const normalized = normalizeStore(store);
  fs.writeFileSync(storeFile, JSON.stringify(normalized, null, 2));
  cachedStore = normalized;
  cachedStoreMtimeMs = fs.statSync(storeFile).mtimeMs;
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
  const startNodeId = `transition-${randomUUID().slice(0, 8)}`;
  const story = normalizeStory({
    ...defaultStoryTemplate(store.stories.length + 1),
    id: `story-${randomUUID().slice(0, 8)}`,
    title: title.trim() || 'Untitled Story',
    triggerKeyword: '',
    characters: [],
    publishedAssets: {},
    nodes: [{
      id: startNodeId,
      title: 'Start',
      type: 'transition',
      imagePath: '',
      text: '請先建立內容。',
      previewFont: 'default',
      lineTextSize: 'lg',
      lineTextColor: '#2D241B',
      heroImageOpacity: 1,
      heroImageScale: 1,
      nameplateSize: 'lg',
      speakerCharacterId: '',
      companionCharacterId: '',
      nextNodeId: '',
      transitionText: '',
      continueLabel: '繼續',
      backgroundColor: '#FFF4DE',
      position: {
        x: 80,
        y: 80
      }
    }]
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
  invalidateStoreCache,
  getStoreSnapshot,
  getHotStoreSnapshot,
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

(() => {
  const API_BASE = window.__LINEAT_ADMIN__?.apiBase || '/api';

  const state = {
    role: 'manager',
    stories: [],
    storyDetail: null,
    currentStoryId: '',
    currentNodeId: '',
    currentDraftNodeId: '',
    globalSettings: null,
    preview: null,
    previewIssues: [],
    previewStatus: '尚未載入節點。',
    isDirty: false,
    pendingAction: '',
    lastActionResult: '',
    workspaceTab: 'story',
    storyStage: 'overview',
    previewPanel: 'payload',
    previewIndex: 0,
    justDraggedNodeId: '',
    currentVirtualTransitionId: '',
    currentKeywordBindingId: '',
    settingStatus: '這裡編輯的是全帳號共用 trigger route。',
    graphLayoutOverrides: {}
  };

  const BLOCK_GRID_SIZE = 24;
  const BLOCK_MIN_X = 40;
  const BLOCK_MIN_Y = 80;
  const BLOCK_FLOW_SPACING_X = 420;

  const dom = {};
  let activePreviewRequestId = 0;

  document.addEventListener('DOMContentLoaded', boot);

  async function boot() {
    cacheDom();
    bindStaticEvents();
    await reloadAll();
  }

  function cacheDom() {
    dom.refreshAll = document.getElementById('refresh-all');
    dom.heroStatus = document.getElementById('hero-status');
    dom.heroApproval = document.getElementById('hero-approval');
    dom.heroRender = document.getElementById('hero-render');
    dom.workspaceTabs = Array.from(document.querySelectorAll('[data-workspace-tab]'));
    dom.pageSections = Array.from(document.querySelectorAll('[data-page-tab]'));

    dom.storyCount = document.getElementById('story-count');
    dom.newStoryTitle = document.getElementById('new-story-title');
    dom.createStory = document.getElementById('create-story');
    dom.storyList = document.getElementById('story-list');
    dom.editorStoryTitle = document.getElementById('editor-story-title');
    dom.editorStoryMeta = document.getElementById('editor-story-meta');
    dom.duplicateStory = document.getElementById('duplicate-story');
    dom.deleteStory = document.getElementById('delete-story');
    dom.storyTitleInput = document.getElementById('story-title-input');
    dom.storyDescriptionInput = document.getElementById('story-description-input');
    dom.storyStartNode = document.getElementById('story-start-node');
    dom.storyTriggerInput = document.getElementById('story-trigger-input');
    dom.storyTriggerHint = document.getElementById('story-trigger-hint');
    dom.storyProgressGrid = document.getElementById('story-progress-grid');
    dom.storyOverviewStatus = document.getElementById('story-overview-status');
    dom.storyPublishSummary = document.getElementById('story-publish-summary');
    dom.publishScopeHint = document.getElementById('publish-scope-hint');
    dom.settingStatus = document.getElementById('setting-status');
    dom.settingRouteOverview = document.getElementById('setting-route-overview');
    dom.keywordBindingTabs = document.getElementById('keyword-binding-tabs');
    dom.keywordBindingEditor = document.getElementById('keyword-binding-editor');
    dom.addKeywordStory = document.getElementById('add-keyword-story');
    dom.addKeywordCarousel = document.getElementById('add-keyword-carousel');
    dom.addKeywordTransition = document.getElementById('add-keyword-transition');
    dom.saveAccountSettings = document.getElementById('save-account-settings');
    dom.storyStageTabs = Array.from(document.querySelectorAll('[data-story-stage]'));
    dom.storyStagePanels = Array.from(document.querySelectorAll('[data-story-stage-panel]'));
    dom.storyCharacterList = document.getElementById('story-character-list');
    dom.addStoryCharacter = document.getElementById('add-story-character');
    dom.addProtagonistTemplate = document.getElementById('add-protagonist-template');
    dom.addSupportingTemplate = document.getElementById('add-supporting-template');
    dom.scriptImportText = document.getElementById('script-import-text');
    dom.scriptImportFile = document.getElementById('script-import-file');
    dom.importScriptText = document.getElementById('import-script-text');
    dom.matchUnboundRoles = document.getElementById('match-unbound-roles');
    dom.draftImportStatus = document.getElementById('draft-import-status');
    dom.draftNodeList = document.getElementById('draft-node-list');
    dom.saveDraftImport = document.getElementById('save-draft-import');
    dom.applyAllDraft = document.getElementById('apply-all-draft');
    dom.draftEditorEmpty = document.getElementById('draft-editor-empty');
    dom.draftEditorShell = document.getElementById('draft-editor-shell');
    dom.draftEditorForm = document.getElementById('draft-editor-form');
    dom.saveStory = document.getElementById('save-story');
    dom.publishAssets = document.getElementById('publish-assets');
    dom.deployRender = document.getElementById('deploy-render');
    dom.validateStory = document.getElementById('validate-story');
    dom.testTrigger = document.getElementById('test-trigger');
    dom.nodeGraph = document.getElementById('node-graph');
    dom.nodeEditorEmpty = document.getElementById('node-editor-empty');
    dom.nodeEditorShell = document.getElementById('node-editor-shell');
    dom.nodeEditorForm = document.getElementById('node-editor-form');
    dom.moduleButtons = Array.from(document.querySelectorAll('[data-add-node]'));
    dom.quickDialogueInput = document.getElementById('quick-dialogue-input');
    dom.appendDialogueFlow = document.getElementById('append-dialogue-flow');

    dom.previewStatus = document.getElementById('preview-status');
    dom.scenePreview = document.getElementById('scene-preview');
    dom.previewCounter = document.getElementById('preview-counter');
    dom.previewVersionHint = document.getElementById('preview-version-hint');
    dom.previewOutputMeta = document.getElementById('preview-output-meta');
    dom.payloadPreview = document.getElementById('payload-preview');
    dom.validateNode = document.getElementById('validate-node');
    dom.testNode = document.getElementById('test-node');
    dom.simulateText = document.getElementById('simulate-text');
    dom.simulateSessionKey = document.getElementById('simulate-session-key');
    dom.simulateMessage = document.getElementById('simulate-message');
    dom.simulateReset = document.getElementById('simulate-reset');
    dom.simulationOutput = document.getElementById('simulation-output');
    dom.previewTabs = Array.from(document.querySelectorAll('[data-preview-panel]'));
    dom.previewPanels = {
      payload: document.getElementById('preview-panel-payload'),
      simulate: document.getElementById('preview-panel-simulate')
    };
  }

  function bindStaticEvents() {
    if (dom.refreshAll) dom.refreshAll.addEventListener('click', reloadAll);
    dom.workspaceTabs.forEach((button) => button.addEventListener('click', () => {
      state.workspaceTab = button.dataset.workspaceTab || 'story';
      render();
    }));
    dom.createStory.addEventListener('click', handleCreateStory);
    dom.duplicateStory.addEventListener('click', handleDuplicateStory);
    dom.deleteStory.addEventListener('click', handleDeleteStory);
    dom.addStoryCharacter.addEventListener('click', handleAddStoryCharacter);
    dom.addProtagonistTemplate.addEventListener('click', () => handleAddStoryCharacter('protagonist'));
    dom.addSupportingTemplate.addEventListener('click', () => handleAddStoryCharacter('supporting'));
    dom.importScriptText.addEventListener('click', handleImportScriptText);
    dom.scriptImportFile.addEventListener('change', handleImportScriptFile);
    dom.matchUnboundRoles.addEventListener('click', handleMatchUnboundRoles);
    dom.saveDraftImport.addEventListener('click', handleSaveDraftImport);
    dom.applyAllDraft.addEventListener('click', handleApplyAllDraft);
    if (dom.saveStory) dom.saveStory.addEventListener('click', handleSaveStory);
    if (dom.publishAssets) dom.publishAssets.addEventListener('click', handlePublishAssets);
    if (dom.deployRender) dom.deployRender.addEventListener('click', handleDeployRender);
    if (dom.heroApproval) dom.heroApproval.addEventListener('click', handlePublishAssets);
    if (dom.heroRender) dom.heroRender.addEventListener('click', handleDeployRender);
    if (dom.validateStory) dom.validateStory.addEventListener('click', handleValidateStory);
    if (dom.testTrigger) dom.testTrigger.addEventListener('click', handleTestTrigger);
    if (dom.validateNode) dom.validateNode.addEventListener('click', handleValidateNode);
    if (dom.testNode) dom.testNode.addEventListener('click', handleTestNode);
    if (dom.simulateMessage) dom.simulateMessage.addEventListener('click', handleSimulateMessage);
    if (dom.simulateReset) dom.simulateReset.addEventListener('click', handleResetSimulation);
    dom.moduleButtons.forEach((button) => button.addEventListener('click', () => handleAddNode(button.dataset.addNode)));
    dom.appendDialogueFlow.addEventListener('click', handleAppendDialogueFlow);
    dom.storyTitleInput.addEventListener('input', () => updateStoryField('title', dom.storyTitleInput.value));
    dom.storyDescriptionInput.addEventListener('input', () => updateStoryField('description', dom.storyDescriptionInput.value));
    dom.storyTriggerInput.addEventListener('input', () => updateStoryTrigger(dom.storyTriggerInput.value));
    dom.storyStartNode.addEventListener('change', () => updateStoryField('startNodeId', dom.storyStartNode.value));
    if (dom.addKeywordStory) dom.addKeywordStory.addEventListener('click', () => handleAddKeywordBinding('story'));
    if (dom.addKeywordCarousel) dom.addKeywordCarousel.addEventListener('click', () => handleAddKeywordBinding('carousel'));
    if (dom.addKeywordTransition) dom.addKeywordTransition.addEventListener('click', () => handleAddKeywordBinding('transition'));
    if (dom.saveAccountSettings) dom.saveAccountSettings.addEventListener('click', handleSaveAccountSettings);
    dom.storyStageTabs.forEach((button) => button.addEventListener('click', () => {
      state.storyStage = button.dataset.storyStage;
      renderStories();
    }));
    dom.previewTabs.forEach((button) => button.addEventListener('click', () => {
      state.previewPanel = button.dataset.previewPanel;
      renderPreviewOnly();
    }));
  }

  async function api(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'x-lineat-role': state.role,
      'x-lineat-actor': state.role,
      ...(options.headers || {})
    };
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (!response.ok) {
      throw new Error(payload.error || text || `Request failed: ${response.status}`);
    }
    return payload;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function createLocalId(prefix = 'item') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  const keywordRouteManager = window.LineatAdminKeywordRoutes.createManager({
    state,
    dom,
    api,
    createLocalId,
    currentStory,
    render,
    reloadAll,
    clearDirty,
    setPendingAction,
    markDirty,
    nextNodeOptions,
    sectionHeading,
    createField,
    input,
    select,
    textarea,
    imageInput,
    createBlockingNotice,
    staticValue
  });

  function snapToBlockGrid(value, minimum = 0) {
    return Math.max(minimum, Math.round(value / BLOCK_GRID_SIZE) * BLOCK_GRID_SIZE);
  }

  function hasCustomGraphLayout(story) {
    const nodes = story?.nodes || [];
    if (nodes.length <= 1) return false;
    const positions = nodes
      .map((node) => ({
        x: Number(node.position?.x),
        y: Number(node.position?.y)
      }))
      .filter((pos) => Number.isFinite(pos.x) && Number.isFinite(pos.y));
    if (positions.length !== nodes.length) return false;

    const uniqueX = new Set(positions.map((pos) => snapToBlockGrid(pos.x)));
    const xSpread = Math.max(...positions.map((pos) => pos.x)) - Math.min(...positions.map((pos) => pos.x));
    const yValues = positions.map((pos) => pos.y).slice().sort((a, b) => a - b);
    const yGaps = yValues.slice(1).map((value, index) => value - yValues[index]);
    const mostlyVerticalGaps = yGaps.length ? yGaps.every((gap) => gap >= 100 && gap <= 180) : true;
    const looksLikeLegacyVertical = uniqueX.size <= 2 && xSpread <= 72 && mostlyVerticalGaps;

    return !looksLikeLegacyVertical;
  }

  function getGraphLayoutMode(story) {
    if (!story?.id) return 'flow';
    return state.graphLayoutOverrides[story.id]
      || (hasCustomGraphLayout(story) ? 'custom' : 'flow');
  }

  function buildGraphEntries(story) {
    const nodes = story?.nodes || [];
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const traversal = state.storyDetail?.traversal || null;
    if (!traversal?.entries?.length) {
      return {
        entries: nodes.map((node) => ({
          ...node,
          graphId: node.id,
          virtual: false,
          unreachable: false
        })),
        unreachableIds: new Set(),
        deadEndIds: new Set()
      };
    }

    const reachableIds = new Set(traversal.reachableNodeIds || []);
    const unreachableIds = new Set(traversal.unreachableNodeIds || []);
    const deadEndIds = new Set(traversal.deadEndNodeIds || []);
    const entries = traversal.entries.map((entry) => {
      if (entry.virtual) {
        return {
          ...entry,
          graphId: entry.id,
          title: entry.branch ? `過場 ${entry.branch}` : entry.position === 'before' ? '開頭過場' : '過場',
          summary: entry.text || '',
          unreachable: false
        };
      }
      const node = byId.get(entry.nodeId || entry.id);
      return {
        ...(node || entry),
        graphId: entry.id,
        virtual: false,
        unreachable: false
      };
    });

    nodes
      .filter((node) => unreachableIds.has(node.id))
      .forEach((node) => {
        entries.push({
          ...node,
          graphId: node.id,
          virtual: false,
          unreachable: true
        });
      });

    return {
      entries,
      unreachableIds,
      deadEndIds,
      reachableIds
    };
  }

  function buildGraphPlacements(story, entries = []) {
    const nodes = story?.nodes || [];
    const useCustomLayout = getGraphLayoutMode(story) === 'custom';
    const placed = new Map();
    const actualEntries = entries.length ? entries.filter((entry) => !entry.virtual) : nodes;
    actualEntries.forEach((node, index) => {
      if (useCustomLayout) {
        placed.set(node.graphId || node.id, {
          x: Math.max(BLOCK_MIN_X, Number(node.position?.x ?? (BLOCK_MIN_X + index * 300))),
          y: Math.max(BLOCK_MIN_Y, Number(node.position?.y ?? 96))
        });
        return;
      }
      placed.set(node.graphId || node.id, {
        x: BLOCK_MIN_X + index * BLOCK_FLOW_SPACING_X,
        y: 96
      });
    });
    entries
      .filter((entry) => entry.virtual)
      .forEach((entry, index) => {
        const source = placed.get(entry.sourceNodeId);
        const target = placed.get(entry.nextNodeId);
        if (source && target) {
          placed.set(entry.graphId || entry.id, {
            x: snapToBlockGrid(((source.x + target.x) / 2) - 70, BLOCK_MIN_X),
            y: snapToBlockGrid(
              source.y + (entry.branch === 'A' ? -132 : entry.branch === 'B' ? 176 : -132),
              24
            )
          });
          return;
        }
        if (source) {
          placed.set(entry.graphId || entry.id, {
            x: entry.position === 'before'
              ? snapToBlockGrid(Math.max(BLOCK_MIN_X, source.x - 220), BLOCK_MIN_X)
              : snapToBlockGrid(source.x + 250, BLOCK_MIN_X),
            y: snapToBlockGrid(
              source.y + (entry.branch === 'A' ? -132 : entry.branch === 'B' ? 176 : -132),
              24
            )
          });
          return;
        }
        placed.set(entry.graphId || entry.id, {
          x: BLOCK_MIN_X + index * 260,
          y: 40
        });
      });
    return placed;
  }

  function defaultSpeakerId() {
    return currentStory()?.characters?.[0]?.id || '';
  }

  function createLocalNodeTemplate(type = 'dialogue', order = 1) {
    const base = {
      id: createLocalId(type),
      title: type === 'narration' ? `Narration ${order}` : `Scene ${order}`,
      type,
      imagePath: '',
      text: '在這裡輸入內容。',
      previewFont: 'default',
      lineTextSize: 'lg',
      lineTextColor: '#2D241B',
      heroImageOpacity: 1,
      heroImageScale: 1,
      nameplateSize: 'lg',
      speakerCharacterId: defaultSpeakerId(),
      companionCharacterId: '',
      nextNodeId: '',
      introTransitionText: '',
      transitionText: '',
      continueLabel: '下一步',
      position: {
        x: 80,
        y: 80 + (order - 1) * 140
      }
    };

    if (type === 'narration') {
      return {
        ...base,
        speakerCharacterId: '',
        companionCharacterId: ''
      };
    }

    if (type === 'transition') {
      return {
        ...base,
        title: `Transition ${order}`,
        imagePath: '',
        text: '在這裡輸入轉場文案。',
        speakerCharacterId: '',
        companionCharacterId: '',
        continueLabel: '繼續',
        backgroundColor: '#FFF4DE'
      };
    }

    if (type === 'choice') {
      return {
        ...base,
        title: `Choice ${order}`,
        prompt: '在這裡輸入選項提問。',
        optionA: { label: '選項 A', feedback: '', nextNodeId: '' },
        optionB: { label: '選項 B', feedback: '', nextNodeId: '' },
        pages: [defaultPage(1)]
      };
    }

    if (type === 'carousel') {
      return {
        ...base,
        title: `Carousel ${order}`,
        speakerCharacterId: '',
        companionCharacterId: '',
        pages: [defaultPage(1)]
      };
    }

    return base;
  }

  function cloneNodeForInsert(node) {
    const duplicated = clone(node);
    duplicated.id = createLocalId(node.type || 'node');
    duplicated.title = `${node.title || 'Scene'} 副本`;
    duplicated.position = {
      x: node.position?.x || 80,
      y: node.position?.y || 80
    };
    if (Array.isArray(duplicated.pages)) {
      duplicated.pages = duplicated.pages.map((page, index) => ({
        ...page,
        id: createLocalId('page'),
        title: page.title || `第 ${index + 1} 頁`
      }));
    }
    return duplicated;
  }

  function normalizePageTitles(pages = []) {
    return pages.map((page, index) => ({
      ...page,
      title: page.title && !/^第\s+\d+\s+頁$/.test(page.title)
        ? page.title
        : `第 ${index + 1} 頁`
    }));
  }

  function findStoryCharacterByName(name) {
    const normalized = `${name || ''}`.trim().replace(/\s+/g, '').toLowerCase();
    if (!normalized) return null;
    const source = currentStory()?.characters || [];
    return source.find((character) =>
      `${character.name || ''}`.trim().replace(/\s+/g, '').toLowerCase() === normalized
    ) || null;
  }

  function currentStory() {
    return state.storyDetail?.story || null;
  }

  function currentNode() {
    const story = currentStory();
    return story?.nodes.find((node) => node.id === state.currentNodeId) || null;
  }

  function currentTriggerBinding() {
    return keywordRouteManager.currentTriggerBinding();
  }

  function currentTriggerKeyword() {
    return keywordRouteManager.currentTriggerKeyword();
  }

  function currentStoryTriggerHint() {
    return keywordRouteManager.currentStoryTriggerHint();
  }

  function keywordBindingActionType(binding) {
    return keywordRouteManager.keywordBindingActionType(binding);
  }

  function keywordBindingScope(binding) {
    return keywordRouteManager.keywordBindingScope(binding);
  }

  function allKeywordBindings() {
    return state.globalSettings?.triggerBindings || [];
  }

  function accountKeywordBindings() {
    return keywordRouteManager.accountKeywordBindings();
  }

  function findKeywordBinding(bindingId = '') {
    return keywordRouteManager.findKeywordBinding(bindingId);
  }

  function findStoryById(storyId = '') {
    return keywordRouteManager.findStoryById(storyId);
  }

  function storyPublishedAssetCount(story = currentStory()) {
    return Object.keys(story?.publishedAssets || {}).length;
  }

  function currentPreviewModel() {
    return state.preview?.models?.[state.previewIndex] || null;
  }

  function currentVirtualTransition() {
    const entries = [
      ...(state.preview?.transitionPreviews || []),
      ...((state.storyDetail?.traversal?.entries || []).filter((entry) => entry.virtual))
    ];
    return entries.find((entry) => entry.id === state.currentVirtualTransitionId) || null;
  }

  function currentDialogueBlockers(story = currentStory()) {
    if (!story) return [];
    const blockers = [];
    story.nodes.forEach((node) => {
      if (node.type === 'dialogue' && !node.speakerCharacterId) {
        blockers.push({ nodeId: node.id, scope: 'node', message: `節點 ${node.title || node.id} 缺少主講角色` });
      }
      (node.pages || []).forEach((page) => {
        if (page.cardType === 'dialogue' && !page.speakerCharacterId) {
          blockers.push({ nodeId: node.id, pageId: page.id, scope: 'page', message: `${node.title || node.id} / ${page.title || page.id} 缺少主講角色` });
        }
      });
    });
    return blockers;
  }

  function currentRenderBlocker() {
    const node = currentNode();
    const context = currentPreviewContext();
    if (!node) return '';
    if (context.targetType === 'page' && context.page?.cardType === 'dialogue' && !context.page?.speakerCharacterId) {
      return '目前這張對話頁尚未設定主講角色，已禁止預覽與儲存。';
    }
    if (context.targetType !== 'page' && node.type === 'dialogue' && !node.speakerCharacterId) {
      return '目前這張對話卡尚未設定主講角色，已禁止預覽與儲存。';
    }
    return '';
  }

  function firstDialogueBlocker(story = currentStory()) {
    return currentDialogueBlockers(story)[0]?.message || '';
  }

  function markDirty(message = '已修改，尚未儲存。') {
    state.isDirty = true;
    state.lastActionResult = 'dirty';
    state.previewStatus = message;
  }

  function clearDirty(message = '') {
    state.isDirty = false;
    if (message) {
      state.previewStatus = message;
    }
  }

  function setPendingAction(action = '') {
    state.pendingAction = action;
  }

  function previewStatusClassName() {
    const classes = ['status-box'];
    if (state.pendingAction) return `${classes.concat('is-pending').join(' ')}`;
    if (currentRenderBlocker()) return `${classes.concat('is-blocked').join(' ')}`;
    if (state.lastActionResult === 'saved') return `${classes.concat('is-success').join(' ')}`;
    if (state.lastActionResult === 'error') return `${classes.concat('is-error').join(' ')}`;
    if (state.lastActionResult === 'blocked') return `${classes.concat('is-blocked').join(' ')}`;
    return classes.join(' ');
  }

  function focusTransitionField(target = 'node') {
    requestAnimationFrame(() => {
      const selector = target === 'choice'
        ? '[data-transition-field="choice-a"] textarea, [data-transition-field="choice-b"] textarea'
        : target === 'intro'
          ? '[data-transition-field="intro"] textarea'
        : target === 'choice-a'
          ? '[data-transition-field="choice-a"] textarea'
          : target === 'choice-b'
            ? '[data-transition-field="choice-b"] textarea'
            : '[data-transition-field="node"] textarea';
      const field = dom.nodeEditorForm.querySelector(selector);
      if (!field) return;
      field.scrollIntoView({ behavior: 'smooth', block: 'center' });
      field.focus();
      if (typeof field.setSelectionRange === 'function') {
        const length = `${field.value || ''}`.length;
        field.setSelectionRange(length, length);
      }
    });
  }

  function currentPreviewContext() {
    const node = currentNode();
    const model = currentPreviewModel();
    if (!node) {
      return {
        targetType: 'node',
        node,
        model,
        pageIndex: -1,
        page: null
      };
    }

    if (node.type === 'carousel') {
      const pageIndex = Math.min(state.previewIndex, Math.max(0, (node.pages?.length || 1) - 1));
      return {
        targetType: 'page',
        node,
        model,
        pageIndex,
        page: node.pages?.[pageIndex] || null
      };
    }

    if (node.type === 'choice') {
      const pageCount = node.pages?.length || 0;
      if (pageCount && state.previewIndex < pageCount) {
        return {
          targetType: 'page',
          node,
          model,
          pageIndex: state.previewIndex,
          page: node.pages?.[state.previewIndex] || null
        };
      }
      return {
        targetType: 'choice',
        node,
        model,
        pageIndex: -1,
        page: null
      };
    }

    return {
      targetType: 'node',
      node,
      model,
      pageIndex: -1,
      page: null
    };
  }

  function describeEditorScope(node, context, virtualTransition = currentVirtualTransition()) {
    const breadcrumb = [currentStory()?.title || '未命名故事', node?.title || node?.id || '未命名節點'];
    let title = node?.title || node?.id || '未命名節點';
    let meta = '正在編輯節點主卡';
    let scope = '節點主卡';
    let pills = ['Node'];

    if (virtualTransition && virtualTransition.sourceNodeId === node?.id) {
      const branchLabel = virtualTransition.branch
        ? `選項 ${virtualTransition.branch} 過場`
        : virtualTransition.position === 'before'
          ? '開頭過場'
          : '下一幕過場';
      breadcrumb.push(branchLabel);
      title = branchLabel;
      meta = virtualTransition.branch
        ? `這裡編輯的是選項 ${virtualTransition.branch} 的過場映射，內容會回寫到原本選項欄位。`
        : virtualTransition.position === 'before'
          ? '這段會在本節點第一張卡片前送出。'
          : '這裡編輯的是節點的下一幕過場映射，內容會回寫到目前節點。';
      scope = '過場映射';
      pills = ['Transition'];
    } else if (context.targetType === 'page' && context.page) {
      breadcrumb.push(`第 ${context.pageIndex + 1} 頁`);
      title = context.page.title || `第 ${context.pageIndex + 1} 頁`;
      meta = `正在編輯第 ${context.pageIndex + 1} 頁，這裡只會影響目前頁面。`;
      scope = '頁面';
      pills = ['Page', describeNodeType(context.page.cardType || 'dialogue')];
    } else if (context.targetType === 'choice') {
      breadcrumb.push('選項卡');
      title = node?.prompt || '選項卡';
      meta = '正在編輯選項卡與分支去向。這裡不會改動前面的多頁內容。';
      scope = '選項卡';
      pills = ['Choice'];
    }

    return { breadcrumb, title, meta, scope, pills };
  }

  function currentPreviewVersionHint() {
    const story = currentStory();
    if (!story) return 'Preview 是編輯版，LINE 是正式版。';
    if (!storyPublishedAssetCount(story)) {
      return '尚未發布正式圖片。';
    }
    if (state.isDirty) {
      return '有未儲存改動，LINE 不會同步。';
    }
    return '完成 Save / Generate / Deploy 後才會同步到 LINE。';
  }

  function resetPreviewSelection() {
    state.previewIndex = 0;
    state.currentVirtualTransitionId = '';
  }

  function bindGraphEvents(story) {
    dom.nodeGraph.querySelectorAll('.graph-node[data-node-id]:not([data-virtual-transition-id])').forEach((card) => {
      card.addEventListener('pointerdown', (event) => startNodeDrag(event, card.dataset.nodeId));
      card.addEventListener('click', () => {
        state.currentVirtualTransitionId = '';
        if (state.justDraggedNodeId === card.dataset.nodeId) {
          state.justDraggedNodeId = '';
          return;
        }
        state.currentNodeId = card.dataset.nodeId;
        resetPreviewSelection();
        renderStories();
        refreshPreview().catch(console.error);
      });
    });
    dom.nodeGraph.querySelectorAll('.graph-node[data-virtual-transition-id]').forEach((card) => {
      card.addEventListener('click', (event) => {
        event.stopPropagation();
        state.currentNodeId = card.dataset.nodeId;
        state.currentVirtualTransitionId = card.dataset.virtualTransitionId;
        const entry = currentVirtualTransition();
        const node = currentNode();
        if (entry?.branch && Array.isArray(node?.pages)) {
          state.previewIndex = node.pages.length;
        }
        renderStories();
        focusTransitionField(entry?.fieldTarget || (entry?.branch ? `choice-${entry.branch.toLowerCase()}` : entry?.position === 'before' ? 'intro' : 'node'));
      });
    });
    dom.nodeGraph.querySelectorAll('[data-node-action]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const action = button.dataset.nodeAction;
        const nodeId = button.dataset.nodeId;
        if (action === 'move-prev') {
          moveStoryNode(nodeId, -1);
        } else if (action === 'move-next') {
          moveStoryNode(nodeId, 1);
        } else if (action === 'duplicate') {
          duplicateStoryNode(nodeId);
        } else if (action === 'insert-dialogue') {
          insertDialogueAfter(nodeId);
        } else if (action === 'insert-narration') {
          insertNodeAfter(nodeId, 'narration');
        } else if (action === 'insert-choice') {
          insertNodeAfter(nodeId, 'choice');
        } else if (action === 'insert-transition') {
          ensureNodeTransition(nodeId);
        } else if (action === 'delete') {
          deleteStoryNode(nodeId);
        }
      });
    });
  }

  function renderGraphOnly(story = currentStory()) {
    if (!story) {
      dom.nodeGraph.innerHTML = '';
      return;
    }
    dom.nodeGraph.innerHTML = renderNodeGraph(story);
    bindGraphEvents(story);
  }

  async function reloadAll() {
    const [storiesPayload, settingsPayload] = await Promise.all([
      api('/stories'),
      api('/global-settings')
    ]);

    state.stories = storiesPayload.stories;
    state.globalSettings = settingsPayload.globalSettings;

    const nextStoryId = state.stories.some((story) => story.id === state.currentStoryId)
      ? state.currentStoryId
      : (state.stories[0]?.id || '');
    if (nextStoryId) {
      await loadStory(nextStoryId);
    } else {
      state.storyDetail = null;
      state.currentStoryId = '';
      state.currentNodeId = '';
      state.preview = null;
      state.previewIssues = [];
      state.graphLayoutOverrides = {};
    }
    state.isDirty = false;
    state.pendingAction = '';
    render();
  }

  async function loadStory(storyId) {
    const payload = await api(`/stories/${storyId}`);
    state.storyDetail = payload;
    state.currentStoryId = storyId;
    const story = payload.story;
    state.graphLayoutOverrides[story.id] = hasCustomGraphLayout(story) ? 'custom' : 'flow';
    state.currentNodeId = state.currentNodeId && story.nodes.some((node) => node.id === state.currentNodeId)
      ? state.currentNodeId
      : (story.startNodeId || story.nodes[0]?.id || '');
    resetPreviewSelection();
    state.isDirty = false;
    await refreshPreview();
  }

  async function handleCreateStory() {
    const payload = await api('/stories', {
      method: 'POST',
      body: JSON.stringify({ title: dom.newStoryTitle.value.trim() })
    });
    dom.newStoryTitle.value = '';
    await reloadAll();
    await loadStory(payload.story.id);
    render();
  }

  async function handleDuplicateStory() {
    const story = currentStory();
    if (!story) return;
    const nextTitle = window.prompt('複製後故事名稱', `${story.title} 副本`);
    if (nextTitle === null) return;
    const payload = await api(`/stories/${story.id}/duplicate`, {
      method: 'POST',
      body: JSON.stringify({ title: nextTitle.trim() })
    });
    await reloadAll();
    await loadStory(payload.story.id);
    state.previewStatus = `已建立故事副本：${payload.story.title}`;
    render();
  }

  async function handleDeleteStory() {
    const story = currentStory();
    if (!story) return;
    const ok = window.confirm(`要刪除故事「${story.title}」嗎？這個操作會直接移除整個故事。`);
      state.previewStatus = '尚有對話卡缺少主講角色，已禁止發布到 Vercel。';
    const payload = await api(`/stories/${story.id}`, {
      method: 'DELETE'
    });
    state.currentStoryId = payload.nextStoryId || '';
    state.currentNodeId = '';
    state.previewStatus = '正在準備 Vercel 發佈資料...';
    if (payload.nextStoryId) {
      await loadStory(payload.nextStoryId);
    }
    state.previewStatus = `故事「${story.title}」已刪除。`;
    render();
  }

      state.previewStatus = `已更新部署資料，commit ${result.deployment.head.slice(0, 7)}。請將靜態輸出同步到 Vercel。`;
    if (!currentStory()) return;
    state.storyDetail.story[field] = value;
    if (field === 'startNodeId') {
      state.previewStatus = `更新部署資料失敗：${error.message}`;
      if (binding) {
        binding.startNodeId = value;
      }
    }
    markDirty('故事設定已修改，尚未儲存。');
    render();
    schedulePreview();
  }

  function updateStoryTrigger(keyword) {
    if (!state.globalSettings || !currentStory()) return;
    state.storyDetail.story.triggerKeyword = keyword;
    const binding = currentTriggerBinding();
    if (binding) {
      binding.keyword = keyword;
      binding.startNodeId = currentStory().startNodeId;
    } else {
      state.globalSettings.triggerBindings.push({
        id: `trigger-${Date.now()}`,
        scope: 'story',
        keyword,
        actionType: 'story',
        label: '開始故事',
        messageText: '',
        storyId: currentStory().id,
        startNodeId: currentStory().startNodeId
      });
    }
    markDirty('觸發關鍵字已修改，尚未儲存。');
    render();
  }

  function createKeywordBindingDraft(actionType = 'story') {
    return keywordRouteManager.createKeywordBindingDraft(actionType);
  }

  function handleAddKeywordBinding(actionType = 'story') {
    return keywordRouteManager.handleAddKeywordBinding(actionType);
  }

  function updateKeywordBindingField(bindingId, field, value) {
    return keywordRouteManager.updateKeywordBindingField(bindingId, field, value);
  }

  function deleteKeywordBinding(bindingId) {
    return keywordRouteManager.deleteKeywordBinding(bindingId);
  }

  function addCarouselItem(bindingId) {
    return keywordRouteManager.addCarouselItem(bindingId);
  }

  function updateCarouselItemField(bindingId, itemId, field, value) {
    return keywordRouteManager.updateCarouselItemField(bindingId, itemId, field, value);
  }

  function moveCarouselItem(bindingId, itemId, direction) {
    return keywordRouteManager.moveCarouselItem(bindingId, itemId, direction);
  }

  function removeCarouselItem(bindingId, itemId) {
    return keywordRouteManager.removeCarouselItem(bindingId, itemId);
  }

  async function handleSaveAccountSettings() {
    return keywordRouteManager.handleSaveAccountSettings();
  }

  async function handleSaveStory() {
    const story = currentStory();
    if (!story) return;
    story.triggerKeyword = currentTriggerKeyword();
    if (story.triggerKeyword && !currentTriggerBinding()) {
      state.globalSettings.triggerBindings.push({
        id: `trigger-${Date.now()}`,
        scope: 'story',
        keyword: story.triggerKeyword,
        actionType: 'story',
        label: '開始故事',
        messageText: '',
        storyId: story.id,
        startNodeId: story.startNodeId
      });
    }
    const blocker = currentRenderBlocker();
    if (blocker) {
      state.previewStatus = blocker;
      state.lastActionResult = 'blocked';
      render();
      return;
    }
    setPendingAction('save');
    state.previewStatus = '正在儲存故事...';
    render();
    try {
      const saved = await api(`/stories/${story.id}`, {
        method: 'PUT',
        body: JSON.stringify({ story })
      });
      state.storyDetail.story = saved.story;
      await api('/global-settings/triggers', {
        method: 'PUT',
        body: JSON.stringify({ triggerBindings: state.globalSettings.triggerBindings })
      });
      await reloadAll();
      clearDirty('故事已儲存。');
      state.lastActionResult = 'saved';
      render();
    } catch (error) {
      state.previewStatus = `儲存失敗：${error.message}`;
      state.lastActionResult = 'error';
      render();
      throw error;
    } finally {
      setPendingAction('');
    }
  }

  function currentDraftImport() {
    return currentStory()?.draftImport || null;
  }

  function currentDraftNode() {
    return currentDraftImport()?.nodes?.find((node) => node.id === state.currentDraftNodeId) || null;
  }

  function computeDraftDiff(node) {
    const story = currentStory();
    const current = story?.nodes?.find((entry) => entry.id === node.id);
    if (!current) return { isNew: true, changedFields: ['node'] };
    const fields = ['type', 'text', 'imagePath', 'speakerCharacterId', 'companionCharacterId', 'nextNodeId', 'prompt'];
    const changedFields = fields.filter((field) => `${node[field] || ''}` !== `${current[field] || ''}`);
    return { isNew: false, changedFields };
  }

  async function handleAddStoryCharacter(category = 'supporting') {
    const story = currentStory();
    if (!story) return;
    const isProtagonist = category === 'protagonist';
    story.characters.push({
      id: `char-${Date.now()}`,
      name: isProtagonist ? `主角 ${story.characters.length + 1}` : `配角 ${story.characters.length + 1}`,
      category,
      sortOrder: story.characters.length + 1,
      avatarPath: '',
      placement: isProtagonist ? 'left' : 'right',
      avatarX: 14,
      avatarY: 332,
      avatarSize: isProtagonist ? 92 : 84,
      nameplateAnchor: isProtagonist ? 'left-fixed' : 'right-percent',
      nameplateX: 110,
      nameplateRightPercent: 30,
      nameplateY: 346,
      nameplateColor: isProtagonist ? '#8B6A4E' : '#56616A',
      nameplateTextColor: '#FFFFFF',
      nameplateSize: 'lg'
    });
    markDirty('已新增角色，尚未儲存。');
    renderStories();
  }

  async function handleImportScriptText() {
    const story = currentStory();
    if (!story) return;
    if (!story.characters?.length) {
      state.previewStatus = '請先建立至少一個角色，再匯入劇本。';
      renderPreviewOnly();
      return;
    }
    const sourceText = dom.scriptImportText.value.trim();
    if (!sourceText) {
      state.previewStatus = '請先貼上劇本文字。';
      renderPreviewOnly();
      return;
    }
    const result = await api(`/stories/${story.id}/import-script`, {
      method: 'POST',
      body: JSON.stringify({ sourceText })
    });
    state.storyDetail.story = result.story;
    state.storyStage = 'import';
    state.previewStatus = `已匯入劇本草稿，共 ${result.draftImport.nodes.length} 個節點待校正。`;
    renderStories();
  }

  async function handleImportScriptFile() {
    const story = currentStory();
    if (!story || !dom.scriptImportFile.files?.[0]) return;
    if (!story.characters?.length) {
      state.previewStatus = '請先建立至少一個角色，再匯入劇本。';
      renderPreviewOnly();
      return;
    }
    const formData = new FormData();
    formData.append('file', dom.scriptImportFile.files[0]);
    const response = await fetch(`${API_BASE}/stories/${story.id}/import-file`, {
      method: 'POST',
      headers: {
        'x-lineat-role': state.role,
        'x-lineat-actor': state.role
      },
      body: formData
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(payload.error || '檔案匯入失敗');
    state.storyDetail.story = payload.story;
    state.storyStage = 'import';
    state.previewStatus = `已匯入檔案草稿，共 ${payload.draftImport.nodes.length} 個節點待校正。`;
    renderStories();
  }

  async function handleSaveDraftImport() {
    const story = currentStory();
    if (!story) return;
    const result = await api(`/stories/${story.id}/draft`, {
      method: 'PUT',
      body: JSON.stringify({ draftImport: story.draftImport })
    });
    state.storyDetail.story = result.story;
    state.previewStatus = 'AI 草稿已儲存。';
    renderStories();
  }

  async function handleApplyAllDraft() {
    const story = currentStory();
    if (!story) return;
    const result = await api(`/stories/${story.id}/draft/apply`, {
      method: 'POST',
      body: JSON.stringify({ applyAll: true })
    });
    state.storyDetail.story = result.story;
    state.storyStage = 'structure';
    state.previewStatus = 'AI 草稿已套用到正式故事。';
    renderStories();
    await refreshPreview();
  }

  async function handleMatchUnboundRoles() {
    const story = currentStory();
    if (!story) return;
    const result = await api(`/stories/${story.id}/characters/match-unbound`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    state.storyDetail.story.draftImport = result.draftImport;
    state.previewStatus = '已嘗試將未綁定角色對應到現有角色。';
    renderStories();
  }

  async function handleValidateStory() {
    const story = currentStory();
    if (!story) return;
    if (currentDialogueBlockers(story).length) {
      state.previewStatus = '尚有對話卡缺少主講角色，已禁止檢查故事。';
      state.lastActionResult = 'blocked';
      renderPreviewOnly();
      return;
    }
    setPendingAction('validate-story');
    state.previewStatus = '正在檢查故事...';
    render();
    try {
      await handleSaveStory();
      const result = await api(`/stories/${story.id}/validate/story`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      const failed = result.results.filter((entry) => !entry.ok);
      state.previewStatus = failed.length
        ? `全故事 validate 失敗：${failed.length} 個節點有錯。`
        : `全故事 validate 通過：${result.results.length} 個節點。`;
      state.lastActionResult = failed.length ? 'error' : 'saved';
      render();
    } catch (error) {
      state.previewStatus = `檢查故事失敗：${error.message}`;
      state.lastActionResult = 'error';
      renderPreviewOnly();
    } finally {
      setPendingAction('');
    }
  }

  async function handlePublishAssets() {
    const story = currentStory();
    if (!story) return;
    if (currentDialogueBlockers(story).length) {
      state.previewStatus = '尚有對話卡缺少主講角色，已禁止產生部署圖片。';
      state.lastActionResult = 'blocked';
      render();
      return;
    }
    setPendingAction('publish-assets');
    state.previewStatus = '正在產生部署圖片...';
    render();
    try {
      await handleSaveStory();
      const result = await api(`/stories/${story.id}/publish-assets`, {
        method: 'POST'
      });
      const nodeMessages = (result.published.nodeResults || []).map((entry) => entry.message).join('\n');
      state.previewStatus = result.published.ok
        ? `成功：${result.published.successCount} / ${result.published.nodeCount}\n${nodeMessages}`
        : `成功：${result.published.successCount} / ${result.published.nodeCount}\n失敗：${result.published.failedCount}\n${nodeMessages}`;
      state.lastActionResult = result.published.ok ? 'saved' : 'error';
      render();
    } catch (error) {
      state.previewStatus = `產生部署圖片失敗：${error.message}`;
      state.lastActionResult = 'error';
      render();
    } finally {
      setPendingAction('');
      render();
    }
  }

  async function handleDeployRender() {
    const story = currentStory();
    if (!story) return;
    if (currentDialogueBlockers(story).length) {
      state.previewStatus = '尚有對話卡缺少主講角色，已禁止發布到 Vercel。';
      state.lastActionResult = 'blocked';
      renderPreviewOnly();
      return;
    }
    setPendingAction('deploy-render');
    state.previewStatus = '正在準備 Vercel 發佈資料...';
    render();
    try {
      await handleSaveStory();
      const result = await api(`/stories/${story.id}/deploy`, {
        method: 'POST',
        body: JSON.stringify({})
      });
      state.previewStatus = `已更新部署資料，commit ${result.deployment.head.slice(0, 7)}。請將靜態輸出同步到 Vercel。`;
      state.lastActionResult = 'saved';
      render();
    } catch (error) {
      state.previewStatus = `更新部署資料失敗：${error.message}`;
      state.lastActionResult = 'error';
      renderPreviewOnly();
    } finally {
      setPendingAction('');
    }
  }

  async function handleTestTrigger() {
    state.previewStatus = '此功能已停用。請改用「模擬事件（走 runtime）」或真實 LINE webhook。';
    renderPreviewOnly();
  }

  async function handleValidateNode() {
    const story = currentStory();
    const node = currentNode();
    if (!story || !node) return;
    const blocker = currentRenderBlocker();
    if (blocker) {
      state.previewStatus = blocker;
      state.lastActionResult = 'blocked';
      renderPreviewOnly();
      return;
    }
    setPendingAction('validate-node');
    state.previewStatus = '正在檢查目前卡片...';
    renderPreviewOnly();
    try {
      const result = await api(`/stories/${story.id}/validate/draft`, {
        method: 'POST',
        body: JSON.stringify({
          story,
          globalSettings: state.globalSettings,
          nodeId: node.id
        })
      });
      state.preview = result.render;
      state.previewIssues = result.issues || [];
      state.previewStatus = result.validation.ok
        ? '單卡 validate 通過。'
        : `單卡 validate 失敗：${result.validation.body}`;
      state.lastActionResult = result.validation.ok ? 'saved' : 'error';
      renderPreviewOnly();
    } catch (error) {
      state.previewStatus = `單卡 validate 失敗：${error.message}`;
      state.lastActionResult = 'error';
      renderPreviewOnly();
    } finally {
      setPendingAction('');
    }
  }

  async function handleTestNode() {
    state.previewStatus = '此功能已停用。請改用「模擬事件（走 runtime）」或真實 LINE webhook。';
    renderPreviewOnly();
  }

  async function handleSimulateMessage() {
    const text = dom.simulateText.value.trim();
    const sessionKey = dom.simulateSessionKey.value.trim() || 'local-preview';
    setPendingAction('simulate');
    dom.simulationOutput.textContent = '正在執行模擬事件...';
    render();
    try {
      const result = await api('/runtime/simulate', {
        method: 'POST',
        body: JSON.stringify({ text, sessionKey })
      });
      dom.simulationOutput.textContent = JSON.stringify(result.simulation, null, 2);
      state.previewStatus = `模擬事件完成：${result.simulation.mode}`;
      state.lastActionResult = 'saved';
      renderPreviewOnly();
    } catch (error) {
      dom.simulationOutput.textContent = `模擬事件失敗：${error.message}`;
      state.previewStatus = `模擬事件失敗：${error.message}`;
      state.lastActionResult = 'error';
      renderPreviewOnly();
    } finally {
      setPendingAction('');
    }
  }

  async function handleResetSimulation() {
    const sessionKey = dom.simulateSessionKey.value.trim() || 'local-preview';
    setPendingAction('simulate-reset');
    try {
      const result = await api('/runtime/reset', {
        method: 'POST',
        body: JSON.stringify({ sessionKey })
      });
      dom.simulateSessionKey.value = 'local-preview';
      dom.simulateText.value = currentTriggerKeyword() || '';
      dom.simulationOutput.textContent = JSON.stringify(result.simulation, null, 2);
      state.previewStatus = '模擬 session 已重置。';
      state.lastActionResult = 'saved';
      renderPreviewOnly();
    } catch (error) {
      dom.simulationOutput.textContent = `重置 session 失敗：${error.message}`;
      state.previewStatus = `重置 session 失敗：${error.message}`;
      state.lastActionResult = 'error';
      renderPreviewOnly();
    } finally {
      setPendingAction('');
    }
  }

  async function handleAddNode(type) {
    const story = currentStory();
    if (!story) return;
    const context = currentPreviewContext();
    if (type === 'transition') {
      const node = currentNode();
      if (!node) return;
      ensureNodeTransition(node.id);
      if (node.type === 'choice' && Array.isArray(node.pages)) {
        state.previewIndex = node.pages.length;
      }
      state.currentVirtualTransitionId = '';
      state.previewStatus = node.type === 'choice'
        ? '已開啟選後過場文案，請在選項 A / B 欄位中修改。'
        : '已開啟下一幕過場文案，請在右側欄位中修改。';
      renderStories();
      refreshPreview().catch(console.error);
      focusTransitionField(node.type === 'choice' ? 'choice' : 'node');
      return;
    }
    if (context.targetType === 'page' && context.node?.pages?.length && (type === 'dialogue' || type === 'narration')) {
      insertNodePage(context.node, context.pageIndex, {
        cardType: type,
        duplicateCurrent: false
      });
      state.previewStatus = `已在 ${context.node.title || context.node.id} 後新增${type === 'dialogue' ? '對話頁' : '旁白頁'}。`;
      renderStories();
      return;
    }
    const result = await api(`/stories/${story.id}/nodes`, {
      method: 'POST',
      body: JSON.stringify({ type })
    });
    state.storyDetail.story = result.story;
    state.currentNodeId = result.node.id;
    resetPreviewSelection();
    render();
    await refreshPreview();
  }

  async function handleAppendDialogueFlow() {
    const story = currentStory();
    if (!story) return;
    const lines = `${dom.quickDialogueInput.value || ''}`
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) {
      state.previewStatus = '請先輸入要批次新增的對話。';
      renderPreviewOnly();
      return;
    }

    const currentIndex = story.nodes.findIndex((node) => node.id === state.currentNodeId);
    const insertIndex = currentIndex >= 0 ? currentIndex + 1 : story.nodes.length;
    const current = currentIndex >= 0 ? story.nodes[currentIndex] : null;
    const originalNext = current && current.type !== 'choice' ? (current.nextNodeId || '') : '';
    const insertedNodes = [];
    const unmatchedNames = [];

    lines.forEach((line, index) => {
      const matched = line.match(/^([^：:]+)[：:](.+)$/);
      let node;
      if (!matched) {
        node = createLocalNodeTemplate('narration', story.nodes.length + insertedNodes.length + 1);
        node.text = line;
      } else {
        const speakerName = matched[1].trim();
        const text = matched[2].trim();
        if (/^(旁白|narration)$/i.test(speakerName)) {
          node = createLocalNodeTemplate('narration', story.nodes.length + insertedNodes.length + 1);
          node.text = text;
        } else {
          node = createLocalNodeTemplate('dialogue', story.nodes.length + insertedNodes.length + 1);
          node.text = text;
          const speaker = findStoryCharacterByName(speakerName);
          node.speakerCharacterId = speaker?.id || '';
          if (!speaker) unmatchedNames.push(speakerName);
        }
      }

      node.title = `${describeNodeType(node.type)} ${story.nodes.length + index + 1}`;
      insertedNodes.push(node);
    });

    insertedNodes.forEach((node, index) => {
      node.nextNodeId = insertedNodes[index + 1]?.id || originalNext;
    });
    if (current && current.type !== 'choice') {
      current.nextNodeId = insertedNodes[0]?.id || current.nextNodeId;
    }

    story.nodes.splice(insertIndex, 0, ...insertedNodes);
    state.currentNodeId = insertedNodes[0]?.id || state.currentNodeId;
    dom.quickDialogueInput.value = '';
    resetPreviewSelection();
    markDirty(unmatchedNames.length
      ? `已新增 ${insertedNodes.length} 張卡，未對上角色：${Array.from(new Set(unmatchedNames)).join('、')}。記得按「儲存故事」。`
      : `已新增 ${insertedNodes.length} 張卡，記得按「儲存故事」。`);
    renderStories();
    await refreshPreview();
  }

  let previewTimer = null;
  function schedulePreview() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      refreshPreview().catch((error) => {
        state.previewStatus = error.message;
        renderPreviewOnly();
      });
    }, 120);
  }

  async function refreshPreview() {
    const requestId = activePreviewRequestId + 1;
    activePreviewRequestId = requestId;
    const story = currentStory();
    const node = currentNode();
    if (!story || !node) {
      state.preview = null;
      state.previewStatus = '尚未載入節點。';
      state.previewIssues = [];
      renderPreviewOnly();
      return;
    }
    const renderBlocker = currentRenderBlocker();
    if (renderBlocker) {
      state.preview = null;
      state.previewIssues = [{ level: 'error', message: renderBlocker }];
      state.previewStatus = renderBlocker;
      renderGraphOnly(story);
      renderPreviewOnly();
      return;
    }
    const result = await api('/render', {
      method: 'POST',
      body: JSON.stringify({
        storyId: story.id,
        story,
        globalSettings: state.globalSettings,
        nodeId: node.id,
        previewNonce: `${requestId}:${Date.now()}`
      })
    });
    if (requestId !== activePreviewRequestId) return;
    state.preview = result.render;
    if (state.storyDetail) {
      state.storyDetail.traversal = result.traversal || state.storyDetail.traversal || null;
    }
    renderGraphOnly(story);
    state.previewIndex = Math.min(state.previewIndex, Math.max(0, (result.render?.models?.length || 1) - 1));
    state.previewIssues = result.issues || [];
    state.previewStatus = result.issues?.length
      ? `目前有 ${result.issues.length} 個問題需要處理。`
      : '預覽已更新。';
    renderPreviewOnly();
  }

  function render() {
    renderWorkspaceTabs();
    renderSettingOverview();
    renderSettingEditor();
    renderStories();
  }

  function renderWorkspaceTabs() {
    dom.workspaceTabs.forEach((button) => {
      button.classList.toggle('active', button.dataset.workspaceTab === state.workspaceTab);
    });
    dom.pageSections.forEach((section) => {
      section.classList.toggle('active', section.dataset.pageTab === state.workspaceTab);
    });
  }

  function renderStories() {
    const availableStages = ['overview', 'characters', 'import', 'structure', 'editor'];
    if (!availableStages.includes(state.storyStage)) {
      state.storyStage = 'overview';
    }
    dom.storyStageTabs.forEach((button) => {
      button.classList.toggle('active', button.dataset.storyStage === state.storyStage);
    });
    dom.storyStagePanels.forEach((panel) => {
      panel.classList.toggle('active', panel.dataset.storyStagePanel === state.storyStage);
    });

    dom.storyCount.textContent = `${state.stories.length} 個故事`;
    dom.storyList.innerHTML = state.stories.map((story, index) => `
      <button class="story-tab-pill ${story.id === state.currentStoryId ? 'active' : ''}" data-story-id="${story.id}">
        <span class="story-tab-index">Story ${index + 1}</span>
        <span class="story-tab-title">${escapeHtml(story.title)}</span>
      </button>
    `).join('');
    dom.storyList.querySelectorAll('[data-story-id]').forEach((card) => {
      card.addEventListener('click', async () => {
        await loadStory(card.dataset.storyId);
        render();
      });
    });

    const story = currentStory();
    const blockers = currentDialogueBlockers(story);
    const hasDialogueBlockers = blockers.length > 0;
    const currentBlocker = currentRenderBlocker();
    dom.duplicateStory.disabled = !story;
    dom.deleteStory.disabled = !story;
    dom.appendDialogueFlow.disabled = !story;
    if (!story) {
      dom.editorStoryTitle.textContent = '未選擇故事';
      dom.editorStoryMeta.textContent = '';
      dom.storyProgressGrid.innerHTML = '';
      if (dom.storyOverviewStatus) dom.storyOverviewStatus.innerHTML = '';
      if (dom.storyPublishSummary) dom.storyPublishSummary.innerHTML = '';
      dom.nodeGraph.innerHTML = '';
      dom.nodeEditorEmpty.classList.remove('hidden');
      dom.nodeEditorShell.classList.add('hidden');
      return;
    }

    const triggerKeyword = currentTriggerKeyword();
    const blockerReason = firstDialogueBlocker(story);
    const dirtyLabel = state.pendingAction
      ? `處理中：${state.pendingAction}`
      : state.isDirty
        ? '尚未儲存'
        : state.lastActionResult === 'saved'
          ? '已儲存'
          : state.lastActionResult === 'error'
            ? '上一個操作失敗'
            : '同步中';
    dom.editorStoryTitle.textContent = story.title;
    dom.editorStoryMeta.textContent = `start: ${story.startNodeId || '未設定'} / trigger: ${triggerKeyword || '未設定'} / 狀態: ${dirtyLabel}`;
    dom.storyTitleInput.value = story.title || '';
    dom.storyDescriptionInput.value = story.description || '';
    dom.storyTriggerInput.value = triggerKeyword || '';
    dom.storyTriggerInput.title = '只編輯這個故事的啟動 keyword。';
    if (dom.storyTriggerHint) dom.storyTriggerHint.textContent = currentStoryTriggerHint();
    const previewContext = currentPreviewContext();
    const isPageEditing = previewContext.targetType === 'page' && previewContext.node?.pages?.length;
    dom.moduleButtons.forEach((button) => {
      const type = button.dataset.addNode;
      if (type === 'dialogue') {
        button.textContent = isPageEditing ? '＋ 對話頁' : '＋ 對話卡';
        button.title = isPageEditing ? '在目前這一幕後方插入新的對話頁。' : '新增新的對話節點。';
      } else if (type === 'narration') {
        button.textContent = isPageEditing ? '＋ 旁白頁' : '＋ 旁白卡';
        button.title = isPageEditing ? '在目前這一幕後方插入新的旁白頁。' : '新增新的旁白節點。';
      } else if (type === 'choice') {
        button.textContent = '＋ 選項卡';
        button.title = '新增新的選項節點。';
      } else if (type === 'transition') {
        button.textContent = '編輯過場';
        button.title = story.nodes.find((node) => node.id === state.currentNodeId)?.type === 'choice'
          ? '編輯選後過場。'
          : '編輯下一幕過場。';
      } else if (type === 'carousel') {
        button.textContent = '＋ 多頁訊息';
        button.title = '新增新的多頁節點。';
      }
    });
    if (dom.saveStory) dom.saveStory.disabled = Boolean(currentBlocker);
    if (dom.publishAssets) dom.publishAssets.disabled = hasDialogueBlockers;
    if (dom.deployRender) dom.deployRender.disabled = hasDialogueBlockers;
    if (dom.heroApproval) dom.heroApproval.disabled = hasDialogueBlockers;
    if (dom.heroRender) dom.heroRender.disabled = hasDialogueBlockers;
    if (dom.validateNode) dom.validateNode.disabled = Boolean(currentBlocker);
    if (dom.validateStory) dom.validateStory.disabled = hasDialogueBlockers || state.pendingAction === 'validate-story';
    if (dom.simulateMessage) dom.simulateMessage.disabled = state.pendingAction === 'simulate';
    if (dom.simulateReset) dom.simulateReset.disabled = state.pendingAction === 'simulate-reset';
    if (dom.saveStory) dom.saveStory.textContent = state.pendingAction === 'save' ? '儲存中...' : '儲存故事';
    if (dom.publishAssets) dom.publishAssets.textContent = state.pendingAction === 'publish-assets' ? '產圖中...' : '產生部署圖片';
    if (dom.deployRender) dom.deployRender.textContent = state.pendingAction === 'deploy-render' ? '發布中...' : '更新部署資料';
    if (dom.heroApproval) dom.heroApproval.textContent = state.pendingAction === 'publish-assets' ? 'Approval...' : 'Approval';
    if (dom.heroRender) dom.heroRender.textContent = state.pendingAction === 'deploy-render' ? 'Render...' : 'Render';
    if (dom.validateStory) dom.validateStory.textContent = state.pendingAction === 'validate-story' ? '檢查中...' : '檢查故事';
    if (dom.validateNode) dom.validateNode.textContent = state.pendingAction === 'validate-node' ? '檢查中...' : '驗證目前節點';
    if (dom.simulateMessage) dom.simulateMessage.textContent = state.pendingAction === 'simulate' ? '執行中...' : '送出文字事件';
    if (dom.simulateReset) dom.simulateReset.textContent = state.pendingAction === 'simulate-reset' ? '重置中...' : '重置 session';
    if (dom.saveStory) dom.saveStory.title = currentBlocker || '儲存故事';
    if (dom.publishAssets) dom.publishAssets.title = hasDialogueBlockers ? `已停用：${blockerReason}` : '產生正式圖片';
    if (dom.deployRender) dom.deployRender.title = hasDialogueBlockers ? `已停用：${blockerReason}` : '部署到 Render';
    if (dom.heroApproval) dom.heroApproval.title = hasDialogueBlockers ? `已停用：${blockerReason}` : '產生正式圖片';
    if (dom.heroRender) dom.heroRender.title = hasDialogueBlockers ? `已停用：${blockerReason}` : '部署到 Render';
    if (dom.validateStory) dom.validateStory.title = hasDialogueBlockers ? `已停用：${blockerReason}` : '檢查整個故事';
    if (dom.validateNode) dom.validateNode.title = currentBlocker || '檢查目前節點';
    if (dom.simulateMessage) dom.simulateMessage.title = '用目前文字跑 runtime';
    if (dom.simulateReset) dom.simulateReset.title = '清空模擬 session';
    if (dom.publishScopeHint) {
      dom.publishScopeHint.textContent = '先儲存故事，再產生部署圖片，最後同步到 Vercel，LINE 才會拿到正式版本。';
    }
    if (dom.heroStatus) {
      dom.heroStatus.textContent = state.previewStatus || '尚未載入節點。';
    }
    if (dom.simulateText && (!dom.simulateText.value || dom.simulateText.value === '101')) {
      dom.simulateText.value = triggerKeyword || '';
    }
    if (dom.simulateText) dom.simulateText.placeholder = triggerKeyword ? `例如：${triggerKeyword}` : '請先設定 trigger keyword';
    dom.storyStartNode.innerHTML = story.nodes.map((node) => `<option value="${escapeHtml(node.id)}">${escapeHtml(node.title)} (${escapeHtml(node.id)})</option>`).join('');
    dom.storyStartNode.value = story.startNodeId || story.nodes[0]?.id || '';
    dom.scriptImportText.value = story.draftImport?.sourceText || '';
    dom.draftImportStatus.textContent = story.draftImport?.importedAt
      ? `狀態：${story.draftImport.status} / 節點：${story.draftImport.nodes.length} / 未綁定角色：${story.draftImport.unboundRoles.length}`
      : '尚未匯入劇本。';
    renderStoryOverview(story);
    renderStoryProgress(story);
    state.currentDraftNodeId = state.currentDraftNodeId && story.draftImport?.nodes?.some((node) => node.id === state.currentDraftNodeId)
      ? state.currentDraftNodeId
      : (story.draftImport?.nodes?.[0]?.id || '');

    renderGraphOnly(story);
    renderStoryCharacters(story);
    renderDraftImport(story);
    renderDraftEditor(story);
    renderNodeEditor();
    renderPreviewOnly();
  }

  function renderStoryProgress(story) {
    const unboundCount = story.draftImport?.unboundRoles?.length || 0;
    const draftCount = story.draftImport?.nodes?.length || 0;
    const appliedCount = (story.draftImport?.nodes || []).filter((node) => node.status === 'applied').length;
    const summary = [
      ['角色數', story.characters?.length || 0],
      ['草稿節點', draftCount],
      ['未綁定角色', unboundCount],
      ['已套用節點', appliedCount]
    ];
    dom.storyProgressGrid.innerHTML = summary.map(([label, value]) => `
      <article class="progress-card">
        <div class="subtle">${escapeHtml(label)}</div>
        <strong>${escapeHtml(value)}</strong>
      </article>
    `).join('');
  }

  function renderStoryOverview(story) {
    if (!dom.storyOverviewStatus || !dom.storyPublishSummary) return;
    const publishedCount = storyPublishedAssetCount(story);
    const statusItems = [];
    if (!currentTriggerKeyword()) statusItems.push('未設定 trigger');
    if (!publishedCount) statusItems.push('未發布');
    if ((story.nodes || []).length === 1) statusItems.push('尚未建立內容');

    dom.storyOverviewStatus.innerHTML = statusItems.length
      ? statusItems.map((item) => `<span class="pill warn">${escapeHtml(item)}</span>`).join('')
      : '<span class="pill good">可編輯</span>';

    dom.storyPublishSummary.innerHTML = `
      <article class="progress-card">
        <div class="subtle">正式圖片</div>
        <strong>${escapeHtml(publishedCount)}</strong>
      </article>
      <article class="progress-card">
        <div class="subtle">故事啟動 Keyword</div>
        <strong>${escapeHtml(currentTriggerKeyword() || '未設定')}</strong>
      </article>
      <article class="progress-card">
        <div class="subtle">開始節點</div>
        <strong>${escapeHtml(story.startNodeId || '未設定')}</strong>
      </article>
      <article class="progress-card">
        <div class="subtle">Preview / LINE</div>
        <strong>${escapeHtml(state.isDirty ? '未同步' : '待發布')}</strong>
        <div class="field-hint">${escapeHtml(currentPreviewVersionHint())}</div>
      </article>
    `;
  }

  function renderSettingOverview() {
    return keywordRouteManager.renderSettingOverview();
  }

  function renderSettingEditor() {
    return keywordRouteManager.renderSettingEditor();
  }

  function renderStoryCharacters(story) {
    dom.storyCharacterList.innerHTML = '';
    const usageMap = new Map();
    story.nodes.forEach((node) => {
      [node.speakerCharacterId, node.companionCharacterId].filter(Boolean).forEach((characterId) => {
        const current = usageMap.get(characterId) || [];
        current.push(node.id);
        usageMap.set(characterId, current);
      });
      (node.pages || []).forEach((page) => {
        [page.speakerCharacterId, page.companionCharacterId].filter(Boolean).forEach((characterId) => {
          const current = usageMap.get(characterId) || [];
          current.push(`${node.id}/${page.id}`);
          usageMap.set(characterId, current);
        });
      });
    });

    story.characters
      .map((character, sourceIndex) => ({ character, sourceIndex }))
      .sort((a, b) => (a.character.sortOrder || 0) - (b.character.sortOrder || 0))
      .forEach(({ character, sourceIndex }) => {
      const card = document.createElement('article');
      card.className = 'character-card';
      card.dataset.characterIndex = String(sourceIndex);
      const usage = usageMap.get(character.id) || [];
      const header = document.createElement('div');
      header.className = 'character-header';
      header.innerHTML = `
        <div class="character-title-wrap">
          <div class="story-title">${escapeHtml(character.name)}</div>
          <div class="subtle" data-usage-count="${usage.length}">分類：${escapeHtml(character.category || 'supporting')} / 使用節點：${usage.length}</div>
        </div>
        <span class="pill">${escapeHtml(character.id)}</span>
      `;
      card.appendChild(header);

      const preview = document.createElement('div');
      preview.className = 'character-preview';
      preview.dataset.characterPreview = String(sourceIndex);
      preview.innerHTML = renderCharacterPreviewMarkup(character);

      const editorGrid = document.createElement('div');
      editorGrid.className = 'character-editor-grid';

      const previewShell = document.createElement('div');
      previewShell.className = 'character-preview-shell';
      previewShell.innerHTML = `<div class="character-preview-label">即時角色預覽</div>`;
      previewShell.appendChild(preview);

      const editorSections = document.createElement('div');
      editorSections.className = 'character-editor-sections';

      const avatarSizeControl = numberInput(character.avatarSize || 92, (value) => updateStoryCharacter(sourceIndex, 'avatarSize', value));
      avatarSizeControl.dataset.characterField = 'avatarSize';
      const avatarXControl = numberInput(character.avatarX || 14, (value) => updateStoryCharacter(sourceIndex, 'avatarX', value));
      avatarXControl.dataset.characterField = 'avatarX';
      const avatarYControl = numberInput(character.avatarY || 332, (value) => updateStoryCharacter(sourceIndex, 'avatarY', value));
      avatarYControl.dataset.characterField = 'avatarY';
      const avatarScaleControl = rangeInput(character.avatarScale ?? 1, 0.5, 3, 0.05, (value) => updateStoryCharacter(sourceIndex, 'avatarScale', value), (value) => `${Number(value).toFixed(2)}x`);
      avatarScaleControl.dataset.characterField = 'avatarScale';
      const avatarCenterXControl = rangeInput(character.avatarCenterX ?? 50, 0, 100, 1, (value) => updateStoryCharacter(sourceIndex, 'avatarCenterX', value), (value) => `${Math.round(value)}%`);
      avatarCenterXControl.dataset.characterField = 'avatarCenterX';
      const avatarCenterYControl = rangeInput(character.avatarCenterY ?? 50, 0, 100, 1, (value) => updateStoryCharacter(sourceIndex, 'avatarCenterY', value), (value) => `${Math.round(value)}%`);
      avatarCenterYControl.dataset.characterField = 'avatarCenterY';
      const nameplateXControl = numberInput(character.nameplateX || 110, (value) => updateStoryCharacter(sourceIndex, 'nameplateX', value));
      nameplateXControl.dataset.characterField = 'nameplateX';
      const nameplateRightPercentControl = numberInput(character.nameplateRightPercent || 30, (value) => updateStoryCharacter(sourceIndex, 'nameplateRightPercent', value));
      nameplateRightPercentControl.dataset.characterField = 'nameplateRightPercent';
      const nameplateYControl = numberInput(character.nameplateY || 346, (value) => updateStoryCharacter(sourceIndex, 'nameplateY', value));
      nameplateYControl.dataset.characterField = 'nameplateY';
      const nameplateColorControl = colorInput(character.nameplateColor || '#56616A', (value) => updateStoryCharacter(sourceIndex, 'nameplateColor', value), '#56616A');
      nameplateColorControl.dataset.characterField = 'nameplateColor';
      const nameplateTextColorControl = colorInput(character.nameplateTextColor || '#FFFFFF', (value) => updateStoryCharacter(sourceIndex, 'nameplateTextColor', value), '#FFFFFF');
      nameplateTextColorControl.dataset.characterField = 'nameplateTextColor';

      const basics = document.createElement('section');
      basics.className = 'character-section';
      basics.appendChild(sectionHeading('基本資料'));
      const basicsGrid = document.createElement('div');
      basicsGrid.className = 'character-field-grid';
      basicsGrid.append(
        createField('名稱', input(character.name, (value) => updateStoryCharacter(sourceIndex, 'name', value))),
        createField('角色 ID', input(character.id, (value) => updateStoryCharacter(sourceIndex, 'id', value))),
        createField('分類', select([['protagonist', '主角'], ['supporting', '配角'], ['narrator', '旁白']], character.category || 'supporting', (value) => updateStoryCharacter(sourceIndex, 'category', value))),
        createField('排序', numberInput(character.sortOrder || 0, (value) => updateStoryCharacter(sourceIndex, 'sortOrder', value))),
        createField('預設位置', select([['left', '左'], ['right', '右']], character.placement, (value) => updateStoryCharacter(sourceIndex, 'placement', value)))
      );
      basics.appendChild(basicsGrid);

      const avatarSection = document.createElement('section');
      avatarSection.className = 'character-section';
      avatarSection.appendChild(sectionHeading('頭貼設定'));
      const avatarGrid = document.createElement('div');
      avatarGrid.className = 'character-field-grid';
      avatarGrid.append(
        createField('頭像圖片', imageInput(character.avatarPath, (value) => updateStoryCharacter(sourceIndex, 'avatarPath', value)), 'single'),
        createField('頭像尺寸', avatarSizeControl),
        createField('頭像 X', avatarXControl),
        createField('頭像 Y', avatarYControl),
        createField('頭貼縮放', avatarScaleControl),
        createField('中心 X', avatarCenterXControl),
        createField('中心 Y', avatarCenterYControl)
      );
      avatarSection.appendChild(avatarGrid);

      const plateSection = document.createElement('section');
      plateSection.className = 'character-section';
      plateSection.appendChild(sectionHeading('姓名牌設定'));
      const plateGrid = document.createElement('div');
      plateGrid.className = 'character-field-grid';
      plateGrid.append(
        createField('姓名牌 X', nameplateXControl),
        createField('姓名牌右側 %', nameplateRightPercentControl),
        createField('姓名牌 Y', nameplateYControl),
        createField('姓名牌大小', nameplateSizeSlider(character.nameplateSize || 'lg', (value) => updateStoryCharacter(sourceIndex, 'nameplateSize', value))),
        createField('姓名牌顏色', nameplateColorControl),
        createField('姓名牌字色', nameplateTextColorControl)
      );
      plateSection.appendChild(plateGrid);

      editorSections.append(basics, avatarSection, plateSection);
      editorGrid.append(previewShell, editorSections);
      card.appendChild(editorGrid);

      const usageLine = document.createElement('div');
      usageLine.className = 'draft-diff';
      usageLine.textContent = usage.length ? `出現位置：${usage.join(', ')}` : '尚未被任何節點使用。';
      card.appendChild(usageLine);
      const actions = document.createElement('div');
      actions.className = 'character-actions';
      const save = document.createElement('button');
      save.className = 'button good';
      save.textContent = '儲存故事';
      save.addEventListener('click', handleSaveStory);
      actions.appendChild(save);
      const remove = document.createElement('button');
      remove.className = 'button bad';
      remove.textContent = '刪除角色';
      remove.addEventListener('click', () => {
        clearDeletedCharacterReferences(story, character.id);
        story.characters.splice(sourceIndex, 1);
        renderStories();
        refreshPreview().catch(console.error);
      });
      actions.appendChild(remove);
      card.appendChild(actions);
      dom.storyCharacterList.appendChild(card);
      bindCharacterPreviewDrag(preview, sourceIndex);
      });
  }

  function syncStoryCharacterPreview(index) {
    const story = currentStory();
    if (!story) return;
    const character = story.characters?.[index];
    if (!character) return;
    const preview = dom.storyCharacterList.querySelector(`[data-character-preview="${index}"]`);
    if (!preview) return;
    preview.innerHTML = renderCharacterPreviewMarkup(character);
    bindCharacterPreviewDrag(preview, index);
    const card = dom.storyCharacterList.querySelector(`[data-character-index="${index}"]`);
    if (card) {
      const title = card.querySelector('.story-title');
      const idPill = card.querySelector('.pill');
      const subtle = card.querySelector('.subtle');
      if (title) title.textContent = character.name;
      if (idPill) idPill.textContent = character.id;
      if (subtle) subtle.textContent = `分類：${character.category || 'supporting'} / 使用節點：${subtle.dataset.usageCount || '0'}`;
      syncCharacterFieldControl(card, 'avatarX', character.avatarX || 0);
      syncCharacterFieldControl(card, 'avatarY', character.avatarY || 0);
      syncCharacterFieldControl(card, 'avatarSize', character.avatarSize || 0);
      syncCharacterFieldControl(card, 'avatarScale', character.avatarScale ?? 1, (value) => `${Number(value).toFixed(2)}x`);
      syncCharacterFieldControl(card, 'avatarCenterX', character.avatarCenterX ?? 50, (value) => `${Math.round(value)}%`);
      syncCharacterFieldControl(card, 'avatarCenterY', character.avatarCenterY ?? 50, (value) => `${Math.round(value)}%`);
      syncCharacterFieldControl(card, 'nameplateX', character.nameplateX || 0);
      syncCharacterFieldControl(card, 'nameplateRightPercent', character.nameplateRightPercent || 0);
      syncCharacterFieldControl(card, 'nameplateY', character.nameplateY || 0);
      syncCharacterFieldControl(card, 'nameplateSize', character.nameplateSize || 'lg');
      syncCharacterFieldControl(card, 'nameplateColor', character.nameplateColor || '#56616A');
      syncCharacterFieldControl(card, 'nameplateTextColor', character.nameplateTextColor || '#FFFFFF');
    }
  }

  function syncCharacterFieldControl(card, field, value, formatValue) {
    const control = card.querySelector(`[data-character-field="${field}"]`);
    if (!control) return;
    if (control.matches('input, select, textarea')) {
      control.value = String(value);
      return;
    }
    const color = control.querySelector('input[type="color"]');
    const text = control.querySelector('input[type="text"]');
    if (color && text) {
      color.value = String(value);
      text.value = String(value);
      return;
    }
    const range = control.querySelector('input[type="range"]');
    if (range) {
      if (range.dataset.optionValues) {
        const values = range.dataset.optionValues.split(',');
        range.value = String(Math.max(0, values.indexOf(String(value))));
      } else {
        range.value = String(value);
      }
      const output = control.querySelector('.slider-value');
      if (output) {
        if (range.dataset.optionValues) {
          const values = range.dataset.optionValues.split(',');
          output.textContent = values[Number(range.value)] || String(value);
        } else {
          output.textContent = formatValue ? formatValue(Number(value)) : String(value);
        }
      }
    }
  }

  function previewLayoutScale() {
    return 1;
  }

  function characterPreviewImagePath() {
    const story = currentStory();
    if (!story) return '/public/story/01/image01.png';
    for (const node of story.nodes || []) {
      if (node.type === 'carousel' && Array.isArray(node.pages) && node.pages[0]?.imagePath) {
        return node.pages[0].imagePath;
      }
      if (node.imagePath) return node.imagePath;
      if (Array.isArray(node.pages) && node.pages[0]?.imagePath) return node.pages[0].imagePath;
    }
    return '/public/story/01/image01.png';
  }

  function renderCharacterPreviewMarkup(character) {
    const scale = previewLayoutScale();
    const avatarSize = Math.max(36, Math.round((character.avatarSize || 92) * scale));
    const avatarY = Math.round((character.avatarY || 332) * scale);
    const avatarX = Math.round((character.avatarX || 14) * scale);
    const nameplateY = Math.round((character.nameplateY || 346) * scale);
    const nameplateLeft = Math.round((character.nameplateX || 110) * scale);
    const nameplateRight = character.nameplateAnchor === 'right-percent'
      ? `${character.nameplateRightPercent || 30}%`
      : `${Math.round((character.nameplateX || 0) * scale)}px`;
    const nameplatePreset =
      state.globalSettings?.nameplateSizePresets?.[character.nameplateSize || 'lg']
      || state.globalSettings?.nameplateSizePresets?.lg
      || { paddingX: 22, paddingY: 12, cornerRadius: 14, label: 'lg' };
    const nameplateFontSize = nameplatePreset.label === 'xl' ? '19px' : nameplatePreset.label === 'md' ? '15px' : '17px';
    const heroImage = characterPreviewImagePath();
    const previewText = character.category === 'narrator'
      ? '這是旁白模擬。'
      : `「${character.name} 的對話會出現在這裡。」`;

    return `
      <div class="character-preview-stage">
        <img class="hero" src="${escapeHtml(heroImage)}" alt="" style="height:400px;width:100%;object-fit:cover;">
      </div>
      <div class="character-preview-body">
        <div class="character-preview-text">${escapeHtml(previewText)}</div>
      </div>
      <div class="character-preview-avatar" data-drag-avatar style="width:${avatarSize}px;height:${avatarSize}px;top:${avatarY}px;${character.placement === 'left' ? `left:${avatarX}px;` : `right:${avatarX}px;`}">
        <img src="${escapeHtml(character.avatarPath || '')}" alt="" style="object-position:${character.avatarCenterX ?? 50}% ${character.avatarCenterY ?? 50}%;transform:scale(${character.avatarScale ?? 1});">
      </div>
      <div class="plate" data-drag-plate style="top:${nameplateY}px;${character.placement === 'left' ? `left:${nameplateLeft}px;` : `right:${nameplateRight};`} background:${character.nameplateColor}; color:${character.nameplateTextColor};padding:${nameplatePreset.paddingY}px ${nameplatePreset.paddingX}px;border-radius:${nameplatePreset.cornerRadius}px;font-size:${nameplateFontSize};">
        ${escapeHtml(character.name)}
      </div>
    `;
  }

  function bindCharacterPreviewDrag(preview, index) {
    const avatar = preview.querySelector('[data-drag-avatar]');
    const plate = preview.querySelector('[data-drag-plate]');
    if (avatar) avatar.onpointerdown = (event) => {
      event.preventDefault();
      const story = currentStory();
      if (!story?.characters?.[index]) return;
      const character = story.characters[index];
      const scale = previewLayoutScale();
      const startX = event.clientX;
      const startY = event.clientY;
      const initialAvatarX = Number(character.avatarX || 0);
      const initialAvatarY = Number(character.avatarY || 0);

      const move = (moveEvent) => {
        const dx = (moveEvent.clientX - startX) / scale;
        const dy = (moveEvent.clientY - startY) / scale;
        if (character.placement === 'left') {
          character.avatarX = Math.max(0, Math.round(initialAvatarX + dx));
        } else {
          character.avatarX = Math.max(0, Math.round(initialAvatarX - dx));
        }
        character.avatarY = Math.max(0, Math.round(initialAvatarY + dy));
        syncStoryCharacterPreview(index);
        schedulePreview();
      };

      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    };

    if (plate) plate.onpointerdown = (event) => {
      event.preventDefault();
      event.stopPropagation();
      const story = currentStory();
      if (!story?.characters?.[index]) return;
      const character = story.characters[index];
      const scale = previewLayoutScale();
      const startX = event.clientX;
      const startY = event.clientY;
      const initialNameplateX = Number(character.nameplateX || 0);
      const initialNameplateY = Number(character.nameplateY || 0);

      const move = (moveEvent) => {
        const dx = (moveEvent.clientX - startX) / scale;
        const dy = (moveEvent.clientY - startY) / scale;
        character.nameplateAnchor = character.placement === 'left' ? 'left-fixed' : 'right-fixed';
        if (character.placement === 'left') {
          character.nameplateX = Math.max(0, Math.round(initialNameplateX + dx));
        } else {
          character.nameplateX = Math.max(0, Math.round(initialNameplateX - dx));
        }
        character.nameplateY = Math.max(0, Math.round(initialNameplateY + dy));
        syncStoryCharacterPreview(index);
        schedulePreview();
      };

      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };

      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    };
  }

  function renderDraftImport(story) {
    const draft = story.draftImport || { nodes: [], unboundRoles: [] };
    if (!draft.nodes.length) {
      dom.draftNodeList.innerHTML = '<div class="status-box">尚未產生 AI 草稿。</div>';
      return;
    }
    dom.draftNodeList.innerHTML = draft.nodes.map((node) => `
      <article class="story-card ${node.id === state.currentDraftNodeId ? 'active' : ''}" data-draft-node-id="${node.id}">
        <div class="row space-between">
          <div>
            <div class="story-title">${escapeHtml(node.title)}</div>
          <div class="subtle">${escapeHtml(describeNodeType(node.type))} / ${escapeHtml(node.id)} / ${escapeHtml(node.status || 'pending')}</div>
          </div>
          <span class="pill ${node.unboundCharacterName ? 'warn' : 'good'}">${node.unboundCharacterName ? `未綁定：${escapeHtml(node.unboundCharacterName)}` : '角色已綁定'}</span>
        </div>
        <div class="subtle">差異：${escapeHtml((node.diff?.changedFields || []).join(', ') || (node.diff?.isNew ? '新節點' : '無'))}</div>
        <div class="subtle">警示：${escapeHtml(describeDraftWarnings(node))}</div>
        <div class="actions" style="margin-top:10px;">
          <button class="button ghost" data-draft-action="reparse">重新解析</button>
          <button class="button secondary" data-draft-action="apply">套用此節點</button>
        </div>
      </article>
    `).join('');
    dom.draftNodeList.querySelectorAll('[data-draft-node-id]').forEach((card) => {
      const nodeId = card.dataset.draftNodeId;
      card.querySelector('[data-draft-action="reparse"]').addEventListener('click', async () => {
        const result = await api(`/stories/${story.id}/draft/reparse-node`, {
          method: 'POST',
          body: JSON.stringify({ nodeId })
        });
        state.storyDetail.story.draftImport = result.draftImport;
        state.currentDraftNodeId = nodeId;
        renderStories();
      });
      card.querySelector('[data-draft-action="apply"]').addEventListener('click', async () => {
        const result = await api(`/stories/${story.id}/draft/apply`, {
          method: 'POST',
          body: JSON.stringify({ nodeId })
        });
        state.storyDetail.story = result.story;
        renderStories();
        await refreshPreview();
      });
      card.addEventListener('click', (event) => {
        if (event.target.closest('button')) return;
        state.currentDraftNodeId = nodeId;
        renderDraftEditor(story);
      });
    });
  }

  function renderDraftEditor(story) {
    const draftNode = currentDraftNode();
    if (!draftNode) {
      dom.draftEditorEmpty.classList.remove('hidden');
      dom.draftEditorShell.classList.add('hidden');
      return;
    }
    dom.draftEditorEmpty.classList.add('hidden');
    dom.draftEditorShell.classList.remove('hidden');
    dom.draftEditorForm.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'draft-editor';
    const diff = document.createElement('div');
    diff.className = 'draft-diff';
    diff.textContent = draftNode.diff?.isNew
      ? '差異：這是新節點，尚未進入正式故事。'
      : `差異欄位：${(draftNode.diff?.changedFields || []).join(', ') || '無'}`;
    wrap.appendChild(diff);

    const grid = document.createElement('div');
    grid.className = 'field-grid';
    grid.append(
      createField('節點標題', input(draftNode.title, (value) => updateDraftNodeField('title', value))),
      createField('卡片類型', select([
        ['dialogue', '對話卡'],
        ['narration', '旁白卡'],
        ['choice', '選項卡'],
        ['carousel', '多頁訊息']
      ], draftNode.type, (value) => updateDraftNodeField('type', value))),
      createField('主講角色', select(characterOptions(true), draftNode.speakerCharacterId || '', (value) => updateDraftNodeField('speakerCharacterId', value))),
      createField('陪襯角色', select(characterOptions(true), draftNode.companionCharacterId || '', (value) => updateDraftNodeField('companionCharacterId', value))),
      createField('下一節點', select(nextNodeOptions(story), draftNode.nextNodeId || '', (value) => updateDraftNodeField('nextNodeId', value))),
      createField('圖片', imageInput(draftNode.imagePath, (value) => updateDraftNodeField('imagePath', value))),
      createField('中文字體', select(fontOptions(), draftNode.previewFont || 'default', (value) => updateDraftNodeField('previewFont', value)))
    );
    grid.appendChild(createField('文字', textarea(draftNode.text || '', (value) => updateDraftNodeField('text', value)), 'single'));
    if (draftNode.type === 'choice') {
      grid.appendChild(createField('提問', textarea(draftNode.prompt || '', (value) => updateDraftNodeField('prompt', value)), 'single'));
    }
    wrap.appendChild(grid);

    if (draftNode.type === 'carousel' || draftNode.type === 'choice') {
      const pagesWrap = document.createElement('div');
      pagesWrap.className = 'stack';
      const title = document.createElement('h3');
      title.textContent = '草稿頁面校正';
      pagesWrap.appendChild(title);
      (draftNode.pages || []).forEach((page, pageIndex) => {
        const section = document.createElement('section');
        section.className = 'panel';
        section.style.padding = '14px';
        const isTextOnlyNarration = isTextTriptychCard(page.cardType || 'dialogue');
        const triptychSegments = splitTriptychText(page.text || '');
        const pageGrid = document.createElement('div');
        pageGrid.className = 'field-grid';
        pageGrid.append(
          createField('頁面標題', input(page.title || '', (value) => updateDraftPageField(pageIndex, 'title', value))),
          createField('頁面卡型', select([
            ['dialogue', '對話卡'],
            ['narration', '旁白卡'],
            ['narration-triptych', '純文字三段旁白卡']
          ], page.cardType || 'dialogue', (value) => updateDraftPageField(pageIndex, 'cardType', value))),
          createField('底圖', imageInput(page.imagePath, (value) => updateDraftPageField(pageIndex, 'imagePath', value))),
          createField('底圖透明度', decimalInput(page.heroImageOpacity ?? 1, 0, 1, 0.05, (value) => updateDraftPageField(pageIndex, 'heroImageOpacity', value))),
          createField('底圖縮放', rangeInput(page.heroImageScale ?? 1, 1, 2.5, 0.05, (value) => updateDraftPageField(pageIndex, 'heroImageScale', value), (value) => `${Number(value).toFixed(2)}x`)),
          createField('中文字體', select(fontOptions(), page.previewFont || 'default', (value) => updateDraftPageField(pageIndex, 'previewFont', value))),
          createField('字級', select(textSizeOptions(), page.lineTextSize || 'lg', (value) => updateDraftPageField(pageIndex, 'lineTextSize', value))),
          createField('文字顏色', colorInput(page.lineTextColor || '#2D241B', (value) => updateDraftPageField(pageIndex, 'lineTextColor', value)))
        );
        if ((page.cardType || 'dialogue') === 'dialogue') {
          pageGrid.append(
            createField('主講角色', select(characterOptions(true), page.speakerCharacterId || '', (value) => updateDraftPageField(pageIndex, 'speakerCharacterId', value))),
            createField('陪襯角色', select(characterOptions(true), page.companionCharacterId || '', (value) => updateDraftPageField(pageIndex, 'companionCharacterId', value)))
          );
        }
        if (isTextOnlyNarration) {
          ['左段文字', '中段文字', '右段文字'].forEach((label, segmentIndex) => {
            pageGrid.appendChild(createField(label, textarea(triptychSegments[segmentIndex] || '', (value) => {
              const nextSegments = splitTriptychText(page.text || '');
              nextSegments[segmentIndex] = value;
              updateDraftPageField(pageIndex, 'text', composeTriptychText(nextSegments));
            }), 'single'));
          });
        } else {
          pageGrid.appendChild(createField('頁面文字', textarea(page.text || '', (value) => updateDraftPageField(pageIndex, 'text', value)), 'single'));
        }
        section.appendChild(pageGrid);
        if (isTextOnlyNarration) {
          const hint = document.createElement('div');
          hint.className = 'subtle';
          hint.textContent = '這張卡會把三段文字由左至右排成三欄，底圖與透明度也會一起進正式輸出。';
          section.appendChild(hint);
        }
        pagesWrap.appendChild(section);
      });
      wrap.appendChild(pagesWrap);
    }

    if (draftNode.type === 'choice') {
      const choiceWrap = document.createElement('div');
      choiceWrap.className = 'panel';
      choiceWrap.style.padding = '14px';
      const choiceGrid = document.createElement('div');
      choiceGrid.className = 'field-grid';
      choiceGrid.append(
        createField('選項 A', input(draftNode.optionA?.label || '', (value) => updateDraftChoiceField('optionA', 'label', value))),
        createField('選項 A 下一節點', select(nextNodeOptions(story), draftNode.optionA?.nextNodeId || '', (value) => updateDraftChoiceField('optionA', 'nextNodeId', value))),
        createField('選項 A 回饋', textarea(draftNode.optionA?.feedback || '', (value) => updateDraftChoiceField('optionA', 'feedback', value))),
        createField('選項 B', input(draftNode.optionB?.label || '', (value) => updateDraftChoiceField('optionB', 'label', value))),
        createField('選項 B 下一節點', select(nextNodeOptions(story), draftNode.optionB?.nextNodeId || '', (value) => updateDraftChoiceField('optionB', 'nextNodeId', value))),
        createField('選項 B 回饋', textarea(draftNode.optionB?.feedback || '', (value) => updateDraftChoiceField('optionB', 'feedback', value)))
      );
      choiceWrap.appendChild(choiceGrid);
      wrap.appendChild(choiceWrap);
    }

    if (draftNode.unboundCharacterName) {
      const bindWrap = document.createElement('div');
      bindWrap.className = 'panel';
      bindWrap.style.padding = '14px';
      const bindGrid = document.createElement('div');
      bindGrid.className = 'field-grid';
      const bindSelect = select(characterOptions(true), '', () => {});
      const bindField = createField(`未綁定角色：${draftNode.unboundCharacterName}`, bindSelect);
      bindGrid.appendChild(bindField);
      bindWrap.appendChild(bindGrid);
      const bindButton = document.createElement('button');
      bindButton.className = 'button warn';
      bindButton.textContent = '綁定到這個角色';
      bindButton.addEventListener('click', () => {
        if (!bindSelect.value) return;
        updateDraftNodeField('speakerCharacterId', bindSelect.value);
        updateDraftNodeField('unboundCharacterName', '');
      });
      bindWrap.appendChild(bindButton);
      wrap.appendChild(bindWrap);
    }

    const quick = document.createElement('div');
    quick.className = 'actions';
    [
      ['快速改為對話卡', () => updateDraftNodeField('type', 'dialogue')],
      ['快速改為旁白卡', () => updateDraftNodeField('type', 'narration')],
      ['快速改為多頁訊息', () => updateDraftNodeField('type', 'carousel')],
      ['套用此節點到正式故事', async () => {
        const result = await api(`/stories/${story.id}/draft/apply`, {
          method: 'POST',
          body: JSON.stringify({ nodeId: draftNode.id })
        });
        state.storyDetail.story = result.story;
        renderStories();
        await refreshPreview();
      }]
    ].forEach(([label, handler], index) => {
      const button = document.createElement('button');
      button.className = `button ${index === 3 ? 'good' : 'secondary'}`;
      button.textContent = label;
      button.addEventListener('click', handler);
      quick.appendChild(button);
    });
    wrap.appendChild(quick);
    dom.draftEditorForm.appendChild(wrap);
  }

  function getPrimaryNextNodeId(node) {
    if (node.nextNodeId) return node.nextNodeId;
    if (node.type === 'choice') {
      return node.optionB?.nextNodeId || node.optionA?.nextNodeId || '';
    }
    return '';
  }

  function renderNodeGraph(story) {
    const rawNodes = story?.nodes || [];
    if (!rawNodes.length) {
      return '<div class="status-box">尚未建立節點。</div>';
    }

    const graph = buildGraphEntries(story);
    const placed = buildGraphPlacements(story, graph.entries);
    const runtimeById = new Map(graph.entries.map((entry) => [entry.graphId || entry.id, entry]));
    const virtualBySource = new Map();
    graph.entries.filter((entry) => entry.virtual).forEach((entry) => {
      const key = entry.sourceNodeId;
      const bucket = virtualBySource.get(key) || [];
      bucket.push(entry);
      virtualBySource.set(key, bucket);
    });

    const deadEnds = [];
    const edges = [];
    rawNodes.forEach((node) => {
      const fromPos = placed.get(node.id);
      if (!fromPos) return;
      const virtuals = virtualBySource.get(node.id) || [];

      if (node.type !== 'choice') {
        const transition = virtuals[0] || null;
        if (transition) {
          edges.push({ from: node.id, to: transition.graphId || transition.id, style: 'solid', label: '過場' });
          if (transition.nextNodeId && placed.has(transition.nextNodeId)) {
            edges.push({ from: transition.graphId || transition.id, to: transition.nextNodeId, style: 'solid', label: '續接' });
          }
        } else if (node.nextNodeId && placed.has(node.nextNodeId)) {
          edges.push({ from: node.id, to: node.nextNodeId, style: 'solid', label: '主線' });
        } else if (!node.nextNodeId) {
          deadEnds.push({
            id: `${node.id}-dead`,
            title: '未設定下一幕',
            type: 'dead-end',
            x: fromPos.x + 210,
            y: fromPos.y + 30
          });
          edges.push({ from: node.id, to: `${node.id}-dead`, style: 'dashed', label: 'dead' });
        }
      }

      if (node.type === 'choice') {
        const primary = getPrimaryNextNodeId(node);
        [
          { key: 'A', target: node.optionA?.nextNodeId || '', label: node.optionA?.label || 'A' },
          { key: 'B', target: node.optionB?.nextNodeId || '', label: node.optionB?.label || 'B' }
        ].forEach((option, optionIndex) => {
          const virtual = virtuals.find((entry) => entry.branch === option.key) || null;
          if (virtual) {
            edges.push({ from: node.id, to: virtual.graphId || virtual.id, style: option.target === primary ? 'solid' : 'dashed', label: option.key });
            if (virtual.nextNodeId && placed.has(virtual.nextNodeId)) {
              edges.push({ from: virtual.graphId || virtual.id, to: virtual.nextNodeId, style: option.target === primary ? 'solid' : 'dashed', label: `${option.key} 續接` });
            }
            return;
          }
          if (!option.target) {
            const deadId = `${node.id}-${option.key}-dead`;
            const deadPos = {
              x: fromPos.x + 190,
              y: fromPos.y + 146 + optionIndex * 110
            };
            deadEnds.push({
              id: deadId,
              title: `Dead End ${option.key}`,
              type: 'dead-end',
              x: deadPos.x,
              y: deadPos.y
            });
            edges.push({ from: node.id, to: deadId, style: 'dashed', label: `${option.key} dead` });
            return;
          }
          const style = option.target === primary ? 'solid' : 'dashed';
          if (placed.has(option.target)) {
            edges.push({ from: node.id, to: option.target, style, label: option.key });
          }
        });
      }
    });

    const cardWidth = 220;
    const cardHeight = 132;
    const maxRight = Math.max(
      ...Array.from(placed.values()).map((pos) => pos.x + cardWidth),
      ...deadEnds.map((pos) => pos.x + 180),
      1200
    );
    const maxBottom = Math.max(
      ...Array.from(placed.values()).map((pos) => pos.y + cardHeight),
      ...deadEnds.map((pos) => pos.y + 80),
      420
    );

    const allPositions = new Map();
    graph.entries.forEach((entry) => {
      const pos = placed.get(entry.graphId || entry.id);
      if (pos) {
        allPositions.set(entry.graphId || entry.id, {
          x: pos.x,
          y: pos.y,
          width: entry.virtual ? 140 : cardWidth,
          height: entry.virtual ? 88 : cardHeight
        });
      }
    });
    deadEnds.forEach((entry) => {
      allPositions.set(entry.id, { x: entry.x, y: entry.y, width: 140, height: 72 });
    });

    return `
      <div class="graph-canvas" style="width:${maxRight + 80}px;height:${maxBottom + 40}px;">
        <svg class="graph-svg" viewBox="0 0 ${maxRight + 80} ${maxBottom + 40}" preserveAspectRatio="none">
          <defs>
            <marker id="graph-arrow-head" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill="#C58B67"></path>
            </marker>
            <marker id="graph-arrow-head-dashed" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
              <path d="M0,0 L10,5 L0,10 z" fill="#BCA890"></path>
            </marker>
          </defs>
          ${edges.map((edge) => {
            const from = allPositions.get(edge.from);
            const to = allPositions.get(edge.to);
            if (!from || !to) return '';
            const x1 = from.x + from.width;
            const y1 = from.y + from.height / 2;
            const x2 = to.x;
            const y2 = to.y + to.height / 2;
            const cx1 = x1 + 54;
            const cx2 = x2 - 54;
            const stroke = edge.style === 'dashed' ? '#BCA890' : '#C58B67';
            const marker = edge.style === 'dashed' ? 'graph-arrow-head-dashed' : 'graph-arrow-head';
            const dash = edge.style === 'dashed' ? '10 10' : '0';
            return `
              <path d="M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}"
                fill="none"
                stroke="${stroke}"
                stroke-width="4"
                stroke-dasharray="${dash}"
                marker-end="url(#${marker})"></path>
              <text class="graph-link-label" x="${(x1 + x2) / 2}" y="${Math.min(y1, y2) - 10}" text-anchor="middle">${escapeHtml(edge.label)}</text>
            `;
          }).join('')}
        </svg>
        <div class="graph-node-layer">
          ${(() => {
            let actualIndex = 0;
            return graph.entries.map((entry) => {
              const nodeIndex = entry.virtual ? actualIndex : ++actualIndex;
              const pos = placed.get(entry.graphId || entry.id);
              return renderNodeCard(entry, pos, nodeIndex, graph);
            }).join('');
          })()}
          ${deadEnds.map((node) => `
            <article class="graph-node graph-placed" style="left:${node.x}px;top:${node.y}px;width:140px;min-width:140px;background:#fff7f1;border-style:dashed;border-color:#d8bda3;">
              <div class="node-title">${escapeHtml(node.title)}</div>
              <div class="subtle">沒有連到下一節點</div>
            </article>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderNodeCard(node, position = { x: 0, y: 0 }, index = 0, graph = {}) {
    const isVirtual = Boolean(node.virtual);
    const links = [];
    if (!isVirtual && node.nextNodeId) links.push(`→ ${node.nextNodeId}`);
    if (!isVirtual && node.optionA?.nextNodeId) links.push(`A → ${node.optionA.nextNodeId}`);
    if (!isVirtual && node.optionB?.nextNodeId) links.push(`B → ${node.optionB.nextNodeId}`);
    if (isVirtual && node.nextNodeId) links.push(`→ ${node.nextNodeId}`);
    const summary = isVirtual
      ? (node.summary || node.text || '尚未填寫過場文案')
      : node.type === 'choice'
        ? (node.prompt || '在這裡輸入選項提問。')
        : (node.text || '尚未填寫內容');
    const selected = isVirtual
      ? state.currentVirtualTransitionId === (node.graphId || node.id)
      : node.id === state.currentNodeId && !state.currentVirtualTransitionId;
    const classes = [
      'graph-node',
      'graph-placed',
      'node-card',
      `node-type-${escapeHtml(node.type)}`,
      selected ? 'active selected' : '',
      isVirtual ? 'virtual-transition' : '',
      node.unreachable ? 'unreachable' : '',
      !isVirtual && graph.deadEndIds?.has?.(node.id) ? 'dangling' : ''
    ].filter(Boolean).join(' ');
    if (isVirtual) {
      return `
        <article class="${classes}" data-virtual-transition-id="${node.graphId || node.id}" data-node-id="${node.sourceNodeId}" style="left:${position.x}px;top:${position.y}px;width:140px;min-width:140px;background:#fff7f1;border-style:dashed;border-color:#d8bda3;">
          <div class="row space-between">
            <div class="node-title">${escapeHtml(node.position === 'before' ? '開頭過場' : '過場映射')}</div>
            <span class="pill warn">映射</span>
          </div>
          <div class="subtle">${escapeHtml(node.branch ? `來自選項 ${node.branch}` : node.position === 'before' ? '來自節點開頭' : '來自下一幕過場')}</div>
          <div class="graph-node-summary">${escapeHtml(summary.slice(0, 20))}</div>
          <div class="graph-links">${links.length ? links.map((link) => `<span class="pill">${escapeHtml(link)}</span>`).join('') : '<span class="subtle">尚未連線</span>'}</div>
        </article>
      `;
    }
    const nodeLabel = node.type === 'choice'
      ? '決策節點'
      : node.type === 'carousel'
        ? '多頁內容'
        : '內容節點';
    return `
      <article class="${classes}" data-node-id="${node.id}" style="left:${position.x}px;top:${position.y}px;">
        <div class="row space-between">
          <div class="node-title">ACT ${index + 1}</div>
          <span class="pill">${escapeHtml(node.type)}</span>
        </div>
        <div class="subtle">${escapeHtml(node.unreachable ? 'unreachable' : nodeLabel)}</div>
        <div class="graph-node-summary">${escapeHtml(summary.slice(0, 54))}</div>
        <div class="graph-links">${links.length ? links.map((link) => `<span class="pill">${escapeHtml(link)}</span>`).join('') : '<span class="subtle">尚未連線</span>'}</div>
        <div class="graph-node-actions">
          <button class="graph-node-action" data-node-action="insert-dialogue" data-node-id="${node.id}">＋對話</button>
          <button class="graph-node-action" data-node-action="insert-narration" data-node-id="${node.id}">＋旁白</button>
          <button class="graph-node-action" data-node-action="insert-choice" data-node-id="${node.id}">＋選項</button>
          <button class="graph-node-action" data-node-action="insert-transition" data-node-id="${node.id}">編輯過場</button>
        </div>
        <div class="graph-node-actions">
          <button class="graph-node-action" data-node-action="duplicate" data-node-id="${node.id}">複製</button>
          <button class="graph-node-action" data-node-action="move-prev" data-node-id="${node.id}">前移</button>
          <button class="graph-node-action" data-node-action="move-next" data-node-id="${node.id}">後移</button>
          <button class="graph-node-action delete" data-node-action="delete" data-node-id="${node.id}">刪除</button>
        </div>
      </article>
    `;
  }

  function renderNodeEditor() {
    const node = currentNode();
    const story = currentStory();
    if (!node || !story) {
      dom.nodeEditorEmpty.classList.remove('hidden');
      dom.nodeEditorShell.classList.add('hidden');
      return;
    }
    dom.nodeEditorEmpty.classList.add('hidden');
    dom.nodeEditorShell.classList.remove('hidden');
    dom.nodeEditorForm.innerHTML = '';

    const context = currentPreviewContext();
    const wrapper = document.createElement('div');
    wrapper.className = 'stack';
    const virtualTransition = currentVirtualTransition();
    const scope = describeEditorScope(node, context, virtualTransition);

    const header = document.createElement('div');
    header.className = 'editor-selection';
    header.innerHTML = `
      <div>
        <div class="editor-breadcrumb">${scope.breadcrumb.map((part) => `<span>${escapeHtml(part)}</span>`).join('')}</div>
        <div class="editor-selection-title">${escapeHtml(scope.title)}</div>
        <div class="editor-selection-meta">${escapeHtml(scope.meta)}</div>
        <div class="editor-selection-scope">${escapeHtml(scope.scope)}</div>
        <div class="graph-links" style="margin-top:8px;">
          ${scope.pills.map((pill, index) => `<span class="pill ${index === 0 ? 'warn' : ''}">${escapeHtml(pill)}</span>`).join('')}
          <span class="pill">${escapeHtml(node.id)}</span>
        </div>
      </div>
    `;
    const saveButton = document.createElement('button');
    saveButton.className = 'button';
    saveButton.textContent = '儲存整個故事';
    saveButton.addEventListener('click', handleSaveStory);
    const renderBlocker = currentRenderBlocker();
    saveButton.disabled = Boolean(renderBlocker);
    saveButton.title = renderBlocker || '儲存整個故事，包含目前節點、頁面與過場映射。';
    header.appendChild(saveButton);
    wrapper.appendChild(header);

    if (virtualTransition && virtualTransition.sourceNodeId === node.id) {
      wrapper.appendChild(renderVirtualTransitionInspector(virtualTransition, story));
    }

    if (Array.isArray(node.pages) && node.pages.length) {
      wrapper.appendChild(renderPageManager(node, context));
    }

    if (context.targetType === 'page' && context.page) {
      wrapper.appendChild(renderSelectedPageEditor(node, context.page, context.pageIndex));
    } else {
      wrapper.appendChild(renderFieldGrid(node, story));
      if (context.targetType === 'choice') {
        wrapper.appendChild(renderChoiceEditor(node, story));
      }
    }
    dom.nodeEditorForm.appendChild(wrapper);
  }

  function renderVirtualTransitionInspector(entry, story) {
    const node = currentNode();
    const section = document.createElement('section');
    section.className = 'panel';
    section.style.padding = '14px';
    section.appendChild(sectionHeading('目前選到的過場映射'));
    const grid = document.createElement('div');
    grid.className = 'field-grid';
    const sourceField = createField('來源', input(entry.branch ? `${entry.sourceNodeId} / ${entry.branch}` : entry.sourceNodeId, () => {}));
    const nextField = entry.branch
      ? createField(
          '下一節點',
          select(nextNodeOptions(story), node?.[entry.branch === 'A' ? 'optionA' : 'optionB']?.nextNodeId || '', (value) => {
            updateChoiceField(entry.branch === 'A' ? 'optionA' : 'optionB', 'nextNodeId', value);
          })
        )
      : entry.position === 'before'
        ? null
      : createField(
          '下一節點',
          select(nextNodeOptions(story), node?.nextNodeId || '', (value) => updateNodeField('nextNodeId', value))
        );
    const contentField = entry.branch
      ? createField(
          '過場內容',
          textarea(node?.[entry.branch === 'A' ? 'optionA' : 'optionB']?.feedback || '', (value) => {
            updateChoiceField(entry.branch === 'A' ? 'optionA' : 'optionB', 'feedback', value);
          }),
          'single'
        )
      : entry.position === 'before'
        ? createField(
            '過場內容',
            textarea(node?.introTransitionText || '', (value) => updateNodeField('introTransitionText', value)),
            'single'
          )
      : createField(
          '過場內容',
          textarea(node?.transitionText || '', (value) => updateNodeField('transitionText', value)),
          'single'
        );
    contentField.dataset.transitionField = entry.branch
      ? `choice-${entry.branch.toLowerCase()}`
      : entry.position === 'before'
        ? 'intro'
        : 'node';
    const sourceInput = sourceField.querySelector('input');
    if (sourceInput) {
      sourceInput.readOnly = true;
      sourceInput.disabled = true;
    }
    grid.append(sourceField);
    if (nextField) grid.append(nextField);
    grid.append(contentField);
    section.appendChild(grid);
    const tip = document.createElement('div');
    tip.className = 'subtle';
    tip.textContent = entry.branch
      ? `這不是獨立節點。你現在改的是「選項 ${entry.branch}」的過場映射，內容會回寫到原本選項欄位。`
      : entry.position === 'before'
        ? '這不是獨立節點。這段會在本節點第一張卡片前送出。'
        : '這不是獨立節點。你現在改的是「下一幕過場映射」，內容會回寫到目前節點。';
    section.appendChild(tip);
    return section;
  }

  function renderFieldGrid(node, story) {
    const wrap = document.createElement('div');
    wrap.className = 'stack';
    if (node.type === 'dialogue' && !node.speakerCharacterId) {
      wrap.appendChild(createBlockingNotice('這張對話卡尚未設定主講角色，已禁止預覽與儲存。'));
    }
    const container = document.createElement('div');
    container.className = 'field-grid';
    container.append(
      createField('節點標題', input(node.title, (value) => updateNodeField('title', value))),
      createField('卡片類型', select([
        ['dialogue', '對話卡'],
        ['narration', '旁白卡'],
        ['choice', '選項卡'],
        ['carousel', '多頁訊息']
      ], node.type, (value) => updateNodeType(node, value))),
      createField('下一節點', select(nextNodeOptions(story), node.nextNodeId || '', (value) => updateNodeField('nextNodeId', value))),
      createField('中文字體', select(fontOptions(), node.previewFont || 'default', (value) => updateNodeField('previewFont', value))),
      createField('LINE 字級', select(textSizeOptions(), node.lineTextSize || 'lg', (value) => updateNodeField('lineTextSize', value))),
      createField('文字顏色', colorInput(node.lineTextColor || '#2D241B', (value) => updateNodeField('lineTextColor', value))),
      createField('繼續按鈕文字', input(node.continueLabel || '下一步', (value) => updateNodeField('continueLabel', value))),
      createField('圖上位置 X', numberInput(node.position?.x || 0, (value) => updateNodePosition('x', value))),
      createField('圖上位置 Y', numberInput(node.position?.y || 0, (value) => updateNodePosition('y', value)))
    );
    if (node.type !== 'transition') {
      container.append(
        createField('圖片', imageInput(node.imagePath, (value) => updateNodeField('imagePath', value))),
        createField('大圖透明度', decimalInput(node.heroImageOpacity ?? 1, 0, 1, 0.05, (value) => updateNodeField('heroImageOpacity', value))),
        createField('大圖縮放', rangeInput(node.heroImageScale ?? 1, 1, 2.5, 0.05, (value) => updateNodeField('heroImageScale', value), (value) => `${Number(value).toFixed(2)}x`))
      );
    }
    if (node.type === 'dialogue' || node.type === 'choice' || node.type === 'carousel') {
      container.append(
        createField('姓名牌大小', nameplateSizeSlider(node.nameplateSize || 'lg', (value) => updateNodeField('nameplateSize', value))),
        createField('主講角色', select(characterOptions(true), node.speakerCharacterId || '', (value) => updateNodeField('speakerCharacterId', value))),
        createField('陪襯角色', select(characterOptions(true), node.companionCharacterId || '', (value) => updateNodeField('companionCharacterId', value)))
      );
    }
    container.appendChild(createField('文字', textarea(node.text || '', (value) => updateNodeField('text', value)), 'single'));
    if (node.type !== 'transition') {
      const introField = createField('開場過場文案', textarea(node.introTransitionText || '', (value) => updateNodeField('introTransitionText', value)), 'single');
      introField.dataset.transitionField = 'intro';
      container.appendChild(introField);
    }
    if (node.type !== 'choice') {
      const transitionField = createField('下一幕過場文案', textarea(node.transitionText || '', (value) => updateNodeField('transitionText', value)), 'single');
      transitionField.dataset.transitionField = 'node';
      container.appendChild(transitionField);
    }
    wrap.appendChild(container);
    return wrap;
  }

  function renderPageManager(node, context) {
    const section = document.createElement('section');
    section.className = 'panel';
    section.style.padding = '14px';

    const header = document.createElement('div');
    header.className = 'row space-between';
    header.innerHTML = `
      <div>
        <h3 style="margin:0;">多頁管理</h3>
        <div class="subtle">共 ${node.pages.length} 頁${node.type === 'choice' ? '，最後一張為選項卡' : ''}</div>
      </div>
    `;

    const actions = document.createElement('div');
    actions.className = 'actions';

    const addButton = document.createElement('button');
    addButton.className = 'button secondary';
    addButton.textContent = '新增下一頁';
    addButton.title = '在目前頁面後方插入一頁。';
    addButton.addEventListener('click', () => insertNodePage(node, context.pageIndex));
    actions.appendChild(addButton);

    if (context.pageIndex >= 0) {
      const duplicateButton = document.createElement('button');
      duplicateButton.className = 'button secondary';
      duplicateButton.textContent = '複製這頁';
      duplicateButton.title = '複製目前頁面，在後方建立一頁可直接修改的新版本。';
      duplicateButton.addEventListener('click', () => duplicateNodePage(node, context.pageIndex));
      actions.appendChild(duplicateButton);
    }

    if (context.pageIndex >= 0) {
      const movePrevButton = document.createElement('button');
      movePrevButton.className = 'button ghost';
      movePrevButton.textContent = '上移';
      movePrevButton.disabled = context.pageIndex === 0;
      movePrevButton.title = context.pageIndex === 0 ? '已經是第一頁，無法再往前。' : '把目前頁面往前移一格。';
      movePrevButton.addEventListener('click', () => moveNodePage(node, context.pageIndex, -1));
      actions.appendChild(movePrevButton);

      const moveNextButton = document.createElement('button');
      moveNextButton.className = 'button ghost';
      moveNextButton.textContent = '下移';
      moveNextButton.disabled = context.pageIndex >= node.pages.length - 1;
      moveNextButton.title = context.pageIndex >= node.pages.length - 1 ? '已經是最後一頁，無法再往後。' : '把目前頁面往後移一格。';
      moveNextButton.addEventListener('click', () => moveNodePage(node, context.pageIndex, 1));
      actions.appendChild(moveNextButton);

      const deleteButton = document.createElement('button');
      deleteButton.className = 'button ghost';
      deleteButton.textContent = '刪除這頁';
      deleteButton.title = '刪除目前頁面。';
      deleteButton.addEventListener('click', () => deleteNodePage(node, context.pageIndex));
      actions.appendChild(deleteButton);
    }

    header.appendChild(actions);
    section.appendChild(header);

    const pager = document.createElement('div');
    pager.className = 'actions';
    pager.style.flexWrap = 'wrap';
    pager.style.marginTop = '14px';
    node.pages.forEach((page, index) => {
      const button = document.createElement('button');
      button.className = `button ${context.pageIndex === index ? 'good' : 'ghost'}`;
      button.textContent = page.title || `第 ${index + 1} 頁`;
      button.addEventListener('click', () => {
        state.previewIndex = index;
        renderPreviewOnly();
        renderNodeEditor();
      });
      pager.appendChild(button);
    });

    if (node.type === 'choice') {
      const choiceButton = document.createElement('button');
      choiceButton.className = `button ${context.targetType === 'choice' ? 'good' : 'ghost'}`;
      choiceButton.textContent = '選項卡';
      choiceButton.addEventListener('click', () => {
        state.previewIndex = node.pages.length;
        renderPreviewOnly();
        renderNodeEditor();
      });
      pager.appendChild(choiceButton);
    }

    section.appendChild(pager);
    return section;
  }

  function renderSelectedPageEditor(node, page, pageIndex) {
    const wrap = document.createElement('div');
    wrap.className = 'stack';
    const isTextOnlyNarration = isTextTriptychCard(page.cardType || 'dialogue');
    const triptychSegments = splitTriptychText(page.text || '');

    const section = document.createElement('section');
    section.className = 'panel';
    section.style.padding = '14px';
    const heading = document.createElement('div');
    heading.className = 'row space-between';
    heading.innerHTML = `<h3>${escapeHtml(page.title || `第 ${pageIndex + 1} 頁`)}</h3>`;
    const saveButton = document.createElement('button');
    saveButton.className = 'button good';
    saveButton.textContent = '儲存整個故事';
    saveButton.addEventListener('click', handleSaveStory);
    const renderBlocker = currentRenderBlocker();
    saveButton.disabled = Boolean(renderBlocker);
    saveButton.title = renderBlocker || '儲存整個故事，包含目前頁面的修改。';
    heading.appendChild(saveButton);
    section.appendChild(heading);

    if (page.cardType === 'dialogue' && !page.speakerCharacterId) {
      section.appendChild(createBlockingNotice('這張對話頁尚未設定主講角色，已禁止預覽與儲存。'));
    }

    const grid = document.createElement('div');
    grid.className = 'field-grid';
    grid.append(
      createField('頁面標題', input(page.title || '', (value) => updatePageField(node, pageIndex, 'title', value))),
      createField('頁面卡型', select([
        ['dialogue', '對話卡'],
        ['narration', '旁白卡'],
        ['narration-triptych', '純文字三段旁白卡']
      ], page.cardType || 'dialogue', (value) => updatePageField(node, pageIndex, 'cardType', value))),
      createField('底圖', imageInput(page.imagePath, (value) => updatePageField(node, pageIndex, 'imagePath', value))),
      createField('底圖透明度', decimalInput(page.heroImageOpacity ?? 1, 0, 1, 0.05, (value) => updatePageField(node, pageIndex, 'heroImageOpacity', value))),
      createField('底圖縮放', rangeInput(page.heroImageScale ?? 1, 1, 2.5, 0.05, (value) => updatePageField(node, pageIndex, 'heroImageScale', value), (value) => `${Number(value).toFixed(2)}x`)),
      createField('中文字體', select(fontOptions(), page.previewFont || 'default', (value) => updatePageField(node, pageIndex, 'previewFont', value))),
      createField('LINE 字級', select(textSizeOptions(), page.lineTextSize || 'lg', (value) => updatePageField(node, pageIndex, 'lineTextSize', value))),
      createField('文字顏色', colorInput(page.lineTextColor || '#2D241B', (value) => updatePageField(node, pageIndex, 'lineTextColor', value)))
    );
    if (page.cardType === 'dialogue') {
      grid.append(
        createField('主講角色', select(characterOptions(true), page.speakerCharacterId || '', (value) => updatePageField(node, pageIndex, 'speakerCharacterId', value))),
        createField('陪襯角色', select(characterOptions(true), page.companionCharacterId || '', (value) => updatePageField(node, pageIndex, 'companionCharacterId', value))),
        createField('姓名牌大小', nameplateSizeSlider(page.nameplateSize || 'lg', (value) => updatePageField(node, pageIndex, 'nameplateSize', value)))
      );
    }
    if (isTextOnlyNarration) {
      ['左段文字', '中段文字', '右段文字'].forEach((label, segmentIndex) => {
        grid.appendChild(createField(label, textarea(triptychSegments[segmentIndex] || '', (value) => {
          const nextSegments = splitTriptychText(node.pages[pageIndex].text || '');
          nextSegments[segmentIndex] = value;
          updatePageField(node, pageIndex, 'text', composeTriptychText(nextSegments));
        }), 'single'));
      });
    } else {
      grid.appendChild(createField('頁面文字', textarea(page.text || '', (value) => updatePageField(node, pageIndex, 'text', value)), 'single'));
    }
    section.appendChild(grid);
    if (isTextOnlyNarration) {
      const hint = document.createElement('div');
      hint.className = 'subtle';
      hint.textContent = '這張卡是純文字三段旁白卡，你可以分別設定三段文字、字體、字級、底圖與底圖透明度。';
      section.appendChild(hint);
    }
    wrap.appendChild(section);

    return wrap;
  }

  function renderChoiceEditor(node, story) {
    const container = document.createElement('div');
    container.className = 'stack';

    const promptPanel = document.createElement('section');
    promptPanel.className = 'panel';
    promptPanel.style.padding = '14px';
    const promptHeader = document.createElement('div');
    promptHeader.className = 'row space-between';
    promptHeader.appendChild(sectionHeading('選項提問'));
    const saveButton = document.createElement('button');
    saveButton.className = 'button good';
    saveButton.textContent = '儲存整個故事';
    saveButton.addEventListener('click', handleSaveStory);
    const renderBlocker = currentRenderBlocker();
    saveButton.disabled = Boolean(renderBlocker);
    saveButton.title = renderBlocker || '儲存整個故事，包含目前選項卡與分支設定。';
    promptHeader.appendChild(saveButton);
    promptPanel.appendChild(promptHeader);
    const promptGrid = document.createElement('div');
    promptGrid.className = 'field-grid single';
    promptGrid.appendChild(createField('問題內容', textarea(node.prompt || '', (value) => updateNodeField('prompt', value)), 'single'));
    promptPanel.appendChild(promptGrid);
    container.appendChild(promptPanel);

    const optionsGrid = document.createElement('div');
    optionsGrid.className = 'field-grid';

    const optionAPanel = document.createElement('section');
    optionAPanel.className = 'panel';
    optionAPanel.style.padding = '14px';
    optionAPanel.appendChild(sectionHeading('選項 A'));
    const optionAGrid = document.createElement('div');
    optionAGrid.className = 'field-grid single';
    optionAGrid.append(
      createField('文案', input(node.optionA?.label || '', (value) => updateChoiceField('optionA', 'label', value))),
      createField('下一節點', select(nextNodeOptions(story), node.optionA?.nextNodeId || '', (value) => updateChoiceField('optionA', 'nextNodeId', value))),
      (() => {
        const field = createField('選後過場文案', textarea(node.optionA?.feedback || '', (value) => updateChoiceField('optionA', 'feedback', value)));
        field.dataset.transitionField = 'choice-a';
        return field;
      })()
    );
    optionAPanel.appendChild(optionAGrid);

    const optionBPanel = document.createElement('section');
    optionBPanel.className = 'panel';
    optionBPanel.style.padding = '14px';
    optionBPanel.appendChild(sectionHeading('選項 B'));
    const optionBGrid = document.createElement('div');
    optionBGrid.className = 'field-grid single';
    optionBGrid.append(
      createField('文案', input(node.optionB?.label || '', (value) => updateChoiceField('optionB', 'label', value))),
      createField('下一節點', select(nextNodeOptions(story), node.optionB?.nextNodeId || '', (value) => updateChoiceField('optionB', 'nextNodeId', value))),
      (() => {
        const field = createField('選後過場文案', textarea(node.optionB?.feedback || '', (value) => updateChoiceField('optionB', 'feedback', value)));
        field.dataset.transitionField = 'choice-b';
        return field;
      })()
    );
    optionBPanel.appendChild(optionBGrid);

    optionsGrid.append(optionAPanel, optionBPanel);
    container.appendChild(optionsGrid);
    return container;
  }

  function renderPreviewOnly() {
    dom.previewTabs.forEach((button) => button.classList.toggle('active', button.dataset.previewPanel === state.previewPanel));
    Object.entries(dom.previewPanels).forEach(([key, panel]) => {
      if (!panel) return;
      panel.classList.toggle('active', key === state.previewPanel);
    });
    dom.previewStatus.className = previewStatusClassName();
    dom.previewStatus.textContent = [state.previewStatus, ...state.previewIssues.map((issue) => `• ${issue.message}`)].join('\n');
    dom.scenePreview.innerHTML = '';
    if (dom.payloadPreview) dom.payloadPreview.textContent = state.preview ? JSON.stringify(state.preview.payload, null, 2) : '{}';
    const total = state.preview?.models?.length || 0;
    const transitionCount = state.preview?.transitionPreviews?.length || 0;
    dom.previewCounter.textContent = total || transitionCount ? `共 ${total} 張卡 / ${transitionCount} 段過場` : '0 張';
    if (dom.previewVersionHint) {
      dom.previewVersionHint.textContent = currentPreviewVersionHint();
    }
    const current = currentPreviewModel();
    const currentAssetMeta = current?.renderedImagePath
      ? `目前編輯版輸出圖：${current.renderedImagePath}`
      : '目前尚未產生編輯版輸出圖。';
    dom.previewOutputMeta.textContent = `${currentAssetMeta}\n${state.isDirty ? '尚有未儲存改動；正式 LINE 圖片仍停留在最後一次已發布版本。' : '若已完成整體發布流程，LINE 才會與這裡一致。'}`;
    if (!state.preview || (!total && !transitionCount)) {
      if (state.previewIssues.length) {
        dom.scenePreview.appendChild(renderPreviewNoticeCard(state.previewIssues[0]?.message || state.previewStatus));
      }
      return;
    }
    const beforeTransitions = (state.preview.transitionPreviews || []).filter((entry) => entry.position === 'before');
    const afterTransitions = (state.preview.transitionPreviews || []).filter((entry) => entry.position !== 'before');
    beforeTransitions.forEach((entry) => {
      dom.scenePreview.appendChild(renderTransitionPreview(entry));
    });
    state.preview.models.forEach((model, index) => {
      dom.scenePreview.appendChild(renderPreviewModel(model, index));
    });
    afterTransitions.forEach((entry) => {
      dom.scenePreview.appendChild(renderTransitionPreview(entry));
    });
  }

  function renderPreviewModel(model, index) {
    return renderRenderedImagePreview(model, index);
  }

  function withCacheBust(url, token = '') {
    if (!url) return '';
    if (!token) return url;
    return `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(token)}`;
  }

  function renderRenderedImagePreview(model, index = 0) {
    const wrapper = document.createElement('div');
    wrapper.className = `preview-card ${index === state.previewIndex ? 'selected' : ''}`;
    wrapper.dataset.previewIndex = String(index);
    const meta = document.createElement('div');
    meta.className = 'preview-meta';
    meta.innerHTML = `
      <div class="preview-meta-main">
        <strong>${escapeHtml(model.title || '未命名卡片')}</strong>
        <div class="subtle">${escapeHtml(
          model.kind === 'dialogue'
            ? '對話卡'
            : model.kind === 'narration'
              ? '旁白卡'
              : model.kind === 'transition'
                ? '轉場卡'
                : '選項卡'
        )}</div>
      </div>
      <span class="pill">Renderer</span>
    `;
    const article = document.createElement('article');
    article.className = 'rpg-scene';
    article.style.height = `${model.layout.totalHeight}px`;
    const previewSrc = withCacheBust(model.previewImageUrl || model.renderedImageUrl || '', model.imageHash || '');
    article.innerHTML = `<img class="hero" src="${escapeHtml(previewSrc)}" alt="${escapeHtml(model.title || '')}" style="width:100%;height:100%;display:block;object-fit:cover;">`;
    wrapper.append(meta, article);
    wrapper.addEventListener('click', () => {
      state.currentVirtualTransitionId = '';
      state.previewIndex = index;
      renderPreviewOnly();
      renderNodeEditor();
    });
    return wrapper;
  }

  function renderTransitionPreview(entry) {
    const wrapper = document.createElement('div');
    wrapper.className = `preview-card transition-preview ${state.currentVirtualTransitionId === entry.id ? 'selected' : ''}`;
    const meta = document.createElement('div');
    meta.className = 'preview-meta';
    meta.innerHTML = `
      <div class="preview-meta-main">
        <strong>${escapeHtml(entry.title || '過場')}</strong>
        <div class="subtle">${escapeHtml(entry.optionLabel || (entry.position === 'before' ? '節點開頭' : '轉場文案'))}</div>
      </div>
      <span class="pill">Transition</span>
    `;
    const article = document.createElement('article');
    article.className = 'story-card';
    article.style.margin = '0';
    article.innerHTML = `
      <div class="subtle" style="margin-bottom:8px;">這段會在流程中額外送出</div>
      <div style="font-size:20px;font-weight:800;line-height:1.55;">${escapeHtml(entry.text || '')}</div>
    `;
    wrapper.append(meta, article);
    wrapper.addEventListener('click', () => {
      state.currentVirtualTransitionId = entry.id || entry.key || '';
      state.currentNodeId = entry.sourceNodeId || state.currentNodeId;
      const node = currentNode();
      if (entry.branch && Array.isArray(node?.pages)) {
        state.previewIndex = node.pages.length;
      }
      renderPreviewOnly();
      renderNodeEditor();
      focusTransitionField(entry.fieldTarget || (entry.branch ? `choice-${entry.branch.toLowerCase()}` : entry.position === 'before' ? 'intro' : 'node'));
    });
    return wrapper;
  }

  function renderPreviewNoticeCard(message) {
    const wrapper = document.createElement('div');
    wrapper.className = 'preview-card preview-notice-card selected';
    const meta = document.createElement('div');
    meta.className = 'preview-meta';
    meta.innerHTML = `
      <div class="preview-meta-main">
        <strong>預覽已被阻止</strong>
        <div class="subtle">請先修正目前卡片的 blocker</div>
      </div>
      <span class="pill bad">Blocked</span>
    `;
    const article = document.createElement('article');
    article.className = 'story-card';
    article.style.margin = '0';
    article.style.borderColor = '#E6BBBB';
    article.style.background = '#FFF4F4';
    article.innerHTML = `<div style="font-size:18px;font-weight:800;line-height:1.6;color:#9E4646;">${escapeHtml(message || '目前無法產生預覽。')}</div>`;
    wrapper.append(meta, article);
    return wrapper;
  }

  function renderLogCard(log) {
    return `
      <article class="log-card">
        <div class="row space-between">
          <strong>${escapeHtml(log.action)}</strong>
          <span class="pill ${log.result === 'success' ? 'good' : 'bad'}">${escapeHtml(log.result)}</span>
        </div>
        <div class="subtle">${escapeHtml(log.createdAt)}</div>
        <div class="subtle">${escapeHtml(log.targetId || '')}</div>
      </article>
    `;
  }

  function renderVersionCard(version) {
    return `
      <article class="version-card">
        <div class="row space-between">
          <strong>${escapeHtml(version.action)}</strong>
          <span class="pill">${escapeHtml(version.role || 'system')}</span>
        </div>
        <div class="subtle">${escapeHtml(version.createdAt)}</div>
        <div class="subtle">${escapeHtml(version.targetId || '')}</div>
      </article>
    `;
  }

  function createField(labelText, control, single = false) {
    const wrapper = document.createElement('div');
    wrapper.className = `field${single === 'single' ? ' single' : ''}`;
    if (single === 'single') wrapper.style.gridColumn = '1 / -1';
    const label = document.createElement('label');
    label.textContent = labelText;
    wrapper.append(label, control);
    return wrapper;
  }

  function sectionHeading(text) {
    const heading = document.createElement('h3');
    heading.textContent = text;
    heading.style.margin = '0 0 12px';
    return heading;
  }

  function createBlockingNotice(message) {
    const warning = document.createElement('div');
    warning.className = 'status-box';
    warning.style.background = '#FBE3E3';
    warning.style.border = '1px solid #E6BBBB';
    warning.style.color = '#9E4646';
    warning.textContent = message;
    return warning;
  }

  function input(value, onInput) {
    const element = document.createElement('input');
    element.value = value ?? '';
    element.addEventListener('input', () => onInput(element.value));
    return element;
  }

  function staticValue(value) {
    const element = document.createElement('div');
    element.className = 'status-box';
    element.textContent = value || '尚未設定。';
    return element;
  }

  function numberInput(value, onInput) {
    const element = document.createElement('input');
    element.type = 'number';
    element.value = Number(value || 0);
    element.addEventListener('input', () => onInput(Number(element.value || 0)));
    return element;
  }

  function decimalInput(value, min, max, step, onInput) {
    const element = document.createElement('input');
    element.type = 'number';
    element.min = String(min);
    element.max = String(max);
    element.step = String(step);
    element.value = Number(value ?? 0);
    element.addEventListener('input', () => {
      const next = Number(element.value);
      onInput(Number.isFinite(next) ? next : value);
    });
    return element;
  }

  function rangeInput(value, min, max, step, onInput, formatValue = (next) => String(next)) {
    const wrap = document.createElement('div');
    wrap.className = 'stack';
    const element = document.createElement('input');
    element.type = 'range';
    element.min = String(min);
    element.max = String(max);
    element.step = String(step);
    element.value = String(value ?? min);
    const output = document.createElement('div');
    output.className = 'slider-value';
    output.textContent = formatValue(Number(element.value));
    element.addEventListener('input', () => {
      const next = Number(element.value);
      output.textContent = formatValue(next);
      onInput(Number.isFinite(next) ? next : value);
    });
    wrap.append(element, output);
    return wrap;
  }

  function textarea(value, onInput) {
    const element = document.createElement('textarea');
    element.value = value ?? '';
    element.addEventListener('input', () => onInput(element.value));
    return element;
  }

  function checkboxList(options, selectedValues, onChange) {
    const wrap = document.createElement('div');
    wrap.className = 'stack';
    const selected = new Set(Array.isArray(selectedValues) ? selectedValues : []);
    options.forEach(([optionValue, label]) => {
      const row = document.createElement('label');
      row.className = 'row';
      row.style.alignItems = 'center';
      row.style.gap = '10px';
      row.style.padding = '8px 0';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = optionValue;
      checkbox.checked = selected.has(optionValue);
      checkbox.addEventListener('change', () => {
        const nextSelected = Array.from(wrap.querySelectorAll('input[type="checkbox"]:checked'))
          .map((entry) => entry.value);
        onChange(nextSelected);
      });
      const text = document.createElement('span');
      text.textContent = label;
      row.append(checkbox, text);
      wrap.appendChild(row);
    });
    return wrap;
  }

  function select(options, value, onChange) {
    const element = document.createElement('select');
    element.innerHTML = options.map(([optionValue, label]) => `<option value="${escapeHtml(optionValue)}">${escapeHtml(label)}</option>`).join('');
    element.value = value ?? '';
    element.addEventListener('change', () => onChange(element.value));
    return element;
  }

  function colorInput(value, onChange, fallback = '#56616A') {
    const wrap = document.createElement('div');
    wrap.className = 'row';
    wrap.style.alignItems = 'center';
    wrap.style.gap = '10px';
    const color = document.createElement('input');
    color.type = 'color';
    color.value = normalizeHexColor(value, fallback);
    color.style.width = '56px';
    color.style.height = '44px';
    color.style.padding = '0';
    color.style.border = 'none';
    color.style.background = 'transparent';
    const text = document.createElement('input');
    text.type = 'text';
    text.value = normalizeHexColor(value, fallback);
    const apply = (next) => {
      const normalized = normalizeHexColor(next, fallback);
      color.value = normalized;
      text.value = normalized;
      onChange(normalized);
    };
    color.addEventListener('input', () => apply(color.value));
    text.addEventListener('input', () => {
      if (/^#?[0-9a-fA-F]{6}$/.test(text.value.trim())) {
        apply(text.value.trim());
      }
    });
    wrap.append(color, text);
    return wrap;
  }

  function normalizeHexColor(value, fallback = '#56616A') {
    const raw = `${value || ''}`.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toUpperCase();
    if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toUpperCase()}`;
    return fallback;
  }

  function imageInput(value, onChange) {
    const wrap = document.createElement('div');
    wrap.className = 'stack';
    const urlInput = input(value || '', onChange);
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.addEventListener('change', async () => {
      if (!fileInput.files?.[0]) return;
      const asset = await uploadImage(fileInput.files[0]);
      onChange(asset.url);
    });
    const preview = document.createElement('img');
    preview.className = 'asset-preview';
    preview.src = value || '';
    urlInput.addEventListener('input', () => { preview.src = urlInput.value || ''; });
    wrap.append(urlInput, fileInput, preview);
    return wrap;
  }

  async function uploadImage(file) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE}/upload-image`, {
      method: 'POST',
      headers: {
        'x-lineat-role': state.role,
        'x-lineat-actor': state.role
      },
      body: formData
    });
    const text = await response.text();
    const payload = text ? JSON.parse(text) : {};
    if (!response.ok) throw new Error(payload.error || '上傳失敗');
    return payload.asset;
  }

  function fontOptions() {
    const labels = {
      default: 'LINE 預設字體',
      handwritten: '手寫體',
      cute: '娃娃體',
      serif: '明體',
      rounded: '圓體'
    };
    return state.globalSettings.previewFontOptions.map((option) => [option, labels[option] || option]);
  }

  function textSizeOptions() {
    return state.globalSettings.lineTextSizes.map((option) => [option, option]);
  }

  function nameplateSizeOptions() {
    return Object.keys(state.globalSettings.nameplateSizePresets).map((option) => [option, option]);
  }

  function nameplateSizeValues() {
    return Object.keys(state.globalSettings.nameplateSizePresets);
  }

  function nameplateSizeSlider(value, onInput) {
    const values = nameplateSizeValues();
    const index = Math.max(0, values.indexOf(value || 'lg'));
    const wrap = document.createElement('div');
    wrap.className = 'stack';
    const element = document.createElement('input');
    element.type = 'range';
    element.min = '0';
    element.max = String(Math.max(0, values.length - 1));
    element.step = '1';
    element.value = String(index);
    element.dataset.optionValues = values.join(',');
    const output = document.createElement('div');
    output.className = 'slider-value';
    output.textContent = values[index] || 'lg';
    element.addEventListener('input', () => {
      const nextIndex = Number(element.value);
      const nextValue = values[nextIndex] || values[0] || 'lg';
      output.textContent = nextValue;
      onInput(nextValue);
    });
    wrap.append(element, output);
    return wrap;
  }

  function characterOptions(includeBlank = false) {
    const source = currentStory()?.characters?.length ? currentStory().characters : state.globalSettings.characters;
    const list = source.map((character) => [character.id, character.name]);
    return includeBlank ? [['', '不指定'], ...list] : list;
  }

  function nextNodeOptions(story) {
    return [['', '未設定'], ...story.nodes.map((node) => [node.id, `${node.title} (${node.id})`])];
  }

  function describeNodeType(type) {
    if (type === 'dialogue') return '對話卡';
    if (type === 'narration') return '旁白卡';
    if (type === 'transition') return '轉場卡';
    if (type === 'choice') return '選項卡';
    if (type === 'carousel') return '多頁訊息';
    return type || '未分類';
  }

  function updateNodeField(field, value) {
    const node = currentNode();
    if (!node) return;
    node[field] = value;
    if (field === 'speakerCharacterId' && node.companionCharacterId === value) {
      node.companionCharacterId = '';
    }
    if (field === 'companionCharacterId' && node.speakerCharacterId === value) {
      node.companionCharacterId = '';
    }
    markDirty('目前節點已修改，尚未儲存。');
    schedulePreview();
  }

  function ensureDialogueRoleDefaults(target) {
    if (!target) return;
    if (!target.speakerCharacterId) {
      target.speakerCharacterId = defaultSpeakerId();
    }
    if (target.speakerCharacterId && target.speakerCharacterId === target.companionCharacterId) {
      target.companionCharacterId = '';
    }
  }

  function clearDialogueRoleFields(target) {
    if (!target) return;
    target.speakerCharacterId = '';
    target.companionCharacterId = '';
  }

  function isTextTriptychCard(cardType = '') {
    return cardType === 'narration-triptych';
  }

  function isNarrationLikeCard(cardType = '') {
    return cardType === 'narration' || isTextTriptychCard(cardType);
  }

  function splitTriptychText(text = '') {
    const normalized = `${text || ''}`.replace(/\r/g, '').trim();
    if (!normalized) return ['', '', ''];
    const segments = normalized
      .split(/\n\s*\n+/)
      .map((segment) => segment.trim());
    if (segments.length >= 3) return [segments[0] || '', segments[1] || '', segments.slice(2).join('\n\n') || ''];
    if (segments.length === 2) return [segments[0] || '', segments[1] || '', ''];
    return [segments[0] || '', '', ''];
  }

  function composeTriptychText(segments = []) {
    return segments.map((segment) => `${segment || ''}`.trim()).join('\n\n').trim();
  }

  function updateNodePosition(axis, value) {
    const node = currentNode();
    if (!node) return;
    node.position[axis] = value;
    markDirty('Block 位置已修改，尚未儲存。');
    schedulePreview();
  }

  function insertNodeAfter(nodeId, type = 'dialogue') {
    const story = currentStory();
    if (!story) return;
    const index = story.nodes.findIndex((node) => node.id === nodeId);
    if (index < 0) return;
    const source = story.nodes[index];
    const inserted = createLocalNodeTemplate(type, story.nodes.length + 1);
    inserted.title = type === 'transition'
      ? `${source.title || 'Scene'} 轉場`
      : `${source.title || 'Scene'} 下一張`;
    inserted.nextNodeId = source.type === 'choice' ? '' : (source.nextNodeId || '');
    if (getGraphLayoutMode(story) === 'custom') {
      inserted.position = {
        x: snapToBlockGrid((Number(source.position?.x || BLOCK_MIN_X) + 300), BLOCK_MIN_X),
        y: snapToBlockGrid(Number(source.position?.y || BLOCK_MIN_Y), BLOCK_MIN_Y)
      };
    }
    story.nodes.splice(index + 1, 0, inserted);
    if (source.type !== 'choice') {
      source.nextNodeId = inserted.id;
    }
    state.currentNodeId = inserted.id;
    resetPreviewSelection();
    markDirty(type === 'transition'
      ? '已插入新的轉場卡，記得按「儲存故事」。'
      : `已插入新的${describeNodeType(type)}，記得按「儲存故事」。`);
    renderStories();
    refreshPreview().catch(console.error);
  }

  function startNodeDrag(event, nodeId) {
    if (event.button !== 0) return;
    if (event.target.closest('button')) return;
    const story = currentStory();
    if (!story) return;
    const node = story.nodes.find((entry) => entry.id === nodeId);
    const card = event.currentTarget;
    if (!node || !card) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const initialX = Number(node.position?.x ?? BLOCK_MIN_X);
    const initialY = Number(node.position?.y ?? BLOCK_MIN_Y);
    let moved = false;

    const move = (moveEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 6) return;
      moved = true;
      node.position = node.position || { x: initialX, y: initialY };
      node.position.x = Math.max(BLOCK_MIN_X, initialX + dx);
      node.position.y = Math.max(BLOCK_MIN_Y, initialY + dy);
      card.classList.add('dragging');
      card.style.left = `${node.position.x}px`;
      card.style.top = `${node.position.y}px`;
    };

    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      card.classList.remove('dragging');
      if (!moved) return;
      node.position.x = snapToBlockGrid(node.position.x, BLOCK_MIN_X);
      node.position.y = snapToBlockGrid(node.position.y, BLOCK_MIN_Y);
      state.graphLayoutOverrides[story.id] = 'custom';
      state.justDraggedNodeId = nodeId;
      markDirty('Block 位置已更新，記得按「儲存故事」。');
      renderStories();
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function moveStoryNode(nodeId, delta) {
    const story = currentStory();
    if (!story) return;
    const index = story.nodes.findIndex((node) => node.id === nodeId);
    const nextIndex = index + delta;
    if (index < 0 || nextIndex < 0 || nextIndex >= story.nodes.length) return;
    const [node] = story.nodes.splice(index, 1);
    story.nodes.splice(nextIndex, 0, node);
    markDirty('Block 順序已調整，記得按「儲存故事」。');
    renderStories();
  }

  function duplicateStoryNode(nodeId) {
    const story = currentStory();
    if (!story) return;
    const index = story.nodes.findIndex((node) => node.id === nodeId);
    if (index < 0) return;
    const source = story.nodes[index];
    const duplicated = cloneNodeForInsert(source);
    const originalNextNodeId = source.nextNodeId || '';
    duplicated.nextNodeId = originalNextNodeId;
    story.nodes.splice(index + 1, 0, duplicated);
    if (source.type !== 'choice') {
      source.nextNodeId = duplicated.id;
    }
    state.currentNodeId = duplicated.id;
    resetPreviewSelection();
    markDirty('已複製目前卡片，尚未儲存。');
    renderStories();
    refreshPreview().catch(console.error);
  }

  function insertDialogueAfter(nodeId) {
    insertNodeAfter(nodeId, 'dialogue');
  }

  function ensureNodeTransition(nodeId) {
    const story = currentStory();
    if (!story) return;
    const node = story.nodes.find((entry) => entry.id === nodeId);
    if (!node) return;
    if (node.type === 'choice') {
      node.optionA = node.optionA || { label: '選項 A', feedback: '', nextNodeId: '' };
      node.optionB = node.optionB || { label: '選項 B', feedback: '', nextNodeId: '' };
      if (!node.optionA.feedback) node.optionA.feedback = '在這裡輸入選項 A 的選後過場文案。';
      if (!node.optionB.feedback) node.optionB.feedback = '在這裡輸入選項 B 的選後過場文案。';
      markDirty('已為這張選項卡開啟選後過場文案，尚未儲存。');
    } else {
      if (!node.transitionText) {
        node.transitionText = '在這裡輸入下一幕前的過場文案。';
      }
      markDirty('已為這一幕開啟過場文案，尚未儲存。');
    }
    state.currentNodeId = node.id;
    resetPreviewSelection();
    renderStories();
    refreshPreview().catch(console.error);
  }

  function clearDeletedNodeReferences(story, deletedNodeId) {
    story.nodes.forEach((node) => {
      if (node.nextNodeId === deletedNodeId) node.nextNodeId = '';
      if (node.optionA?.nextNodeId === deletedNodeId) node.optionA.nextNodeId = '';
      if (node.optionB?.nextNodeId === deletedNodeId) node.optionB.nextNodeId = '';
    });
  }

  function clearDeletedCharacterReferences(story, deletedCharacterId) {
    story.nodes.forEach((node) => {
      if (node.speakerCharacterId === deletedCharacterId) node.speakerCharacterId = '';
      if (node.companionCharacterId === deletedCharacterId) node.companionCharacterId = '';
      (node.pages || []).forEach((page) => {
        if (page.speakerCharacterId === deletedCharacterId) page.speakerCharacterId = '';
        if (page.companionCharacterId === deletedCharacterId) page.companionCharacterId = '';
      });
    });
    (story.draftImport?.nodes || []).forEach((node) => {
      if (node.speakerCharacterId === deletedCharacterId) node.speakerCharacterId = '';
      if (node.companionCharacterId === deletedCharacterId) node.companionCharacterId = '';
      (node.pages || []).forEach((page) => {
        if (page.speakerCharacterId === deletedCharacterId) page.speakerCharacterId = '';
        if (page.companionCharacterId === deletedCharacterId) page.companionCharacterId = '';
      });
    });
  }

  function deleteStoryNode(nodeId) {
    const story = currentStory();
    if (!story) return;
    const target = story.nodes.find((node) => node.id === nodeId);
    if (!target) return;
    const ok = window.confirm(`要刪除節點「${target.title || nodeId}」嗎？`);
    if (!ok) return;
    const index = story.nodes.findIndex((node) => node.id === nodeId);
    story.nodes.splice(index, 1);
    clearDeletedNodeReferences(story, nodeId);
    if (story.startNodeId === nodeId) {
      story.startNodeId = story.nodes[0]?.id || '';
    }
    const binding = currentTriggerBinding();
    if (binding && binding.startNodeId === nodeId) {
      binding.startNodeId = story.startNodeId || '';
    }
    if (state.currentNodeId === nodeId) {
      state.currentNodeId = story.nodes[Math.max(0, index - 1)]?.id || story.nodes[0]?.id || '';
      resetPreviewSelection();
    }
    markDirty('節點已刪除，相關連線已清空，尚未儲存。');
    renderStories();
    refreshPreview().catch(console.error);
  }

  function insertNodePage(node, afterIndex = -1, options = {}) {
    if (!node) return;
    node.pages = Array.isArray(node.pages) ? node.pages : [];
    const sourcePage = node.pages[Math.max(0, afterIndex)] || defaultPage(node.pages.length + 1);
    const nextPage = options.duplicateCurrent
      ? clone(sourcePage)
      : defaultPage(node.pages.length + 1);
    nextPage.id = createLocalId('page');
    nextPage.title = `第 ${Math.max(0, afterIndex) + 2} 頁`;
    if (options.cardType) {
      nextPage.cardType = options.cardType;
      if (options.cardType === 'dialogue') {
        ensureDialogueRoleDefaults(nextPage);
      } else if (isNarrationLikeCard(options.cardType)) {
        clearDialogueRoleFields(nextPage);
      }
    }
    node.pages.splice(afterIndex + 1, 0, nextPage);
    node.pages = normalizePageTitles(node.pages);
    state.previewIndex = Math.max(0, afterIndex + 1);
    state.currentVirtualTransitionId = '';
    markDirty('已新增頁面，尚未儲存。');
    renderStories();
    refreshPreview().catch(console.error);
  }

  function duplicateNodePage(node, pageIndex) {
    if (!node?.pages?.[pageIndex]) return;
    insertNodePage(node, pageIndex, {
      duplicateCurrent: true,
      cardType: node.pages[pageIndex].cardType || 'dialogue'
    });
    markDirty('已複製目前頁面，尚未儲存。');
  }

  function moveNodePage(node, pageIndex, delta) {
    if (!node?.pages?.[pageIndex]) return;
    const nextIndex = pageIndex + delta;
    if (nextIndex < 0 || nextIndex >= node.pages.length) return;
    const [page] = node.pages.splice(pageIndex, 1);
    node.pages.splice(nextIndex, 0, page);
    node.pages = normalizePageTitles(node.pages);
    state.previewIndex = nextIndex;
    markDirty('頁面順序已調整，尚未儲存。');
    renderNodeEditor();
    schedulePreview();
  }

  function deleteNodePage(node, pageIndex) {
    if (!node?.pages?.[pageIndex]) return;
    if (node.pages.length <= 1) {
      state.previewStatus = '至少保留一頁，無法再刪除。';
      renderPreviewOnly();
      return;
    }
    const ok = window.confirm(`要刪除「${node.pages[pageIndex].title || `第 ${pageIndex + 1} 頁`}」嗎？`);
    if (!ok) return;
    node.pages.splice(pageIndex, 1);
    node.pages = normalizePageTitles(node.pages);
    state.previewIndex = Math.max(0, Math.min(pageIndex, node.pages.length - 1));
    markDirty('頁面已刪除，尚未儲存。');
    renderNodeEditor();
    schedulePreview();
  }

  function updatePageField(node, pageIndex, field, value) {
    node.pages[pageIndex][field] = value;
    if (field === 'cardType') {
      if (value === 'dialogue') {
        ensureDialogueRoleDefaults(node.pages[pageIndex]);
      } else if (isNarrationLikeCard(value)) {
        clearDialogueRoleFields(node.pages[pageIndex]);
      }
      renderNodeEditor();
    }
    if (field === 'speakerCharacterId' && node.pages[pageIndex].companionCharacterId === value) {
      node.pages[pageIndex].companionCharacterId = '';
    }
    if (field === 'companionCharacterId' && node.pages[pageIndex].speakerCharacterId === value) {
      node.pages[pageIndex].companionCharacterId = '';
    }
    markDirty('目前頁面已修改，尚未儲存。');
    schedulePreview();
  }

  function updateChoiceField(optionKey, field, value) {
    const node = currentNode();
    if (!node) return;
    node[optionKey][field] = value;
    markDirty(`選項 ${optionKey === 'optionA' ? 'A' : 'B'} 已修改，尚未儲存。`);
    schedulePreview();
  }

  function updateCharacter(index, field, value) {
    if (!state.globalSettings?.characters?.[index]) return;
    state.globalSettings.characters[index][field] = value;
    schedulePreview();
  }

  function updateStoryCharacter(index, field, value) {
    const story = currentStory();
    if (!story) return;
    const previousId = story.characters[index].id;
    story.characters[index][field] = value;
    if (field === 'id' && previousId && value && previousId !== value) {
      story.nodes.forEach((node) => {
        if (node.speakerCharacterId === previousId) node.speakerCharacterId = value;
        if (node.companionCharacterId === previousId) node.companionCharacterId = value;
        (node.pages || []).forEach((page) => {
          if (page.speakerCharacterId === previousId) page.speakerCharacterId = value;
          if (page.companionCharacterId === previousId) page.companionCharacterId = value;
        });
      });
      (story.draftImport?.nodes || []).forEach((node) => {
        if (node.speakerCharacterId === previousId) node.speakerCharacterId = value;
        if (node.companionCharacterId === previousId) node.companionCharacterId = value;
        (node.pages || []).forEach((page) => {
          if (page.speakerCharacterId === previousId) page.speakerCharacterId = value;
          if (page.companionCharacterId === previousId) page.companionCharacterId = value;
        });
      });
    }
    syncStoryCharacterPreview(index);
    markDirty('角色設定已修改，尚未儲存。');
    schedulePreview();
  }

  function updateDraftNodeField(field, value) {
    const node = currentDraftNode();
    if (!node) return;
    node[field] = value;
    node.status = 'corrected';
    node.diff = computeDraftDiff(node);
    renderDraftEditor(currentStory());
    renderDraftImport(currentStory());
  }

  function updateDraftPageField(pageIndex, field, value) {
    const node = currentDraftNode();
    if (!node || !node.pages?.[pageIndex]) return;
    node.pages[pageIndex][field] = value;
    if (field === 'cardType') {
      if (value === 'dialogue') {
        ensureDialogueRoleDefaults(node.pages[pageIndex]);
      } else if (isNarrationLikeCard(value)) {
        clearDialogueRoleFields(node.pages[pageIndex]);
      }
    }
    node.status = 'corrected';
    node.diff = computeDraftDiff(node);
    renderDraftEditor(currentStory());
    renderDraftImport(currentStory());
  }

  function updateDraftChoiceField(optionKey, field, value) {
    const node = currentDraftNode();
    if (!node || !node[optionKey]) return;
    node[optionKey][field] = value;
    node.status = 'corrected';
    node.diff = computeDraftDiff(node);
    renderDraftEditor(currentStory());
    renderDraftImport(currentStory());
  }

  function updateNodeType(node, type) {
    node.type = type;
    if (type === 'choice' && !node.optionA) {
      node.prompt = '在這裡輸入選項提問。';
      node.optionA = { label: '選項 A', feedback: '', nextNodeId: '' };
      node.optionB = { label: '選項 B', feedback: '', nextNodeId: '' };
      node.pages = node.pages || [defaultPage(1)];
    }
    if (type === 'carousel' && !node.pages) {
      node.pages = [defaultPage(1)];
    }
    if (type === 'dialogue') {
      ensureDialogueRoleDefaults(node);
    }
    if (type === 'narration') {
      clearDialogueRoleFields(node);
    }
    if (type !== 'choice') {
      delete node.optionA;
      delete node.optionB;
      delete node.prompt;
    }
    markDirty(`已改成${describeNodeType(type)}，尚未儲存。`);
    renderNodeEditor();
    schedulePreview();
  }

  function defaultPage(index) {
    return {
      id: `page-${Date.now()}-${index}`,
      title: `第 ${index} 頁`,
      cardType: 'dialogue',
      imagePath: '/public/story/01/image01.png',
      text: '在這裡輸入多頁內容。',
      previewFont: 'default',
      lineTextSize: 'lg',
      lineTextColor: '#2D241B',
      heroImageOpacity: 1,
      heroImageScale: 1,
      nameplateSize: 'lg',
      speakerCharacterId: defaultSpeakerId(),
      companionCharacterId: ''
    };
  }

  function layoutPanel(label, key, values, fields) {
    const panel = document.createElement('section');
    panel.className = 'panel';
    panel.style.padding = '14px';
    const title = document.createElement('h3');
    title.textContent = label;
    panel.appendChild(title);
    const grid = document.createElement('div');
    grid.className = 'field-grid';
    fields.forEach((field) => {
      grid.appendChild(createField(field, numberInput(values[field], (value) => {
        state.globalSettings.cardLayouts[key][field] = value;
        schedulePreview();
      })));
    });
    panel.appendChild(grid);
    return panel;
  }

  function escapeHtml(value) {
    return `${value ?? ''}`
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function previewFontCss(fontKey = 'default') {
    if (fontKey === 'handwritten') return '"BiauKai", "DFKai-SB", "Klee One", "PingFang TC", cursive';
    if (fontKey === 'cute') return '"Hannotate TC", "HanziPen TC", "PingFang TC", sans-serif';
    if (fontKey === 'serif') return '"Songti TC", "Noto Serif TC", serif';
    if (fontKey === 'rounded') return '"Arial Rounded MT Bold", "PingFang TC", sans-serif';
    return '"PingFang TC", "Noto Sans TC", sans-serif';
  }

  function describeDraftWarnings(node) {
    const warnings = [];
    if (node.unboundCharacterName) warnings.push(`未綁定角色 ${node.unboundCharacterName}`);
    if (node.type === 'dialogue' && !node.speakerCharacterId) warnings.push('對話卡缺少主講角色');
    if ((node.type === 'dialogue' || node.type === 'narration') && !node.text) warnings.push('缺少文字');
    if (node.type === 'choice') {
      if (!node.optionA?.label || !node.optionB?.label) warnings.push('選項不完整');
      if (!node.optionA?.nextNodeId && !node.optionB?.nextNodeId) warnings.push('尚未連線');
    }
    return warnings.length ? warnings.join(' / ') : '無';
  }
})();

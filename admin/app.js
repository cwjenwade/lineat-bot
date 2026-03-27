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
    storyStage: 'final',
    previewPanel: 'visual',
    previewIndex: 0
  };

  const dom = {};

  document.addEventListener('DOMContentLoaded', boot);

  async function boot() {
    cacheDom();
    bindStaticEvents();
    await reloadAll();
  }

  function cacheDom() {
    dom.refreshAll = document.getElementById('refresh-all');

    dom.storyCount = document.getElementById('story-count');
    dom.newStoryTitle = document.getElementById('new-story-title');
    dom.createStory = document.getElementById('create-story');
    dom.storyList = document.getElementById('story-list');
    dom.editorStoryTitle = document.getElementById('editor-story-title');
    dom.editorStoryMeta = document.getElementById('editor-story-meta');
    dom.storyTitleInput = document.getElementById('story-title-input');
    dom.storyDescriptionInput = document.getElementById('story-description-input');
    dom.storyStartNode = document.getElementById('story-start-node');
    dom.storyTriggerInput = document.getElementById('story-trigger-input');
    dom.storyProgressGrid = document.getElementById('story-progress-grid');
    dom.saveStoryMeta = document.getElementById('save-story-meta');
    dom.storyStageTabs = Array.from(document.querySelectorAll('[data-story-stage]'));
    dom.storyStagePanels = {
      characters: document.getElementById('story-stage-characters'),
      import: document.getElementById('story-stage-import'),
      final: document.getElementById('story-stage-final')
    };
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

    dom.previewStatus = document.getElementById('preview-status');
    dom.scenePreview = document.getElementById('scene-preview');
    dom.previewCounter = document.getElementById('preview-counter');
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
      visual: document.getElementById('preview-panel-visual'),
      payload: document.getElementById('preview-panel-payload'),
      simulate: document.getElementById('preview-panel-simulate')
    };
  }

  function bindStaticEvents() {
    dom.refreshAll.addEventListener('click', reloadAll);
    dom.createStory.addEventListener('click', handleCreateStory);
    dom.addStoryCharacter.addEventListener('click', handleAddStoryCharacter);
    dom.addProtagonistTemplate.addEventListener('click', () => handleAddStoryCharacter('protagonist'));
    dom.addSupportingTemplate.addEventListener('click', () => handleAddStoryCharacter('supporting'));
    dom.importScriptText.addEventListener('click', handleImportScriptText);
    dom.scriptImportFile.addEventListener('change', handleImportScriptFile);
    dom.matchUnboundRoles.addEventListener('click', handleMatchUnboundRoles);
    dom.saveDraftImport.addEventListener('click', handleSaveDraftImport);
    dom.applyAllDraft.addEventListener('click', handleApplyAllDraft);
    dom.saveStory.addEventListener('click', handleSaveStory);
    dom.publishAssets.addEventListener('click', handlePublishAssets);
    dom.deployRender.addEventListener('click', handleDeployRender);
    dom.saveStoryMeta.addEventListener('click', handleSaveStory);
    dom.validateStory.addEventListener('click', handleValidateStory);
    dom.testTrigger.addEventListener('click', handleTestTrigger);
    dom.validateNode.addEventListener('click', handleValidateNode);
    dom.testNode.addEventListener('click', handleTestNode);
    dom.simulateMessage.addEventListener('click', handleSimulateMessage);
    dom.simulateReset.addEventListener('click', handleResetSimulation);
    dom.moduleButtons.forEach((button) => button.addEventListener('click', () => handleAddNode(button.dataset.addNode)));
    dom.storyTitleInput.addEventListener('input', () => updateStoryField('title', dom.storyTitleInput.value));
    dom.storyDescriptionInput.addEventListener('input', () => updateStoryField('description', dom.storyDescriptionInput.value));
    dom.storyTriggerInput.addEventListener('input', () => updateStoryTrigger(dom.storyTriggerInput.value));
    dom.storyStartNode.addEventListener('change', () => updateStoryField('startNodeId', dom.storyStartNode.value));
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

  function currentStory() {
    return state.storyDetail?.story || null;
  }

  function currentNode() {
    const story = currentStory();
    return story?.nodes.find((node) => node.id === state.currentNodeId) || null;
  }

  function currentTriggerBinding() {
    if (!state.globalSettings || !state.currentStoryId) return null;
    return state.globalSettings.triggerBindings.find((binding) => binding.storyId === state.currentStoryId) || null;
  }

  function currentPreviewModel() {
    return state.preview?.models?.[state.previewIndex] || null;
  }

  function currentPreviewContext() {
    const node = currentNode();
    const model = currentPreviewModel();
    if (!node || !model) {
      return {
        targetType: 'node',
        model,
        pageIndex: -1,
        page: null
      };
    }

    if (node.type === 'carousel') {
      const pageIndex = Math.min(state.previewIndex, Math.max(0, (node.pages?.length || 1) - 1));
      return {
        targetType: 'page',
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
          model,
          pageIndex: state.previewIndex,
          page: node.pages?.[state.previewIndex] || null
        };
      }
      return {
        targetType: 'choice',
        model,
        pageIndex: -1,
        page: null
      };
    }

    return {
      targetType: 'node',
      model,
      pageIndex: -1,
      page: null
    };
  }

  function resetPreviewSelection() {
    state.previewIndex = 0;
  }

  async function reloadAll() {
    const [storiesPayload, settingsPayload] = await Promise.all([
      api('/stories'),
      api('/global-settings')
    ]);

    state.stories = storiesPayload.stories;
    state.globalSettings = settingsPayload.globalSettings;

    const nextStoryId = state.currentStoryId || state.stories[0]?.id || '';
    if (nextStoryId) {
      await loadStory(nextStoryId);
    } else {
      state.storyDetail = null;
      state.currentStoryId = '';
      state.currentNodeId = '';
      state.preview = null;
      state.previewIssues = [];
    }
    render();
  }

  async function loadStory(storyId) {
    const payload = await api(`/stories/${storyId}`);
    state.storyDetail = payload;
    state.currentStoryId = storyId;
    const story = payload.story;
    state.currentNodeId = state.currentNodeId && story.nodes.some((node) => node.id === state.currentNodeId)
      ? state.currentNodeId
      : (story.startNodeId || story.nodes[0]?.id || '');
    resetPreviewSelection();
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

  function updateStoryField(field, value) {
    if (!currentStory()) return;
    state.storyDetail.story[field] = value;
    render();
    schedulePreview();
  }

  function updateStoryTrigger(keyword) {
    if (!state.globalSettings || !currentStory()) return;
    const binding = currentTriggerBinding();
    if (binding) {
      binding.keyword = keyword;
      binding.startNodeId = currentStory().startNodeId;
    } else {
      state.globalSettings.triggerBindings.push({
        id: `trigger-${Date.now()}`,
        keyword,
        storyId: currentStory().id,
        startNodeId: currentStory().startNodeId
      });
    }
    render();
  }

  async function handleSaveStory() {
    const story = currentStory();
    if (!story) return;
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
    state.previewStatus = '故事已儲存。';
    render();
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
    state.storyStage = 'final';
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
    await handleSaveStory();
    const result = await api(`/stories/${story.id}/validate/story`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    const failed = result.results.filter((entry) => !entry.ok);
    state.previewStatus = failed.length
      ? `全故事 validate 失敗：${failed.length} 個節點有錯。`
      : `全故事 validate 通過：${result.results.length} 個節點。`;
    render();
  }

  async function handlePublishAssets() {
    const story = currentStory();
    if (!story) return;
    const result = await api(`/stories/${story.id}/publish-assets`, {
      method: 'POST'
    });
    state.previewStatus = `已產生 ${result.published.assetCount} 張部署圖片，可直接 commit 到 Render。`;
    renderPreviewOnly();
  }

  async function handleDeployRender() {
    const story = currentStory();
    if (!story) return;
    await handleSaveStory();
    const result = await api(`/stories/${story.id}/deploy`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    state.previewStatus = `已發布到 Render，commit ${result.deployment.head.slice(0, 7)}。Render 會自動重新部署。`;
    render();
  }

  async function handleTestTrigger() {
    const story = currentStory();
    if (!story) return;
    await handleSaveStory();
    const result = await api(`/stories/${story.id}/test/trigger`, {
      method: 'POST',
      body: JSON.stringify({ nodeId: story.startNodeId })
    });
    state.previewStatus = `已送出開始故事測試。request id: ${result.broadcast.requestId || 'n/a'}`;
    render();
  }

  async function handleValidateNode() {
    const story = currentStory();
    const node = currentNode();
    if (!story || !node) return;
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
    renderPreviewOnly();
  }

  async function handleTestNode() {
    const story = currentStory();
    const node = currentNode();
    if (!story || !node) return;
    await handleSaveStory();
    const result = await api(`/stories/${story.id}/test/node`, {
      method: 'POST',
      body: JSON.stringify({ nodeId: node.id })
    });
    state.previewStatus = `已送出單卡測試。request id: ${result.broadcast.requestId || 'n/a'}`;
    render();
  }

  async function handleSimulateMessage() {
    const text = dom.simulateText.value.trim();
    const sessionKey = dom.simulateSessionKey.value.trim() || 'local-preview';
    const result = await api('/runtime/simulate', {
      method: 'POST',
      body: JSON.stringify({ text, sessionKey })
    });
    dom.simulationOutput.textContent = JSON.stringify(result.simulation, null, 2);
  }

  async function handleResetSimulation() {
    const sessionKey = dom.simulateSessionKey.value.trim() || 'local-preview';
    const result = await api('/runtime/reset', {
      method: 'POST',
      body: JSON.stringify({ sessionKey })
    });
    dom.simulateSessionKey.value = 'local-preview';
    dom.simulateText.value = '開始故事';
    dom.simulationOutput.textContent = JSON.stringify(result.simulation, null, 2);
  }

  async function handleAddNode(type) {
    const story = currentStory();
    if (!story) return;
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
    const story = currentStory();
    const node = currentNode();
    if (!story || !node) {
      state.preview = null;
      state.previewStatus = '尚未載入節點。';
      state.previewIssues = [];
      renderPreviewOnly();
      return;
    }
    const result = await api(`/stories/${story.id}/render/draft`, {
      method: 'POST',
      body: JSON.stringify({
        story,
        globalSettings: state.globalSettings,
        nodeId: node.id
      })
    });
    state.preview = result.render;
    state.previewIndex = Math.min(state.previewIndex, Math.max(0, (result.render?.models?.length || 1) - 1));
    state.previewIssues = result.issues || [];
    state.previewStatus = result.issues?.length
      ? `目前有 ${result.issues.length} 個問題需要處理。`
      : '預覽已更新。';
    renderPreviewOnly();
  }

  function render() {
    renderStories();
  }

  function renderStories() {
    dom.storyStageTabs.forEach((button) => button.classList.toggle('active', button.dataset.storyStage === state.storyStage));
    Object.entries(dom.storyStagePanels).forEach(([key, panel]) => {
      if (panel) panel.classList.toggle('active', key === state.storyStage);
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
    if (!story) {
      dom.editorStoryTitle.textContent = '未選擇故事';
      dom.editorStoryMeta.textContent = '';
      dom.storyProgressGrid.innerHTML = '';
      dom.nodeGraph.innerHTML = '';
      dom.nodeEditorEmpty.classList.remove('hidden');
      dom.nodeEditorShell.classList.add('hidden');
      return;
    }

    const triggerBinding = currentTriggerBinding();
    dom.editorStoryTitle.textContent = story.title;
    dom.editorStoryMeta.textContent = `start: ${story.startNodeId || '未設定'} / trigger: ${triggerBinding?.keyword || '未設定'}`;
    dom.storyTitleInput.value = story.title || '';
    dom.storyDescriptionInput.value = story.description || '';
    dom.storyTriggerInput.value = triggerBinding?.keyword || '';
    dom.storyStartNode.innerHTML = story.nodes.map((node) => `<option value="${escapeHtml(node.id)}">${escapeHtml(node.title)} (${escapeHtml(node.id)})</option>`).join('');
    dom.storyStartNode.value = story.startNodeId || story.nodes[0]?.id || '';
    dom.scriptImportText.value = story.draftImport?.sourceText || '';
    dom.draftImportStatus.textContent = story.draftImport?.importedAt
      ? `狀態：${story.draftImport.status} / 節點：${story.draftImport.nodes.length} / 未綁定角色：${story.draftImport.unboundRoles.length}`
      : '尚未匯入劇本。';
    renderStoryProgress(story);
    state.currentDraftNodeId = state.currentDraftNodeId && story.draftImport?.nodes?.some((node) => node.id === state.currentDraftNodeId)
      ? state.currentDraftNodeId
      : (story.draftImport?.nodes?.[0]?.id || '');

    dom.nodeGraph.innerHTML = renderNodeGraph(story);
    dom.nodeGraph.querySelectorAll('.graph-node[data-node-id]').forEach((card) => {
      card.addEventListener('click', () => {
        state.currentNodeId = card.dataset.nodeId;
        resetPreviewSelection();
        renderStories();
        refreshPreview().catch(console.error);
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
        } else if (action === 'delete') {
          deleteStoryNode(nodeId);
        }
      });
    });
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
      save.textContent = '儲存角色';
      save.addEventListener('click', handleSaveStory);
      actions.appendChild(save);
      const remove = document.createElement('button');
      remove.className = 'button bad';
      remove.textContent = '刪除角色';
      remove.addEventListener('click', () => {
        story.characters.splice(sourceIndex, 1);
        renderStories();
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
      createField('圖片', imageInput(draftNode.imagePath, (value) => updateDraftNodeField('imagePath', value)))
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
        const pageGrid = document.createElement('div');
        pageGrid.className = 'field-grid';
        pageGrid.append(
          createField('頁面標題', input(page.title || '', (value) => updateDraftPageField(pageIndex, 'title', value))),
          createField('頁面卡型', select([
            ['dialogue', '對話卡'],
            ['narration', '旁白卡']
          ], page.cardType || 'dialogue', (value) => updateDraftPageField(pageIndex, 'cardType', value))),
          createField('頁面圖片', imageInput(page.imagePath, (value) => updateDraftPageField(pageIndex, 'imagePath', value))),
          createField('主講角色', select(characterOptions(true), page.speakerCharacterId || '', (value) => updateDraftPageField(pageIndex, 'speakerCharacterId', value))),
          createField('陪襯角色', select(characterOptions(true), page.companionCharacterId || '', (value) => updateDraftPageField(pageIndex, 'companionCharacterId', value))),
          createField('字級', select(textSizeOptions(), page.lineTextSize || 'lg', (value) => updateDraftPageField(pageIndex, 'lineTextSize', value)))
        );
        pageGrid.appendChild(createField('頁面文字', textarea(page.text || '', (value) => updateDraftPageField(pageIndex, 'text', value)), 'single'));
        section.appendChild(pageGrid);
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
    const nodes = story?.nodes || [];
    if (!nodes.length) {
      return '<div class="status-box">尚未建立節點。</div>';
    }

    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const placed = new Map();
    nodes.forEach((node, index) => {
      const column = index;
      placed.set(node.id, {
        x: 40 + column * 300,
        y: 86
      });
    });

    const deadEnds = [];
    const edges = [];
    nodes.forEach((node) => {
      const fromPos = placed.get(node.id);
      if (!fromPos) return;

      if (node.nextNodeId && placed.has(node.nextNodeId)) {
        edges.push({ from: node.id, to: node.nextNodeId, style: 'solid', label: '主線' });
      }

      if (node.type === 'choice') {
        const primary = getPrimaryNextNodeId(node);
        [
          { key: 'A', target: node.optionA?.nextNodeId || '', label: node.optionA?.label || 'A' },
          { key: 'B', target: node.optionB?.nextNodeId || '', label: node.optionB?.label || 'B' }
        ].forEach((option, optionIndex) => {
          if (!option.target) {
            const deadId = `${node.id}-${option.key}-dead`;
        const deadPos = {
          x: fromPos.x + 190,
          y: 278 + optionIndex * 110
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
    nodes.forEach((node) => {
      const pos = placed.get(node.id);
      if (pos) allPositions.set(node.id, { x: pos.x, y: pos.y, width: cardWidth, height: cardHeight });
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
          ${nodes.map((node, index) => {
            const pos = placed.get(node.id);
            return renderNodeCard(node, pos, index);
          }).join('')}
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

  function renderNodeCard(node, position = { x: 0, y: 0 }, index = 0) {
    const links = [];
    if (node.nextNodeId) links.push(`→ ${node.nextNodeId}`);
    if (node.optionA?.nextNodeId) links.push(`A → ${node.optionA.nextNodeId}`);
    if (node.optionB?.nextNodeId) links.push(`B → ${node.optionB.nextNodeId}`);
    return `
      <article class="graph-node graph-placed node-card ${node.id === state.currentNodeId ? 'active selected' : ''}" data-node-id="${node.id}" style="left:${position.x}px;top:${position.y}px;">
        <div class="row space-between">
          <div class="node-title">ACT ${index + 1}</div>
          <span class="pill">${escapeHtml(node.type)}</span>
        </div>
        <div class="subtle">num.${index + 1}</div>
        <div class="graph-links">${links.length ? links.map((link) => `<span class="pill">${escapeHtml(link)}</span>`).join('') : '<span class="subtle">尚未連線</span>'}</div>
        <div class="graph-node-actions">
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

    const header = document.createElement('div');
    header.className = 'editor-selection';
    header.innerHTML = `
      <div>
        <div class="editor-selection-title">${escapeHtml(context.targetType === 'page' ? (context.page?.title || '目前頁面') : node.title)}</div>
        <div class="editor-selection-meta">
          ${escapeHtml(context.targetType === 'page'
            ? `正在編輯第 ${context.pageIndex + 1} 張卡`
            : context.targetType === 'choice'
              ? '正在編輯選項卡'
              : '正在編輯節點主卡')}
        </div>
      </div>
    `;
    const saveButton = document.createElement('button');
    saveButton.className = 'button';
    saveButton.textContent = context.targetType === 'page' ? '儲存這一張卡' : '儲存目前卡片';
    saveButton.addEventListener('click', handleSaveStory);
    header.appendChild(saveButton);
    wrapper.appendChild(header);

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

  function renderFieldGrid(node, story) {
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
      createField('圖片', imageInput(node.imagePath, (value) => updateNodeField('imagePath', value))),
      createField('大圖透明度', decimalInput(node.heroImageOpacity ?? 1, 0, 1, 0.05, (value) => updateNodeField('heroImageOpacity', value))),
      createField('大圖縮放', rangeInput(node.heroImageScale ?? 1, 1, 2.5, 0.05, (value) => updateNodeField('heroImageScale', value), (value) => `${Number(value).toFixed(2)}x`)),
      createField('下一節點', select(nextNodeOptions(story), node.nextNodeId || '', (value) => updateNodeField('nextNodeId', value))),
      createField('LINE 字級', select(textSizeOptions(), node.lineTextSize || 'lg', (value) => updateNodeField('lineTextSize', value))),
      createField('文字顏色', colorInput(node.lineTextColor || '#2D241B', (value) => updateNodeField('lineTextColor', value))),
      createField('姓名牌大小', nameplateSizeSlider(node.nameplateSize || 'lg', (value) => updateNodeField('nameplateSize', value))),
      createField('主講角色', select(characterOptions(true), node.speakerCharacterId || '', (value) => updateNodeField('speakerCharacterId', value))),
      createField('陪襯角色', select(characterOptions(true), node.companionCharacterId || '', (value) => updateNodeField('companionCharacterId', value))),
      createField('繼續按鈕文字', input(node.continueLabel || '下一步', (value) => updateNodeField('continueLabel', value))),
      createField('圖上位置 X', numberInput(node.position?.x || 0, (value) => updateNodePosition('x', value))),
      createField('圖上位置 Y', numberInput(node.position?.y || 0, (value) => updateNodePosition('y', value)))
    );
    container.appendChild(createField('文字', textarea(node.text || '', (value) => updateNodeField('text', value)), 'single'));
    return container;
  }

  function renderSelectedPageEditor(node, page, pageIndex) {
    const wrap = document.createElement('div');
    wrap.className = 'stack';

    const section = document.createElement('section');
    section.className = 'panel';
    section.style.padding = '14px';
    const heading = document.createElement('div');
    heading.className = 'row space-between';
    heading.innerHTML = `<h3>${escapeHtml(page.title || `第 ${pageIndex + 1} 頁`)}</h3>`;
    const saveButton = document.createElement('button');
    saveButton.className = 'button good';
    saveButton.textContent = '儲存這一頁';
    saveButton.addEventListener('click', handleSaveStory);
    heading.appendChild(saveButton);
    section.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'field-grid';
    grid.append(
      createField('頁面標題', input(page.title || '', (value) => updatePageField(node, pageIndex, 'title', value))),
      createField('頁面卡型', select([
        ['dialogue', '對話卡'],
        ['narration', '旁白卡']
      ], page.cardType || 'dialogue', (value) => updatePageField(node, pageIndex, 'cardType', value))),
      createField('頁面圖片', imageInput(page.imagePath, (value) => updatePageField(node, pageIndex, 'imagePath', value))),
      createField('大圖透明度', decimalInput(page.heroImageOpacity ?? 1, 0, 1, 0.05, (value) => updatePageField(node, pageIndex, 'heroImageOpacity', value))),
      createField('大圖縮放', rangeInput(page.heroImageScale ?? 1, 1, 2.5, 0.05, (value) => updatePageField(node, pageIndex, 'heroImageScale', value), (value) => `${Number(value).toFixed(2)}x`)),
      createField('主講角色', select(characterOptions(true), page.speakerCharacterId || '', (value) => updatePageField(node, pageIndex, 'speakerCharacterId', value))),
      createField('陪襯角色', select(characterOptions(true), page.companionCharacterId || '', (value) => updatePageField(node, pageIndex, 'companionCharacterId', value))),
      createField('LINE 字級', select(textSizeOptions(), page.lineTextSize || 'lg', (value) => updatePageField(node, pageIndex, 'lineTextSize', value))),
      createField('文字顏色', colorInput(page.lineTextColor || '#2D241B', (value) => updatePageField(node, pageIndex, 'lineTextColor', value))),
      createField('姓名牌大小', nameplateSizeSlider(page.nameplateSize || 'lg', (value) => updatePageField(node, pageIndex, 'nameplateSize', value)))
    );
    grid.appendChild(createField('頁面文字', textarea(page.text || '', (value) => updatePageField(node, pageIndex, 'text', value)), 'single'));
    section.appendChild(grid);
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
    saveButton.textContent = '儲存這張選項卡';
    saveButton.addEventListener('click', handleSaveStory);
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
      createField('回饋', textarea(node.optionA?.feedback || '', (value) => updateChoiceField('optionA', 'feedback', value)))
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
      createField('回饋', textarea(node.optionB?.feedback || '', (value) => updateChoiceField('optionB', 'feedback', value)))
    );
    optionBPanel.appendChild(optionBGrid);

    optionsGrid.append(optionAPanel, optionBPanel);
    container.appendChild(optionsGrid);
    return container;
  }

  function renderPreviewOnly() {
    dom.previewTabs.forEach((button) => button.classList.toggle('active', button.dataset.previewPanel === state.previewPanel));
    Object.entries(dom.previewPanels).forEach(([key, panel]) => panel.classList.toggle('active', key === state.previewPanel));
    dom.previewStatus.textContent = [state.previewStatus, ...state.previewIssues.map((issue) => `• ${issue.message}`)].join('\n');
    dom.scenePreview.innerHTML = '';
    dom.payloadPreview.textContent = state.preview ? JSON.stringify(state.preview.payload, null, 2) : '{}';
    const total = state.preview?.models?.length || 0;
    dom.previewCounter.textContent = total ? `共 ${total} 張` : '0 張';
    const current = currentPreviewModel();
    dom.previewOutputMeta.textContent = current?.renderedImagePath
      ? `目前實際輸出圖: ${current.renderedImagePath}`
      : '目前尚未產生輸出圖。';
    if (!state.preview || !total) return;
    state.preview.models.forEach((model, index) => {
      dom.scenePreview.appendChild(renderPreviewModel(model, index));
    });
  }

  function renderPreviewModel(model, index) {
    if (model.renderedImageUrl) return renderRenderedImagePreview(model, index);
    if (model.kind === 'choice') return renderChoicePreview(model, index);
    const wrapper = document.createElement('div');
    wrapper.className = `preview-card ${index === state.previewIndex ? 'selected' : ''}`;
    wrapper.dataset.previewIndex = String(index);
    const meta = document.createElement('div');
    meta.className = 'preview-meta';
    meta.innerHTML = `
      <div class="preview-meta-main">
        <strong>${escapeHtml(model.title || '未命名卡片')}</strong>
        <div class="subtle">${escapeHtml(model.kind === 'dialogue' ? '對話卡' : model.kind === 'narration' ? '旁白卡' : '選項卡')}</div>
      </div>
      <span class="pill">${escapeHtml(model.kind === 'dialogue' ? '對話' : model.kind === 'narration' ? '旁白' : '選項')}</span>
    `;
    const article = document.createElement('article');
    article.className = 'rpg-scene';
    article.style.height = `${model.layout.totalHeight}px`;
    article.style.position = 'relative';
    const stage = document.createElement('div');
    stage.className = 'rpg-stage';
    stage.style.height = `${model.layout.heroHeight}px`;
    stage.style.position = 'absolute';
    stage.style.left = '0';
    stage.style.right = '0';
    stage.style.top = '0';
    const hero = document.createElement('img');
    hero.className = 'hero';
    hero.src = model.imageUrl;
    hero.style.height = `${model.layout.heroHeight}px`;
    hero.style.opacity = `${model.heroImageOpacity ?? 1}`;
    stage.appendChild(hero);

    if (model.kind === 'dialogue') {
      [model.speaker, model.companion].filter(Boolean).forEach((role, index) => {
        const avatar = document.createElement('div');
        avatar.className = 'rpg-avatar';
        avatar.style.width = `${role.avatarSize}px`;
        avatar.style.height = `${role.avatarSize}px`;
        avatar.style.top = `${role.avatarY}px`;
        if (role.placement === 'left') avatar.style.left = `${role.avatarX}px`;
        else avatar.style.right = `${role.avatarX}px`;
        avatar.innerHTML = `<img src="${escapeHtml(role.avatarPath)}" alt="${escapeHtml(role.name)}">`;
        if (index === 0) {
          const preset = state.globalSettings.nameplateSizePresets[model.nameplateSize] || state.globalSettings.nameplateSizePresets.lg;
          const plate = document.createElement('div');
          plate.className = 'rpg-nameplate';
          plate.textContent = role.name;
          plate.style.top = `${role.nameplateY}px`;
          plate.style.background = role.nameplateColor;
          plate.style.color = role.nameplateTextColor;
          plate.style.padding = `${preset.paddingY}px ${preset.paddingX}px`;
          plate.style.borderRadius = `${preset.cornerRadius}px`;
          plate.style.fontSize = preset.label === 'xl' ? '19px' : preset.label === 'md' ? '15px' : '17px';
          if (role.nameplateAnchor === 'right-percent') plate.style.right = `${role.nameplateRightPercent}%`;
          else if (role.nameplateAnchor === 'right-fixed') plate.style.right = `${role.nameplateX}px`;
          else plate.style.left = `${role.nameplateX}px`;
          stage.appendChild(plate);
        }
        stage.appendChild(avatar);
      });
    }

    const body = document.createElement('div');
    body.className = 'rpg-body';
    body.style.height = `${model.layout.bodyHeight}px`;
    body.style.position = 'absolute';
    body.style.left = '0';
    body.style.right = '0';
    body.style.top = `${model.layout.intersectionY}px`;
    body.style.paddingTop = `${model.layout.bodyPaddingTop}px`;
    body.style.paddingBottom = `${model.layout.bodyPaddingBottom}px`;
    body.style.paddingLeft = `${model.kind === 'dialogue' && model.speaker?.placement === 'left' ? model.layout.leftSafePadding : model.layout.bodyPaddingSide}px`;
    body.style.paddingRight = `${model.kind === 'dialogue' && model.speaker?.placement === 'right' ? model.layout.rightSafePadding : model.layout.bodyPaddingSide}px`;
    const text = document.createElement('div');
    text.className = 'rpg-text';
    text.style.fontSize = model.lineTextSize === 'xl' ? '24px' : model.lineTextSize === 'md' ? '18px' : '20px';
    text.style.fontFamily = previewFontCss(model.previewFont);
    text.style.color = model.lineTextColor || '#2D241B';
    text.style.minHeight = `${model.layout.bodyHeight - model.layout.bodyPaddingTop - model.layout.bodyPaddingBottom}px`;
    text.textContent = model.text;
    body.appendChild(text);
    article.append(stage, body);
    wrapper.append(meta, article);
    wrapper.addEventListener('click', () => {
      state.previewIndex = index;
      renderPreviewOnly();
      renderNodeEditor();
    });
    return wrapper;
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
        <div class="subtle">${escapeHtml(model.kind === 'dialogue' ? '對話卡' : model.kind === 'narration' ? '旁白卡' : '選項卡')}</div>
      </div>
      <span class="pill">實際輸出</span>
    `;
    const article = document.createElement('article');
    article.className = 'rpg-scene';
    article.style.height = `${model.layout.totalHeight}px`;
    article.innerHTML = `<img class="hero" src="${escapeHtml(model.renderedImageUrl)}" alt="${escapeHtml(model.title || '')}" style="width:100%;height:100%;display:block;object-fit:cover;">`;
    wrapper.append(meta, article);
    wrapper.addEventListener('click', () => {
      state.previewIndex = index;
      renderPreviewOnly();
      renderNodeEditor();
    });
    return wrapper;
  }

  function renderChoicePreview(model, index = 0) {
    if (model.renderedImageUrl) return renderRenderedImagePreview(model, index);
    const wrapper = document.createElement('div');
    wrapper.className = `preview-card ${index === state.previewIndex ? 'selected' : ''}`;
    wrapper.dataset.previewIndex = String(index);
    const meta = document.createElement('div');
    meta.className = 'preview-meta';
    meta.innerHTML = `
      <div class="preview-meta-main">
        <strong>${escapeHtml(model.title || '選項卡')}</strong>
        <div class="subtle">選項卡</div>
      </div>
      <span class="pill">${escapeHtml(model.kind)}</span>
    `;
    const article = document.createElement('article');
    article.className = 'rpg-scene';
    article.style.height = `${model.layout.totalHeight}px`;
    article.innerHTML = `
      <div class="rpg-stage" style="height:${model.layout.heroHeight}px;">
        <img class="hero" src="${escapeHtml(model.imageUrl)}" style="height:${model.layout.heroHeight}px;opacity:${model.heroImageOpacity ?? 1};transform:scale(${model.heroImageScale ?? 1});transform-origin:center center;" alt="">
      </div>
      <div class="rpg-body" style="height:${model.layout.questionHeight + model.layout.actionsHeight}px;padding:18px ${model.layout.bodyPaddingSide}px;">
        <div class="rpg-text" style="min-height:${model.layout.questionHeight - 12}px;font-size:20px;font-weight:800;">${escapeHtml(model.prompt)}</div>
        <div class="choice-actions">
          <button class="choice-button" style="background:#F3BD63;">${escapeHtml(model.optionA.label)}</button>
          <button class="choice-button" style="background:#D8E0EF;">${escapeHtml(model.optionB.label)}</button>
        </div>
      </div>
    `;
    wrapper.append(meta, article);
    wrapper.addEventListener('click', () => {
      state.previewIndex = index;
      renderPreviewOnly();
      renderNodeEditor();
    });
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

  function input(value, onInput) {
    const element = document.createElement('input');
    element.value = value ?? '';
    element.addEventListener('input', () => onInput(element.value));
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
      default: 'LINE 預設字體'
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
    if (type === 'choice') return '選項卡';
    if (type === 'carousel') return '多頁訊息';
    return type || '未分類';
  }

  function updateNodeField(field, value) {
    const node = currentNode();
    if (!node) return;
    node[field] = value;
    schedulePreview();
  }

  function updateNodePosition(axis, value) {
    const node = currentNode();
    if (!node) return;
    node.position[axis] = value;
    schedulePreview();
  }

  function moveStoryNode(nodeId, delta) {
    const story = currentStory();
    if (!story) return;
    const index = story.nodes.findIndex((node) => node.id === nodeId);
    const nextIndex = index + delta;
    if (index < 0 || nextIndex < 0 || nextIndex >= story.nodes.length) return;
    const [node] = story.nodes.splice(index, 1);
    story.nodes.splice(nextIndex, 0, node);
    state.previewStatus = 'Block 順序已調整，記得按「儲存故事」。';
    renderStories();
  }

  function clearDeletedNodeReferences(story, deletedNodeId) {
    story.nodes.forEach((node) => {
      if (node.nextNodeId === deletedNodeId) node.nextNodeId = '';
      if (node.optionA?.nextNodeId === deletedNodeId) node.optionA.nextNodeId = '';
      if (node.optionB?.nextNodeId === deletedNodeId) node.optionB.nextNodeId = '';
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
    state.previewStatus = '節點已刪除，相關連線已清空，記得按「儲存故事」。';
    renderStories();
    refreshPreview().catch(console.error);
  }

  function updatePageField(node, pageIndex, field, value) {
    node.pages[pageIndex][field] = value;
    schedulePreview();
  }

  function updateChoiceField(optionKey, field, value) {
    const node = currentNode();
    if (!node) return;
    node[optionKey][field] = value;
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
    if (type === 'narration') {
      node.speakerCharacterId = '';
      node.companionCharacterId = '';
    }
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
      speakerCharacterId: 'char-bear',
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

(function () {
  const apiBase = window.ADMIN_API_BASE;
  const moduleCatalog = [
    {
      type: 'narrative',
      icon: '景',
      label: '敘事圖片',
      description: '單張敘事圖片加文字，適合建立場景與過場。',
      color: '#d98045'
    },
    {
      type: 'fullscreen',
      icon: '滿',
      label: '滿版訊息',
      description: '用單張大圖或單段重點文字做情緒強化與關鍵轉場。',
      color: '#c57c62'
    },
    {
      type: 'choice',
      icon: '岔',
      label: '選項分支',
      description: '建立兩個選項、兩條指向與對應回應。',
      color: '#5b8191'
    },
    {
      type: 'carousel',
      icon: '頁',
      label: '多頁訊息',
      description: '橫向多頁卡片，每張可設定不同底圖與角色。',
      color: '#6e9474'
    },
    {
      type: 'dialogue',
      icon: '話',
      label: '對話框',
      description: '角色說話或旁白提示，適合承接情緒與節奏。',
      color: '#9377b0'
    }
  ];

  const state = {
    stories: [],
    activeStoryId: null,
    activeNodeId: null,
    activeTopTab: 'create',
    suggestions: [],
    analysis: null,
    dragNodeId: null,
    drawerOpen: false
  };

  const storyTabs = document.getElementById('story-tabs');
  const newStoryTitle = document.getElementById('new-story-title');
  const characterLibrary = document.getElementById('character-library');
  const palette = document.getElementById('palette');
  const storyboard = document.getElementById('storyboard');
  const storyboardMeta = document.getElementById('storyboard-meta');
  const scenePreview = document.getElementById('scene-preview');
  const nodeInspector = document.getElementById('node-inspector');
  const scriptInput = document.getElementById('script-input');
  const suggestionList = document.getElementById('suggestion-list');
  const analysisPanel = document.getElementById('analysis-panel');
  const previewStructure = document.getElementById('preview-structure');
  const previewChat = document.getElementById('preview-chat');
  const previewJson = document.getElementById('preview-json');
  const createView = document.getElementById('create-view');
  const previewView = document.getElementById('preview-view');
  const drawerShell = document.getElementById('script-drawer-shell');
  const workspace = document.getElementById('workspace');

  function uid(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function escapeHtml(value) {
    return `${value || ''}`
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function truncate(text, max = 120) {
    if (!text) return '';
    return text.length > max ? `${text.slice(0, max)}...` : text;
  }

  function nodeTypeInfo(type) {
    return moduleCatalog.find((item) => item.type === type) || moduleCatalog[0];
  }

  function defaultCharacters() {
    return [
      {
        id: 'char-bear',
        name: '熊熊',
        avatar: '',
        placement: 'left-lower',
        role: 'lead'
      },
      {
        id: 'char-lily',
        name: '莉莉',
        avatar: '',
        placement: 'right-lower',
        role: 'support'
      }
    ];
  }

  function ensureStoryDefaults(story) {
    story.characters ||= defaultCharacters().map((character) => ({ ...character }));

    const defaults = defaultCharacters();
    defaults.forEach((preset) => {
      let found = story.characters.find((character) => character.id === preset.id);
      if (!found) {
        story.characters.push({ ...preset });
        found = story.characters.find((character) => character.id === preset.id);
      }
      found.name ||= preset.name;
      found.avatar ||= '';
      found.placement ||= preset.placement;
      found.role ||= preset.role;
    });
  }

  function activeStory() {
    return state.stories.find((story) => story.id === state.activeStoryId) || null;
  }

  function activeNode() {
    const story = activeStory();
    return story?.nodes.find((node) => node.id === state.activeNodeId) || null;
  }

  async function api(path, options = {}) {
    const response = await fetch(`${apiBase}${path}`, {
      headers: {
        ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(options.headers || {})
      },
      ...options
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || `Request failed: ${response.status}`);
    }
    return data;
  }

  async function uploadFile(file) {
    const form = new FormData();
    form.append('file', file);
    return api('/upload-image', {
      method: 'POST',
      body: form
    });
  }

  function emptyPage(index = 1) {
    return {
      title: `第 ${index} 頁`,
      speaker: '旁白',
      text: '',
      image: ''
    };
  }

  function ensureNodeDefaults(node) {
    const story = activeStory();
    const defaultSpeakerId = story?.characters?.[0]?.id || '';
    const defaultCompanionId = story?.characters?.[1]?.id || '';

    node.id ||= uid('node');
    node.type ||= 'narrative';
    node.title ||= `新的${nodeTypeInfo(node.type).label}`;
    node.speaker ||= '';
    node.speakerCharacterId ||= inferCharacterIdFromSpeaker(node.speaker);
    node.companionCharacterId ||= '';
    node.text ||= '';
    node.image ||= '';
    node.nextNodeId ||= '';

    if (node.type === 'choice') {
      node.optionA ||= { label: '選項 A', feedback: '', nextNodeId: '' };
      node.optionB ||= { label: '選項 B', feedback: '', nextNodeId: '' };
      node.optionA.label ||= '選項 A';
      node.optionB.label ||= '選項 B';
      node.optionA.feedback ||= '';
      node.optionB.feedback ||= '';
      node.optionA.nextNodeId ||= '';
      node.optionB.nextNodeId ||= '';
    }

    if (node.type === 'carousel') {
      node.pages ||= [emptyPage(1)];
      if (!node.pages.length) {
        node.pages.push(emptyPage(1));
      }
      node.pages.forEach((page, index) => {
        page.title ||= `第 ${index + 1} 頁`;
        page.speaker ||= '旁白';
        page.speakerCharacterId ||= inferCharacterIdFromSpeaker(page.speaker);
        page.companionCharacterId ||= '';
        page.text ||= '';
        page.image ||= '';
      });
    }

    if (node.type === 'dialogue') {
      node.speakerCharacterId ||= defaultSpeakerId;
      node.companionCharacterId ||= defaultCompanionId;
    }
  }

  function moduleTemplate(type) {
    if (type === 'fullscreen') {
      return {
        id: uid('fullscreen'),
        type,
        title: '新的滿版訊息',
        speaker: '旁白',
        text: '在這裡輸入關鍵訊息。',
        image: '',
        nextNodeId: ''
      };
    }

    if (type === 'choice') {
      return {
        id: uid('choice'),
        type,
        title: '新的選項分支',
        text: '在這裡輸入提問或情境。',
        image: '',
        optionA: { label: '選項 A', feedback: '', nextNodeId: '' },
        optionB: { label: '選項 B', feedback: '', nextNodeId: '' }
      };
    }

    if (type === 'carousel') {
      return {
        id: uid('carousel'),
        type,
        title: '新的多頁訊息',
        pages: [{
          ...emptyPage(1),
          speakerCharacterId: '',
          companionCharacterId: ''
        }],
        nextNodeId: ''
      };
    }

    if (type === 'dialogue') {
      return {
        id: uid('dialogue'),
        type,
        title: '新的對話框',
        speaker: '熊熊',
        speakerCharacterId: 'char-bear',
        companionCharacterId: 'char-lily',
        text: '在這裡輸入角色對話。',
        image: '',
        nextNodeId: ''
      };
    }

    return {
      id: uid('narrative'),
      type: 'narrative',
      title: '新的敘事圖片',
      speaker: '旁白',
      text: '在這裡輸入敘事文字。',
      image: '',
      nextNodeId: ''
    };
  }

  function nodeSummary(node) {
    if (node.type === 'choice') {
      return `${node.optionA?.label || '選項 A'}\n${node.optionB?.label || '選項 B'}`;
    }
    if (node.type === 'carousel') {
      return `${node.pages?.length || 0} 頁多頁訊息`;
    }
    return node.text || '尚未填寫內容';
  }

  function targetTitle(targetId) {
    if (!targetId) return '未連接';
    const story = activeStory();
    const target = story?.nodes.find((node) => node.id === targetId);
    return target ? target.title : '未連接';
  }

  function characterById(characterId) {
    const story = activeStory();
    return story?.characters?.find((character) => character.id === characterId) || null;
  }

  function inferCharacterIdFromSpeaker(speaker = '') {
    const story = activeStory();
    const normalized = `${speaker}`.replace(/[（(].*?[）)]/g, '').trim();
    return story?.characters?.find((character) => normalized.includes(character.name) || character.name.includes(normalized))?.id || '';
  }

  function characterPlacement(characterId) {
    return characterById(characterId)?.placement || 'left-lower';
  }

  function characterLabel(characterId, fallback = '角色') {
    return characterById(characterId)?.name || fallback;
  }

  function roleSelect(value, onChange, options = {}) {
    const story = activeStory();
    const select = document.createElement('select');
    const allowEmpty = options.allowEmpty !== false;
    select.innerHTML = `${allowEmpty ? '<option value="">未指定</option>' : ''}${(story?.characters || []).map((character) => `<option value="${character.id}">${escapeHtml(character.name)}</option>`).join('')}`;
    select.value = value || '';
    select.onchange = (event) => onChange(event.target.value);
    return select;
  }

  function roleNameplateClass(characterId) {
    const placement = characterPlacement(characterId);
    return placement.startsWith('right') ? 'right' : 'left';
  }

  async function loadStories() {
    const { stories } = await api('/stories');
    state.stories = stories.map((story) => ({
      ...story,
      nodes: (story.nodes || []).map((node) => ({ ...node }))
    }));
    state.stories.forEach(ensureStoryDefaults);
    if (state.stories[0]) {
      state.activeStoryId = state.stories[0].id;
      state.activeNodeId = state.stories[0].nodes[0]?.id || null;
    }
    render();
  }

  async function createStory() {
    const title = newStoryTitle.value.trim();
    const { story } = await api('/stories', {
      method: 'POST',
      body: JSON.stringify({ title })
    });
    ensureStoryDefaults(story);
    state.stories.push(story);
    state.activeStoryId = story.id;
    state.activeNodeId = story.nodes[0]?.id || null;
    newStoryTitle.value = '';
    render();
  }

  async function saveStory() {
    const story = activeStory();
    if (!story) return;
    ensureStoryDefaults(story);

    const payload = {
      ...story,
      nodes: story.nodes.map((node) => ({ ...node }))
    };

    const { story: saved } = await api(`/stories/${story.id}`, {
      method: 'PUT',
      body: JSON.stringify({ story: payload })
    });

    const index = state.stories.findIndex((item) => item.id === story.id);
    state.stories[index] = saved;
    render();
  }

  function setActiveStory(storyId) {
    state.activeStoryId = storyId;
    state.activeNodeId = activeStory()?.nodes[0]?.id || null;
    render();
  }

  function addNode(type, initialData = {}) {
    const story = activeStory();
    if (!story) return;
    const node = { ...moduleTemplate(type), ...initialData };
    ensureNodeDefaults(node);
    story.nodes.push(node);
    state.activeNodeId = node.id;
    render();
  }

  function duplicateNode(node) {
    addNode(node.type, JSON.parse(JSON.stringify({
      ...node,
      id: uid(node.type),
      title: `${node.title} Copy`
    })));
  }

  function removeNode(nodeId) {
    const story = activeStory();
    if (!story) return;
    story.nodes = story.nodes.filter((node) => node.id !== nodeId);
    story.nodes.forEach((node) => {
      if (node.nextNodeId === nodeId) node.nextNodeId = '';
      if (node.optionA?.nextNodeId === nodeId) node.optionA.nextNodeId = '';
      if (node.optionB?.nextNodeId === nodeId) node.optionB.nextNodeId = '';
    });
    if (state.activeNodeId === nodeId) {
      state.activeNodeId = story.nodes[0]?.id || null;
    }
    render();
  }

  function reorderNodes(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return;
    const story = activeStory();
    if (!story) return;

    const fromIndex = story.nodes.findIndex((node) => node.id === fromId);
    const toIndex = story.nodes.findIndex((node) => node.id === toId);
    if (fromIndex === -1 || toIndex === -1) return;

    const [item] = story.nodes.splice(fromIndex, 1);
    story.nodes.splice(toIndex, 0, item);
    render();
  }

  async function analyzeScript() {
    const story = activeStory();
    const script = scriptInput.value.trim();
    if (!script) return;

    const { analysis } = await api('/analyze-script', {
      method: 'POST',
      body: JSON.stringify({
        script,
        existingNodes: story?.nodes || [],
        characters: story?.characters || []
      })
    });

    state.analysis = analysis;
    state.suggestions = analysis.suggestedNodes || [];

    if (analysis.title && story && (!story.title || /^Story \d+$/.test(story.title))) {
      story.title = analysis.title;
    }

    render();
  }

  function applySuggestion(index) {
    const suggestion = state.suggestions[index];
    if (!suggestion) return;
    addNode(suggestion.type, JSON.parse(JSON.stringify(suggestion)));
    state.suggestions.splice(index, 1);
    render();
  }

  function applyAllSuggestions() {
    if (!state.suggestions.length) return;
    const items = state.suggestions.map((item) => JSON.parse(JSON.stringify(item)));
    items.forEach((item) => addNode(item.type, item));
    state.suggestions = [];
    state.drawerOpen = false;
    render();
  }

  function clearSuggestions() {
    state.suggestions = [];
    state.analysis = null;
    render();
  }

  function openDrawer() {
    state.drawerOpen = true;
    renderDrawer();
  }

  function closeDrawer() {
    state.drawerOpen = false;
    renderDrawer();
  }

  function renderStoryTabs() {
    storyTabs.innerHTML = '';
    state.stories.forEach((story) => {
      const button = document.createElement('button');
      button.className = `story-pill ${story.id === state.activeStoryId ? 'active' : ''}`;
      button.textContent = story.title || 'Untitled';
      button.onclick = () => setActiveStory(story.id);
      storyTabs.appendChild(button);
    });
  }

  function renderPalette() {
    palette.innerHTML = '';
    moduleCatalog.forEach((module) => {
      const button = document.createElement('button');
      button.className = 'palette-item';
      button.dataset.type = module.type;
      button.innerHTML = `
        <div class="palette-icon">${module.icon}</div>
        <div>
          <div class="palette-label">${module.label}</div>
          <div class="palette-desc">${module.description}</div>
        </div>
      `;
      button.onclick = () => addNode(module.type);
      palette.appendChild(button);
    });
  }

  function renderCharacterLibrary() {
    characterLibrary.innerHTML = '';
    const story = activeStory();
    if (!story) {
      characterLibrary.innerHTML = '<div class="empty">先建立 Story 才能設定角色。</div>';
      return;
    }

    ensureStoryDefaults(story);

    story.characters.forEach((character) => {
      const card = document.createElement('div');
      card.className = 'character-card';
      const avatarHtml = character.avatar
        ? `<img class="character-avatar" src="${escapeHtml(character.avatar)}" alt="">`
        : `<div class="character-avatar placeholder">${escapeHtml(character.name.slice(0, 1) || '角')}</div>`;
      card.innerHTML = `
        ${avatarHtml}
        <div>
          <div class="character-title">${escapeHtml(character.name)}</div>
          <div class="character-meta">
            <span class="meta-pill">${character.role === 'lead' ? '主角' : '配角'}</span>
            <span class="meta-pill">${character.placement === 'left-lower' ? '左下' : character.placement === 'right-lower' ? '右下' : character.placement}</span>
          </div>
        </div>
      `;

      const controls = document.createElement('div');
      controls.className = 'field';
      const content = card.children[1];

      content.appendChild(field('角色名稱', textInput(character.name, (value) => {
        character.name = value || '新角色';
        render();
      })));

      const roleSelectEl = document.createElement('select');
      roleSelectEl.innerHTML = `
        <option value="lead">主角</option>
        <option value="support">配角</option>
      `;
      roleSelectEl.value = character.role || 'support';
      roleSelectEl.onchange = (event) => {
        character.role = event.target.value;
        if (character.role === 'lead') {
          character.placement = 'left-lower';
        } else if (character.placement === 'left-lower' && character.id !== 'char-bear') {
          character.placement = 'right-lower';
        }
        render();
      };
      content.appendChild(field('角色定位', roleSelectEl));

      const placementSelect = document.createElement('select');
      placementSelect.innerHTML = `
        <option value="left-lower">左側下三分之二</option>
        <option value="right-lower">右側下三分之二</option>
        <option value="left-upper">左側上方</option>
        <option value="right-upper">右側上方</option>
      `;
      placementSelect.value = character.placement || 'right-lower';
      placementSelect.onchange = (event) => {
        character.placement = event.target.value;
        render();
      };
      content.appendChild(field('站位規則', placementSelect));

      content.appendChild(field('角色頭像', uploadField(character.avatar, (url) => {
        character.avatar = url;
        render();
      })));
      characterLibrary.appendChild(card);
    });
  }

  function addCharacter() {
    const story = activeStory();
    if (!story) return;
    ensureStoryDefaults(story);
    story.characters.push({
      id: uid('char'),
      name: `角色 ${story.characters.length + 1}`,
      avatar: '',
      placement: 'right-lower',
      role: 'support'
    });
    render();
  }

  function renderStoryboardMeta(story) {
    if (!story) {
      storyboardMeta.textContent = '';
      return;
    }

    storyboardMeta.textContent = `${story.nodes.length} 幕 · ${countNodes(story.nodes, 'choice')} 個分支 · ${countNodes(story.nodes, 'carousel')} 個多頁訊息`;
  }

  function renderStoryboard() {
    storyboard.innerHTML = '';
    const story = activeStory();
    renderStoryboardMeta(story);

    if (!story || !story.nodes.length) {
      storyboard.innerHTML = '<div class="empty">這裡還沒有任何一幕。先從左邊加入模組，或先匯入劇本生成草稿。</div>';
      return;
    }

    story.nodes.forEach((node, index) => {
      ensureNodeDefaults(node);
      const info = nodeTypeInfo(node.type);

      const card = document.createElement('article');
      card.className = `story-node ${node.id === state.activeNodeId ? 'active' : ''}`;
      card.draggable = true;
      card.dataset.nodeId = node.id;

      const thumb = node.image ? `<img class="node-thumb" src="${escapeHtml(node.image)}" alt="">` : '';
      const pages = node.type === 'carousel'
        ? `<div class="story-node-pages">${node.pages.map((page, pageIndex) => `<span class="page-chip">第 ${pageIndex + 1} 頁</span>`).join('')}</div>`
        : '';
      const branches = node.type === 'choice'
        ? `<div class="story-node-branches">
            <span class="branch-chip">A: ${escapeHtml(node.optionA.label)}</span>
            <span class="branch-chip">B: ${escapeHtml(node.optionB.label)}</span>
          </div>`
        : '';

      const links = buildNodeLinks(node);
      const linksHtml = links.length
        ? `<div class="node-links">${links.map((link) => `<span class="link-chip">${escapeHtml(link)}</span>`).join('')}</div>`
        : '';

      card.innerHTML = `
        <div class="story-node-header">
          <span class="type-pill" style="background:${info.color}18;color:${info.color};">${info.icon} ${info.label}</span>
          <span class="node-index">第 ${index + 1} 幕</span>
        </div>
        <div class="story-node-title">${escapeHtml(node.title || info.label)}</div>
        <div class="story-node-summary">${escapeHtml(truncate(nodeSummary(node), 180))}</div>
        ${thumb}
        ${pages}
        ${branches}
        ${linksHtml}
        <div class="inline-actions">
          <button class="mini-btn" data-action="duplicate">複製</button>
          <button class="mini-btn" data-action="delete">刪除</button>
        </div>
      `;

      card.onclick = (event) => {
        const action = event.target?.dataset?.action;
        if (action === 'delete') {
          event.stopPropagation();
          removeNode(node.id);
          return;
        }
        if (action === 'duplicate') {
          event.stopPropagation();
          duplicateNode(node);
          return;
        }
        state.activeNodeId = node.id;
        render();
      };

      card.addEventListener('dragstart', () => {
        state.dragNodeId = node.id;
        card.classList.add('dragging');
      });

      card.addEventListener('dragend', () => {
        state.dragNodeId = null;
        card.classList.remove('dragging');
      });

      card.addEventListener('dragover', (event) => event.preventDefault());
      card.addEventListener('drop', (event) => {
        event.preventDefault();
        reorderNodes(state.dragNodeId, node.id);
      });

      storyboard.appendChild(card);
    });
  }

  function buildNodeLinks(node) {
    if (node.type === 'choice') {
      return [
        `A -> ${targetTitle(node.optionA.nextNodeId)}`,
        `B -> ${targetTitle(node.optionB.nextNodeId)}`
      ];
    }
    if (node.nextNodeId) {
      return [`Next -> ${targetTitle(node.nextNodeId)}`];
    }
    return [];
  }

  function renderDrawer() {
    drawerShell.classList.toggle('open', state.drawerOpen);
    renderSuggestions();
    renderAnalysis();
  }

  function renderSuggestions() {
    suggestionList.innerHTML = '';

    if (!state.suggestions.length) {
      suggestionList.innerHTML = '<div class="empty">分析後的 AI 劇本草稿會先出現在這裡。</div>';
      return;
    }

    state.suggestions.forEach((node, index) => {
      ensureNodeDefaults(node);
      const info = nodeTypeInfo(node.type);
      const card = document.createElement('article');
      card.className = 'story-node';
      card.innerHTML = `
        <div class="story-node-header">
          <span class="type-pill" style="background:${info.color}18;color:${info.color};">${info.icon} ${info.label}</span>
          <span class="node-index">草稿 ${index + 1}</span>
        </div>
        <div class="story-node-title">${escapeHtml(node.title || info.label)}</div>
        <div class="story-node-summary">${escapeHtml(truncate(nodeSummary(node), 160))}</div>
        <div class="inline-actions">
          <button class="mini-btn" data-add="${index}">加入故事軸</button>
        </div>
      `;
      card.querySelector('[data-add]').onclick = () => applySuggestion(index);
      suggestionList.appendChild(card);
    });
  }

  function renderAnalysis() {
    analysisPanel.innerHTML = '';
    if (!state.analysis) {
      analysisPanel.innerHTML = '<div class="empty">分析後，這裡會顯示劇本輪廓與建議分鏡。</div>';
      return;
    }

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="analysis-summary">
        <div class="stat"><strong>${state.analysis.comparison.existingModules}</strong>現有模組</div>
        <div class="stat"><strong>${state.analysis.comparison.suggestedModules}</strong>建議模組</div>
        <div class="stat"><strong>${state.analysis.sections.length}</strong>劇本段落</div>
      </div>
    `;

    const deltaList = document.createElement('div');
    deltaList.className = 'delta-list';
    state.analysis.comparison.deltas.forEach((delta) => {
      const item = document.createElement('div');
      item.className = 'delta-item';
      item.textContent = `${nodeTypeInfo(delta.type).label}: 目前 ${delta.existing} 個，建議 ${delta.suggested} 個`;
      deltaList.appendChild(item);
    });

    const outlineList = document.createElement('div');
    outlineList.className = 'outline-list';
    state.analysis.sections.slice(0, 10).forEach((section) => {
      const item = document.createElement('div');
      item.className = 'outline-item';
      item.innerHTML = `<strong>${escapeHtml(section.key)}</strong><br>${escapeHtml(section.preview)}`;
      outlineList.appendChild(item);
    });

    wrap.appendChild(deltaList);
    wrap.appendChild(outlineList);
    analysisPanel.appendChild(wrap);
  }

  function renderScenePreview() {
    scenePreview.innerHTML = '';
    const node = activeNode();
    if (!node) {
      scenePreview.innerHTML = '<div class="empty">先從中間故事軸選一幕，這裡就會顯示 LINE 預覽。</div>';
      return;
    }

    scenePreview.appendChild(buildNodePreview(node));
  }

  function renderNodeSelect(value, onChange) {
    const story = activeStory();
    const select = document.createElement('select');
    select.innerHTML = `<option value="">未連接</option>${(story?.nodes || []).map((node) => `<option value="${node.id}">${escapeHtml(node.title || node.id)}</option>`).join('')}`;
    select.value = value || '';
    select.onchange = (event) => onChange(event.target.value);
    return select;
  }

  function field(labelText, control) {
    const wrapper = document.createElement('div');
    wrapper.className = 'field';
    const label = document.createElement('label');
    label.textContent = labelText;
    wrapper.appendChild(label);
    wrapper.appendChild(control);
    return wrapper;
  }

  function textInput(value, onChange) {
    const input = document.createElement('input');
    input.value = value || '';
    input.oninput = (event) => onChange(event.target.value);
    return input;
  }

  function textArea(value, onChange) {
    const input = document.createElement('textarea');
    input.value = value || '';
    input.oninput = (event) => onChange(event.target.value);
    return input;
  }

  function uploadField(currentValue, onDone) {
    const wrapper = document.createElement('div');
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const { asset } = await uploadFile(file);
      onDone(asset.url);
      render();
    };

    wrapper.appendChild(input);
    if (currentValue) {
      const image = document.createElement('img');
      image.src = currentValue;
      image.className = 'node-thumb';
      wrapper.appendChild(image);
    }
    return wrapper;
  }

  function renderInspector() {
    nodeInspector.innerHTML = '';
    const story = activeStory();
    const node = activeNode();

    if (!story) {
      nodeInspector.className = 'empty';
      nodeInspector.innerHTML = '請先建立 Story。';
      return;
    }

    if (!node) {
      nodeInspector.className = '';
      const storyCard = document.createElement('div');
      storyCard.className = 'editor-layout';
      storyCard.appendChild(field('Story 名稱', textInput(story.title || '', (value) => {
        story.title = value;
        renderStoryTabs();
        renderPreviewTab();
      })));
      storyCard.appendChild(field('Story 描述', textArea(story.description || '', (value) => {
        story.description = value;
        renderPreviewTab();
      })));
      nodeInspector.appendChild(storyCard);
      return;
    }

    nodeInspector.className = '';
    ensureNodeDefaults(node);

    const editor = document.createElement('div');
    editor.className = 'editor-layout';
    const info = nodeTypeInfo(node.type);

    const intro = document.createElement('div');
    intro.className = 'hint';
    intro.textContent = `正在編輯：${info.label}。先確認上面的 LINE 預覽，再調整這一幕的內容與連線。`;
    editor.appendChild(intro);

    editor.appendChild(field('模組名稱', textInput(node.title, (value) => {
      node.title = value;
      render();
    })));

    if (node.type === 'choice') {
      editor.appendChild(field('提問內容', textArea(node.text, (value) => {
        node.text = value;
        render();
      })));
      editor.appendChild(field('背景圖', uploadField(node.image, (url) => {
        node.image = url;
        render();
      })));
      editor.appendChild(field('選項 A 標籤', textInput(node.optionA.label, (value) => {
        node.optionA.label = value;
        render();
      })));
      editor.appendChild(field('選項 A 回應', textArea(node.optionA.feedback, (value) => {
        node.optionA.feedback = value;
      })));
      editor.appendChild(field('選項 A 指向', renderNodeSelect(node.optionA.nextNodeId, (value) => {
        node.optionA.nextNodeId = value;
        render();
      })));
      editor.appendChild(field('選項 B 標籤', textInput(node.optionB.label, (value) => {
        node.optionB.label = value;
        render();
      })));
      editor.appendChild(field('選項 B 回應', textArea(node.optionB.feedback, (value) => {
        node.optionB.feedback = value;
      })));
      editor.appendChild(field('選項 B 指向', renderNodeSelect(node.optionB.nextNodeId, (value) => {
        node.optionB.nextNodeId = value;
        render();
      })));
    } else if (node.type === 'carousel') {
      node.pages.forEach((page, index) => {
        const pageCard = document.createElement('div');
        pageCard.className = 'panel-card';
        pageCard.style.margin = '0';
        pageCard.appendChild(field(`第 ${index + 1} 頁標題`, textInput(page.title, (value) => {
          page.title = value;
          render();
        })));
        pageCard.appendChild(field(`第 ${index + 1} 頁角色名稱`, textInput(page.speaker, (value) => {
          page.speaker = value;
          render();
        })));
        pageCard.appendChild(field(`第 ${index + 1} 頁主講角色`, roleSelect(page.speakerCharacterId, (value) => {
          page.speakerCharacterId = value;
          page.speaker = characterLabel(value, page.speaker || '旁白');
          render();
        })));
        pageCard.appendChild(field(`第 ${index + 1} 頁陪襯角色`, roleSelect(page.companionCharacterId, (value) => {
          page.companionCharacterId = value;
          render();
        })));
        pageCard.appendChild(field(`第 ${index + 1} 頁文字`, textArea(page.text, (value) => {
          page.text = value;
          render();
        })));
        pageCard.appendChild(field(`第 ${index + 1} 頁大圖`, uploadField(page.image, (url) => {
          page.image = url;
          render();
        })));
        const removeButton = document.createElement('button');
        removeButton.className = 'button soft';
        removeButton.textContent = '刪掉這一頁';
        removeButton.onclick = () => {
          node.pages.splice(index, 1);
          if (!node.pages.length) node.pages.push(emptyPage(1));
          render();
        };
        pageCard.appendChild(removeButton);
        editor.appendChild(pageCard);
      });

      const addPageButton = document.createElement('button');
      addPageButton.className = 'button secondary';
      addPageButton.textContent = '新增一頁';
      addPageButton.onclick = () => {
        node.pages.push(emptyPage(node.pages.length + 1));
        render();
      };
      editor.appendChild(addPageButton);
      editor.appendChild(field('下一個模組', renderNodeSelect(node.nextNodeId, (value) => {
        node.nextNodeId = value;
        render();
      })));
    } else {
      if (node.type === 'dialogue') {
        editor.appendChild(field('主講角色', roleSelect(node.speakerCharacterId, (value) => {
          node.speakerCharacterId = value;
          node.speaker = characterLabel(value, node.speaker || '角色');
          render();
        }, { allowEmpty: false })));
        editor.appendChild(field('陪襯角色', roleSelect(node.companionCharacterId, (value) => {
          node.companionCharacterId = value;
          render();
        })));
      } else {
        editor.appendChild(field('角色名稱', textInput(node.speaker, (value) => {
          node.speaker = value;
          render();
        })));
      }
      editor.appendChild(field('文字內容', textArea(node.text, (value) => {
        node.text = value;
        render();
      })));
      editor.appendChild(field(node.type === 'fullscreen' ? '滿版圖' : node.type === 'dialogue' ? '場景大圖' : '圖片', uploadField(node.image, (url) => {
        node.image = url;
        render();
      })));
      editor.appendChild(field('下一個模組', renderNodeSelect(node.nextNodeId, (value) => {
        node.nextNodeId = value;
        render();
      })));
    }

    nodeInspector.appendChild(editor);
  }

  function buildAvatar(characterId, visibleName, forceNameplate) {
    if (!characterId) return '';
    const character = characterById(characterId);
    if (!character) return '';
    const avatar = character.avatar
      ? `<img src="${escapeHtml(character.avatar)}" alt="${escapeHtml(character.name)}">`
      : `<div class="rpg-avatar-fallback">${escapeHtml(character.name.slice(0, 1) || '角')}</div>`;
    const showNameplate = forceNameplate || false;
    const nameplate = showNameplate
      ? `<div class="rpg-nameplate ${roleNameplateClass(characterId)}">${escapeHtml(visibleName || character.name)}</div>`
      : '';
    return `
      <div class="rpg-avatar ${escapeHtml(character.placement)}">
        ${avatar}
        ${nameplate}
      </div>
    `;
  }

  function buildRpgScene({ image, speakerCharacterId, companionCharacterId, speaker, text, metaLabel }) {
    const effectiveSpeakerId = speakerCharacterId || inferCharacterIdFromSpeaker(speaker);
    const scene = document.createElement('article');
    scene.className = 'rpg-scene';
    scene.innerHTML = `
      <div class="rpg-stage">
        ${image ? `<img class="rpg-scene-image" src="${escapeHtml(image)}" alt="">` : `<div class="rpg-scene-image"></div>`}
        <div class="rpg-cast">
          ${buildAvatar(effectiveSpeakerId, speaker || characterLabel(effectiveSpeakerId, '角色'), true)}
          ${companionCharacterId && companionCharacterId !== effectiveSpeakerId ? buildAvatar(companionCharacterId, '', false) : ''}
        </div>
      </div>
      <div class="rpg-dialogue">
        <div class="rpg-dialogue-text">${escapeHtml(text || '')}</div>
        <div class="rpg-dialogue-meta">
          ${metaLabel ? `<span class="rpg-meta-pill">${escapeHtml(metaLabel)}</span>` : ''}
        </div>
      </div>
    `;
    return scene;
  }

  function buildNodePreview(node) {
    ensureNodeDefaults(node);

    if (node.type === 'dialogue') {
      return buildRpgScene({
        image: node.image,
        speakerCharacterId: node.speakerCharacterId,
        companionCharacterId: node.companionCharacterId,
        speaker: node.speaker || characterLabel(node.speakerCharacterId, '角色'),
        text: node.text,
        metaLabel: 'RPG 對話'
      });
    }

    if (node.type === 'carousel') {
      const wrap = document.createElement('div');
      wrap.className = 'line-carousel';
      node.pages.forEach((page) => {
        const pageEl = buildRpgScene({
          image: page.image,
          speakerCharacterId: page.speakerCharacterId,
          companionCharacterId: page.companionCharacterId,
          speaker: page.speaker || characterLabel(page.speakerCharacterId, '旁白'),
          text: page.text,
          metaLabel: page.title || '多頁訊息'
        });
        wrap.appendChild(pageEl);
      });
      return wrap;
    }

    if (node.type === 'choice') {
      const card = document.createElement('article');
      card.className = 'line-card';
      card.innerHTML = `
        ${node.image ? `<img class="line-card-image" src="${escapeHtml(node.image)}" alt="">` : ''}
        <div class="line-card-body">
          <span class="line-label">選項分支</span>
          <div class="line-text">${escapeHtml(node.text)}</div>
          <div class="line-actions">
            <button class="line-action">${escapeHtml(node.optionA.label)}</button>
            <button class="line-action">${escapeHtml(node.optionB.label)}</button>
          </div>
        </div>
      `;
      return card;
    }

    if (node.type === 'fullscreen') {
      const full = document.createElement('article');
      full.className = 'line-fullscreen';
      full.innerHTML = `
        ${node.image ? `<img class="line-fullscreen-image" src="${escapeHtml(node.image)}" alt="">` : ''}
        <div class="line-fullscreen-body">
          <span class="line-label">${escapeHtml(node.speaker || '旁白')}</span>
          <div class="line-text">${escapeHtml(node.text)}</div>
        </div>
      `;
      return full;
    }

    const card = document.createElement('article');
    card.className = 'line-card';
    card.innerHTML = `
      ${node.image ? `<img class="line-card-image" src="${escapeHtml(node.image)}" alt="">` : ''}
      <div class="line-card-body">
        <span class="line-label">${escapeHtml(node.speaker || '旁白')}</span>
        <div class="line-text">${escapeHtml(node.text)}</div>
      </div>
    `;
    return card;
  }

  function renderPreviewTab() {
    const story = activeStory();
    previewStructure.innerHTML = '';
    previewChat.innerHTML = '';
    previewJson.textContent = story ? JSON.stringify(story, null, 2) : '';

    if (!story) {
      previewStructure.innerHTML = '<div class="empty">先建立 Story。</div>';
      previewChat.innerHTML = '<div class="empty">先建立 Story。</div>';
      return;
    }

    if (!story.nodes.length) {
      previewStructure.innerHTML = '<div class="empty">還沒有任何一幕。</div>';
      previewChat.innerHTML = '<div class="empty">還沒有任何一幕可以預覽。</div>';
      return;
    }

    const structureWrap = document.createElement('div');
    structureWrap.className = 'section-stack';

    story.nodes.forEach((node, index) => {
      ensureNodeDefaults(node);
      const info = nodeTypeInfo(node.type);

      const item = document.createElement('article');
      item.className = 'story-node';
      item.style.margin = '0';
      item.innerHTML = `
        <div class="story-node-header">
          <span class="type-pill" style="background:${info.color}18;color:${info.color};">${info.icon} ${info.label}</span>
          <span class="node-index">第 ${index + 1} 幕</span>
        </div>
        <div class="story-node-title">${escapeHtml(node.title)}</div>
        <div class="story-node-summary">${escapeHtml(truncate(nodeSummary(node), 140))}</div>
      `;
      structureWrap.appendChild(item);

      const chatItem = document.createElement('div');
      chatItem.className = 'chat-item';
      chatItem.innerHTML = `
        <div class="chat-avatar" style="background:${info.color};">${info.icon}</div>
        <div class="chat-bubble"></div>
      `;
      chatItem.querySelector('.chat-bubble').appendChild(buildNodePreview(node));
      previewChat.appendChild(chatItem);
    });

    previewStructure.appendChild(structureWrap);
  }

  function renderTopTab() {
    document.querySelectorAll('[data-top-tab]').forEach((button) => {
      button.classList.toggle('active', button.dataset.topTab === state.activeTopTab);
    });
    createView.classList.toggle('active', state.activeTopTab === 'create');
    previewView.classList.toggle('active', state.activeTopTab === 'preview');
  }

  function render() {
    renderTopTab();
    renderStoryTabs();
    renderCharacterLibrary();
    renderPalette();
    renderStoryboard();
    renderScenePreview();
    renderInspector();
    renderPreviewTab();
    renderDrawer();
  }

  function countNodes(nodes, type) {
    return nodes.filter((node) => node.type === type).length;
  }

  function initResizableColumns() {
    const root = document.documentElement;
    const minLeft = 14;
    const minCenter = 30;
    const minRight = 24;

    function startResize(which, event) {
      event.preventDefault();
      const startX = event.clientX;
      const rect = workspace.getBoundingClientRect();
      const styles = getComputedStyle(root);
      const startLeft = parseFloat(styles.getPropertyValue('--left-width'));
      const startCenter = parseFloat(styles.getPropertyValue('--center-width'));
      const startRight = parseFloat(styles.getPropertyValue('--right-width'));

      function onMove(moveEvent) {
        const deltaPercent = ((moveEvent.clientX - startX) / rect.width) * 100;
        let left = startLeft;
        let center = startCenter;
        let right = startRight;

        if (which === 'left') {
          left = startLeft + deltaPercent;
          center = startCenter - deltaPercent;

          if (left < minLeft) {
            center -= minLeft - left;
            left = minLeft;
          }
          if (center < minCenter) {
            left -= minCenter - center;
            center = minCenter;
          }
        } else {
          center = startCenter + deltaPercent;
          right = startRight - deltaPercent;

          if (center < minCenter) {
            right -= minCenter - center;
            center = minCenter;
          }
          if (right < minRight) {
            center -= minRight - right;
            right = minRight;
          }
        }

        left = clamp(left, minLeft, 100 - minCenter - minRight);
        center = clamp(center, minCenter, 100 - minLeft - minRight);
        right = 100 - left - center;

        if (right < minRight) {
          right = minRight;
          center = 100 - left - right;
        }

        root.style.setProperty('--left-width', `${left}%`);
        root.style.setProperty('--center-width', `${center}%`);
        root.style.setProperty('--right-width', `${right}%`);
      }

      function onUp() {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      }

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }

    document.querySelectorAll('[data-gutter]').forEach((gutter) => {
      gutter.addEventListener('mousedown', (event) => startResize(gutter.dataset.gutter, event));
    });
  }

  document.getElementById('create-story').onclick = createStory;
  document.getElementById('save-story').onclick = saveStory;
  document.getElementById('add-character').onclick = addCharacter;
  document.getElementById('open-script-drawer').onclick = openDrawer;
  document.getElementById('close-script-drawer').onclick = closeDrawer;
  document.getElementById('close-script-drawer-button').onclick = closeDrawer;
  document.getElementById('analyze-script').onclick = analyzeScript;
  document.getElementById('apply-all-suggestions').onclick = applyAllSuggestions;
  document.getElementById('clear-suggestions').onclick = clearSuggestions;

  document.querySelectorAll('[data-top-tab]').forEach((button) => {
    button.onclick = () => {
      state.activeTopTab = button.dataset.topTab;
      renderTopTab();
      renderPreviewTab();
    };
  });

  initResizableColumns();
  loadStories();
})();

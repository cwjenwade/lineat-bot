(function () {
  const apiBase = window.ADMIN_API_BASE;
  const moduleCatalog = [
    {
      type: 'narrative',
      icon: '景',
      label: '敘事圖片',
      description: '單張敘事圖片加文字，適合建立場景與過場。'
    },
    {
      type: 'fullscreen',
      icon: '滿',
      label: '滿版訊息',
      description: '用單張大圖或單段重點文字做情緒強化與關鍵轉場。'
    },
    {
      type: 'choice',
      icon: '岔',
      label: '選項分支',
      description: '建立兩個選項、兩條指向與對應回應。'
    },
    {
      type: 'carousel',
      icon: '頁',
      label: '多頁訊息',
      description: '橫向多頁卡片，每張可設定不同底圖與角色。'
    },
    {
      type: 'dialogue',
      icon: '話',
      label: '對話框',
      description: '角色說話或旁白提示，適合承接情緒與節奏。'
    }
  ];

  const state = {
    stories: [],
    activeStoryId: null,
    activeNodeId: null,
    activeTopTab: 'construct',
    suggestions: [],
    analysis: null,
    dragNodeId: null
  };

  const storyTabs = document.getElementById('story-tabs');
  const newStoryTitle = document.getElementById('new-story-title');
  const timeline = document.getElementById('timeline');
  const suggestionList = document.getElementById('suggestion-list');
  const palette = document.getElementById('palette');
  const nodeInspector = document.getElementById('node-inspector');
  const storyTitle = document.getElementById('story-title');
  const storyDescription = document.getElementById('story-description');
  const scriptInput = document.getElementById('script-input');
  const analysisPanel = document.getElementById('analysis-panel');
  const implementJson = document.getElementById('implement-json');
  const implementSummary = document.getElementById('implement-summary');
  const constructView = document.getElementById('construct-view');
  const implementView = document.getElementById('implement-view');
  const workspace = document.getElementById('workspace');

  function uid(prefix) {
    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
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

  function ensureNodeDefaults(node) {
    node.id ||= uid('node');
    node.type ||= 'narrative';
    node.title ||= `新的${nodeTypeInfo(node.type).label}`;
    node.speaker ||= '';
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
      node.pages ||= [{ title: '第 1 頁', speaker: '', text: '', image: '' }];
      if (!node.pages.length) {
        node.pages.push({ title: '第 1 頁', speaker: '', text: '', image: '' });
      }
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
        pages: [
          { title: '第 1 頁', speaker: '旁白', text: '第一頁內容', image: '' }
        ],
        nextNodeId: ''
      };
    }

    if (type === 'dialogue') {
      return {
        id: uid('dialogue'),
        type,
        title: '新的對話框',
        speaker: '角色',
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

  async function loadStories() {
    const { stories } = await api('/stories');
    state.stories = stories.map((story) => ({
      ...story,
      nodes: (story.nodes || []).map((node) => ({ ...node }))
    }));
    if (!state.activeStoryId && state.stories[0]) {
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
    state.stories.push(story);
    state.activeStoryId = story.id;
    state.activeNodeId = null;
    newStoryTitle.value = '';
    render();
  }

  async function saveStory() {
    const story = activeStory();
    if (!story) return;

    const payload = {
      ...story,
      title: storyTitle.value.trim(),
      description: storyDescription.value.trim(),
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

  function applySuggestion(index) {
    const suggestion = state.suggestions[index];
    if (!suggestion) return;
    addNode(suggestion.type, JSON.parse(JSON.stringify(suggestion)));
    state.suggestions.splice(index, 1);
    renderSuggestions();
  }

  function applyAllSuggestions() {
    if (!state.suggestions.length) return;
    const items = state.suggestions.map((suggestion) => JSON.parse(JSON.stringify(suggestion)));
    items.forEach((suggestion) => addNode(suggestion.type, suggestion));
    state.suggestions = [];
    render();
  }

  function clearSuggestions() {
    state.suggestions = [];
    state.analysis = null;
    render();
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
    renderTimeline();
    renderImplement();
  }

  async function analyzeScript() {
    const story = activeStory();
    const script = scriptInput.value.trim();
    if (!script) return;

    const { analysis } = await api('/analyze-script', {
      method: 'POST',
      body: JSON.stringify({
        script,
        existingNodes: story?.nodes || []
      })
    });

    state.analysis = analysis;
    state.suggestions = analysis.suggestedNodes || [];

    if (analysis.title && story && (!story.title || /^Story \d+$/.test(story.title))) {
      story.title = analysis.title;
    }

    render();
  }

  function nodeTypeInfo(type) {
    return moduleCatalog.find((item) => item.type === type) || moduleCatalog[0];
  }

  function nodeSummary(node) {
    if (node.type === 'choice') {
      return `${node.optionA?.label || ''}\n${node.optionB?.label || ''}`.trim();
    }
    if (node.type === 'carousel') {
      return `${node.pages?.length || 0} 頁多頁訊息`;
    }
    if (node.type === 'fullscreen') {
      return node.text || '尚未填寫滿版訊息內容';
    }
    return node.text || '尚未填寫內容';
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

  function renderTimeline() {
    timeline.innerHTML = '';
    const story = activeStory();

    if (!story || !story.nodes.length) {
      timeline.innerHTML = '<div class="empty">這個故事還沒有模組。先從中間點一個模組開始。</div>';
      return;
    }

    story.nodes.forEach((node, index) => {
      ensureNodeDefaults(node);
      const info = nodeTypeInfo(node.type);
      const card = document.createElement('div');
      card.className = `timeline-card ${node.id === state.activeNodeId ? 'active' : ''}`;
      card.draggable = true;
      card.dataset.nodeId = node.id;
      card.innerHTML = `
        <div class="timeline-meta">
          <span class="type-pill">${info.icon} ${info.label}</span>
          <span class="hint">#${index + 1}</span>
        </div>
        <div class="timeline-title">${escapeHtml(node.title || info.label)}</div>
        <div class="timeline-text">${escapeHtml(nodeSummary(node))}</div>
        <div class="timeline-controls">
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
          addNode(node.type, JSON.parse(JSON.stringify({
            ...node,
            id: uid(node.type),
            title: `${node.title} Copy`
          })));
          return;
        }
        state.activeNodeId = node.id;
        renderInspector();
        renderTimeline();
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

      timeline.appendChild(card);
    });
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
      const card = document.createElement('div');
      card.className = 'timeline-card suggestion-card';
      card.innerHTML = `
        <div class="timeline-meta">
          <span class="type-pill">${info.icon} ${info.label}</span>
          <span class="hint">AI 劇本草稿</span>
        </div>
        <div class="timeline-title">${escapeHtml(node.title || info.label)}</div>
        <div class="timeline-text">${escapeHtml(nodeSummary(node))}</div>
        <div class="timeline-controls">
          <button class="mini-btn" data-add="${index}">放進故事軸</button>
        </div>
      `;
      card.querySelector('[data-add]').onclick = () => applySuggestion(index);
      suggestionList.appendChild(card);
    });
  }

  function renderPalette() {
    palette.innerHTML = '';
    moduleCatalog.forEach((module) => {
      const item = document.createElement('button');
      item.className = 'palette-item';
      item.dataset.type = module.type;
      item.innerHTML = `
        <div class="palette-icon">${module.icon}</div>
        <div class="palette-label">${module.label}</div>
        <div class="palette-desc">${module.description}</div>
      `;
      item.onclick = () => addNode(module.type);
      palette.appendChild(item);
    });
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
      image.className = 'preview-image';
      image.src = currentValue;
      wrapper.appendChild(image);
    }
    return wrapper;
  }

  function renderInspector() {
    const node = activeNode();
    const story = activeStory();

    if (!story) {
      nodeInspector.className = 'empty';
      nodeInspector.innerHTML = '請先建立 Story。';
      return;
    }

    if (!node) {
      nodeInspector.className = 'empty';
      nodeInspector.innerHTML = '先從左側選一個模組。';
      return;
    }

    nodeInspector.className = '';
    nodeInspector.innerHTML = '';
    ensureNodeDefaults(node);

    const fragment = document.createDocumentFragment();
    const info = nodeTypeInfo(node.type);

    const header = document.createElement('div');
    header.className = 'field';
    header.innerHTML = `<strong>${info.label}</strong><div class="hint">你正在編輯這個模組的內容與連線。</div>`;
    fragment.appendChild(header);

    fragment.appendChild(field('模組名稱', textInput(node.title, (value) => {
      node.title = value;
      renderTimeline();
      renderImplement();
    })));

    if (node.type !== 'carousel') {
      fragment.appendChild(field('角色名稱', textInput(node.speaker || '', (value) => {
        node.speaker = value;
      })));
      fragment.appendChild(field('文字內容', textArea(node.text || '', (value) => {
        node.text = value;
        renderTimeline();
        renderImplement();
      })));
      fragment.appendChild(field('圖片上傳', uploadField(node.image, (url) => {
        node.image = url;
      })));
    }

    if (node.type === 'narrative' || node.type === 'dialogue' || node.type === 'fullscreen') {
      fragment.appendChild(field('下一個模組 →', renderNodeSelect(node.nextNodeId, (value) => {
        node.nextNodeId = value;
        renderImplement();
      })));
    }

    if (node.type === 'choice') {
      fragment.appendChild(field('提問內容', textArea(node.text || '', (value) => {
        node.text = value;
        renderTimeline();
        renderImplement();
      })));
      fragment.appendChild(field('背景圖', uploadField(node.image, (url) => {
        node.image = url;
      })));
      fragment.appendChild(field('選項 A', textInput(node.optionA.label, (value) => {
        node.optionA.label = value;
        renderTimeline();
        renderImplement();
      })));
      fragment.appendChild(field('選項 A 回應', textArea(node.optionA.feedback, (value) => {
        node.optionA.feedback = value;
      })));
      fragment.appendChild(field('選項 A 指向 →', renderNodeSelect(node.optionA.nextNodeId, (value) => {
        node.optionA.nextNodeId = value;
        renderImplement();
      })));
      fragment.appendChild(field('選項 B', textInput(node.optionB.label, (value) => {
        node.optionB.label = value;
        renderTimeline();
        renderImplement();
      })));
      fragment.appendChild(field('選項 B 回應', textArea(node.optionB.feedback, (value) => {
        node.optionB.feedback = value;
      })));
      fragment.appendChild(field('選項 B 指向 →', renderNodeSelect(node.optionB.nextNodeId, (value) => {
        node.optionB.nextNodeId = value;
        renderImplement();
      })));
    }

    if (node.type === 'carousel') {
      node.pages.forEach((page, index) => {
        const block = document.createElement('div');
        block.className = 'panel-card';
        block.style.margin = '0 0 10px';
        block.style.padding = '12px';
        block.appendChild(field(`第 ${index + 1} 頁標題`, textInput(page.title, (value) => {
          page.title = value;
          renderImplement();
        })));
        block.appendChild(field(`第 ${index + 1} 頁角色`, textInput(page.speaker, (value) => {
          page.speaker = value;
          renderImplement();
        })));
        block.appendChild(field(`第 ${index + 1} 頁文字`, textArea(page.text, (value) => {
          page.text = value;
          renderTimeline();
          renderImplement();
        })));
        block.appendChild(field(`第 ${index + 1} 頁底圖`, uploadField(page.image, (url) => {
          page.image = url;
        })));

        const removePage = document.createElement('button');
        removePage.className = 'button soft';
        removePage.textContent = '刪掉這一頁';
        removePage.onclick = () => {
          node.pages.splice(index, 1);
          if (!node.pages.length) {
            node.pages.push({ title: '第 1 頁', speaker: '', text: '', image: '' });
          }
          render();
        };
        block.appendChild(removePage);
        fragment.appendChild(block);
      });

      const addPage = document.createElement('button');
      addPage.className = 'button secondary';
      addPage.textContent = '新增一頁';
      addPage.onclick = () => {
        node.pages.push({
          title: `第 ${node.pages.length + 1} 頁`,
          speaker: '',
          text: '',
          image: ''
        });
        render();
      };
      fragment.appendChild(addPage);
      fragment.appendChild(field('下一個模組 →', renderNodeSelect(node.nextNodeId, (value) => {
        node.nextNodeId = value;
        renderImplement();
      })));
    }

    nodeInspector.appendChild(fragment);
  }

  function renderAnalysis() {
    analysisPanel.innerHTML = '';
    if (!state.analysis) {
      analysisPanel.innerHTML = '<div class="empty" style="margin-top:12px;">分析後，這裡會顯示劇本輪廓與建議分鏡。</div>';
      return;
    }

    const panel = document.createElement('div');
    panel.innerHTML = `
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
    state.analysis.sections.slice(0, 8).forEach((section) => {
      const item = document.createElement('div');
      item.className = 'outline-item';
      item.innerHTML = `<strong>${escapeHtml(section.key)}</strong><br>${escapeHtml(section.preview)}`;
      outlineList.appendChild(item);
    });

    panel.appendChild(deltaList);
    panel.appendChild(outlineList);
    analysisPanel.appendChild(panel);
  }

  function renderImplement() {
    const story = activeStory();
    implementJson.textContent = story ? JSON.stringify(story, null, 2) : '';

    if (!story) {
      implementSummary.innerHTML = '<div class="empty">先建立一個 Story。</div>';
      return;
    }

    const summary = document.createElement('div');
    summary.className = 'section-stack';

    const overview = document.createElement('div');
    overview.className = 'panel-card';
    overview.style.margin = '0';
    overview.innerHTML = `
      <h3>${escapeHtml(story.title || 'Untitled')}</h3>
      <p>${escapeHtml(story.description || '尚未填寫描述')}</p>
      <div class="delta-list" style="margin-top:12px;">
        <div class="delta-item">模組總數: ${story.nodes.length}</div>
        <div class="delta-item">敘事圖片: ${countNodes(story.nodes, 'narrative')}</div>
        <div class="delta-item">滿版訊息: ${countNodes(story.nodes, 'fullscreen')}</div>
        <div class="delta-item">選項分支: ${countNodes(story.nodes, 'choice')}</div>
        <div class="delta-item">多頁訊息: ${countNodes(story.nodes, 'carousel')}</div>
        <div class="delta-item">對話框: ${countNodes(story.nodes, 'dialogue')}</div>
      </div>
    `;

    const order = document.createElement('div');
    order.className = 'panel-card';
    order.style.margin = '0';
    order.innerHTML = `<h3>故事順序</h3><div class="delta-list">${story.nodes.map((node, index) => `<div class="delta-item">${index + 1}. ${escapeHtml(node.title || node.id)} (${escapeHtml(nodeTypeInfo(node.type).label)})</div>`).join('')}</div>`;

    summary.appendChild(overview);
    summary.appendChild(order);
    implementSummary.innerHTML = '';
    implementSummary.appendChild(summary);
  }

  function renderTopTab() {
    document.querySelectorAll('[data-top-tab]').forEach((button) => {
      const active = button.dataset.topTab === state.activeTopTab;
      button.classList.toggle('active', active);
    });
    constructView.classList.toggle('active', state.activeTopTab === 'construct');
    implementView.classList.toggle('active', state.activeTopTab === 'implement');
  }

  function render() {
    const story = activeStory();
    renderTopTab();
    renderStoryTabs();
    renderSuggestions();
    renderTimeline();
    renderPalette();
    renderAnalysis();
    renderImplement();
    renderInspector();

    storyTitle.value = story?.title || '';
    storyDescription.value = story?.description || '';
  }

  function countNodes(nodes, type) {
    return nodes.filter((node) => node.type === type).length;
  }

  function escapeHtml(value) {
    return `${value || ''}`
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function initResizableColumns() {
    const root = document.documentElement;
    const minLeft = 24;
    const minCenter = 14;
    const minRight = 28;

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

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  document.getElementById('create-story').onclick = createStory;
  document.getElementById('save-story').onclick = saveStory;
  document.getElementById('apply-all-suggestions').onclick = applyAllSuggestions;
  document.getElementById('clear-suggestions').onclick = clearSuggestions;
  document.getElementById('analyze-script').onclick = analyzeScript;

  document.querySelectorAll('[data-top-tab]').forEach((button) => {
    button.onclick = () => {
      state.activeTopTab = button.dataset.topTab;
      renderTopTab();
      renderImplement();
    };
  });

  storyTitle.oninput = () => {
    const story = activeStory();
    if (!story) return;
    story.title = storyTitle.value;
    renderStoryTabs();
    renderImplement();
  };

  storyDescription.oninput = () => {
    const story = activeStory();
    if (!story) return;
    story.description = storyDescription.value;
    renderImplement();
  };

  initResizableColumns();
  loadStories();
})();

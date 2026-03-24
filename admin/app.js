(function () {
  const apiBase = window.ADMIN_API_BASE;
  const state = {
    stories: [],
    activeStoryId: null,
    activeNodeId: null
  };

  const storyList = document.getElementById('story-list');
  const canvas = document.getElementById('canvas');
  const edges = document.getElementById('edges');
  const nodeInspector = document.getElementById('node-inspector');
  const storyTitle = document.getElementById('story-title');
  const storyDescription = document.getElementById('story-description');

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
        'Content-Type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    });
    return response.json();
  }

  async function uploadFile(file) {
    const form = new FormData();
    form.append('file', file);
    const response = await fetch(`${apiBase}/upload-image`, {
      method: 'POST',
      body: form
    });
    return response.json();
  }

  async function loadStories() {
    const { stories } = await api('/stories');
    state.stories = stories;
    if (!state.activeStoryId && stories[0]) {
      state.activeStoryId = stories[0].id;
    }
    renderStories();
    renderStory();
  }

  async function createStory() {
    const { story } = await api('/stories', { method: 'POST' });
    state.stories.push(story);
    state.activeStoryId = story.id;
    state.activeNodeId = null;
    renderStories();
    renderStory();
  }

  async function saveStory() {
    const story = activeStory();
    if (!story) return;
    const payload = {
      ...story,
      title: storyTitle.value.trim(),
      description: storyDescription.value.trim()
    };
    const response = await api(`/stories/${story.id}`, {
      method: 'PUT',
      body: JSON.stringify({ story: payload })
    });
    const index = state.stories.findIndex((item) => item.id === story.id);
    state.stories[index] = response.story;
    renderStories();
  }

  function renderStories() {
    storyList.innerHTML = '';
    state.stories.forEach((story) => {
      const item = document.createElement('div');
      item.className = `story-item ${story.id === state.activeStoryId ? 'active' : ''}`;
      item.innerHTML = `<strong>${story.title}</strong><div class="hint">${story.nodes.length} modules</div>`;
      item.onclick = () => {
        state.activeStoryId = story.id;
        state.activeNodeId = story.nodes[0]?.id || null;
        renderStories();
        renderStory();
      };
      storyList.appendChild(item);
    });
  }

  function ensureNodeDefaults(node) {
    node.position ||= { x: 120, y: 120 };
    if (node.type === 'choice') {
      node.optionA ||= { label: '選項 A', feedback: '', nextNodeId: '' };
      node.optionB ||= { label: '選項 B', feedback: '', nextNodeId: '' };
    }
    if (node.type === 'carousel') {
      node.pages ||= [
        { title: '第 1 張', speaker: '', text: '', image: '' }
      ];
    }
  }

  function addNode(type) {
    const story = activeStory();
    if (!story) return;

    const node = {
      id: uid('node'),
      type,
      title: `${type} module`,
      speaker: '',
      text: '',
      image: '',
      nextNodeId: '',
      position: { x: 120 + story.nodes.length * 24, y: 120 + story.nodes.length * 24 }
    };

    ensureNodeDefaults(node);
    story.nodes.push(node);
    state.activeNodeId = node.id;
    renderStory();
  }

  function nodeSummary(node) {
    if (node.type === 'choice') return `${node.optionA?.label || ''} / ${node.optionB?.label || ''}`;
    if (node.type === 'carousel') return `${node.pages?.length || 0} pages`;
    return node.text || 'No content yet';
  }

  function renderStory() {
    const story = activeStory();
    if (!story) return;

    storyTitle.value = story.title || '';
    storyDescription.value = story.description || '';

    canvas.querySelectorAll('.node').forEach((node) => node.remove());

    story.nodes.forEach((node) => {
      ensureNodeDefaults(node);
      const el = document.createElement('div');
      el.className = `node ${node.id === state.activeNodeId ? 'active' : ''}`;
      el.style.left = `${node.position.x}px`;
      el.style.top = `${node.position.y}px`;
      el.dataset.nodeId = node.id;
      el.innerHTML = `
        <div class="node-head">
          ${node.title || node.type}
          <div class="node-meta">${node.type}</div>
        </div>
        <div class="node-body">${nodeSummary(node)}</div>
      `;

      el.addEventListener('mousedown', (event) => startDrag(event, node));
      el.addEventListener('click', () => {
        state.activeNodeId = node.id;
        renderStory();
      });

      canvas.appendChild(el);
    });

    drawEdges();
    renderInspector();
  }

  function drawEdges() {
    const story = activeStory();
    edges.innerHTML = '';
    edges.setAttribute('width', canvas.scrollWidth);
    edges.setAttribute('height', canvas.scrollHeight);

    story.nodes.forEach((node) => {
      const origin = canvas.querySelector(`[data-node-id="${node.id}"]`);
      if (!origin) return;

      const targets = [];
      if (node.nextNodeId) targets.push(node.nextNodeId);
      if (node.optionA?.nextNodeId) targets.push(node.optionA.nextNodeId);
      if (node.optionB?.nextNodeId) targets.push(node.optionB.nextNodeId);

      targets.filter(Boolean).forEach((targetId) => {
        const target = canvas.querySelector(`[data-node-id="${targetId}"]`);
        if (!target) return;

        const x1 = origin.offsetLeft + origin.offsetWidth;
        const y1 = origin.offsetTop + origin.offsetHeight / 2;
        const x2 = target.offsetLeft;
        const y2 = target.offsetTop + target.offsetHeight / 2;
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${x1} ${y1} C ${x1 + 80} ${y1}, ${x2 - 80} ${y2}, ${x2} ${y2}`);
        path.setAttribute('stroke', '#b79773');
        path.setAttribute('stroke-width', '3');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linecap', 'round');
        edges.appendChild(path);
      });
    });
  }

  function startDrag(event, node) {
    if (event.target.closest('input, textarea, select, button')) return;

    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = node.position.x;
    const startTop = node.position.y;

    function onMove(moveEvent) {
      node.position.x = Math.max(16, startLeft + moveEvent.clientX - startX);
      node.position.y = Math.max(16, startTop + moveEvent.clientY - startY);
      renderStory();
    }

    function onUp() {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function renderNodeSelect(value, onChange) {
    const story = activeStory();
    const select = document.createElement('select');
    select.innerHTML = `<option value="">未連接</option>${story.nodes.map((node) => `<option value="${node.id}">${node.title || node.id}</option>`).join('')}`;
    select.value = value || '';
    select.onchange = (event) => onChange(event.target.value);
    return select;
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
      renderStory();
    };
    wrapper.appendChild(input);

    if (currentValue) {
      const img = document.createElement('img');
      img.className = 'preview-image';
      img.src = currentValue;
      wrapper.appendChild(img);
    }

    return wrapper;
  }

  function renderInspector() {
    const node = activeNode();
    nodeInspector.innerHTML = '';

    if (!node) {
      nodeInspector.innerHTML = '<p class="hint">請先選一個模組。</p>';
      return;
    }

    ensureNodeDefaults(node);

    const fragment = document.createDocumentFragment();

    fragment.appendChild(field('模組名稱', textInput(node.title, (value) => { node.title = value; renderStory(); })));

    if (node.type !== 'carousel') {
      fragment.appendChild(field('說話角色', textInput(node.speaker || '', (value) => { node.speaker = value; })));
      fragment.appendChild(field('文字內容', textArea(node.text || '', (value) => { node.text = value; renderStory(); })));
      fragment.appendChild(field('圖片上傳', uploadField(node.image, (url) => { node.image = url; })));
    }

    if (node.type === 'narrative' || node.type === 'dialogue') {
      const nextField = document.createElement('div');
      nextField.appendChild(renderNodeSelect(node.nextNodeId, (value) => { node.nextNodeId = value; drawEdges(); }));
      fragment.appendChild(field('下一個模組', nextField));
    }

    if (node.type === 'choice') {
      fragment.appendChild(field('題目', textArea(node.text || '', (value) => { node.text = value; })));
      fragment.appendChild(field('選項 A 文字', textInput(node.optionA.label, (value) => { node.optionA.label = value; renderStory(); })));
      fragment.appendChild(field('選項 A 回應', textArea(node.optionA.feedback, (value) => { node.optionA.feedback = value; })));
      fragment.appendChild(field('選項 A 連線', renderNodeSelect(node.optionA.nextNodeId, (value) => { node.optionA.nextNodeId = value; drawEdges(); })));
      fragment.appendChild(field('選項 B 文字', textInput(node.optionB.label, (value) => { node.optionB.label = value; renderStory(); })));
      fragment.appendChild(field('選項 B 回應', textArea(node.optionB.feedback, (value) => { node.optionB.feedback = value; })));
      fragment.appendChild(field('選項 B 連線', renderNodeSelect(node.optionB.nextNodeId, (value) => { node.optionB.nextNodeId = value; drawEdges(); })));
      fragment.appendChild(field('選項背景圖', uploadField(node.image, (url) => { node.image = url; })));
    }

    if (node.type === 'carousel') {
      node.pages.forEach((page, index) => {
        const pageCard = document.createElement('div');
        pageCard.className = 'page-card';
        pageCard.appendChild(field(`第 ${index + 1} 頁標題`, textInput(page.title || '', (value) => { page.title = value; renderStory(); })));
        pageCard.appendChild(field(`第 ${index + 1} 頁說話角色`, textInput(page.speaker || '', (value) => { page.speaker = value; renderStory(); })));
        pageCard.appendChild(field(`第 ${index + 1} 頁文字`, textArea(page.text || '', (value) => { page.text = value; renderStory(); })));
        pageCard.appendChild(field(`第 ${index + 1} 頁底圖`, uploadField(page.image, (url) => { page.image = url; })));
        fragment.appendChild(pageCard);
      });

      const addPage = document.createElement('button');
      addPage.className = 'button secondary';
      addPage.textContent = '新增一頁';
      addPage.onclick = () => {
        node.pages.push({ title: `第 ${node.pages.length + 1} 頁`, speaker: '', text: '', image: '' });
        renderInspector();
      };
      fragment.appendChild(addPage);

      fragment.appendChild(field('下一個模組', renderNodeSelect(node.nextNodeId, (value) => { node.nextNodeId = value; drawEdges(); })));
    }

    const deleteButton = document.createElement('button');
    deleteButton.className = 'button ghost';
    deleteButton.textContent = '刪除這個模組';
    deleteButton.onclick = () => {
      const story = activeStory();
      story.nodes = story.nodes.filter((item) => item.id !== node.id);
      state.activeNodeId = story.nodes[0]?.id || null;
      renderStory();
    };
    fragment.appendChild(deleteButton);

    nodeInspector.appendChild(fragment);
  }

  function field(labelText, control) {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const label = document.createElement('label');
    label.textContent = labelText;
    wrap.appendChild(label);
    wrap.appendChild(control);
    return wrap;
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

  document.getElementById('create-story').onclick = createStory;
  document.getElementById('save-story').onclick = saveStory;
  document.querySelectorAll('[data-add-node]').forEach((button) => {
    button.onclick = () => addNode(button.dataset.addNode);
  });

  storyTitle.oninput = () => {
    const story = activeStory();
    if (!story) return;
    story.title = storyTitle.value;
    renderStories();
  };

  storyDescription.oninput = () => {
    const story = activeStory();
    if (!story) return;
    story.description = storyDescription.value;
  };

  loadStories();
})();

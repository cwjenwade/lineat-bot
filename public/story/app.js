function resolveStoryId() {
  const params = new URLSearchParams(location.search);
  const queryStoryId = params.get('storyId');
  if (queryStoryId) return queryStoryId;

  const segments = location.pathname.split('/').filter(Boolean);
  const storyIndex = segments.indexOf('story');
  if (storyIndex >= 0 && segments[storyIndex + 1] && !/\.(html?|css|js|json|png|jpe?g|svg)$/i.test(segments[storyIndex + 1])) {
    return segments[storyIndex + 1];
  }

  return 'example';
}

const storyId = resolveStoryId();
const STORY_BASE_URL = new URL(`../stories/${storyId}/`, document.baseURI);
const STORY_URL = new URL('story.json', STORY_BASE_URL).href;

let story = null;
let nodeMap = new Map();
let current = null;

async function loadStory() {
  const res = await fetch(STORY_URL);
  if (!res.ok) throw new Error('Failed to load story');
  story = await res.json();
  if (!story || !Array.isArray(story.nodes)) {
    throw new Error('Invalid story schema: nodes must be an array');
  }
  story.nodes.forEach(n => nodeMap.set(n.id, n));
}

function resolveAssetUrl(relativePath) {
  if (!relativePath) return '';
  return new URL(relativePath, STORY_BASE_URL).href;
}

function validateStory() {
  const startId = story?.start || (story?.nodes?.[0] && story.nodes[0].id);
  if (!startId) {
    throw new Error('Invalid story schema: missing start node');
  }
  if (!nodeMap.has(startId)) {
    throw new Error(`Invalid story schema: start node "${startId}" not found in nodes`);
  }
  return startId;
}

function renderNode(node) {
  const speakerEl = document.getElementById('speaker');
  const dialogEl = document.getElementById('dialog');
  const imageEl = document.getElementById('heroImage');
  const optionsEl = document.getElementById('options');
  const backgroundEl = document.getElementById('background');
  const sceneMetaEl = document.getElementById('sceneMeta');
  const controlsEl = document.getElementById('controls');

  speakerEl.textContent = node.speaker || '旁白';
  dialogEl.textContent = node.text || '';
  sceneMetaEl.textContent = current?.id ? `節點 ${current.id}` : '';

  if (node.background) {
    backgroundEl.style.backgroundImage = `linear-gradient(180deg, rgba(11, 15, 26, 0.16), rgba(11, 15, 26, 0.60)), url('${resolveAssetUrl(node.background)}')`;
  } else {
    backgroundEl.style.backgroundImage = '';
    backgroundEl.style.background = '#f5f7fb';
  }

  imageEl.innerHTML = '';
  if (node.image) {
    const img = document.createElement('img');
    img.src = resolveAssetUrl(node.image);
    img.alt = node.speaker || story.title || 'story image';
    imageEl.appendChild(img);
  }

  optionsEl.innerHTML = '';
  if (Array.isArray(node.options) && node.options.length) {
    node.options.forEach(opt => {
      const btn = document.createElement('button');
      btn.textContent = opt.label;
      btn.addEventListener('click', () => gotoNode(opt.target));
      optionsEl.appendChild(btn);
    });
  } else {
    optionsEl.innerHTML = '';
  }

  controlsEl.innerHTML = '';
  if (!Array.isArray(node.options) || !node.options.length) {
    if (node.next) {
      const btn = document.createElement('button');
      btn.textContent = '下一步';
      btn.addEventListener('click', () => gotoNode(node.next));
      controlsEl.appendChild(btn);
    }
  }
}

function gotoNode(nodeId) {
  const node = nodeMap.get(nodeId);
  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }
  current = node;
  renderNode(node);
}

(async function(){
  try {
    await loadStory();
    const start = validateStory();
    gotoNode(start);
  } catch (err) {
    document.getElementById('speaker').textContent = '載入失敗';
    document.getElementById('dialog').textContent = '無法載入故事：' + err.message;
  }
})();

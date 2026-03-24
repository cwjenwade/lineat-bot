const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const dataDir = path.join(__dirname, '..', 'data');
const uploadsDir = path.join(__dirname, '..', 'public', 'uploads');
const storeFile = path.join(dataDir, 'story-authoring.json');

function ensureStore() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadsDir, { recursive: true });

  if (!fs.existsSync(storeFile)) {
    const initialStory = {
      id: 'story-01',
      title: 'Story 01',
      description: 'Interactive picture book draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nodes: [
        {
          id: 'node-start',
          type: 'narrative',
          title: 'Opening Scene',
          speaker: '旁白',
          text: '在這裡開始建立你的第一幕。',
          image: '',
          nextNodeId: '',
          position: { x: 80, y: 80 }
        }
      ]
    };

    fs.writeFileSync(storeFile, JSON.stringify({ stories: [initialStory] }, null, 2));
  }
}

function readStore() {
  ensureStore();
  return JSON.parse(fs.readFileSync(storeFile, 'utf8'));
}

function writeStore(store) {
  ensureStore();
  fs.writeFileSync(storeFile, JSON.stringify(store, null, 2));
}

function listStories() {
  return readStore().stories;
}

function getStory(storyId) {
  return listStories().find((story) => story.id === storyId) || null;
}

function createStory(title = '') {
  const store = readStore();
  const story = {
    id: randomUUID(),
    title: title.trim() || `Story ${store.stories.length + 1}`,
    description: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    nodes: []
  };
  store.stories.push(story);
  writeStore(store);
  return story;
}

function saveStory(storyId, payload) {
  const store = readStore();
  const index = store.stories.findIndex((story) => story.id === storyId);

  if (index === -1) {
    throw new Error(`Story not found: ${storyId}`);
  }

  store.stories[index] = {
    ...store.stories[index],
    ...payload,
    id: storyId,
    updatedAt: new Date().toISOString()
  };

  writeStore(store);
  return store.stories[index];
}

module.exports = {
  dataDir,
  uploadsDir,
  ensureStore,
  listStories,
  getStory,
  createStory,
  saveStory
};

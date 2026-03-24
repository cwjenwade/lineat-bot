const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const express = require('express');
const multer = require('multer');
const sharp = require('sharp');

const {
  uploadsDir,
  ensureStore,
  listStories,
  getStory,
  createStory,
  saveStory
} = require('./storyAuthoringStore');
const { analyzeScript } = require('./scriptAnalyzer');

const adminDir = path.join(__dirname, '..', 'admin');
const upload = multer({ storage: multer.memoryStorage() });

function createApiRouter() {
  ensureStore();

  const router = express.Router();
  router.use(express.json({ limit: '8mb' }));

  router.get('/stories', (req, res) => {
    res.json({ stories: listStories() });
  });

  router.post('/stories', (req, res) => {
    res.status(201).json({ story: createStory(req.body?.title || '') });
  });

  router.get('/stories/:storyId', (req, res) => {
    const story = getStory(req.params.storyId);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    res.json({ story });
  });

  router.put('/stories/:storyId', (req, res) => {
    try {
      const story = saveStory(req.params.storyId, req.body.story || {});
      res.json({ story });
    } catch (error) {
      res.status(404).json({ error: error.message });
    }
  });

  router.post('/upload-image', upload.single('file'), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Missing file upload' });
    }

    const ext = '.jpg';
    const fileName = `${randomUUID()}${ext}`;
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
  });

  router.post('/analyze-script', (req, res) => {
    const script = `${req.body?.script || ''}`.trim();
    if (!script) {
      return res.status(400).json({ error: 'Missing script text' });
    }

    const analysis = analyzeScript(script, req.body?.existingNodes || []);
    res.json({ analysis });
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

  app.use(apiPath, createApiRouter());
  app.use(uiPath, express.static(adminDir, { index: false }));
  app.get(uiPath, (req, res) => {
    res.type('html').send(renderAdminHtml(apiPath, uiPath));
  });
  app.get(`${uiPath}/`, (req, res) => {
    res.type('html').send(renderAdminHtml(apiPath, uiPath));
  });
}

function createAdminApp() {
  ensureStore();
  const app = express();
  app.use('/public', express.static(path.join(__dirname, '..', 'public')));
  app.use('/api', createApiRouter());
  app.use('/', express.static(adminDir, { index: false }));
  app.get('/', (req, res) => {
    res.type('html').send(renderAdminHtml('/api', ''));
  });
  return app;
}

module.exports = {
  mountAdmin,
  createAdminApp
};

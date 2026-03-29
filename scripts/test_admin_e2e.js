const { createAdminApp } = require('../lib/adminMount');
const { chromium } = require('playwright');

async function waitForServer(url, attempts = 40) {
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch (_error) {
      // retry
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Server did not become ready: ${url}`);
}

async function jsonFetch(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      'x-lineat-role': 'manager',
      'x-lineat-actor': 'e2e'
    },
    ...options
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  return body;
}

function findStoryTrigger(globalSettings, storyId) {
  return (globalSettings?.triggerBindings || []).find((binding) =>
    binding?.storyId === storyId
    && binding?.actionType === 'story'
    && binding?.scope !== 'account'
  ) || null;
}

async function run() {
  const port = 3210;
  const baseUrl = `http://127.0.0.1:${port}`;
  const app = createAdminApp();
  const server = await new Promise((resolve) => {
    const instance = app.listen(port, () => resolve(instance));
  });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1500, height: 1280 } });

  try {
    await waitForServer(`${baseUrl}/api/dashboard`);

    const dashboard = await jsonFetch(`${baseUrl}/api/dashboard`);
    if ((dashboard.dashboard?.storyCount || 0) < 1) {
      throw new Error('Expected at least one story in dashboard');
    }

    const storyPayload = await jsonFetch(`${baseUrl}/api/stories/story-01`);
    const story = storyPayload.story;
    const globalSettings = storyPayload.globalSettings;
    const trigger = findStoryTrigger(globalSettings, story.id);
    const triggerKeyword = `${trigger?.keyword || story.triggerKeyword || ''}`.trim();

    const preview = await jsonFetch(`${baseUrl}/api/render`, {
      method: 'POST',
      body: JSON.stringify({
        storyId: story.id,
        story,
        globalSettings,
        nodeId: story.startNodeId
      })
    });
    if (!preview.render?.payload?.messages?.length) {
      throw new Error('Preview render returned no LINE messages');
    }

    let runtimeTriggerOk = false;
    if (triggerKeyword) {
      const simulatedStart = await jsonFetch(`${baseUrl}/api/runtime/simulate`, {
        method: 'POST',
        body: JSON.stringify({ text: triggerKeyword, sessionKey: 'e2e' })
      });
      if (simulatedStart.simulation?.mode !== 'trigger') {
        throw new Error(`Expected trigger mode, got ${simulatedStart.simulation?.mode}`);
      }
      runtimeTriggerOk = true;
    }

    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForSelector('#story-list [data-story-id]');
    await page.locator('#story-list [data-story-id]').first().click();
    await page.waitForSelector('#editor-story-title');

    const duplicateSave = await page.locator('#save-story-meta').count();
    if (duplicateSave !== 0) {
      throw new Error('Expected duplicate save-story-meta button to be removed');
    }

    const triggerHint = await page.locator('#story-trigger-hint').textContent();
    if (!triggerHint.includes('Setting')) {
      throw new Error('Story trigger hint does not clarify account route scope');
    }

    const publishHint = await page.locator('#publish-scope-hint').textContent();
    if (!publishHint.includes('發布到 Render')) {
      throw new Error('Publish scope hint missing');
    }

    const previewHint = await page.locator('#preview-version-hint').textContent();
    if (!previewHint.includes('LINE')) {
      throw new Error('Preview version hint missing LINE scope explanation');
    }

    await page.locator('[data-story-stage="editor"]').click();
    await page.locator('#node-graph [data-node-id]').first().click();
    await page.waitForSelector('.editor-breadcrumb');
    const breadcrumb = await page.locator('.editor-breadcrumb').first().textContent();
    if (!breadcrumb.includes(story.title)) {
      throw new Error(`Editor breadcrumb missing story title: ${breadcrumb}`);
    }

    const editorScope = await page.locator('.editor-selection-scope').first().textContent();
    if (!editorScope.trim()) {
      throw new Error('Editor scope label missing');
    }

    const graphTransitionButton = await page.locator('#node-graph [data-node-action="insert-transition"]').first().textContent();
    if (!graphTransitionButton.includes('編輯過場')) {
      throw new Error('Graph transition action label did not update to semantic wording');
    }

    await page.locator('[data-workspace-tab="setting"]').click();
    await page.waitForSelector('#setting-route-overview');
    const settingStatus = await page.locator('#setting-status').textContent();
    if (!settingStatus.includes('全帳號共用')) {
      throw new Error('Setting scope hint missing');
    }

    const beforeTabs = await page.locator('#keyword-binding-tabs .keyword-tab').count();
    await page.click('#add-keyword-carousel');
    await page.waitForFunction((count) => {
      return document.querySelectorAll('#keyword-binding-tabs .keyword-tab').length === count + 1;
    }, beforeTabs);

    const keywordEditorText = await page.locator('#keyword-binding-editor').textContent();
    if (!keywordEditorText.includes('編輯帳號指令')) {
      throw new Error('Keyword editor heading did not clarify account scope');
    }

    console.log(JSON.stringify({
      dashboardLoaded: true,
      previewRendered: true,
      runtimeTriggerOk,
      storyScopeHintOk: true,
      duplicateSaveRemoved: true,
      editorBreadcrumbOk: true,
      graphSemanticsOk: true,
      previewPublishHintOk: true,
      accountKeywordEditorOk: true
    }, null, 2));
  } finally {
    await browser.close();
    await new Promise((resolve, reject) => {
      if (!server.listening) {
        resolve();
        return;
      }
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

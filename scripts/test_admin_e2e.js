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

async function run() {
  const port = 3210;
  const baseUrl = `http://127.0.0.1:${port}`;
  const app = createAdminApp();
  const server = await new Promise((resolve) => {
    const instance = app.listen(port, () => resolve(instance));
  });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });

  try {
    await waitForServer(`${baseUrl}/api/dashboard`);

    const dashboard = await jsonFetch(`${baseUrl}/api/dashboard`);
    if (!dashboard.dashboard.storys && dashboard.dashboard.storyCount < 1) {
      throw new Error('Expected at least one story in dashboard');
    }

    const draft = await jsonFetch(`${baseUrl}/api/stories/story-01/render/draft`, {
      method: 'POST',
      body: JSON.stringify({ nodeId: 'pic1' })
    });
    if (!draft.render?.payload?.messages?.length) {
      throw new Error('Draft render returned no LINE messages');
    }

    const storyPayload = await jsonFetch(`${baseUrl}/api/stories/story-01`);
    const story = storyPayload.story;
    const triggerKeyword = storyPayload.globalSettings.triggerBindings.find((binding) => binding.storyId === story.id)?.keyword || '開始故事';
    const startNode = story.nodes.find((node) => node.id === story.startNodeId);
    const advancingChoice = [startNode?.optionA, startNode?.optionB].find((option) => option?.nextNodeId);
    if (!advancingChoice?.label || !advancingChoice?.nextNodeId) {
      throw new Error('Expected start node to include at least one advancing choice');
    }

    const simulatedStart = await jsonFetch(`${baseUrl}/api/runtime/simulate`, {
      method: 'POST',
      body: JSON.stringify({ text: triggerKeyword, sessionKey: 'e2e' })
    });
    if (simulatedStart.simulation?.mode !== 'trigger') {
      throw new Error(`Expected trigger mode, got ${simulatedStart.simulation?.mode}`);
    }

    const simulatedChoice = await jsonFetch(`${baseUrl}/api/runtime/simulate`, {
      method: 'POST',
      body: JSON.stringify({ text: advancingChoice.label, sessionKey: 'e2e' })
    });
    if (simulatedChoice.simulation?.session?.currentNodeId !== advancingChoice.nextNodeId) {
      throw new Error(`Expected session to advance to ${advancingChoice.nextNodeId}, got ${simulatedChoice.simulation?.session?.currentNodeId}`);
    }

    const storyRender = await jsonFetch(`${baseUrl}/api/stories/story-01/render/story`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    if (!storyRender.story?.nodes?.length) {
      throw new Error('Whole story render returned no node render results');
    }

    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    await page.waitForSelector('text=Ho-Se Ong Lai');
    await page.waitForSelector('.story-bar');
    await page.waitForSelector('.story-subbar');
    await page.waitForSelector('#story-list [data-story-id]');
    await page.locator('#story-list [data-story-id]').first().click();
    await page.waitForSelector('#editor-story-title');
    await page.waitForSelector('#story-stage-tabs');

    const storyTitle = await page.locator('#editor-story-title').textContent();
    if (!storyTitle.includes(story.title)) {
      throw new Error(`Unexpected editor title: ${storyTitle}`);
    }

    const progressText = await page.locator('#story-progress-grid').textContent();
    if (!progressText.includes('角色數') || !progressText.includes('草稿節點')) {
      throw new Error('Story progress summary missing');
    }

    const payloadText = await page.locator('#payload-preview').textContent();
    if (!payloadText.includes('"messages"')) {
      throw new Error('Payload preview missing messages JSON');
    }

    await page.click('[data-preview-panel="simulate"]');
    await page.fill('#simulate-session-key', 'ui-smoke');
    await page.fill('#simulate-text', triggerKeyword);
    await page.click('#simulate-message');
    await page.waitForFunction(() => {
      const output = document.querySelector('#simulation-output');
      return output && output.textContent.includes('"mode": "trigger"');
    });

    await page.fill('#simulate-text', advancingChoice.label);
    await page.click('#simulate-message');
    await page.waitForFunction((nextNodeId) => {
      const output = document.querySelector('#simulation-output');
      return output && output.textContent.includes(`"currentNodeId": "${nextNodeId}"`);
    }, advancingChoice.nextNodeId);

    await page.click('[data-story-stage="import"]');
    await page.fill('#script-import-text', 'PIC1\n熊熊：哈囉\n\nPIC2\n莉莉：早安\n熊熊：早安');
    await page.click('#import-script-text');
    await page.waitForFunction(() => {
      const status = document.querySelector('#draft-import-status');
      return status && status.textContent.includes('節點：2');
    });
    await page.waitForSelector('#draft-node-list .story-card');
    await page.locator('#draft-node-list .story-card').first().click();
    await page.waitForSelector('#draft-editor-form');
    const draftEditorText = await page.locator('#draft-editor-form').textContent();
    if (!draftEditorText.includes('快速改為對話卡') || !draftEditorText.includes('套用此節點到正式故事')) {
      throw new Error('Draft editor missing quick correction actions');
    }

    await page.click('[data-story-stage="characters"]');
    await page.waitForSelector('#story-character-list .character-card');
    const settingsText = await page.locator('#story-character-list').textContent();
    if (!settingsText.includes('熊熊') || !settingsText.includes('莉莉')) {
      throw new Error('Character settings missing expected characters');
    }
    await page.click('#add-supporting-template');
    await page.waitForFunction(() => document.querySelectorAll('#story-character-list .character-card').length >= 3);

    const globalResponse = await page.request.get(`${baseUrl}/api/global-settings`, {
      headers: {
        'x-lineat-role': 'manager',
        'x-lineat-actor': 'e2e'
      }
    });
    const globalSettings = await globalResponse.json();
    const bear = globalSettings.globalSettings.characters.find((entry) => entry.id === 'char-bear');
    if (!bear || bear.avatarPath !== '/public/story/01/bhead001.png') {
      throw new Error('Bear avatar default not wired to /public/story/01/bhead001.png');
    }

    console.log(JSON.stringify({
      dashboardLoaded: true,
      draftRendered: true,
      storyRendered: true,
      triggerSimulated: true,
      sessionAdvanced: true,
      uiLoaded: true,
      payloadPreviewReady: true,
      localEventTestingReady: true,
      characterAssetsReady: true,
      draftImportReady: true,
      manualCorrectionReady: true
    }, null, 2));
  } finally {
    await browser.close();
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

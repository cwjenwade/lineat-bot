const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');
const { chromium } = require('playwright');

async function run() {
  const tempImagePath = path.join(os.tmpdir(), 'lineat-admin-test.png');
  await sharp({
    create: {
      width: 64,
      height: 64,
      channels: 3,
      background: { r: 210, g: 160, b: 110 }
    }
  }).png().toFile(tempImagePath);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

  try {
    await page.goto('http://127.0.0.1:3002/', { waitUntil: 'networkidle' });

    await page.waitForSelector('text=Create');
    await page.waitForSelector('text=Preview');

    const widthsBefore = await page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement);
      return {
        left: styles.getPropertyValue('--left-width').trim(),
        center: styles.getPropertyValue('--center-width').trim(),
        right: styles.getPropertyValue('--right-width').trim()
      };
    });

    const gutter = page.locator('[data-gutter="left"]');
    const box = await gutter.boundingBox();
    if (!box) {
      throw new Error('Left gutter missing');
    }
    const dragY = box.y + 24;
    await page.mouse.move(box.x + box.width / 2, dragY);
    await page.mouse.down();
    await page.mouse.move(box.x + 120, dragY, { steps: 12 });
    await page.mouse.up();

    const widthsAfter = await page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement);
      return {
        left: styles.getPropertyValue('--left-width').trim(),
        center: styles.getPropertyValue('--center-width').trim(),
        right: styles.getPropertyValue('--right-width').trim()
      };
    });

    const leftDiff = Math.abs(parseFloat(widthsBefore.left) - parseFloat(widthsAfter.left));
    const centerDiff = Math.abs(parseFloat(widthsBefore.center) - parseFloat(widthsAfter.center));
    if (leftDiff < 0.05 && centerDiff < 0.05) {
      throw new Error(`Column resize did not change layout widths: before=${JSON.stringify(widthsBefore)} after=${JSON.stringify(widthsAfter)}`);
    }

    await page.fill('#new-story-title', 'E2E Story');
    await page.click('#create-story');
    await page.locator('.story-pill.active').filter({ hasText: 'E2E Story' }).waitFor();

    const characterCards = page.locator('#character-library .character-card');
    if (await characterCards.count() < 2) {
      throw new Error('Expected default characters to exist');
    }

    const bearCard = characterCards.nth(0);
    const lilyCard = characterCards.nth(1);
    await bearCard.locator('input[type="file"]').setInputFiles(tempImagePath);
    await lilyCard.locator('input[type="file"]').setInputFiles(tempImagePath);
    await page.waitForSelector('#character-library .character-card img.character-avatar');

    const beforeTimelineCount = await page.locator('#storyboard .story-node').count();
    await page.click('.palette-item[data-type="dialogue"]');
    const afterTimelineCount = await page.locator('#storyboard .story-node').count();

    if (afterTimelineCount !== beforeTimelineCount + 1) {
      throw new Error(`Expected timeline count ${beforeTimelineCount + 1}, got ${afterTimelineCount}`);
    }

    await page.waitForSelector('#scene-preview .rpg-scene');
    await page.locator('#node-inspector input[type="file"]').nth(0).setInputFiles(tempImagePath);
    await page.waitForTimeout(400);

    const hasFixedCharacters = await page.evaluate(() => {
      return Boolean(
        document.querySelector('#scene-preview .rpg-avatar.left-lower') &&
        document.querySelector('#scene-preview .rpg-avatar.right-lower') &&
        document.querySelector('#scene-preview .rpg-nameplate')
      );
    });
    if (!hasFixedCharacters) {
      throw new Error('RPG dialogue preview missing fixed left/right character positions');
    }

    await page.click('.palette-item[data-type="carousel"]');
    await page.waitForSelector('#scene-preview .line-carousel');
    await page.locator('#node-inspector input[type="file"]').nth(0).setInputFiles(tempImagePath);
    const hasLargeCarouselImage = await page.evaluate(() => {
      const image = document.querySelector('#scene-preview .line-carousel .rpg-scene-image');
      return Boolean(image);
    });
    if (!hasLargeCarouselImage) {
      throw new Error('Carousel preview missing large image scene');
    }

    const script = `《熊熊測試故事》

PIC1
熊熊醒來，覺得心裡有點空。

PIC2
選項
勇敢往前走
今天先退回去
結果 這條路暫時還沒打開，換個更靠近內心的選擇吧。`;

    await page.click('#open-script-drawer');
    await page.fill('#script-input', script);
    await page.click('#analyze-script');
    await page.waitForSelector('#suggestion-list .story-node');

    const suggestionCount = await page.locator('#suggestion-list .story-node').count();
    if (suggestionCount < 2) {
      throw new Error(`Expected at least 2 suggestions, got ${suggestionCount}`);
    }

    await page.click('#apply-all-suggestions');
    await page.waitForFunction(() => document.querySelectorAll('#suggestion-list .story-node').length === 0);

    await page.click('#save-story');
    await page.waitForTimeout(800);

    await page.click('[data-top-tab="preview"]');
    await page.waitForSelector('#preview-json');
    const jsonText = await page.locator('#preview-json').textContent();
    if (!jsonText.includes('E2E Story')) {
      throw new Error('Preview tab JSON missing story title');
    }

    const chatCount = await page.locator('#preview-chat .chat-item').count();
    if (chatCount < 1) {
      throw new Error('Preview chat did not render any scenes');
    }

    const previewHasRpg = await page.evaluate(() => {
      return Boolean(
        document.querySelector('#preview-chat .rpg-avatar.left-lower') &&
        document.querySelector('#preview-chat .rpg-avatar.right-lower') &&
        document.querySelector('#preview-chat .line-carousel .rpg-scene-image')
      );
    });
    if (!previewHasRpg) {
      throw new Error('Preview tab missing RPG dialogue or large-image carousel rendering');
    }

    console.log(JSON.stringify({
      storyCreated: true,
      moduleAdded: true,
      charactersConfigured: true,
      rpgDialogueReady: true,
      largeCarouselReady: true,
      suggestionsApplied: true,
      resized: true,
      previewLoaded: true
    }, null, 2));
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

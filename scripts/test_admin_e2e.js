const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

  try {
    await page.goto('http://localhost:3002/', { waitUntil: 'networkidle' });

    await page.waitForSelector('text=CONStruct');
    await page.waitForSelector('text=Implement');

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
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 20, box.y + box.height / 2, { steps: 8 });
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

    const beforeTimelineCount = await page.locator('#timeline .timeline-card').count();
    await page.click('.palette-item[data-type="choice"]');
    const afterTimelineCount = await page.locator('#timeline .timeline-card').count();

    if (afterTimelineCount !== beforeTimelineCount + 1) {
      throw new Error(`Expected timeline count ${beforeTimelineCount + 1}, got ${afterTimelineCount}`);
    }

    const script = `《熊熊測試故事》

PIC1
熊熊醒來，覺得心裡有點空。

PIC2
選項
勇敢往前走
今天先退回去
結果 這條路暫時還沒打開，換個更靠近內心的選擇吧。`;

    await page.fill('#script-input', script);
    await page.click('#analyze-script');
    await page.waitForSelector('#suggestion-list .timeline-card');

    const suggestionCount = await page.locator('#suggestion-list .timeline-card').count();
    if (suggestionCount < 2) {
      throw new Error(`Expected at least 2 suggestions, got ${suggestionCount}`);
    }

    await page.click('#apply-all-suggestions');
    await page.waitForFunction(() => !document.querySelector('#suggestion-list .timeline-card'));

    await page.click('#save-story');
    await page.waitForTimeout(800);

    await page.click('[data-top-tab="implement"]');
    await page.waitForSelector('#implement-json');
    const jsonText = await page.locator('#implement-json').textContent();
    if (!jsonText.includes('E2E Story')) {
      throw new Error('Implement tab JSON missing story title');
    }

    console.log(JSON.stringify({
      storyCreated: true,
      moduleAdded: true,
      suggestionsApplied: true,
      resized: true,
      implementViewLoaded: true
    }, null, 2));
  } finally {
    await browser.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

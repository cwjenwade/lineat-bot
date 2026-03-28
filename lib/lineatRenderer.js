const fs = require('fs');
const path = require('path');
const { createHash } = require('crypto');

const { createCanvas, registerFont } = require('canvas');
const sharp = require('sharp');

const PUBLIC_ROOT = path.join(__dirname, '..', 'public');
const GENERATED_ROOT = path.join(PUBLIC_ROOT, 'generated');
const NOTO_SANS_TC_PATH = path.join(__dirname, '..', 'assets', 'fonts', 'NotoSansTC-Regular.otf');
const EMBEDDED_FONT_PATH = path.join(__dirname, '..', 'assets', 'fonts', 'LineatTC-Bold.ttf');
const EMBEDDED_FONT_DATA_URL = fs.existsSync(EMBEDDED_FONT_PATH)
  ? `data:font/ttf;base64,${fs.readFileSync(EMBEDDED_FONT_PATH).toString('base64')}`
  : '';
const CARD_WIDTH = 320;
const CARD_SCALE = 4;
const RENDERED_CARD_WIDTH = CARD_WIDTH * CARD_SCALE;
const RENDER_PIPELINE_VERSION = 8;
const LINE_CARD_BUBBLE_SIZE = 'mega';
const LINE_FONT_FAMILY = 'NotoSansTC';

if (fs.existsSync(NOTO_SANS_TC_PATH)) {
  registerFont(NOTO_SANS_TC_PATH, { family: LINE_FONT_FAMILY });
}

function getNameplatePreset(globalSettings, sizeKey = 'lg') {
  return globalSettings.nameplateSizePresets?.[sizeKey] || globalSettings.nameplateSizePresets?.lg;
}

function getCharacter(globalSettings, characterId) {
  return (globalSettings.characters || []).find((character) => character.id === characterId) || null;
}

function getScopedSettings(store, story) {
  return {
    ...store.globalSettings,
    characters: story.characters?.length ? story.characters : store.globalSettings.characters
  };
}

function resolveAssetUrl(assetPath = '', publicBaseUrl = '') {
  if (!assetPath) return '';
  if (/^https?:\/\//.test(assetPath)) return assetPath;
  if (!assetPath.startsWith('/')) {
    return `${publicBaseUrl}/${assetPath}`.replace(/([^:]\/)\/+/g, '$1');
  }
  return `${publicBaseUrl}${assetPath}`;
}

function assetExists(assetPath = '') {
  if (!assetPath || /^https?:\/\//.test(assetPath)) return true;
  const relative = assetPath.startsWith('/public/')
    ? assetPath.slice('/public/'.length)
    : assetPath.startsWith('public/')
      ? assetPath.slice('public/'.length)
      : assetPath.replace(/^\//, '');
  return fs.existsSync(path.join(PUBLIC_ROOT, relative));
}

function ensureGeneratedDir() {
  fs.mkdirSync(GENERATED_ROOT, { recursive: true });
}

function normalizeGeneratedAssetPath(assetPath = '') {
  if (!assetPath) return '';
  if (assetPath.startsWith('/public/generated/')) return assetPath;
  if (assetPath.startsWith('public/generated/')) return `/${assetPath}`;
  return '';
}

function pruneGeneratedAssets(keepAssetPaths = []) {
  ensureGeneratedDir();
  const keepFiles = new Set(
    keepAssetPaths
      .map((assetPath) => normalizeGeneratedAssetPath(assetPath))
      .filter(Boolean)
      .map((assetPath) => path.basename(assetPath))
  );
  const deletedAssetPaths = [];

  for (const fileName of fs.readdirSync(GENERATED_ROOT)) {
    if (!/\.(jpg|jpeg|png|webp)$/i.test(fileName)) continue;
    if (keepFiles.has(fileName)) continue;
    fs.unlinkSync(path.join(GENERATED_ROOT, fileName));
    deletedAssetPaths.push(`/public/generated/${fileName}`);
  }

  return deletedAssetPaths;
}

function escapeXml(value = '') {
  return `${value}`
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function toAbsoluteAssetPath(assetPath = '') {
  if (!assetPath || /^https?:\/\//.test(assetPath)) return '';
  const relative = assetPath.startsWith('/public/')
    ? assetPath.slice('/public/'.length)
    : assetPath.startsWith('public/')
      ? assetPath.slice('public/'.length)
      : assetPath.replace(/^\//, '');
  return path.join(PUBLIC_ROOT, relative);
}

async function readAssetBuffer(assetPath = '') {
  if (!assetPath) return null;
  if (/^https?:\/\//.test(assetPath)) {
    const response = await fetch(assetPath);
    if (!response.ok) {
      throw new Error(`Failed to fetch asset: ${assetPath}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }
  const absolute = toAbsoluteAssetPath(assetPath);
  if (!absolute || !fs.existsSync(absolute)) {
    throw new Error(`Asset not found: ${assetPath}`);
  }
  return fs.readFileSync(absolute);
}

function parseLineSpacing(value, fallbackPx) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const match = value.match(/(-?\d+(?:\.\d+)?)/);
    if (match) return Number(match[1]);
  }
  return fallbackPx;
}

function createRoundedRectSvg({ x, y, width, height, radius, fill }) {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="${fill}" />`;
}

function createSvgDocument(width, height, body) {
  const fontFaceCss = EMBEDDED_FONT_DATA_URL
    ? `
        @font-face {
          font-family: '${LINE_FONT_FAMILY}';
          src: url('${EMBEDDED_FONT_DATA_URL}') format('truetype');
          font-weight: 700;
          font-style: normal;
        }
      `
    : '';
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        ${fontFaceCss}
        text {
          font-family: '${LINE_FONT_FAMILY}', sans-serif;
        }
      </style>
      ${body}
    </svg>
  `;
}

function canvasFont(fontSize, weight = 700) {
  return `${weight} ${fontSize}px "${LINE_FONT_FAMILY}"`;
}

function roundedRectPath(ctx, x, y, width, height, radius) {
  const nextRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  ctx.beginPath();
  ctx.moveTo(x + nextRadius, y);
  ctx.lineTo(x + width - nextRadius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + nextRadius);
  ctx.lineTo(x + width, y + height - nextRadius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - nextRadius, y + height);
  ctx.lineTo(x + nextRadius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - nextRadius);
  ctx.lineTo(x, y + nextRadius);
  ctx.quadraticCurveTo(x, y, x + nextRadius, y);
  ctx.closePath();
}

function wrapCanvasTextLines(ctx, text, maxWidth) {
  const rawLines = `${text || ''}`.split('\n');
  const lines = [];

  rawLines.forEach((rawLine) => {
    if (!rawLine) {
      lines.push('');
      return;
    }

    let current = '';
    for (const character of rawLine) {
      const candidate = `${current}${character}`;
      if (current && ctx.measureText(candidate).width > maxWidth) {
        lines.push(current);
        current = character;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
  });

  return lines.length ? lines : [''];
}

function drawCenteredTextBlock(ctx, {
  x,
  y,
  width,
  height,
  text,
  fontSize,
  lineSpacing,
  color = '#2D241B',
  weight = 700
}) {
  ctx.save();
  ctx.font = canvasFont(fontSize, weight);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const lines = wrapCanvasTextLines(ctx, text, width);
  const lineHeight = fontSize + lineSpacing;
  const centerY = y + (height / 2);
  const startY = centerY - (((lines.length - 1) * lineHeight) / 2);
  const centerX = x + (width / 2);

  lines.forEach((line, index) => {
    ctx.fillText(line, centerX, startY + (index * lineHeight));
  });
  ctx.restore();
}

function greatestCommonDivisor(a, b) {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    [x, y] = [y, x % y];
  }
  return x || 1;
}

function toAspectRatio(width, height) {
  const divisor = greatestCommonDivisor(width, height);
  return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
}

async function extractCoverBuffer(assetPath, targetWidth, targetHeight, options = {}) {
  const centerX = Number.isFinite(options.centerX) ? options.centerX : 50;
  const centerY = Number.isFinite(options.centerY) ? options.centerY : 50;
  const zoom = Math.max(1, Number.isFinite(options.zoom) ? options.zoom : 1);
  const source = await readAssetBuffer(assetPath);
  const image = sharp(source, { failOn: 'none' }).rotate();
  const metadata = await image.metadata();
  const sourceWidth = metadata.width || targetWidth;
  const sourceHeight = metadata.height || targetHeight;
  const targetRatio = targetWidth / targetHeight;
  const sourceRatio = sourceWidth / sourceHeight;

  let cropWidth;
  let cropHeight;
  if (sourceRatio > targetRatio) {
    cropHeight = sourceHeight;
    cropWidth = cropHeight * targetRatio;
  } else {
    cropWidth = sourceWidth;
    cropHeight = cropWidth / targetRatio;
  }

  cropWidth = Math.max(1, Math.round(cropWidth / zoom));
  cropHeight = Math.max(1, Math.round(cropHeight / zoom));

  const desiredLeft = Math.round((sourceWidth * (centerX / 100)) - (cropWidth / 2));
  const desiredTop = Math.round((sourceHeight * (centerY / 100)) - (cropHeight / 2));
  const left = Math.max(0, Math.min(sourceWidth - cropWidth, desiredLeft));
  const top = Math.max(0, Math.min(sourceHeight - cropHeight, desiredTop));

  return image
    .extract({ left, top, width: cropWidth, height: cropHeight })
    .resize(targetWidth, targetHeight, { fit: 'fill' })
    .png()
    .toBuffer();
}

async function extractCircularAvatarBuffer(assetPath, targetSize, options = {}) {
  const square = await extractCoverBuffer(assetPath, targetSize, targetSize, options);
  const radius = targetSize / 2;
  return sharp(square)
    .composite([{
      input: Buffer.from(`
        <svg width="${targetSize}" height="${targetSize}" xmlns="http://www.w3.org/2000/svg">
          <circle cx="${radius}" cy="${radius}" r="${radius}" fill="#fff" />
        </svg>
      `),
      blend: 'dest-in'
    }])
    .png()
    .toBuffer();
}

async function buildDialogueOrNarrationCardBuffer(model, globalSettings) {
  const scale = CARD_SCALE;
  const layout = model.layout;
  const width = RENDERED_CARD_WIDTH;
  const height = layout.totalHeight * scale;
  const heroHeight = layout.heroHeight * scale;
  const bodyHeight = layout.bodyHeight * scale;
  const bodyTop = layout.intersectionY * scale;
  const bodyPaddingTop = layout.bodyPaddingTop * scale;
  const bodyPaddingBottom = layout.bodyPaddingBottom * scale;
  const safePaddingStart = model.kind === 'dialogue' && model.speaker?.placement === 'left'
    ? layout.leftSafePadding * scale
    : layout.bodyPaddingSide * scale;
  const safePaddingEnd = model.kind === 'dialogue' && model.speaker?.placement === 'right'
    ? layout.rightSafePadding * scale
    : layout.bodyPaddingSide * scale;
  const bodyInnerWidth = width - safePaddingStart - safePaddingEnd;
  const bodyInnerHeight = bodyHeight - bodyPaddingTop - bodyPaddingBottom;
  const fontSize = model.lineTextSize === 'xl' ? 24 * scale : model.lineTextSize === 'md' ? 18 * scale : 20 * scale;
  const lineSpacing = parseLineSpacing(layout.lineSpacing, 6) * scale;

  const hero = await extractCoverBuffer(model.imagePath || model.imageUrl, width, heroHeight, {
    centerX: 50,
    centerY: 50,
    zoom: Number.isFinite(model.heroImageScale) ? model.heroImageScale : 1
  });

  const composites = [
    { input: hero, top: 0, left: 0 }
  ];

  if ((model.heroImageOpacity ?? 1) < 1) {
    const overlayAlpha = Math.max(0, Math.min(1, 1 - (model.heroImageOpacity ?? 1)));
    composites.push({
      input: Buffer.from(createSvgDocument(width, heroHeight, `
          <rect width="${width}" height="${heroHeight}" fill="rgba(255,255,255,${overlayAlpha.toFixed(3)})" />
      `)),
      top: 0,
      left: 0
    });
  }

  composites.push({
    input: Buffer.from(createSvgDocument(width, height, `
        ${createRoundedRectSvg({
          x: 0,
          y: bodyTop,
          width,
          height: bodyHeight,
          radius: 0,
          fill: '#FFFDF8'
        })}
      `)),
    top: 0,
    left: 0
  });

  const overlayCanvas = createCanvas(width, height);
  const ctx = overlayCanvas.getContext('2d');
  ctx.textDrawingMode = 'path';

  const roles = model.kind === 'dialogue' ? [model.speaker, model.companion].filter(Boolean) : [];
  for (const [index, role] of roles.entries()) {
    const avatarSize = role.avatarSize * scale;
    const avatar = await extractCircularAvatarBuffer(role.avatarPath || role.avatarUrl, avatarSize, {
      centerX: role.avatarCenterX ?? 50,
      centerY: role.avatarCenterY ?? 50,
      zoom: Number.isFinite(role.avatarScale) ? role.avatarScale : 1
    });
    composites.push({
      input: avatar,
      top: role.avatarY * scale,
      left: role.placement === 'left' ? role.avatarX * scale : width - avatarSize - (role.avatarX * scale),
      blend: 'over'
    });

    if (index === 0 && role.showNameplate !== false) {
      const preset = getNameplatePreset(globalSettings, model.nameplateSize);
      const plateFontSize = preset.label === 'xl' ? 19 * scale : preset.label === 'md' ? 15 * scale : 17 * scale;
      const platePaddingX = preset.paddingX * scale;
      const platePaddingY = preset.paddingY * scale;
      ctx.save();
      ctx.font = canvasFont(plateFontSize, 800);
      const plateTextWidth = ctx.measureText(role.name || '').width;
      ctx.restore();
      const plateWidth = Math.round(plateTextWidth + platePaddingX + platePaddingX);
      const plateHeight = Math.round((plateFontSize * 1.1) + platePaddingY + platePaddingY);
      const plateX = role.nameplateAnchor === 'right-percent'
        ? width - plateWidth - Math.round(width * ((role.nameplateRightPercent || 0) / 100))
        : role.nameplateAnchor === 'right-fixed'
          ? width - plateWidth - (role.nameplateX * scale)
          : role.nameplateX * scale;
      const plateY = role.nameplateY * scale;
      ctx.save();
      roundedRectPath(ctx, plateX, plateY, plateWidth, plateHeight, preset.cornerRadius * scale);
      ctx.fillStyle = role.nameplateColor;
      ctx.fill();
      ctx.font = canvasFont(plateFontSize, 800);
      ctx.fillStyle = role.nameplateTextColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(role.name, plateX + (plateWidth / 2), plateY + (plateHeight / 2) + (plateFontSize * 0.08));
      ctx.restore();
    }
  }

  drawCenteredTextBlock(ctx, {
    x: safePaddingStart,
    y: bodyTop + bodyPaddingTop,
    width: bodyInnerWidth,
    height: bodyInnerHeight,
    text: model.text,
    fontSize,
    lineSpacing,
    color: model.lineTextColor || '#2D241B',
    weight: 700
  });

  composites.push({
    input: overlayCanvas.toBuffer('image/png'),
    top: 0,
    left: 0
  });

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: '#F5EEE3'
    }
  }).composite(composites).png().toBuffer();
}

async function buildChoiceCardBuffer(model) {
  const scale = CARD_SCALE;
  const width = RENDERED_CARD_WIDTH;
  const height = model.layout.heroHeight * scale;
  const hero = await extractCoverBuffer(model.imagePath || model.imageUrl, width, height, {
    centerX: 50,
    centerY: 50,
    zoom: Number.isFinite(model.heroImageScale) ? model.heroImageScale : 1
  });

  const composites = [{ input: hero, top: 0, left: 0 }];
  if ((model.heroImageOpacity ?? 1) < 1) {
    const overlayAlpha = Math.max(0, Math.min(1, 1 - (model.heroImageOpacity ?? 1)));
    composites.push({
      input: Buffer.from(createSvgDocument(width, height, `
          <rect width="${width}" height="${height}" fill="rgba(255,255,255,${overlayAlpha.toFixed(3)})" />
      `)),
      top: 0,
      left: 0
    });
  }

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: '#F5EEE3'
    }
  }).composite(composites).png().toBuffer();
}

function renderKeyToFileName(renderKey = '') {
  const dialogueOrNarration = renderKey.match(/^([^:]+):(dialogue|narration)$/);
  if (dialogueOrNarration) {
    return `${dialogueOrNarration[1]}.png`;
  }

  const choice = renderKey.match(/^([^:]+):choice$/);
  if (choice) {
    return `${choice[1]}__choice.png`;
  }

  const page = renderKey.match(/^([^:]+):page:([^:]+)$/);
  if (page) {
    return `${page[1]}__${page[2]}.png`;
  }

  return `${renderKey.replace(/[^a-zA-Z0-9_-]+/g, '_')}.png`;
}

function renderKeyToNodeId(renderKey = '') {
  return `${renderKey}`.split(':')[0] || '';
}

async function renderCardBuffer(model, globalSettings) {
  return model.kind === 'choice'
    ? buildChoiceCardBuffer(model, globalSettings)
    : buildDialogueOrNarrationCardBuffer(model, globalSettings);
}

async function ensureRenderedCardImage(model, globalSettings, publicBaseUrl) {
  ensureGeneratedDir();
  const fileName = renderKeyToFileName(model.renderKey || '');
  const outputPath = path.join(GENERATED_ROOT, fileName);
  const buffer = await renderCardBuffer(model, globalSettings);
  const nextHash = sha256(buffer);
  const currentHash = fs.existsSync(outputPath) ? sha256(fs.readFileSync(outputPath)) : '';
  if (currentHash !== nextHash) {
    fs.writeFileSync(outputPath, buffer);
  }
  return {
    renderedImagePath: getRenderedCardAssetPath(model, globalSettings),
    renderedImageUrl: resolveAssetUrl(getRenderedCardAssetPath(model, globalSettings), publicBaseUrl),
    imageHash: nextHash,
    skipped: Boolean(currentHash) && currentHash === nextHash
  };
}

function getRenderedCardAssetPath(model, globalSettings) {
  void globalSettings;
  return `/public/generated/${renderKeyToFileName(model.renderKey || '')}`;
}

function previewFontCss(fontKey = 'default') {
  if (fontKey === 'handwritten') return '"BiauKai", "DFKai-SB", "Klee One", "PingFang TC", cursive';
  if (fontKey === 'cute') return '"Hannotate TC", "HanziPen TC", "PingFang TC", sans-serif';
  if (fontKey === 'serif') return '"Songti TC", "Noto Serif TC", serif';
  if (fontKey === 'rounded') return '"Arial Rounded MT Bold", "PingFang TC", sans-serif';
  return '"PingFang TC", "Noto Sans TC", sans-serif';
}

function normalizeLineTextSize(size = 'lg') {
  return ['md', 'lg', 'xl'].includes(size) ? size : 'lg';
}

function createSpeakerMeta(globalSettings, characterId, publicBaseUrl, forceNameplate = true) {
  const character = getCharacter(globalSettings, characterId);
  if (!character) return null;
  return {
    ...character,
    avatarUrl: resolveAssetUrl(character.avatarPath, publicBaseUrl),
    showNameplate: forceNameplate
  };
}

function createDialogueCardModel(source, globalSettings, publicBaseUrl, options = {}) {
  const layout = globalSettings.cardLayouts.dialogue;
  const speaker = createSpeakerMeta(globalSettings, source.speakerCharacterId, publicBaseUrl, true);
  const companion = source.companionCharacterId ? createSpeakerMeta(globalSettings, source.companionCharacterId, publicBaseUrl, false) : null;

  return {
    kind: 'dialogue',
    title: source.title || '',
    imagePath: source.imagePath || '',
    imageUrl: resolveAssetUrl(source.imagePath, publicBaseUrl),
    text: source.text || '',
    previewFont: source.previewFont || globalSettings.defaults.previewFont,
    lineTextSize: normalizeLineTextSize(source.lineTextSize || globalSettings.defaults.lineTextSize),
    lineTextColor: source.lineTextColor || '#2D241B',
    heroImageOpacity: Number.isFinite(source.heroImageOpacity) ? source.heroImageOpacity : 1,
    heroImageScale: Number.isFinite(source.heroImageScale) ? source.heroImageScale : 1,
    nameplateSize: source.nameplateSize || globalSettings.defaults.nameplateSize,
    renderKey: options.renderKey || source.id || source.title || `dialogue-${createHash('sha1').update(JSON.stringify(source)).digest('hex').slice(0, 8)}`,
    layout,
    speaker,
    companion
  };
}

function resolvePreviewFontFamily(fontKey = 'default') {
  return previewFontCss(fontKey)
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .join(', ');
}

function createNarrationCardModel(source, globalSettings, publicBaseUrl) {
  return {
    kind: 'narration',
    title: source.title || '旁白',
    imagePath: source.imagePath || '',
    imageUrl: resolveAssetUrl(source.imagePath, publicBaseUrl),
    text: source.text || '',
    previewFont: source.previewFont || globalSettings.defaults.previewFont,
    lineTextSize: normalizeLineTextSize(source.lineTextSize || globalSettings.defaults.lineTextSize),
    lineTextColor: source.lineTextColor || '#2D241B',
    heroImageOpacity: Number.isFinite(source.heroImageOpacity) ? source.heroImageOpacity : 1,
    heroImageScale: Number.isFinite(source.heroImageScale) ? source.heroImageScale : 1,
    renderKey: source.renderKey || source.id || source.title || `narration-${createHash('sha1').update(JSON.stringify(source)).digest('hex').slice(0, 8)}`,
    layout: globalSettings.cardLayouts.narration
  };
}

function createChoiceCardModel(node, globalSettings, publicBaseUrl) {
  return {
    kind: 'choice',
    title: node.title || '選項',
    imagePath: node.imagePath || '',
    imageUrl: resolveAssetUrl(node.imagePath, publicBaseUrl),
    prompt: node.prompt || '在這裡輸入選項提問。',
    heroImageOpacity: Number.isFinite(node.heroImageOpacity) ? node.heroImageOpacity : 1,
    heroImageScale: Number.isFinite(node.heroImageScale) ? node.heroImageScale : 1,
    optionA: node.optionA,
    optionB: node.optionB,
    renderKey: node.renderKey || `${node.id}:choice`,
    layout: globalSettings.cardLayouts.choice
  };
}

function buildNodeModels(story, node, globalSettings, publicBaseUrl) {
  const models = [];

  if (node.type === 'dialogue') {
    models.push(createDialogueCardModel(node, globalSettings, publicBaseUrl, {
      renderKey: `${node.id}:dialogue`
    }));
  } else if (node.type === 'narration') {
    models.push(createNarrationCardModel({
      ...node,
      renderKey: `${node.id}:narration`
    }, globalSettings, publicBaseUrl));
  } else if (node.type === 'carousel') {
    (node.pages || []).forEach((page) => {
      if (page.cardType === 'narration') {
        models.push(createNarrationCardModel({
          ...page,
          renderKey: `${node.id}:page:${page.id}`
        }, globalSettings, publicBaseUrl));
      } else {
        models.push(createDialogueCardModel(page, globalSettings, publicBaseUrl, {
          renderKey: `${node.id}:page:${page.id}`
        }));
      }
    });
  } else if (node.type === 'choice') {
    if (Array.isArray(node.pages) && node.pages.length) {
      node.pages.forEach((page) => {
        if (page.cardType === 'narration') {
          models.push(createNarrationCardModel({
            ...page,
            renderKey: `${node.id}:page:${page.id}`
          }, globalSettings, publicBaseUrl));
        } else {
          models.push(createDialogueCardModel(page, globalSettings, publicBaseUrl, {
            renderKey: `${node.id}:page:${page.id}`
          }));
        }
      });
    } else if (node.speakerCharacterId) {
      models.push(createDialogueCardModel(node, globalSettings, publicBaseUrl, {
        renderKey: `${node.id}:dialogue`
      }));
    } else if (node.text) {
      models.push(createNarrationCardModel({
        ...node,
        renderKey: `${node.id}:narration`
      }, globalSettings, publicBaseUrl));
    }
    models.push(createChoiceCardModel({
      ...node,
      renderKey: `${node.id}:choice`
    }, globalSettings, publicBaseUrl));
  }

  return models;
}

function createRenderedImageBubble(imageUrl, altText = '故事卡片') {
  return {
    type: 'flex',
    altText,
    contents: {
      type: 'bubble',
      size: LINE_CARD_BUBBLE_SIZE,
      hero: {
        type: 'image',
        url: imageUrl,
        size: 'full',
        aspectRatio: '16:27',
        aspectMode: 'cover'
      }
    }
  };
}

function createRenderedCarouselMessage(models, altText = '故事多頁訊息') {
  return {
    type: 'flex',
    altText,
    contents: {
      type: 'carousel',
      contents: models.map((model) => ({
        type: 'bubble',
        size: LINE_CARD_BUBBLE_SIZE,
        hero: {
          type: 'image',
          url: model.renderedImageUrl,
          size: 'full',
          aspectRatio: '16:27',
          aspectMode: 'cover'
        }
      }))
    }
  };
}

function createContinueQuickReply(label = '下一步') {
  return {
    type: 'text',
    text: '看完這一幕後，點下面按鈕繼續。',
    quickReply: {
      items: [
        {
          type: 'action',
          action: {
            type: 'message',
            label: label.slice(0, 20),
            text: label
          }
        }
      ]
    }
  };
}

function createChoiceFlexMessage(choiceModel) {
  const heroHeight = choiceModel.layout.heroHeight * CARD_SCALE;
  const heroAspectRatio = toAspectRatio(RENDERED_CARD_WIDTH, heroHeight);
  return {
    type: 'flex',
    altText: choiceModel.prompt || '故事選項',
    contents: {
      type: 'bubble',
      size: LINE_CARD_BUBBLE_SIZE,
      hero: {
        type: 'image',
        url: choiceModel.renderedImageUrl,
        size: 'full',
        aspectRatio: heroAspectRatio,
        aspectMode: 'cover'
      },
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: '20px',
        backgroundColor: '#FFF8EF',
        contents: [
          {
            type: 'text',
            text: choiceModel.prompt || '請選擇：',
            wrap: true,
            weight: 'bold',
            size: 'xl',
            align: 'center',
            color: '#2D241B'
          }
        ]
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        paddingTop: '20px',
        paddingBottom: '20px',
        paddingStart: '20px',
        paddingEnd: '20px',
        spacing: '12px',
        backgroundColor: '#FFFDF8',
        contents: [
          {
            type: 'button',
            style: 'primary',
            height: 'sm',
            color: '#F3BD63',
            action: {
              type: 'message',
              label: choiceModel.optionA.label.slice(0, 20),
              text: choiceModel.optionA.label
            }
          },
          {
            type: 'button',
            style: 'primary',
            height: 'sm',
            color: '#D8E0EF',
            action: {
              type: 'message',
              label: choiceModel.optionB.label.slice(0, 20),
              text: choiceModel.optionB.label
            }
          }
        ]
      }
    }
  };
}

function resolvePublishedImagePath(story, model) {
  if (!story?.publishedAssets || !model?.renderKey) return '';
  const assetPath = story.publishedAssets[model.renderKey]
    || story.publishedAssets[renderKeyToNodeId(model.renderKey)]
    || '';
  return assetPath && assetExists(assetPath) ? assetPath : '';
}

async function resolveModelImage(model, globalSettings, story, publicBaseUrl, options = {}) {
  const previewBaseUrl = options.previewBaseUrl || publicBaseUrl;
  const publishedPath = options.usePublishedAssets === false
    ? ''
    : resolvePublishedImagePath(story, model);
  if (publishedPath) {
    return {
      renderedImagePath: publishedPath,
      renderedImageUrl: resolveAssetUrl(publishedPath, publicBaseUrl),
      previewImageUrl: resolveAssetUrl(publishedPath, previewBaseUrl),
      imageSource: 'published'
    };
  }

  if (options.requirePublishedAssets) {
    throw new Error(`尚未發布卡片圖片：${model.renderKey}`);
  }

  const renderedImagePath = getRenderedCardAssetPath(model, globalSettings);
  const generated = await ensureRenderedCardImage(model, globalSettings, publicBaseUrl);
  return {
    renderedImagePath,
    renderedImageUrl: generated.renderedImageUrl,
    previewImageUrl: resolveAssetUrl(renderedImagePath, previewBaseUrl),
    imageHash: generated.imageHash,
    renderSkipped: generated.skipped,
    imageSource: 'generated'
  };
}

async function renderModel(model, globalSettings, story, publicBaseUrl, options = {}) {
  return {
    ...model,
    ...(await resolveModelImage(model, globalSettings, story, publicBaseUrl, options))
  };
}

function buildNodePayload(node, models) {
  const storyCards = models.filter((model) => model.kind === 'dialogue' || model.kind === 'narration');
  const lineMessages = [];

  if (storyCards.length === 1) {
    lineMessages.push(createRenderedImageBubble(
      storyCards[0].renderedImageUrl,
      node.title || storyCards[0].title || '故事卡片'
    ));
  } else if (storyCards.length > 1) {
    lineMessages.push(createRenderedCarouselMessage(storyCards, node.title || '故事多頁訊息'));
  }

  const choiceModel = models.find((model) => model.kind === 'choice');
  if (choiceModel) {
    lineMessages.push(createChoiceFlexMessage(choiceModel));
  } else if (node.nextNodeId) {
    lineMessages.push(createContinueQuickReply(node.continueLabel || '下一步'));
  }

  return { messages: lineMessages.slice(0, 5) };
}

function collectNodeImages(models) {
  return models
    .filter((model) => model.renderedImagePath && model.renderedImageUrl)
    .map((model) => ({
      renderKey: model.renderKey,
      kind: model.kind,
      path: model.renderedImagePath,
      url: model.renderedImageUrl,
      previewUrl: model.previewImageUrl || model.renderedImageUrl,
      hash: model.imageHash || '',
      skipped: Boolean(model.renderSkipped),
      source: model.imageSource || 'generated'
    }));
}

function collectPayloadImageUrls(payload) {
  const urls = [];
  for (const message of payload?.messages || []) {
    if (message?.type !== 'flex') continue;
    const contents = message.contents;
    if (contents?.type === 'carousel') {
      for (const bubble of contents.contents || []) {
        if (bubble?.hero?.url) urls.push(bubble.hero.url);
      }
      continue;
    }
    if (contents?.hero?.url) {
      urls.push(contents.hero.url);
    }
  }
  return urls;
}

function buildConsistencyReport(models, payload, publicBaseUrl, previewBaseUrl) {
  const warnings = [];
  const mismatchUrls = [];
  const report = models
    .filter((model) => model.renderedImagePath && model.renderedImageUrl)
    .map((model) => {
      const expectedLineUrl = resolveAssetUrl(model.renderedImagePath, publicBaseUrl);
      const expectedPreviewUrl = resolveAssetUrl(model.renderedImagePath, previewBaseUrl || publicBaseUrl);
      const absolutePath = toAbsoluteAssetPath(model.renderedImagePath);
      const fileHash = absolutePath && fs.existsSync(absolutePath)
        ? sha256(fs.readFileSync(absolutePath))
        : '';
      const pathConsistent = model.renderedImageUrl === expectedLineUrl;
      const previewConsistent = (model.previewImageUrl || expectedPreviewUrl) === expectedPreviewUrl;
      const hashConsistent = !model.imageHash || !fileHash || model.imageHash === fileHash;
      if (!pathConsistent) {
        mismatchUrls.push({
          renderKey: model.renderKey,
          type: 'payloadUrl',
          expected: expectedLineUrl,
          actual: model.renderedImageUrl
        });
      }
      if (!previewConsistent) {
        mismatchUrls.push({
          renderKey: model.renderKey,
          type: 'previewUrl',
          expected: expectedPreviewUrl,
          actual: model.previewImageUrl || ''
        });
      }
      if (!hashConsistent) {
        mismatchUrls.push({
          renderKey: model.renderKey,
          type: 'imageHash',
          expected: fileHash,
          actual: model.imageHash || ''
        });
      }
      return {
        renderKey: model.renderKey,
        path: model.renderedImagePath,
        payloadUrl: model.renderedImageUrl,
        previewUrl: model.previewImageUrl || expectedPreviewUrl,
        imageHash: model.imageHash || '',
        fileHash,
        pathConsistent,
        previewConsistent,
        hashConsistent
      };
    });
  const modelPayloadUrls = report.map((entry) => entry.payloadUrl);
  const payloadImageUrls = collectPayloadImageUrls(payload);
  const missingImages = modelPayloadUrls.filter((url) => !payloadImageUrls.includes(url));
  const unexpectedImages = payloadImageUrls.filter((url) => !modelPayloadUrls.includes(url));
  const orderingIssues = [];
  const comparableLength = Math.min(modelPayloadUrls.length, payloadImageUrls.length);
  for (let index = 0; index < comparableLength; index += 1) {
    if (modelPayloadUrls[index] !== payloadImageUrls[index]) {
      orderingIssues.push({
        index,
        expected: modelPayloadUrls[index],
        actual: payloadImageUrls[index]
      });
    }
  }
  if (missingImages.length) {
    warnings.push(`[renderNode] payload missing rendered urls: ${missingImages.join(', ')}`);
  }
  if (unexpectedImages.length) {
    warnings.push(`[renderNode] payload contains unexpected urls: ${unexpectedImages.join(', ')}`);
  }
  if (orderingIssues.length) {
    warnings.push(`[renderNode] payload ordering mismatch: ${orderingIssues.map((issue) => `${issue.index}:${issue.expected}!=${issue.actual}`).join(', ')}`);
  }
  if (mismatchUrls.length) {
    warnings.push(...mismatchUrls.map((issue) => `[renderNode] ${issue.type} mismatch for ${issue.renderKey}: ${issue.actual} != ${issue.expected}`));
  }
  if (warnings.length) {
    warnings.forEach((warning) => console.warn(warning));
  }
  return {
    report,
    warnings,
    missingImages,
    unexpectedImages,
    mismatchUrls,
    orderingIssues,
    payloadImageUrls,
    expectedPayloadImageUrls: modelPayloadUrls,
    payloadMatchesRenderedImages: missingImages.length === 0 && unexpectedImages.length === 0 && orderingIssues.length === 0
  };
}

async function renderNode(store, story, node, publicBaseUrl, options = {}) {
  const globalSettings = getScopedSettings(store, story);
  const models = await Promise.all(
    buildNodeModels(story, node, globalSettings, publicBaseUrl)
      .map((model) => renderModel(model, globalSettings, story, publicBaseUrl, options))
  );
  const images = collectNodeImages(models);
  const payload = buildNodePayload(node, models);
  const consistency = buildConsistencyReport(models, payload, publicBaseUrl, options.previewBaseUrl || publicBaseUrl);

  return {
    storyId: story.id,
    nodeId: node.id,
    node,
    models,
    image: images[0] || null,
    images,
    debug: {
      imageHashes: Object.fromEntries(images.map((image) => [image.renderKey, image.hash])),
      consistency
    },
    payload
  };
}

async function buildRenderResult(store, story, nodeId, publicBaseUrl, options = {}) {
  const node = story.nodes.find((entry) => entry.id === nodeId);
  if (!node) {
    throw new Error(`Node not found: ${nodeId}`);
  }
  return renderNode(store, story, node, publicBaseUrl, options);
}

async function publishStoryAssets(store, story, publicBaseUrl) {
  const publishedAssets = {};

  for (const node of story.nodes) {
    const rendered = await renderNode(store, story, node, publicBaseUrl, {
      requirePublishedAssets: false,
      usePublishedAssets: false
    });
    if (rendered.image?.path) {
      publishedAssets[node.id] = rendered.image.path;
    }
    for (const image of rendered.images) {
      publishedAssets[image.renderKey] = image.path;
    }
  }

  const assetPaths = Array.from(new Set(Object.values(publishedAssets).filter(Boolean)));
  const deletedAssetPaths = pruneGeneratedAssets(assetPaths);

  return {
    publishedAssets,
    assetPaths,
    deletedAssetPaths
  };
}

function evaluateStoryIssues(story, store) {
  const issues = [];
  const nodeIds = new Set(story.nodes.map((node) => node.id));
  const globalSettings = getScopedSettings(store, story);

  if (!story.startNodeId) {
    issues.push({ level: 'error', scope: 'story', field: 'startNodeId', message: '缺少開始節點' });
  } else if (!nodeIds.has(story.startNodeId)) {
    issues.push({ level: 'error', scope: 'story', field: 'startNodeId', message: '開始節點不存在' });
  }

  story.nodes.forEach((node) => {
    if (!node.title) issues.push({ level: 'error', scope: 'node', nodeId: node.id, field: 'title', message: '缺少節點標題' });
    if ((node.type === 'dialogue' || node.type === 'narration' || node.type === 'choice') && !node.imagePath) {
      issues.push({ level: 'error', scope: 'node', nodeId: node.id, field: 'imagePath', message: '缺少圖片' });
    }
    if (node.imagePath && !assetExists(node.imagePath)) {
      issues.push({ level: 'error', scope: 'node', nodeId: node.id, field: 'imagePath', message: `圖片不存在：${node.imagePath}` });
    }
    if (node.type === 'dialogue' && !node.speakerCharacterId) {
      issues.push({ level: 'error', scope: 'node', nodeId: node.id, field: 'speakerCharacterId', message: '對話卡缺少主講角色' });
    }
    if ((node.type === 'dialogue' || node.type === 'narration') && !node.text) {
      issues.push({ level: 'error', scope: 'node', nodeId: node.id, field: 'text', message: '缺少文字內容' });
    }
    if (node.type === 'choice') {
      if (!node.prompt) issues.push({ level: 'error', scope: 'node', nodeId: node.id, field: 'prompt', message: '缺少選項提問' });
      if (!node.optionA?.label || !node.optionB?.label) issues.push({ level: 'error', scope: 'node', nodeId: node.id, field: 'options', message: '缺少選項文案' });
      if (!node.optionA?.nextNodeId && !node.optionB?.nextNodeId) {
        issues.push({ level: 'error', scope: 'node', nodeId: node.id, field: 'options', message: '至少一個選項必須連到下一節點' });
      }
    }
    if (node.nextNodeId && !nodeIds.has(node.nextNodeId)) {
      issues.push({ level: 'error', scope: 'node', nodeId: node.id, field: 'nextNodeId', message: '下一節點不存在' });
    }
    if (node.type === 'carousel' || node.type === 'choice') {
      (node.pages || []).forEach((page) => {
        if (!page.imagePath) issues.push({ level: 'error', scope: 'page', nodeId: node.id, field: 'imagePath', message: '多頁訊息缺少圖片' });
        if (page.imagePath && !assetExists(page.imagePath)) {
          issues.push({ level: 'error', scope: 'page', nodeId: node.id, field: 'imagePath', message: `圖片不存在：${page.imagePath}` });
        }
        if (!page.text) issues.push({ level: 'error', scope: 'page', nodeId: node.id, field: 'text', message: '多頁訊息缺少文字' });
        if (page.cardType === 'dialogue' && !page.speakerCharacterId) {
          issues.push({ level: 'error', scope: 'page', nodeId: node.id, field: 'speakerCharacterId', message: '多頁對話缺少角色' });
        }
      });
    }

  });

  store.globalSettings.triggerBindings.forEach((binding) => {
    if (binding.storyId === story.id) {
      if (!binding.keyword) issues.push({ level: 'error', scope: 'trigger', field: 'keyword', message: '開始關鍵字未設定' });
      if (!binding.startNodeId || !nodeIds.has(binding.startNodeId)) {
        issues.push({ level: 'error', scope: 'trigger', field: 'startNodeId', message: '開始節點綁定錯誤' });
      }
    }
  });

  (globalSettings.characters || []).forEach((character) => {
    if (character.avatarPath && !assetExists(character.avatarPath)) {
      issues.push({ level: 'error', scope: 'character', field: 'avatarPath', message: `角色圖片不存在：${character.avatarPath}` });
    }
  });

  return issues;
}

async function validateMessagesWithLine(messages, channelAccessToken, mode = 'reply') {
  const endpoint = `https://api.line.me/v2/bot/message/validate/${mode}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${channelAccessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ messages })
  });
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    body: text
  };
}

async function broadcastMessages(messages, channelAccessToken) {
  const response = await fetch('https://api.line.me/v2/bot/message/broadcast', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${channelAccessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ messages })
  });
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    body: text,
    requestId: response.headers.get('x-line-request-id')
  };
}

function findTriggerBinding(store, keyword) {
  return (store.globalSettings.triggerBindings || []).find((binding) => binding.keyword === keyword) || null;
}

function resolveIncomingNodeAdvance(story, node, text) {
  if (!node) return { action: 'none' };
  if (node.type === 'choice') {
    const optionA = node.optionA?.label === text ? node.optionA : null;
    const optionB = node.optionB?.label === text ? node.optionB : null;
    const chosen = optionA || optionB;
    if (!chosen) return { action: 'none' };
    return {
      action: chosen.nextNodeId ? 'advance' : 'feedback',
      nextNodeId: chosen.nextNodeId || node.id,
      feedback: chosen.feedback || ''
    };
  }
  if (node.nextNodeId && [node.continueLabel, '下一步', '繼續'].filter(Boolean).includes(text)) {
    return {
      action: 'advance',
      nextNodeId: node.nextNodeId
    };
  }
  return { action: 'none' };
}

module.exports = {
  resolveAssetUrl,
  assetExists,
  previewFontCss,
  getNameplatePreset,
  buildNodeModels,
  renderNode,
  buildRenderResult,
  publishStoryAssets,
  evaluateStoryIssues,
  validateMessagesWithLine,
  broadcastMessages,
  findTriggerBinding,
  resolveIncomingNodeAdvance,
  getScopedSettings
};

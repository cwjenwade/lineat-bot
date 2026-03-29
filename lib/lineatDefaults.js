const { randomUUID } = require('crypto');
const { storyNodes, storyStartId } = require('../storyData');

const STORE_VERSION = 2;
const PREVIEW_FONT_OPTIONS = ['default', 'handwritten', 'cute', 'serif', 'rounded'];
const LINE_TEXT_SIZES = ['md', 'lg', 'xl'];
const NAMEPLATE_SIZE_PRESETS = {
  md: { label: 'md', fontSize: 'md', paddingX: 18, paddingY: 10, cornerRadius: 14 },
  lg: { label: 'lg', fontSize: 'lg', paddingX: 22, paddingY: 12, cornerRadius: 14 },
  xl: { label: 'xl', fontSize: 'xl', paddingX: 26, paddingY: 14, cornerRadius: 16 }
};

function baseTimestamps() {
  const now = new Date().toISOString();
  return {
    createdAt: now,
    updatedAt: now
  };
}

function defaultGlobalSettings() {
  return {
    layoutVersion: '2026-03-25',
    defaults: {
      previewFont: 'default',
      lineTextSize: 'lg',
      nameplateSize: 'lg',
      imageAspectRatio: '4:5'
    },
    previewFontOptions: PREVIEW_FONT_OPTIONS,
    lineTextSizes: LINE_TEXT_SIZES,
    nameplateSizePresets: NAMEPLATE_SIZE_PRESETS,
    cardLayouts: {
      dialogue: {
        totalHeight: 540,
        heroHeight: 400,
        bodyHeight: 140,
        intersectionY: 400,
        bodyPaddingTop: 18,
        bodyPaddingBottom: 18,
        bodyPaddingSide: 20,
        leftSafePadding: 70,
        rightSafePadding: 60,
        lineSpacing: '6px'
      },
      narration: {
        totalHeight: 540,
        heroHeight: 400,
        bodyHeight: 140,
        intersectionY: 400,
        bodyPaddingTop: 18,
        bodyPaddingBottom: 18,
        bodyPaddingSide: 22,
        lineSpacing: '6px'
      },
      choice: {
        totalHeight: 540,
        heroHeight: 335,
        questionHeight: 76,
        actionsHeight: 129,
        bodyPaddingSide: 20,
        buttonSpacing: 12
      },
      transition: {
        totalHeight: 540,
        bodyPaddingTop: 48,
        bodyPaddingBottom: 48,
        bodyPaddingSide: 34,
        lineSpacing: '8px'
      }
    },
    characters: [
      {
        id: 'char-bear',
        name: '熊熊',
        category: 'protagonist',
        sortOrder: 1,
        avatarPath: '/public/story/01/bhead001.png',
        placement: 'left',
        avatarX: 14,
        avatarY: 332,
        avatarSize: 92,
        nameplateAnchor: 'left-fixed',
        nameplateX: 110,
        nameplateRightPercent: 30,
        nameplateY: 346,
        nameplateColor: '#8B6A4E',
        nameplateTextColor: '#FFFFFF',
        nameplateSize: 'lg'
      },
      {
        id: 'char-lily',
        name: '莉莉',
        category: 'supporting',
        sortOrder: 2,
        avatarPath: '/public/story/01/roles/lily.png',
        placement: 'right',
        avatarX: 14,
        avatarY: 332,
        avatarSize: 84,
        nameplateAnchor: 'right-percent',
        nameplateX: 0,
        nameplateRightPercent: 30,
        nameplateY: 346,
        nameplateColor: '#B9687B',
        nameplateTextColor: '#FFFFFF',
        nameplateSize: 'lg'
      }
    ],
    triggerBindings: [
      {
        id: 'trigger-start-story',
        scope: 'story',
        keyword: '開始故事',
        actionType: 'story',
        label: '開始故事',
        messageText: '',
        storyId: 'story-01',
        startNodeId: storyStartId
      }
    ]
  };
}

function defaultStoryTemplate(index = 1) {
  const { createdAt, updatedAt } = baseTimestamps();
  return {
    id: `story-${String(index).padStart(2, '0')}`,
    title: `Story ${index}`,
    description: '',
    status: 'draft',
    startNodeId: '',
    characters: [],
    draftImport: {
      status: 'idle',
      sourceType: '',
      sourceName: '',
      sourceText: '',
      importedAt: null,
      unboundRoles: [],
      nodes: []
    },
    createdAt,
    updatedAt,
    nodes: []
  };
}

function cloneCharacters(characters = []) {
  return JSON.parse(JSON.stringify(characters));
}

function createNodeTemplate(type = 'dialogue', order = 1) {
  const id = `${type}-${randomUUID().slice(0, 8)}`;
  const common = {
    id,
    title: `Scene ${order}`,
    type,
    imagePath: '',
    text: '在這裡輸入內容。',
    previewFont: 'default',
    lineTextSize: 'lg',
    lineTextColor: '#2D241B',
    heroImageOpacity: 1,
    heroImageScale: 1,
    nameplateSize: 'lg',
    speakerCharacterId: '',
    companionCharacterId: '',
    nextNodeId: '',
    transitionText: '',
    continueLabel: '下一步',
    position: {
      x: 80,
      y: 80 + (order - 1) * 140
    }
  };

  if (type === 'narration') {
    return {
      ...common,
      title: `Narration ${order}`,
      speakerCharacterId: '',
      companionCharacterId: ''
    };
  }

  if (type === 'choice') {
    return {
      ...common,
      title: `Choice ${order}`,
      prompt: '在這裡輸入選項提問。',
      optionA: {
        label: '選項 A',
        feedback: '這個選擇暫時還不夠靠近故事主線。',
        nextNodeId: ''
      },
      optionB: {
        label: '選項 B',
        feedback: '',
        nextNodeId: ''
      }
    };
  }

  if (type === 'transition') {
    return {
      ...common,
      title: `Transition ${order}`,
      imagePath: '',
      text: '在這裡輸入轉場文案。',
      speakerCharacterId: '',
      companionCharacterId: '',
      continueLabel: '繼續',
      backgroundColor: '#FFF4DE'
    };
  }

  if (type === 'carousel') {
    return {
      ...common,
      title: `Carousel ${order}`,
      speakerCharacterId: '',
      companionCharacterId: '',
      pages: [
        createCarouselPage(1)
      ]
    };
  }

  return common;
}

function createCarouselPage(index = 1) {
  return {
    id: `page-${randomUUID().slice(0, 8)}`,
    title: `第 ${index} 頁`,
    cardType: 'dialogue',
    imagePath: '/public/story/01/image01.png',
    text: '在這裡輸入多頁訊息內容。',
    previewFont: 'default',
    lineTextSize: 'lg',
    lineTextColor: '#2D241B',
    heroImageOpacity: 1,
    heroImageScale: 1,
    nameplateSize: 'lg',
    speakerCharacterId: 'char-bear',
    companionCharacterId: ''
  };
}

function mapLegacyTitleToCharacterId(title = '') {
  if (title.includes('熊熊')) return 'char-bear';
  if (title.includes('莉莉')) return 'char-lily';
  return '';
}

function inferLegacyCardType(title = '') {
  if (!title || title.includes('旁白') || title.includes('早餐')) return 'narration';
  if (title.includes('熊熊') || title.includes('莉莉')) return 'dialogue';
  return 'narration';
}

function normalizeImagePath(imagePath = '') {
  if (!imagePath) return '/public/story/01/image01.png';
  return imagePath.startsWith('/') ? imagePath : `/${imagePath}`;
}

function createSeedStory() {
  const seed = defaultStoryTemplate(1);
  seed.id = 'story-01';
  seed.title = '熊熊尋心：一隻熊的旅程';
  seed.description = '從既有故事匯入的預設樣板';
  seed.startNodeId = storyStartId;
  seed.characters = cloneCharacters(defaultGlobalSettings().characters);

  seed.nodes = storyNodes.map((node, index) => {
    const order = index + 1;
    const galleryBlock = node.blocks?.find((block) => block.type === 'gallery');
    const textBlocks = (node.blocks || []).filter((block) => block.type === 'text');
    const heroImage = galleryBlock?.cards?.[0]?.image || 'public/story/01/image01.png';

    if (galleryBlock?.cards?.length > 1) {
      return {
        ...createNodeTemplate('carousel', order),
        id: node.id,
        title: node.id.toUpperCase(),
        imagePath: normalizeImagePath(heroImage),
        nextNodeId: node.continue?.next || node.choice?.next || '',
        continueLabel: node.continue?.label || '下一步',
        pages: [
          ...galleryBlock.cards.map((card, pageIndex) => ({
            id: `${node.id}-page-${pageIndex + 1}`,
            title: card.title || `第 ${pageIndex + 1} 頁`,
            cardType: inferLegacyCardType(card.title),
            imagePath: normalizeImagePath(card.image || heroImage),
            text: card.body || '',
            previewFont: 'default',
            lineTextSize: 'lg',
            nameplateSize: 'lg',
            speakerCharacterId: mapLegacyTitleToCharacterId(card.title),
            companionCharacterId: ''
          })),
          ...textBlocks.map((block, blockIndex) => ({
            id: `${node.id}-note-${blockIndex + 1}`,
            title: `補充 ${blockIndex + 1}`,
            cardType: 'narration',
            imagePath: normalizeImagePath(heroImage),
            text: block.text || '',
            previewFont: 'default',
            lineTextSize: 'lg',
            nameplateSize: 'lg',
            speakerCharacterId: '',
            companionCharacterId: ''
          }))
        ],
        choicePrompt: node.choice?.prompt || '',
        optionA: node.choice
          ? {
              label: node.choice.correct || '選項 A',
              feedback: node.choice.successReply || '',
              nextNodeId: node.choice.next || ''
            }
          : undefined,
        optionB: node.choice
          ? {
              label: node.choice.wrong || '選項 B',
              feedback: node.choice.wrongReply || '',
              nextNodeId: ''
            }
          : undefined,
        type: node.choice ? 'choice' : 'carousel',
        prompt: node.choice?.prompt || ''
      };
    }

    const firstCard = galleryBlock?.cards?.[0];
    const inferredType = node.choice
      ? 'choice'
      : inferLegacyCardType(firstCard?.title) === 'dialogue'
        ? 'dialogue'
        : 'narration';

    return {
      ...createNodeTemplate(inferredType, order),
      id: node.id,
      title: node.id.toUpperCase(),
      imagePath: normalizeImagePath(firstCard?.image || heroImage),
      text: firstCard?.body || textBlocks[0]?.text || '',
      speakerCharacterId: mapLegacyTitleToCharacterId(firstCard?.title),
      nextNodeId: node.continue?.next || node.choice?.next || '',
      continueLabel: node.continue?.label || '下一步',
      prompt: node.choice?.prompt || '',
      optionA: node.choice
        ? {
            label: node.choice.correct || '選項 A',
            feedback: node.choice.successReply || '',
            nextNodeId: node.choice.next || ''
          }
        : undefined,
      optionB: node.choice
        ? {
            label: node.choice.wrong || '選項 B',
            feedback: node.choice.wrongReply || '',
            nextNodeId: ''
          }
        : undefined
    };
  });

  return seed;
}

function createInitialStore() {
  return {
    version: STORE_VERSION,
    globalSettings: defaultGlobalSettings(),
    stories: [createSeedStory()],
    logs: [],
    versions: []
  };
}

module.exports = {
  STORE_VERSION,
  PREVIEW_FONT_OPTIONS,
  LINE_TEXT_SIZES,
  NAMEPLATE_SIZE_PRESETS,
  defaultGlobalSettings,
  defaultStoryTemplate,
  createNodeTemplate,
  createCarouselPage,
  createSeedStory,
  createInitialStore,
  cloneCharacters
};

function normalizeName(value = '') {
  return `${value}`
    .trim()
    .replace(/[「」"。：:（）()\-\s]/g, '')
    .replace(/(內心|心聲|獨白|旁白|媽媽|爸爸|先生|小姐|同學|老師)$/g, '');
}

function splitScenes(text = '') {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const scenes = [];
  let current = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const picMatch = line.match(/^PIC\s*([0-9]+)(.*)$/i);
    if (picMatch) {
      if (current) scenes.push(current);
      const number = picMatch[1].padStart(2, '0');
      current = {
        sourceKey: `pic${Number(picMatch[1])}`,
        imagePath: `/public/story/01/image${number}.png`,
        title: `PIC${Number(picMatch[1])}`,
        lines: []
      };
      const tail = picMatch[2].trim();
      if (tail) current.lines.push(tail);
      continue;
    }

    if (!current) {
      current = {
        sourceKey: `scene-${scenes.length + 1}`,
        imagePath: '/public/story/01/image01.png',
        title: `Scene ${scenes.length + 1}`,
        lines: []
      };
    }
    current.lines.push(line);
  }

  if (current) scenes.push(current);
  return scenes;
}

function buildCharacterMatcher(storyCharacters = []) {
  const map = new Map();
  storyCharacters.forEach((character) => {
    map.set(normalizeName(character.name), character);
  });
  return (rawName) => {
    const normalized = normalizeName(rawName);
    if (map.has(normalized)) return map.get(normalized);
    for (const [key, character] of map.entries()) {
      if (normalized.includes(key) || key.includes(normalized)) return character;
    }
    return null;
  };
}

function detectDialogueEntries(lines, matchCharacter) {
  const entries = [];
  const unbound = new Set();

  lines.forEach((line) => {
    const directMatch = line.match(/^([^：:]{1,12})[：:]\s*(.+)$/);
    const parentheticalMatch = line.match(/^([^（(]+)[（(][^)）]+[)）]\s*[：:]\s*(.+)$/);
    const match = directMatch || parentheticalMatch;
    if (!match) return;

    const roleLabel = match[1].trim();
    const text = match[2].trim();
    const character = matchCharacter(roleLabel);
    if (!character) unbound.add(roleLabel);

    entries.push({
      roleLabel,
      text,
      characterId: character?.id || '',
      unboundCharacterName: character ? '' : roleLabel
    });
  });

  return { entries, unboundRoles: Array.from(unbound) };
}

function extractChoiceBlock(lines) {
  const choiceIndex = lines.findIndex((line) => line.includes('選項'));
  if (choiceIndex === -1) return null;

  const following = lines.slice(choiceIndex + 1).filter(Boolean);
  const labels = [];
  for (const line of following) {
    if (line.includes('結果') || line.includes('下一幕')) break;
    labels.push(line);
    if (labels.length === 2) break;
  }

  const resultLine = following.find((line) => line.startsWith('結果') || line.includes('結果'));
  if (labels.length < 2) return null;

  return {
    prompt: lines[Math.max(choiceIndex - 1, 0)]?.includes('？')
      ? lines[Math.max(choiceIndex - 1, 0)]
      : '請選擇下一步。',
    optionA: labels[0],
    optionB: labels[1],
    wrongReply: resultLine ? resultLine.replace(/^結果[:：]?\s*/, '') : '這個選項暫時還不會推進主線，請試試另一個。'
  };
}

function computeDiff(draftNode, currentNode) {
  if (!currentNode) {
    return {
      isNew: true,
      changedFields: ['node']
    };
  }

  const fields = ['type', 'text', 'imagePath', 'speakerCharacterId', 'companionCharacterId', 'nextNodeId'];
  const changedFields = fields.filter((field) => `${draftNode[field] || ''}` !== `${currentNode[field] || ''}`);
  return {
    isNew: false,
    changedFields
  };
}

function createDraftNodesFromScript({ text, story, globalSettings }) {
  const scenes = splitScenes(text);
  const matchCharacter = buildCharacterMatcher(story.characters?.length ? story.characters : globalSettings.characters);
  const existingNodes = new Map((story.nodes || []).map((node) => [node.id, node]));
  const unboundRoles = new Set();

  const draftNodes = scenes.map((scene, index) => {
    const nextScene = scenes[index + 1];
    const { entries, unboundRoles: sceneUnbound } = detectDialogueEntries(scene.lines, matchCharacter);
    sceneUnbound.forEach((role) => unboundRoles.add(role));
    const choice = extractChoiceBlock(scene.lines);
    const narrationLines = scene.lines.filter((line) => {
      if (line.includes('選項') || line.startsWith('結果') || line.includes('下一幕')) return false;
      return !entries.some((entry) => line.includes(entry.text));
    });

    let node;
    if (choice) {
      node = {
        id: scene.sourceKey,
        sourceKey: scene.sourceKey,
        title: scene.title,
        type: 'choice',
        imagePath: scene.imagePath,
        text: narrationLines[0] || '',
        previewFont: 'default',
        lineTextSize: 'lg',
        nameplateSize: 'lg',
        speakerCharacterId: entries[0]?.characterId || '',
        companionCharacterId: entries[1]?.characterId || '',
        nextNodeId: nextScene?.sourceKey || '',
        continueLabel: '下一步',
        prompt: choice.prompt,
        optionA: {
          label: choice.optionA,
          feedback: entries[0]?.text || '',
          nextNodeId: nextScene?.sourceKey || ''
        },
        optionB: {
          label: choice.optionB,
          feedback: choice.wrongReply,
          nextNodeId: ''
        },
        pages: [
          ...entries.map((entry, entryIndex) => ({
            id: `${scene.sourceKey}-page-${entryIndex + 1}`,
            title: entry.roleLabel,
            cardType: 'dialogue',
            imagePath: scene.imagePath,
            text: entry.text,
            previewFont: 'default',
            lineTextSize: 'lg',
            nameplateSize: 'lg',
            speakerCharacterId: entry.characterId,
            companionCharacterId: ''
          })),
          ...narrationLines.filter(Boolean).slice(0, 2).map((line, lineIndex) => ({
            id: `${scene.sourceKey}-narration-${lineIndex + 1}`,
            title: '旁白',
            cardType: 'narration',
            imagePath: scene.imagePath,
            text: line,
            previewFont: 'default',
            lineTextSize: 'lg',
            nameplateSize: 'lg',
            speakerCharacterId: '',
            companionCharacterId: ''
          }))
        ],
        parserNotes: ['AI 解析為選項節點，請確認選項文案與分支。'],
        status: 'pending',
        sourceText: scene.lines.join('\n'),
        unboundCharacterName: entries.find((entry) => entry.unboundCharacterName)?.unboundCharacterName || ''
      };
    } else if (entries.length > 1 || narrationLines.length > 1) {
      node = {
        id: scene.sourceKey,
        sourceKey: scene.sourceKey,
        title: scene.title,
        type: 'carousel',
        imagePath: scene.imagePath,
        text: '',
        previewFont: 'default',
        lineTextSize: 'lg',
        nameplateSize: 'lg',
        speakerCharacterId: '',
        companionCharacterId: '',
        nextNodeId: nextScene?.sourceKey || '',
        continueLabel: '下一步',
        pages: [
          ...entries.map((entry, entryIndex) => ({
            id: `${scene.sourceKey}-page-${entryIndex + 1}`,
            title: entry.roleLabel,
            cardType: 'dialogue',
            imagePath: scene.imagePath,
            text: entry.text,
            previewFont: 'default',
            lineTextSize: 'lg',
            nameplateSize: 'lg',
            speakerCharacterId: entry.characterId,
            companionCharacterId: ''
          })),
          ...narrationLines.filter(Boolean).map((line, lineIndex) => ({
            id: `${scene.sourceKey}-narration-${lineIndex + 1}`,
            title: '旁白',
            cardType: 'narration',
            imagePath: scene.imagePath,
            text: line,
            previewFont: 'default',
            lineTextSize: 'lg',
            nameplateSize: 'lg',
            speakerCharacterId: '',
            companionCharacterId: ''
          }))
        ],
        parserNotes: ['AI 解析為多頁訊息，請確認每頁順序。'],
        status: 'pending',
        sourceText: scene.lines.join('\n'),
        unboundCharacterName: entries.find((entry) => entry.unboundCharacterName)?.unboundCharacterName || ''
      };
    } else if (entries.length === 1) {
      node = {
        id: scene.sourceKey,
        sourceKey: scene.sourceKey,
        title: scene.title,
        type: 'dialogue',
        imagePath: scene.imagePath,
        text: entries[0].text,
        previewFont: 'default',
        lineTextSize: 'lg',
        nameplateSize: 'lg',
        speakerCharacterId: entries[0].characterId,
        companionCharacterId: '',
        nextNodeId: nextScene?.sourceKey || '',
        continueLabel: '下一步',
        parserNotes: ['AI 解析為單一角色對話。'],
        status: 'pending',
        sourceText: scene.lines.join('\n'),
        unboundCharacterName: entries[0].unboundCharacterName || ''
      };
    } else {
      node = {
        id: scene.sourceKey,
        sourceKey: scene.sourceKey,
        title: scene.title,
        type: 'narration',
        imagePath: scene.imagePath,
        text: narrationLines.join('\n') || scene.lines.join('\n'),
        previewFont: 'default',
        lineTextSize: 'lg',
        nameplateSize: 'lg',
        speakerCharacterId: '',
        companionCharacterId: '',
        nextNodeId: nextScene?.sourceKey || '',
        continueLabel: '下一步',
        parserNotes: ['AI 解析為旁白。'],
        status: 'pending',
        sourceText: scene.lines.join('\n'),
        unboundCharacterName: ''
      };
    }

    node.diff = computeDiff(node, existingNodes.get(node.id));
    return node;
  });

  return {
    status: 'pending',
    sourceType: 'text',
    sourceName: '',
    sourceText: text,
    importedAt: new Date().toISOString(),
    unboundRoles: Array.from(unboundRoles),
    nodes: draftNodes
  };
}

function applyDraftNodeToStory(story, draftNode) {
  const index = story.nodes.findIndex((node) => node.id === draftNode.id);
  const finalNode = {
    ...draftNode,
    status: undefined,
    parserNotes: undefined,
    sourceText: undefined,
    sourceKey: undefined,
    diff: undefined,
    unboundCharacterName: undefined
  };
  delete finalNode.status;
  delete finalNode.parserNotes;
  delete finalNode.sourceText;
  delete finalNode.sourceKey;
  delete finalNode.diff;
  delete finalNode.unboundCharacterName;

  if (index === -1) story.nodes.push(finalNode);
  else story.nodes[index] = { ...story.nodes[index], ...finalNode };
}

module.exports = {
  createDraftNodesFromScript,
  applyDraftNodeToStory,
  normalizeName
};

const { randomUUID } = require('crypto');

function normalizeScript(script = '') {
  return script.replace(/\r/g, '').trim();
}

function extractTitle(script) {
  const match = script.match(/《([^》]+)》/);
  return match ? match[1].trim() : '';
}

function splitByPic(script) {
  const matches = [...script.matchAll(/(^|\n)\s*PIC\s*([0-9]+[^\n]*)/gi)];
  if (!matches.length) {
    return script
      .split(/\n{2,}/)
      .map((block, index) => ({
        key: `SCENE-${index + 1}`,
        heading: `Scene ${index + 1}`,
        body: block.trim()
      }))
      .filter((block) => block.body);
  }

  return matches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = index + 1 < matches.length ? matches[index + 1].index : script.length;
    return {
      key: `PIC${match[2].trim()}`,
      heading: match[2].trim(),
      body: script.slice(start, end).trim()
    };
  }).filter((section) => section.body);
}

function collectParagraphs(text) {
  return text
    .split(/\n{2,}/)
    .map((item) => item.replace(/\n+/g, '\n').trim())
    .filter(Boolean);
}

function collectDialogueLines(text) {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /[：:]/.test(line) || /「.*」/.test(line));
}

function slug(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || randomUUID().slice(0, 8);
}

function makeBaseNode(type, title, extras = {}) {
  return {
    id: `${type}-${slug(title)}-${randomUUID().slice(0, 6)}`,
    type,
    title,
    speaker: '',
    text: '',
    image: '',
    nextNodeId: '',
    ...extras
  };
}

function truncate(text, max = 80) {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function splitPages(paragraphs) {
  const pages = [];
  let bucket = [];
  let length = 0;

  paragraphs.forEach((paragraph) => {
    if (length + paragraph.length > 150 && bucket.length) {
      pages.push(bucket.join('\n\n'));
      bucket = [];
      length = 0;
    }
    bucket.push(paragraph);
    length += paragraph.length;
  });

  if (bucket.length) {
    pages.push(bucket.join('\n\n'));
  }

  return pages.slice(0, 6);
}

function detectChoice(section) {
  if (!section.body.includes('選項')) {
    return null;
  }

  const lines = section.body.split('\n').map((line) => line.trim()).filter(Boolean);
  const optionIndex = lines.findIndex((line) => line.includes('選項'));
  if (optionIndex === -1) return null;

  const prompt = lines.slice(0, optionIndex).join('\n');
  const trailing = lines.slice(optionIndex + 1);
  const options = trailing.filter((line) => !/^結果/.test(line) && !/^下一幕/.test(line) && !/^彩蛋/.test(line));
  const feedbackLine = trailing.find((line) => /^結果/.test(line)) || '';

  if (options.length < 2) {
    return null;
  }

  return {
    prompt: truncate(prompt, 180),
    optionA: options[0],
    optionB: options[1],
    feedback: feedbackLine.replace(/^結果[:：]?\s*/, '') || '這個選項會讓故事停一下，試著再選一次更靠近熊熊內心的方向。'
  };
}

function inferSpeaker(text) {
  const line = collectDialogueLines(text)[0] || '';
  const match = line.match(/^([^：:]{1,12})[：:]/);
  return match ? match[1].trim() : '旁白';
}

function buildSuggestion(section, index) {
  const title = `${section.key} ${truncate(section.body.split('\n')[0] || section.heading, 24)}`;
  const choice = detectChoice(section);

  if (choice) {
    return makeBaseNode('choice', title, {
      text: choice.prompt || `${section.key} 的關鍵選擇`,
      optionA: {
        label: truncate(choice.optionA, 32),
        feedback: choice.feedback,
        nextNodeId: ''
      },
      optionB: {
        label: truncate(choice.optionB, 32),
        feedback: '',
        nextNodeId: ''
      }
    });
  }

  const paragraphs = collectParagraphs(section.body);
  const dialogueLines = collectDialogueLines(section.body);
  const speaker = inferSpeaker(section.body);

  if (paragraphs.length > 2 || dialogueLines.length > 2) {
    const pages = splitPages(paragraphs.length ? paragraphs : dialogueLines)
      .map((page, pageIndex) => ({
        title: `${section.key} - 第 ${pageIndex + 1} 頁`,
        speaker,
        text: page,
        image: ''
      }));

    return makeBaseNode('carousel', title, {
      pages
    });
  }

  const text = paragraphs.join('\n\n') || section.body;
  const type = dialogueLines.length ? 'dialogue' : 'narrative';
  return makeBaseNode(type, title, {
    speaker,
    text
  });
}

function compareOutline(existingNodes, suggestedNodes) {
  const countByType = (nodes) => nodes.reduce((acc, node) => {
    acc[node.type] = (acc[node.type] || 0) + 1;
    return acc;
  }, {});

  const existing = countByType(existingNodes);
  const suggested = countByType(suggestedNodes);
  const deltas = Object.keys(suggested).map((type) => ({
    type,
    existing: existing[type] || 0,
    suggested: suggested[type] || 0
  }));

  return {
    existingModules: existingNodes.length,
    suggestedModules: suggestedNodes.length,
    deltas
  };
}

function analyzeScript(script, existingNodes = []) {
  const normalized = normalizeScript(script);
  const title = extractTitle(normalized);
  const sections = splitByPic(normalized);
  const suggestedNodes = sections.map(buildSuggestion);

  return {
    title,
    sections: sections.map((section) => ({
      key: section.key,
      heading: section.heading,
      preview: truncate(section.body.replace(/\n+/g, ' '), 120)
    })),
    suggestedNodes,
    comparison: compareOutline(existingNodes, suggestedNodes)
  };
}

module.exports = {
  analyzeScript
};

const { storyMap, storyStartId } = require('../storyData');

const visited = [];
let current = storyStartId;

while (current) {
  if (visited.includes(current)) {
    throw new Error(`Cycle detected at ${current}`);
  }

  const node = storyMap[current];
  if (!node) {
    throw new Error(`Missing node ${current}`);
  }

  visited.push(current);

  if (node.choice) {
    current = node.choice.next;
  } else if (node.continue) {
    current = node.continue.next;
  } else {
    current = null;
  }
}

console.log(`Story path ok: ${visited.join(' -> ')}`);

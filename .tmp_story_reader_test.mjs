import { pathToFileURL } from 'node:url';

class El {
  constructor(tag = 'div', id = '') {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.textContent = '';
    this.children = [];
    this.style = {};
    this.listeners = {};
    this.alt = '';
    this.src = '';
    this._innerHTML = '';
  }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(value) { this._innerHTML = value; this.children = []; }
  appendChild(child) { this.children.push(child); return child; }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  click() { if (this.listeners.click) this.listeners.click({ target: this }); }
}

const elements = new Map([
  'speaker', 'dialog', 'heroImage', 'options', 'background', 'controls', 'sceneMeta'
].map((id) => [id, new El('div', id)]));

globalThis.window = globalThis;
globalThis.location = { search: '', pathname: '/story/example' };
globalThis.document = {
  baseURI: 'http://127.0.0.1:8011/public/story/index.html',
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, new El('div', id));
    return elements.get(id);
  },
  createElement(tag) {
    return new El(tag);
  }
};

globalThis.fetch = fetch;

await import(pathToFileURL('/Users/wade/Developer/Lineat/public/story/app.js').href + `?v=${Date.now()}`);
await new Promise((resolve) => setTimeout(resolve, 350));

function report(label) {
  const speaker = elements.get('speaker');
  const dialog = elements.get('dialog');
  const heroImage = elements.get('heroImage');
  const options = elements.get('options');
  const controls = elements.get('controls');
  const background = elements.get('background');
  const sceneMeta = elements.get('sceneMeta');
  console.log(`---${label}---`);
  console.log(`speaker=${speaker.textContent}`);
  console.log(`dialog=${dialog.textContent}`);
  console.log(`background=${background.style.backgroundImage || background.style.background || ''}`);
  console.log(`heroImageChildren=${heroImage.children.length}`);
  console.log(`optionsChildren=${options.children.length}`);
  console.log(`controlsChildren=${controls.children.length}`);
  console.log(`sceneMeta=${sceneMeta.textContent}`);
}

report('INITIAL');
const options = elements.get('options');
if (!options.children.length) throw new Error('No option buttons rendered');
options.children[0].click();
await new Promise((resolve) => setTimeout(resolve, 100));
report('AFTER_OPTION_CLICK');
const controls = elements.get('controls');
if (!controls.children.length) throw new Error('No next button rendered');
controls.children[0].click();
await new Promise((resolve) => setTimeout(resolve, 100));
report('AFTER_NEXT_CLICK');

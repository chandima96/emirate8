// Render all listing journeys without a running database or browser.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const resolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...args) {
  return resolve.call(this, request.startsWith('@/') ? path.join(root, 'src', request.slice(2)) : request, ...args);
};
for (const ext of ['.ts', '.tsx'])
  require.extensions[ext] = (mod, filename) => {
    const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
        target: ts.ScriptTarget.ES2020,
      },
    });
    mod._compile(result.outputText, filename);
  };
const load = Module._load;
Module._load = function (request, ...args) {
  if (request === '@/app/actions')
    return new Proxy(
      {},
      {
        get: () => () => {
          throw new Error('Server actions must not run during the render check');
        },
      },
    );
  return load.call(this, request, ...args);
};
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { DesignerStep } = require('../src/components/listings/editor/DesignerStep.tsx');
const {
  hydrateEditor,
  projectListing,
  editorReadiness,
} = require('../src/components/listings/editor/designer-model.js');
const cases = [
  ['residential', 'apartment', 'sale', 'ready', 'resale'],
  ['residential', 'villa', 'rent', 'ready', ''],
  ['residential', 'apartment', 'sale', 'offplan', 'initial'],
  ['residential', 'apartment', 'sale', 'offplan', 'resale'],
  ['commercial', 'office', 'sale', 'ready', 'resale'],
  ['commercial', 'shop', 'rent', 'ready', ''],
  ['commercial', 'warehouse', 'sale', 'ready', 'resale'],
  ['commercial', 'labour_accommodation', 'rent', 'ready', ''],
  ['commercial', 'commercial_building', 'sale', 'ready', 'resale'],
  ['land', 'residential_plot', 'sale', '', 'resale'],
];
let count = 0;
for (const [category, ptype, purpose, devStatus, txn] of cases) {
  const base = hydrateEditor({
    photos: [],
    featured: '',
    highlights: [],
    amenities: [],
    media: { floorplans: [] },
    permit: {},
    offplan: { plan: [] },
    display: {},
  });
  Object.assign(base.editor.d, { category, ptype, purpose, devStatus, txn });
  const L = projectListing(base);
  const ed = {
    L,
    t: { ready: devStatus === 'ready', offplan: devStatus === 'offplan' },
    errors: {},
    set() {},
    update() {},
    toast() {},
    confirm: async () => true,
    go() {},
    latest: () => L,
    isDeveloper: true,
    developerBrokers: [],
  };
  const ready = editorReadiness(L, { credentialStatus: 'verified' });
  for (let step = 1; step <= 8; step++) {
    const markup = renderToStaticMarkup(React.createElement(DesignerStep, { ed, step, ready, preview: null }));
    assert.ok(markup.includes('<h2'), `${ptype}, step ${step}: heading missing`);
    const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, `${ptype}, step ${step}: duplicate field ID`);
    count++;
  }
}
console.log(`Rendered ${count} step/journey combinations with unique field IDs.`);

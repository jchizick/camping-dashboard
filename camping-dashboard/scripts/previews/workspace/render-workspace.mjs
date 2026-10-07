import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const ts = require('typescript');
export const directory = path.dirname(fileURLToPath(import.meta.url));
import { capture } from './capture-config.mjs';
export const fixedTime = capture.fixedTime;
process.env.TZ = capture.timezoneId;
class FixtureDate extends Date {
  constructor(...args) { super(...(args.length ? args : [fixedTime])); }
  static now() { return Date.parse(fixedTime); }
}
export function renderWorkspace({ unified = false } = {}) {
  const cache = new Map();
  const stubs = {
    'next/navigation': { usePathname: () => '/trips/demo' },
    'next/image': { default: ({ src, alt, ...props }) => React.createElement('img', { ...props, src, alt }), __esModule: true },
  };
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const fixtureModule = { exports: {} }; cache.set(filename, fixtureModule);
    const source = fs.readFileSync(filename, 'utf8');
    const request = id => {
      if (stubs[id]) return stubs[id];
      if (['react', 'react/jsx-runtime', 'lucide-react'].includes(id)) return require(id);
      if (!id.startsWith('.')) throw new Error('Unexpected fixture dependency: '+id);
      let candidate = path.resolve(path.dirname(filename), id);
      candidate = [candidate, candidate+'.tsx', candidate+'.ts', candidate+'/index.ts'].find(p => fs.existsSync(p) && fs.statSync(p).isFile());
      if (!candidate) throw new Error('Missing recovered module: '+id+' from '+filename);
      return load(candidate);
    };
    const code = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
    vm.runInNewContext(code, { exports: fixtureModule.exports, module: fixtureModule, require: request, Date: FixtureDate, console }, { filename });
    return fixtureModule.exports;
  }
  const Preview = load(path.join(directory, 'WorkspacePreview.tsx')).default;
  const Topo = load(path.join(directory, 'historical/components/ui/TopoBackground.tsx')).TopoBackground;
  let markup = renderToStaticMarkup(React.createElement(React.Fragment, null, React.createElement(Topo), React.createElement('div', { className: 'relative z-10 min-h-screen' }, React.createElement(Preview, { unified }))));
  if (unified) markup = '<div data-workspace-preview-capture><div class="workspace-preview__product">'+markup+'</div></div>';
  return '<!doctype html><html lang="en" class="theme-expedition dark" data-phone-layout="false"><head><meta charset="utf-8"><link rel="stylesheet" href="/preview.css"><link rel="stylesheet" href="/fonts.css">'+(unified ? '<link rel="stylesheet" href="/unified.css">' : '')+'<style>*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}</style></head><body>'+markup+'</body></html>';
}

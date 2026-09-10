/* Adapter for the installed @maptiler/geocoding-control 3.0.0 open Lit roots.
 * Its hard-coded surfaces have no public theme/parts API. Keep this opt-in,
 * reversible, and limited to the two known components; unknown markup stays usable.
 */
const searchStyles = `
  :host(maptiler-geocoder.maptiler-geocoder) form { width: 100%; max-width: 100%; background: #202724; border: 1px solid #65706a; border-radius: 6px; box-shadow: none; font-family: var(--font-ui-face), sans-serif; --color-text: #edf1ed; --color-icon-button: #c5cec8; }
  :host(maptiler-geocoder.maptiler-geocoder) form:hover, :host(maptiler-geocoder.maptiler-geocoder) form:focus-within { width: 100%; max-width: 100%; }
  :host(maptiler-geocoder.maptiler-geocoder) .input-group { min-height: 40px; }
  :host(maptiler-geocoder.maptiler-geocoder) .input-group:focus-within { outline: 2px solid #edf1ed; outline-offset: -2px; border-color: #edf1ed; }
  :host(maptiler-geocoder.maptiler-geocoder) input, :host(maptiler-geocoder.maptiler-geocoder) input:focus { min-width: 0; color: #edf1ed; font-size: 16px; }
  :host(maptiler-geocoder.maptiler-geocoder) input::placeholder { color: #b4bfb8; }
  :host(maptiler-geocoder.maptiler-geocoder) button:focus-visible { outline: 2px solid #edf1ed; outline-offset: -2px; border-color: #edf1ed; }
  :host(maptiler-geocoder.maptiler-geocoder) button:hover { --color-icon-button: #fff; }
  :host(maptiler-geocoder.maptiler-geocoder) ul, :host(maptiler-geocoder.maptiler-geocoder) div.no-results { background: #202724; color: #edf1ed; border: 1px solid #65706a; box-shadow: none; }
  :host(maptiler-geocoder.maptiler-geocoder) ul { max-height: 210px; overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; }
  :host(maptiler-geocoder.maptiler-geocoder) div.error { background: #382923; color: #f3c5b4; }
`;
const resultStyles = `
  :host li { color: #edf1ed; min-width: 0; font-family: var(--font-ui-face), sans-serif; }
  :host li.selected, :host li.picked { background: #39483f; animation: none; }
  :host li.selected .primary, :host li.picked .primary { color: #fff; }
  :host .secondary, :host .line2, :host li.selected .secondary, :host li.selected .line2, :host li.picked .secondary, :host li.picked .line2 { color: #bbc9bf; }
  :host .texts { min-width: 0; }
  :host .texts > * { min-width: 0; white-space: normal; overflow-wrap: anywhere; }
`;

export function integrateDesktopGeocoder(container: HTMLElement): () => void {
  let disposed = false;
  const roots = new Map<ShadowRoot, { observer: MutationObserver; style: HTMLStyleElement }>();
  const pending = new WeakSet<Element>();
  const namedButtons = new Set<HTMLElement>();

  function belongsToContainer(node: Node): boolean {
    if (container.contains(node)) return true;
    const root = node.getRootNode();
    return root instanceof ShadowRoot && belongsToContainer(root.host);
  }

  function releaseRoot(root: ShadowRoot) {
    const entry = roots.get(root);
    entry?.observer.disconnect();
    entry?.style.remove();
    roots.delete(root);
  }

  function restoreName(button: HTMLElement) {
    if (button.getAttribute('aria-label') === 'Focus destination search') button.removeAttribute('aria-label');
    namedButtons.delete(button);
  }

  function scan(root: ParentNode) {
    if (disposed) return;
    // Lit removes/replaces result roots between searches. Release them now,
    // rather than retaining detached trees for the lifetime of the map.
    roots.forEach((_, root) => { if (!belongsToContainer(root.host)) releaseRoot(root); });
    namedButtons.forEach(button => { if (!belongsToContainer(button)) restoreName(button); });
    if (root instanceof ShadowRoot && !roots.has(root)) return;
    // The SDK highlights options without scrolling. Keep keyboard selection
    // visible inside our bounded desktop list, without scrolling the document.
    if (root instanceof ShadowRoot && root.host.localName === 'maptiler-geocoder-feature-item') {
      const selected = root.querySelector<HTMLElement>('[aria-selected="true"]');
      const parent = root.host.getRootNode();
      const list = parent instanceof ShadowRoot ? parent.querySelector('ul') : null;
      if (selected && list) {
        const itemBounds = selected.getBoundingClientRect();
        const listBounds = list.getBoundingClientRect();
        if (itemBounds.bottom > listBounds.bottom) list.scrollTop += itemBounds.bottom - listBounds.bottom;
        else if (itemBounds.top < listBounds.top) list.scrollTop -= listBounds.top - itemBounds.top;
      }
    }
    if (root instanceof ShadowRoot && root.host.localName === 'maptiler-geocoder') {
      const button = root.querySelector<HTMLElement>('button.search-button');
      if (button && !button.hasAttribute('aria-label') && !button.hasAttribute('title')) {
        button.setAttribute('aria-label', 'Focus destination search');
        namedButtons.add(button);
      }
    }
    root.querySelectorAll<HTMLElement>('maptiler-geocoder, maptiler-geocoder-feature-item').forEach(host => {
      if (host.shadowRoot) attach(host.shadowRoot);
      else if (!pending.has(host)) {
        pending.add(host);
        // Lit may attach/render its open root after the control enters the map.
        void customElements.whenDefined(host.localName).then(async () => {
          await (host as HTMLElement & { updateComplete?: Promise<unknown> }).updateComplete;
          if (!disposed && belongsToContainer(host) && host.shadowRoot) attach(host.shadowRoot);
        });
      }
    });
  }

  function attach(root: ShadowRoot) {
    if (disposed || roots.has(root)) return;
    const style = document.createElement('style');
    style.textContent = root.host.localName === 'maptiler-geocoder' ? searchStyles : resultStyles;
    root.append(style);
    const observer = new MutationObserver(() => scan(root));
    roots.set(root, { observer, style });
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-selected'] });
    scan(root);
  }

  const observer = new MutationObserver(() => scan(container));
  observer.observe(container, { childList: true, subtree: true });
  scan(container);
  return () => {
    disposed = true;
    observer.disconnect();
    roots.forEach((_, root) => releaseRoot(root));
    namedButtons.forEach(restoreName);
  };
}

import sigil from '@urbit/sigil-js/core';
import htm from 'htm';
import { VNode, cloneElement, h } from 'preact';

/**
 * Sigils for the avatar primitive (plan §5). Sigils are not decoration:
 * `$actor`-keyed apps render the whole group, and without them every
 * dashboard showing people is a column of bare `~zod` text that looks
 * nothing like Tlon.
 *
 * WHY THE CORE IS IMPORTED, NOT INJECTED. The Chart.js constructor is
 * injected into the kit (D58) because a chart needs a live 2D context and
 * legitimately degrades to an empty state without one. A sigil is
 * arithmetic: `@urbit/sigil-js/core` is a total function from a point name
 * to an SVG string with no DOM, network, storage or clock access — so it
 * behaves identically in the sandbox and in the publish gate's happy-dom
 * smoke render. Injecting it would let the gate render an avatar the
 * sandbox does not, and "preview equals production" is the whole reason
 * this code is shared rather than copied.
 *
 * `render` must never read the clock (plan §5) and this obeys it: the
 * output is a pure function of the point name.
 *
 * The core hands back a STRING, so it is parsed into Preact vnodes with
 * the already-vendored htm — the sigil enters the tree as ordinary
 * diffable nodes and nothing here touches innerHTML. The ship name comes
 * from app state, which is bundle-influenced, so markup assembly around it
 * is exactly the thing not to do.
 */

const html = htm.bind(h);

/**
 * The coordinate space the sigil is drawn in. It is not the rendered size
 * — `.tsh-avatar` owns that in CSS — but it does set the stroke weight
 * sigil-js picks, and 32 is the weight that reads correctly at avatar
 * scale (below 64 the library widens strokes so thin linework survives).
 */
const SIGIL_UNITS = 32;

/**
 * Two token references, handed straight to the library, which substitutes
 * them into `fill`/`stroke` presentation attributes. `var()` in an SVG
 * presentation attribute resolves in chromium, firefox and webkit
 * (measured), and it buys a property the drawn chart does not have: a
 * theme flip recolors an already-rendered sigil, because the colors are
 * still live custom-property references rather than values baked in at
 * draw time (contrast D58's "theme flips don't recolor a drawn chart").
 */
const SIGIL_FOREGROUND = 'var(--color-text-secondary)';
const SIGIL_BACKGROUND = 'var(--color-bg-secondary)';

/**
 * `render(state)` re-runs on every state push, and a member list can hold
 * a lot of avatars, so the parse is memoized. Bounded because the key is
 * app-supplied: a bundle passing endless distinct ship names must cost a
 * fixed amount of memory, not an unbounded one. Failures are cached too —
 * re-deriving "this is not a point name" per render is the same waste.
 */
const MAX_CACHED_SIGILS = 128;
const cache = new Map<string, VNode | null>();

function attributeNumber(value: unknown): number | null {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) && parsed > 0
    ? parsed
    : null;
}

function build(point: string): VNode | null {
  let markup: string;
  try {
    markup = sigil({
      point,
      size: SIGIL_UNITS,
      foreground: SIGIL_FOREGROUND,
      background: SIGIL_BACKGROUND,
      // icon-grade linework: the superimposed detail is noise at the size
      // an avatar is actually drawn
      detail: 'none',
      // no interior padding — the avatar box supplies its own inset
      space: 'none',
    });
  } catch {
    // sigil-js throws (through `invariant`) on anything that is not a
    // galaxy, star or planet name. The ship comes from app state, so a
    // bad one is ordinary input rather than an exception: the avatar
    // falls back to initials instead of taking the whole app into the
    // broken state.
    return null;
  }

  let parsed: unknown;
  try {
    parsed = html([markup] as unknown as TemplateStringsArray);
  } catch {
    return null;
  }
  const node = (Array.isArray(parsed) ? parsed[0] : parsed) as VNode | null;
  if (node == null || typeof node !== 'object' || node.type !== 'svg') {
    return null;
  }

  // sigil-js emits a pixel `width`/`height` pair and a lowercase
  // `viewbox`, which SVG (case-sensitive) ignores — so the drawing is
  // pinned to a pixel size and cannot scale. Restating the box as a real
  // `viewBox` plus a percentage size hands sizing back to the CSS token,
  // the same "no pixel dimension the author guesses" rule the chart
  // primitive follows (D58). A star is 2:1 rather than square; the
  // default `preserveAspectRatio` letterboxes it in the avatar box, which
  // is how a star sigil is drawn everywhere else in the app.
  const props = node.props as Record<string, unknown>;
  const width = attributeNumber(props.width);
  const height = attributeNumber(props.height);
  if (width === null || height === null) {
    return null;
  }

  return cloneElement(node, {
    viewbox: undefined,
    viewBox: `0 0 ${width} ${height}`,
    width: '100%',
    height: '100%',
    style: undefined,
    class: 'tsh-avatar-sigil',
    role: 'img',
    'aria-label': point,
  });
}

/**
 * The sigil for a point name, or `null` when the name is not one the
 * library can draw. Never throws.
 */
export function sigilVNode(ship: unknown): VNode | null {
  if (typeof ship !== 'string' || ship.length === 0) {
    return null;
  }
  const cached = cache.get(ship);
  if (cached !== undefined) {
    return cached;
  }
  const built = build(ship);
  if (cache.size >= MAX_CACHED_SIGILS) {
    const oldest = cache.keys().next();
    if (!oldest.done) {
      cache.delete(oldest.value);
    }
  }
  cache.set(ship, built);
  return built;
}

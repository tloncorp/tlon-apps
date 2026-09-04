import { render } from 'preact';
import { afterEach, expect, test } from 'vitest';

import { Avatar } from './index';
import { sigilVNode } from './sigil';

/**
 * The avatar primitive owns sigil rendering so app bundles never do (plan
 * §5, same posture as the chart primitive owning its container). These
 * pin the three things that makes true: the drawing is a pure function of
 * the point name, it is colored from the tokens rather than by the caller,
 * and an undrawable name degrades instead of throwing — a throw inside
 * `render(state)` would replace the whole app with the broken state.
 */

function mount(node: preact.ComponentChild) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  render(node, container);
  return container;
}

const realDate = globalThis.Date;

afterEach(() => {
  globalThis.Date = realDate;
});

test('a ship renders a real sigil as SVG nodes, not markup or an image', () => {
  const el = mount(<Avatar ship="~sampel-palnet" />);
  const svg = el.querySelector('.tsh-avatar .tsh-avatar-sigil');

  expect(svg).toBeTruthy();
  expect(svg!.tagName.toLowerCase()).toBe('svg');
  // real element nodes in the tree, drawn by the library
  expect(
    svg!.querySelectorAll('path, circle, rect, line').length
  ).toBeGreaterThan(1);
  // the sigil is drawn, never fetched — it has to work under the
  // sandbox's `default-src 'none'`, where any external reference is dead
  expect(el.innerHTML).not.toContain('<image');
  expect(el.innerHTML).not.toMatch(/\s(?:src|href|xlink:href)=/);
});

test('the sigil is sized by the CSS token, not by pixels baked into the SVG', () => {
  const el = mount(<Avatar ship="~sampel-palnet" />);
  const svg = el.querySelector('.tsh-avatar-sigil')!;

  // a real, case-correct viewBox is what lets the token own the box
  expect(svg.getAttribute('viewBox')).toBe('0 0 32 32');
  expect(svg.getAttribute('width')).toBe('100%');
  expect(svg.getAttribute('height')).toBe('100%');
  // the library's lowercase `viewbox` (which SVG ignores) is gone, and so
  // is its inline display style
  expect(svg.getAttribute('viewbox')).toBeNull();
  expect(svg.getAttribute('style')).toBeNull();
});

test('a star keeps its 2:1 drawing rather than being squashed square', () => {
  const el = mount(<Avatar ship="~marzod" />);
  // preserveAspectRatio defaults to letterboxing it inside the avatar box
  expect(el.querySelector('.tsh-avatar-sigil')!.getAttribute('viewBox')).toBe(
    '0 0 32 16'
  );
});

test('sigil colors are token references only — never literals', () => {
  const el = mount(<Avatar ship="~zod" />);
  const svg = el.querySelector('.tsh-avatar-sigil')!;

  const paints = [...svg.querySelectorAll('*')].flatMap((node) =>
    [node.getAttribute('fill'), node.getAttribute('stroke')].filter(
      (value): value is string => value !== null
    )
  );
  expect(paints.length).toBeGreaterThan(0);
  for (const paint of paints) {
    expect(paint).toMatch(/^var\(--color-/);
  }
});

test('an undrawable ship falls back to initials instead of throwing', () => {
  // app state can hold anything: a comet is longer than the library
  // draws, a moon has three phonemes, `~zzz` is not a phoneme at all
  for (const ship of [
    '~doznec-doznec-doznec-doznec--doznec-doznec-doznec-doznec',
    '~notaship',
    '~zzz',
    '',
  ]) {
    const el = mount(<Avatar ship={ship} />);
    expect(el.querySelector('.tsh-avatar')).toBeTruthy();
    expect(el.querySelector('.tsh-avatar-sigil')).toBeNull();
  }
});

test('a non-string ship is ordinary input, not an exception', () => {
  for (const ship of [42, null, undefined, {}, []] as unknown[]) {
    expect(() => sigilVNode(ship)).not.toThrow();
    expect(sigilVNode(ship)).toBeNull();
  }
});

test('initials-only avatars are untouched by the ship path', () => {
  const el = mount(<Avatar initials="ZOD" color="var(--color-positive-bg)" />);
  const avatar = el.querySelector('.tsh-avatar') as HTMLElement;

  expect(avatar.textContent).toBe('ZO');
  expect(avatar.style.background).toContain('var(--color-positive-bg)');
  expect(el.querySelector('.tsh-avatar-sigil')).toBeNull();
});

test('an unrenderable ship still labels the box from the name', () => {
  const el = mount(<Avatar ship="~notaship" />);
  expect(el.querySelector('.tsh-avatar')?.textContent).toBe('no');
  // an explicit `initials` still wins
  const explicit = mount(<Avatar ship="~notaship" initials="QQ" />);
  expect(explicit.querySelector('.tsh-avatar')?.textContent).toBe('QQ');
});

test('the drawing never reads the clock', () => {
  // `render` must never read the clock (plan §5): the sandbox's Date is
  // the VIEWER's, so anything derived from it differs per viewer. Taking
  // Date away entirely is the only assertion that cannot pass by accident.
  globalThis.Date = new Proxy(realDate, {
    apply() {
      throw new Error('render read the clock');
    },
    construct() {
      throw new Error('render read the clock');
    },
    get(target, key) {
      if (key === 'now') {
        throw new Error('render read the clock');
      }
      return Reflect.get(target, key);
    },
  }) as DateConstructor;

  const el = mount(<Avatar ship="~ridlur-figbud" />);
  expect(el.querySelector('.tsh-avatar-sigil')).toBeTruthy();
});

test('the same ship yields the same drawing, and the cache survives eviction', () => {
  const first = sigilVNode('~zod');
  expect(sigilVNode('~zod')).toBe(first);

  // push well past the cache bound with distinct names; the earliest entry
  // is evicted, and asking for it again must still produce a sigil
  for (let index = 0; index < 400; index++) {
    sigilVNode(`~sampel-palnet-${index}`);
  }
  const afterEviction = sigilVNode('~zod');
  expect(afterEviction).not.toBeNull();
  expect(mount(<Avatar ship="~zod" />).innerHTML).toBe(
    mount(<Avatar ship="~zod" />).innerHTML
  );
});

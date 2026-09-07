import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  readNavigationAnchor,
  startScrollNavigationTrace,
} from '../../../apps/tlon-web/e2e/helpers/scrollNavigation';

// Real helper callback on the nested production markup captured in r1.
// Geometry is a deterministic DOM boundary; these are acquisition controls.
const wireText = 'Exact original navigation text. ';
let dom;
let row;
let block;
beforeEach(() => {
  dom = new JSDOM(`<main style="overflow-y:auto"><div data-postid="parent-a">
    <div class="is_View"><div class="is_ContentFrame"><div class="is_ContentBlock">
      <span class="is_TlonText is_Text">${wireText}</span>
    </div></div></div></div></main>`);
  const { window } = dom;
  vi.stubGlobal('document', window.document);
  vi.stubGlobal('NodeFilter', window.NodeFilter);
  vi.stubGlobal('getComputedStyle', window.getComputedStyle.bind(window));
  row = window.document.querySelector('[data-postid]');
  block = row.querySelector('.is_TlonText');
  const list = window.document.querySelector('main');
  Object.defineProperties(list, {
    clientHeight: { value: 500 },
    scrollHeight: { value: 1500 },
  });
  list.getBoundingClientRect = () => new window.DOMRect(400, 20, 700, 500);
  row.getBoundingClientRect = () => new window.DOMRect(400, 120, 700, 60);
  window.Range.prototype.getBoundingClientRect = () =>
    new window.DOMRect(420, 135, 10, 22);
});
afterEach(() => {
  vi.unstubAllGlobals();
  dom.window.close();
});
const acquire = (expected = wireText) =>
  readNavigationAnchor(
    { evaluate: (callback, argument) => callback(row, argument) },
    expected
  );

describe('navigation text acquisition on captured production markup', () => {
  it.each(['frame', 'caption', 'duplicate'])(
    'records actual event-path ownership for %s clicks',
    async (target) => {
      vi.stubGlobal('window', dom.window);
      vi.stubGlobal('Element', dom.window.Element);
      vi.stubGlobal('location', dom.window.location);
      vi.stubGlobal('MutationObserver', dom.window.MutationObserver);
      vi.stubGlobal('innerWidth', 1200);
      vi.stubGlobal('innerHeight', 800);
      vi.stubGlobal('requestAnimationFrame', () => 1);
      vi.stubGlobal('cancelAnimationFrame', () => {});
      const frame = document.createElement('div');
      frame.className = 'is_ReferenceFrame';
      frame.innerHTML =
        '<div class="is_ContentFrame"><div class="is_ContentBlock"><span class="is_TlonText">Quoted reply</span></div></div>';
      row.prepend(frame);
      if (target === 'duplicate') row.prepend(frame.cloneNode(true));
      const page = {
        evaluateHandle: async (callback, argument) => {
          const collector = callback(argument);
          return {
            evaluate: async (method, value) => method(collector, value),
            dispose: async () => {},
          };
        },
      };
      const capture = await startScrollNavigationTrace(
        page,
        { commands: [], scopes: {} },
        { left: 0, right: 1200, top: 0, bottom: 800 }
      );
      (target === 'caption' ? block : frame).dispatchEvent(
        new dom.window.MouseEvent('click', { bubbles: true, composed: true })
      );
      const raw = await capture.stop();
      expect(raw.errors).toEqual([]);
      expect(raw.events).toHaveLength(1);
      expect(raw.events[0].trusted).toBe(false);
      expect(raw.events[0].reference).toEqual(
        target === 'caption'
          ? undefined
          : {
              rowId: 'parent-a',
              texts: ['Quoted reply'],
              frameCount: target === 'duplicate' ? 2 : 1,
            }
      );
    }
  );
  it('matches the exact wire text including its terminal ASCII space', async () => {
    expect(await acquire()).toMatchObject({
      rowId: 'parent-a',
      top: 100,
      pointTop: 115,
    });
  });
  it('does not silently trim an incorrectly specified expected string', async () => {
    await expect(acquire(wireText.trimEnd())).rejects.toThrow('found 0');
  });
  it('ignores equal ancestor and author text outside the message-content boundary', async () => {
    const author = document.createElement('span');
    author.textContent = wireText;
    row.prepend(author);
    expect(await acquire()).toMatchObject({ rowId: 'parent-a' });
  });
  it('survives preceding sibling insertion without a positional selector', async () => {
    block.parentElement.before(document.createElement('div'));
    expect(await acquire()).toMatchObject({ top: 100, pointTop: 115 });
  });
  it('accepts nested inline markup without mistaking its ancestor for a duplicate', async () => {
    block.innerHTML = '<strong>Exact</strong> original navigation text. ';
    expect(await acquire()).toMatchObject({ pointTop: 115 });
  });
  it('rejects two matching message blocks', async () => {
    block.parentElement.after(block.parentElement.cloneNode(true));
    await expect(acquire()).rejects.toThrow('found 2');
  });
  it('finds the original paragraph after a separately quoted semantic block', async () => {
    const quoted = block.parentElement.cloneNode(true);
    quoted.querySelector('span').textContent = 'Independent quoted reply';
    block.parentElement.before(quoted);
    expect(await acquire()).toMatchObject({ rowId: 'parent-a', pointTop: 115 });
  });
  it.each([
    'Exact wrong navigation text. ',
    'Exact  original navigation text. ',
    'Exact original navigation text.\n',
    'Exact original navigation text.',
  ])('rejects changed text %j', async (text) => {
    block.textContent = text;
    await expect(acquire()).rejects.toThrow('found 0');
  });
  it('acquires the same logical text from a legitimate replacement wrapper', async () => {
    const replacement = block.parentElement.cloneNode(true);
    block.parentElement.replaceWith(replacement);
    expect(await acquire()).toMatchObject({ top: 100, pointTop: 115 });
  });
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolveReadingBlock } from '../apps/tlon-web/e2e/helpers/scrollReading.ts';
const require = createRequire(
  new URL('../packages/app/package.json', import.meta.url)
);
const { JSDOM } = require('jsdom');
const declared = 'The exact unchanged reading paragraph.';
const fixture = () => {
  const dom = new JSDOM(
    '<div data-postid="123"><div><div><div><div class="content"><div><div><span></span></div></div></div></div></div></div></div>'
  );
  const row = dom.window.document.querySelector('[data-postid="123"]');
  const block = row.querySelector('span');
  block.textContent = declared;
  return {
    dom,
    row,
    block,
    locator: {
      evaluate: (callback, value) => {
        const previous = globalThis.getComputedStyle;
        globalThis.getComputedStyle = dom.window.getComputedStyle.bind(
          dom.window
        );
        try {
          return Promise.resolve(callback(row, value));
        } finally {
          if (previous) globalThis.getComputedStyle = previous;
          else delete globalThis.getComputedStyle;
        }
      },
    },
  };
};
// These are locator/acquisition controls, not layout or product animation proof.
test('fresh exact acquisition survives the observed fourth-child path shift', async () => {
  const { dom, row, block, locator } = fixture();
  const old = await resolveReadingBlock(locator, declared);
  const content = row.querySelector('.content');
  content.parentElement.insertBefore(
    dom.window.document.createElement('div'),
    content
  );
  assert.equal(row.querySelector(old.selector), null);
  const current = await resolveReadingBlock(locator, declared);
  assert.match(current.selector, /div:nth-child\(2\)/);
  assert.equal(row.querySelector(current.selector), block);
  assert.equal(current.text, declared);
  assert.equal(row.dataset.postid, '123');
  dom.window.close();
});
test('reacquisition does not accept changed paragraph text', async () => {
  const { dom, block, locator } = fixture();
  block.textContent = 'A different revision.';
  await assert.rejects(resolveReadingBlock(locator, declared), /found 0/);
  dom.window.close();
});
test('reacquisition does not choose between duplicate exact paragraphs', async () => {
  const { dom, row, block, locator } = fixture();
  row.append(block.cloneNode(true));
  await assert.rejects(resolveReadingBlock(locator, declared), /found 2/);
  dom.window.close();
});

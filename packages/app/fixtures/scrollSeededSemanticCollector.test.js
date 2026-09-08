import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startConversationSemanticTrace } from '../../../apps/tlon-web/e2e/helpers/scrollerConversationSemantic';
let dom, disposed;
beforeEach(() => {
  dom = new JSDOM(
    '<main><div data-postid="post-1"><span>Exact original message</span></div><span>Scroll stability computing</span></main>',
    { url: 'http://localhost:3000/channel/test' }
  );
  vi.stubGlobal('document', dom.window.document);
  vi.stubGlobal('location', dom.window.location);
  vi.stubGlobal('getComputedStyle', (element) => ({
    ...dom.window.getComputedStyle(element),
    opacity: '1',
    display: 'block',
    visibility: 'visible',
  }));
  Object.defineProperty(document, 'visibilityState', { value: 'visible' });
  for (const node of document.querySelectorAll('*'))
    node.getBoundingClientRect = () => new dom.window.DOMRect(0, 0, 600, 300);
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn(() => 1)
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  disposed = vi.fn(async () => {});
});
afterEach(() => {
  dom.window.close();
  vi.unstubAllGlobals();
});
const start = () =>
  startConversationSemanticTrace({
    evaluateHandle: async (callback, arg) => {
      const capture = callback(document.querySelector('main'), arg);
      return {
        evaluate: async (method, value) => method(capture, value),
        dispose: disposed,
      };
    },
  });
describe('actual semantic collector raw-return boundary', () => {
  it('returns original renderer samples and disposes the same capture', async () => {
    const capture = await start();
    await capture.mark('seeded-terminal');
    const raw = await capture.stopRaw();
    expect(raw.errors).toEqual([]);
    expect(raw.samples[0].posts).toEqual([
      { id: 'post-1', texts: ['Exact original message'] },
    ]);
    expect(raw.chrome.samples[0].controls[0].kind).toBe(
      'Scroll stability computing'
    );
    expect(raw.marks[0].id).toBe('seeded-terminal');
    expect(disposed).toHaveBeenCalledTimes(1);
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
  it('keeps the existing short-case contract and attachment unchanged', async () => {
    const capture = await start(),
      attach = vi.fn();
    await capture.mark('terminal');
    const proof = await capture.stop({ attach }, 'existing', 'remote');
    expect(proof.contract.mode).toBe('remote');
    expect(proof.contract.expectedTexts).toEqual(
      Array.from({ length: 5 }, (_, i) => `Remote burst ${i}`)
    );
    expect(attach.mock.calls[0][0]).toBe('existing-semantic-proof');
    expect(disposed).toHaveBeenCalledTimes(1);
  });
});

describe('actual seeded collector freeze/export boundary', () => {
  it('freezes semantic samples before export and does not observe later content', async () => {
    const capture = await start();
    expect(await capture.freeze()).toBeUndefined();
    document.querySelector('[data-postid] span').textContent = 'After phase';
    await capture.freeze();
    const raw = await capture.stopRaw();
    expect(raw.samples).toHaveLength(2);
    expect(raw.samples.at(-1).posts[0].texts).toEqual([
      'Exact original message',
    ]);
    expect(disposed).toHaveBeenCalledTimes(1);
  });

  const globals = () => {
    for (const name of [
      'window',
      'Element',
      'HTMLElement',
      'HTMLTextAreaElement',
      'HTMLInputElement',
      'NodeFilter',
      'MutationObserver',
    ])
      vi.stubGlobal(name, name === 'window' ? dom.window : dom.window[name]);
    vi.stubGlobal('innerWidth', 1200);
    vi.stubGlobal('innerHeight', 800);
    vi.stubGlobal('devicePixelRatio', 1);
    vi.stubGlobal('scrollX', 0);
    vi.stubGlobal('scrollY', 0);
  };

  it('freezes input samples/listeners and releases the same handle on later export', async () => {
    globals();
    const { startScrollInputTrace } =
      await import('../../../apps/tlon-web/e2e/helpers/scrollInput');
    const input = document.createElement('textarea'),
      send = document.createElement('button');
    input.dataset.testid = 'MessageInput';
    input.value = 'before';
    document.querySelector('main').append(input, send);
    for (const node of [input, send])
      node.getBoundingClientRect = () => new dom.window.DOMRect(0, 0, 100, 30);
    document.elementFromPoint = () => send;
    const capture = await startScrollInputTrace(
      {
        evaluateHandle: async (callback, args) => {
          const recorder = callback(input, args);
          return {
            evaluate: async (method) => method(recorder),
            dispose: disposed,
          };
        },
      },
      send
    );
    expect(await capture.freeze()).toBeUndefined();
    input.value = 'after';
    input.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    await capture.freeze();
    const raw = await capture.stop();
    expect(raw.samples).toHaveLength(2);
    expect(raw.samples.at(-1).draft).toBe('before');
    expect(raw.actions).toEqual([]);
    expect(disposed).toHaveBeenCalledTimes(1);
  });

  it('freezes global end time and listeners before delayed export', async () => {
    globals();
    const { startScrollNavigationTrace } =
      await import('../../../apps/tlon-web/e2e/helpers/scrollNavigation');
    let recorder;
    const capture = await startScrollNavigationTrace(
      {
        evaluateHandle: async (callback, arg) => {
          recorder = callback(arg);
          return {
            evaluate: async (method) => method(recorder),
            dispose: disposed,
          };
        },
        isClosed: () => false,
      },
      { commands: [], scopes: {} },
      { left: 0, right: 1200, top: 0, bottom: 800 }
    );
    expect(await capture.freeze()).toBeUndefined();
    const frozen = structuredClone(recorder.stop());
    document
      .querySelector('main')
      .dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }));
    document.querySelector('main').setAttribute('data-after-freeze', '1');
    await Promise.resolve();
    await capture.freeze();
    const raw = await capture.stop();
    expect(raw).toEqual(frozen);
    expect(raw.events).toEqual([]);
    expect(disposed).toHaveBeenCalledTimes(1);
  });
});

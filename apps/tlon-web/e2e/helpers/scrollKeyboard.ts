import type { ElementHandle, Page } from '@playwright/test';
import type {
  KeyboardEvent,
  KeyboardPlan,
  KeyboardSample,
  KeyboardTrace,
} from '../../../../packages/app/fixtures/scrollKeyboardTrace';

/** Real DOM state and geometry, collected synchronously without editing either. */
export async function startKeyboardTrace(
  input: ElementHandle<HTMLElement | SVGElement>,
  send: ElementHandle<HTMLElement | SVGElement>,
  list: ElementHandle<HTMLElement>,
  plan: KeyboardPlan
) {
  const handle = await input.evaluateHandle(
    (node, { send, list, plan }) => {
      if (
        !(node instanceof HTMLTextAreaElement) ||
        !(send instanceof HTMLElement)
      )
        throw new Error('Expected the real textarea and existing send control');
      const samples: KeyboardSample[] = [];
      const events: KeyboardEvent[] = [];
      const dispatches: KeyboardTrace['dispatches'] = [];
      const errors: string[] = [];
      let active = true;
      let raf = 0;
      let composing = false;
      let plannedEnd = 0;
      const owner = (target: EventTarget | null): 'input' | 'send' | 'other' =>
        target === node
          ? 'input'
          : target === send || (target instanceof Node && send.contains(target))
            ? 'send'
            : 'other';
      const exposed = (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        let left = Math.max(0, r.left),
          right = Math.min(innerWidth, r.right),
          top = Math.max(0, r.top),
          bottom = Math.min(innerHeight, r.bottom);
        let opacity = 1;
        for (let n: HTMLElement | null = el; n; n = n.parentElement) {
          const s = getComputedStyle(n);
          opacity *= Number(s.opacity);
          if (
            s.display === 'none' ||
            s.visibility !== 'visible' ||
            opacity <= 0.01
          )
            return false;
          const b = n.getBoundingClientRect();
          if (['hidden', 'clip', 'auto', 'scroll'].includes(s.overflowX)) {
            left = Math.max(left, b.left + n.clientLeft);
            right = Math.min(right, b.left + n.clientLeft + n.clientWidth);
          }
          if (['hidden', 'clip', 'auto', 'scroll'].includes(s.overflowY)) {
            top = Math.max(top, b.top + n.clientTop);
            bottom = Math.min(bottom, b.top + n.clientTop + n.clientHeight);
          }
        }
        return el.isConnected && right > left && bottom > top;
      };
      const sample = () => {
        const time = performance.now();
        const viewport = list.getBoundingClientRect();
        samples.push({
          time,
          duration: 0,
          valid:
            node.isConnected &&
            list.isConnected &&
            document.visibilityState === 'visible',
          scope: location.pathname,
          sameInput:
            document.querySelector('[data-testid="MessageInput"]') === node,
          state: {
            value: node.value,
            start: node.selectionStart,
            end: node.selectionEnd,
            focus: owner(document.activeElement),
            composing,
          },
          caret: null,
          inputVisible: exposed(node),
          sendVisible: exposed(send),
          geometry: {
            offset: list.scrollTop,
            extent: list.scrollHeight,
            height: list.clientHeight,
            rows: [...list.querySelectorAll<HTMLElement>('[data-postid]')].map(
              (row) => {
                const r = row.getBoundingClientRect();
                return {
                  id: row.dataset.postid!,
                  top: r.top - viewport.top,
                  height: r.height,
                };
              }
            ),
          },
        });
        samples.at(-1)!.duration = performance.now() - time;
      };
      const tick = () => {
        if (!active) return;
        try {
          sample();
        } catch (e) {
          errors.push(String(e));
        }
        raf = requestAnimationFrame(tick);
      };
      const names = [
        'keydown',
        'keyup',
        'beforeinput',
        'input',
        'focus',
        'blur',
        'compositionstart',
        'compositionend',
      ];
      const listener = (event: Event) => {
        const keyboard = event as globalThis.KeyboardEvent;
        const input = event as InputEvent;
        if (event.type === 'compositionstart') composing = true;
        if (event.type === 'compositionend') composing = false;
        events.push({
          type: event.type,
          time: event.timeStamp,
          observedAt: performance.now(),
          trusted: event.isTrusted,
          scope: location.pathname,
          target: owner(event.target),
          ...(typeof keyboard.key === 'string' ? { key: keyboard.key } : {}),
          ...(event.type === 'input' || event.type === 'beforeinput'
            ? { inputType: input.inputType, data: input.data }
            : {}),
          shift: keyboard.shiftKey === true,
          meta: keyboard.metaKey === true,
          ctrl: keyboard.ctrlKey === true,
          alt: keyboard.altKey === true,
        });
        queueMicrotask(() => {
          if (active) sample();
        });
      };
      names.forEach((name) => document.addEventListener(name, listener, true));
      const declaredAt = performance.now();
      tick();
      return {
        declaredAt,
        begin(index: number) {
          if (
            index !== dispatches.length ||
            !plan.steps[index] ||
            dispatches.some((d) => !Number.isFinite(d.end))
          )
            throw new Error('Out of order key dispatch');
          dispatches.push({
            id: plan.steps[index].id,
            key: plan.steps[index].key,
            start: performance.now(),
            end: NaN,
          });
        },
        end(index: number) {
          if (
            index !== dispatches.length - 1 ||
            Number.isFinite(dispatches[index].end)
          )
            throw new Error('Out of order key completion');
          dispatches[index].end = performance.now();
          if (index === plan.steps.length - 1)
            plannedEnd = dispatches[index].end + 2000;
        },
        async finish() {
          if (!plannedEnd) throw new Error('Final key was not dispatched');
          await new Promise((resolve) =>
            setTimeout(resolve, Math.max(0, plannedEnd - performance.now()))
          );
        },
        stop() {
          active = false;
          cancelAnimationFrame(raf);
          sample();
          names.forEach((name) =>
            document.removeEventListener(name, listener, true)
          );
          return {
            declaredAt,
            plan,
            dispatches,
            events,
            samples,
            plannedEnd,
            errors,
          };
        },
      };
    },
    { send, list, plan }
  );
  return {
    begin: (i: number) => handle.evaluate((r, i) => r.begin(i), i),
    end: (i: number) => handle.evaluate((r, i) => r.end(i), i),
    finish: () => handle.evaluate((r) => r.finish()),
    stop: async () => {
      try {
        return await handle.evaluate((r) => r.stop());
      } finally {
        await handle.dispose();
      }
    },
  };
}

/** Only plain text/breaks are permitted by this independent ASCII corpus. */
export function keyboardEssayText(essay: unknown): string | null {
  const value = essay as { content?: { inline?: unknown[] }[] };
  if (!Array.isArray(value?.content)) return null;
  const lines: string[] = [];
  for (const verse of value.content) {
    if (!Array.isArray(verse.inline)) return null;
    let line = '';
    for (const item of verse.inline) {
      if (typeof item === 'string') line += item;
      else if (
        item &&
        typeof item === 'object' &&
        Object.keys(item).length === 1 &&
        'break' in item &&
        (item as { break: unknown }).break === null
      )
        line += '\n';
      else return null;
    }
    lines.push(line);
  }
  return lines.join('\n').replace(/\n$/, '');
}

export function recordKeyboardSends(
  page: Page,
  scope: string,
  timeOrigin: number
) {
  const requests: {
    time: number;
    scope: string;
    channel: string;
    author: string;
    text: string;
    actions: unknown;
    url: string;
    method: string;
    wallStart: number;
  }[] = [];
  const errors: string[] = [];
  const pending: {
    request: import('@playwright/test').Request;
    record: (typeof requests)[number];
  }[] = [];
  const listener = (request: import('@playwright/test').Request) => {
    if (request.method() !== 'PUT' || !request.url().includes('/~/channel/'))
      return;
    let actions: unknown;
    try {
      actions = request.postDataJSON();
    } catch {
      return;
    }
    if (!Array.isArray(actions)) return;
    for (const action of actions) {
      const channel = action?.json?.channel;
      const essay = channel?.action?.post?.add;
      if (action.action !== 'poke' || action.app !== 'channels' || !essay)
        continue;
      const wallStart = request.timing().startTime;
      const text = keyboardEssayText(essay);
      if (text === null) {
        errors.push('Unsupported outgoing essay');
        continue;
      }
      const record = {
        time: wallStart > 0 ? wallStart - timeOrigin : NaN,
        scope,
        channel: channel.nest,
        author: essay.author,
        text,
        actions,
        url: request.url(),
        method: request.method(),
        wallStart,
      };
      requests.push(record);
      pending.push({ request, record });
    }
  };
  page.on('request', listener);
  return {
    requests,
    errors,
    stop: () => {
      page.off('request', listener);
      for (const { request, record } of pending) {
        const wallStart = request.timing().startTime;
        record.wallStart = wallStart;
        record.time = wallStart > 0 ? wallStart - timeOrigin : NaN;
      }
    },
  };
}

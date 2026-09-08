import {
  expect,
  type ElementHandle,
  type Locator,
  type Page,
  type TestInfo,
} from '@playwright/test';
import { wheelToHistory, settlePostScroller } from './scrollers';
import { conversationMessageExpectations } from '../../../../packages/app/fixtures/scrollConversationSemantic';
import type {
  ConversationSemanticTrace,
  ConversationSemanticContract,
} from '../../../../packages/app/fixtures/scrollConversationSemantic';

/** Read real renderer output. History footer CSS presence is distinct from viewport exposure. */
export async function startConversationSemanticTrace(
  list: ElementHandle<HTMLElement>,
  followSetup?: ConversationSemanticTrace['followSetup']
) {
  const capture = await list.evaluateHandle((list, followSetup) => {
    const scope = location.pathname;
    const raw: ConversationSemanticTrace = {
      scope,
      ...(followSetup ? { followSetup } : {}),
      errors: [],
      samples: [],
      marks: [],
      presence: [],
      chrome: { samples: [], actions: [] },
    };
    let active = true;
    let frame = 0;
    const presentation = (node: Element) => {
      let opacity = 1;
      let visible = node.isConnected;
      for (
        let parent: Element | null = node;
        parent;
        parent = parent.parentElement
      ) {
        const css = getComputedStyle(parent);
        opacity *= Number(css.opacity);
        visible &&= css.display !== 'none' && css.visibility === 'visible';
      }
      const rect = node.getBoundingClientRect();
      return {
        opacity,
        visible: visible && opacity > 0 && rect.width > 0 && rect.height > 0,
      };
    };
    const leaves = (node: Element) =>
      [...node.querySelectorAll('*')].filter(
        (e) =>
          e.textContent &&
          ![...e.children].some((child) => child.textContent === e.textContent)
      );
    function sample() {
      const time = performance.now();
      try {
        if (
          !list.isConnected ||
          document.visibilityState !== 'visible' ||
          location.pathname !== scope ||
          !presentation(list).visible
        )
          throw Error('Conversation semantic capture lost visible scope');
        const posts = [...list.querySelectorAll('[data-postid]')].map(
          (row) => ({
            id: row.getAttribute('data-postid')!,
            texts: leaves(row)
              .filter((e) => presentation(e).visible)
              .map((e) => e.textContent!),
          })
        );
        const indicators = leaves(list).filter(
          (e) =>
            !e.closest('[data-postid]') &&
            ['Scroll stability computing', 'Thinking...'].includes(
              e.textContent!
            )
        );
        const controls = indicators.map((e) => ({
          id: 'thinking',
          scope,
          kind: e.textContent!,
          ...presentation(e),
        }));
        const measurement = {
          valid: true,
          durationMs: performance.now() - time,
        };
        if (raw.samples.at(-1)?.time === time) {
          if (
            JSON.stringify(raw.samples.at(-1)?.posts) !==
              JSON.stringify(posts) ||
            JSON.stringify(raw.chrome.samples.at(-1)?.controls) !==
              JSON.stringify(controls)
          )
            throw Error(
              'Semantic state changed at indistinguishable timestamps'
            );
        } else {
          raw.samples.push({ time, scope, measurement, posts });
          raw.chrome.samples.push({
            time,
            scope,
            measurement,
            semanticState: 'list-visible',
            loading: controls.some(
              (c) => c.kind === 'Scroll stability computing'
            ),
            controls,
          });
        }
        if (raw.samples.length > 10000)
          throw Error('Conversation semantic capacity exceeded');
      } catch (error) {
        raw.errors.push(String(error));
        active = false;
      }
      if (active) frame = requestAnimationFrame(sample);
    }
    sample();
    let frozen = false;
    const freeze = () => {
      if (frozen) return;
      active = false;
      cancelAnimationFrame(frame);
      sample();
      frozen = true;
    };
    return {
      raw,
      scope,
      mark(id: string, details?: { postId?: string; text?: string }) {
        const time = performance.now();
        raw.marks.push({ id, time, ...details });
        return time;
      },
      presence(
        markId: string,
        proof: Omit<
          ConversationSemanticTrace['presence'][number],
          'markId' | 'completedTime'
        >
      ) {
        const completedTime = performance.now();
        raw.presence.push({ ...proof, markId, completedTime });
        if (markId === 'show-1')
          raw.chrome.actions.push({
            id: 'presence-lifecycle',
            scope,
            time: completedTime,
          });
      },
      async wait(ms: number) {
        const end = performance.now() + ms;
        while (active && performance.now() < end)
          await new Promise(requestAnimationFrame);
      },
      async waitUntil(end: number) {
        while (active && performance.now() < end)
          await new Promise(requestAnimationFrame);
      },
      freeze,
      stop() {
        freeze();
        return raw;
      },
    };
  }, followSetup);
  return {
    mark: (id: string, details?: { postId?: string; text?: string }) =>
      capture.evaluate((c, a) => c.mark(a.id, a.details), { id, details }),
    presence: (
      id: string,
      proof: Omit<
        ConversationSemanticTrace['presence'][number],
        'markId' | 'completedTime'
      >
    ) => capture.evaluate((c, a) => c.presence(a.id, a.proof), { id, proof }),
    wait: (ms: number) => capture.evaluate((c, ms) => c.wait(ms), ms),
    waitUntil: (time: number) =>
      capture.evaluate((c, time) => c.waitUntil(time), time),
    freeze: () => capture.evaluate((c) => c.freeze()),
    // Raw data for the fixed seeded-session composition; existing stop still
    // declares and returns its original short-case contract.
    async stopRaw() {
      try {
        return await capture.evaluate((c) => c.stop());
      } finally {
        await capture.dispose();
      }
    },
    async stop(
      testInfo: TestInfo,
      label: string,
      mode: ConversationSemanticContract['mode']
    ) {
      try {
        const trace = await capture.evaluate((c) => c.stop());
        const terminal = trace.marks.filter((m) => m.id === 'terminal');
        const contract: ConversationSemanticContract = {
          version: 2,
          messageExpectations: conversationMessageExpectations(mode),
          mode,
          scope: trace.scope,
          expectedTexts:
            mode === 'remote'
              ? Array.from({ length: 5 }, (_, i) => `Remote burst ${i}`)
              : ['Response before computing presence cleared'],
          startTime: trace.samples[0]?.time,
          terminalTime: terminal.length === 1 ? terminal[0].time : NaN,
          endTime: terminal.length === 1 ? terminal[0].time + 1000 : NaN,
        };
        const proof = { trace, contract };
        await testInfo.attach(`${label}-semantic-proof`, {
          body: JSON.stringify(proof),
          contentType: 'application/json',
        });
        return proof;
      } finally {
        await capture.dispose();
      }
    },
  };
}

/** Establish fresh FOLLOW with real input after invite/navigation setup. */
export async function establishConversationFollow(
  page: Page,
  list: ElementHandle<HTMLElement>,
  latestRow: Locator,
  testInfo: TestInfo,
  label: string
) {
  await wheelToHistory(page, list);
  const latest = page.getByTestId('ScrollToBottomButton');
  await expect(latest).toBeVisible();
  const receipt = await list.evaluateHandle((list) => {
    const control = document.querySelector(
      '[data-testid="ScrollToBottomButton"]'
    );
    const scope = location.pathname;
    const requestedAt = performance.now();
    const actions: NonNullable<
      ConversationSemanticTrace['followSetup']
    >['actions'] = [];
    const click = (event: Event) => {
      if (
        !(event.target instanceof Element) ||
        !event.target.closest('[data-testid="ScrollToBottomButton"]')
      )
        return;
      actions.push({
        eventTime: event.timeStamp,
        capturedAt: performance.now(),
        isTrusted: event.isTrusted,
        sameControl:
          !!control && control.contains(event.target) && list.isConnected,
        scope: location.pathname,
        button: event instanceof MouseEvent ? event.button : -1,
        detail: event instanceof MouseEvent ? event.detail : 0,
      });
    };
    document.addEventListener('click', click, true);
    return {
      scope,
      requestedAt,
      actions,
      stop() {
        document.removeEventListener('click', click, true);
        return { scope, requestedAt, actions, completedAt: performance.now() };
      },
    };
  });
  let proof: ConversationSemanticTrace['followSetup'];
  try {
    await latest.click();
    await expect
      .poll(() =>
        list.evaluate((element) =>
          Math.abs(
            element.scrollHeight - element.clientHeight - element.scrollTop
          )
        )
      )
      .toBeLessThanOrEqual(1);
    await expect(latestRow).toBeInViewport();
    await settlePostScroller(list);
    const row = await latestRow.elementHandle();
    if (!row) throw Error('Missing latest row after real latest press');
    const geometry = await list.evaluate((list, row) => {
      const box = row.getBoundingClientRect(),
        view = list.getBoundingClientRect();
      return {
        postId: row.getAttribute('data-postid') ?? '',
        bottomGap: list.scrollHeight - list.clientHeight - list.scrollTop,
        targetClipPixels: Math.max(
          0,
          Math.max(0, view.top + list.clientTop) - box.top,
          box.bottom -
            Math.min(
              innerHeight,
              view.top + list.clientTop + list.clientHeight
            ),
          Math.max(0, view.left + list.clientLeft) - box.left,
          box.right -
            Math.min(innerWidth, view.left + list.clientLeft + list.clientWidth)
        ),
      };
    }, row);
    proof = { ...(await receipt.evaluate((r) => r.stop())), ...geometry };
    expect(proof.actions).toHaveLength(1);
    expect(proof.actions[0]).toMatchObject({
      isTrusted: true,
      sameControl: true,
      scope: proof.scope,
      button: 0,
      detail: 1,
    });
    expect(proof.actions[0].eventTime).toBeGreaterThanOrEqual(
      proof.requestedAt
    );
    expect(proof.actions[0].capturedAt).toBeGreaterThanOrEqual(
      proof.actions[0].eventTime
    );
    expect(
      proof.actions[0].capturedAt - proof.actions[0].eventTime
    ).toBeLessThanOrEqual(100);
    expect(Math.abs(proof.bottomGap)).toBeLessThanOrEqual(1);
    expect(proof.targetClipPixels).toBeLessThanOrEqual(1);
    expect(proof.postId).not.toBe('');
    return proof;
  } finally {
    const partial = await receipt.evaluate((r) => r.stop());
    await testInfo.attach(`${label}-follow-setup`, {
      body: JSON.stringify(proof ?? { ...partial, incomplete: true }),
      contentType: 'application/json',
    });
    await receipt.dispose();
  }
}

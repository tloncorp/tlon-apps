import { expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';

import * as helpers from './helpers';
import { currentLocalChannel, post } from './helpers/scrollerContentScenario';
import {
  keyboardEssayText,
  recordKeyboardSends,
} from './helpers/scrollKeyboard';
import { testWithOptions } from './test-fixtures';

const test = testWithOptions({ appReadyTimeoutMs: 60_000, e2eMode: false });
test.setTimeout(90_000);

for (const key of ['Enter', 'Space']) {
  test(`composer Send accepts one real ${key} activation`, async ({
    zodPage: page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await helpers.createGroup(page);
    await helpers.navigateToChannel(page, 'General');
    const { origin, channelId } = currentLocalChannel(page);
    expect(origin).toBe('http://localhost:3000');
    const preparation = await page.evaluate(() => ({
      scope: location.pathname,
      timeOrigin: performance.timeOrigin,
      ship: (window as Window & { ship?: string }).ship,
      e2eMode:
        (window as Window & { TLON_IS_E2E?: boolean }).TLON_IS_E2E === true,
    }));
    expect(preparation.ship).toBe('zod');
    expect(preparation.e2eMode).toBe(false);
    const input = page.getByTestId('MessageInput');
    const button = page.getByTestId('MessageInputSendButton');
    const draft = `Keyboard button ${key} ${randomUUID()}`;
    const wireText = `${draft} `;
    const sends = recordKeyboardSends(
      page,
      preparation.scope,
      preparation.timeOrigin
    );
    let events: unknown;
    let rawBackend: unknown;
    const capture = await button.evaluateHandle((element) => {
      const events: {
        type: string;
        key?: string;
        trusted: boolean;
        timeStamp: number;
        observedAt: number;
        target: string | null;
        scope: string;
      }[] = [];
      const listener = (event: Event) => {
        if (event.target !== element) return;
        events.push({
          type: event.type,
          key: event instanceof KeyboardEvent ? event.key : undefined,
          trusted: event.isTrusted,
          timeStamp: event.timeStamp,
          observedAt: performance.now(),
          target: element.getAttribute('data-testid'),
          scope: location.pathname,
        });
      };
      for (const name of ['keydown', 'keyup', 'click'])
        element.addEventListener(name, listener);
      return {
        stop() {
          for (const name of ['keydown', 'keyup', 'click'])
            element.removeEventListener(name, listener);
          return events;
        },
      };
    });
    try {
      expect(await button.evaluate((element) => element.tagName)).toBe(
        'BUTTON'
      );
      await expect(button).toHaveAttribute('type', 'button');
      expect(
        await button.evaluate(
          (element) => (element as HTMLButtonElement).form === null
        )
      ).toBe(true);
      await expect(button).toHaveAccessibleName('Send message');
      await expect(button).toBeDisabled();
      expect(
        await button.evaluate(
          (element) => (element as HTMLButtonElement).disabled
        )
      ).toBe(true);
      await input.fill(draft);
      await expect(button).toBeEnabled();
      await page.keyboard.press('Tab');
      await expect(button).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(input).toBeFocused();
      await expect(input).toHaveValue(draft);
      expect(
        await input.evaluate((element) => {
          const input = element as HTMLTextAreaElement;
          return [input.selectionStart, input.selectionEnd];
        })
      ).toEqual([draft.length, draft.length]);
      await page.keyboard.press('Tab');
      await expect(button).toBeFocused();
      expect(sends.requests).toHaveLength(0);
      await page.keyboard.press(key);
      await expect(input).toHaveValue('');
      await expect(button).toBeDisabled();
      await expect(post(page, draft)).toHaveCount(1);
      await expect(
        post(page, draft).getByTestId('ChatMessageDeliveryStatus')
      ).toHaveCount(0);
      await page.waitForTimeout(1000);
      await expect(post(page, draft)).toHaveCount(1);
      const response = await page.request.get(
        `${origin}/~/scry/channels/v5/${channelId}/posts/newest/50/post.json`
      );
      expect(response.ok()).toBe(true);
      const body: {
        posts: Record<
          string,
          { seal: { id: string }; essay: { author: string } }
        >;
      } = await response.json();
      rawBackend = body;
      const delivered = Object.values(body.posts).map(({ seal, essay }) => ({
        id: String(seal.id),
        author: essay.author,
        text: keyboardEssayText(essay),
      }));
      expect(delivered).toHaveLength(1);
      expect(delivered[0]).toMatchObject({ author: '~zod', text: wireText });
      expect(delivered[0].id).toMatch(/^\d+$/);
      const renderedId = await post(page, draft).getAttribute('data-postid');
      expect(renderedId).toMatch(/^(?:[1-9]\d*|[1-9]\d{0,2}(?:\.\d{3})+)$/);
      expect(renderedId?.replaceAll('.', '')).toBe(delivered[0].id);
      expect(new URL(page.url()).pathname).toBe(preparation.scope);
    } finally {
      events = await capture.evaluate((capture) => capture.stop());
      await capture.dispose();
      sends.stop();
      await testInfo.attach('send-button-functional-proof', {
        contentType: 'application/json',
        body: JSON.stringify({
          key,
          draft,
          wireText,
          preparation,
          events,
          requests: sends.requests,
          errors: sends.errors,
          rawBackend,
          scope:
            'Functional DOM and durable transport; no continuous geometry or presented-frame qualification.',
        }),
      });
    }
    expect(sends.errors).toEqual([]);
    expect(sends.requests).toHaveLength(1);
    expect(sends.requests[0]).toMatchObject({
      channel: channelId,
      author: '~zod',
      text: wireText,
    });
    const observed = events as {
      type: string;
      key?: string;
      trusted: boolean;
      timeStamp: number;
      observedAt: number;
      target: string;
      scope: string;
    }[];
    expect(observed.filter((event) => event.type === 'click')).toHaveLength(1);
    const activation = observed.filter(
      (event) =>
        event.type === 'click' || event.key === (key === 'Space' ? ' ' : key)
    );
    expect(activation.filter((event) => event.type === 'keydown')).toHaveLength(
      1
    );
    // Native disabled-button focus can change on activation. Keyup may target
    // the textarea/body; it is not relabelled as a delivered button event.
    for (const event of activation) {
      expect(event.trusted).toBe(true);
      expect(event.target).toBe('MessageInputSendButton');
      expect(event.scope).toBe(preparation.scope);
      expect(Number.isFinite(event.timeStamp) && event.timeStamp > 0).toBe(
        true
      );
      expect(event.observedAt).toBeGreaterThanOrEqual(event.timeStamp);
    }
  });
}

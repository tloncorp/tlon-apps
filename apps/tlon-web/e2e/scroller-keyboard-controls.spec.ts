import { expect, test } from '@playwright/test';

// Browser-native contract calibration only. Never counted as app/scroller proof.
test('native textarea undo selection and native button Tab routing calibration', async ({
  page,
}, testInfo) => {
  testInfo.annotations.push({
    type: 'evidence-kind',
    description: 'scroller-detector-calibration',
  });
  await page.setContent(
    '<textarea id="editor"></textarea><button id="send">Send</button>'
  );
  await page.evaluate(() => {
    const events: unknown[] = [];
    (
      window as unknown as { keyboardCalibration: unknown[] }
    ).keyboardCalibration = events;
    for (const name of [
      'keydown',
      'keyup',
      'beforeinput',
      'input',
      'focus',
      'blur',
    ])
      document.addEventListener(
        name,
        (event) => {
          const key = event as KeyboardEvent;
          const input = event as InputEvent;
          events.push({
            type: event.type,
            time: event.timeStamp,
            observedAt: performance.now(),
            trusted: event.isTrusted,
            key: key.key,
            inputType: input.inputType,
            data: input.data,
            target: (event.target as HTMLElement)?.id ?? null,
          });
        },
        true
      );
  });
  const editor = page.locator('#editor');
  await editor.click();
  for (const key of 'keyboard abcd1234 alpha beta omega')
    await page.keyboard.press(key === ' ' ? 'Space' : key);
  for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowLeft');
  for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('z');
  await page.keyboard.press('Backspace');
  const modifier = await page.evaluate(() =>
    navigator.platform.startsWith('Mac') ? 'Meta' : 'Control'
  );
  const snapshot = () =>
    editor.evaluate((node) => {
      const el = node as HTMLTextAreaElement;
      return {
        value: el.value,
        start: el.selectionStart,
        end: el.selectionEnd,
        focus: (document.activeElement as HTMLElement)?.id ?? null,
      };
    });
  const before = await snapshot();
  await page.keyboard.press(`${modifier}+z`);
  const undone = await snapshot();
  await page.keyboard.press(`${modifier}+Shift+z`);
  const redone = await snapshot();
  await page.keyboard.press('Tab');
  const tabbed = await snapshot();
  await page.keyboard.press('Shift+Tab');
  const returned = await snapshot();
  const events = await page.evaluate(
    () =>
      (window as unknown as { keyboardCalibration: unknown[] })
        .keyboardCalibration
  );
  const evidence = {
    scope: 'plain native textarea/button only',
    modifier,
    before,
    undone,
    redone,
    tabbed,
    returned,
    events,
  };
  await testInfo.attach('keyboard-native-calibration', {
    contentType: 'application/json',
    body: JSON.stringify(evidence),
  });
  expect(before).toEqual({
    value: 'keyboard abcd1234 alpha  omega',
    start: 24,
    end: 24,
    focus: 'editor',
  });
  expect(undone).toEqual({
    value: 'keyboard abcd1234 alpha z omega',
    start: 24,
    end: 25,
    focus: 'editor',
  });
  expect(redone).toEqual(before);
  expect(tabbed).toEqual({ ...before, focus: 'send' });
  expect(returned).toEqual(before);
  expect(
    events
      .filter((event: any) => event.type === 'input')
      .slice(-2)
      .map((event: any) => ({ type: event.inputType, trusted: event.trusted }))
  ).toEqual([
    { type: 'historyUndo', trusted: true },
    { type: 'historyRedo', trusted: true },
  ]);
});

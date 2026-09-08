import { randomUUID } from 'node:crypto';
import type { ElementHandle, Page } from '@playwright/test';
import {
  startInputPaint,
  finalizeInputPaint,
} from '../../../../scripts/scroll-stability-input-paint.cjs';
import type {
  ScrollInputAction,
  ScrollInputDispatch,
  ScrollInputKey,
  ScrollInputSample,
} from '../../../../packages/app/fixtures/scrollInputTrace';

/** Capture DOM input state without inferring native textarea caret geometry. */
export async function startScrollInputTrace(
  input: ElementHandle<HTMLElement | SVGElement>,
  send: ElementHandle<HTMLElement | SVGElement>,
  inputPayloads?: (
    | string
    | { kind: 'input' | 'select-all'; payload: string }
  )[],
  paintPage?: Page
) {
  const handle = await input.evaluateHandle(
    (element, { sendElement, inputPayloads, paintToken }) => {
      if (
        !(element instanceof HTMLElement) ||
        !(sendElement instanceof HTMLElement)
      )
        throw new Error('Expected HTML composer and send control');
      const originalScope = location.pathname;
      const inputId = element.getAttribute('data-testid') || element.id;
      if (!inputId) throw new Error('Input needs a stable identifier');
      const samples: ScrollInputSample[] = [];
      const actions: (ScrollInputAction & {
        trusted: boolean;
        observedAt: number;
      })[] = [];
      const dispatches: ScrollInputDispatch[] = [];
      const keyboard: ScrollInputKey[] = [];
      const commandCounts = new Map<string, number>();
      const commandPlan = inputPayloads?.map((value) => {
        const command =
          typeof value === 'string'
            ? { kind: 'input' as const, payload: value }
            : value;
        const count = (commandCounts.get(command.kind) ?? 0) + 1;
        commandCounts.set(command.kind, count);
        return {
          ...command,
          id: `${command.kind}-${count}`,
          scopeKey: originalScope,
          inputId,
        };
      });
      const marks: { name: string; time: number }[] = [];
      const counts = new Map<string, number>();
      let composing = false;
      let raf = 0;
      let active = true;
      const paintOwner = {
        token: paintToken,
        timeOrigin: performance.timeOrigin,
        scopeKey: originalScope,
        inputId,
      };
      const readPaintSurface = () => ({
        deviceScaleFactor: devicePixelRatio,
        viewport: {
          pageX: window.visualViewport?.pageLeft ?? scrollX,
          pageY: window.visualViewport?.pageTop ?? scrollY,
          offsetX: window.visualViewport?.offsetLeft ?? 0,
          offsetY: window.visualViewport?.offsetTop ?? 0,
          scale: window.visualViewport?.scale ?? 1,
          width: window.visualViewport?.width ?? innerWidth,
          height: window.visualViewport?.height ?? innerHeight,
        },
      });
      const paintSurface = readPaintSurface();
      const paintEpochs = [
        { epoch: 0, time: performance.now(), reason: 'retained-input' },
      ];
      const nextPaintEpoch = (reason: string) => {
        paintEpochs.push({
          epoch: paintEpochs.length,
          time: performance.now(),
          reason,
        });
      };
      const textInput =
        element instanceof HTMLTextAreaElement ||
        element instanceof HTMLInputElement;
      const draft = () =>
        textInput
          ? (element as HTMLTextAreaElement).value
          : (element.textContent ?? '');
      function exposed(node: Element, bounds = node.getBoundingClientRect()) {
        let left = Math.max(bounds.left, 0);
        let right = Math.min(bounds.right, innerWidth);
        let top = Math.max(bounds.top, 0);
        let bottom = Math.min(bounds.bottom, innerHeight);
        for (
          let ancestor: Element | null = node;
          ancestor;
          ancestor = ancestor.parentElement
        ) {
          const style = getComputedStyle(ancestor);
          if (
            style.display === 'none' ||
            style.visibility !== 'visible' ||
            Number(style.opacity) === 0
          )
            return false;
          const box = ancestor.getBoundingClientRect();
          if (['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowX)) {
            left = Math.max(left, box.left + ancestor.clientLeft);
            right = Math.min(
              right,
              box.left + ancestor.clientLeft + ancestor.clientWidth
            );
          }
          if (['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowY)) {
            top = Math.max(top, box.top + ancestor.clientTop);
            bottom = Math.min(
              bottom,
              box.top + ancestor.clientTop + ancestor.clientHeight
            );
          }
        }
        return node.isConnected && right >= left && bottom > top;
      }
      function selection() {
        if (textInput) {
          const input = element as HTMLTextAreaElement;
          return {
            start: input.selectionStart ?? -1,
            end: input.selectionEnd ?? -1,
          };
        }
        const current = getSelection();
        if (!current?.rangeCount) return { start: -1, end: -1 };
        const range = current.getRangeAt(0);
        if (
          !element.contains(range.startContainer) ||
          !element.contains(range.endContainer)
        )
          return { start: -1, end: -1 };
        const before = document.createRange();
        before.selectNodeContents(element);
        before.setEnd(range.startContainer, range.startOffset);
        const start = before.toString().length;
        before.setEnd(range.endContainer, range.endOffset);
        return { start, end: before.toString().length };
      }
      function caretVisible(): boolean | null {
        if (document.activeElement !== element || !exposed(element))
          return false;
        // Native text controls do not expose their caret Range. A mirror would
        // measure an invented layout and conceal the visibility proof gap.
        if (textInput) return null;
        const current = getSelection();
        if (!current?.rangeCount) return false;
        const range = current.getRangeAt(0).cloneRange();
        range.collapse(false);
        const rect = range.getBoundingClientRect();
        return rect.height > 0 && exposed(element, rect);
      }
      function sample(schedule = true) {
        const bounds = sendElement.getBoundingClientRect();
        const target = document.elementFromPoint(
          (bounds.left + bounds.right) / 2,
          (bounds.top + bounds.bottom) / 2
        );
        samples.push({
          time: performance.now(),
          valid: element.isConnected && sendElement.isConnected,
          scopeKey: location.pathname,
          inputId: inputId!,
          draft: draft(),
          selection: selection(),
          composing,
          focused: document.activeElement === element,
          caretVisible: caretVisible(),
          sendVisible: bounds.width > 0 && exposed(sendElement),
          sendHitTestable:
            target !== null &&
            (target === sendElement || sendElement.contains(target)),
        });
        if (active && schedule) raf = requestAnimationFrame(() => sample());
      }
      function record(
        kind: ScrollInputAction['kind'],
        event: Event,
        payload = draft()
      ) {
        nextPaintEpoch(kind);
        const count = (counts.get(kind) ?? 0) + 1;
        counts.set(kind, count);
        actions.push({
          id: `${kind}-${count}`,
          time: event.timeStamp,
          observedAt: performance.now(),
          kind,
          scopeKey: location.pathname,
          inputId: inputId!,
          payload,
          trusted: event.isTrusted,
        });
        // Observe the state after all input handlers, including React's update.
        // This is local DOM acknowledgement, not a presented-frame timestamp.
        queueMicrotask(() => {
          if (active) sample(false);
        });
      }
      const listeners: [EventTarget, string, EventListener][] = [];
      for (const [eventName, kind] of [
        ['input', 'input'],
        ['focus', 'focus'],
        ['blur', 'blur'],
        ['compositionstart', 'composition-start'],
        ['compositionend', 'composition-end'],
      ] as const) {
        const callback: EventListener = (event) => {
          if (kind === 'composition-start') composing = true;
          if (kind === 'composition-end') composing = false;
          record(kind, event);
        };
        element.addEventListener(eventName, callback);
        listeners.push([element, eventName, callback]);
      }
      const onKey: EventListener = (event) => {
        nextPaintEpoch('keydown');
        const key = event as KeyboardEvent;
        keyboard.push({
          time: key.timeStamp,
          observedAt: performance.now(),
          scopeKey: location.pathname,
          inputId: inputId!,
          trusted: key.isTrusted,
          targetIsInput: key.target === element,
          key: key.key,
          code: key.code,
          ctrlKey: key.ctrlKey,
          metaKey: key.metaKey,
          altKey: key.altKey,
          shiftKey: key.shiftKey,
          repeat: key.repeat,
        });
        if (
          commandPlan?.some((command) => command.kind === 'select-all') &&
          key.key.toLowerCase() === 'a' &&
          key.ctrlKey !== key.metaKey &&
          !key.altKey &&
          !key.shiftKey &&
          !key.repeat
        ) {
          record('select-all', key, 'ControlOrMeta+A');
        }
      };
      element.addEventListener('keydown', onKey, true);
      const onSend: EventListener = (event) => record('send', event);
      sendElement.addEventListener('click', onSend, true);
      const onPaintSelection = () => nextPaintEpoch('select');
      const onPaintScroll = () => nextPaintEpoch('input-scroll');
      element.addEventListener('select', onPaintSelection);
      element.addEventListener('scroll', onPaintScroll);
      const declaredAt = performance.now();
      let frozen = false;
      const freeze = () => {
        if (frozen) return;
        active = false;
        cancelAnimationFrame(raf);
        sample();
        for (const [target, name, callback] of listeners)
          target.removeEventListener(name, callback);
        sendElement.removeEventListener('click', onSend, true);
        element.removeEventListener('keydown', onKey, true);
        element.removeEventListener('select', onPaintSelection);
        element.removeEventListener('scroll', onPaintScroll);
        frozen = true;
      };
      sample();
      return {
        declaredAt,
        originalScope,
        inputId,
        beginInput(index: number) {
          if (
            !commandPlan ||
            index !== dispatches.length ||
            !commandPlan[index] ||
            dispatches.some((command) => !Number.isFinite(command.end))
          )
            throw new Error('Invalid input command order');
          nextPaintEpoch('begin-input');
          dispatches.push({
            ...commandPlan[index],
            start: performance.now(),
            end: NaN,
          });
        },
        endInput(index: number) {
          if (
            index !== dispatches.length - 1 ||
            Number.isFinite(dispatches[index]?.end)
          )
            throw new Error('Invalid input command completion');
          dispatches[index].end = performance.now();
          nextPaintEpoch('end-input');
        },
        paintSnapshot() {
          const bounds = element.getBoundingClientRect();
          const left = Math.max(0, bounds.left),
            top = Math.max(0, bounds.top);
          const right = Math.min(innerWidth, bounds.right),
            bottom = Math.min(innerHeight, bounds.bottom);
          const style = getComputedStyle(element);
          return {
            time: performance.now(),
            valid:
              active &&
              element instanceof HTMLTextAreaElement &&
              element.isConnected &&
              exposed(element),
            owner: paintOwner.token,
            timeOrigin: performance.timeOrigin,
            scopeKey: location.pathname,
            inputId: element.getAttribute('data-testid') || element.id,
            draft: draft(),
            selection: selection(),
            composing,
            focused: document.activeElement === element,
            epoch: paintEpochs.length - 1,
            clip:
              right > left && bottom > top
                ? { x: left, y: top, width: right - left, height: bottom - top }
                : null,
            ...readPaintSurface(),
            scrollTop: element.scrollTop,
            scrollLeft: element.scrollLeft,
            style: JSON.stringify([
              style.font,
              style.lineHeight,
              style.color,
              style.caretColor,
              style.direction,
              style.writingMode,
              style.padding,
              style.border,
              style.transform,
              style.opacity,
              style.background,
            ]),
          };
        },
        mark(name: string) {
          marks.push({ name, time: performance.now() });
        },
        freeze,
        stop() {
          freeze();
          return {
            declaredAt,
            originalScope,
            inputId,
            samples,
            actions,
            keyboard,
            marks,
            commandPlan,
            dispatches,
            paintOwner,
            paintSurface,
            paintEpochs,
          };
        },
      };
    },
    { sendElement: send, inputPayloads, paintToken: randomUUID() }
  );
  const paint = paintPage
    ? startInputPaint(
        paintPage,
        () => handle.evaluate((recorder) => recorder.paintSnapshot()),
        {
          ownsPage: async () =>
            (await input.ownerFrame()) === paintPage.mainFrame(),
        }
      )
    : undefined;
  return {
    beginInput: (index: number) =>
      handle.evaluate((recorder, index) => recorder.beginInput(index), index),
    endInput: (index: number) =>
      handle.evaluate((recorder, index) => recorder.endInput(index), index),
    mark: (name: string) =>
      handle.evaluate((recorder, name) => recorder.mark(name), name),
    // Freeze DOM observations without transferring the retained trace.
    freeze: () => handle.evaluate((recorder) => recorder.freeze()),
    async stop() {
      try {
        return await finalizeInputPaint(
          () => handle.evaluate((recorder) => recorder.stop()),
          paint
        );
      } finally {
        await paint?.stop();
        await handle.dispose();
      }
    },
  };
}

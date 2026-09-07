import { describe, expect, it } from 'vitest';
import {
  assessScrollContentTrace,
  type ContentPresentation,
  type ScrollContentContract,
  type ScrollContentTrace,
} from './scrollContentTrace';

function evidence() {
  const src = 'http://localhost:3000/scroller-loading/actual.png';
  const scope = '/channel/chat/~zod/general';
  const box = (top: number, height: number) => ({
    left: 0,
    right: 600,
    top,
    bottom: top + height,
    width: 600,
    height,
  });
  const presentation = (top: number, height: number): ContentPresentation => ({
    connected: true,
    displayed: true,
    opacity: 1,
    rect: box(top, height),
    clip: box(
      Math.max(100, top),
      Math.max(0, Math.min(500, top + height) - Math.max(100, top))
    ),
  });
  const contract: ScrollContentContract = {
    scope,
    src,
    rowId: 'post-1',
    caption: 'An unchanged image caption',
    releaseTime: 250,
    terminalTime: 500,
    coverage: {
      startTime: 0,
      endTime: 1500,
      maxGapMs: 100,
      maxMeasurementDurationMs: 32,
    },
  };
  const trace: ScrollContentTrace = {
    errors: [],
    marks: [
      { id: 'response-release', time: 250 },
      { id: 'terminal-ready', time: 500 },
    ],
    events: [
      {
        id: 'image-load',
        time: 300,
        scope,
        src,
        currentSrc: src,
        originalTarget: true,
        trusted: true,
      },
      {
        id: 'image-decoded',
        time: 320,
        scope,
        src,
        currentSrc: src,
        originalTarget: true,
        trusted: true,
      },
    ],
    samples: Array.from({ length: 37 }, (_, index) => {
      const ready = index >= 7;
      return {
        time: index * 50,
        scope,
        rowId: 'post-1',
        sameRow: true,
        list: presentation(100, 400),
        row: presentation(ready ? 150 : 50, ready ? 350 : 450),
        imageFrame: presentation(ready ? 200 : 100, ready ? 300 : 400),
        caption: {
          count: 1,
          text: contract.caption,
          presentation: presentation(ready ? 150 : 50, 20),
        },
        images: [
          {
            src,
            currentSrc: ready ? src : '',
            complete: ready,
            naturalWidth: ready ? 2 : 0,
            naturalHeight: ready ? 1 : 0,
            sameElement: true,
            presentation: presentation(ready ? 200 : 100, ready ? 300 : 400),
            frontmost: true,
          },
        ],
        fallbackPresent: false,
        measurement: { valid: true, durationMs: 1 },
      };
    }),
  };
  return { trace, contract };
}

describe('image loading content oracle (detector controls, not product paint)', () => {
  it('accepts the real reservation model without inventing a placeholder or forcing a clipped caption onscreen', () => {
    const { trace, contract } = evidence();
    const result = assessScrollContentTrace(trace, contract);
    expect(result.verdict).toBe('PASS');
    expect(result.nativePresentation).toBe('INCOMPLETE');
    expect(result.evidenceLevel).toBe('sampled-dom-content');
  });

  it('requires caption semantics but does not demand opacity from a geometrically clipped caption', () => {
    const { trace, contract } = evidence();
    trace.samples[1].caption.presentation!.opacity = 0;
    expect(assessScrollContentTrace(trace, contract).verdict).toBe('PASS');
  });

  it('permits undecoded image pixels to be hidden while the real reservation remains exposed', () => {
    const { trace, contract } = evidence();
    trace.samples[1].images[0].presentation.opacity = 0;
    trace.samples[1].images[0].frontmost = false;
    expect(assessScrollContentTrace(trace, contract).verdict).toBe('PASS');
  });

  it.each([
    [
      'one-sample blank image',
      (value: ReturnType<typeof evidence>) => {
        value.trace.samples[20].images = [];
      },
    ],
    [
      'duplicate image',
      (value: ReturnType<typeof evidence>) => {
        value.trace.samples[20].images.push({
          ...value.trace.samples[20].images[0],
        });
      },
    ],
    [
      'stale source reappears',
      (value: ReturnType<typeof evidence>) => {
        value.trace.samples[20].images[0].currentSrc =
          'http://localhost:3000/old.png';
      },
    ],
    [
      'ready becomes pending',
      (value: ReturnType<typeof evidence>) => {
        Object.assign(value.trace.samples[20].images[0], {
          complete: false,
          naturalWidth: 0,
          naturalHeight: 0,
        });
      },
    ],
    [
      'ready reverts before terminal',
      (value: ReturnType<typeof evidence>) => {
        Object.assign(value.trace.samples[8].images[0], {
          complete: false,
          naturalWidth: 0,
          naturalHeight: 0,
        });
      },
    ],
    [
      'image hidden for one sample',
      (value: ReturnType<typeof evidence>) => {
        value.trace.samples[20].images[0].presentation.opacity = 0;
      },
    ],
    [
      'undeclared image fade',
      (value: ReturnType<typeof evidence>) => {
        value.trace.samples[20].images[0].presentation.opacity = 0.5;
      },
    ],
    [
      'list opacity flash',
      (value: ReturnType<typeof evidence>) => {
        value.trace.samples[20].list.opacity = 0;
      },
    ],
    [
      'reserved image frame disappears',
      (value: ReturnType<typeof evidence>) => {
        value.trace.samples[1].imageFrame.displayed = false;
      },
    ],
    [
      'visible caption opacity flash',
      (value: ReturnType<typeof evidence>) => {
        value.trace.samples[20].caption.presentation!.opacity = 0;
      },
    ],
    [
      'caption text replaced',
      (value: ReturnType<typeof evidence>) => {
        value.trace.samples[20].caption.text = 'stale';
      },
    ],
    [
      'caption disappears',
      (value: ReturnType<typeof evidence>) => {
        value.trace.samples[20].caption = {
          count: 0,
          text: '',
          presentation: null,
        };
      },
    ],
    [
      'same ID remounts the row',
      (value: ReturnType<typeof evidence>) => {
        value.trace.samples[20].sameRow = false;
      },
    ],
    [
      'same URI remounts the image',
      (value: ReturnType<typeof evidence>) => {
        value.trace.samples[20].images[0].sameElement = false;
      },
    ],
    [
      'wrong intrinsic pixels',
      (value: ReturnType<typeof evidence>) => {
        value.trace.samples[20].images[0].naturalWidth = 3;
      },
    ],
    [
      'fallback reappears',
      (value: ReturnType<typeof evidence>) => {
        value.trace.samples[20].fallbackPresent = true;
      },
    ],
    [
      'another conversation replaces content',
      (value: ReturnType<typeof evidence>) => {
        value.trace.samples[20].scope = '/other';
      },
    ],
    [
      'final image is clipped',
      (value: ReturnType<typeof evidence>) => {
        value.trace.samples[20].images[0].presentation.clip.top += 5;
        value.trace.samples[20].images[0].presentation.clip.height -= 5;
      },
    ],
    [
      'load error after readiness',
      (value: ReturnType<typeof evidence>) => {
        value.trace.events.push({
          ...value.trace.events[0],
          id: 'image-error',
          time: 800,
        });
      },
    ],
  ] as const)(
    'rejects %s despite otherwise stable content',
    (_name, corrupt) => {
      const value = evidence();
      corrupt(value);
      const result = assessScrollContentTrace(value.trace, value.contract);
      expect(result.verdict).toBe('FAIL');
      expect(result.issues.length).toBeGreaterThan(0);
    }
  );

  it.each([
    [
      'missing load event',
      (value: ReturnType<typeof evidence>) => {
        value.trace.events.shift();
      },
    ],
    [
      'missing decode completion',
      (value: ReturnType<typeof evidence>) => {
        value.trace.events.pop();
      },
    ],
    [
      'fake dispatched load',
      (value: ReturnType<typeof evidence>) => {
        value.trace.events[0].trusted = false;
      },
    ],
    [
      'wrong event target',
      (value: ReturnType<typeof evidence>) => {
        value.trace.events[0].originalTarget = false;
      },
    ],
    [
      'decode before load',
      (value: ReturnType<typeof evidence>) => {
        value.trace.events[1].time = 299;
      },
    ],
    [
      'short held baseline',
      (value: ReturnType<typeof evidence>) => {
        value.contract.releaseTime = 150;
      },
    ],
    [
      'missing release marker',
      (value: ReturnType<typeof evidence>) => {
        value.trace.marks.shift();
      },
    ],
    [
      'tail uses premature final sample',
      (value: ReturnType<typeof evidence>) => {
        value.contract.coverage.endTime = 1499;
      },
    ],
    [
      'capture stops early',
      (value: ReturnType<typeof evidence>) => {
        value.trace.samples = value.trace.samples.slice(0, 29);
      },
    ],
    [
      'sample gap',
      (value: ReturnType<typeof evidence>) => {
        value.trace.samples.splice(14, 2);
      },
    ],
    [
      'duplicate timestamp',
      (value: ReturnType<typeof evidence>) => {
        value.trace.samples[20].time = value.trace.samples[19].time;
      },
    ],
    [
      'slow acquisition',
      (value: ReturnType<typeof evidence>) => {
        value.trace.samples[20].measurement.durationMs = 33;
      },
    ],
    [
      'invalid opacity evidence',
      (value: ReturnType<typeof evidence>) => {
        value.trace.samples[20].images[0].presentation.opacity = NaN;
      },
    ],
    [
      'weakened gap contract',
      (value: ReturnType<typeof evidence>) => {
        value.contract.coverage.maxGapMs = 101;
      },
    ],
    [
      'collector error',
      (value: ReturnType<typeof evidence>) => {
        value.trace.errors.push('Document hidden');
      },
    ],
    [
      'event array out of order',
      (value: ReturnType<typeof evidence>) => {
        value.trace.events.reverse();
      },
    ],
    [
      'clip extends beyond its image',
      (value: ReturnType<typeof evidence>) => {
        value.trace.samples[20].images[0].presentation.clip.top -= 5;
        value.trace.samples[20].images[0].presentation.clip.height += 5;
      },
    ],
    [
      'missing row identity observation',
      (value: ReturnType<typeof evidence>) => {
        delete (
          value.trace.samples[20] as Partial<
            ScrollContentTrace['samples'][number]
          >
        ).sameRow;
      },
    ],
    [
      'foreign layer over the ready image',
      (value: ReturnType<typeof evidence>) => {
        value.trace.samples[20].images[0].frontmost = false;
      },
    ],
  ] as const)('does not pass %s', (_name, corrupt) => {
    const value = evidence();
    corrupt(value);
    expect(assessScrollContentTrace(value.trace, value.contract).verdict).toBe(
      'INCOMPLETE'
    );
  });
});

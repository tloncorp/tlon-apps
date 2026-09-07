import { createHash } from 'node:crypto';
import type { ConcurrentContentProof } from './scrollConcurrentContentTrace';
import { makeConcurrentPng } from './scrollConcurrentMedia';

const pngs = [makeConcurrentPng(720, 1080), makeConcurrentPng(1280, 640)];
export function concurrentEvidence(
  position: 'latest' | 'history' = 'latest',
  first = 'portrait'
): ConcurrentContentProof {
  const scope = '/apps/groups/group/~zod%2Fg/channel/chat%2F~zod%2Fc',
    origin = 'http://localhost:3000',
    rowId = '123';
  const paragraph = 'A reader stays here.';
  const box = (left: number, top: number, width: number, height: number) => ({
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  });
  const presentation = (
    left: number,
    top: number,
    width: number,
    height: number
  ) => ({
    connected: true,
    displayed: true,
    opacity: 1,
    rect: box(left, top, width, height),
    clip: box(left, top, width, height),
  });
  const fragment = (left: number, width: number) => ({
    presentation: presentation(left, 650, width, 20),
    textAlpha: 1,
    pointerEvents: 'auto',
    hits: [0.1, 0.5, 0.9].map((f) => ({
      x: left + f * width,
      y: 660,
      stack: [{ relation: 'owner' as const, tag: 'SPAN' }],
    })),
  });
  const times = Array.from({ length: 37 }, (_, index) => index * 50);
  const media = [
    { id: 'portrait', width: 720, height: 1080 },
    { id: 'landscape', width: 1280, height: 640 },
  ].map((m, index) => ({
    ...m,
    src: `/scroller-concurrent/12345678-1234-1234-1234-123456789abc/${m.id}.png`,
    bytes: pngs[index].length,
    png: pngs[index].toString('base64'),
    sha256: createHash('sha256').update(pngs[index]).digest('hex'),
    releaseTime: m.id === first ? 300 : 700,
    readyTime: m.id === first ? 400 : 800,
    trace: null as any,
  }));
  for (const m of media)
    m.trace = {
      errors: [],
      marks: [
        { id: 'response-release', time: m.releaseTime },
        { id: 'ready-observed', time: m.readyTime },
      ],
      events: ['image-load', 'image-decoded'].map((id, index) => ({
        id,
        time: m.readyTime - 20 + index * 10,
        scope,
        src: origin + m.src,
        currentSrc: origin + m.src,
        originalTarget: true,
        trusted: true,
      })),
      samples: times.map((time) => ({
        time,
        scope,
        rowId,
        sameRow: true,
        list: presentation(0, 0, 700, 800),
        row: presentation(0, 0, 700, 750),
        imageFrame: presentation(
          0,
          50,
          600,
          m.id === 'landscape' && time >= m.readyTime ? 300 : 400
        ),
        caption: {
          count: 1,
          text: paragraph,
          presentation: presentation(20, 650, 400, 20),
        },
        images: media.map((other) => ({
          src: origin + other.src,
          currentSrc: time >= other.readyTime ? origin + other.src : '',
          complete: time >= other.readyTime,
          naturalWidth: time >= other.readyTime ? other.width : 0,
          naturalHeight: time >= other.readyTime ? other.height : 0,
          sameElement: other.id === m.id,
          presentation: presentation(0, 50, 600, 300),
          frontmost: true,
        })),
        fallbackPresent: false,
        measurement: { valid: true, durationMs: 1 },
      })),
    };
  const essay = {
    content: [
      ...media.map((m) => ({
        block: {
          image: {
            src: m.src,
            alt: `${m.id} coordinate grid ${m.width} by ${m.height}`,
            width: 0,
            height: 0,
          },
        },
      })),
      { inline: [paragraph] },
    ],
  };
  return {
    version: 1,
    position,
    chromeEligibility: {
      thresholdViewportRatio: 1,
      baselineBottomGap: position === 'latest' ? 0 : 400,
      baselineViewportHeight: 800,
      visibility: 'hidden',
      mode: position === 'latest' ? 'at-end' : 'hidden-near-bottom',
    },
    order:
      first === 'portrait'
        ? ['portrait', 'landscape']
        : ['landscape', 'portrait'],
    preparation: {
      scope,
      origin,
      ship: 'zod',
      e2eMode: false,
      warmupMs: 2000,
      browser: 'test-chromium',
      channel: 'chromium',
      headed: true,
      assets: 'Vite development assets',
    },
    before: {
      seal: { id: rowId },
      essay,
      read: { requestedTime: -100, completedTime: -10 },
    },
    after: {
      seal: { id: rowId },
      essay: structuredClone(essay),
      read: { requestedTime: 1810, completedTime: 1820 },
    },
    media,
    requests: media.map((m) => ({
      id: m.id,
      url: origin + m.src,
      method: 'GET',
      requestedAt: 1000,
      requestedTime: -100,
      releasedAt: 1000 + m.releaseTime,
      releasedTime: m.releaseTime,
      fulfilledAt: 1000 + m.releaseTime + 5,
      fulfilledTime: m.releaseTime + 5,
      status: 200,
      sha256: m.sha256,
      bytes: m.bytes,
    })),
    chrome: {
      errors: [],
      actions: [],
      samples: times.map((time) => ({
        time,
        scope,
        loading: false,
        semanticState: 'list-visible',
        controls: [
          {
            id: 'latest',
            scope,
            kind: 'icon',
            visible: false,
            opacity: 0,
          },
        ],
        measurement: { valid: true, durationMs: 1 },
      })),
    },
    geometry: {
      errors: [],
      frames: times.map((time) => ({
        time,
        bottomGap: position === 'latest' ? 0 : 400,
        scrollTop: position === 'latest' ? 1000 : 600,
        scrollHeight: 1800,
        clientHeight: 800,
        viewportTop: 0,
        viewportBottom: 800,
        anchors: { [rowId]: { top: 0, bottom: 750, height: 750 } },
      })),
    },
    reading: {
      contract: {
        scope,
        rowId,
        blockSelector: '.body',
        revision: { id: 'unchanged', text: paragraph },
        point: { start: 2, end: 3, x: 40, y: 650, tolerancePx: 1 },
        coverage: {
          startTime: 0,
          endTime: 1800,
          maxGapMs: 100,
          maxMeasurementDurationMs: 32,
        },
        terminalTime: 800,
      },
      trace: {
        blockAcquisition: 'retained-element',
        blockSelector: '.body',
        point: { start: 2, end: 3 },
        errors: [],
        marks: [{ id: 'terminal-ready', time: 800 }],
        samples: times.map((time) => ({
          time,
          scope,
          rowId,
          sameRow: true,
          sameBlock: true,
          blockCount: 1,
          text: paragraph,
          list: presentation(0, 0, 700, 800),
          row: presentation(0, 0, 700, 750),
          block: presentation(20, 650, 500, 50),
          nodes: [
            {
              text: paragraph,
              start: 0,
              end: paragraph.length,
              fragments: [fragment(20, 300)],
            },
          ],
          point: {
            start: 2,
            end: 3,
            text: 'r',
            relativeX: 40,
            relativeY: 650,
            fragment: fragment(40, 8),
          },
          measurement: { valid: true, durationMs: 1 },
        })),
      },
    },
  };
}

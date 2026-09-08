import type { Page } from '@playwright/test';
export type InputPaintSnapshot = {
  time: number;
  valid: boolean;
  owner: string;
  timeOrigin: number;
  scopeKey: string;
  inputId: string;
  draft: string;
  selection: { start: number; end: number };
  focused: boolean;
  composing: boolean;
  epoch: number;
  clip: { x: number; y: number; width: number; height: number } | null;
  deviceScaleFactor: number;
  viewport: {
    pageX: number;
    pageY: number;
    offsetX: number;
    offsetY: number;
    scale: number;
    width: number;
    height: number;
  };
  scrollTop: number;
  scrollLeft: number;
  style: string;
};
export type InputPaintRaw = {
  version: 1 | 2 | 3 | 4;
  captureRegion?: 'viewport';
  pixelScale?: 'css';
  transport?: 'cdp-page-capture-screenshot' | 'playwright-page-screenshot';
  requestClock?: 'node-performance';
  frames: {
    before?: InputPaintSnapshot;
    after?: InputPaintSnapshot;
    error?: string;
    request?: { startedAt: number; returnedAt?: number };
    pngBase64?: string;
  }[];
};
export function startInputPaint(
  page: Page,
  observe: () => Promise<InputPaintSnapshot>,
  options?: { timeoutMs?: number; ownsPage?: () => Promise<boolean> }
): { stop(): Promise<InputPaintRaw> };
export function finalizeInputPaint<T extends object>(
  freeze: () => Promise<T>,
  paint?: { stop(): Promise<InputPaintRaw> }
): Promise<T & { paintedCaret?: InputPaintRaw }>;
export function assessInputPaint(
  raw: unknown,
  contract: unknown,
  inputRaw: unknown
): {
  verdict: 'INCOMPLETE';
  evidenceLevel: 'painted-caret-candidates';
  continuousCaret: 'INCOMPLETE';
  presentedFrames: 'INCOMPLETE';
  candidates: {
    phase: string;
    start: number;
    end: number;
    frameIndexes: number[];
    transitions: number;
    pixelCount: number;
    rect: { x: number; y: number; width: number; height: number };
  }[];
  issues: { code: string; kind: 'incomplete'; phase?: string }[];
};

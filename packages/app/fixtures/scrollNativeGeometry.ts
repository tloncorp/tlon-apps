import type { ScrollSnapshot } from './scrollStabilityTrace';

export const MAX_NATIVE_GEOMETRY_ROWS = 128;
export type NativeGeometryRequest = {
  requestId: string;
  rootId: string;
  scrollViewId: string;
  composerId: string;
  rows: { key: string; id: string }[];
};
export type NativeGeometryBracket = {
  requestedAt: number;
  receivedAt: number;
  requiredKeys: string[];
  populated: boolean;
};
type Rect = { x: number; y: number; width: number; height: number };
type Insets = { top: number; right: number; bottom: number; left: number };
export type NativeGeometryView = {
  identity: string;
  windowIdentity: string;
  frame: Rect;
  clipFrame: Rect;
  attached: boolean;
  effectiveAlpha: number;
  hidden: boolean;
  translationOnly: boolean;
  descendantOfScroll: boolean;
  /** Opt-in fixture metadata committed on this same native view. */
  semanticValue?: string;
};
export type NativeGeometryCapture = {
  version: 1;
  requestId: string;
  rootId: string;
  scrollViewId: string;
  composerId: string;
  rowIds: string[];
  clock: 'CACurrentMediaTime milliseconds';
  coordinateSpace: 'window-model-points';
  startedAt: number;
  finishedAt: number;
  status: 'ok' | 'unavailable';
  issues: string[];
  visitedViews?: number;
  /** Complete tagged-host inventory from the same root walk, itinerary API only. */
  ownerHosts?: { id: string; identity: string }[];
  root?: NativeGeometryView;
  composer?: NativeGeometryView;
  scroll?: {
    view: NativeGeometryView;
    hostIdentity: string;
    offset: { x: number; y: number };
    contentSize: { width: number; height: number };
    bounds: Rect;
    contentInset: Insets;
    adjustedContentInset: Insets;
    zoomScale: number;
    tracking: boolean;
    dragging: boolean;
    decelerating: boolean;
  };
  rows?: { id: string; matches: number; view?: NativeGeometryView }[];
};

/** Validate acquisition, never whether the desired scroll outcome happened. */
export function adaptNativeScrollGeometry(
  input: unknown,
  request: NativeGeometryRequest,
  bracket: NativeGeometryBracket
): { snapshot: ScrollSnapshot; issues: string[] } {
  return adaptNativeGeometry(input, request, bracket, false);
}

/** Buffered observations use native operation time, without a fabricated JS receipt. */
export function adaptBufferedNativeScrollGeometry(
  input: NativeGeometryCapture,
  request: NativeGeometryRequest,
  conditions: Pick<NativeGeometryBracket, 'requiredKeys' | 'populated'> & {
    allowConcealedViewport?: boolean;
  }
): { snapshot: ScrollSnapshot; issues: string[] } {
  return adaptNativeGeometry(
    input,
    request,
    {
      ...conditions,
      requestedAt: input.startedAt,
      receivedAt: input.finishedAt,
    },
    true,
    conditions.allowConcealedViewport === true
  );
}

function adaptNativeGeometry(
  input: unknown,
  request: NativeGeometryRequest,
  bracket: NativeGeometryBracket,
  buffered: boolean,
  allowConcealedViewport = false
): { snapshot: ScrollSnapshot; issues: string[] } {
  const issues: string[] = [];
  const add = (issue: string) => issues.push(issue);
  const object = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
  const number = (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value);
  const text = (value: unknown): value is string =>
    typeof value === 'string' && value.length > 0;
  const rect = (value: unknown): value is Rect =>
    object(value) &&
    ['x', 'y', 'width', 'height'].every((k) => number(value[k])) &&
    (value.width as number) >= 0 &&
    (value.height as number) >= 0;
  const insets = (value: unknown): value is Insets =>
    object(value) &&
    ['top', 'right', 'bottom', 'left'].every((k) => number(value[k]));
  const view = (value: unknown): value is NativeGeometryView => {
    if (
      !object(value) ||
      !text(value.identity) ||
      !text(value.windowIdentity) ||
      !rect(value.frame) ||
      !rect(value.clipFrame) ||
      value.attached !== true ||
      typeof value.hidden !== 'boolean' ||
      value.translationOnly !== true ||
      typeof value.descendantOfScroll !== 'boolean' ||
      !number(value.effectiveAlpha) ||
      value.effectiveAlpha < 0 ||
      value.effectiveAlpha > 1
    )
      return false;
    const { frame: f, clipFrame: c } = value;
    return (
      c.width === 0 ||
      c.height === 0 ||
      (c.x >= f.x - 0.001 &&
        c.y >= f.y - 0.001 &&
        c.x + c.width <= f.x + f.width + 0.001 &&
        c.y + c.height <= f.y + f.height + 0.001)
    );
  };
  const exposed = (value: NativeGeometryView) =>
    !value.hidden &&
    value.effectiveAlpha > 0 &&
    value.frame.width > 0 &&
    value.frame.height > 0;
  const clippedArea = (value: NativeGeometryView) =>
    value.clipFrame.width > 0 && value.clipFrame.height > 0;
  const raw = object(input) ? input : {};
  const rowIds = request.rows.map((row) => row.id);
  const identifiers = [
    request.rootId,
    request.scrollViewId,
    request.composerId,
    ...rowIds,
  ];
  if (
    !text(request.requestId) ||
    identifiers.some((id) => !text(id)) ||
    new Set(identifiers).size !== identifiers.length ||
    rowIds.length > MAX_NATIVE_GEOMETRY_ROWS ||
    request.rows.some((row) => !text(row.key)) ||
    new Set(request.rows.map((row) => row.key)).size !== rowIds.length ||
    bracket.requiredKeys.some(
      (key) => !request.rows.some((row) => row.key === key)
    )
  )
    add('invalid-native-request');
  const duration = bracket.receivedAt - bracket.requestedAt;
  if (
    !number(bracket.requestedAt) ||
    !number(bracket.receivedAt) ||
    duration < 0 ||
    duration > 32
  )
    add(
      buffered
        ? 'invalid-buffered-native-interval'
        : 'invalid-native-js-bracket'
    );
  if (
    raw.version !== 1 ||
    raw.requestId !== request.requestId ||
    raw.rootId !== request.rootId ||
    raw.scrollViewId !== request.scrollViewId ||
    raw.composerId !== request.composerId ||
    JSON.stringify(raw.rowIds) !== JSON.stringify(rowIds)
  )
    add('native-request-identity-mismatch');
  if (
    raw.clock !== 'CACurrentMediaTime milliseconds' ||
    raw.coordinateSpace !== 'window-model-points'
  )
    add('invalid-native-coordinate-clock');
  if (
    !number(raw.startedAt) ||
    !number(raw.finishedAt) ||
    raw.startedAt < 0 ||
    raw.finishedAt < raw.startedAt ||
    raw.finishedAt - raw.startedAt > 32 ||
    raw.finishedAt - raw.startedAt > duration + 1
  )
    add('invalid-native-acquisition-time');
  if (
    raw.status !== 'ok' ||
    !Array.isArray(raw.issues) ||
    raw.issues.length !== 0
  )
    add('native-capture-unavailable');
  if (
    !Number.isInteger(raw.visitedViews) ||
    (raw.visitedViews as number) < 1 ||
    (raw.visitedViews as number) > 20000
  )
    add('invalid-native-traversal-count');
  const root = view(raw.root) ? raw.root : undefined;
  const composer = view(raw.composer) ? raw.composer : undefined;
  const scroll = object(raw.scroll) ? raw.scroll : undefined;
  const viewport = scroll && view(scroll.view) ? scroll.view : undefined;
  if (!root || !exposed(root) || !clippedArea(root)) add('invalid-native-root');
  if (
    !composer ||
    !exposed(composer) ||
    !clippedArea(composer) ||
    composer.descendantOfScroll
  )
    add('invalid-native-composer');
  if (
    !viewport ||
    (!allowConcealedViewport && !exposed(viewport)) ||
    viewport.frame.width <= 0 ||
    viewport.frame.height <= 0 ||
    !viewport.descendantOfScroll ||
    !clippedArea(viewport)
  )
    add('invalid-native-viewport');
  if (
    root &&
    (composer?.windowIdentity !== root.windowIdentity ||
      viewport?.windowIdentity !== root.windowIdentity)
  )
    add('native-window-mismatch');
  const validMetrics =
    scroll &&
    object(scroll.offset) &&
    number(scroll.offset.x) &&
    number(scroll.offset.y) &&
    object(scroll.contentSize) &&
    number(scroll.contentSize.width) &&
    scroll.contentSize.width >= 0 &&
    number(scroll.contentSize.height) &&
    scroll.contentSize.height >= 0 &&
    rect(scroll.bounds) &&
    scroll.bounds.height > 0 &&
    scroll.bounds.width > 0 &&
    insets(scroll.contentInset) &&
    insets(scroll.adjustedContentInset) &&
    scroll.zoomScale === 1 &&
    text(scroll.hostIdentity) &&
    ['tracking', 'dragging', 'decelerating'].every(
      (k) => typeof scroll[k] === 'boolean'
    ) &&
    Math.abs(scroll.bounds.x - scroll.offset.x) < 0.001 &&
    Math.abs(scroll.bounds.y - scroll.offset.y) < 0.001 &&
    !!viewport &&
    Math.abs(viewport.frame.height - scroll.bounds.height) < 0.001 &&
    Math.abs(viewport.frame.width - scroll.bounds.width) < 0.001;
  if (!validMetrics) add('invalid-native-scroll-metrics');
  const measured: ScrollSnapshot['rows'] = [];
  const identities = new Set<string>();
  if (!Array.isArray(raw.rows) || raw.rows.length !== rowIds.length)
    add('invalid-native-row-inventory');
  for (const [index, expected] of request.rows.entries()) {
    const row = Array.isArray(raw.rows) ? raw.rows[index] : undefined;
    if (
      !object(row) ||
      row.id !== expected.id ||
      !Number.isInteger(row.matches) ||
      (row.matches !== 0 && row.matches !== 1)
    ) {
      add('invalid-native-row-identity');
      continue;
    }
    if (row.matches === 0) {
      if (row.view !== undefined) add('invalid-native-missing-row');
      if (bracket.requiredKeys.includes(expected.key))
        add('missing-required-native-row');
      continue;
    }
    if (
      !view(row.view) ||
      !row.view.descendantOfScroll ||
      row.view.windowIdentity !== root?.windowIdentity ||
      identities.has(row.view.identity)
    ) {
      add('invalid-native-row-owner');
      continue;
    }
    identities.add(row.view.identity);
    if (!exposed(row.view) && !allowConcealedViewport) {
      if (bracket.requiredKeys.includes(expected.key))
        add('hidden-required-native-row');
      continue;
    }
    if (row.view.frame.width <= 0 || row.view.frame.height <= 0) {
      add('invalid-native-row-size');
      continue;
    }
    measured.push({
      key: expected.key,
      y: row.view.frame.y,
      height: row.view.frame.height,
    });
  }
  if (bracket.populated && measured.length === 0)
    add('populated-native-list-without-rows');
  const data = validMetrics
    ? (scroll as unknown as NonNullable<NativeGeometryCapture['scroll']>)
    : undefined;
  const viewportTop = viewport?.clipFrame.y ?? 0;
  const viewportHeight = data?.bounds.height ?? 0;
  const clipBottom = viewport
    ? viewport.clipFrame.y + viewport.clipFrame.height
    : viewportTop;
  const overlaps =
    viewport &&
    composer &&
    composer.frame.x < viewport.frame.x + viewport.frame.width &&
    composer.frame.x + composer.frame.width > viewport.frame.x;
  const viewportBottom = overlaps
    ? Math.min(clipBottom, composer.frame.y)
    : clipBottom;
  // Preserve full row origins/heights, but never let unclipped bounds prove
  // visibility when a native clipping ancestor actually hides that region.
  if (viewport && Array.isArray(raw.rows)) {
    for (const row of raw.rows) {
      if (!object(row) || !view(row.view) || !exposed(row.view)) continue;
      const { frame: f, clipFrame: c } = row.view;
      const expectedHeight = Math.max(
        0,
        Math.min(f.y + f.height, viewportBottom) - Math.max(f.y, viewportTop)
      );
      const clippedHeight = Math.max(
        0,
        Math.min(c.y + c.height, viewportBottom) - Math.max(c.y, viewportTop)
      );
      const horizontal =
        Math.min(
          c.x + c.width,
          viewport.clipFrame.x + viewport.clipFrame.width
        ) - Math.max(c.x, viewport.clipFrame.x);
      if (
        expectedHeight > 0 &&
        (horizontal <= 0 || clippedHeight + 0.001 < expectedHeight)
      )
        add('native-row-clipping-disagrees-with-viewport');
      if (
        clippedArea(row.view) &&
        (c.x < viewport.clipFrame.x - 0.001 ||
          c.y < viewport.clipFrame.y - 0.001 ||
          c.x + c.width >
            viewport.clipFrame.x + viewport.clipFrame.width + 0.001 ||
          c.y + c.height >
            viewport.clipFrame.y + viewport.clipFrame.height + 0.001)
      )
        add('native-row-clip-outside-scroll');
    }
  }
  if (viewportBottom <= viewportTop) add('occluded-native-viewport');
  const min = data ? -data.adjustedContentInset.top : 0;
  const max = data
    ? Math.max(
        min,
        data.contentSize.height -
          data.bounds.height +
          data.adjustedContentInset.bottom
      )
    : 0;
  const offset = data?.offset.y ?? 0;
  return {
    issues: [...new Set(issues)],
    snapshot: {
      time: bracket.receivedAt,
      scroll: offset,
      contentLength: data?.contentSize.height ?? 0,
      viewportHeight,
      viewportTop,
      viewportBottom,
      keyboardHeight: Math.max(0, clipBottom - viewportBottom),
      nearEnd: max - offset <= 1,
      rows: measured,
      ...(data ? { scrollBounds: { min, max } } : {}),
      measurement: { valid: issues.length === 0, durationMs: duration },
      acquisition: {
        registeredRowCount: request.rows.length,
        selectedRowCount: request.rows.length,
        measuredRowCount: measured.length,
        visibleMeasuredRowCount: measured.filter(
          (row) => row.y < viewportBottom && row.y + row.height > viewportTop
        ).length,
        nativeMetricsReceivedAt: null,
        nativeMetricsAgeMs: null,
        nativeGeometry: {
          ...(buffered
            ? { source: 'ios-buffered-main-thread-model-v1' as const }
            : { source: 'ios-main-thread-model-v1' as const, bracket }),
          request,
          capture: input,
          issues: [...new Set(issues)],
          nativePresentation: 'INCOMPLETE',
        },
      },
    },
  };
}

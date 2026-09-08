import type { ScrollSnapshot } from './scrollStabilityTrace';

export const MAX_NATIVE_GEOMETRY_ROWS = 128;
export type NativeGeometryRequest = {
  requestId: string;
  rootId: string;
  scrollViewId: string;
  composerId: string;
  rows: { key: string; id: string }[];
};
/** Declared before one stationary mounted-owner capture, never inferred from rows. */
export type NativeSampledRulerContract = {
  version: 'indexed-cell-and-surfaces-v2';
  scope: string;
  rootId: string;
  scrollViewId: string;
  composerId: string;
};
export type NativeGeometryBracket = {
  requestedAt: number;
  receivedAt: number;
  requiredKeys: string[];
  populated: boolean;
  /** Future sampled acquisition only; omission preserves historical geometry. */
  ruler?: Pick<NativeSampledRulerContract, 'version' | 'scope'>;
};
type Rect = { x: number; y: number; width: number; height: number };
type Insets = { top: number; right: number; bottom: number; left: number };
export type NativeGeometryView = {
  /** Additive diagnostic native lifetime; older readers do not require it. */
  lifetimeIdentity?: string;
  identity: string;
  windowIdentity: string;
  frame: Rect;
  clipFrame: Rect;
  /** Exact bounds used for this native window conversion; null if invalidated. */
  localBounds?: Rect | null;
  attached: boolean;
  effectiveAlpha: number;
  hidden: boolean;
  translationOnly: boolean;
  descendantOfScroll: boolean;
  /** Opt-in fixture metadata committed on this same native view. */
  semanticValue?: string;
  containingCellIdentity?: string;
};
/** Derived only from one validated native walk; not a presentation claim. */
export type NativeSampledRulerObservation = {
  version: 'indexed-cell-and-surfaces-v2';
  scope: string;
  cells: (NativeGeometryView & { key: string })[];
  surfaces: (NativeGeometryView & { id: string })[];
  obscuredKeys: string[];
  latestControlVisible: boolean;
};
export type NativeGeometryInventoryItem = {
  id: string;
  matches: number;
  view?: NativeGeometryView;
};
export type NativeGeometryRuler = {
  version: 1;
  cells: NativeGeometryInventoryItem[];
  manifest: NativeGeometryInventoryItem;
  surfaces: NativeGeometryInventoryItem[];
};
export type NativeGeometryCapture = {
  /** Additive same-operation shape evidence; older captures remain legacy. */
  localBoundsVersion?: 1;
  /** Opt-in native diagnostics, validated by version-specific readers only. */
  nativeReading?: unknown;
  version: 1;
  requestId: string;
  rootId: string;
  scrollViewId: string;
  composerId: string;
  rowIds: string[];
  ruler?: NativeGeometryRuler;
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

/**
 * Associate a thinking request with a measured trailing-region change. Callback
 * receipt can precede the previous snapshot's receipt while its native walk
 * still contains the old layout. No callback supplies geometry here.
 */
export function nativeThinkingGestureExtentIsMeasured(
  previous: ScrollSnapshot,
  current: ScrollSnapshot,
  events: readonly {
    time: number;
    name: string;
    values?: Record<string, number | string | boolean>;
  }[],
  loadedKeys: readonly string[]
): boolean {
  const object = (x: unknown): x is Record<string, any> =>
    x !== null && typeof x === 'object' && !Array.isArray(x);
  const text = (x: unknown): x is string =>
    typeof x === 'string' && x.length > 0;
  const canonical = (value: any): any =>
    Array.isArray(value)
      ? value.map(canonical)
      : object(value)
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, canonical(value[key])])
          )
        : value;
  const same = (a: unknown, b: unknown) =>
    JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
  const close = (a: number, b: number) =>
    Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= 1;
  if (
    !Array.isArray(loadedKeys) ||
    !Array.isArray(events) ||
    !loadedKeys.length ||
    loadedKeys.some((key) => !text(key)) ||
    new Set(loadedKeys).size !== loadedKeys.length ||
    !Number.isFinite(previous.time) ||
    !Number.isFinite(current.time) ||
    current.time <= previous.time ||
    current.time - previous.time > 125
  )
    return false;
  const tailKey = loadedKeys[loadedKeys.length - 1];
  const read = (sample: ScrollSnapshot) => {
    const evidence = sample.acquisition?.nativeGeometry;
    const coherent = sample.acquisition?.jsCoherence;
    if (
      evidence?.source !== 'ios-main-thread-model-v1' ||
      !sample.measurement?.valid ||
      sample.measurement.durationMs > 32 ||
      !coherent ||
      ![
        coherent.coherent,
        coherent.listPresent,
        coherent.listIdentityStable,
        coherent.composerIdentityStable,
        coherent.requiredRowsStable,
        coherent.scopeStable,
        coherent.membershipStable,
        coherent.semanticStable,
      ].every((value) => value === true) ||
      !same(coherent.before.keys, loadedKeys) ||
      !same(coherent.after.keys, loadedKeys) ||
      coherent.before.scope !== coherent.after.scope ||
      evidence.bracket.ruler?.scope !== coherent.before.scope ||
      evidence.bracket.receivedAt !== sample.time
    )
      return;
    const adapted = adaptNativeScrollGeometry(
      evidence.capture,
      evidence.request,
      evidence.bracket
    );
    if (
      adapted.issues.length ||
      !adapted.snapshot.measurement?.valid ||
      adapted.snapshot.measurement.durationMs > 32 ||
      adapted.snapshot.scroll !== sample.scroll ||
      adapted.snapshot.contentLength !== sample.contentLength
    )
      return;
    const raw = evidence.capture as NativeGeometryCapture;
    const native = raw.nativeReading;
    if (
      !object(native) ||
      !Number.isSafeInteger(native.generation) ||
      native.generation < 0 ||
      !Number.isSafeInteger(native.surface) ||
      native.surface < 1 ||
      !object(native.committedMembership) ||
      !object(native.rowBindings)
    )
      return;
    const membership = native.committedMembership,
      bindings = native.rowBindings;
    if (
      membership.version !== 1 ||
      membership.status !== 'ok' ||
      bindings.version !== 1 ||
      bindings.status !== 'ok' ||
      !['scopeIdentity', 'scope', 'visit', 'dataRevision'].every(
        (key) => text(membership[key]) && membership[key] === bindings[key]
      ) ||
      !Array.isArray(membership.rows) ||
      !same(
        membership.rows.map((row: any) => row?.key),
        loadedKeys
      ) ||
      membership.rows.some((row: any) => !text(row?.revision)) ||
      !Array.isArray(bindings.rows) ||
      new Set(bindings.rows.map((row: any) => row?.key)).size !==
        bindings.rows.length
    )
      return;
    const matches = bindings.rows.filter((row: any) => row?.key === tailKey);
    const bound = matches[0];
    const row = raw.rows?.find((item) => item.id === `scroll-row-${tailKey}`);
    const cell =
      adapted.snapshot.acquisition?.nativeGeometry?.ruler?.cells.find(
        (item) => item.key === tailKey
      );
    if (
      matches.length !== 1 ||
      bound.status !== 'ok' ||
      bound.fixtureScope !== coherent.before.scope ||
      bound.rowId !== row?.id ||
      bound.cellId !== `scroll-cell-${tailKey}` ||
      bound.revision !== membership.rows[membership.rows.length - 1].revision ||
      row?.matches !== 1 ||
      !row.view ||
      !cell ||
      bound.rowViewIdentity !== row.view.lifetimeIdentity ||
      bound.cellViewIdentity !== cell.lifetimeIdentity ||
      ![
        'rowViewIdentity',
        'cellViewIdentity',
        'registrationIdentity',
        'hostIdentity',
      ].every((key) => text(bound[key])) ||
      new Set(
        [
          'rowViewIdentity',
          'cellViewIdentity',
          'registrationIdentity',
          'hostIdentity',
        ].map((key) => bound[key])
      ).size !== 4 ||
      row.view.containingCellIdentity !== cell.identity ||
      row.view.hidden ||
      row.view.effectiveAlpha <= 0 ||
      cell.hidden ||
      cell.effectiveAlpha <= 0 ||
      !raw.root ||
      !raw.composer ||
      !raw.scroll ||
      ![raw.root, raw.composer, raw.scroll.view].every((view) =>
        text(view.lifetimeIdentity)
      )
    )
      return;
    const scroll = raw.scroll;
    const contentY = cell.frame.y - scroll.view.frame.y + scroll.offset.y;
    const trailing = scroll.contentSize.height - contentY - cell.frame.height;
    if (!Number.isFinite(trailing) || trailing < -1) return;
    const physical = (view: NativeGeometryView) => [
      view.identity,
      view.lifetimeIdentity,
      view.windowIdentity,
      view.frame,
      view.clipFrame,
      view.hidden,
      view.effectiveAlpha,
    ];
    return {
      evidence,
      startedAt: raw.startedAt,
      finishedAt: raw.finishedAt,
      scope: membership.scope,
      trailing,
      contentY,
      cell,
      // Exact native owner, loaded order/incarnations and surrounding layout.
      owner: [
        native.generation,
        native.surface,
        membership.scopeIdentity,
        membership.scope,
        membership.visit,
        membership.dataRevision,
        membership.rows,
        bound.rowViewIdentity,
        bound.cellViewIdentity,
        bound.registrationIdentity,
        bound.hostIdentity,
        cell.identity,
        cell.semanticValue,
        row.view.identity,
        row.view.semanticValue,
        physical(raw.root),
        physical(raw.composer),
        physical(scroll.view),
        scroll.hostIdentity,
        scroll.bounds.x,
        scroll.bounds.width,
        scroll.bounds.height,
        scroll.offset.x,
        scroll.contentSize.width,
        scroll.contentInset,
        scroll.adjustedContentInset,
        scroll.tracking,
        scroll.dragging,
        scroll.decelerating,
        adapted.snapshot.acquisition?.nativeGeometry?.ruler?.surfaces.map(
          (view) => [view.id, physical(view), view.clipFrame]
        ),
      ],
    };
  };
  const before = read(previous),
    after = read(current);
  if (
    !before ||
    !after ||
    !same(before.owner, after.owner) ||
    before.evidence.request.requestId === after.evidence.request.requestId ||
    after.startedAt < before.finishedAt ||
    after.evidence.bracket.requestedAt < before.evidence.bracket.receivedAt ||
    !close(before.contentY, after.contentY) ||
    !close(before.cell.frame.x, after.cell.frame.x) ||
    !close(before.cell.frame.width, after.cell.frame.width) ||
    !close(before.cell.frame.height, after.cell.frame.height)
  )
    return false;
  const start = before.evidence.bracket.requestedAt;
  if (
    !Number.isFinite(start) ||
    events.some(
      (event, i) =>
        !Number.isFinite(event.time) ||
        (i > 0 && event.time < events[i - 1].time)
    )
  )
    return false;
  const interval = events.filter(
    (event) => event.time >= start && event.time <= current.time
  );
  if (
    interval.some((event) =>
      /^(reset|position|list-attached|list-detached|center-command-request|offscreen-command-request|local-send|media-open|reference-open|drag-begin|drag-end|momentum-begin|momentum-end)$/.test(
        event.name
      )
    )
  )
    return false;
  const requests = interval.filter(
    (event) => event.name === 'thinking-request'
  );
  if (
    requests.length !== 1 ||
    requests[0].values?.layoutChange !== true ||
    typeof requests[0].values?.visible !== 'boolean' ||
    (requests[0].values?.visible && !text(requests[0].values?.label))
  )
    return false;
  const request = requests[0],
    visible = request.values!.visible;
  const from = visible ? 0 : 52,
    to = visible ? 52 : 0;
  const layouts = interval.filter((event) => event.name === 'thinking-layout');
  const commits = interval.filter((event) => event.name === 'thinking-commit');
  if (
    layouts.length !== 1 ||
    commits.length !== 1 ||
    layouts[0].time < request.time ||
    commits[0].time < request.time ||
    layouts[0].values?.conversationId !== before.scope ||
    commits[0].values?.conversationId !== before.scope ||
    layouts[0].values?.height !== to ||
    commits[0].values?.visible !== visible ||
    (visible && commits[0].values?.label !== request.values?.label)
  )
    return false;
  return (
    close(before.trailing, from) &&
    close(after.trailing, to) &&
    close(current.contentLength - previous.contentLength, to - from)
  );
}

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
  const rulerContract = bracket.ruler;
  const useSampledRuler =
    !buffered &&
    object(rulerContract) &&
    rulerContract.version === 'indexed-cell-and-surfaces-v2' &&
    text(rulerContract.scope);
  if (rulerContract !== undefined && !useSampledRuler)
    add('invalid-native-sampled-ruler-contract');
  let ruled: ReturnType<typeof adaptNativeEntryRuler> | undefined;
  if (useSampledRuler) {
    if (request.rows.some((row) => row.id !== `scroll-row-${row.key}`))
      add('native-ruler-request-key-mismatch');
    // The shared entry reader expects structured native rows and metrics. Keep
    // malformed captures INCOMPLETE before calling it, without guessing frames.
    const r = object(raw.ruler) ? raw.ruler : undefined;
    const inventoryShape = (items: unknown) =>
      Array.isArray(items) &&
      items.every((item) => object(item) && text(item.id));
    if (
      !data ||
      !viewport ||
      !inventoryShape(raw.rows) ||
      !r ||
      !inventoryShape(r.cells) ||
      !inventoryShape(r.surfaces)
    ) {
      add('missing-or-invalid-native-entry-ruler');
    } else {
      ruled = adaptNativeEntryRuler(
        raw as unknown as NativeGeometryCapture,
        rulerContract.scope,
        'indexed-cell-and-surfaces-v2'
      );
      issues.push(...ruled.issues);
    }
  }
  const viewportTop = ruled?.viewportTop ?? viewport?.clipFrame.y ?? 0;
  const viewportHeight = data?.bounds.height ?? 0;
  const clipBottom = viewport
    ? viewport.clipFrame.y + viewport.clipFrame.height
    : viewportTop;
  const overlaps =
    viewport &&
    composer &&
    composer.frame.x < viewport.frame.x + viewport.frame.width &&
    composer.frame.x + composer.frame.width > viewport.frame.x;
  const viewportBottom =
    ruled?.viewportBottom ??
    (overlaps ? Math.min(clipBottom, composer.frame.y) : clipBottom);
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
      const expectedWidth = Math.max(
        0,
        Math.min(
          f.x + f.width,
          viewport.clipFrame.x + viewport.clipFrame.width
        ) - Math.max(f.x, viewport.clipFrame.x)
      );
      if (
        expectedHeight > 0 &&
        (horizontal <= 0 ||
          clippedHeight + 0.001 < expectedHeight ||
          (useSampledRuler && horizontal + 0.001 < expectedWidth))
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
  let sampledRuler: NativeSampledRulerObservation | undefined;
  if (ruled && useSampledRuler && viewport) {
    const geometry = raw as unknown as NativeGeometryCapture;
    const surfaces = (geometry.ruler?.surfaces ?? []).flatMap((item) =>
      item.view && ruled.surfaces.includes(item.view)
        ? [{ id: item.id, ...item.view }]
        : []
    );
    const obscuredKeys = request.rows.flatMap((expected, index) => {
      const inner = geometry.rows?.[index]?.view;
      if (!inner || !view(inner) || !exposed(inner)) return [];
      const c = inner.clipFrame;
      const left = Math.max(c.x, viewport.clipFrame.x);
      const right = Math.min(
        c.x + c.width,
        viewport.clipFrame.x + viewport.clipFrame.width
      );
      const top = Math.max(c.y, viewportTop);
      const bottom = Math.min(c.y + c.height, viewportBottom);
      return surfaces.some(
        ({ clipFrame: surface }) =>
          Math.min(right, surface.x + surface.width) >
            Math.max(left, surface.x) &&
          Math.min(bottom, surface.y + surface.height) >
            Math.max(top, surface.y)
      )
        ? [expected.key]
        : [];
    });
    sampledRuler = {
      version: 'indexed-cell-and-surfaces-v2',
      scope: rulerContract.scope,
      cells: [...ruled.cells].map(([key, cell]) => ({ key, ...cell })),
      surfaces,
      obscuredKeys,
      latestControlVisible: surfaces.some(
        (surface) => surface.id === 'scroll-surface-latest'
      ),
    };
  }
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
          ...(sampledRuler ? { ruler: sampledRuler } : {}),
          issues: [...new Set(issues)],
          nativePresentation: 'INCOMPLETE',
        },
      },
    },
  };
}

/** Additional opt-in roles; historical wrapper geometry is never rewritten. */
export function adaptNativeEntryRuler(
  raw: NativeGeometryCapture,
  scope: string,
  contract:
    | 'indexed-cell-and-surfaces-v1'
    | 'indexed-cell-and-surfaces-v2' = 'indexed-cell-and-surfaces-v1'
) {
  const issues: string[] = [];
  const add = (code: string) => issues.push(code);
  const object = (x: unknown): x is Record<string, unknown> =>
    x !== null && typeof x === 'object' && !Array.isArray(x);
  const finite = (x: unknown): x is number =>
    typeof x === 'number' && Number.isFinite(x);
  const rectangle = (x: unknown): x is Rect =>
    object(x) &&
    [x.x, x.y, x.width, x.height].every(finite) &&
    Number(x.width) >= 0 &&
    Number(x.height) >= 0;
  const inside = (inner: Rect, outer: Rect) =>
    inner.x >= outer.x - 0.001 &&
    inner.y >= outer.y - 0.001 &&
    inner.x + inner.width <= outer.x + outer.width + 0.001 &&
    inner.y + inner.height <= outer.y + outer.height + 0.001;
  const validView = (
    x: unknown,
    descendant: boolean
  ): x is NativeGeometryView =>
    object(x) &&
    typeof x.identity === 'string' &&
    x.identity.length > 0 &&
    x.windowIdentity === raw.scroll?.view.windowIdentity &&
    x.attached === true &&
    x.translationOnly === true &&
    x.descendantOfScroll === descendant &&
    typeof x.hidden === 'boolean' &&
    finite(x.effectiveAlpha) &&
    x.effectiveAlpha >= 0 &&
    x.effectiveAlpha <= 1 &&
    rectangle(x.frame) &&
    rectangle(x.clipFrame) &&
    (x.clipFrame.width === 0 ||
      x.clipFrame.height === 0 ||
      inside(x.clipFrame, x.frame));
  const exposed = (v: NativeGeometryView) =>
    !v.hidden &&
    v.effectiveAlpha > 0 &&
    v.clipFrame.width > 0 &&
    v.clipFrame.height > 0;
  const parse = (value: string | undefined): unknown => {
    try {
      return JSON.parse(value ?? '');
    } catch {
      return undefined;
    }
  };
  const validNativeSignature = (value: unknown) =>
    object(value) &&
    typeof value.content === 'string' &&
    typeof value.reactions === 'string' &&
    finite(value.replies) &&
    Number.isInteger(value.replies) &&
    value.replies >= 0;
  const r = raw.ruler;
  const cells = new Map<string, NativeGeometryView>();
  const surfaces: NativeGeometryView[] = [];
  const scroll = raw.scroll;
  const viewportTop = scroll
    ? Math.max(
        scroll.view.clipFrame.y,
        scroll.view.frame.y + Math.max(0, scroll.adjustedContentInset.top)
      )
    : NaN;
  const viewportBottom = scroll
    ? Math.min(
        scroll.view.clipFrame.y + scroll.view.clipFrame.height,
        scroll.view.frame.y +
          scroll.view.frame.height -
          Math.max(0, scroll.adjustedContentInset.bottom)
      )
    : NaN;
  if (
    !finite(viewportTop) ||
    !finite(viewportBottom) ||
    viewportBottom <= viewportTop
  )
    add('invalid-native-ruler-reserved-region');
  if (
    !r ||
    r.version !== 1 ||
    !Array.isArray(r.cells) ||
    r.cells.length > 128 ||
    !Array.isArray(r.surfaces) ||
    r.surfaces.length > 16
  ) {
    add('missing-or-invalid-native-entry-ruler');
    return { issues, cells, surfaces, viewportTop, viewportBottom };
  }
  const identities = new Set<string>();
  const inventory = (
    items: NativeGeometryInventoryItem[],
    descendant: boolean,
    prefix: string
  ) => {
    const ids = new Set<string>();
    for (const item of items) {
      if (
        !object(item) ||
        typeof item.id !== 'string' ||
        !item.id.startsWith(prefix) ||
        ids.has(item.id) ||
        item.matches !== 1 ||
        !validView(item.view, descendant) ||
        identities.has(item.view.identity)
      ) {
        add('invalid-native-ruler-inventory');
        continue;
      }
      ids.add(item.id);
      identities.add(item.view.identity);
    }
    return ids;
  };
  const cellIds = inventory(r.cells, true, 'scroll-cell-');
  const surfaceIds = inventory(r.surfaces, false, 'scroll-surface-');
  const manifest = r.manifest;
  if (
    !manifest ||
    manifest.id !== 'scroll-surface-manifest' ||
    manifest.matches !== 1 ||
    !validView(manifest.view, false) ||
    identities.has(manifest.view.identity)
  )
    add('invalid-native-ruler-manifest');
  const metadata = parse(manifest?.view?.semanticValue);
  if (
    !object(metadata) ||
    metadata.version !== 1 ||
    metadata.scope !== scope ||
    !Array.isArray(metadata.surfaceIds) ||
    metadata.surfaceIds.some((id) => typeof id !== 'string') ||
    new Set(metadata.surfaceIds).size !== metadata.surfaceIds.length ||
    !metadata.surfaceIds.includes('scroll-surface-body') ||
    metadata.surfaceIds.length !== surfaceIds.size ||
    metadata.surfaceIds.some((id) => !surfaceIds.has(id))
  )
    add('native-ruler-surface-manifest-mismatch');
  const allowed = new Set([
    'scroll-surface-body',
    'scroll-surface-back',
    'scroll-surface-cancel',
    'scroll-surface-attachment',
    'scroll-surface-latest',
  ]);
  if ([...surfaceIds].some((id) => !allowed.has(id)))
    add('unqualified-native-ruler-surface');
  for (const surface of r.surfaces) {
    if (surface.matches === 1 && validView(surface.view, false)) {
      if (!exposed(surface.view)) add('native-ruler-surface-not-exposed');
      else surfaces.push(surface.view);
    }
  }
  const rows = raw.rows ?? [];
  if (cellIds.size !== rows.length || r.cells.length !== rows.length)
    add('native-ruler-cell-inventory-mismatch');
  for (const row of rows) {
    const key = row.id.slice('scroll-row-'.length);
    const item = r.cells.find((cell) => cell.id === `scroll-cell-${key}`);
    if (
      !item ||
      item.matches !== 1 ||
      !validView(item.view, true) ||
      !validView(row.view, true)
    ) {
      add('native-ruler-cell-missing');
      continue;
    }
    const cell = item.view;
    const inner = row.view;
    const cellMetadata = parse(cell.semanticValue);
    const innerMetadata = parse(inner.semanticValue);
    if (
      !object(cellMetadata) ||
      !object(innerMetadata) ||
      cellMetadata.version !== 1 ||
      (contract === 'indexed-cell-and-surfaces-v2' &&
        (innerMetadata.version !== 1 ||
          !validNativeSignature(innerMetadata.signature) ||
          !validNativeSignature(cellMetadata.signature))) ||
      cellMetadata.scope !== scope ||
      cellMetadata.key !== key ||
      innerMetadata.scope !== scope ||
      innerMetadata.key !== key ||
      JSON.stringify(cellMetadata.signature) !==
        JSON.stringify(innerMetadata.signature)
    ) {
      add('native-ruler-cell-revision-mismatch');
      continue;
    }
    if (
      inner.containingCellIdentity !== cell.identity ||
      cell.containingCellIdentity !== cell.identity ||
      // V1 intentionally retains its historical strict geometric contract.
      // V2 ancestry is measured independently; a non-clipping cell may have
      // legitimate inner overflow, whose actual exposure is checked separately.
      (contract === 'indexed-cell-and-surfaces-v1' &&
        !inside(inner.frame, cell.frame)) ||
      (exposed(inner) && !exposed(cell))
    ) {
      add('native-ruler-inner-cell-association-mismatch');
      continue;
    }
    cells.set(key, cell);
  }
  return {
    issues: [...new Set(issues)],
    cells,
    surfaces,
    viewportTop,
    viewportBottom,
  };
}

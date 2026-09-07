import type {
  adaptBufferedNativeScrollGeometry,
  NativeGeometryCapture,
  NativeGeometryRequest,
} from './scrollNativeGeometry';
import type { ScrollSnapshot } from './scrollStabilityTrace';

export type NativeRecordingRequest = {
  rootId: string;
  scrollViewId: string;
  composerId: string;
  rowPrefix: 'scroll-row-';
  durationMs: number;
  maximumFrames: number;
};

export type NativeRecordingItinerary = {
  version: 1;
  owners: [
    { rootId: string; scope: string; scrollViewId: string },
    {
      rootId: string;
      scope: string;
      scrollViewPrefix: 'tlon-conversation-scroll-edge-content-';
    },
  ];
};

export type NativeRecordingContract = {
  recordingId: string;
  request: NativeRecordingRequest;
  scope: string;
  requiredKeys: string[];
  populated: boolean;
  visibility: 'require-visible' | 'observe-entry-concealment';
  minimumDurationMs: number;
  itinerary?: NativeRecordingItinerary;
};

export type NativeRowRevision = {
  version: 1;
  scope: string;
  key: string;
  signature: { content: string; reactions: string; replies: number };
};

export type NativeRecording = {
  version: 1;
  recordingId: string;
  request: NativeRecordingRequest;
  itinerary?: NativeRecordingItinerary;
  clock: 'CACurrentMediaTime milliseconds';
  coordinateSpace: 'window-model-points';
  startedAt: number;
  stoppedAt: number;
  stopReason: 'requested' | 'deadline' | 'capacity';
  nativePresentation: 'INCOMPLETE';
  frames: {
    sequence: number;
    trigger: 'start' | 'display-link';
    displayLinkTimestamp?: number;
    displayLinkTargetTimestamp?: number;
    geometry: NativeGeometryCapture;
    owner?: {
      index: number;
      scope: string;
      rootId: string;
      scrollViewId: string;
    };
  }[];
  markers: { sequence: number; name: string; time: number }[];
};

const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const text = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;
const strings = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.every(text) &&
  new Set(value).size === value.length;
const canonical = (value: unknown): unknown =>
  Array.isArray(value)
    ? value.map(canonical)
    : object(value)
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, item]) => [key, canonical(item)])
        )
      : value;
const equal = (left: unknown, right: unknown) =>
  JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
const parse = (value: unknown): unknown => {
  if (typeof value !== 'string') return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

/** Acquisition qualification only; COMPLETE does not assert a scrolling outcome. */
export function assessNativeRecording(
  raw: unknown,
  contract: NativeRecordingContract,
  adaptGeometry: typeof adaptBufferedNativeScrollGeometry
) {
  const issues: { code: string; frame?: number }[] = [];
  const add = (code: string, frame?: number) => issues.push({ code, frame });
  const samples: ScrollSnapshot[] = [];
  const exposureSamples: {
    time: number;
    viewportVisible: boolean;
    visibleRequiredKeys: string[];
  }[] = [];
  const semanticSamples: {
    time: number;
    rows: NativeRowRevision[];
    requestedKeys: string[];
  }[] = [];
  const ownerSamples: {
    frame: number;
    sampleIndex: number;
    time: number;
    index: number;
    scope: string;
    rootIdentity: string;
    scrollIdentity: string;
    viewportVisible: boolean;
  }[] = [];
  let firstExposedDestinationFrame: number | null = null;
  let firstContentDestinationFrame: number | null = null;
  if (!object(raw)) {
    return {
      verdict: 'INCOMPLETE' as const,
      issues: [{ code: 'missing-native-recording' }],
      samples,
      semanticSamples,
      exposureSamples,
      ownerSamples,
      firstExposedDestinationFrame,
      firstContentDestinationFrame,
    };
  }
  const request = contract.request;
  const itinerary = contract.itinerary;
  const validItinerary =
    !itinerary ||
    (itinerary.version === 1 &&
      Array.isArray(itinerary.owners) &&
      itinerary.owners.length === 2 &&
      itinerary.owners.every(
        (owner) =>
          object(owner) &&
          text(owner.rootId) &&
          text(owner.scope) &&
          Object.keys(owner).length === 3
      ) &&
      itinerary.owners[0].rootId === request.rootId &&
      itinerary.owners[1].rootId === request.rootId &&
      itinerary.owners[0].scope === contract.scope &&
      itinerary.owners[1].scope !== contract.scope &&
      itinerary.owners[0].scrollViewId === request.scrollViewId &&
      itinerary.owners[1].scrollViewPrefix ===
        'tlon-conversation-scroll-edge-content-' &&
      contract.visibility === 'observe-entry-concealment');
  if (!validItinerary || !equal(raw.itinerary, itinerary))
    add('invalid-native-owner-itinerary');
  if (
    !text(contract.recordingId) ||
    !text(contract.scope) ||
    ![request.rootId, request.scrollViewId, request.composerId].every(text) ||
    new Set([request.rootId, request.scrollViewId, request.composerId]).size !==
      3 ||
    request.rowPrefix !== 'scroll-row-' ||
    !finite(request.durationMs) ||
    request.durationMs < 100 ||
    request.durationMs > 15_000 ||
    !Number.isInteger(request.maximumFrames) ||
    request.maximumFrames < 3 ||
    request.maximumFrames > 900 ||
    !strings(contract.requiredKeys) ||
    typeof contract.populated !== 'boolean' ||
    !['require-visible', 'observe-entry-concealment'].includes(
      contract.visibility
    ) ||
    !finite(contract.minimumDurationMs) ||
    contract.minimumDurationMs < 100 ||
    contract.minimumDurationMs > request.durationMs
  )
    add('invalid-native-recording-contract');
  if (
    raw.version !== 1 ||
    raw.recordingId !== contract.recordingId ||
    raw.clock !== 'CACurrentMediaTime milliseconds' ||
    raw.coordinateSpace !== 'window-model-points' ||
    raw.nativePresentation !== 'INCOMPLETE' ||
    !object(raw.request) ||
    Object.keys(request).some(
      (key) =>
        (raw.request as Record<string, unknown>)[key] !==
        request[key as keyof NativeRecordingRequest]
    )
  )
    add('native-recording-identity-mismatch');
  if (
    !finite(raw.startedAt) ||
    !finite(raw.stoppedAt) ||
    raw.startedAt < 0 ||
    raw.stoppedAt - raw.startedAt < contract.minimumDurationMs ||
    raw.stoppedAt - raw.startedAt > request.durationMs + 125 ||
    !['requested', 'deadline'].includes(String(raw.stopReason))
  )
    add('invalid-native-recording-lifetime');
  if (
    !Array.isArray(raw.frames) ||
    raw.frames.length < 3 ||
    raw.frames.length > request.maximumFrames
  ) {
    add('invalid-native-recording-frames');
    return {
      verdict: 'INCOMPLETE' as const,
      issues,
      samples,
      semanticSamples,
      exposureSamples,
      ownerSamples,
      firstExposedDestinationFrame,
      firstContentDestinationFrame,
    };
  }
  let previous: NativeGeometryCapture | undefined;
  let rootIdentity: string | undefined;
  let scrollIdentity: string | undefined;
  const requiredIdentities = new Map<string, string>();
  const ownerIdentities = new Map<
    number,
    { root: string; scroll: string; host: string; tag: string }
  >();
  let lastOwnerIndex = -1;
  for (const [index, candidate] of raw.frames.entries()) {
    const issueCountBeforeFrame = issues.length;
    if (!object(candidate) || !object(candidate.geometry)) {
      add('missing-native-recording-frame', index);
      continue;
    }
    const geometry = candidate.geometry as unknown as NativeGeometryCapture;
    if (
      candidate.sequence !== index ||
      candidate.trigger !== (index === 0 ? 'start' : 'display-link')
    )
      add('native-recording-sequence-mismatch', index);
    if (
      index > 0 &&
      (!finite(candidate.displayLinkTimestamp) ||
        !finite(candidate.displayLinkTargetTimestamp) ||
        candidate.displayLinkTimestamp > geometry.startedAt ||
        candidate.displayLinkTargetTimestamp <=
          candidate.displayLinkTimestamp ||
        candidate.displayLinkTargetTimestamp - candidate.displayLinkTimestamp >
          125)
    )
      add('invalid-native-display-link-timing', index);
    if (
      !finite(geometry.startedAt) ||
      !finite(geometry.finishedAt) ||
      geometry.startedAt < Number(raw.startedAt) ||
      geometry.finishedAt > Number(raw.stoppedAt) ||
      (previous &&
        (geometry.startedAt <= previous.startedAt ||
          geometry.finishedAt <= previous.finishedAt ||
          geometry.finishedAt - previous.finishedAt > 125)) ||
      (!previous && geometry.finishedAt - Number(raw.startedAt) > 125)
    )
      add('native-recording-coverage-gap', index);
    if (previous && geometry.startedAt < previous.finishedAt)
      add('overlapping-native-recording-operations', index);
    previous = geometry;
    if (
      !strings(geometry.rowIds) ||
      geometry.rowIds.length > 128 ||
      geometry.rowIds.some(
        (id) =>
          !id.startsWith(request.rowPrefix) ||
          id.length <= request.rowPrefix.length
      )
    ) {
      add('invalid-native-discovered-rows', index);
      continue;
    }
    let ownerIndex = 0;
    let ownerScope = contract.scope;
    let ownerScrollID = request.scrollViewId;
    let validOwner = !itinerary;
    if (itinerary && validItinerary) {
      const owner = candidate.owner;
      if (
        object(owner) &&
        (owner.index === 0 || owner.index === 1) &&
        owner.rootId === request.rootId &&
        owner.scope === itinerary.owners[owner.index].scope &&
        text(owner.scrollViewId) &&
        (owner.index === 0
          ? owner.scrollViewId === request.scrollViewId
          : owner.scrollViewId.startsWith(
              itinerary.owners[1].scrollViewPrefix
            ) && owner.scrollViewId !== request.scrollViewId)
      ) {
        ownerIndex = owner.index;
        ownerScope = owner.scope;
        ownerScrollID = owner.scrollViewId;
        validOwner = true;
        if (
          (lastOwnerIndex < 0 && ownerIndex !== 0) ||
          ownerIndex < lastOwnerIndex
        )
          add('native-owner-itinerary-order', index);
        lastOwnerIndex = Math.max(lastOwnerIndex, ownerIndex);
      } else add('invalid-native-frame-owner', index);
    } else if (candidate.owner !== undefined)
      add('unexpected-native-frame-owner', index);
    if (
      itinerary &&
      (!Array.isArray(geometry.ownerHosts) ||
        geometry.ownerHosts.length !== 1 ||
        !object(geometry.ownerHosts[0]) ||
        geometry.ownerHosts[0].id !== ownerScrollID ||
        !text(geometry.ownerHosts[0].identity) ||
        geometry.ownerHosts[0].identity !== geometry.scroll?.hostIdentity)
    )
      add('invalid-native-owner-host-inventory', index);
    const frameRequest: NativeGeometryRequest = {
      requestId: `${contract.recordingId}:${index}`,
      rootId: request.rootId,
      scrollViewId: ownerScrollID,
      composerId: request.composerId,
      rows: geometry.rowIds.map((id) => ({
        id,
        key: id.slice(request.rowPrefix.length),
      })),
    };
    const adapted = adaptGeometry(geometry, frameRequest, {
      ...contract,
      // Entry destination inventory can be physically empty while concealed.
      // This grants acquisition only, never readiness or landing success.
      populated: itinerary && ownerIndex === 1 ? false : contract.populated,
      allowConcealedViewport:
        contract.visibility === 'observe-entry-concealment',
    });
    for (const code of adapted.issues) add(code, index);
    samples.push(adapted.snapshot);
    const exposed = (view: NativeGeometryCapture['root']) =>
      Boolean(
        view?.attached &&
        !view.hidden &&
        view.effectiveAlpha > 0 &&
        view.clipFrame?.width > 0 &&
        view.clipFrame?.height > 0
      );
    exposureSamples.push({
      time: geometry.finishedAt,
      viewportVisible: exposed(geometry.scroll?.view),
      visibleRequiredKeys: Array.isArray(geometry.rows)
        ? geometry.rows
            .filter(
              (row) =>
                row &&
                contract.requiredKeys.includes(
                  row.id?.slice(request.rowPrefix.length)
                ) &&
                exposed(row.view) &&
                row.view!.clipFrame.y < adapted.snapshot.viewportBottom &&
                row.view!.clipFrame.y + row.view!.clipFrame.height >
                  adapted.snapshot.viewportTop &&
                geometry.scroll?.view &&
                row.view!.clipFrame.x <
                  geometry.scroll.view.clipFrame.x +
                    geometry.scroll.view.clipFrame.width &&
                row.view!.clipFrame.x + row.view!.clipFrame.width >
                  geometry.scroll.view.clipFrame.x
            )
            .map((row) => row.id.slice(request.rowPrefix.length))
        : [],
    });
    rootIdentity ??= geometry.root?.identity;
    scrollIdentity ??= geometry.scroll?.view?.identity;
    if (
      geometry.root?.identity !== rootIdentity ||
      (!itinerary && geometry.scroll?.view?.identity !== scrollIdentity)
    )
      add('native-recording-owner-replaced', index);
    if (itinerary && validOwner && geometry.root && geometry.scroll) {
      const identity = {
        root: geometry.root.identity,
        scroll: geometry.scroll.view.identity,
        host: geometry.scroll.hostIdentity,
        tag: ownerScrollID,
      };
      const previousOwner = ownerIdentities.get(ownerIndex);
      if (previousOwner && !equal(previousOwner, identity))
        add('same-scope-native-owner-replaced', index);
      else if (!previousOwner) ownerIdentities.set(ownerIndex, identity);
      const viewportVisible = exposureSamples.at(-1)!.viewportVisible;
      ownerSamples.push({
        frame: index,
        sampleIndex: samples.length - 1,
        time: geometry.finishedAt,
        index: ownerIndex,
        scope: ownerScope,
        rootIdentity: identity.root,
        scrollIdentity: identity.scroll,
        viewportVisible,
      });
    }
    const rootRevision = parse(geometry.root?.semanticValue);
    const requestedKeys =
      object(rootRevision) && strings(rootRevision.requestedKeys)
        ? rootRevision.requestedKeys
        : [];
    if (
      !object(rootRevision) ||
      rootRevision.version !== 1 ||
      rootRevision.scope !== ownerScope ||
      !strings(rootRevision.requestedKeys)
    )
      add('invalid-native-root-revision', index);
    const revisions: NativeRowRevision[] = [];
    for (const row of Array.isArray(geometry.rows) &&
    geometry.rows.length <= 128
      ? geometry.rows
      : []) {
      if (!object(row) || !text(row.id) || !row.view) continue;
      const key = row.id.slice(request.rowPrefix.length);
      const revision = parse(row.view.semanticValue);
      if (
        !object(revision) ||
        revision.version !== 1 ||
        revision.scope !== ownerScope ||
        revision.key !== key ||
        !object(revision.signature) ||
        typeof revision.signature.content !== 'string' ||
        typeof revision.signature.reactions !== 'string' ||
        !finite(revision.signature.replies) ||
        revision.signature.replies < 0
      )
        add('invalid-native-row-revision', index);
      else revisions.push(revision as unknown as NativeRowRevision);
      if (contract.requiredKeys.includes(key)) {
        const identityKey = `${ownerScope}::${key}`;
        const previousIdentity = requiredIdentities.get(identityKey);
        if (previousIdentity && previousIdentity !== row.view.identity)
          add('required-native-reading-view-replaced', index);
        requiredIdentities.set(identityKey, row.view.identity);
      }
    }
    semanticSamples.push({
      time: geometry.finishedAt,
      rows: revisions,
      requestedKeys,
    });
    // These indices identify usable acquisition only. The viewport index does
    // not imply readable content; neither index asserts correct entry landing.
    if (
      itinerary &&
      validOwner &&
      ownerIndex === 1 &&
      issues.length === issueCountBeforeFrame &&
      exposureSamples.at(-1)?.viewportVisible
    ) {
      firstExposedDestinationFrame ??= index;
      const contentExposed = geometry.rows?.some(
        (row) =>
          row.view &&
          exposed(row.view) &&
          revisions.some(
            (revision) =>
              revision.key === row.id.slice(request.rowPrefix.length)
          ) &&
          row.view.clipFrame.y < adapted.snapshot.viewportBottom &&
          row.view.clipFrame.y + row.view.clipFrame.height >
            adapted.snapshot.viewportTop &&
          geometry.scroll?.view &&
          row.view.clipFrame.x <
            geometry.scroll.view.clipFrame.x +
              geometry.scroll.view.clipFrame.width &&
          row.view.clipFrame.x + row.view.clipFrame.width >
            geometry.scroll.view.clipFrame.x
      );
      if (contentExposed) firstContentDestinationFrame ??= index;
    }
  }
  if (itinerary && lastOwnerIndex !== 1)
    add('native-destination-scope-unobserved');
  if (previous && Number(raw.stoppedAt) - previous.finishedAt > 125)
    add('missing-native-recording-tail');
  if (!Array.isArray(raw.markers) || raw.markers.length > 128)
    add('invalid-native-markers');
  else
    raw.markers.forEach((marker, index, markers) => {
      if (
        !object(marker) ||
        marker.sequence !== index ||
        !text(marker.name) ||
        marker.name.length > 128 ||
        !finite(marker.time) ||
        marker.time < Number(raw.startedAt) ||
        marker.time > Number(raw.stoppedAt) ||
        (index > 0 && marker.time < markers[index - 1]?.time)
      )
        add('invalid-native-marker-order');
    });
  return {
    verdict: issues.length ? ('INCOMPLETE' as const) : ('COMPLETE' as const),
    issues,
    samples,
    semanticSamples,
    exposureSamples,
    ownerSamples,
    firstExposedDestinationFrame,
    firstContentDestinationFrame,
  };
}

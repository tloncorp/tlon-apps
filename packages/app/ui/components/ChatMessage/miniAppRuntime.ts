import * as db from '@tloncorp/shared/db';
import {
  A2UI,
  type MiniAppActionBlob,
  type MiniAppBundle,
  MiniAppBundleSchema,
  type MiniAppJSONValue,
  type MiniAppPostBlob,
  type MiniAppSnapshotBlob,
  getMiniAppActionBlobs,
  getMiniAppSnapshotBlobs,
  getOnlyMiniAppActionBlob,
  getOnlyMiniAppSnapshotBlob,
} from '@tloncorp/shared/logic';

export type { MiniAppJSONValue };

export const MINI_APP_LIMITS = {
  maxBundleBytes: 512_000,
  maxSourceBytes: 256_000,
  maxActionBytes: 4_000,
  maxActionsReplayedFromGenesis: 500,
  maxActionsReplayedAfterSnapshot: 500,
  maxFinalStateBytes: 128_000,
  maxSnapshotStateBytes: 128_000,
  maxRenderOutputBytes: 256_000,
  maxRuntimeMs: 750,
  maxJsonDepth: 16,
  maxSceneNodes: 500,
} as const;

type MiniAppReplayAction = {
  actionId: string;
  action: MiniAppJSONValue;
  actor: string;
  postId: string;
  sequence: number;
};

export type MiniAppPendingAction = Omit<MiniAppReplayAction, 'sequence'>;

type PendingMiniAppReplayAction = MiniAppPendingAction;

type MiniAppActionLog = {
  canonical: MiniAppReplayAction[];
  optimistic: MiniAppReplayAction[];
};

export type MiniAppReplaySnapshot = {
  actionCount: number;
  snapshotId: string;
  state: MiniAppJSONValue;
  stateSha256: string;
  throughPostId: string;
  throughSequence: number;
};

export type MiniAppSceneNode = {
  id?: string;
  type: string;
  children?: MiniAppSceneNode[];
  action?: MiniAppJSONValue;
  disabled?: boolean;
  visible?: boolean;
  [key: string]: MiniAppJSONValue | MiniAppSceneNode[] | undefined;
};

export type MiniAppScene = {
  type: 'skia-scene-v0';
  width?: number;
  height?: number;
  background?: string;
  nodes: MiniAppSceneNode[];
};

export type MiniAppRenderOutput = {
  visual?: MiniAppScene;
  controls?: A2UI.BlobEntry;
  summary?: string;
  badge?:
    | string
    | {
        text: string;
        tone?: 'neutral' | 'positive' | 'warning' | 'negative';
      };
};

export type MiniAppSocialContext = {
  appId: string;
  title: string;
  viewer: string | null;
  participants: string[];
  profilesByShip: Record<string, { nickname?: string; avatar?: string }>;
  channel: {
    id: string;
    type?: string;
    groupId?: string | null;
  };
  host: string;
  capabilities: {
    canWrite: boolean;
  };
  limits: typeof MINI_APP_LIMITS;
};

export type MiniAppReplayResult =
  | {
      ok: true;
      state: MiniAppJSONValue;
      render: MiniAppRenderOutput;
      optimisticActionCount: number;
    }
  | {
      ok: false;
      error: string;
    };

type SandboxRunPayload = {
  actionCountBase?: number;
  bundle: MiniAppBundle;
  actions: MiniAppReplayAction[];
  context: MiniAppSocialContext;
  now: number;
  snapshotState?: MiniAppJSONValue;
};

type SandboxRunResponse =
  | {
      ok: true;
      result: {
        state: MiniAppJSONValue;
        render: MiniAppJSONValue;
      };
    }
  | {
      ok: false;
      phase: string;
      error: string;
    };

export interface MiniAppSandbox {
  run(payload: SandboxRunPayload): Promise<SandboxRunResponse>;
}

const bundleCache = new Map<string, Promise<MiniAppBundle>>();

function jsonStringSize(value: unknown): number {
  try {
    return JSON.stringify(value)?.length ?? Infinity;
  } catch {
    return Infinity;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isJSONValue(value: unknown, depth = 0): value is MiniAppJSONValue {
  if (depth > MINI_APP_LIMITS.maxJsonDepth) {
    return false;
  }
  if (value === null) {
    return true;
  }

  switch (typeof value) {
    case 'string':
    case 'boolean':
      return true;
    case 'number':
      return Number.isFinite(value);
    case 'object': {
      if (Array.isArray(value)) {
        return value.every((item) => isJSONValue(item, depth + 1));
      }
      if (!isPlainObject(value)) {
        return false;
      }
      return Object.values(value).every((item) => isJSONValue(item, depth + 1));
    }
    default:
      return false;
  }
}

function isJSONRecord(
  value: unknown
): value is { [key: string]: MiniAppJSONValue } {
  return isPlainObject(value) && isJSONValue(value);
}

export function canonicalMiniAppJSONString(value: MiniAppJSONValue): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalMiniAppJSONString).join(',')}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalMiniAppJSONString(value[key])}`
    )
    .join(',')}}`;
}

function sanitizeError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'Mini app failed to render.';
  return message.replace(/\s+/g, ' ').slice(0, 500);
}

function logMiniAppDiagnostic(
  appId: string,
  phase: string,
  error: unknown
): void {
  console.error('[mini-app]', {
    appId,
    phase,
    error: sanitizeError(error),
  });
}

function isValidMiniAppAction(
  appId: string,
  action: MiniAppActionBlob
): boolean {
  return (
    action.appId === appId &&
    jsonStringSize(action.action) <= MINI_APP_LIMITS.maxActionBytes
  );
}

function isValidMiniAppSnapshot(
  appId: string,
  snapshot: MiniAppSnapshotBlob
): boolean {
  return (
    snapshot.appId === appId &&
    jsonStringSize(snapshot.state) <= MINI_APP_LIMITS.maxSnapshotStateBytes
  );
}

function canonicalPostIdValue(postId: string): bigint | null {
  const tail = postId.trim().split('/').pop() ?? postId;
  const digits = tail.replace(/\./g, '');
  return /^\d+$/.test(digits) ? BigInt(digits) : null;
}

export function compareCanonicalPostIds(a: string, b: string): number {
  const aValue = canonicalPostIdValue(a);
  const bValue = canonicalPostIdValue(b);
  if (aValue != null && bValue != null) {
    if (aValue === bValue) {
      return 0;
    }
    return aValue < bValue ? -1 : 1;
  }
  return a.localeCompare(b);
}

function isPendingLocalReply(reply: db.Post): boolean {
  return !!reply.deliveryStatus && reply.deliveryStatus !== 'sent';
}

export function getMiniAppActionLog(
  appId: string,
  replies: db.Post[] | undefined
): MiniAppActionLog {
  if (!replies) {
    return { canonical: [], optimistic: [] };
  }

  const canonical: PendingMiniAppReplayAction[] = [];
  const optimistic: PendingMiniAppReplayAction[] = [];

  for (const reply of replies) {
    for (const blob of getMiniAppActionBlobs(reply.blob)) {
      if (!isValidMiniAppAction(appId, blob)) {
        continue;
      }

      const action = {
        actionId: blob.actionId,
        action: blob.action,
        actor: reply.authorId,
        postId: reply.id,
      };

      if (isPendingLocalReply(reply)) {
        optimistic.push(action);
      } else {
        canonical.push(action);
      }
    }
  }

  const sortActions = (
    a: PendingMiniAppReplayAction,
    b: PendingMiniAppReplayAction
  ) => {
    const postIdOrder = compareCanonicalPostIds(a.postId, b.postId);
    return postIdOrder === 0
      ? a.actionId.localeCompare(b.actionId)
      : postIdOrder;
  };

  const assignSequence = (
    action: PendingMiniAppReplayAction,
    index: number
  ): MiniAppReplayAction => ({
    ...action,
    sequence: index,
  });

  const canonicalActions = canonical.sort(sortActions).map(assignSequence);
  const optimisticActions = optimistic
    .sort(sortActions)
    .map((action, index) =>
      assignSequence(action, canonicalActions.length + index)
    );

  return {
    canonical: canonicalActions,
    optimistic: optimisticActions,
  };
}

export function isOnlyMiniAppActionReply(
  post: db.Post,
  appId: string
): boolean {
  const action = getOnlyMiniAppActionBlob(post.blob);
  return !!action && isValidMiniAppAction(appId, action);
}

export function isOnlyMiniAppSnapshotReply(
  post: db.Post,
  appId: string
): boolean {
  const snapshot = getOnlyMiniAppSnapshotBlob(post.blob);
  return !!snapshot && isValidMiniAppSnapshot(appId, snapshot);
}

export function isOnlyMiniAppSystemReply(
  post: db.Post,
  appId: string
): boolean {
  return (
    isOnlyMiniAppActionReply(post, appId) ||
    isOnlyMiniAppSnapshotReply(post, appId)
  );
}

export function getMiniAppSnapshotCandidates(
  appId: string,
  replies: db.Post[] | undefined
): MiniAppReplaySnapshot[] {
  if (!replies) {
    return [];
  }

  const snapshots: MiniAppReplaySnapshot[] = [];
  for (const reply of replies) {
    for (const snapshot of getMiniAppSnapshotBlobs(reply.blob)) {
      if (!isValidMiniAppSnapshot(appId, snapshot)) {
        continue;
      }
      snapshots.push({
        actionCount: snapshot.actionCount,
        snapshotId: snapshot.snapshotId,
        state: snapshot.state,
        stateSha256: snapshot.stateSha256.toLowerCase(),
        throughPostId: snapshot.throughPostId,
        throughSequence: snapshot.throughSequence,
      });
    }
  }

  return snapshots.sort((a, b) => {
    const postIdOrder = compareCanonicalPostIds(
      a.throughPostId,
      b.throughPostId
    );
    if (postIdOrder !== 0) {
      return postIdOrder;
    }
    if (a.throughSequence !== b.throughSequence) {
      return a.throughSequence - b.throughSequence;
    }
    if (a.actionCount !== b.actionCount) {
      return a.actionCount - b.actionCount;
    }
    return a.snapshotId.localeCompare(b.snapshotId);
  });
}

export async function getLatestValidMiniAppSnapshot(
  appId: string,
  replies: db.Post[] | undefined
): Promise<MiniAppReplaySnapshot | null> {
  const candidates = getMiniAppSnapshotCandidates(appId, replies);
  for (let i = candidates.length - 1; i >= 0; i--) {
    const snapshot = candidates[i];
    try {
      if ((await sha256JSON(snapshot.state)) === snapshot.stateSha256) {
        return snapshot;
      }
    } catch (error) {
      logMiniAppDiagnostic(appId, 'snapshot', error);
    }
  }

  return null;
}

export function validateMiniAppA2UIControls(
  appId: string,
  controls: unknown
): controls is A2UI.BlobEntry {
  if (!A2UI.validateBlobEntry(controls)) {
    return false;
  }

  return A2UI.getButtonActions(controls).every((action) => {
    const event = action.event;
    return (
      event.name === A2UI.action.miniAppAction &&
      event.data.appId === appId &&
      jsonStringSize(event.data.action) <= MINI_APP_LIMITS.maxActionBytes
    );
  });
}

function isValidColor(value: unknown): boolean {
  return (
    value === undefined ||
    (typeof value === 'string' &&
      value.length <= 80 &&
      (/^#[0-9a-f]{3,8}$/i.test(value) ||
        /^rgba?\(/i.test(value) ||
        /^[a-z]+$/i.test(value)))
  );
}

function isValidSceneNumber(value: unknown): boolean {
  return (
    value === undefined || (typeof value === 'number' && Number.isFinite(value))
  );
}

function sceneNumber(
  node: Record<string, unknown>,
  key: string
): number | null {
  const value = node[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function hasPositiveSize(
  node: Record<string, unknown>,
  key: string,
  min = 0
): boolean {
  const value = sceneNumber(node, key);
  return value !== null && value > 0 && value >= min;
}

function hasNonEmptyLabel(node: Record<string, unknown>): boolean {
  return typeof node.label === 'string' && node.label.trim().length > 0;
}

function isValidSceneAnimation(value: unknown): boolean {
  return (
    value === undefined ||
    value === 'pop' ||
    value === 'pulse' ||
    value === 'floatUp' ||
    value === 'fadeIn'
  );
}

function isInteractiveSceneType(type: string): boolean {
  return type === 'button' || type === 'hitZone' || type === 'hitGrid';
}

function validateButtonNode(node: Record<string, unknown>): boolean {
  return (
    hasNonEmptyLabel(node) &&
    hasPositiveSize(node, 'width', 44) &&
    hasPositiveSize(node, 'height', 44) &&
    (node.disabled === true || isJSONRecord(node.action))
  );
}

function validateHitZoneNode(node: Record<string, unknown>): boolean {
  return (
    hasNonEmptyLabel(node) &&
    sceneNumber(node, 'x') !== null &&
    sceneNumber(node, 'y') !== null &&
    hasPositiveSize(node, 'width', 24) &&
    hasPositiveSize(node, 'height', 24) &&
    isJSONRecord(node.action)
  );
}

function validateHitGridNode(node: Record<string, unknown>): boolean {
  const x = sceneNumber(node, 'x');
  const y = sceneNumber(node, 'y');
  const rows = sceneNumber(node, 'rows');
  const columns = sceneNumber(node, 'columns');
  const cellWidth = sceneNumber(node, 'cellWidth');
  const cellHeight = sceneNumber(node, 'cellHeight');
  const gapX = sceneNumber(node, 'gapX') ?? 0;
  const gapY = sceneNumber(node, 'gapY') ?? 0;

  return (
    hasNonEmptyLabel(node) &&
    x !== null &&
    y !== null &&
    rows !== null &&
    Number.isInteger(rows) &&
    rows >= 1 &&
    columns !== null &&
    Number.isInteger(columns) &&
    columns >= 1 &&
    rows * columns <= 400 &&
    cellWidth !== null &&
    cellWidth >= 16 &&
    cellHeight !== null &&
    cellHeight >= 16 &&
    gapX >= 0 &&
    gapX <= 64 &&
    gapY >= 0 &&
    gapY <= 64 &&
    isJSONRecord(node.action)
  );
}

function validateVisualNodeGeometry(node: Record<string, unknown>): boolean {
  for (const key of ['width', 'height', 'r', 'rx', 'ry']) {
    const value = node[key];
    if (
      value !== undefined &&
      (typeof value !== 'number' || !Number.isFinite(value) || value <= 0)
    ) {
      return false;
    }
  }

  return true;
}

function validateSceneNode(node: unknown, depth = 0): node is MiniAppSceneNode {
  if (
    depth > MINI_APP_LIMITS.maxJsonDepth ||
    !isPlainObject(node) ||
    typeof node.type !== 'string'
  ) {
    return false;
  }

  const supportedTypes = [
    'group',
    'layer',
    'rect',
    'roundedRect',
    'circle',
    'oval',
    'line',
    'path',
    'text',
    'label',
    'image',
    'avatar',
    'icon',
    'button',
    'hitZone',
    'hitGrid',
    'badge',
    'progress',
    'playingCard',
  ];
  if (!supportedTypes.includes(node.type)) {
    return false;
  }

  if (
    (node.id !== undefined && typeof node.id !== 'string') ||
    (node.visible !== undefined && typeof node.visible !== 'boolean') ||
    (node.disabled !== undefined && typeof node.disabled !== 'boolean') ||
    (node.action !== undefined &&
      (!isJSONRecord(node.action) ||
        jsonStringSize(node.action) > MINI_APP_LIMITS.maxActionBytes)) ||
    (!isInteractiveSceneType(node.type) && node.action !== undefined) ||
    !isValidColor(node.fill) ||
    !isValidColor(node.stroke) ||
    !isValidColor(node.color) ||
    !isValidColor(node.textColor) ||
    !isValidColor(node.trackFill) ||
    !isValidSceneAnimation(node.animate) ||
    (node.transitionKey !== undefined &&
      (typeof node.transitionKey !== 'string' ||
        node.transitionKey.length > 160))
  ) {
    return false;
  }

  if (
    !validateVisualNodeGeometry(node) ||
    (node.type === 'button' && !validateButtonNode(node)) ||
    (node.type === 'hitZone' && !validateHitZoneNode(node)) ||
    (node.type === 'hitGrid' && !validateHitGridNode(node))
  ) {
    return false;
  }

  for (const key of [
    'x',
    'y',
    'width',
    'height',
    'radius',
    'r',
    'rx',
    'ry',
    'cx',
    'cy',
    'x1',
    'y1',
    'x2',
    'y2',
    'strokeWidth',
    'opacity',
    'value',
    'max',
    'fontSize',
    'lines',
    'durationMs',
    'delayMs',
    'columns',
    'rows',
    'cellWidth',
    'cellHeight',
    'gapX',
    'gapY',
  ]) {
    if (!isValidSceneNumber(node[key])) {
      return false;
    }
  }

  for (const key of [
    'text',
    'label',
    'src',
    'icon',
    'suit',
    'rank',
    'd',
    'fit',
    'ship',
    'contactId',
    'actor',
    'align',
    'fontFamily',
    'fontWeight',
    'trackFill',
  ]) {
    const value = node[key];
    if (
      value !== undefined &&
      (typeof value !== 'string' || value.length > 500)
    ) {
      return false;
    }
  }

  if (node.children !== undefined) {
    return (
      Array.isArray(node.children) &&
      node.children.length <= MINI_APP_LIMITS.maxSceneNodes &&
      node.children.every((child) => validateSceneNode(child, depth + 1))
    );
  }

  return true;
}

function countSceneNodes(nodes: MiniAppSceneNode[]): number {
  let count = 0;
  for (const node of nodes) {
    count += 1;
    if (node.children) {
      count += countSceneNodes(node.children);
    }
  }
  return count;
}

export function validateMiniAppRenderOutput(
  appId: string,
  render: unknown
): render is MiniAppRenderOutput {
  if (
    !isPlainObject(render) ||
    jsonStringSize(render) > MINI_APP_LIMITS.maxRenderOutputBytes
  ) {
    return false;
  }

  if (
    render.summary !== undefined &&
    (typeof render.summary !== 'string' || render.summary.length > 1000)
  ) {
    return false;
  }

  if (render.badge !== undefined) {
    const badge = render.badge;
    if (
      typeof badge !== 'string' &&
      (!isPlainObject(badge) ||
        typeof badge.text !== 'string' ||
        badge.text.length > 80)
    ) {
      return false;
    }
  }

  if (render.visual !== undefined) {
    const visual = render.visual;
    if (
      !isPlainObject(visual) ||
      visual.type !== 'skia-scene-v0' ||
      (visual.width !== undefined &&
        (typeof visual.width !== 'number' ||
          !Number.isFinite(visual.width) ||
          visual.width <= 0)) ||
      (visual.height !== undefined &&
        (typeof visual.height !== 'number' ||
          !Number.isFinite(visual.height) ||
          visual.height <= 0)) ||
      !isValidColor(visual.background) ||
      !Array.isArray(visual.nodes) ||
      countSceneNodes(visual.nodes as MiniAppSceneNode[]) >
        MINI_APP_LIMITS.maxSceneNodes ||
      !(visual.nodes as unknown[]).every((node) => validateSceneNode(node))
    ) {
      return false;
    }
  }

  if (
    render.controls !== undefined &&
    !validateMiniAppA2UIControls(appId, render.controls)
  ) {
    return false;
  }

  return true;
}

export function lintMiniAppSource(source: string): string | null {
  const forbidden: Array<[string, RegExp]> = [
    ['eval', /\beval\s*\(/],
    ['Function', /\bFunction\b/],
    ['constructor.constructor', /constructor\s*\.\s*constructor/],
    ['globalThis', /\bglobalThis\b/],
    ['self', /\bself\b/],
    ['dynamic import', /\bimport\s*\(/],
    ['static import', /^\s*import\s/m],
    ['importScripts', /\bimportScripts\b/],
    ['fetch', /\bfetch\b/],
    ['XMLHttpRequest', /\bXMLHttpRequest\b/],
    ['WebSocket', /\bWebSocket\b/],
    ['EventSource', /\bEventSource\b/],
    ['storage APIs', /\b(localStorage|sessionStorage|indexedDB)\b/],
    ['timers', /\b(setTimeout|setInterval|queueMicrotask)\b/],
    ['workers', /\b(Worker|SharedWorker)\b/],
    ['DOM APIs', /\b(window|document|navigator|location)\b/],
    ['Date constructor', /\b(new\s+Date|Date\s*\()/],
    ['performance APIs', /\bperformance\s*\./],
    ['crypto APIs', /\bcrypto\s*\./],
  ];

  const match = forbidden.find(([, pattern]) => pattern.test(source));
  return match ? `Mini app source uses disallowed ${match[0]}.` : null;
}

async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('SHA-256 verification is unavailable in this browser.');
  }

  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256JSON(value: MiniAppJSONValue): Promise<string> {
  const encoded = new TextEncoder().encode(canonicalMiniAppJSONString(value));
  const bytes = encoded.buffer.slice(
    encoded.byteOffset,
    encoded.byteOffset + encoded.byteLength
  );
  return sha256Hex(bytes);
}

async function fetchAndVerifyBundle(
  miniApp: MiniAppPostBlob
): Promise<MiniAppBundle> {
  if (miniApp.bundleBytes > MINI_APP_LIMITS.maxBundleBytes) {
    throw new Error('Mini app bundle exceeds V1 limit.');
  }

  const response = await fetch(miniApp.bundleUri);
  if (!response.ok) {
    throw new Error(`Bundle fetch failed with status ${response.status}.`);
  }

  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== miniApp.bundleBytes) {
    throw new Error('Mini app bundle byte count mismatch.');
  }

  const hash = await sha256Hex(bytes);
  if (hash !== miniApp.bundleSha256.toLowerCase()) {
    throw new Error('Mini app bundle SHA-256 mismatch.');
  }

  const parsed = JSON.parse(new TextDecoder().decode(bytes));
  const bundle = MiniAppBundleSchema.parse(parsed);
  if (
    bundle.appId !== miniApp.appId ||
    bundle.runtime !== miniApp.runtime ||
    bundle.title !== miniApp.title
  ) {
    throw new Error('Mini app bundle does not match manifest.');
  }

  const sourceError = lintMiniAppSource(bundle.source);
  if (sourceError) {
    throw new Error(sourceError);
  }

  return bundle;
}

export function fetchMiniAppBundle(
  miniApp: MiniAppPostBlob
): Promise<MiniAppBundle> {
  const cacheKey = miniApp.bundleSha256.toLowerCase();
  let cached = bundleCache.get(cacheKey);
  if (!cached) {
    cached = fetchAndVerifyBundle(miniApp).catch((error) => {
      bundleCache.delete(cacheKey);
      throw error;
    });
    bundleCache.set(cacheKey, cached);
  }
  return cached;
}

const WORKER_SOURCE = `
const UnsafeFunction = Function;

function lockGlobal(name, value) {
  try {
    Object.defineProperty(globalThis, name, {
      value,
      writable: false,
      configurable: false,
    });
  } catch {
    try {
      globalThis[name] = value;
    } catch {}
  }
}

for (const name of [
  'eval',
  'Function',
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'localStorage',
  'sessionStorage',
  'indexedDB',
  'importScripts',
  'Worker',
  'SharedWorker',
  'navigator',
  'location',
  'document',
  'window',
  'Date',
  'performance',
  'crypto',
  'setTimeout',
  'setInterval',
  'queueMicrotask',
]) {
  lockGlobal(name, undefined);
}

try {
  Object.defineProperty(Date, 'now', {
    value: () => {
      throw new Error('Date.now disabled');
    },
    writable: false,
    configurable: false,
  });
} catch {}

try {
  Object.defineProperty(Math, 'random', {
    value: () => {
      throw new Error('Math.random disabled');
    },
    writable: false,
    configurable: false,
  });
} catch {}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function jsonStringSize(value) {
  try {
    return JSON.stringify(value)?.length ?? Infinity;
  } catch {
    return Infinity;
  }
}

function isJSONValue(value, depth = 0) {
  if (depth > 16) return false;
  if (value === null) return true;

  switch (typeof value) {
    case 'string':
    case 'boolean':
      return true;
    case 'number':
      return Number.isFinite(value);
    case 'object':
      if (Array.isArray(value)) {
        return value.every((item) => isJSONValue(item, depth + 1));
      }
      if (!isPlainObject(value)) {
        return false;
      }
      return Object.values(value).every((item) => isJSONValue(item, depth + 1));
    default:
      return false;
  }
}

function cloneJson(value, label, maxBytes) {
  if (!isJSONValue(value)) {
    throw new Error(label + ' is not JSON-serializable');
  }
  if (jsonStringSize(value) > maxBytes) {
    throw new Error(label + ' exceeds V1 limit');
  }
  return JSON.parse(JSON.stringify(value));
}

function lintSource(source) {
  const forbidden = [
    ['eval', /\\beval\\s*\\(/],
    ['Function', /\\bFunction\\b/],
    ['constructor.constructor', /constructor\\s*\\.\\s*constructor/],
    ['globalThis', /\\bglobalThis\\b/],
    ['self', /\\bself\\b/],
    ['dynamic import', /\\bimport\\s*\\(/],
    ['static import', /^\\s*import\\s/m],
    ['importScripts', /\\bimportScripts\\b/],
    ['fetch', /\\bfetch\\b/],
    ['XMLHttpRequest', /\\bXMLHttpRequest\\b/],
    ['WebSocket', /\\bWebSocket\\b/],
    ['EventSource', /\\bEventSource\\b/],
    ['storage APIs', /\\b(localStorage|sessionStorage|indexedDB)\\b/],
    ['timers', /\\b(setTimeout|setInterval|queueMicrotask)\\b/],
    ['workers', /\\b(Worker|SharedWorker)\\b/],
    ['DOM APIs', /\\b(window|document|navigator|location)\\b/],
    ['Date constructor', /\\b(new\\s+Date|Date\\s*\\()/],
    ['performance APIs', /\\bperformance\\s*\\./],
    ['crypto APIs', /\\bcrypto\\s*\\./],
  ];
  const match = forbidden.find(([, pattern]) => pattern.test(source));
  if (match) {
    throw new Error('Mini app source uses disallowed ' + match[0] + '.');
  }
}

function normalizeSource(source) {
  return source
    .replace(/\\bexport\\s+function\\s+(init|reduce|render)\\s*\\(/g, 'function $1(')
    .replace(/\\bexport\\s+const\\s+(init|reduce|render)\\s*=/g, 'const $1 =');
}

function loadApi(source) {
  lintSource(source);
  const module = { exports: Object.create(null) };
  const exports = module.exports;
  const tlon = Object.freeze({ runtime: 'js-worker-miniapp-v1' });
  return UnsafeFunction(
    'module',
    'exports',
    'tlon',
    '"use strict";\\n' +
      normalizeSource(source) +
      '\\n; return { init: module.exports.init || exports.init || (typeof init === "function" ? init : undefined), reduce: module.exports.reduce || exports.reduce || (typeof reduce === "function" ? reduce : undefined), render: module.exports.render || exports.render || (typeof render === "function" ? render : undefined) };\\n//# sourceURL=tlon-mini-app-bundle.js'
  )(module, exports, tlon);
}

function runInit(api, run) {
  if (run.snapshotState !== undefined) {
    return cloneJson(
      run.snapshotState,
      'snapshot state',
      run.limits.maxFinalStateBytes
    );
  }

  if (typeof api.init !== 'function') {
    throw new Error('Mini app source must export init');
  }

  let state = cloneJson(
    run.bundle.initialState,
    'initialState',
    run.limits.maxFinalStateBytes
  );
  const result = api.init(run.context);
  if (result !== undefined && result !== null) {
    if (!isPlainObject(result)) {
      throw new Error('init did not return an object');
    }
    state = cloneJson(result.state, 'init state', run.limits.maxFinalStateBytes);
  }
  return state;
}

function runReduce(api, run, state) {
  if (typeof api.reduce !== 'function') {
    throw new Error('Mini app source must export reduce');
  }

  let current = state;
  for (const action of run.actions) {
    const result = api.reduce(current, {
      ...run.context,
      actor: action.actor,
      action: action.action,
      actionId: action.actionId,
      postId: action.postId,
      sequence: action.sequence,
    });
    if (!isPlainObject(result)) {
      throw new Error('reduce did not return an object');
    }
    current = cloneJson(
      result.state,
      'reduce state',
      run.limits.maxFinalStateBytes
    );
  }
  return current;
}

function runRender(api, run, state) {
  if (typeof api.render !== 'function') {
    throw new Error('Mini app source must export render');
  }

  const last = run.actions.length > 0 ? run.actions[run.actions.length - 1] : null;
  // actionCount includes optimistic actions. When a pending local action is
  // replaced by its canonical reply, the count should stay stable so
  // transitionKey values like "click:" + actionCount do not replay just
  // because delivery was confirmed.
  return cloneJson(
    api.render(state, {
      ...run.context,
      now: run.now,
      lastAction: last ? last.action : null,
      lastActor: last ? last.actor : null,
      actionCount: (run.actionCountBase || 0) + run.actions.length,
    }),
    'render output',
    run.limits.maxRenderOutputBytes
  );
}

self.onmessage = (event) => {
  const run = event.data;
  try {
    if (!run?.bundle?.source || typeof run.bundle.source !== 'string') {
      throw new Error('Invalid mini app bundle source');
    }
    if (run.bundle.source.length > run.limits.maxSourceBytes) {
      throw new Error('Mini app source exceeds V1 limit');
    }
    if (!Array.isArray(run.actions)) {
      throw new Error('Invalid mini app action log');
    }

    const api = loadApi(run.bundle.source);
    const initialized = runInit(api, run);
    const state = runReduce(api, run, initialized);
    const render = runRender(api, run, state);
    postMessage({ ok: true, result: { state, render } });
  } catch (error) {
    postMessage({
      ok: false,
      phase: 'worker',
      error:
        error && typeof error.message === 'string'
          ? error.message
          : 'Mini app failed to render.',
    });
  }
};
`;

class WorkerMiniAppSandbox implements MiniAppSandbox {
  async run(payload: SandboxRunPayload): Promise<SandboxRunResponse> {
    if (typeof Worker === 'undefined' || typeof Blob === 'undefined') {
      return {
        ok: false,
        phase: 'worker',
        error: 'Mini apps are only available on web.',
      };
    }

    const workerUrl = URL.createObjectURL(
      new Blob([WORKER_SOURCE], { type: 'text/javascript' })
    );
    const worker = new Worker(workerUrl, { name: 'tlon-mini-app-v1' });

    return new Promise((resolve) => {
      let settled = false;
      const finish = (result: SandboxRunResponse) => {
        if (settled) {
          return;
        }
        settled = true;
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        resolve(result);
      };

      const timeout = window.setTimeout(() => {
        finish({
          ok: false,
          phase: 'timeout',
          error: 'Mini app timed out.',
        });
      }, MINI_APP_LIMITS.maxRuntimeMs);

      worker.onmessage = (message: MessageEvent<SandboxRunResponse>) => {
        window.clearTimeout(timeout);
        finish(message.data);
      };
      worker.onerror = (error) => {
        window.clearTimeout(timeout);
        finish({
          ok: false,
          phase: 'worker',
          error: error.message || 'Mini app failed to render.',
        });
      };
      worker.postMessage({
        ...payload,
        limits: MINI_APP_LIMITS,
      });
    });
  }
}

const sandbox = new WorkerMiniAppSandbox();

function validateSandboxResult(
  appId: string,
  result: SandboxRunResponse,
  optimisticActionCount: number
): MiniAppReplayResult {
  if (!isPlainObject(result) || result.ok !== true) {
    return {
      ok: false,
      error:
        isPlainObject(result) && typeof result.error === 'string'
          ? result.error
          : 'Mini app failed to render.',
    };
  }
  if (!isPlainObject(result.result)) {
    return { ok: false, error: 'Mini app failed to render.' };
  }
  if (
    !isJSONValue(result.result.state) ||
    jsonStringSize(result.result.state) > MINI_APP_LIMITS.maxFinalStateBytes
  ) {
    return { ok: false, error: 'Mini app state failed validation.' };
  }
  if (!validateMiniAppRenderOutput(appId, result.result.render)) {
    return { ok: false, error: 'Mini app render output failed validation.' };
  }
  return {
    ok: true,
    state: result.result.state,
    render: result.result.render,
    optimisticActionCount,
  };
}

export async function replayMiniApp({
  context,
  optimisticActions,
  miniApp,
  replies,
}: {
  context: MiniAppSocialContext;
  optimisticActions?: MiniAppPendingAction[];
  miniApp: MiniAppPostBlob;
  replies: db.Post[] | undefined;
}): Promise<MiniAppReplayResult> {
  try {
    const bundle = await fetchMiniAppBundle(miniApp);
    const actionLog = getMiniAppActionLog(miniApp.appId, replies);
    const snapshot = await getLatestValidMiniAppSnapshot(
      miniApp.appId,
      replies
    );
    const canonicalActions = snapshot
      ? actionLog.canonical.filter(
          (action) =>
            compareCanonicalPostIds(action.postId, snapshot.throughPostId) > 0
        )
      : actionLog.canonical;
    const maxActionsReplayed = snapshot
      ? MINI_APP_LIMITS.maxActionsReplayedAfterSnapshot
      : MINI_APP_LIMITS.maxActionsReplayedFromGenesis;
    if (canonicalActions.length > maxActionsReplayed) {
      return {
        ok: false,
        error: snapshot
          ? 'Action log after snapshot exceeds V1 replay limit.'
          : 'Action log exceeds V1 replay limit.',
      };
    }

    const replayedActionIds = new Set(
      [...canonicalActions, ...actionLog.optimistic].map(
        (action) => action.actionId
      )
    );
    const lastSequence = Math.max(
      -1,
      ...canonicalActions.map((action) => action.sequence),
      ...actionLog.optimistic.map((action) => action.sequence)
    );
    const localOptimisticActions = (optimisticActions ?? [])
      .filter((action) => !replayedActionIds.has(action.actionId))
      .map((action, index) => ({
        ...action,
        sequence: lastSequence + index + 1,
      }));
    const actions = [
      ...canonicalActions,
      ...actionLog.optimistic,
      ...localOptimisticActions,
    ];
    if (actions.length > maxActionsReplayed) {
      return {
        ok: false,
        error: snapshot
          ? 'Action log after snapshot exceeds V1 replay limit.'
          : 'Action log exceeds V1 replay limit.',
      };
    }
    const workerResult = await sandbox.run({
      actionCountBase: snapshot?.actionCount ?? 0,
      bundle,
      actions,
      context,
      now: Date.now(),
      snapshotState: snapshot?.state,
    });
    if (!workerResult.ok) {
      logMiniAppDiagnostic(
        miniApp.appId,
        workerResult.phase,
        workerResult.error
      );
    }

    return validateSandboxResult(
      miniApp.appId,
      workerResult,
      actionLog.optimistic.length + localOptimisticActions.length
    );
  } catch (error) {
    logMiniAppDiagnostic(miniApp.appId, 'replay', error);
    return { ok: false, error: sanitizeError(error) };
  }
}

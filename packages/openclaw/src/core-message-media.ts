/**
 * Whether core would turn a `message` call's body into an attachment, judged
 * by core's own text functions rather than a re-implementation.
 *
 * OpenClaw 2026.9.33 exports none of these from `openclaw/plugin-sdk`, so
 * each is loaded from the installed dist: the chunk is found by its file-name
 * prefix and the function by its original name in the chunk's
 * `export { name as x }` list (chunk names and export letters change per
 * build). Tested against the pinned 2026.9.33; the peer floor (>= 2026.9.4)
 * may lack or reshape them, so loading or calling throws and the hook fails
 * closed for non-owners.
 */
import { readdir, readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { findCodeRegions } from 'openclaw/plugin-sdk/text-chunking';

type ParsedDirectives = { mediaUrls?: string[] };
type DeliveryPayload = { mediaUrl?: string | null; mediaUrls?: string[] };

export type CoreMessageText = {
  stripFormattedReasoningMessage: (text: string) => string;
  stripInternalRuntimeContext: (text: string) => string;
  hasInboundMetadataSentinel: (text: string) => boolean;
  stripInboundMetadata: (text: string) => string;
  parseInlineDirectives: (
    text: string,
    options?: { stripAudioTag?: boolean; stripReplyTags?: boolean }
  ) => { text: string };
  stripUnsupportedCitationControlMarkers: (text: string) => string;
  stripPlainTextToolCallBlocks: (
    text: string,
    options?: { resolveProtectedRanges?: (text: string) => unknown }
  ) => string;
  parseReplyDirectives: (
    text: string,
    options?: { extractMarkdownImages?: boolean }
  ) => ParsedDirectives;
  normalizeReplyPayloadsForDelivery: (
    payloads: Array<{ text: string }>
  ) => DeliveryPayload[];
};

// Function name -> dist chunk file-name prefix.
const CORE_FUNCTIONS: Record<keyof CoreMessageText, string> = {
  stripFormattedReasoningMessage: 'formatted-reasoning-message-',
  stripInternalRuntimeContext: 'internal-runtime-context-',
  hasInboundMetadataSentinel: 'strip-inbound-meta-',
  stripInboundMetadata: 'strip-inbound-meta-',
  parseInlineDirectives: 'directive-tags-',
  stripUnsupportedCitationControlMarkers: 'payloads-',
  stripPlainTextToolCallBlocks: 'src-',
  parseReplyDirectives: 'reply-directives-',
  normalizeReplyPayloadsForDelivery: 'payloads-',
};

function openclawDistDir(): string {
  const require = createRequire(import.meta.url);
  // A public subpath anchors the package; its file sits in dist/plugin-sdk.
  const sdkFile = require.resolve('openclaw/plugin-sdk/text-chunking');
  return path.dirname(path.dirname(sdkFile));
}

async function loadCoreFunction(
  dist: string,
  files: string[],
  prefix: string,
  name: string
): Promise<unknown> {
  const exported = new RegExp(`\\b${name}(?:\\s+as\\s+([\\w$]+))?\\s*[,}]`);
  for (const file of files.filter(
    (candidate) => candidate.startsWith(prefix) && candidate.endsWith('.mjs')
  )) {
    const filePath = path.join(dist, file);
    const source = await readFile(filePath, 'utf8');
    const exportList = source.match(/export\s*\{[^}]*\}\s*;?\s*$/)?.[0];
    const match = exportList ? exported.exec(exportList) : null;
    if (!match) continue;
    const mod = (await import(pathToFileURL(filePath).href)) as Record<
      string,
      unknown
    >;
    const fn = mod[match[1] ?? name];
    if (typeof fn === 'function') return fn;
  }
  throw new Error(`openclaw core function ${name} not found in ${dist}`);
}

let loading: Promise<CoreMessageText> | undefined;

export function loadCoreMessageText(): Promise<CoreMessageText> {
  loading ??= (async () => {
    const dist = openclawDistDir();
    const files = await readdir(dist);
    const entries = await Promise.all(
      Object.entries(CORE_FUNCTIONS).map(async ([name, prefix]) => [
        name,
        await loadCoreFunction(dist, files, prefix, name),
      ])
    );
    return Object.fromEntries(entries) as CoreMessageText;
  })();
  // A failed load is retried on the next call rather than cached.
  loading.catch(() => {
    loading = undefined;
  });
  return loading;
}

// normalizeEscapedLineBreaksForVisibleText (message-tool-visible-content.ts),
// not exported: the first step of the message tool's visible-text sanitizer.
function unescapeLineBreaks(text: string): string {
  return text.includes('\\') ? text.replace(/\\r\\n|\\n|\\r/g, '\n') : text;
}

// sanitizeUserVisibleToolTextResult, which the message tool's
// sanitizeMessageToolVisiblePayload applies to each body field (the boot-echo
// step only ever empties text, so it is left out).
function sanitizeVisibleText(core: CoreMessageText, text: string): string {
  const internal = core.stripInternalRuntimeContext(
    core.stripFormattedReasoningMessage(unescapeLineBreaks(text))
  );
  return core.hasInboundMetadataSentinel(internal)
    ? core.stripInboundMetadata(internal)
    : internal;
}

// The fields sanitizeMessageToolVisiblePayload sanitizes that can become the
// sent body.
const BODY_FIELDS = ['text', 'content', 'message', 'caption', 'SendMessage'];
// buildMessagePayload's alias promotion order when `message` is empty.
const BODY_ALIASES = ['SendMessage', 'content', 'text'];

// buildMessagePayload (message-action-send.ts), text path only.
function buildMessageText(
  core: CoreMessageText,
  fields: Record<string, unknown>
): string {
  let message = typeof fields.message === 'string' ? fields.message : '';
  if (!message.trim()) {
    for (const alias of BODY_ALIASES) {
      const value = fields[alias];
      if (typeof value === 'string' && value.trim()) {
        message = core.stripFormattedReasoningMessage(value);
        break;
      }
    }
  }
  if (message.includes('\\n')) message = message.replaceAll('\\n', '\n');
  if (!message.trim()) {
    const caption = typeof fields.caption === 'string' ? fields.caption : '';
    message = caption.trim() ? caption : '';
  }
  const parsed = core.parseInlineDirectives(message, {
    stripAudioTag: true,
    stripReplyTags: true,
  });
  return core.stripPlainTextToolCallBlocks(
    core.stripUnsupportedCitationControlMarkers(parsed.text),
    { resolveProtectedRanges: findCodeRegions }
  );
}

function textYieldsMedia(core: CoreMessageText, text: string): boolean {
  const hasMedia = (parsed: {
    mediaUrl?: string | null;
    mediaUrls?: string[];
  }) => Boolean(parsed.mediaUrl) || (parsed.mediaUrls?.length ?? 0) > 0;
  // sendMessage's outbound normalizer, and the directive parser on its own.
  return (
    core.normalizeReplyPayloadsForDelivery([{ text }]).some(hasMedia) ||
    hasMedia(core.parseReplyDirectives(text, { extractMarkdownImages: true }))
  );
}

// Every core step, applied once; iterated to a fixed point below so a step
// core runs more than once cannot reveal a directive we did not check.
function stripOnce(core: CoreMessageText, text: string): string {
  const visible = sanitizeVisibleText(core, text).replaceAll('\\n', '\n');
  const parsed = core.parseInlineDirectives(
    core.stripFormattedReasoningMessage(visible),
    { stripAudioTag: true, stripReplyTags: true }
  );
  return core.stripPlainTextToolCallBlocks(
    core.stripUnsupportedCitationControlMarkers(parsed.text),
    { resolveProtectedRanges: findCodeRegions }
  );
}

const MAX_FIXED_POINT_PASSES = 10;

function fixedPointYieldsMedia(core: CoreMessageText, text: string): boolean {
  let current = text;
  for (let pass = 0; pass < MAX_FIXED_POINT_PASSES; pass += 1) {
    const next = stripOnce(core, current);
    if (textYieldsMedia(core, next)) return true;
    if (next === current) return false;
    current = next;
  }
  // Still changing after the cap: treat as media (fail closed).
  return true;
}

// Not a core step: invisible characters are removed as a precaution and the
// result checked alongside the original.
const INVISIBLE_CHARS = new RegExp(
  '[\\p{Co}\\p{Cf}\\u200B-\\u200D\\u2060\\uFEFF]',
  'gu'
);

/**
 * Whether core would deliver media for these `message` params. Mirrors the
 * message tool's send path on the raw params: sanitizeMessageToolVisiblePayload
 * on each body field, buildMessagePayload's alias promotion and text
 * normalization, then sendMessage's normalizeReplyPayloadsForDelivery. Each
 * body field and the built text are also run to a fixed point through every
 * step. Throws if core's functions cannot be loaded.
 */
export async function coreMessageYieldsMedia(
  params: Record<string, unknown>
): Promise<boolean> {
  const core = await loadCoreMessageText();
  const withoutInvisible = Object.fromEntries(
    Object.entries(params).map(([key, value]) => [
      key,
      typeof value === 'string' ? value.replace(INVISIBLE_CHARS, '') : value,
    ])
  );
  for (const raw of [params, withoutInvisible]) {
    const fields: Record<string, unknown> = { ...raw };
    for (const field of BODY_FIELDS) {
      const value = raw[field];
      if (typeof value === 'string') {
        fields[field] = sanitizeVisibleText(core, value);
      }
    }
    const text = buildMessageText(core, fields);
    if (textYieldsMedia(core, text) || fixedPointYieldsMedia(core, text)) {
      return true;
    }
    for (const field of BODY_FIELDS) {
      const value = raw[field];
      if (typeof value === 'string' && fixedPointYieldsMedia(core, value)) {
        return true;
      }
    }
  }
  return false;
}

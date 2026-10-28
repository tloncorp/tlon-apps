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

import { messageMediaKeyRefs } from './owner-only-tools.js';
import { markdownToStory } from './urbit/story.js';

type ParsedDirectives = { mediaUrls?: string[] };
type DeliveryPayload = {
  text?: string;
  mediaUrl?: string | null;
  mediaUrls?: string[];
};

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
    payloads: Array<{ text: string; mediaUrls?: string[] }>
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

// Core strips plain-text tool-call blocks with code regions protected on the
// send path, and without protection on plugin actions (`reply`, `edit`;
// message-action-execution.ts), so a reference fenced on one surfaces on the
// other. Every check runs both ways.
type StripMode = { protectCode: boolean };
const STRIP_MODES: StripMode[] = [
  { protectCode: true },
  { protectCode: false },
];

function stripToolCallBlocks(
  core: CoreMessageText,
  text: string,
  mode: StripMode
): string {
  return core.stripPlainTextToolCallBlocks(
    text,
    mode.protectCode ? { resolveProtectedRanges: findCodeRegions } : {}
  );
}

// buildMessagePayload (message-action-send.ts), text path only.
function buildMessageText(
  core: CoreMessageText,
  fields: Record<string, unknown>,
  mode: StripMode
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
  return stripToolCallBlocks(
    core,
    core.stripUnsupportedCitationControlMarkers(parsed.text),
    mode
  );
}

type ParsedMedia = { mediaUrl?: string | null; mediaUrls?: string[] };

function textMedia(core: CoreMessageText, text: string): string[] {
  const urls = (parsed: ParsedMedia) => [
    ...(parsed.mediaUrl ? [parsed.mediaUrl] : []),
    ...(parsed.mediaUrls ?? []),
  ];
  // sendMessage's outbound normalizer, and the directive parser on its own.
  return [
    ...core.normalizeReplyPayloadsForDelivery([{ text }]).flatMap(urls),
    ...urls(core.parseReplyDirectives(text, { extractMarkdownImages: true })),
  ];
}

// The attachments core would fetch for this text sent alongside the call's
// media keys: buildMessagePayload merges the keys into `mediaUrls`, and
// sendMessage's normalizer adds the body's directives and dedupes.
function deliveredDownloads(
  core: CoreMessageText,
  text: string,
  keyRefs: string[]
): { downloads: number; texts: string[] } {
  const payloads = core.normalizeReplyPayloadsForDelivery([
    { text, ...(keyRefs.length > 0 ? { mediaUrls: keyRefs } : {}) },
  ]);
  const urls = new Set(
    payloads.flatMap((payload) =>
      payload.mediaUrls?.length
        ? payload.mediaUrls
        : payload.mediaUrl
          ? [payload.mediaUrl]
          : []
    )
  );
  return {
    downloads: urls.size,
    texts: payloads.flatMap((payload) => payload.text ?? []),
  };
}

// Image blocks Tlon's story converter emits for a text as delivered.
function imageBlocks(text: string): number {
  return markdownToStory(text).filter(
    (verse) => 'block' in verse && 'image' in verse.block
  ).length;
}

// Every core step, applied once; iterated to a fixed point below so a step
// core runs more than once cannot reveal a directive we did not check.
function stripOnce(
  core: CoreMessageText,
  text: string,
  mode: StripMode
): string {
  const visible = sanitizeVisibleText(core, text).replaceAll('\\n', '\n');
  const parsed = core.parseInlineDirectives(
    core.stripFormattedReasoningMessage(visible),
    { stripAudioTag: true, stripReplyTags: true }
  );
  return stripToolCallBlocks(
    core,
    core.stripUnsupportedCitationControlMarkers(parsed.text),
    mode
  );
}

const MAX_FIXED_POINT_PASSES = 10;

/**
 * Stands in for media that could not be resolved; it is not an https URL, so
 * no rule admits it.
 */
export const UNRESOLVED_MEDIA = 'unresolved:fixed-point-cap';

function fixedPointMedia(
  core: CoreMessageText,
  text: string,
  mode: StripMode,
  observe: (text: string) => void
): string[] {
  const media: string[] = [];
  let current = text;
  for (let pass = 0; pass < MAX_FIXED_POINT_PASSES; pass += 1) {
    const next = stripOnce(core, current, mode);
    observe(next);
    media.push(...textMedia(core, next));
    if (next === current) return media;
    current = next;
  }
  // Still changing after the cap (fail closed).
  return [...media, UNRESOLVED_MEDIA];
}

// Not a core step: invisible characters are removed as a precaution and the
// result checked alongside the original.
const INVISIBLE_CHARS = new RegExp(
  '[\\p{Co}\\p{Cf}\\u200B-\\u200D\\u2060\\uFEFF]',
  'gu'
);

export type CoreMessageMedia = {
  /** Every distinct reference core could deliver, for the media rule. */
  media: string[];
  /**
   * The most attachments core would fetch for one resolved form of the call
   * (keys and body together, deduplicated as core delivers them).
   */
  downloads: number;
  /**
   * The most image blocks Tlon's story converter emits for one resolved
   * form of the body: the text core delivers on `send`, or the body as
   * written on `reply`.
   */
  imageBlocks: number;
};

/**
 * The media core could deliver for these `message` params' body. Mirrors the
 * message tool's send path on the raw params: sanitizeMessageToolVisiblePayload
 * on each body field, buildMessagePayload's alias promotion and text
 * normalization, then sendMessage's normalizeReplyPayloadsForDelivery. Each
 * body field and the built text are also run to a fixed point through every
 * step, with and without code protection (see STRIP_MODES); the result is the
 * union. Throws if core's functions cannot be loaded.
 */
export async function coreMessageMedia(
  params: Record<string, unknown>
): Promise<CoreMessageMedia> {
  const core = await loadCoreMessageText();
  const withoutInvisible = Object.fromEntries(
    Object.entries(params).map(([key, value]) => [
      key,
      typeof value === 'string' ? value.replace(INVISIBLE_CHARS, '') : value,
    ])
  );
  const keyRefs = [
    ...new Set(
      messageMediaKeyRefs(params).flatMap((ref) =>
        typeof ref === 'string' && ref.trim() ? [ref.trim()] : []
      )
    ),
  ];
  const media = new Set<string>();
  let downloads = 0;
  let images = 0;
  // Each resolved form of the body is an alternative; the largest counts.
  const observe = (text: string) => {
    const delivered = deliveredDownloads(core, text, keyRefs);
    downloads = Math.max(downloads, delivered.downloads);
    images = Math.max(
      images,
      imageBlocks(text),
      ...delivered.texts.map(imageBlocks)
    );
  };
  for (const raw of [params, withoutInvisible]) {
    const fields: Record<string, unknown> = { ...raw };
    for (const field of BODY_FIELDS) {
      const value = raw[field];
      if (typeof value === 'string') {
        fields[field] = sanitizeVisibleText(core, value);
        observe(value);
      }
    }
    for (const mode of STRIP_MODES) {
      const text = buildMessageText(core, fields, mode);
      observe(text);
      for (const url of [
        ...textMedia(core, text),
        ...fixedPointMedia(core, text, mode, observe),
      ]) {
        media.add(url);
      }
      for (const field of BODY_FIELDS) {
        const value = raw[field];
        if (typeof value !== 'string') continue;
        for (const url of fixedPointMedia(core, value, mode, observe)) {
          media.add(url);
        }
      }
    }
  }
  return { media: [...media], downloads, imageBlocks: images };
}

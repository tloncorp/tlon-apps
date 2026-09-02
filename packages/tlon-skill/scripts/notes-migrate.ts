import type { Post, Story } from '@tloncorp/api';

// Kept local because @tloncorp/api/urbit subpaths do not resolve under moduleResolution: Node.
export interface GroupChannelV7 {
  added: number;
  meta: {
    title: string;
    description: string;
    image: string;
    cover: string;
  };
  section: string;
  readers: string[];
  join: boolean;
}

export const MIGRATION_LIMITS = {
  HTTP_BATCH_ENVELOPE_BYTES: 512 * 1024,
  SOURCE_PAGE_SIZE: 100,
  MAX_SOURCE_POSTS: 5000,
  PREVIEW_TITLES: 4,
  NOTE_TITLE_MAX_CODE_POINTS: 80,
} as const;

export interface MigrationOptions {
  sourceNest: string;
  allowWriteWidening: boolean;
  yes: boolean;
}

export interface ChannelPerm {
  writers: string[];
  group: string;
}

export interface GroupInfo {
  privacy: 'public' | 'secret' | 'private';
  admins: string[];
  channels: Record<string, GroupChannelV7>;
}

export interface SourcePost {
  id: string;
  sequenceNum: number;
  title: string;
  image: string;
  sentAt: number;
  authorId: string;
  content: unknown;
  isDeleted: boolean;
  isSequenceStub: boolean;
  replyCount: number;
  reactionCount: number;
}

export interface ConvertedNote {
  postId: string;
  sequenceNum: number;
  title: string;
  body: string;
}

export interface ArchiveOnlyMetrics {
  totalComments: number;
  totalReactions: number;
  citeCount: number;
  linkBlockCount: number;
  groupMentionCount: number;
  /** Inline tags and block references. Flattened to their text, not dropped. */
  flattenedInlineCount: number;
}

export interface MigrationPlan {
  sourceNest: string;
  group: string;
  sourceTitle: string;
  targetTitle: string;
  eligibleCount: number;
  tombstoneCount: number;
  stubCount: number;
  previewTitles: string[];
  writeWidening: boolean;
  wideningReasons: string[];
  readerRoles: string[];
  writerRoles: string[];
  privacy: GroupInfo['privacy'];
  archiveTitle: string;
  metrics: ArchiveOnlyMetrics;
}

export interface MigrationDeps {
  getChannelPerm: (nest: string) => Promise<ChannelPerm>;
  getGroup: (flag: string) => Promise<GroupInfo>;
  getChannelPosts: (
    nest: string,
    cursor: string | undefined,
    mode: 'newest' | 'older',
    count: number
  ) => Promise<{
    posts: Post[];
    older: string | null;
    totalPosts: number;
  }>;
  createGroupNotebook: (input: {
    title: string;
    groupId: string;
    readers: string[];
    onCreated: (nest: string) => void;
  }) => Promise<string>;
  getNotebookDetail: (
    target: string
  ) => Promise<{ rootFolderId: number; host: string; flagName: string }>;
  listNotes: (
    target: string
  ) => Promise<{ title: string; bodyMd?: string | null }[]>;
  batchImport: (input: {
    flag: string;
    folder: number;
    notes: { title: string; body: string }[];
    requestId: string;
  }) => Promise<string>;
  getRawGroup: (groupId: string) => Promise<Record<string, unknown>>;
  updateChannel: (input: {
    groupId: string;
    channelId: string;
    channel: GroupChannelV7;
  }) => Promise<void>;
  getActingShip: () => string;
  assertServerIdentity: () => Promise<void>;
  storyToMarkdown: (story: Story) => string;
  storyToMdastStrict: (story: Story) => void;
  toUrbitStory: (content: unknown) => Story;
  generateRequestId: () => string;
  recoveryInstruction: (targetNest: string) => string;
  log: (message: string) => void;
}

export function canonicalizeNest(nest: string): string {
  const { kind, host, name } = parseNest(nest);
  return `${kind}/${host}/${name}`;
}

export function parseNest(nest: string): {
  kind: string;
  host: string;
  name: string;
} {
  const parts = nest.split('/');
  if (
    parts.length !== 3 ||
    parts.some((part) => part.length === 0) ||
    /\s/.test(nest)
  ) {
    throw new Error(`Invalid nest format: ${nest}. Expected: kind/~host/name`);
  }
  return {
    kind: parts[0],
    host: parts[1].startsWith('~') ? parts[1] : `~${parts[1]}`,
    name: parts[2],
  };
}

export function normalizeShip(ship: string): string {
  return ship.startsWith('~') ? ship : `~${ship}`;
}

export function normalizeTitle(title: string): string {
  return truncateTitle(title.normalize('NFC').replace(/\s+/g, ' ').trim());
}

export function truncateTitle(title: string): string {
  const max = MIGRATION_LIMITS.NOTE_TITLE_MAX_CODE_POINTS;
  const codePoints = [...title];
  if (codePoints.length <= max) return title;
  return `${codePoints
    .slice(0, max - 1)
    .join('')
    .trimEnd()}\u2026`;
}

function formatUtcDay(timestamp: number): string {
  const date = new Date(timestamp);
  if (!Number.isFinite(timestamp) || Number.isNaN(date.getTime())) {
    throw new Error(`Invalid post timestamp: ${timestamp}`);
  }
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * `%batch-import` cannot carry a post's original time, so the attribution line
 * in the body is the only surviving record of it once the source is archived.
 * Keep full precision there — a day is not recoverable back into a timestamp.
 * The title fallback deliberately stays day-granular; a clock time reads as
 * noise in a note title.
 */
function formatUtcTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  if (!Number.isFinite(timestamp) || Number.isNaN(date.getTime())) {
    throw new Error(`Invalid post timestamp: ${timestamp}`);
  }
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mi = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');
  return `${formatUtcDay(timestamp)} ${hh}:${mi}:${ss} UTC`;
}

export function deriveNoteTitle(
  post: SourcePost,
  convertedMarkdown?: string
): string {
  if (post.title.trim()) {
    return truncateTitle(post.title.trim());
  }
  if (convertedMarkdown) {
    const firstLine = convertedMarkdown
      .split('\n')
      .map((line) => line.trim())
      .find(Boolean);
    if (firstLine) return truncateTitle(firstLine);
  }
  return `Untitled \u2014 ${formatUtcDay(post.sentAt)}`;
}

export function deriveTargetTitle(
  sourceTitle: string | null | undefined,
  nestName: string
): string {
  return normalizeTitle(sourceTitle?.trim() ? sourceTitle : nestName);
}

export function buildAttributionLine(authorId: string, sentAt: number): string {
  return `*Originally posted by ${normalizeShip(authorId)} on ${formatUtcTimestamp(
    sentAt
  )}.*`;
}

export function buildProvenanceFooter(
  sourceNest: string,
  postId: string
): string {
  return `<!-- tlon-migrate: ${sourceNest} ${postId} -->`;
}

export function validateImageUrl(url: string): boolean {
  if (/[<>\\\s]/.test(url)) return false;
  for (let i = 0; i < url.length; i += 1) {
    const code = url.charCodeAt(i);
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) return false;
  }
  return true;
}

export function assembleNoteBody(input: {
  attributionLine: string;
  headerImageUrl: string | null;
  convertedMarkdown: string;
  provenanceFooter: string;
}): string {
  const blocks = [input.attributionLine];
  if (input.headerImageUrl) {
    blocks.push(`![](<${input.headerImageUrl}>)`);
  }
  if (input.convertedMarkdown) {
    blocks.push(input.convertedMarkdown);
  }
  blocks.push(input.provenanceFooter);
  return `${blocks.join('\n\n')}\n`;
}

export interface WriteWideningResult {
  widening: boolean;
  reasons: string[];
}

export function computeWriteWidening(input: {
  readerRoles: string[];
  writerRoles: string[];
  admins: string[];
  privacy: GroupInfo['privacy'];
}): WriteWideningResult {
  const reasons: string[] = [];
  const { readerRoles, writerRoles, admins, privacy } = input;
  const openReaders = readerRoles.length === 0;

  if (openReaders && writerRoles.length > 0) {
    reasons.push(
      'readers are open while writers are restricted, so all readers would gain write access'
    );
  }
  if (openReaders && privacy === 'public') {
    reasons.push(
      'the channel is public and open, so non-members who join would become editors'
    );
  }
  for (const role of readerRoles) {
    const writerAuthorizing =
      writerRoles.length === 0 ||
      writerRoles.includes(role) ||
      admins.includes(role);
    if (!writerAuthorizing) {
      reasons.push(
        `reader role "${role}" is not writer-authorizing and would gain write access`
      );
    }
  }
  return { widening: reasons.length > 0, reasons };
}

export interface ChunkEnvelopeContext {
  flag: string;
  folder: number;
  requestId: string;
}

export function measureEnvelopeBytes(
  notes: { title: string; body: string }[],
  ctx: ChunkEnvelopeContext
): number {
  return Buffer.byteLength(
    JSON.stringify({
      requestId: ctx.requestId,
      action: {
        type: 'notebook',
        flag: ctx.flag,
        action: {
          type: 'batch-import',
          folder: ctx.folder,
          notes: notes.map(({ title, body }) => ({ title, body })),
        },
      },
    }),
    'utf8'
  );
}

export function chunkNotes(
  notes: ConvertedNote[],
  byteCap: number,
  ctx: ChunkEnvelopeContext
): ConvertedNote[][] {
  const chunks: ConvertedNote[][] = [];
  let current: ConvertedNote[] = [];

  for (const note of notes) {
    const singleBytes = measureEnvelopeBytes([note], ctx);
    if (singleBytes > byteCap) {
      throw new Error(
        `Note ${note.postId} exceeds byte cap ${byteCap} as a single-note chunk (${singleBytes} bytes)`
      );
    }
    if (
      current.length > 0 &&
      measureEnvelopeBytes([...current, note], ctx) > byteCap
    ) {
      chunks.push(current);
      current = [];
    }
    current.push(note);
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

export function archiveTitle(sourceTitle: string, nestName: string): string {
  const base = sourceTitle.trim() || nestName;
  return base.endsWith('-ARCHIVE') ? base : `${base}-ARCHIVE`;
}

export function convertPost(
  post: SourcePost,
  sourceNest: string,
  deps: Pick<
    MigrationDeps,
    'storyToMarkdown' | 'storyToMdastStrict' | 'toUrbitStory'
  >
): ConvertedNote {
  let content = post.content;
  if (typeof content === 'string') {
    try {
      content = JSON.parse(content);
    } catch (error) {
      throw new Error(
        `Post ${post.id}: content is not valid JSON: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
  if (content !== null && !Array.isArray(content)) {
    throw new Error(
      `Post ${post.id}: content must be null or array, got ${typeof content}`
    );
  }

  let markdown: string;
  try {
    const story = deps.toUrbitStory(content);
    deps.storyToMdastStrict(story);
    markdown = deps.storyToMarkdown(story);
  } catch (error) {
    throw new Error(
      `Post ${post.id}: conversion failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  let headerImageUrl: string | null = null;
  if (post.image.trim()) {
    if (!validateImageUrl(post.image)) {
      throw new Error(
        `Post ${post.id}: header image URL contains invalid characters`
      );
    }
    headerImageUrl = post.image;
  }

  return {
    postId: post.id,
    sequenceNum: post.sequenceNum,
    title: deriveNoteTitle(post, markdown),
    body: assembleNoteBody({
      attributionLine: buildAttributionLine(post.authorId, post.sentAt),
      headerImageUrl,
      convertedMarkdown: markdown,
      provenanceFooter: buildProvenanceFooter(sourceNest, post.id),
    }),
  };
}

export function filterEligiblePosts(posts: SourcePost[]): {
  eligible: SourcePost[];
  tombstones: SourcePost[];
  stubs: SourcePost[];
} {
  const eligible: SourcePost[] = [];
  const tombstones: SourcePost[] = [];
  const stubs: SourcePost[] = [];
  for (const post of posts) {
    if (post.isSequenceStub) stubs.push(post);
    else if (post.isDeleted) tombstones.push(post);
    else eligible.push(post);
  }
  return { eligible, tombstones, stubs };
}

function visitInlines(
  inlines: unknown[],
  visitor: (inline: Record<string, unknown>) => void
): void {
  for (const inline of inlines) {
    if (!inline || typeof inline !== 'object') continue;
    const value = inline as Record<string, unknown>;
    visitor(value);
    for (const key of ['bold', 'italics', 'strike', 'blockquote']) {
      if (Array.isArray(value[key])) {
        visitInlines(value[key] as unknown[], visitor);
      }
    }
    const task = value.task;
    if (task && typeof task === 'object') {
      const taskContent = (task as Record<string, unknown>).content;
      if (Array.isArray(taskContent)) {
        visitInlines(taskContent, visitor);
      }
    }
  }
}

function visitListing(
  listing: unknown,
  visitor: (inline: Record<string, unknown>) => void
): void {
  if (!listing || typeof listing !== 'object') return;
  const value = listing as Record<string, unknown>;
  if (Array.isArray(value.item)) {
    visitInlines(value.item, visitor);
  }
  if (!value.list || typeof value.list !== 'object') return;
  const list = value.list as Record<string, unknown>;
  if (Array.isArray(list.contents)) {
    visitInlines(list.contents, visitor);
  }
  if (Array.isArray(list.items)) {
    for (const item of list.items) {
      visitListing(item, visitor);
    }
  }
}

function visitStoryInlines(
  story: Story,
  visitor: (inline: Record<string, unknown>) => void
): void {
  for (const verse of story) {
    if (!verse || typeof verse !== 'object') continue;
    const value = verse as unknown as Record<string, unknown>;
    if (Array.isArray(value.inline)) {
      visitInlines(value.inline, visitor);
    }
    if (!value.block || typeof value.block !== 'object') continue;
    const block = value.block as Record<string, unknown>;
    if (block.header && typeof block.header === 'object') {
      const content = (block.header as Record<string, unknown>).content;
      if (Array.isArray(content)) {
        visitInlines(content, visitor);
      }
    }
    if ('listing' in block) {
      visitListing(block.listing, visitor);
    }
  }
}

function countGroupMentions(story: Story): number {
  let count = 0;
  visitStoryInlines(story, (inline) => {
    if ('sect' in inline) count += 1;
  });
  return count;
}

// Tags and inline block references survive as their visible text but lose what
// they were. That is the same class of change the plan already discloses for
// group mentions, so it is reported the same way rather than left silent.
function countFlattenedInlines(story: Story): number {
  let count = 0;
  visitStoryInlines(story, (inline) => {
    if ('tag' in inline || 'block' in inline) count += 1;
  });
  return count;
}

export function countArchiveOnlyMetrics(
  posts: SourcePost[]
): ArchiveOnlyMetrics {
  const result: ArchiveOnlyMetrics = {
    totalComments: 0,
    totalReactions: 0,
    citeCount: 0,
    linkBlockCount: 0,
    groupMentionCount: 0,
    flattenedInlineCount: 0,
  };
  for (const post of posts) {
    result.totalComments += post.replyCount;
    result.totalReactions += post.reactionCount;
    let content = post.content;
    if (typeof content === 'string') {
      try {
        content = JSON.parse(content);
      } catch {
        continue;
      }
    }
    if (!Array.isArray(content)) continue;
    const story = content as Story;
    for (const verse of story) {
      if (!verse || typeof verse !== 'object') continue;
      const value = verse as unknown as Record<string, unknown>;
      if (
        value.type === 'reference' &&
        typeof value.referenceType === 'string'
      ) {
        result.citeCount += 1;
      }
      if (value.block && typeof value.block === 'object') {
        const block = value.block as Record<string, unknown>;
        if ('cite' in block) result.citeCount += 1;
        if ('link' in block) result.linkBlockCount += 1;
      }
    }
    result.groupMentionCount += countGroupMentions(story);
    result.flattenedInlineCount += countFlattenedInlines(story);
  }
  return result;
}

export function sortPostsBySequence(posts: SourcePost[]): SourcePost[] {
  return posts.slice().sort((a, b) => a.sequenceNum - b.sequenceNum);
}

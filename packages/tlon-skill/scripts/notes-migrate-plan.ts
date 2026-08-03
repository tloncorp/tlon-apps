import type { Post } from '@tloncorp/api';

import { commandError } from './commands/command';
import { assertActingShipIsHost } from './migrate-helpers';
import {
  type ConvertedNote,
  MIGRATION_LIMITS,
  type MigrationDeps,
  type MigrationOptions,
  type MigrationPlan,
  type SourcePost,
  archiveTitle,
  canonicalizeNest,
  chunkNotes,
  computeWriteWidening,
  convertPost,
  countArchiveOnlyMetrics,
  deriveTargetTitle,
  filterEligiblePosts,
  normalizeShip,
  parseNest,
  sortPostsBySequence,
} from './notes-migrate';

export const PREFLIGHT_ENVELOPE_CONTEXT = {
  flag: `~${'z'.repeat(64)}/${'z'.repeat(128)}`,
  folder: Number.MAX_SAFE_INTEGER,
  requestId: `0v${'v'.repeat(64)}`,
} as const;

export interface PreparedMigration {
  plan: MigrationPlan;
  convertedNotes: ConvertedNote[];
}

function requireSequenceNum(post: Post): number {
  if (
    post.isDeleted === true &&
    (post.sequenceNum === null || post.sequenceNum === undefined)
  ) {
    // The channels API normalizes a backend @ud 0 to null. Old tombstones can
    // legitimately carry that value, and they are counted for completeness
    // but never imported. Keep them sortable without relaxing validation for
    // any eligible post.
    return 0;
  }
  if (
    typeof post.sequenceNum !== 'number' ||
    !Number.isInteger(post.sequenceNum) ||
    post.sequenceNum < 0
  ) {
    throw commandError(
      `Source post ${post.id}: missing or malformed sequenceNum`
    );
  }
  return post.sequenceNum;
}

function getPostReactionCount(post: Post): number {
  const rawReactionCount = (post as Post & { rawReactionCount?: unknown })
    .rawReactionCount;
  if (
    typeof rawReactionCount === 'number' &&
    Number.isInteger(rawReactionCount) &&
    rawReactionCount >= 0
  ) {
    return rawReactionCount;
  }
  return Array.isArray(post.reactions) ? post.reactions.length : 0;
}

export function postToSourcePost(post: Post): SourcePost {
  if (!post.id || typeof post.id !== 'string') {
    throw commandError('Source returned a post with no id');
  }
  if (!post.authorId || typeof post.authorId !== 'string') {
    throw commandError(`Source post ${post.id}: missing authorId`);
  }
  if (typeof post.sentAt !== 'number' || !Number.isFinite(post.sentAt)) {
    throw commandError(`Source post ${post.id}: missing or malformed sentAt`);
  }
  return {
    id: post.id,
    sequenceNum: requireSequenceNum(post),
    title: typeof post.title === 'string' ? post.title : '',
    image: typeof post.image === 'string' ? post.image : '',
    sentAt: post.sentAt,
    authorId: post.authorId,
    content: post.content ?? null,
    isDeleted: post.isDeleted === true,
    isSequenceStub: post.isSequenceStub === true,
    replyCount:
      typeof post.replyCount === 'number' && post.replyCount >= 0
        ? post.replyCount
        : 0,
    reactionCount: getPostReactionCount(post),
  };
}

function assertTotalPosts(totalPosts: number, sourceNest: string): void {
  if (
    !Number.isInteger(totalPosts) ||
    totalPosts < 0 ||
    totalPosts > MIGRATION_LIMITS.MAX_SOURCE_POSTS
  ) {
    if (totalPosts > MIGRATION_LIMITS.MAX_SOURCE_POSTS) {
      throw commandError(
        `Source ${sourceNest}: ${totalPosts} posts exceeds the migration ceiling of ${MIGRATION_LIMITS.MAX_SOURCE_POSTS}`
      );
    }
    throw commandError(
      `Source ${sourceNest}: totalPosts is missing or malformed`
    );
  }
}

export async function readSourceComplete(
  sourceNest: string,
  deps: Pick<MigrationDeps, 'getChannelPosts'>
): Promise<SourcePost[]> {
  const posts: SourcePost[] = [];
  const postIds = new Set<string>();
  const seenCursors = new Set<string>();
  let cursor: string | undefined;
  let mode: 'newest' | 'older' = 'newest';
  let expectedTotal: number | undefined;

  while (true) {
    const page = await deps.getChannelPosts(
      sourceNest,
      cursor,
      mode,
      MIGRATION_LIMITS.SOURCE_PAGE_SIZE
    );
    assertTotalPosts(page.totalPosts, sourceNest);
    if (expectedTotal === undefined) expectedTotal = page.totalPosts;
    else if (page.totalPosts !== expectedTotal) {
      throw commandError(
        `Source ${sourceNest}: totalPosts changed across pages (${expectedTotal} → ${page.totalPosts})`
      );
    }

    const pagePosts = page.posts.map(postToSourcePost);
    if (mode === 'older' && pagePosts.length === 0) {
      throw commandError(
        `Source ${sourceNest}: non-null cursor yielded no new rows`
      );
    }
    for (const post of pagePosts) {
      if (postIds.has(post.id)) {
        throw commandError(
          `Source ${sourceNest}: duplicate post id ${post.id}`
        );
      }
      postIds.add(post.id);
      posts.push(post);
    }
    if (posts.length > MIGRATION_LIMITS.MAX_SOURCE_POSTS) {
      throw commandError(
        `Source ${sourceNest}: more than ${MIGRATION_LIMITS.MAX_SOURCE_POSTS} rows were returned`
      );
    }

    if (page.older === null) break;
    if (typeof page.older !== 'string' || page.older.length === 0) {
      throw commandError(`Source ${sourceNest}: malformed older cursor`);
    }
    if (seenCursors.has(page.older)) {
      throw commandError(
        `Source ${sourceNest}: repeated cursor "${page.older}"`
      );
    }
    seenCursors.add(page.older);
    cursor = page.older;
    mode = 'older';
  }

  const nonStubCount = posts.filter((post) => !post.isSequenceStub).length;
  if (nonStubCount !== expectedTotal) {
    throw commandError(
      `Source ${sourceNest}: completeness invariant failed — accumulated ${nonStubCount} non-stub rows but totalPosts is ${expectedTotal}`
    );
  }
  return sortPostsBySequence(posts);
}

function parseGroupHost(groupId: string): string {
  const parts = groupId.split('/');
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw commandError(
      `Source permission returned malformed group flag: ${groupId}`
    );
  }
  return normalizeShip(parts[0]);
}

// Absent or non-string `bodyMd` counts as "no provenance" rather than as an
// inspection failure, so such a note fails open and permits a re-migration.
// That is deliberate: the current backend always encodes a string body, and
// throwing here would block a legitimate migration on any deployment that does
// not, which is worse than allowing a duplicate the owner can delete. A read
// that throws still fails closed.
function hasSourceProvenanceLine(
  note: { bodyMd?: string | null },
  sourceNest: string
): boolean {
  if (typeof note.bodyMd !== 'string') return false;

  const prefix = `<!-- tlon-migrate: ${sourceNest} `;
  const suffix = ' -->';
  return note.bodyMd.split(/\r?\n/).some((line) => {
    if (!line.startsWith(prefix) || !line.endsWith(suffix)) return false;
    const postId = line.slice(prefix.length, -suffix.length);
    return postId.length > 0 && !/\s/.test(postId);
  });
}

export async function prepareMigration(
  options: MigrationOptions,
  deps: MigrationDeps
): Promise<PreparedMigration> {
  const sourceNest = canonicalizeNest(options.sourceNest);
  const source = parseNest(sourceNest);
  if (source.kind !== 'diary') {
    throw commandError(`Expected a diary/... nest, got: ${sourceNest}`);
  }

  const actingShip = normalizeShip(deps.getActingShip());
  assertActingShipIsHost(actingShip, source.host, 'source channel');

  const perm = await deps.getChannelPerm(sourceNest);
  if (!Array.isArray(perm.writers)) {
    throw commandError(
      `Source ${sourceNest}: writers are missing or malformed — refusing to assume open`
    );
  }
  const groupHost = parseGroupHost(perm.group);
  assertActingShipIsHost(actingShip, groupHost, 'source group');

  const group = await deps.getGroup(perm.group);
  const sourceChannel = group.channels[sourceNest];
  if (!sourceChannel) {
    throw commandError(
      `Source channel ${sourceNest} not found in group ${perm.group} — refusing to assume open readers`
    );
  }
  if (!Array.isArray(sourceChannel.readers)) {
    throw commandError(
      `Source channel ${sourceNest}: readers are missing or malformed — refusing to assume open`
    );
  }

  const rawSourceTitle = sourceChannel.meta.title;
  const trimmedSourceTitle = rawSourceTitle.trim();
  // An empty title falls back to the nest name in archiveTitle, but that does
  // not mean the source's actual title carries the migration marker.
  if (
    trimmedSourceTitle.length > 0 &&
    archiveTitle(rawSourceTitle, source.name) === trimmedSourceTitle
  ) {
    throw commandError(
      `Refusing to migrate ${sourceNest}: its title appears to have been migrated already. ` +
        `If that is incorrect, rename the source channel to remove the archive marker, then re-run the migration.`
    );
  }

  const sourceTitle = rawSourceTitle || source.name;
  const targetTitle = deriveTargetTitle(sourceTitle, source.name);
  const actingShipNotebookPrefix = `notes/${actingShip}/`;
  for (const [targetNest, channel] of Object.entries(group.channels)) {
    if (
      !targetNest.startsWith(actingShipNotebookPrefix) ||
      channel.meta.title !== targetTitle
    ) {
      continue;
    }

    const targetNotes = await deps.listNotes(targetNest);
    if (
      !targetNotes.some((note) => hasSourceProvenanceLine(note, sourceNest))
    ) {
      continue;
    }

    throw commandError(
      `Refusing to migrate ${sourceNest}: it appears to have already been migrated to ${targetNest}, which contains notes imported from this source. ` +
        `If that notebook should be kept, rename it or rename the source, then re-run the migration. ` +
        `To discard it instead, run \`tlon notes notebook-delete ${targetNest} --yes\`, then retry with \`tlon notes migrate-apply ${sourceNest} --yes\`.`
    );
  }

  const sortedPosts = await readSourceComplete(sourceNest, deps);
  const { eligible, tombstones, stubs } = filterEligiblePosts(sortedPosts);
  if (eligible.length === 0) {
    throw commandError(`Source ${sourceNest} has no eligible posts to migrate`);
  }

  const convertedNotes = eligible.map((post) =>
    convertPost(post, sourceNest, deps)
  );
  chunkNotes(
    convertedNotes,
    MIGRATION_LIMITS.HTTP_BATCH_ENVELOPE_BYTES,
    PREFLIGHT_ENVELOPE_CONTEXT
  );

  const widening = computeWriteWidening({
    readerRoles: sourceChannel.readers,
    writerRoles: perm.writers,
    admins: group.admins,
    privacy: group.privacy,
  });
  const metrics = countArchiveOnlyMetrics(sortedPosts);

  return {
    plan: {
      sourceNest,
      group: perm.group,
      sourceTitle,
      targetTitle,
      eligibleCount: eligible.length,
      tombstoneCount: tombstones.length,
      stubCount: stubs.length,
      previewTitles: convertedNotes
        .slice(0, MIGRATION_LIMITS.PREVIEW_TITLES)
        .map((note) => note.title),
      writeWidening: widening.widening,
      wideningReasons: widening.reasons,
      readerRoles: [...sourceChannel.readers],
      writerRoles: [...perm.writers],
      privacy: group.privacy,
      archiveTitle: archiveTitle(sourceTitle, source.name),
      metrics,
    },
    convertedNotes,
  };
}

export async function executePlan(
  options: MigrationOptions,
  deps: MigrationDeps
): Promise<PreparedMigration> {
  return prepareMigration(options, deps);
}

import {
  type SurfaceDeps,
  type SurfaceReport,
  emitReport,
  parseSurfaceArgs,
  singleValue,
  surfaceError,
  usageSurfaceError,
} from './surface-common';
import {
  readChannelSpec,
  requireChannelSpec,
  resolveSurfaceChannel,
} from './surface-writer';

/**
 * `tlon surface show <channel>` — read back what a channel publishes.
 *
 * This exists because nothing else returned it. `SKILL.md` has always told a
 * reviser to read the `recipe` it published "instead of re-deriving intent",
 * and no command emitted one: `surface state` returns the FOLD (state, not
 * definition), `channels info` prints `Description: (none)` over the very
 * cell that holds the spec, and the bundle lives behind an `assetRef` the
 * bot was never handed. Measured over eight revision turns, the authoring
 * loop read its own prior bundle zero times — after thirty-odd `read` calls
 * at guessed filenames — and consulted `recipe` once, by accident. Every
 * revision came back a regeneration, which is what "cannot reach the thing
 * it would edit" and "does not edit" look like when you cannot tell them
 * apart. This command is what makes them distinguishable.
 *
 * Three properties are load-bearing.
 *
 * **The definition is served RAW.** `spec` is the verbatim cell, parsed as
 * JSON and passed through nothing else. `SurfaceSpecSchema` is a `z.object`,
 * so it strips every key it does not declare — and the keys it does not
 * declare are exactly where gate opt-outs live (D67 and D72, twice, in two
 * different commands). A read-back path that handed back the validated view
 * would hand a reviser a spec that is missing the markers its own gate
 * requires, and the republish would fail a gate the original passed. Fields
 * ARE read off the validated spec where a single scalar is wanted (D72's own
 * rule: reading a field off the validated spec stays correct; handing back a
 * spec does not), and the two are labelled in the output so nobody has to
 * guess which they are holding.
 *
 * **Bundle bytes are verified or refused.** The bytes are fetched only when
 * asked for, checked against the sha256 the definition pins, and written
 * only if they match — the same discipline `getOrFetchBundle` applies client
 * side. Storage is transport, not trust; whoever holds the bucket does not
 * get to decide what this command hands back.
 *
 * **What is missing says so.** A definition published without a `recipe`
 * reports `recipe: null` and `recipePresent: false`, not an empty string; a
 * run without `--bundle-out` reports `fetched: false` rather than a
 * bundle-shaped object with nothing in it. A shape that reads as complete
 * over an absent part is the failure D99 is about.
 */

export const SURFACE_SHOW_HELP = `Usage: tlon surface show <channel> [--bundle-out <path>] [--json]

Read back what a dashboard channel currently publishes: its app definition
exactly as the channel holds it, the storage pointer for its bundle, and —
on request — the bundle's source.

This is the command to run BEFORE revising an app. The definition carries
the \`recipe\` the last publish wrote, which is what the app was asked to be;
the bundle is the code to edit. Reading them back beats re-deriving either.

The definition is reported RAW: the verbatim bytes of the channel's
description cell, parsed as JSON and nothing else. It is deliberately not a
schema-validated view, because the schema strips every key it does not
declare — including the gate opt-outs a republish needs. Edit what this
prints and republish it.

The bundle is NOT fetched unless --bundle-out asks for it. When it is, its
bytes are hashed and compared against the sha256 the definition pins before
anything is written, and a mismatch writes nothing: storage is transport,
not trust.

Options:
  --bundle-out <path>  Fetch the bundle from its assetRef, verify it against
                       the definition's sha256, and write it here. Refuses
                       on mismatch, and writes nothing when it refuses
  --json               Emit a machine-readable result
  -h, --help           Show this help

Example:
  tlon surface show chat/~zod/dash-abc --bundle-out app.js --json`;

/**
 * Schemes a bundle may be fetched over.
 *
 * The `assetRef` is data: it was written into a group's description cell by
 * whoever published last, and this command turns it into a request. `https`
 * is the production form. Plain `http` is admitted only on loopback, which
 * is the dev store `TLON_SURFACE_DEV_STORAGE` publishes to and the exact
 * rule that variable already enforces on the way in — so the two halves of
 * the dev path agree instead of one of them quietly widening the other.
 *
 * Everything else is refused unfetched. `file:` is the one that matters:
 * Bun's `fetch` resolves it, so without this an `assetRef` of
 * `file:///etc/passwd` would make the CLI read a local file on a channel
 * host's say-so. The hash would then reject the bytes — but the read has
 * already happened, and a refusal after the fact is not the same as not
 * doing it.
 */
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

export type AssetRefVerdict =
  | { ok: true; url: string }
  | { ok: false; detail: string };

export function classifyAssetRef(assetRef: string): AssetRefVerdict {
  let url: URL;
  try {
    url = new URL(assetRef);
  } catch {
    return { ok: false, detail: 'it is not a URL' };
  }
  if (url.protocol === 'https:') return { ok: true, url: url.href };
  if (url.protocol === 'http:') {
    if (LOOPBACK_HOSTS.has(url.hostname)) return { ok: true, url: url.href };
    return {
      ok: false,
      detail: `plain http is only fetched from loopback, and this points at ${url.hostname}`,
    };
  }
  return {
    ok: false,
    detail: `its scheme is "${url.protocol.replace(/:$/, '')}", and only https (or http on loopback) is fetched`,
  };
}

interface FetchedBundle {
  path: string;
  bytes: number;
  sha256: string;
}

/**
 * Fetches the bundle and writes it, or refuses.
 *
 * Every refusal carries a `reason` from the same vocabulary the client's
 * cache reports (`bundleCache.ts`), because a repair loop's next move
 * differs by reason and the sentence alone cannot be branched on:
 * `hash-mismatch` means the bucket is serving something the channel did not
 * publish and there is nothing to retry, while `fetch-failed` is worth one.
 *
 * Nothing is written before the hash matches. A file on disk is the thing
 * the bot will read, edit and republish, so writing unverified bytes there
 * would put them into the next spec under a hash that was never theirs.
 */
async function fetchVerifiedBundle(
  deps: SurfaceDeps,
  input: {
    channelId: string;
    assetRef: string;
    sha256: string;
    outPath: string;
  }
): Promise<FetchedBundle> {
  const verdict = classifyAssetRef(input.assetRef);
  if (!verdict.ok) {
    throw surfaceError(
      'bundle-unavailable',
      `${input.channelId} points its bundle at "${input.assetRef}", which was not fetched because ${verdict.detail}. The definition is still readable above; only the bytes are out of reach.`,
      {
        channel: input.channelId,
        reason: 'unsupported-scheme',
        assetRef: input.assetRef,
      }
    );
  }

  const fetched = await deps.fetchAsset({
    url: verdict.url,
    maxBytes: deps.caps.bundleSize,
  });
  if (!fetched.ok) {
    throw surfaceError(
      'bundle-unavailable',
      `${input.channelId}'s bundle could not be read from storage: ${fetched.detail}. The definition is still readable above; only the bytes are out of reach.`,
      {
        channel: input.channelId,
        reason: fetched.reason,
        assetRef: input.assetRef,
        expectedSha256: input.sha256,
      }
    );
  }

  // The authoritative size check, over the bytes actually in hand.
  //
  // The transport gets `maxBytes` so it can short-circuit an over-cap body on
  // its declared `Content-Length` before buffering it, but that header is
  // advisory — absent, or a lie — so it can only ever short-circuit. Exactly
  // the split the client draws between `fetchBundleText`'s pre-buffer check
  // and `getOrFetchBundle`'s measurement, and drawn here for the same reason:
  // the check that decides has to run over what was received, not over what
  // the sender claimed it was sending.
  if (fetched.bytes.byteLength > deps.caps.bundleSize) {
    throw surfaceError(
      'bundle-unavailable',
      `${input.channelId}'s bundle is larger than a surface bundle may be: storage served ${fetched.bytes.byteLength} bytes against a ${deps.caps.bundleSize}-byte cap. Nothing was written.`,
      {
        channel: input.channelId,
        reason: 'oversize',
        assetRef: input.assetRef,
        expectedSha256: input.sha256,
        bytes: fetched.bytes.byteLength,
        cap: deps.caps.bundleSize,
      }
    );
  }

  const observed = deps.sha256Hex(fetched.bytes);
  if (observed !== input.sha256) {
    throw surfaceError(
      'bundle-unavailable',
      `${input.channelId}'s bundle does not match the hash its definition pins: storage served ${fetched.bytes.byteLength} bytes hashing to ${observed}, and the definition names ${input.sha256}. Nothing was written. Storage is transport, not trust — these bytes are not the app this channel published, and there is nothing to retry.`,
      {
        channel: input.channelId,
        reason: 'hash-mismatch',
        assetRef: input.assetRef,
        expectedSha256: input.sha256,
        observedSha256: observed,
        bytes: fetched.bytes.byteLength,
      }
    );
  }

  deps.writeBinaryFile(input.outPath, fetched.bytes);
  return {
    path: input.outPath,
    bytes: fetched.bytes.byteLength,
    sha256: observed,
  };
}

/** `Object.prototype.hasOwnProperty`, without trusting the value's own. */
function has(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export async function runSurfaceShow(
  args: string[],
  deps: SurfaceDeps
): Promise<number> {
  const parsed = parseSurfaceArgs(
    args,
    { value: ['--bundle-out'], boolean: ['--json'] },
    SURFACE_SHOW_HELP
  );
  if (parsed.help) {
    deps.stdout(`${SURFACE_SHOW_HELP}\n`);
    return 0;
  }

  const asJson = parsed.flags.has('--json');
  const channelId = parsed.positional[0];
  if (!channelId) {
    throw usageSurfaceError('a channel id is required', SURFACE_SHOW_HELP);
  }
  if (parsed.positional.length > 1) {
    throw usageSurfaceError(
      `Unexpected argument: ${parsed.positional[1]}`,
      SURFACE_SHOW_HELP
    );
  }
  const outPath = singleValue(parsed, '--bundle-out');

  await deps.authenticate();
  const resolved = await resolveSurfaceChannel(deps, channelId);

  // One answer to "what does an unreadable definition mean". `readChannelSpec`
  // is called for the raw cell; when it is anything but valid, the refusal
  // comes from `requireChannelSpec` rather than from a second taxonomy
  // written here — absent, invalid and version-too-new are three different
  // situations with three different remedies, and they are already spelled.
  const read = readChannelSpec(deps, resolved.channel);
  if (read.status !== 'valid') {
    requireChannelSpec(deps, resolved);
    // Unreachable: `requireChannelSpec` throws on every non-valid status.
    // Kept as a throw rather than a fallthrough so a future status that
    // slipped past it cannot silently reach the raw-parse below.
    throw surfaceError(
      'spec-invalid',
      `${channelId}'s definition reads as "${read.status}", which this command has no reading for.`,
      { channel: channelId, status: read.status }
    );
  }

  // The RAW cell, verbatim. `read.raw` is what the ship holds and `read.spec`
  // is what survived the schema; this command emits the former and says so.
  // `status === 'valid'` means the text already parsed once, so no fallback
  // to the validated view is needed here — and none is offered, because a
  // fallback is how the stripped view gets back in (the same argument
  // `surface publish`'s read-back observation records).
  const rawSpec = JSON.parse(read.raw) as Record<string, unknown>;

  // Scalars come off the VALIDATED spec: they are declared fields, so the
  // schema cannot have touched them, and taking them from there is what
  // guarantees the sha256 used for verification is a 64-hex string and the
  // assetRef a non-empty one. D72's rule exactly — read a field off the
  // validated spec, never a spec.
  const bundleRef = read.spec.bundle;

  const recipePresent = has(rawSpec, 'recipe');
  const bundle: Record<string, unknown> = {
    assetRef: bundleRef.assetRef,
    sha256: bundleRef.sha256,
    size: bundleRef.size,
    shellVersion: bundleRef.shellVersion,
    fetched: false,
    verified: false,
    path: null,
  };

  let fetchedBundle: FetchedBundle | null = null;
  if (outPath !== undefined) {
    fetchedBundle = await fetchVerifiedBundle(deps, {
      channelId,
      assetRef: bundleRef.assetRef,
      sha256: bundleRef.sha256,
      outPath,
    });
    bundle.fetched = true;
    bundle.verified = true;
    bundle.path = fetchedBundle.path;
    bundle.bytes = fetchedBundle.bytes;
  }

  const report: SurfaceReport = {
    json: {
      channel: channelId,
      group: resolved.groupId,
      host: resolved.hostShip,
      surfaceId: read.spec.surfaceId,
      specRevision: read.spec.specRevision,
      // Named for what it IS, so a consumer cannot mistake it for the
      // schema's view of the same bytes. There is no validated spec in this
      // document at all — emitting both would be an invitation to read the
      // wrong one.
      specSource: 'raw-description-cell',
      spec: rawSpec,
      specText: read.raw,
      recipePresent,
      recipe: recipePresent ? rawSpec.recipe : null,
      bundle,
      observed:
        'the definition was read from the group listing that holds it, verbatim',
    },
    lines: [
      `${channelId} at revision ${read.spec.specRevision}`,
      `  surface:  ${read.spec.surfaceId}`,
      `  bundle:   ${bundleRef.assetRef}`,
      `  sha256:   ${bundleRef.sha256} (${bundleRef.size} bytes)`,
      fetchedBundle
        ? `  source:   ${fetchedBundle.path} (${fetchedBundle.bytes} bytes, sha256 verified against the definition)`
        : '  source:   not fetched — pass --bundle-out <path> to fetch and verify the bundle',
      recipePresent
        ? `  recipe:   ${JSON.stringify(rawSpec.recipe)}`
        : '  recipe:   none — this definition was published without one, so there is no recorded intent to read back',
      '',
      'Definition, exactly as the channel holds it (raw, not schema-validated):',
      JSON.stringify(rawSpec, null, 2),
    ],
  };
  return emitReport(deps, report, asJson);
}

# Surface Channels v0 — Session 1 decisions log

Working artifact for the surface-channels session described in
`surface-channels-handoff-prompt.md` (scope) and `surface-channels-plan.md`
(semantics). Every judgment call, deviation, and seam left for later gets a
line here.

## Ground-truthing report (step 1)

All eight claims verified against this checkout (b4cbe79d02). None failed; no
STOP condition hit.

1. **Post kind head must equal nest kind — VERIFIED.**
   `desk/app/channels-server.hoon:1086` (`ca-c-post` `%add` arm):
   `?>  =(kind.nest -.kind.essay.c-post)`. So `/chat/surface/...` kinds are
   valid in a `%chat` channel; a bare `/surface/...` kind would fail the
   assert. Note: the `%edit` arm (line 1106) does _not_ re-check the kind
   head; only `%add` does.
2. **Channel creation requires group admin — VERIFIED.**
   `desk/app/channels-server.hoon:1009–1020` (`can-nest`): looks up the
   creating ship's seat and requires a non-empty intersection with the
   group's admin role set; membership alone fails.
3. **TS post writers hardcode the kind — VERIFIED.**
   `packages/api/src/client/apiUtils.ts:229–261` (`toPostEssay`): kind is
   derived solely from `channelType` (`/diary`, `/heap`, `/chat`). Callers:
   `sendPost` (`postsApi.ts:196`) and `editPost` (`postsApi.ts:283`). The DM
   branch of `sendPost` separately hardcodes `/chat` (`postsApi.ts:179`).
4. **Config/payload module location — VERIFIED.**
   `packages/api/src/client/channelContentConfig.ts` holds
   `ChannelContentConfiguration`, `StructuredChannelDescriptionPayload`, and
   the renderer/draft-input registries (`allCollectionRenderers`,
   `allDraftInputs`, `allContentRenderers`).
5. **`JSONValue` is scalar-only — VERIFIED.**
   `packages/api/src/types/JSONValue.ts:1` (`number | string | boolean`),
   duplicated at `packages/api/src/urbit/channel.ts:308`. Unsuitable for
   recursive state; new `Json`/`JsonObject` types required, existing type
   left untouched.
6. **Sync extracts two fields; edits reconstruct from known fields —
   VERIFIED (the data-loss bug is real).**
   Read side: `packages/api/src/client/groupsApi.ts:1985` and `:2029`
   destructure only `description` + `channelContentConfiguration` from the
   decoded payload. Write side:
   `packages/shared/src/store/channelActions.ts:407–410` re-encodes the
   description from `channel.description` + `channel.contentConfiguration`
   only — a title/permissions edit through `updateChannel` would erase any
   other payload key (e.g. `surfaceSpec`). Notably
   `StructuredChannelDescriptionPayload.decode` itself already returns the
   raw parsed object (unknown keys survive decode); the loss happens at the
   extraction/reconstruction call sites.
7. **Post-blobs playbook — VERIFIED.**
   `docs/tlon-apps/post-blobs.md` exists with the versioning rule (design
   rule 1), registry-as-source-of-truth (rule 2), and unknown-entry
   degradation to `{ type: 'unknown' }` (rule 6). Registry lives at
   `packages/api/src/client/content-helpers.ts`
   (`postBlobDataEntryDefinitions`); the a2ui entry shows the sanctioned
   pattern for registering a schema defined in its own module
   (`A2UI.blobEntrySchema`).
8. **Edit state and sequence numbers in the client post model — VERIFIED.**
   Wire: `ub.Post.revision?: string` (`packages/api/src/urbit/channel.ts:135`);
   the Hoon `%edit` arm bumps `rev` (`channels-server.hoon:1122`). Client:
   `isEdited: 'revision' in post && post.revision !== '0'`
   (`packages/api/src/client/postsApi.ts:1357`) — only the boolean is
   persisted, not the raw counter, which is sufficient for the reducer's
   "reject any edited surface post" rule. `sequenceNum` comes from
   `post.seal.seq` (`postsApi.ts:1339–1342`), persisted on the post row
   (`packages/shared/src/db/schema.ts:1304`); replies have none; tombstones
   keep `seq` (`ub.PostTombstone`, `channel.ts:128`).

## Decisions

- **D1: Working docs are committed on this branch.** The handoff explicitly
  makes `DECISIONS.md` a review artifact alongside the diff, so it is
  committed (unlike the usual repo-root scratch-doc exclusion). The handoff
  prompt and plan stay untracked.
- **D2: Commit cadence.** Local commits per handoff step, as instructed; no
  pushes, no PR — those remain Patrick's.

# AGENTS.md — packages/api (@tloncorp/api)

Owns talking to the ship: the HTTP/SSE client (`src/http-api/`), the session
and request primitives (`src/client/urbit.ts`), the desk request registry
(`src/client/requests/`), per-domain wrappers (`src/client/*Api.ts`), Hoon wire
types (`src/urbit/`), API models (`src/types/models.ts`), post content and blob
codecs (`src/client/content-helpers.ts`, `src/client/postContent.ts`), and desk
version constants (`src/lib/deskVersion.ts`).

It owns no persistence, React or sync policy. It is the bottom of the package
graph (`api < shared < ui < app < apps/*`): importing `@tloncorp/shared` here
is a lint error, and UI or platform modules (Tamagui, Expo) don't belong here
either. Bots (`packages/openclaw`, `tlon-skill`)
consume it from npm, so helpers both the app and bots need belong here, and
app concerns stay out. Inside the package, `lib` → `http-api` → `urbit` →
`client`; a lower layer never imports a higher one.

## Adding or changing a desk request

1. Add an entry to `requests/<agent>.ts`: `kind`, `agent`, `path`/`mark`, and
   `since` (the oldest %groups release serving it). Path params are `{hole}` or
   `{hole*}`; never concatenate paths. Over HTTP the care is stripped: scry
   `/groups/...`, not `/x/groups/...`.
2. For a poke, add its mark → payload type in `requests/payloads.ts`.
3. Call it through its helper (`scryRequest(channels.search)<T>(params)`).
   `tlon/no-raw-desk-request` rejects raw `scry`/`poke`/`subscribe`.
4. If only the current desk serves it, name a guard from `GUARDS`
   (`requests/types.ts`) in `guardedBy`, with `since` equal to the guard's
   version; `requests/floor.test.ts` enforces this. A guarded call is refused
   only once the desk is known not to serve it, and sent while that is still
   unknown.
5. Entries for agents outside %groups (hood, docket, settings, storage) carry
   `desk: 'base' | 'landscape'` and are exempt from the version floor. Bot-only
   modules listed in `oxlint/desk-request-scope.json` keep raw requests and
   must stay unreachable from app code.

N-1 is about the *host's* desk as well as the user's: data such as a group's
channel list comes from the host, so a user on an older desk can reach a
feature their own ship lacks. See `docs/tlon-apps/desk-compatibility.md`.

## Rules

- Wrappers convert wire types (`ub.*`) to API models before returning.
  Subscription wrappers emit typed update unions (`ChannelsUpdate` in
  `channelsApi.ts`) with an `unknown` variant; never hand raw wire events to
  shared.
- Trust the typed contract. The backend is ours and typed: cast own-ship
  responses to their wire type. Don't hand-roll `isRecord`-walking parsers,
  duplicate wire types, or add guards and `try/catch` for shapes the desk
  cannot send.
- `MIN_GROUPS_VERSION` records the N-1 floor and is raised only at release.
  It is never the lever for shipping a new desk dependency.
- Version-gated endpoint choice reads capability flags in `client/urbit.ts`
  (`getActivitySupportsNotes`, `getDeskSupportsBuckets`, …), which shared's
  sync sets from the backend version. An unparseable version falls back to the
  endpoint every backend serves.
- Session-scoped code checks `getClientGeneration()` before acting on a reauth
  or retry result; logout or an account switch can happen mid-flight.
- Post blobs: follow `docs/tlon-apps/post-blobs.md`. Register a new entry
  schema in `postBlobDataEntryDefinitions` (no ad hoc `parsePostBlob`
  branches), add an `appendXToPostBlob` helper if more than one place writes
  it, update the attachment unions and `toPostData`, then
  `convertContent` and the `PostContent` block types, and register rendering in
  `packages/app/ui/components/PostContent/BlockRenderer.tsx`. Unknown entries
  must still render the "Upgrade your app" blockquote. Frontend blob edits are
  unsupported: edits preserve the original blob. No Hoon change is needed; the
  backend relays `blob` as opaque text.

Tests: vitest (`src/__tests__/`, colocated), including valid and malformed
payloads for every new blob entry.

## Code Review Rules

Flag:

- A desk request that bypasses the registry, or a registry entry whose
  `since`/`guardedBy` doesn't match the desk release that serves it.
- A client dependency on a path or mark only the current desk serves, with no
  guard.
- `api` importing shared, UI or platform modules.
- New parsers, wire-type copies or defensive guards around responses from our
  own desk.

Do not flag:

- `desk: 'base' | 'landscape'` entries for lacking a %groups `since` floor.
- Raw requests inside bot-only modules listed in
  `oxlint/desk-request-scope.json`.

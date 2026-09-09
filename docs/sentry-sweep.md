# Sentry sweep

Every 10 minutes, `scripts/sentry-sweep.mjs` (run by `.github/workflows/sentry-sweep.yml`;
edit its `cron:` line to change the schedule) queries Sentry for issues that are new
(`is:unresolved firstSeen:><boundary>`) or regressed (`is:regressed lastSeen:><boundary>`)
since the last run and builds a deterministic digest — no model involved. Each issue line
goes to PostHog as one `Sentry Issue Alert` event, and a PostHog webhook destination (set up
once, below) posts them into the Tlon alert channel with credentials PostHog already holds,
so GitHub Actions never needs a ship cookie.

Secrets/vars (Settings → Secrets and variables → Actions):

| Name | Kind | Purpose |
| --- | --- | --- |
| `SENTRY_SWEEP_TOKEN` | secret | Sentry token; scopes `event:read`, `project:read`, `org:read` |
| `POST_HOG_API_KEY_PROD` | secret | project token of the PostHog project that hosts the alert destinations (Groups Mobile PRODUCTION); the same secret production mobile builds already use |

Dry run: Actions → Sentry sweep → Run workflow → keep `dry_run` checked; the job
prints the digest into the run log, sends nothing and keeps state. The digest is a
header line (UTC timestamp, regressed/new totals, per-project `regressed/new`), then
up to 15 issue lines — kind, project, shortId as a link, title, `N events / M users`
— then an "and N more" line linking the Sentry `is:regressed` / `is:new` queries.

State (`.sentry-sweep/state.json`: last-run boundary + reported ids) lives in the
Actions cache; a cache miss is harmless — the sweep falls back to a 30-minute
window. Reported issues dedupe for 24h; an issue that stays regressed after that
is reported once more, then quiets for another 24h. Any failure (Sentry or
PostHog) exits 1 and leaves the state untouched, so the next run re-reports the
same window. A live run (schedule, or dispatch with dry_run unchecked) fails
before sweeping if POST_HOG_API_KEY_PROD is unset, so a missing key cannot
silently turn the sweep into a no-op. Token and key never appear in output.

## PostHog destination (one-time setup)

For the PostHog owner, in the project that holds the existing "Alert: …"
destinations: type **HTTP Webhook** (`template-webhook`), filter on event name
`Sentry Issue Alert`, URL/method/headers identical to those destinations, body:

```json
{ "channel": { "nest": "chat/~litseb-sarfel/v1nnn22o", "action": { "post": { "add": {
  "sent": 0, "author": "~botsen-lomlex",
  "content": [ { "inline": [ "{event.properties.text} ", { "link": { "href": "{event.properties.permalink}", "content": "{event.properties.shortId}" } } ] } ],
  "kind-data": { "chat": null } } } } } }
```

`MORE` events (the capped "… and N more" line) render the same way; their link is
the Sentry `is:regressed` search. PostHog delivers events asynchronously, so a
run's lines can arrive out of order — the per-line `kind`/`project` prefix in
`text` keeps them readable.

Local run (drop `--dry-run` to send for real); tests: `node --test scripts/sentry-sweep.test.mjs`.

```sh
SENTRY_TOKEN=... SWEEP_STATE=/tmp/sweep-state.json POSTHOG_API_KEY=... \
node scripts/sentry-sweep.mjs --dry-run --print-post  # digest + PostHog batch JSON
```

The script also keeps a direct mode that pokes `%channels` through Eyre on an
alert moon (`TLON_POST_URL`, `TLON_POST_SHIP`, `TLON_POST_NEST`,
`TLON_POST_COOKIE`); it is off unless all four are set, and the workflow does not
use it. With both configured, PostHog is sent first.

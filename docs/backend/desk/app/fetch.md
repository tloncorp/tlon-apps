# %fetch

Retrieves third-party web content on the client's behalf. Supersedes `%metagrab` and `%dumb-proxy`, which it replaces wholesale.

Both of those agents existed for the same reason, and differed only in what they handed back. A browser cannot fetch an arbitrary third-party URL itself — the target does not send CORS headers — so the ship fetches on the client's behalf. `%metagrab` returned metadata parsed out of the page; `%dumb-proxy` returned the response mostly as-is. One agent, one binding, mode in the path.

## concept: modes

A **mode** is what the caller wants back from the same URL. It is part of the cache key, because the same URL means different things in different modes.

| Mode | Behaviour | Cached |
|------|-----------|--------|
| `%meta` | Issues its own `HEAD` (escalating to `GET` for html), parses the body via `/lib/metagrab`, returns JSON metadata. | yes, `~m5` |
| `%raw` | Forwards the inbound request's method, headers (minus the caller's credentials and hop-by-hop headers) and body; relays the response back, sandboxed. | no |

`%raw` is deliberately general rather than scoped to one use. It exists so the client can reach content it cannot fetch directly — oembed endpoints being the immediate case, but favicons, RSS, and readability extraction are the same problem.

## endpoints

```
/apps/groups/~/fetch/meta/[@uw-url]   %meta
/apps/groups/~/fetch/raw/[@uw-url]    %raw
```

The target is an `@uw`-encoded URL string, as it was for both predecessors.

Two legacy bindings are also served, so that clients which have not moved to `/fetch` keep working:

```
/apps/groups/~/metagrab/[@uw-url]     -> %meta
/apps/groups/~/proxy/[@uw-url]        -> %raw
```

These are the pre-`%fetch` endpoints and exist only for the transition. The client itself still calls `/metagrab` (`base.metagrab` in the request registry), because that path works on desks before and after `%fetch`; moving it to `/fetch/meta` needs a guarded registry entry. They can be dropped once no client uses them; nothing but the two `%connect` cards in `+on-init` and two lines of route dispatch in `+on-poke` has to change.

`%meta` responses are JSON: `fetched_at`, `status`, and a `result` whose shape depends on the status. A `%200` carries either `{type: 'page', ...buckets}` or `{type: 'file', mime, size}`. See `+give-response`.

`%raw` responses relay the upstream status code, headers, and body, with an `x-tlon-fetch` header appended (`finished`, `cancelled`, or `too-large`).

## relaying from the ship's origin

A relayed response is served from the ship's own origin, with the caller's session in the browser, so `%raw` treats both directions as crossing a trust boundary:

- **Request.** The caller's credentials for the ship never reach the target: `cookie`, `authorization` (a reverse proxy in front of the ship may pass one through) and `host` are dropped, along with hop-by-hop headers and any header a `connection` header names.
- **Response.** Headers that would act on the ship's origin are dropped: `set-cookie`, `set-cookie2`, `clear-site-data`, `strict-transport-security`, `service-worker-allowed`, plus hop-by-hop headers. Every relayed response gets `content-security-policy: sandbox` and `x-content-type-options: nosniff`, so an upstream HTML page opened directly runs in an opaque origin with scripts disabled rather than as the ship. Clients that `fetch` the bytes are unaffected; CSP governs documents.
- **Redirects.** Iris is asked for none, so a 3xx is relayed and followed by the browser, never by the ship (see [address guard](#address-guard)).

## state model

```hoon
+$  mode    ?(%meta %raw)
+$  target  [=mode url=@t]
+$  state-0
  $:  %0
      cache=(map target response)  ::  cached results (%meta only)
      await=(jug target @ta)       ::  pending, w/ response targets
      trail=(jug @t @t)            ::  redirection trail for policy
  ==
```

`%fetch` is a new agent rather than a renamed one, so it starts at `state-0` with nothing to migrate. Inheriting `%metagrab`'s cache would have bought nothing: it is disposable by construction, and `+on-load` clears `cache` and `trail` anyway rather than reasoning about staleness across an upgrade.

`await` maps a target to the set of eyre request ids waiting on it, so that N concurrent callers for the same URL produce one upstream request. `%raw` does not use `await` or `cache` — each inbound request gets exactly one upstream request, and the eyre id rides in the wire.

## invariants

**Redirects are resolved here, not by iris.** `+fetch` passes `redirects=0`, so `%meta` follows `Location` itself. This is what makes loop detection possible, and the cost is the bookkeeping in `+on-arvo`. The `[trail 1]`–`[trail 6]` markers in the comment above `+on-poke` carry a proof that no redirect loop can occur, and the marked lines in `+on-poke` and `+on-arvo` are what the proof rests on. **Do not move or drop those lines without re-reading the proof** — two of them exist specifically to stop cache poisoning from two separate trails forming a loop between them.

**The origin URL rides in a header.** `original-url` is set on the first request of a trail and preserved across redirects, so `+on-arvo` can find the trail a response belongs to. It is how `trail` stays keyed by origin rather than by hop.

## address guard

`+unsafe-target` refuses a URL before any request is issued, in both modes, and again on each redirect hop so that a redirect is not a way around it. It rejects:

- IPv4 literals in `0/8`, `10/8`, `127/8`, `169.254/16`, `172.16/12`, `192.168/16`
- hostnames in a local-only TLD (`localhost`, `internal`, `local`)

**This raises the floor; it is not a boundary.** A public hostname that *resolves* to a private address still gets through, because resolution happens in the runtime and we never see the result. Closing that would need either a resolver in Hoon or runtime support for pinning the resolved address. Worth knowing before treating `%raw` as safe to point anywhere — it matters most for self-hosted ships, which sit on a LAN with things worth reaching.

`%dumb-proxy` had no guard at all and forwarded to any URL it was handed, so this is strictly better than what it replaces — but it is not the whole job.

## authentication

`+on-poke` opens with `?> =(our src):bowl`, inherited from both predecessors, and that is the access gate — it just doesn't look like one.

Eyre's `+deal-as` (`sys/vane/eyre.hoon`) pokes the bound agent as **the session identity's ship**, not as `our`:

```hoon
=/  from=@p
  ?@  identity  identity
  ?+(-.identity who.identity %ours our)
```

An authenticated local session resolves to `%ours` and therefore to `our`. A guest session resolves to something else — eyre deliberately makes sure a guest identity is never `our`, to prevent escalation. So `?> =(our src):bowl` nacks for any unauthenticated caller, the poke returns a `%coup`, and eyre answers 500.

Two practical consequences:

- **These endpoints are not an open proxy**, contrary to how `%dumb-proxy` reads at a glance. Its lack of an `authenticated.request` check is not the whole story.
- **You cannot smoke-test them with a plain `curl`.** An unauthenticated request produces a bare 500 and *no trace anywhere* — `+handle-gall-error` receives the crash tang but discards it, because by then it cannot find the connection state. Verifying by hand needs a logged-in session; otherwise every request looks like an agent bug.

## limits

`+max-relay` caps a `%raw` body at 4MiB, over which we answer `502` with `x-tlon-fetch: too-large`. Iris hands us the whole body at once, so **this cannot stop the ship from fetching something huge** — only from relaying it back into eyre. A real cap needs streaming support the runtime does not offer.

There is no request timeout: iris's `outbound-config` only has `redirects` and `retries`, so we cannot set one even though we would like to. This is inherited from both predecessors.

`redirects` does matter. Iris follows 301, 303 and 307 itself while redirects remain, and it does so without our address guard, so both modes send `redirects=0`. `%meta` follows redirects itself and checks every hop. `%raw` relays the 3xx to the caller unchanged, so a redirect is followed by the browser, never by the ship.

## what this agent is not

`%fetch` is **not** the outbound half of the hook layer, and the two should not be merged later despite both being "the ship makes an HTTP request." They have opposite requirements:

| | `%fetch` | hook layer outbound |
|---|---|---|
| talks to | arbitrary untrusted URLs | our own services |
| auth | none | per-ship credential |
| needs | address guard, caching | retry queue, idempotency keys |
| on failure | return an error to the caller | must not silently drop |

The header comment on `app/fetch.hoon` says this too, deliberately, because the agent's name invites the merge.

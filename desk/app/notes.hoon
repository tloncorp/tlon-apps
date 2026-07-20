::  notes: shared notebook Gall agent (dual-mode host/subscriber)
::
/-  n=notes, mcp-proxy
/+  default-agent, dbug, verb, server
/=  notes-json  /lib/notes/json
::  static web assets, imported straight from files and served as-is. The
::  agent sets each response's content-type explicitly (see below), so the
::  import marks only need to carry the raw bytes.
/*  ui-index        %html  /app/notes/ui/html
/*  share-page      %html  /app/notes/share/html
/*  openapi-spec    %json  /app/notes/openapi/json
/*  manifest        %json  /app/notes/manifest/json
/*  service-worker  %js    /app/notes/service-worker/js
/*  favicon-svg     %svg   /app/notes/favicon/svg
/*  icon-svg        %svg   /app/notes/icon/svg
::
|%
+$  card  card:agent:gall
+$  current-state  state-15:n
--
::
=|  current-state
=*  state  -
::
%-  agent:dbug
%^  verb  |  %warn
^-  agent:gall
=<
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %|) bowl)
    cor   ~(. +> [bowl ~])
::
++  on-init
  ^-  (quip card _this)
  =^  cards  state
    abet:init:cor
  [cards this]
::
++  on-save
  ^-  vase
  !>(state)
::
++  on-load
  |=  old=vase
  ^-  (quip card _this)
  =^  cards  state
    abet:(load:cor old)
  [cards this]
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  =^  cards  state
    abet:(poke:cor mark vase)
  [cards this]
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
  =^  cards  state
    abet:(watch:cor `(pole knot)`path)
  [cards this]
::
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  (peek:cor `(pole knot)`path)
::
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  =^  cards  state
    abet:(agent:cor `(pole knot)`wire sign)
  [cards this]
::
++  on-arvo
  |=  [=wire =sign-arvo]
  ^-  (quip card _this)
  =^  cards  state
    abet:(arvo:cor wire sign-arvo)
  [cards this]
::
++  on-leave  on-leave:def
++  on-fail   on-fail:def
--
::  helper core
::
|_  [=bowl:gall cards=(list card)]
++  dummy  'freeze-requests-13-snapshot-v1'
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
::
++  init
  ^+  cor
  ::  mint an api-key on fresh install. Operators can rotate via the
  ::  %regenerate-api-key action; %clear-api-key disables the bypass.
  =.  api-key  `(scot %uv eny.bowl)
  %-  emil
  :~  [%pass /eyre/notes %arvo %e %connect [~ /notes] %notes]
      [%pass /cleanup/requests %arvo %b %wait (add now.bowl ~m5)]
      ::  watch %groups so we can revoke read access on group-mode notebooks
      ::  when the fleet/roles change (see +recheck-group-access).
      [%pass /groups %agent [our.bowl %groups] %watch /v1/groups]
  ==
::  +load: state-15 is current. The only supported prior state is state-14
::  (ships that took the 14 transition) — it carried the now-removed
::  rid-counter, so we migrate it. Older standalone states aren't supported
::  (alpha, tiny install base): they land here and fail to mold, which is an
::  acceptable reset. groups-hosted %notes otherwise inits fresh (channels
::  suspends any standalone %notes desk and force-starts ours via kiln rein).
::
++  load
  |=  =vase
  ^+  cor
  |^
  =+  !<(old=any-state vase)
  =?  old  ?=(%14 -.old)  (state-14-to-15 old)
  ?>  ?=(%15 -.old)
  =.  state  old
  ::  NB: no api-key mint here. +on-init mints one on fresh install; at load
  ::  an empty api-key means an operator ran %clear-api-key, and re-minting
  ::  would silently re-enable the X-Api-Key bypass they disabled.
  ::  (re)establish the %groups watch for revocation. idempotent: skip if a
  ::  subscription on this wire already exists (e.g. fresh installs from +init).
  =?  cor  !(~(has by wex.bowl) [/groups our.bowl %groups])
    (emit [%pass /groups %agent [our.bowl %groups] %watch /v1/groups])
  ::  re-establish the eyre binding for the HTTP surface. +init binds /notes,
  ::  but a re-homed agent reaches +load WITHOUT +init (e.g. %groups reins
  ::  %notes over a suspended standalone desk, whose eyre binding was torn
  ::  down), so without this the HTTP + MCP surface 404/500s. Re-connecting an
  ::  already-bound path is harmless — eyre's %bound ack is ignored in +arvo.
  ::  Also (re)start the request cleanup timer (stacking timers is fine).
  %-  emil
  :~  [%pass /eyre/notes %arvo %e %connect [~ /notes] %notes]
      [%pass /cleanup/requests %arvo %b %wait (add now.bowl ~m5)]
  ==
  ::
  +$  any-state
    $%  state-15:n
        state-14:n
    ==
  ::  state-14-to-15: drop the vestigial rid-counter; all other fields carry.
  ::
  ++  state-14-to-15
    ~>  %spin.['state-14-to-15']
    |=  s=state-14:n
    ^-  state-15:n
    [%15 books.s next-id.s published.s invites.s requests.s api-key.s]
  --
::
++  poke
  |=  [=mark =vase]
  ^+  cor
  |^
  ?+  mark  ~|(bad-mark+mark !!)
      %handle-http-request
    (serve-http !<([eyre-id=@ta =inbound-request:eyre] vase))
  ::
      %notes-action
    ::  Legacy mark — funnel through the v1 request/response loop so
    ::  there's a single dispatch path. Synthesizes a fresh @uv from
    ::  bowl.eny. Callers that don't track responses (tests, ad-hoc
    ::  dojo pokes) just ignore the resulting fact on /v1/request/<uv>.
    ?>  =(our.bowl src.bowl)
    =+  !<(act=action:n vase)
    =/  rid=request-id:v1:n  `@uv`eny.bowl
    (dispatch-v1-action [rid act])
  ::
      %notes-action-1
    ::  Cross-agent / internal poke entry. HTTP POST goes directly to
    ::  +handle-v1-post which checks auth (eyre cookie OR X-Api-Key) and
    ::  invokes +dispatch-v1-action without the src.bowl guard.
    ?>  =(our.bowl src.bowl)
    =+  !<(act=action:v1:n vase)
    (dispatch-v1-action act)
  ::
      %notes-command-1
    ::  v1 cross-ship command — wraps c-notes with a request-id.
    =+  !<(cmd1=command:v1:n vase)
    =/  rid  request-id.cmd1
    =/  cmd  c-notes.cmd1
    ?-    -.cmd
        %notify-invite
      ::  apply the invite locally, then emit a %no-change response-update
      ::  on the request path so the sender's no-agent-req-watch finalizes.
      =.  cor  (handle-notify-invite flag.cmd title.cmd src.bowl)
      =/  =path
        :+  %v1  %notes
        /(scot %p ship.flag.cmd)/[name.flag.cmd]/request/(scot %p src.bowl)/(scot %uv rid)
      %-  give
      [%fact ~[path] notes-response-update-1+!>(`response-update:v1:n`[rid [%no-change ~]])]
    ::
        %notebook
      =*  flag  flag.cmd
      ?>  =(ship.flag our.bowl)
      ?>  (~(has by books) flag)
      se-abet:(se-poke-v1:(se-abed:se-core flag) rid c-notebook.cmd)
    ==
  ::
      %group-channel-join
    ::  channel-host convention: %groups auto-joins this notes nest as the
    ::  group fleet grows. Same-ship poke. We host it or already joined →
    ::  nothing to do; otherwise subscribe to the host like a normal %join.
    ?>  =(our.bowl src.bowl)
    =+  !<(j=channel-join:n vase)
    =/  =flag:n  [host.nest.j name.nest.j]
    ?:  =(our.bowl ship.flag)  cor
    ?:  (~(has by books) flag)  cor
    =/  rid=request-id:v1:n  `@uv`eny.bowl
    (join-remote-v1 rid flag)
  ::
      %group-channel-leave
    ::  channel-host convention: %groups auto-leaves when the channel is
    ::  removed or we lose access. We host it → ignore (group delete drives
    ::  removal); a subscriber → drop the subscription.
    ?>  =(our.bowl src.bowl)
    =+  !<(l=channel-leave:n vase)
    =/  =flag:n  [host.nest.l name.nest.l]
    ?:  =(our.bowl ship.flag)  cor
    ?.  (~(has by books) flag)  cor
    =/  rid=request-id:v1:n  `@uv`eny.bowl
    (leave-remote-v1 rid flag)
  ==
  --
::  +serve-http: dispatch an HTTP request to the right responder.
::  Order: v1 API → PWA static assets → published note → share redirect → UI fallback.
::
++  serve-http
  |=  [eyre-id=@ta =inbound-request:eyre]
  ^+  cor
  ::  parse the URL exactly once, with the zuse URL grammar (apat splits
  ::  path segments + a trailing file extension off the last segment;
  ::  yque splits the query string into key/value pairs). Every branch
  ::  below dispatches on the parsed `site` segment list / `ext` / `args`
  ::  — no raw string prefixes or hardcoded scag/slag lengths.
  =/  =request-line:server
    (parse-request-line:server url.request.inbound-request)
  =*  site  site.request-line
  =*  ext   ext.request-line
  =*  args  args.request-line
  =/  method=@tas  method.request.inbound-request
  ::  openapi spec — served public so an MCP proxy can fetch it without
  ::  having to invent an auth scheme. The spec is metadata, not a side
  ::  channel into agent state. JSON only because %mcp-proxy parses
  ::  cached specs with de:json:html and doesn't accept YAML.
  ?:  &(=(site ~[%notes %openapi]) =(ext `%json))
    (give-http eyre-id 200 'application/json' (en:json:html openapi-spec))
  ::  v1 HTTP API: POST /notes/~/v1, GET /notes/~/v1/request/<uv>,
  ::  GET /notes/~/v1/notebooks[...] + /notes/~/v1/invites (read surface)
  ?:  =(site ~[%notes %~.~ %v1])
    ?:  =(%'POST' method)  (handle-v1-post eyre-id inbound-request)
    (http-error eyre-id 405 'method not allowed')
  ?:  ?=([%notes %~.~ %v1 %request @ ~] site)
    ?.  =(%'GET' method)
      (http-error eyre-id 405 'method not allowed')
    ::  the @uv rid carries dots; apat mistook its trailing dot-group for a
    ::  file extension and split it off, so glue the ext back on before
    ::  handing the rid down.
    =/  rid-knot=@t
      ?~  ext  i.t.t.t.t.site
      (rap 3 i.t.t.t.t.site '.' u.ext ~)
    (handle-v1-get-request eyre-id rid-knot inbound-request)
  ?:  ?=([%notes %~.~ %v1 *] site)
    =/  pax=(list @t)  t.t.t.site
    ::  other /notes/~/v1/* — GET reads, POST/PATCH/DELETE first-class writes
    ?:  =(%'GET' method)  (handle-v1-read eyre-id pax inbound-request)
    ::  vere's runtime HTTP server rejects PATCH (400 before reaching the
    ::  agent), so note-body updates use PUT.
    ?:  ?=(?(%'POST' %'PUT' %'DELETE') method)
      =/  recursive=?
        %+  lien  args
        |=  [key=@t value=@t]
        &(=(key 'recursive') =(value 'true'))
      (handle-v1-write eyre-id method pax recursive inbound-request)
    (http-error eyre-id 405 'method not allowed')
  ::  PWA-related static assets: manifest, service worker, icons.
  ::  Each returns [body content-type] or ~. Served scoped under
  ::  /notes/ so the SW can control the app's URL space.
  =/  asset=(unit [body=@t ct=@t])
    ?:  &(=(site ~[%notes %manifest]) =(ext `%json))
      `[(en:json:html manifest) 'application/manifest+json']
    ?:  &(=(site ~[%notes %sw]) =(ext `%js))
      ::  text/javascript is required by some browsers for SW registration.
      `[service-worker 'text/javascript']
    ?:  &(=(site ~[%notes %icon]) =(ext `%svg))
      `[icon-svg 'image/svg+xml']
    ?:  &(=(site ~[%notes %favicon]) =(ext `%svg))
      `[favicon-svg 'image/svg+xml']
    ~
  ::  /notes/pub/~ship/name/{note-id} → serve archived published HTML
  =/  pub-html=(unit @t)
    ?.  ?=([%notes %pub @ @ @ ~] site)  ~
    ?~  ship-u=(slaw %p i.t.t.site)  ~
    ?~  nid-u=(slaw %ud i.t.t.t.t.site)  ~
    ?:  =(0 u.nid-u)  ~
    =/  =flag:n  [u.ship-u `@tas`i.t.t.t.site]
    (~(get by published) [flag u.nid-u])
  ::  /notes/share/~ship/name → serve the share-redirect page
  =/  share-html=(unit @t)
    ?.  ?=([%notes %share @ @ ~] site)  ~
    ?~  (slaw %p i.t.t.site)  ~
    `share-page
  =/  body=@t
    ?^  asset       body.u.asset
    ?^  pub-html    u.pub-html
    ?^  share-html  u.share-html
    ui-index
  =/  ct=@t
    ?^  asset  ct.u.asset
    'text/html'
  (give-http eyre-id 200 ct body)
::  +handle-v1-post: parse a v1 action from the POST body, register the
::  request with eyre-id as http-id (so the HTTP request is held open
::  until finalize-request emits the response), then dispatch.
::
::  Parsing is defensive — malformed bodies return 400, never crash to a
::  500. `requestId` is OPTIONAL: clients (esp. LLM tool-callers) often
::  can't produce a valid @uv, so if it's absent or unparseable we mint
::  one server-side. The minted id rides back in the response, so the
::  polling / SSE fallback still works; the common held-open POST path
::  doesn't need the client to know it at all.
::
++  handle-v1-post
  |=  [eyre-id=@ta =inbound-request:eyre]
  ^+  cor
  ?.  (request-authorized inbound-request)
    (http-error eyre-id 401 'unauthorized')
  ::  auth verified — act as the host. eyre gives an X-Api-Key or guest
  ::  browser session a non-host src.bowl; a valid api-key / session IS the
  ::  host's capability, so the effective actor for the action is our.bowl.
  =.  src.bowl  our.bowl
  ?~  body.request.inbound-request
    (http-error eyre-id 400 'missing body')
  ?~  jon=(de:json:html q.u.body.request.inbound-request)
    (http-error eyre-id 400 'invalid json')
  ?.  ?=([%o *] u.jon)
    (http-error eyre-id 400 'body must be a json object')
  ?~  act-j=(~(get by p.u.jon) 'action')
    (http-error eyre-id 400 'missing `action` field')
  ::  parse the a-notes; a bad action shape is a client error, not a 500
  =/  a-res=(each a-notes:n tang)
    (mule |.((action:dejs:notes-json u.act-j)))
  ?:  ?=(%| -.a-res)
    (http-error eyre-id 400 'malformed action')
  =/  a-act=a-notes:n  p.a-res
  ::  resolve requestId: honor a valid client @uv, else mint one
  =/  rid=request-id:v1:n
    =/  rj=(unit json)  (~(get by p.u.jon) 'requestId')
    ?.  ?&(?=(^ rj) ?=([%s *] u.rj))
      `@uv`eny.bowl
    =/  parsed=(each @uv tang)  (mule |.((slav %uv p.u.rj)))
    ?:(?=(%& -.parsed) p.parsed `@uv`eny.bowl)
  ::  register with eyre-id so the in-flight HTTP request is tracked
  =.  requests
    %+  ~(put by requests)  rid
    [rid `eyre-id %sending ~ ~ |]
  ::  dispatch directly — auth already verified above; skipping the
  ::  +poke %notes-action-1 arm's src.bowl gate, which would reject the
  ::  request when eyre delivered it unauthenticated but we let it
  ::  through on a valid X-Api-Key.
  (dispatch-v1-action [rid a-act])
::  +handle-v1-get-request: respond with the current state of a request.
::  Path remainder is the @uv id. If the request has a terminal result,
::  mark fetched=& so cleanup can evict it sooner. Auth-gated like the
::  POST: a request-id is not a capability — without cookie / X-Api-Key
::  this would leak note content and typed error details to anyone who
::  guessed (or sniffed) the rid.
::
++  handle-v1-get-request
  |=  [eyre-id=@ta rid-knot=@t =inbound-request:eyre]
  ^+  cor
  ?.  (request-authorized inbound-request)
    (http-error eyre-id 401 'unauthorized')
  =/  rid=request-id:v1:n  (slav %uv ;;(@ta rid-knot))
  ?~  req=(~(get by requests) rid)
    (http-error eyre-id 404 'request not found')
  =/  body=response-body:v1:n
    ?~  result.u.req  [%pending poke-status.u.req]
    u.result.u.req
  =.  requests
    (~(put by requests) rid u.req(fetched &))
  (give-http-response eyre-id [rid body])
::  +give-json-response: emit a 200 application/json HTTP response with
::  an arbitrary json payload (read endpoints; not the v1 response shape).
::
++  give-json-response
  |=  [eyre-id=@ta =json]
  ^+  cor
  (give-http eyre-id 200 'application/json' (en:json:html json))
::  +read-notebooks-json: the cross-cutting notebook list, filtered to
::  notebooks the caller can view. Mirrors the /x/v0/notebooks scry.
::  Identity for the v1 read API is always our.bowl: request-authorized
::  has already confirmed the caller is either the logged-in user
::  (cookie) or a trusted bot holding the api-key (acting as us). We
::  can't use src.bowl — an X-Api-Key request isn't eyre-authenticated,
::  so its src.bowl is not our.bowl and would filter out everything.
::
++  read-notebooks-json
  ^-  json
  %-  notebook-summaries:enjs:notes-json
  %+  murn  ~(tap by books)
  |=  [=flag:n [* =notebook-state:n]]
  ?.  (can-view-flag flag our.bowl)  ~
  `[flag [notebook visibility]:notebook-state]
::  +read-invites-json: pending invites we've received.
::
++  read-invites-json
  ^-  json
  %-  invite-records:enjs:notes-json
  %+  turn  ~(tap by invites)
  |=  [=flag:n info=invite-info:n]
  [flag info]
::  +handle-v1-read: GET read surface under /notes/~/v1/. Auth-gated the
::  same as POST (cookie OR X-Api-Key) so a bot with only a key can read
::  as well as write — the v0 scry paths require a cookie. JSON out.
::
::    /notes/~/v1/notebooks
::    /notes/~/v1/notebooks/{host}/{name}
::    /notes/~/v1/notebooks/{host}/{name}/folders
::    /notes/~/v1/notebooks/{host}/{name}/folders/{id}
::    /notes/~/v1/notebooks/{host}/{name}/notes
::    /notes/~/v1/notebooks/{host}/{name}/notes/{id}
::    /notes/~/v1/notebooks/{host}/{name}/notes/{id}/history
::    /notes/~/v1/notebooks/{host}/{name}/members
::    /notes/~/v1/invites
::
++  handle-v1-read
  |=  [eyre-id=@ta pax=(list @t) =inbound-request:eyre]
  ^+  cor
  ?.  (request-authorized inbound-request)
    (http-error eyre-id 401 'unauthorized')
  ::  serve-http already stripped "/notes/~/v1/" — pax is the remaining
  ::  path segments, parsed once via apat:de-purl:html. Retype (not
  ::  reparse) to `path` for the existing knot-typed switch/lookups below.
  =/  =path  ;;(path pax)
  ?+    path  (http-error eyre-id 404 'unknown read path')
      [%notebooks ~]
    (give-json-response eyre-id read-notebooks-json)
  ::
      [%invites ~]
    (give-json-response eyre-id read-invites-json)
  ::
      [%notebooks @ @ *]
    =/  =flag:n  [(slav %p i.t.path) `@tas`i.t.t.path]
    ?~  (~(get by books) flag)
      (http-error eyre-id 404 'notebook not found')
    ?~  jon=(no-read-json:(no-abed:no-core flag) t.t.t.path)
      (http-error eyre-id 404 'not found')
    (give-json-response eyre-id u.jon)
  ==
::  +field-cord / +field-ud: lenient reads of one key from a json object
::  for the write endpoints. Return ~ on a missing key or wrong json shape,
::  so a cheap model sending a slightly-off body gets a 400, not a 500.
::
++  field-cord
  |=  [obj=(map @t json) key=@t]
  ^-  (unit @t)
  ?~  v=(~(get by obj) key)  ~
  (mole |.((so:dejs:format u.v)))
::
++  field-ud
  |=  [obj=(map @t json) key=@t]
  ^-  (unit @ud)
  ?~  v=(~(get by obj) key)  ~
  (mole |.((ni:dejs:format u.v)))
::  +field-flag: read a flag object {host, flagName} from a JSON body field.
::  ~ if absent or malformed (so callers can treat it as optional).
::
++  field-flag
  |=  [obj=(map @t json) key=@t]
  ^-  (unit flag:n)
  ?~  v=(~(get by obj) key)  ~
  %-  mole  |.
  =/  raw
    %.  u.v
    %-  ot:dejs:format
    :~  ['host' (su:dejs:format ;~(pfix sig fed:ag))]
        ['flagName' so:dejs:format]
    ==
  `flag:n`[-.raw `@tas`+.raw]
::  +field-readers: read a JSON array of role-id strings into (set @tas).
::  absent / malformed / non-string elements → dropped; absent field or
::  empty array → empty set (open channel). role-ids are reinterpreted as
::  terms (they always are valid terms on the wire).
::
++  field-readers
  |=  [obj=(map @t json) key=@t]
  ^-  (set @tas)
  ?~  v=(~(get by obj) key)  ~
  ?.  ?=([%a *] u.v)  ~
  %-  ~(gas in *(set @tas))
  %+  murn  p.u.v
  |=  j=json
  ^-  (unit @tas)
  ?~  s=(mole |.((so:dejs:format j)))  ~
  ``@tas``@`u.s
::  +build-write-action: translate a REST write (method + path segments +
::  json body) into an a-notes action, or ~ if the shape isn't recognized
::  / required fields are missing. These are the "first-class" convenience
::  endpoints — flat bodies, no discriminated-union construction, easier
::  for weak models than the generic submitAction.
::
::  PATCH note body: expectedRevision is optional. When supplied it rides
::  through to se-update-note's strict concurrency check (same as the UI).
::  When omitted we fall back to the note's current revision — a plain
::  last-write-wins for callers that don't track revisions.
::
++  build-write-action
  |=  [method=@tas pax=path obj=(map @t json) recursive=?]
  ^-  (unit a-notes:n)
  ?:  &(=(%'POST' method) ?=([%notebooks ~] pax))
    ?~  title=(field-cord obj 'title')  ~
    ::  group present → born-in-group (defers reads to the group, carries
    ::  the group role-readers); else a plain solo notebook.
    ?~  grp=(field-flag obj 'group')
      `[%create-notebook u.title]
    `[%create-group-notebook u.title u.grp (field-readers obj 'readers')]
  ?.  ?=([%notebooks @ @ *] pax)  ~
  ?~  host=(slaw %p i.t.pax)  ~
  =/  =flag:n  [u.host `@tas`i.t.t.pax]
  =/  sub=path  t.t.t.pax
  ?+    [method sub]  ~
  ::
      [%'POST' [%notes ~]]
    ?~  folder=(field-ud obj 'folder')  ~
    ?~  title=(field-cord obj 'title')  ~
    =/  body-str=@t  (fall (field-cord obj 'body') '')
    `[%notebook flag [%create-note u.folder u.title body-str]]
  ::
      [%'POST' [%folders ~]]
    ::  `folderName` rather than `name` because the path already has a
    ::  `{name}` (notebook slug) — mcp-proxy flattens path + body into a
    ::  single tool input, and a colliding `name` would conflate the two.
    ?~  fname=(field-cord obj 'folderName')  ~
    ?~  parent=(field-ud obj 'parent')  ~
    `[%notebook flag [%create-folder u.parent u.fname]]
  ::
      [%'PUT' [%folders @ ~]]
    ?>  ?=([%folders @ ~] sub)
    ?~  fid=(slaw %ud i.t.sub)  ~
    =/  new-name=(unit @t)     (field-cord obj 'folderName')
    =/  new-parent=(unit @ud)  (field-ud obj 'parent')
    ?:  &(?=(~ new-name) ?=(~ new-parent))  ~
    `[%notebook flag [%folder u.fid [%update new-name new-parent]]]
  ::
      [%'DELETE' [%folders @ ~]]
    ?>  ?=([%folders @ ~] sub)
    ?~  fid=(slaw %ud i.t.sub)  ~
    `[%notebook flag [%folder u.fid [%delete recursive]]]
  ::
      [%'DELETE' [%notes @ ~]]
    ?>  ?=([%notes @ ~] sub)
    ?~  nid=(slaw %ud i.t.sub)  ~
    `[%notebook flag [%note u.nid [%delete ~]]]
  ::
      [%'PUT' [%notes @ ~]]
    ?>  ?=([%notes @ ~] sub)
    ?~  nid=(slaw %ud i.t.sub)  ~
    ::  body present → %update (revision-checked content edit).
    ::  else title or folder present → %modify (rename and/or move).
    ?^  body-str=(field-cord obj 'body')
      =/  exp-rev=@ud
        ?^  er=(field-ud obj 'expectedRevision')  u.er
        ::  fall back to current revision (last-write-wins)
        ?~  entry=(~(get by books) flag)  0
        ?~  note=(~(get by notes.notebook-state.u.entry) u.nid)  0
        revision.u.note
      `[%notebook flag [%note u.nid [%update u.body-str exp-rev]]]
    =/  new-title=(unit @t)   (field-cord obj 'title')
    =/  new-folder=(unit @ud)  (field-ud obj 'folder')
    ?:  &(?=(~ new-title) ?=(~ new-folder))  ~
    `[%notebook flag [%note u.nid [%modify new-title new-folder]]]
  ==
::  +handle-v1-write: POST/PATCH/DELETE first-class write endpoints under
::  /notes/~/v1/notebooks[...]. Auth-gated like everything else; builds an
::  a-notes via build-write-action and routes through the same
::  dispatch-v1-action loop as the generic submitAction. requestId is
::  always minted server-side here (no envelope to carry one).
::
++  handle-v1-write
  |=  [eyre-id=@ta method=@tas pax=(list @t) recursive=? =inbound-request:eyre]
  ^+  cor
  ?.  (request-authorized inbound-request)
    (http-error eyre-id 401 'unauthorized')
  ::  auth verified — act as the host (see +handle-v1-post)
  =.  src.bowl  our.bowl
  =/  obj=(map @t json)
    =/  jon=(unit json)
      ?~  body.request.inbound-request  ~
      (de:json:html q.u.body.request.inbound-request)
    ?.  ?&(?=(^ jon) ?=([%o *] u.jon))  ~
    p.u.jon
  ::  pax is already the parsed path tail from serve-http; retype (not
  ::  reparse) to `path` for +build-write-action's existing knot-typed
  ::  matching. recursive (?recursive=true) is likewise parsed once in
  ::  serve-http, from the query args yque split out.
  ?~  act=(build-write-action method ;;(path pax) obj recursive)
    (http-error eyre-id 400 'unsupported write — check method, path, and required fields')
  =/  rid=request-id:v1:n  `@uv`eny.bowl
  =.  requests  (~(put by requests) rid [rid `eyre-id %sending ~ ~ |])
  (dispatch-v1-action [rid u.act])
::
++  watch
  |=  =(pole knot)
  ^+  cor
  ?+  pole  ~|(bad-watch-path+pole !!)
      [%http-response *]
    cor
  ::
      [%v0 %notes ship=@ name=@ %updates ~]
    ::  remote subscriber watching our hosted notebook's update stream
    =/  =flag:n  [(slav %p ship.pole) `@tas`name.pole]
    ?>  =(our.bowl ship.flag)
    se-abet:se-watch:(se-abed:se-core flag)
  ::
      [%v0 %notes ship=@ name=@ %stream ~]
    ::  local UI subscription for any notebook (pub or sub)
    =/  =flag:n  [(slav %p ship.pole) `@tas`name.pole]
    no-abet:no-watch:(no-abed:no-core flag)
  ::
      [%v0 %inbox %stream ~]
    ?>  =(src.bowl our.bowl)
    cor
  ::
      [%v0 %said ship=@ name=@ %note id=@ ~]
    ::  single-shot note reference preview: answer from state if we can,
    ::  else proxy one watch to the host and relay its answer in +agent.
    =/  =flag:n  [(slav %p ship.pole) `@tas`name.pole]
    =/  nid=@ud  (slav %ud id.pole)
    ?:  ?|  =(our.bowl ship.flag)
            (~(has by books) flag)
        ==
      (give-said ~ flag nid src.bowl)
    ::  refuse to fetch over the network on another ship's behalf
    ?>  =(src.bowl our.bowl)
    =/  =wire  /said/(scot %p ship.flag)/[name.flag]/note/(scot %ud nid)
    ?:  (~(has by wex.bowl) [wire ship.flag %notes])
      cor
    (emit %pass wire %agent [ship.flag %notes] %watch (said-path flag nid))
  ::
      [%v1 %notes ship=@ name=@ %request requester=@ id=@ ~]
    ::  Per-request path. Subscribers attach here while awaiting their
    ::  response-update. Path's `ship`/`name` segment is the notebook
    ::  flag's identity, NOT the ship hosting this watch — the host
    ::  emitting on this path is whoever the requester is calling (a
    ::  notebook host, an invitee, etc). Only invariant: src.bowl must
    ::  match the requester segment, so a ship can't snoop on another
    ::  ship's request stream.
    =/  req-ship=ship  (slav %p requester.pole)
    ?>  =(src.bowl req-ship)
    cor
  ::
      [%v1 %request id=@ ~]
    ::  local SSE per-request stream. If we already hold a terminal
    ::  result, send it now so the subscriber doesn't need to poll GET.
    ?>  =(src.bowl our.bowl)
    =/  rid=request-id:v1:n  (slav %uv id.pole)
    ?~  req=(~(get by requests) rid)  cor
    ?~  result.u.req  cor
    %-  give
    :+  %fact  ~
    notes-response-1+!>(`response:v1:n`[rid u.result.u.req])
  ==
::
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  ?+  pole  ~
    ::  /x/ui — serve the frontend
      [%x %ui ~]
    ``html+!>(ui-index)
    ::  /x/v0/notebooks — list all notebooks (cross-cutting, no flag)
      [%x %v0 %notebooks ~]
    =/  summaries=(list notebook-summary:n)
      %+  murn  ~(tap by books)
      |=  [=flag:n [* =notebook-state:n]]
      ?.  (can-view-flag flag src.bowl)  ~
      `[flag [notebook visibility]:notebook-state]
    ``notes-notebooks+!>(summaries)
    ::  /x/v0/published — list of {host, flagName, noteId} for each published note
      [%x %v0 %published ~]
    =/  pub-records=(list published-record:n)
      %+  turn  ~(tap by published)
      |=  [[=flag:n note-id=@ud] *]
      [flag note-id]
    ``notes-published+!>(pub-records)
    ::  /x/v0/invites — pending invites we've received
      [%x %v0 %invites ~]
    =/  inv-records=(list invite-record:n)
      %+  turn  ~(tap by invites)
      |=  [=flag:n info=invite-info:n]
      [flag info]
    ``notes-invites+!>(inv-records)
    ::  /x/debug/dummy — current ++dummy value for tooling readiness checks
      [%x %debug %dummy ~]
    ``json+!>(s+dummy)
    ::  /x/v0/api-key — current X-Api-Key value as a JSON string, or null
    ::  if cleared. Gated to the local user; never leaks to remote callers.
      [%x %v0 %api-key ~]
    ?.  =(src.bowl our.bowl)  ~
    =/  jon=json  ?~(api-key ~ s+u.api-key)
    ``json+!>(jon)
    ::  /x/v0/mcp-status — does this ship have %mcp-proxy installed?
    ::  Used by the UI to decide whether to surface the "Connect to MCP"
    ::  action. Local-only.
      [%x %v0 %mcp-status ~]
    ?.  =(src.bowl our.bowl)  ~
    =/  jon=json
      %-  pairs:enjs:format
      ~[['installed' b+mcp-proxy-installed]]
    ``json+!>(jon)
  ::
      [%u %joined host=@ name=@ ~]
    =/  =flag:n  [(slav %p host.pole) `@tas`name.pole]
    ``loob+!>((~(has by books) flag))
    ::  /x/v0/<kind>/<ship>/<name>[/<rest>] — delegate to no-peek
  ::
      [%x %v0 kind=@ ship=@ name=@ rest=*]
    =/  =flag:n  [(slav %p ship.pole) `@tas`name.pole]
    ?~  (~(get by books) flag)  ~
    (no-peek:(no-abed:no-core flag) kind.pole rest.pole)
  ==
::
++  agent
  |=  [=(pole knot) =sign:agent:gall]
  ^+  cor
  ?+  pole  ~|(bad-agent-wire+pole !!)
      ::  %groups revocation watch. We avoid a groups-sur dependency by
      ::  extracting just the changed group's flag from the r-groups fact
      ::  ([flag r-group] — flag is the head) and rechecking only the
      ::  subscribers of notebooks bound to that group.
      [%groups ~]
    ?+  -.sign  cor
        %watch-ack  cor
        %kick
      (emit [%pass /groups %agent [our.bowl %groups] %watch /v1/groups])
        %fact
      ::  r-groups fact is [flag r-group]; decode just the flag head.
      =+  !<([=flag:n *] q.cage.sign)
      (recheck-group-access flag)
    ==
  ::
      [%notes %sub ship=@ name=@ ~]
    =/  =flag:n
      [(slav %p ship.pole) `@tas`name.pole]
    ?.  (~(has by books) flag)
      cor
    no-abet:(no-agent:(no-abed:no-core flag) sign)
  ::
      [%notes %join ship=@ name=@ ~]
    =/  =flag:n
      [(slav %p ship.pole) `@tas`name.pole]
    ?+  -.sign  cor
        %poke-ack
      ?~  p.sign
        ::  poke succeeded — host has added us, now subscribe
        no-abet:no-start-watch:(no-abed:no-core flag)
      ::  poke failed — remove placeholder from books
      =.  books  (~(del by books) flag)
      cor
    ==
  ::
      [%notes %invite who=@ ship=@ name=@ ~]
    ?+  -.sign  cor
        %poke-ack  cor
    ==
  ::
      [%notes ship=@ name=@ %create ~]
    ?+  -.sign  cor
        %poke-ack
      ?~  p.sign  cor
      ((slog leaf+"notes: adding channel to %groups failed" u.p.sign) cor)
    ==
      ::  ack from +no-report-active's %groups active-channels poke
  ::
      [%report-active ~]
    ?+  -.sign  cor
        %poke-ack
      ?~  p.sign  cor
      ((slog leaf+"notes: active-channel report to %groups failed" u.p.sign) cor)
    ==
  ::
      [%notes %leave ship=@ name=@ ~]
    ::  Best-effort %member-leave to host on +leave-remote. We don't act
    ::  on the ack — the local entry is already gone either way.
    ?+  -.sign  cor
        %poke-ack  cor
    ==
  ::
      [%said ship=@ name=@ %note id=@ ~]
    ::  proxied note-preview answer from a notebook host: relay to our
    ::  /v0/said subscribers (nack/foreign mark coerced to %notes-denied).
    =/  =flag:n  [(slav %p ship.pole) `@tas`name.pole]
    =/  nid=@ud  (slav %ud id.pole)
    =/  paths=(list path)  ~[(said-path flag nid)]
    ?+  -.sign  cor
        %watch-ack
      ?~  p.sign  cor
      =.  cor  (give %fact paths notes-denied+!>(~))
      (give %kick paths ~)
    ::
        %kick
      (give %kick paths ~)
    ::
        %fact
      =.  cor
        ?:  ?=(?(%notes-said %notes-denied) p.cage.sign)
          (give %fact paths cage.sign)
        (give %fact paths notes-denied+!>(~))
      =.  cor  (give %kick paths ~)
      =/  =wire  /said/(scot %p ship.flag)/[name.flag]/note/(scot %ud nid)
      (emit %pass wire %agent [ship.flag %notes] %leave ~)
    ==
  ::
      [%notes %req ship=@ name=@ id=@ %watch ~]
    ::  v1 per-request watch wire. Flag embedded in the wire so we can
    ::  route back into the right no-core context.
    =/  =flag:n  [(slav %p ship.pole) `@tas`name.pole]
    ?.  (~(has by books) flag)  cor
    =/  rid=request-id:v1:n  (slav %uv id.pole)
    no-abet:(no-agent-req-watch:(no-abed:no-core flag) rid sign)
  ::
      [%notes %req ship=@ name=@ id=@ %poke ~]
    =/  =flag:n  [(slav %p ship.pole) `@tas`name.pole]
    ?.  (~(has by books) flag)  cor
    =/  rid=request-id:v1:n  (slav %uv id.pole)
    no-abet:(no-agent-req-poke:(no-abed:no-core flag) rid sign)
  ::  /mcp/{remove,register,refresh} — pokes to %mcp-proxy from
  ::  +register-with-mcp-proxy. Fire-and-forget: log nacks so the user
  ::  knows registration didn't take, ignore success acks.
  ::
      [%mcp ?(%remove %register %refresh) ~]
    ?+  -.sign  cor
        %poke-ack
      ?~  p.sign  cor
      ((slog leaf+"mcp-proxy register/refresh failed" u.p.sign) cor)
    ==
  ==
::
++  arvo
  |=  [=wire =sign-arvo]
  ^+  cor
  ?:  ?=([%eyre %bound *] sign-arvo)  cor
  ?:  ?=([%behn %wake *] sign-arvo)
    =/  pole  ;;((pole knot) wire)
    ?+  pole  ~|(bad-arvo-wire+wire !!)
        [%cleanup %requests ~]
      ::  reschedule and run the cleanup pass. timer behaves the same
      ::  whether the requests map is empty or populated.
      =.  requests  (cleanup-requests now.bowl)
      %-  emit
      [%pass /cleanup/requests %arvo %b %wait (add now.bowl ~m5)]
    ::
        [%notes %rewatch ship=@ name=@ ~]
      =/  =flag:n  [(slav %p ship.pole) `@tas`name.pole]
      ?.  (~(has by books) flag)  cor
      =/  entry=[=net:n *]  (~(got by books) flag)
      ?.  ?=(%sub -.net.entry)  cor
      no-abet:no-start-watch:(no-abed:no-core flag)
    ::
        [%notes %req ship=@ name=@ id=@ %wake ~]
      ::  v1 per-request timeout — deliver %pending to the held HTTP
      ::  request (if any) and keep the request entry around for the
      ::  late-arriving response on the SSE path.
      =/  rid=request-id:v1:n  (slav %uv id.pole)
      (finalize-pending rid)
    ==
  ~|(bad-arvo-sign+wire !!)
::  utility arms
::
::  +slugify: convert a title cord + numeric suffix into a valid @tas term.
::  Algorithm:
::  1. Lowercase all chars; map non-[a-z0-9] to '-'
::  2. Collapse consecutive '-' into one
::  3. Trim leading and trailing '-'
::  4. Cap at 32 chars
::  5. Default to "note" if empty
::  6. Prefix "n-" if first char is a digit
::  7. Append "-{suffix}" (strip dots from scot %ud output)
::
++  slugify
  |=  [t=@t suffix=@ud]
  ^-  @tas
  =/  chars=tape  (trip t)
  ::  step 1: map each char to lowercase letter, digit, or '-'
  =/  mapped=tape
    %+  turn  chars
    |=  c=@t
    ^-  @t
    ?:  &((gte c 'a') (lte c 'z'))  c
    ?:  &((gte c 'A') (lte c 'Z'))  (add c 32)
    ?:  &((gte c '0') (lte c '9'))  c
    '-'
  ::  step 2: collapse consecutive '-' into one
  =/  collapsed=tape
    %-  flop
    =|  acc=tape
    |-  ^+  acc
    ?~  mapped  acc
    ?:  &(=('-' i.mapped) ?=(^ acc) =('-' i.acc))
      $(mapped t.mapped)
    $(mapped t.mapped, acc [i.mapped acc])
  ::  step 3: trim leading '-'
  =/  ltrimmed=tape
    |-  ^-  tape
    ?~  collapsed  ~
    ?:  =('-' i.collapsed)
      $(collapsed t.collapsed)
    collapsed
  ::  step 3b: trim trailing '-'
  =/  trimmed=tape
    =/  rev=tape  (flop ltrimmed)
    =/  rtrimmed=tape
      |-  ^-  tape
      ?~  rev  ~
      ?:  =('-' i.rev)
        $(rev t.rev)
      rev
    (flop rtrimmed)
  ::  step 4: cap at 32 chars
  =/  capped=tape  (scag 32 trimmed)
  ::  step 5: default to "note" if empty
  =/  base=tape  ?~(capped "note" capped)
  ::  step 6: prefix "n-" if first char is a digit
  =/  prefixed=tape
    ?.  &(?=(^ base) (gte i.base '0') (lte i.base '9'))
      base
    (weld "n-" base)
  ::  step 7: suffix string (a-co renders the number without dot separators)
  =/  suf-tape=tape  (a-co:co suffix)
  =/  slug=tape  (weld (weld prefixed "-") suf-tape)
  `@tas`(crip slug)
::  +a-notebook-to-c-notebook: convert a-notebook to c-notebook (same shape except %restore)
::  %restore is rewritten to %note [id %update] with the archived body
::
++  a-notebook-to-c-notebook
  |=  nb-act=a-notebook:n
  ^-  c-notebook:n
  ::  a-notebook and c-notebook have identical shapes (c-notebook adds
  ::  %member-join/%member-leave which only arrive via %notes-command, never
  ::  via %notes-action from the client). Direct cast works for all a-notebook arms.
  ;;(c-notebook:n nb-act)
::  +get-book: lookup a notebook entry by flag
::
++  get-book
  |=  =flag:n
  ^-  (unit [=net:n =notebook-state:n])
  (~(get by books) flag)
::  +group-can-read: ask our LOCAL %groups replica whether `who` may read the
::  [%notes flag] nest in group `grp`. Mirrors +can-read in tlon's
::  channel-utils: scry the bulk `can-read` GATE (%gx, not %gu — %groups only
::  serves %x peeks) and apply it to [ship nest]. Relies on the group being
::  present locally (we host the notebook, so we're a member); a missing group
::  crashes the peek, which fails an se-watch closed.
::
++  group-can-read
  |=  [grp=flag:n =flag:n who=ship]
  ^-  ?
  ::  short-circuit only for the notebook's own host/owner — NOT for
  ::  our.bowl, which on a subscriber is the local reader and must still be
  ::  checked against the group so a revoked subscriber is denied.
  ?:  =(ship.flag who)  &
  (group-can-read-raw grp flag who)
::  +group-can-read-raw: the bare can-read scry, no self-shortcut. Crashes if
::  the group isn't synced locally — callers that can't tolerate a crash must
::  guard with +group-synced first (the host path fails closed via the %gu
::  guard in +se-can-view; the subscriber path guards in +no-agent).
++  group-can-read-raw
  |=  [grp=flag:n =flag:n who=ship]
  ^-  ?
  =/  gpath=path
    /(scot %p our.bowl)/groups/(scot %da now.bowl)/v2/groups/(scot %p ship.grp)/[name.grp]/channels/can-read/noun
  =/  test=$-([ship nest:n] ?)  .^($-([ship nest:n] ?) %gx gpath)
  (test who [%notes ship.flag name.flag])
::  +group-synced: is group `grp` present in our local %groups replica? Used
::  to tell a revocation (group present, can-read now false) apart from a
::  transient (group not yet replicated here) before dropping a notebook.
++  group-synced
  |=  grp=flag:n
  ^-  ?
  =/  gpath=path
    /(scot %p our.bowl)/groups/(scot %da now.bowl)/groups/(scot %p ship.grp)/[name.grp]
  .^(? %gu gpath)
::  +can-view-flag: check if ship can view a notebook by flag. Group-mode
::  notebooks defer to the group's can-read; others use the members map.
::
++  can-view-flag
  |=  [=flag:n who=ship]
  ^-  ?
  ?~  entry=(get-book flag)  |
  ?~  grp=group.notebook-state.u.entry
    !=(~ (~(get by members.notebook-state.u.entry) who))
  ::  group mode: consult the group's live can-read. A not-yet-synced group
  ::  is transient (access can't be determined yet) — treat as viewable,
  ::  mirroring +no-agent's revocation logic, so we only hide/deny on a real
  ::  revocation rather than a replication gap.
  ?.  (group-synced u.grp)  &
  (group-can-read u.grp flag who)
::  +said-path: subscription path for a single note-preview request
::
++  said-path
  |=  [=flag:n nid=@ud]
  ^-  path
  /v0/said/(scot %p ship.flag)/[name.flag]/note/(scot %ud nid)
::  +said-snippet: leading slice of body-md, cut on a codepoint (not
::  byte) boundary so multi-byte UTF-8 never gets split.
::
++  said-snippet
  |=  body=@t
  ^-  @t
  =/  limit=@ud  400
  =/  chars=(list @c)  (tuba (trip body))
  ?:  (lte (lent chars) limit)  body
  (crip (tufa (scag limit chars)))
::  +give-said: one %fact (preview or %notes-denied) then an immediate
::  %kick, mirroring %channels' single-shot said flow. Public notebooks
::  preview for anyone; others gate on +can-view-flag.
::
++  give-said
  |=  [paths=(list path) =flag:n nid=@ud who=ship]
  ^+  cor
  =/  =cage
    ?~  entry=(get-book flag)  notes-denied+!>(~)
    =*  bs  notebook-state.u.entry
    ?.  ?|  =(%public visibility.bs)
            (can-view-flag flag who)
        ==
      notes-denied+!>(~)
    ?~  nt=(~(get by notes.bs) nid)  notes-denied+!>(~)
    :-  %notes-said
    !>  ^-  said:n
    :-  flag
    :*  nid
        title.u.nt
        (said-snippet body-md.u.nt)
        created-by.u.nt
        updated-at.u.nt
        title.notebook.bs
    ==
  =.  cor  (give %fact paths cage)
  (give %kick paths ~)
::  +recheck-group-access: a fact arrived for group `changed`, so read
::  permissions there may have shifted. Re-run can-read for every remote
::  subscriber on a hosted notebook bound to that group and %kick any who've
::  lost access. Scoped to the one changed group (not all notebooks). Grants
::  are handled by the %group-channel-join auto-join, so this only revokes.
::
++  recheck-group-access
  |=  changed=flag:n
  ^+  cor
  =/  kicks=(list card)
    %+  murn  ~(val by sup.bowl)
    |=  [who=ship pax=path]
    ^-  (unit card)
    ?.  ?=([%v0 %notes @ @ %updates ~] pax)  ~
    =/  =flag:n  [(slav %p i.t.t.pax) `@tas`i.t.t.t.pax]
    ?.  =(our.bowl ship.flag)  ~
    ?~  entry=(~(get by books) flag)  ~
    ?~  grp=group.notebook-state.u.entry  ~
    ?.  =(u.grp changed)  ~
    ?:  (can-view-flag flag who)  ~
    `[%give %kick ~[pax] `who]
  (emil kicks)
::  +find-flag-by-nid: find the flag for a notebook by numeric notebook id
::
++  find-flag-by-nid
  |=  nid=@ud
  ^-  flag:n
  =/  matches=(list flag:n)
    %+  murn  ~(tap by books)
    |=  [=flag:n [* =notebook-state:n]]
    ?:  =(nid id.notebook.notebook-state)
      `flag
    ~
  ?~  matches  ~|(notebook-not-found+nid !!)
  i.matches
::  +notebooks-changed-card: a fact telling subscribed UIs to re-scry notebooks
::
++  notebooks-changed-card
  ^-  card
  [%give %fact [/v0/inbox/stream]~ notes-inbox-update+!>(`u-inbox:n`[%notebooks-changed ~])]
::  +cleanup-requests: evict in-flight request records that have terminated.
::  Rules (match channels-server in tlon-apps PR 5334):
::    - keep if no terminal result yet (still in flight, no final-at)
::    - keep if no final-at timestamp yet (defensive — shouldn't happen)
::    - drop unconditionally past 24h (incl. timed-out %pending, which
::      carries a final-at set at the timeout — see +finalize-pending)
::    - %ok / %no-change: drop after 5m
::    - %error: drop only after the client has fetched it
::
++  cleanup-requests
  |=  now=@da
  ^-  requests:v1:n
  %-  ~(rep by requests)
  |=  [[id=request-id:v1:n req=incoming-request:v1:n] out=requests:v1:n]
  ?:  ?=(~ result.req)
    (~(put by out) id req)
  ?~  final-at.req  (~(put by out) id req)
  ?:  (gth (sub now u.final-at.req) ~d1)
    out
  ?:  |(?=([~ %ok *] result.req) ?=([~ %no-change *] result.req))
    ?:  (gth (sub now u.final-at.req) ~m5)
      out
    (~(put by out) id req)
  ?:  fetched.req  out
  (~(put by out) id req)
::  HTTP / request-id helpers
::
::  +give-http: emit a complete HTTP response on the eyre-id's response
::  path — header (status + content-type), body, and the closing kick.
::  Every HTTP reply in this agent funnels through here.
::
++  give-http
  |=  [eyre-id=@ta code=@ud ct=@t body=@t]
  ^+  cor
  =/  data=octs  (as-octs:mimes:html body)
  %-  emil
  :~  [%give %fact [/http-response/[eyre-id]]~ %http-response-header !>(`response-header:http`[code ~[['content-type' ct]]])]
      [%give %fact [/http-response/[eyre-id]]~ %http-response-data !>(`data)]
      [%give %kick [/http-response/[eyre-id]]~ ~]
  ==
::  +http-error: emit a non-200 HTTP error response (plain text body)
::
++  http-error
  |=  [eyre-id=@ta code=@ud message=@t]
  ^+  cor
  (give-http eyre-id code 'text/plain' message)
::  +give-http-response: emit a 200 application/json HTTP response carrying
::  the encoded response.
::
++  give-http-response
  |=  [eyre-id=@ta =response:v1:n]
  ^+  cor
  (give-http eyre-id 200 'application/json' (en:json:html (response:v1:enjs:notes-json response)))
::  +finalize-request: store terminal body in the request record, fact it on
::  the per-request SSE path, deliver to a held HTTP request if any, and clear
::  http-id so a later late-arriving update doesn't re-deliver.
::
++  finalize-request
  |=  [rid=request-id:v1:n body=response-body:v1:n]
  ^+  cor
  ?~  req=(~(get by requests) rid)  cor
  =/  =response:v1:n  [rid body]
  =.  requests
    %+  ~(put by requests)  rid
    u.req(result `body, final-at `now.bowl)
  =.  cor
    %-  give
    [%fact ~[/v1/request/(scot %uv rid)] notes-response-1+!>(response)]
  ?~  http-id.u.req  cor
  =.  requests
    %+  ~(put by requests)  rid
    u.req(http-id ~, result `body, final-at `now.bowl)
  (give-http-response u.http-id.u.req response)
::  +finalize-pending: deliver %pending status to a held HTTP request when the
::  per-request timeout fires before any terminal response. Keeps the request
::  open for the SSE subscribers + a future late response.
::
++  finalize-pending
  |=  rid=request-id:v1:n
  ^+  cor
  ?~  req=(~(get by requests) rid)  cor
  ?:  ?&  ?=(^ result.u.req)
          !?=([~ %pending *] result.u.req)
      ==
    cor
  =/  body=response-body:v1:n  [%pending poke-status.u.req]
  =/  =response:v1:n  [rid body]
  ::  stamp final-at at the timeout so a never-answered pending request
  ::  (e.g. offline remote host) ages out in +cleanup-requests instead of
  ::  living in state forever.
  =.  requests
    %+  ~(put by requests)  rid
    u.req(result `body, final-at `now.bowl)
  =.  cor
    %-  give
    [%fact ~[/v1/request/(scot %uv rid)] notes-response-1+!>(response)]
  ?~  http-id.u.req  cor
  =.  requests
    (~(put by requests) rid u.req(http-id ~))
  (give-http-response u.http-id.u.req response)
::  +register-request: idempotent insert of a fresh incoming-request record.
::
++  register-request
  |=  [rid=request-id:v1:n eyre-id=(unit @ta)]
  ^+  cor
  =/  existing=(unit incoming-request:v1:n)  (~(get by requests) rid)
  ?^  existing  cor
  =.  requests
    (~(put by requests) rid [rid eyre-id %sending ~ ~ |])
  cor
::  +give-inbox-received: emit an invite-received event on /v0/inbox/stream
::
++  give-inbox-received
  |=  [=flag:n from=ship sent-at=@da title=@t]
  ^+  cor
  %-  give
  [%fact [/v0/inbox/stream]~ notes-inbox-update+!>(`u-inbox:n`[%invite-received flag from sent-at title])]
::  +give-inbox-removed: emit an invite-removed event on /v0/inbox/stream
::
++  give-inbox-removed
  |=  =flag:n
  ^+  cor
  %-  give
  [%fact [/v0/inbox/stream]~ notes-inbox-update+!>(`u-inbox:n`[%invite-removed flag])]
::  invite / join handlers — shared by +dispatch-v1-action and the v0
::  %notes-action poke arm, so they live at the top level.
::
::  +send-v1-request: shared wire setup for any cross-ship request-id call.
::  Emits the three cards that every v1 cross-ship flow needs (subscribe
::  to host's response path, poke with notes-command-1, set per-request
::  behn timeout) keyed by the flag so the +agent handlers can route
::  signs back via the standard no-agent-req-watch / no-agent-req-poke.
::
::  `target` is the ship receiving the poke (the notebook host for
::  member-join/leave; the invitee for %notify-invite). `flag` is the
::  notebook's identity used in both wires and the host-side path —
::  what bookkeeping context the response-update is about, not who's
::  hosting it.
::
++  send-v1-request
  |=  [rid=request-id:v1:n target=ship =flag:n cmd1=command:v1:n]
  ^+  cor
  =/  watch-wire=wire
    /notes/req/(scot %p ship.flag)/[name.flag]/(scot %uv rid)/watch
  =/  watch-path=path
    :+  %v1  %notes
    /(scot %p ship.flag)/[name.flag]/request/(scot %p our.bowl)/(scot %uv rid)
  =/  poke-wire=wire
    /notes/req/(scot %p ship.flag)/[name.flag]/(scot %uv rid)/poke
  =/  wake-wire=wire
    /notes/req/(scot %p ship.flag)/[name.flag]/(scot %uv rid)/wake
  =.  cor  (emit %pass watch-wire %agent [target %notes] %watch watch-path)
  =.  cor  (emit %pass poke-wire %agent [target %notes] %poke notes-command-1+!>(cmd1))
  (emit %pass wake-wire %arvo %b %wait (add now.bowl ~s20))
::  +join-remote-v1: pre-place the local placeholder and fire a v1
::  request to the host for %member-join. The terminal response
::  arrives via no-agent-req-watch on the standard request wire.
::
++  join-remote-v1
  |=  [rid=request-id:v1:n =flag:n]
  ^+  cor
  ?<  =(our.bowl ship.flag)
  ?<  (~(has by books) flag)
  =/  placeholder-net=net:n  [%sub *@da |]
  =/  =notebook:n
    [0 '' ship.flag *@da *@da ship.flag]
  =/  placeholder-nb-state=notebook-state:n
    [notebook ~ %private ~ ~ ~ ~]
  =.  books
    (~(put by books) flag [placeholder-net placeholder-nb-state])
  =/  cmd1=command:v1:n  [rid [%notebook flag [%member-join ~]]]
  (send-v1-request rid ship.flag flag cmd1)
::  +leave-remote-v1: locally drop our subscription + placeholder, then
::  notify the host so their members map matches. The local cleanup is
::  unconditional (the request is informational from the host's POV);
::  the request-id loop just gives the FE a confirmation point.
::
++  leave-remote-v1
  |=  [rid=request-id:v1:n =flag:n]
  ^+  cor
  ?>  (~(has by books) flag)
  ::  no-leave reports the leave to %groups and drops the local book (incl.
  ::  its group) via the gone flag.
  =.  cor  no-abet:no-leave:(no-abed:no-core flag)
  =/  cmd1=command:v1:n  [rid [%notebook flag [%member-leave ~]]]
  (send-v1-request rid ship.flag flag cmd1)
::  +handle-send-invite-v1: owner-only, fired locally. Pre-add the
::  target ship to the notebook's member list and fire a v1 request to
::  the invitee with %notify-invite. The invitee acks with %no-change.
::
++  handle-send-invite-v1
  |=  [rid=request-id:v1:n =flag:n who=ship]
  ^+  cor
  ?>  =(ship.flag our.bowl)
  =/  entry=[* =notebook-state:n]  (~(got by books) flag)
  =.  cor
    se-abet:(se-poke:(se-abed:se-core flag) [%invite who])
  =/  cmd1=command:v1:n
    [rid [%notify-invite flag title.notebook.notebook-state.entry]]
  (send-v1-request rid who flag cmd1)
::  +handle-notify-invite: called when a remote host pokes us with
::  [%notify-invite flag title]. The sender must be the notebook host.
::  Response-update emission happens in the +poke %notes-command-1 arm
::  so this stays a pure state-mutation helper.
::
++  handle-notify-invite
  |=  [=flag:n title=@t from=ship]
  ^+  cor
  ?<  =(from our.bowl)
  ?>  =(from ship.flag)
  ?:  (~(has by books) flag)  cor
  ?:  (~(has by invites) flag)  cor
  =/  info=invite-info:n  [from now.bowl title]
  =.  invites  (~(put by invites) flag info)
  (give-inbox-received flag from now.bowl title)
::  +handle-accept-invite-v1: user accepted a pending invite. Clears the
::  invite locally, then delegates to join-remote-v1 if we're not already
::  a member. (If we somehow are, finalize synchronously since there's
::  no cross-ship round trip to await.)
::
++  handle-accept-invite-v1
  |=  [rid=request-id:v1:n =flag:n]
  ^+  cor
  ?>  =(src.bowl our.bowl)
  =.  invites  (~(del by invites) flag)
  =.  cor  (give-inbox-removed flag)
  ?:  (~(has by books) flag)
    (finalize-request rid [%no-change ~])
  (join-remote-v1 rid flag)
::  +handle-decline-invite: user declined a pending invite. Purely
::  local — no cross-ship work, finalized synchronously by the caller.
::
++  handle-decline-invite
  |=  =flag:n
  ^+  cor
  ?>  =(src.bowl our.bowl)
  ?.  (~(has by invites) flag)  cor
  =.  invites  (~(del by invites) flag)
  (give-inbox-removed flag)
::  v1 action dispatch + HTTP auth helpers
::
::  +get-api-key-header: case-insensitive lookup of x-api-key in the
::  inbound HTTP request headers. Returns ~ if absent.
::
++  get-api-key-header
  |=  req=inbound-request:eyre
  ^-  (unit @t)
  =/  hdrs=(list [key=@t value=@t])  header-list.request.req
  |-  ^-  (unit @t)
  ?~  hdrs  ~
  ?:  =((cass (trip key.i.hdrs)) "x-api-key")  `value.i.hdrs
  $(hdrs t.hdrs)
::  +request-authorized: an HTTP request passes the v1 auth gate when
::  eyre already validated the session cookie OR when the X-Api-Key
::  header matches the stored key.
::
++  request-authorized
  |=  req=inbound-request:eyre
  ^-  ?
  ?:  authenticated.req  &
  ?~  api-key  |
  =/  hdr=(unit @t)  (get-api-key-header req)
  ?~  hdr  |
  =(u.hdr u.api-key)
::  +mcp-proxy-installed: standard %gu liveness probe — true iff
::  %mcp-proxy is currently a running agent on this ship.
::
++  mcp-proxy-installed
  ^-  ?
  .^(? %gu /(scot %p our.bowl)/mcp-proxy/(scot %da now.bowl)/$)
::  +register-with-mcp-proxy: emit the two cards that wire %notes into
::  the local %mcp-proxy as an openapi upstream:
::    1. %add-server  — registers id=%notes pointing at this ship's
::                      eyre, with the api-key in headers
::    2. %refresh-spec — primes mcp-proxy's spec cache so the tools
::                       become callable without a separate refresh
::  Mints the api-key on demand if missing (so the model can hit a
::  brand-new install without a separate regenerate step). `base-url`
::  is the eyre origin (e.g. 'http://localhost:8080'); on ~, defaults.
::
++  register-with-mcp-proxy
  |=  base-url=(unit @t)
  ^+  cor
  =/  base=@t  (fall base-url 'http://localhost:8080')
  =?  api-key  ?=(~ api-key)  `(scot %uv eny.bowl)
  =/  key=@t  ?~(api-key '' u.api-key)
  ::  url is the eyre ORIGIN, not /notes. mcp-proxy concatenates url +
  ::  the spec's path template (e.g. '/notes/~/v1/notebooks'); appending
  ::  /notes here would double the segment and the request would fall
  ::  through to the generic /notes/* catch-all that serves the UI.
  ::  schema-url IS a real path on disk so it keeps the /notes prefix.
  =/  schema-url=@t  (cat 3 base '/notes/openapi.json')
  =/  add=action:mcp-proxy
    :+  %add-server  %notes
    ^-  mcp-server:mcp-proxy
    :*  name='Notes'
        url=base
        headers=~[[key='x-api-key' value=key]]
        enabled=&
        oauth-provider=~
        mode=%openapi
        schema-url=`schema-url
    ==
  =/  refresh=action:mcp-proxy  [%refresh-spec %notes]
  ::  %mcp-proxy's %add-server is a no-op when %notes is already registered,
  ::  so a re-register would otherwise keep a stale upstream — old api-key and,
  ::  worse, a cached session cookie that makes calls fail with "bad session
  ::  auth" instead of using our x-api-key. %remove-server first (clears the
  ::  cookie + config) so %add-server installs a clean config every time.
  =/  remove=action:mcp-proxy  [%remove-server %notes]
  =.  cor
    %-  emit
    :*  %pass  /mcp/remove
        %agent  [our.bowl %mcp-proxy]
        %poke   mcp-proxy-action+!>(remove)
    ==
  =.  cor
    %-  emit
    :*  %pass  /mcp/register
        %agent  [our.bowl %mcp-proxy]
        %poke   mcp-proxy-action+!>(add)
    ==
  %-  emit
  :*  %pass  /mcp/refresh
      %agent  [our.bowl %mcp-proxy]
      %poke   mcp-proxy-action+!>(refresh)
  ==
::  +dispatch-v1-action: top-level v1 action routing. Used by both
::  +poke %notes-action-1 (after src.bowl gate) and +handle-v1-post
::  (after eyre-or-api-key gate). Registers the request, runs the
::  action, finalizes %no-change for local synchronous arms.
::
++  dispatch-v1-action
  |=  act=action:v1:n
  ^+  cor
  =/  rid  request-id.act
  =/  a-act  a-notes.act
  =.  cor  (register-request rid ~)
  ?.  ?=(%notebook -.a-act)
    ::  Two flavors of top-level action:
    ::  - synchronous: purely local work, finalize %no-change right here
    ::  - asynchronous: fires a cross-ship v1 request whose terminal
    ::    response-update arrives later via no-agent-req-watch
    ?-  -.a-act
        ?(%create-notebook %create-group-notebook)
      ::  return the new notebook's summary so the caller learns the
      ::  slugified flag + metadata without a follow-up scry. group-mode
      ::  carries the affiliation + group role-readers; solo passes ~ ~.
      ::  the two variants put `title` at different axes, so extract every
      ::  field inside one ?= narrow rather than across the fork.
      =/  args=[title=@t group=(unit flag:n) readers=(set @tas)]
        ?:  ?=(%create-group-notebook -.a-act)
          [title.a-act `group.a-act readers.a-act]
        [title.a-act ~ ~]
      =/  core
        %.  args
        se-create-notebook:(se-init:se-core title.args)
      =.  cor  se-abet:core
      =/  =notebook-summary:n
        :+  flag.core  notebook.notebook-state.core
        visibility.notebook-state.core
      (finalize-request rid [%notebook notebook-summary])
    ::
        %join
      (join-remote-v1 rid flag.a-act)
    ::
        %leave
      (leave-remote-v1 rid flag.a-act)
    ::
        %accept-invite
      (handle-accept-invite-v1 rid flag.a-act)
    ::
        %decline-invite
      =.  cor  (handle-decline-invite flag.a-act)
      (finalize-request rid [%no-change ~])
    ::
        %regenerate-api-key
      =/  new-key=@t  (scot %uv eny.bowl)
      =.  api-key  `new-key
      (finalize-request rid [%api-key `new-key])
    ::
        %clear-api-key
      =.  api-key  ~
      (finalize-request rid [%api-key ~])
    ::
        %register-mcp
      =.  cor  (register-with-mcp-proxy base-url.a-act)
      (finalize-request rid [%no-change ~])
    ==
  =/  =flag:n  flag.a-act
  ?+    -.a-notebook.a-act
      no-abet:(no-action-v1:(no-abed:no-core flag) rid a-act)
  ::
      %invite
    ::  cross-ship: invitee acks via response-update %no-change
    (handle-send-invite-v1 rid flag who.a-notebook.a-act)
  ::
      %note
    =*  n-act  a-note.a-notebook.a-act
    ?+    -.n-act
        no-abet:(no-action-v1:(no-abed:no-core flag) rid a-act)
    ::
        %publish
      =.  cor  no-abet:(no-publish:(no-abed:no-core flag) id.a-notebook.a-act html.n-act)
      (finalize-request rid [%no-change ~])
    ::
        %unpublish
      =.  cor  no-abet:(no-unpublish:(no-abed:no-core flag) id.a-notebook.a-act)
      (finalize-request rid [%no-change ~])
    ==
  ==
::  se-core: server/host core
::
++  se-core
  |_  $:  =flag:n
          =log:n
          =notebook-state:n
          gone=_|
          rid=request-id:v1:n
          last-update=(unit update:n)
          finalized=?
      ==
  ++  se-core  .
  ++  emit  |=(=card se-core(cor cor(cards [card cards])))
  ++  give  |=(=gift:agent:gall (emit %give gift))
  ::  +se-init: initialize for a brand-new notebook
  ::
  ++  se-init
    |=  title=@t
    ^+  se-core
    =/  nid=@ud  +(next-id)
    =/  =flag:n  [our.bowl (slugify title nid)]
    se-core(flag flag)
  ::  +se-abed: load from state for a given flag
  ::
  ++  se-abed
    |=  =flag:n
    ^+  se-core
    ?>  =(ship.flag our.bowl)
    ?~  entry=(~(get by books) flag)
      ~|(se-abed-not-found+flag !!)
    =/  [=net:n =notebook-state:n]  u.entry
    ?>  ?=(%pub -.net)
    se-core(flag flag, log log.net, notebook-state notebook-state)
  ::  +se-abet: write back to cor
  ::
  ++  se-abet
    ^+  cor
    =.  books
      ?:  gone
        (~(del by books) flag)
      (~(put by books) flag [[%pub log] notebook-state])
    cor
  ::
  ++  se-area
    `path`/v0/notes/(scot %p ship.flag)/[name.flag]
  ::
  ++  se-sub-path
    `path`(weld se-area /updates)
  ::  +se-update: append update to log and broadcast to subscribers.
  ::  Also records the [time u-notebook] as last-update so se-emit-final-response
  ::  can wrap it in the response-update body for the v1 request flow.
  ::
  ++  se-update
    |=  upd=u-notebook:n
    ^+  se-core
    =/  ts=@da
      |-
      ?~  existing=(get:log-on:n log now.bowl)  now.bowl
      $(now.bowl `@da`(add now.bowl ^~((div ~s1 (bex 16)))))
    =.  log  (put:log-on:n log [ts upd])
    =.  last-update  `[ts upd]
    %-  give
    :+  %fact  ~[se-sub-path (weld se-area /stream)]
    notes-response+!>(`response:n`[%update flag [ts upd]])
  ::  +se-poke-v1: dispatch a c-notes command for a request-id'd flow.
  ::  Sets rid into se-core's door state, runs the normal se-poke, then
  ::  emits the terminal response-update on the per-request host path.
  ::
  ++  se-poke-v1
    |=  [req-id=request-id:v1:n =c-notebook:n]
    ^+  se-core
    =.  rid  req-id
    =.  last-update  ~
    =.  finalized  |
    =.  se-core  (se-poke c-notebook)
    se-emit-final-response
  ::  +se-emit-final-response: emit response-update on the request path.
  ::  Skipped if rid is 0 (non-v1 flow) or already explicitly finalized.
  ::
  ++  se-emit-final-response
    ^+  se-core
    ?:  =(0 rid)  se-core
    ?:  finalized  se-core
    =/  body=response-update-body:v1:n
      ?~  last-update  [%no-change ~]
      [%ok u.last-update]
    =/  =path
      :+  %v1  %notes
      /(scot %p ship.flag)/[name.flag]/request/(scot %p src.bowl)/(scot %uv rid)
    %-  give
    [%fact ~[path] notes-response-update-1+!>(`response-update:v1:n`[rid body])]
  ::  +se-finalize-with: explicit early-finalize. Use for typed errors so the
  ::  arm can emit %error response-update without crashing (which would also
  ::  discard the response-update emission).
  ::
  ++  se-finalize-with
    |=  body=response-update-body:v1:n
    ^+  se-core
    ?:  =(0 rid)  se-core
    =.  finalized  &
    =/  =path
      :+  %v1  %notes
      /(scot %p ship.flag)/[name.flag]/request/(scot %p src.bowl)/(scot %uv rid)
    %-  give
    [%fact ~[path] notes-response-update-1+!>(`response-update:v1:n`[rid body])]
  ::  +se-watch-sub: send initial snapshot to a new subscriber (with visibility)
  ::
  ++  se-watch-sub
    |=  who=ship
    ^+  se-core
    %-  give
    [%fact ~ notes-response+!>(`response:n`[%snapshot flag visibility.notebook-state notebook-state])]
  ::  +se-watch: handle remote-subscriber watch (dispatch from top-level +watch)
  ::
  ++  se-watch
    ^+  se-core
    ?>  =(our.bowl ship.flag)
    ?>  (se-can-view src.bowl)
    (se-watch-sub src.bowl)
  ::  +se-can-view: read gate. Group-mode notebooks defer to the group's
  ::  can-read for the [%notes flag] nest (scried from our LOCAL %groups
  ::  replica — we host the notebook, so we're a member with the group
  ::  synced). Guarded with %gu so a not-yet-synced group fails closed
  ::  rather than crashing the event. Non-group notebooks use the legacy
  ::  members-map check.
  ::
  ++  se-can-view
    |=  who=ship
    ^-  ?
    ?~  grp=group.notebook-state
      !=(~ (~(get by members.notebook-state) who))
    (group-can-read u.grp flag who)
  ::
  ::  +se-can-edit: write gate. Requires an %owner/%editor role AND, for
  ::  group-mode notebooks, live group read access. The members map isn't
  ::  pruned when a member's group access is revoked (+recheck-group-access
  ::  only kicks subscriptions), so a stale %editor entry alone must not
  ::  authorize writes — mirror +se-can-view and re-check the group.
  ::
  ++  se-can-edit
    |=  who=ship
    ^-  ?
    =/  r=(unit role:n)
      (~(get by members.notebook-state) who)
    ?~  r  |
    ?&  ?|(=(u.r %owner) =(u.r %editor))
        ?~  grp=group.notebook-state  &
        (group-can-read u.grp flag who)
    ==
  ::
  ++  se-is-owner
    |=  who=ship
    ^-  ?
    =/  r=(unit role:n)
      (~(get by members.notebook-state) who)
    ?~  r  |
    =(u.r %owner)
  ::
  ++  se-visibility
    ^-  visibility:n
    visibility.notebook-state
  ::  +se-create-notebook: create a notebook (solo or group-mode)
  ::  nid is +(next-id) — same value se-init used to build the flag slug;
  ::  state has not been modified between se-init and this call.
  ::
  ++  se-create-notebook
    |=  [title=@t group=(unit flag:n) readers=(set @tas)]
    ^+  se-core
    =/  nid=@ud  +(next-id)
    =/  rfid=@ud  +(nid)
    =/  =notebook:n
      [nid title our.bowl now.bowl now.bowl our.bowl]
    =/  nb-state=notebook-state:n
      :*  notebook
          (~(put by *members:n) our.bowl %owner)
          %private
          (~(put by *(map @ud folder:n)) rfid [rfid nid '/' ~ [our now now our]:bowl])
          ~
          ~
          group
      ==
    =.  next-id  rfid
    =.  notebook-state  nb-state
    =.  books
      (~(put by books) flag [[%pub *log:n] notebook-state])
    ::  group-mode: register the channel listing with %groups, carrying the
    ::  group role-readers so the group's can-read gates the notebook.
    =?  se-core  ?=(^ group)
      =/  channel=group-channel:n
        :-  [title '' '' '']
        [now.bowl %default readers |]
      =/  action=group-create:n
        [%group u.group %channel [%notes flag] %add channel]
      =/  =dock    [our.bowl %groups]
      =/  =wire    /notes/(scot %p ship.flag)/[name.flag]/create
      (emit %pass wire %agent dock %poke group-action-4+!>(action))
    =.  se-core  (emit notebooks-changed-card)
    (se-update [%created notebook %private])
  ::  +se-poke: dispatch a c-notes command to the right handler
  ::
  ++  se-poke
    |=  =c-notebook:n
    ^+  se-core
    ?-  -.c-notebook
        %rename             (se-rename-notebook +.c-notebook)
        %delete             se-delete-notebook
        %visibility         (se-set-visibility +.c-notebook)
        %invite             (se-invite +.c-notebook)
        %create-folder      (se-create-folder +.c-notebook)
        %folder             (se-dispatch-folder +.c-notebook)
        %create-note        (se-create-note +.c-notebook)
        %note               (se-dispatch-note +.c-notebook)
        %batch-import       (se-batch-import +.c-notebook)
        %batch-import-tree  (se-batch-import-tree +.c-notebook)
        %member-join        se-member-join
        %member-leave       se-member-leave
    ==
  ::
  ++  se-rename-notebook
    |=  title=@t
    ^+  se-core
    ?>  (se-is-owner src.bowl)
    =.  notebook.notebook-state
      %_  notebook.notebook-state
        title       title
        updated-at  now.bowl
        updated-by  src.bowl
      ==
    (se-update [%updated notebook.notebook-state])
  ::
  ++  se-delete-notebook
    ^+  se-core
    ?>  (se-is-owner src.bowl)
    ::  clean up published entries for this notebook
    =.  published
      %-  malt
      %+  skip  ~(tap by published)
      |=  [k=[=flag:n note-id=@ud] v=@t]
      =(flag.k flag)
    ::  group-mode: remove the channel listing from %groups (mirror of the
    ::  %add in se-create-notebook) so the group stops listing / bookkeeping
    ::  a notebook that no longer exists on the host
    =?  se-core  ?=(^ group.notebook-state)
      =/  action=group-channel-del:n
        [%group u.group.notebook-state %channel [%notes flag] %del ~]
      =/  =dock  [our.bowl %groups]
      =/  =wire  /notes/(scot %p ship.flag)/[name.flag]/delete
      (emit %pass wire %agent dock %poke group-action-4+!>(action))
    ::  group affiliation, history and visibility live in notebook-state,
    ::  deleted with the book via the gone flag
    =.  se-core  (se-update [%deleted ~])
    se-core(gone &)
  ::
  ++  se-set-visibility
    |=  vis=visibility:n
    ^+  se-core
    ?>  (se-is-owner src.bowl)
    =.  visibility.notebook-state  vis
    (se-update [%visibility vis])
  ::
  ++  se-invite
    |=  who=ship
    ^+  se-core
    ?>  (se-is-owner src.bowl)
    ?:  (~(has by members.notebook-state) who)
      se-core
    =.  members.notebook-state
      (~(put by members.notebook-state) who %editor)
    (se-update [%member-joined who %editor])
  ::
  ++  se-member-join
    ^+  se-core
    ::  Access check — one of three cases:
    ::    non-group private: src must already be in the members map
    ::    non-group public:  anyone is welcome — no check needed
    ::    group-mode:        group's can-read is the sole authority
    ::  Either way, record the joiner as %editor so se-can-edit lets them write.
    ?>  ?~  grp=group.notebook-state
          ::  non-group: public ok; private requires prior membership
          ?|  =(%public se-visibility)
              !=(~ (~(get by members.notebook-state) src.bowl))
          ==
        ::  group-mode: group's can-read is the sole authority
        (group-can-read u.grp flag src.bowl)
    =.  members.notebook-state
      (~(put by members.notebook-state) src.bowl %editor)
    (se-update [%member-joined src.bowl %editor])
  ::
  ++  se-member-leave
    ^+  se-core
    =.  members.notebook-state
      (~(del by members.notebook-state) src.bowl)
    (se-update [%member-left src.bowl])
  ::
  ++  se-dispatch-folder
    |=  [id=@ud =a-folder:n]
    ^+  se-core
    ?-  -.a-folder
      %rename  (se-rename-folder id +.a-folder)
      %move    (se-move-folder id +.a-folder)
      %delete  (se-delete-folder id +.a-folder)
      %update  (se-update-folder id +.a-folder)
    ==
  ::
  ++  se-dispatch-note
    |=  [id=@ud =a-note:n]
    ^+  se-core
    ?-  -.a-note
      %rename     (se-rename-note id +.a-note)
      %move       (se-move-note id +.a-note)
      %delete     (se-delete-note id +.a-note)
      %update     (se-update-note id +.a-note)
      %modify     (se-modify-note id +.a-note)
      %publish    se-core  ::  handled pre-dispatch (local-only)
      %unpublish  se-core
      %restore    (se-restore-note id +.a-note)
    ==
  ::  +se-create-folder: `parent` is required (a concrete folder id). The
  ::  boundary enforces this — the JSON decoder rejects a missing/null
  ::  parent (400) and the REST builder returns ~ for it — so the core
  ::  never has to guess a caller's intent. To create at the notebook root
  ::  the caller passes the root folder's id (nb.id + 1, present in the
  ::  folders map and in listings). We still assert the parent exists so a
  ::  bad id crashes loudly instead of producing a dangling reference.
  ::
  ++  se-create-folder
    |=  [parent=@ud name=@t]
    ^+  se-core
    ?>  (se-can-edit src.bowl)
    ?>  (~(has by folders.notebook-state) parent)
    =/  fid=@ud  +(next-id)
    =.  next-id  fid
    =/  =folder:n
      [fid id.notebook.notebook-state name `parent [src now now src]:bowl]
    =.  folders.notebook-state
      (~(put by folders.notebook-state) fid folder)
    (se-update [%folder fid [%created folder]])
  ::
  ++  se-rename-folder
    |=  [id=@ud name=@t]
    ^+  se-core
    ?>  (se-can-edit src.bowl)
    =*  fid  id
    =/  fld=folder:n
      (~(got by folders.notebook-state) fid)
    =.  fld  fld(name name, updated-at now.bowl, updated-by src.bowl)
    =.  folders.notebook-state
      (~(put by folders.notebook-state) fid fld)
    (se-update [%folder fid [%updated fld]])
  ::
  ++  se-move-folder
    |=  [id=@ud new-parent=@ud]
    ^+  se-core
    ?>  (se-can-edit src.bowl)
    =*  fid  id
    =/  fld=folder:n
      (~(got by folders.notebook-state) fid)
    =/  subtree=(set @ud)
      (se-subtree-folder-ids fid)
    ?<  (~(has in subtree) new-parent)
    =.  fld  fld(parent-folder-id `new-parent, updated-at now.bowl, updated-by src.bowl)
    =.  folders.notebook-state
      (~(put by folders.notebook-state) fid fld)
    (se-update [%folder fid [%updated fld]])
  ::  +se-update-folder: REST PUT path. Applies whichever of name / parent
  ::  is provided. Bails if both are ~ — a PUT that touches nothing is a
  ::  caller bug (clearer than emitting a phantom "updated" fact).
  ::
  ++  se-update-folder
    |=  [id=@ud name=(unit @t) parent=(unit @ud)]
    ^+  se-core
    ?>  (se-can-edit src.bowl)
    =*  fid  id
    ?>  |(?=(^ name) ?=(^ parent))
    =/  fld=folder:n
      (~(got by folders.notebook-state) fid)
    =?  fld  ?=(^ name)
      fld(name u.name)
    =?  fld  ?=(^ parent)
      =/  subtree=(set @ud)  (se-subtree-folder-ids fid)
      ?<  (~(has in subtree) u.parent)
      ?>  (~(has by folders.notebook-state) u.parent)
      fld(parent-folder-id `u.parent)
    =.  fld  fld(updated-at now.bowl, updated-by src.bowl)
    =.  folders.notebook-state
      (~(put by folders.notebook-state) fid fld)
    (se-update [%folder fid [%updated fld]])
  ::
  ++  se-delete-folder
    |=  [id=@ud recursive=?]
    ^+  se-core
    ?>  (se-can-edit src.bowl)
    =*  fid  id
    =/  fld=folder:n
      (~(got by folders.notebook-state) fid)
    ?>  ?=(^ parent-folder-id.fld)
    ?:  recursive
      =/  del-fids=(set @ud)
        (se-subtree-folder-ids fid)
      =/  del-nids=(set @ud)
        (se-note-ids-in-folder-set del-fids)
      =.  folders.notebook-state
        %-  ~(rep in del-fids)
        |=  [f=@ud acc=_folders.notebook-state]
        (~(del by acc) f)
      =.  notes.notebook-state
        %-  ~(rep in del-nids)
        |=  [n=@ud acc=_notes.notebook-state]
        (~(del by acc) n)
      ::  drop history + published copies for every removed note too
      =.  history.notebook-state
        %-  ~(rep in del-nids)
        |=  [n=@ud acc=_history.notebook-state]
        (~(del by acc) n)
      =.  published
        %-  ~(rep in del-nids)
        |=  [n=@ud acc=_published]
        (~(del by acc) [flag n])
      (se-update [%folder fid [%deleted ~]])
    ::  non-recursive: fail if has children
    =/  children=(list @ud)
      (se-folder-children-ids fid)
    ?>  =(~ children)
    =/  child-notes=(list note:n)
      (se-notes-in-folder fid)
    ?>  =(~ child-notes)
    =.  folders.notebook-state
      (~(del by folders.notebook-state) fid)
    (se-update [%folder fid [%deleted ~]])
  ::
  ++  se-create-note
    |=  [folder=@ud title=@t body=@t]
    ^+  se-core
    ?>  (se-can-edit src.bowl)
    =*  fid  folder
    =/  fld=folder:n
      (~(got by folders.notebook-state) fid)
    =/  nid=@ud  +(next-id)
    =.  next-id  nid
    =/  =note:n
      :*  nid
          id.notebook.notebook-state
          fid
          title
          ~
          body
          src.bowl
          now.bowl
          src.bowl
          now.bowl
          0
      ==
    =.  notes.notebook-state
      (~(put by notes.notebook-state) nid note)
    (se-update [%note nid [%created note]])
  ::
  ++  se-rename-note
    |=  [id=@ud title=@t]
    ^+  se-core
    ?>  (se-can-edit src.bowl)
    =*  nid  id
    =/  =note:n  (~(got by notes.notebook-state) nid)
    ::  Title changes do NOT bump revision. The revision counter tracks
    ::  body-md only — that's what optimistic concurrency on update-note
    ::  cares about. Bumping rev on rename silently desynced auto-save
    ::  (which sends body+rename back-to-back) by leaving the server at
    ::  rev+1 while the client believed it was still at rev.
    =.  note
      %_  note
        title       title
        updated-by  src.bowl
        updated-at  now.bowl
      ==
    =.  notes.notebook-state
      (~(put by notes.notebook-state) nid note)
    (se-update [%note nid [%updated note]])
  ::
  ++  se-move-note
    |=  [id=@ud folder=@ud]
    ^+  se-core
    ?>  (se-can-edit src.bowl)
    =*  nid  id
    =/  =note:n  (~(got by notes.notebook-state) nid)
    ::  Move does NOT bump revision; same reasoning as rename — body-md
    ::  is the only field that drives optimistic concurrency.
    =.  note
      %_  note
        folder-id   folder
        updated-by  src.bowl
        updated-at  now.bowl
      ==
    =.  notes.notebook-state
      (~(put by notes.notebook-state) nid note)
    (se-update [%note nid [%updated note]])
  ::  +se-modify-note: REST PUT path. Applies whichever of title / folder
  ::  is provided; rejects an empty modify and a move into a folder that
  ::  doesn't exist. Revision is NOT bumped (matches %rename / %move).
  ::  Body updates stay on %update so the revision-check semantics stay
  ::  exclusive to content edits.
  ::
  ++  se-modify-note
    |=  [id=@ud title=(unit @t) folder=(unit @ud)]
    ^+  se-core
    ?>  (se-can-edit src.bowl)
    =*  nid  id
    ?>  |(?=(^ title) ?=(^ folder))
    =/  =note:n  (~(got by notes.notebook-state) nid)
    =?  note  ?=(^ title)
      note(title u.title)
    =?  note  ?=(^ folder)
      ?>  (~(has by folders.notebook-state) u.folder)
      note(folder-id u.folder)
    =.  note  note(updated-at now.bowl, updated-by src.bowl)
    =.  notes.notebook-state
      (~(put by notes.notebook-state) nid note)
    (se-update [%note nid [%updated note]])
  ::
  ++  se-delete-note
    |=  [id=@ud ~]
    ^+  se-core
    ?>  (se-can-edit src.bowl)
    =*  nid  id
    =/  =note:n
      (~(got by notes.notebook-state) nid)
    =.  notes.notebook-state
      (~(del by notes.notebook-state) nid)
    ::  drop archived revision history and any published copy so a deleted
    ::  note can't be recovered via /x/v0/history or /notes/pub/.../nid
    =.  history.notebook-state  (~(del by history.notebook-state) nid)
    =.  published  (~(del by published) [flag nid])
    (se-update [%note nid [%deleted ~]])
  ::
  ++  se-update-note
    |=  [id=@ud body=@t expected-revision=@ud]
    ^+  se-core
    =*  nid  id
    =/  =note:n
      (~(got by notes.notebook-state) nid)
    ?>  (se-can-edit src.bowl)
    ::  strict optimistic concurrency check (no force-update sentinel)
    ?:  !=(revision.note expected-revision)
      ~|(%revision-mismatch !!)
    ::  no-op early-out: body unchanged
    ?:  =(body-md.note body)
      se-core
    ::  archive the prior revision into per-notebook history
    =/  prior=note-revision:n
      :*  rev=revision.note
          at=now.bowl
          author=src.bowl
          title=title.note
          body-md=body-md.note
      ==
    =/  existing=(list note-revision:n)
      (fall (~(get by history.notebook-state) nid) ~)
    =.  history.notebook-state
      (~(put by history.notebook-state) nid [prior existing])
    =.  note
      %_  note
        body-md     body
        updated-by  src.bowl
        updated-at  now.bowl
        revision    +(revision.note)
      ==
    =.  notes.notebook-state
      (~(put by notes.notebook-state) nid note)
    ::  emit archive event first, then update
    =.  se-core
      (se-update [%note nid [%history-archived prior]])
    (se-update [%note nid [%updated note]])
  ::  +se-restore-note: revert to a prior archived revision
  ::  This is simply an update with the archived body, respecting current revision.
  ::
  ++  se-restore-note
    |=  [id=@ud rev=@ud]
    ^+  se-core
    =*  nid  id
    =/  =note:n
      (~(got by notes.notebook-state) nid)
    ?>  (se-can-edit src.bowl)
    ::  find the archived revision in per-notebook history
    =/  revs=(list note-revision:n)
      (fall (~(get by history.notebook-state) nid) ~)
    =/  found=(unit note-revision:n)
      |-
      ?~  revs  ~
      ?:  =(rev.i.revs rev)
        `i.revs
      $(revs t.revs)
    ?>  ?=(^ found)
    ::  apply as a normal update with current revision as expected
    (se-update-note nid body-md.u.found revision.note)
  ::
  ++  se-batch-import
    |=  [folder=@ud notes=(list [title=@t body=@t])]
    ^+  se-core
    ?>  (se-can-edit src.bowl)
    =/  items=(list [title=@t body=@t])  notes
    |-  ^+  se-core
    ?~  items  se-core
    =/  nid=@ud  +(next-id)
    =.  next-id  nid
    =/  =note:n
      :*  nid
          id.notebook.notebook-state
          folder
          title.i.items
          ~
          body.i.items
          src.bowl
          now.bowl
          src.bowl
          now.bowl
          0
      ==
    =.  notes.notebook-state
      (~(put by notes.notebook-state) nid note)
    =.  se-core  (se-update [%note nid [%created note]])
    $(items t.items, se-core se-core)
  ::
  ++  se-batch-import-tree
    |=  [parent=@ud tree=(list import-node:n)]
    ^+  se-core
    ?>  (se-can-edit src.bowl)
    =/  items=(list import-node:n)  tree
    =*  nid-nb  id.notebook.notebook-state
    =|  stack=(list [remaining=(list import-node:n) folder-id=@ud])
    =/  fid=@ud  parent
    |-  ^+  se-core
    ?~  items
      ?~  stack
        se-core
      $(items remaining.i.stack, fid folder-id.i.stack, stack t.stack)
    ?-  -.i.items
        %note
      =/  nid=@ud  +(next-id)
      =.  next-id  nid
      =/  =note:n
        :*  nid
            nid-nb
            fid
            title.i.items
            ~
            body-md.i.items
            src.bowl
            now.bowl
            src.bowl
            now.bowl
            0
        ==
      =.  notes.notebook-state
        (~(put by notes.notebook-state) nid note)
      =.  se-core  (se-update [%note nid [%created note]])
      $(items t.items, se-core se-core)
    ::
        %folder
      =/  new-fid=@ud  +(next-id)
      =.  next-id  new-fid
      =/  =folder:n
        [new-fid nid-nb name.i.items `fid [src now now src]:bowl]
      =.  folders.notebook-state
        (~(put by folders.notebook-state) new-fid folder)
      =.  se-core  (se-update [%folder new-fid [%created folder]])
      $(items children.i.items, stack [[t.items fid] stack], fid new-fid, se-core se-core)
    ==
  ::  helpers
  ::
  ++  se-folder-children-ids
    |=  folder-id=@ud
    ^-  (list @ud)
    %+  murn  ~(tap by folders.notebook-state)
    |=  [fid=@ud fld=folder:n]
    ?~  parent-folder-id.fld  ~
    ?:  =(u.parent-folder-id.fld folder-id)
      `fid
    ~
  ::
  ++  se-subtree-folder-ids
    |=  folder-id=@ud
    ^-  (set @ud)
    =/  acc=(set @ud)  (silt ~[folder-id])
    =/  queue=(list @ud)  ~[folder-id]
    |-
    ?~  queue  acc
    =/  children=(list @ud)  (se-folder-children-ids i.queue)
    %=  $
      queue  (weld t.queue children)
      acc    (~(gas in acc) children)
    ==
  ::
  ++  se-note-ids-in-folder-set
    |=  fids=(set @ud)
    ^-  (set @ud)
    %-  silt
    %+  murn  ~(tap by notes.notebook-state)
    |=  [nid=@ud =note:n]
    ?:  (~(has in fids) folder-id.note)
      `nid
    ~
  ::
  ++  se-notes-in-folder
    |=  folder-id=@ud
    ^-  (list note:n)
    %+  murn  ~(tap by notes.notebook-state)
    |=  [nid=@ud =note:n]
    ?:  =(folder-id.note folder-id)
      `note
    ~
  --
::  no-core: subscriber/client core
::
++  no-core
  |_  [=flag:n =net:n =notebook-state:n gone=_|]
  ++  no-core  .
  ++  emit  |=(=card no-core(cor cor(cards [card cards])))
  ++  emil  |=(caz=(list card) no-core(cor cor(cards (welp (flop caz) cards))))
  ++  give  |=(=gift:agent:gall (emit %give gift))
  ::  +no-req-watch-path: path the subscriber subscribes to on the host
  ::
  ++  no-req-watch-path
    |=  rid=request-id:v1:n
    ^-  path
    :+  %v1  %notes
    /(scot %p ship.flag)/[name.flag]/request/(scot %p our.bowl)/(scot %uv rid)
  ::  +no-req-watch-wire: subscriber-side wire for the watch on host path.
  ::  Flag is embedded so signs landing here can be routed back to the
  ::  right no-core context without a separate lookup map.
  ::
  ++  no-req-watch-wire
    |=  rid=request-id:v1:n
    ^-  wire
    /notes/req/(scot %p ship.flag)/[name.flag]/(scot %uv rid)/watch
  ::  +no-req-poke-wire: subscriber-side wire for the poke to host
  ::
  ++  no-req-poke-wire
    |=  rid=request-id:v1:n
    ^-  wire
    /notes/req/(scot %p ship.flag)/[name.flag]/(scot %uv rid)/poke
  ::  +no-req-wake-wire: per-request timeout behn wire
  ::
  ++  no-req-wake-wire
    |=  rid=request-id:v1:n
    ^-  wire
    /notes/req/(scot %p ship.flag)/[name.flag]/(scot %uv rid)/wake
  ::
  ++  no-abed
    |=  =flag:n
    ^+  no-core
    ?~  entry=(~(get by books) flag)
      ~|(no-abed-not-found+flag !!)
    =/  [=net:n =notebook-state:n]  u.entry
    no-core(flag flag, net net, notebook-state notebook-state)
  ::
  ++  no-abet
    ^+  cor
    =.  books
      ?:  gone
        (~(del by books) flag)
      (~(put by books) flag [net notebook-state])
    cor
  ::
  ++  no-area
    `path`/notes/sub/(scot %p ship.flag)/[name.flag]
  ::
  ++  no-sub-wire
    `path`/notes/sub/(scot %p ship.flag)/[name.flag]
  ::
  ++  no-sub-path
    `path`/v0/notes/(scot %p ship.flag)/[name.flag]/updates
  ::  +no-action: convert local action to c-notes and send poke to host.
  ::  Works for both %pub and %sub net — if host==our.bowl, Gall loops it back.
  ::
  ++  no-action
    |=  act=action:n
    ^+  no-core
    ?>  ?=(%notebook -.act)
    =/  cmd=command:n
      [%notebook flag.act (a-notebook-to-c-notebook a-notebook.act)]
    %-  emit
    :*  %pass
        no-sub-wire
        %agent
        [ship.flag %notes]
        %poke
        notes-command+!>(cmd)
    ==
  ::  +no-action-v1: subscribe to host's per-request path, poke host with
  ::  the v1 command (carrying request-id), schedule a per-request behn
  ::  timeout. The host's response-update will arrive on the watch wire,
  ::  flow through +agent → +no-agent-req to finalize the request.
  ::
  ::  For self-hosted notebooks (ship.flag == our.bowl) this loops through
  ::  Gall — uniform code path at the cost of one extra event hop.
  ::
  ++  no-action-v1
    |=  [rid=request-id:v1:n act=action:n]
    ^+  no-core
    ?>  ?=(%notebook -.act)
    =/  cmd1=command:v1:n
      [rid [%notebook flag.act (a-notebook-to-c-notebook a-notebook.act)]]
    =.  no-core
      %-  emit
      :*  %pass  (no-req-watch-wire rid)
          %agent  [ship.flag %notes]
          %watch  (no-req-watch-path rid)
      ==
    =.  no-core
      %-  emit
      :*  %pass  (no-req-poke-wire rid)
          %agent  [ship.flag %notes]
          %poke  notes-command-1+!>(cmd1)
      ==
    %-  emit
    [%pass (no-req-wake-wire rid) %arvo %b %wait (add now.bowl ~s20)]
  ::  +no-agent-req-watch: handle signs on /notes/req/<uv>/watch wire.
  ::  watch-ack: nack finalizes %not-authorized. fact: response-update
  ::  from host, transform to response and finalize.
  ::
  ++  no-agent-req-watch
    |=  [rid=request-id:v1:n =sign:agent:gall]
    ^+  no-core
    ?+  -.sign  no-core
        %watch-ack
      ?~  p.sign  no-core
      =.  cor  (finalize-request rid [%error %not-authorized u.p.sign])
      no-cleanup-placeholder
    ::
        %fact
      ?.  =(p.cage.sign %notes-response-update-1)
        no-core
      =+  !<(ru=response-update:v1:n q.cage.sign)
      =/  body=response-body:v1:n
        ?-  -.body.ru
          %no-change  [%no-change ~]
          %ok         [%ok %update flag update.body.ru]
          %error      [%error type.body.ru message.body.ru]
        ==
      =.  cor  (finalize-request rid body)
      ::  kick off the broadcast subscription on the first successful
      ::  cross-ship response. covers the post-join case where the
      ::  placeholder net hasn't started watching the host's stream yet;
      ::  no-op once init flips & after the snapshot arrives.
      =?  no-core  ?&(?=([%ok *] body) ?=(%sub -.net) !init.net)
        no-start-watch
      ::  on a terminal error, roll back the local placeholder so a
      ::  failed remote join doesn't leave a ghost notebook in books.
      ::  no-cleanup-placeholder is a no-op for real subscriptions.
      =?  no-core  ?=([%error *] body)  no-cleanup-placeholder
      ::  leave the host watch — we got our terminal response
      %-  emit
      [%pass (no-req-watch-wire rid) %agent [ship.flag %notes] %leave ~]
    ::
        %kick
      no-core
    ==
  ::  +no-agent-req-poke: handle poke-ack on /notes/req/<uv>/poke wire.
  ::  nack → finalize %unknown + leave host watch + roll back any
  ::  placeholder. ack → mark poke-status.
  ::
  ++  no-agent-req-poke
    |=  [rid=request-id:v1:n =sign:agent:gall]
    ^+  no-core
    ?+  -.sign  no-core
        %poke-ack
      ?~  p.sign
        ?~  req=(~(get by requests) rid)  no-core
        =.  requests
          (~(put by requests) rid u.req(poke-status %acked))
        no-core
      =?  requests  ?=(^ (~(get by requests) rid))
        =/  u  (~(got by requests) rid)
        (~(put by requests) rid u(poke-status %nacked))
      =.  cor  (finalize-request rid [%error %unknown u.p.sign])
      =.  no-core  no-cleanup-placeholder
      %-  emit
      [%pass (no-req-watch-wire rid) %agent [ship.flag %notes] %leave ~]
    ==
  ::  +no-cleanup-placeholder: roll back the books entry if we were
  ::  still in placeholder state (subscriber, no snapshot yet). For
  ::  real subscriptions this is a no-op; a transient cross-ship
  ::  failure doesn't tear down an established notebook.
  ::
  ++  no-cleanup-placeholder
    ^+  no-core
    ?.  ?&(?=(%sub -.net) !init.net)  no-core
    no-core(gone &)
  ::  +no-report-active: card that tells our local %groups the channel-host
  ::  active state of this notes nest (joined & / left |), or ~ if this
  ::  notebook isn't group-affiliated. %groups updates active-channels for the
  ::  reported group. The group lives on notebook-state (set on the host at
  ::  create, learned by subscribers from the %snapshot).
  ::
  ++  no-report-active
    |=  joined=?
    ^-  (unit card)
    ?~  grp=group.notebook-state  ~
    =/  =nest:n  [%notes ship.flag name.flag]
    :-  ~
    :*  %pass  /report-active  %agent  [our.bowl %groups]
        %poke  group-channel-active+!>([u.grp nest joined])
    ==
  ::  +no-start-watch: subscribe to the host's update stream. The active-channels
  ::  report happens in +no-response on the %snapshot (once we know the group);
  ::  here we only watch.
  ::
  ++  no-start-watch
    ?:  =(%pub -.net)
      %-  (slog leaf+"no-start-watch: host, skipping watch" ~)
      no-core
    (emit [%pass no-sub-wire %agent [ship.flag %notes] %watch no-sub-path])
  ::
  ++  no-leave
    ?:  =(%pub -.net)
      %-  (slog leaf+"no-leave: host, skipping leave" ~)
      no-core
    =.  gone  &
    %-  emil
    %+  weld  (drop (no-report-active |))
    ^-  (list card)
    [%pass no-sub-wire %agent [ship.flag %notes] %leave ~]~
  ::  +no-publish: cache HTML for a note in this notebook so this ship's
  ::  /notes/pub/<flag>/<note-id> serves it. Self-check is enforced at the
  ::  action-poke layer (?> =(our.bowl src.bowl)); no-abed has already
  ::  validated that the notebook exists. No further permission gating —
  ::  publishing is a per-ship cache write, not an authority assertion.
  ::
  ++  no-publish
    |=  [nid=@ud html=@t]
    ^+  no-core
    =.  published  (~(put by published) [flag nid] html)
    no-core
  ::  +no-unpublish: remove a previously-published note's cached HTML.
  ::
  ++  no-unpublish
    |=  nid=@ud
    ^+  no-core
    =.  published  (~(del by published) [flag nid])
    no-core
  ::  +no-agent: handle sign on the [%notes %sub ship name ~] wire.
  ::  Used by both pub and sub: when we host (pub), self-pokes from the
  ::  action handler flow back as %poke-ack on this wire; when we sub,
  ::  the host sends %fact / %kick / %watch-ack here.
  ::
  ++  no-agent
    |=  =sign:agent:gall
    ^+  no-core
    ?+  -.sign  no-core
        %fact
      =/  =response:n  !<(response:n q.cage.sign)
      (no-response response)
    ::
        %kick
      ?.  ?=(%sub -.net)  no-core
      %-  emit
      :*  %pass
          no-sub-wire
          %agent
          [ship.flag %notes]
          %watch
          no-sub-path
      ==
    ::
        %watch-ack
      ?~  p.sign  no-core
      ?.  ?=(%sub -.net)  no-core
      ::  group-mode revocation: the host's read gate (+se-can-view) nacks a
      ::  resubscribe once our access is pulled. If our own local %groups
      ::  replica agrees we can no longer read, this is a real revocation —
      ::  leave the notebook (drop the book + report the active-leave so the
      ::  client drops it) instead of retrying forever. We confirm against the
      ::  local replica so a transient nack (host's group not yet synced, or
      ::  the group not yet replicated here) still falls through to the retry.
      =/  grp=(unit flag:n)  group.notebook-state
      ?:  ?&  ?=(^ grp)
              (group-synced u.grp)
              !(group-can-read-raw u.grp flag our.bowl)
          ==
        no-leave
      =.  net  net(init |)
      ::  Schedule a retry. The host (or network) may have transiently
      ::  failed; without this, a single bad watch-ack leaves the
      ::  subscription dead until the user manually rejoins.
      %-  emit
      :*  %pass
          /notes/rewatch/(scot %p ship.flag)/[name.flag]
          %arvo  %b  %wait  (add now.bowl ~s30)
      ==
    ==
  ::  +no-response: apply an update from the host to local state
  ::
  ++  no-response
    |=  =response:n
    ^+  no-core
    ?-  -.response
        %snapshot
      =.  notebook-state  notebook-state.response
      ?>  ?=(%sub -.net)
      =.  net  net(init &)
      =.  cards  [notebooks-changed-card cards]
      ::  the snapshot carries the host's notebook-state, so group is now
      ::  known — report active to %groups (no-op if not a group channel).
      =/  stream=card
        :*  %give  %fact  [/v0/notes/(scot %p ship.flag)/[name.flag]/stream]~
            notes-response+!>(response)
        ==
      =/  rep=(unit card)  (no-report-active &)
      (emil ?~(rep ~[stream] ~[stream u.rep]))
    ::
        %update
      =.  no-core  (no-apply-update flag.response update.response)
      %-  give
      [%fact [/v0/notes/(scot %p ship.flag)/[name.flag]/stream]~ notes-response+!>(response)]
    ==
  ::  +no-apply-update: apply a single u-notebook update to local state
  ::
  ++  no-apply-update
    |=  [=flag:n upd=update:n]
    ^+  no-core
    ?-  -.u-notebook.upd
        %created
      =.  notebook.notebook-state  notebook.u-notebook.upd
      no-core
    ::
        %updated
      =.  notebook.notebook-state  notebook.u-notebook.upd
      no-core
    ::
        %deleted
      no-core(gone &)
    ::
        %visibility
      ::  write visibility into local notebook-state
      =.  visibility.notebook-state  visibility.u-notebook.upd
      no-core
    ::
        %member-joined
      =.  members.notebook-state
        (~(put by members.notebook-state) who.u-notebook.upd role.u-notebook.upd)
      no-core
    ::
        %member-left
      =.  members.notebook-state
        (~(del by members.notebook-state) who.u-notebook.upd)
      no-core
    ::
        %invite-received
      no-core   :: handled via give-inbox-received on host; no local state
    ::
        %invite-removed
      no-core
    ::
        %folder
      (no-apply-folder-update id.u-notebook.upd u-folder.u-notebook.upd)
    ::
        %note
      (no-apply-note-update id.u-notebook.upd u-note.u-notebook.upd)
    ==
  ::
  ++  no-apply-folder-update
    |=  [fid=@ud upd=u-folder:n]
    ^+  no-core
    ?-  -.upd
        %created
      =.  folders.notebook-state
        (~(put by folders.notebook-state) fid folder.upd)
      no-core
        %updated
      =.  folders.notebook-state
        (~(put by folders.notebook-state) fid folder.upd)
      no-core
        %deleted
      =.  folders.notebook-state
        (~(del by folders.notebook-state) fid)
      no-core
    ==
  ::
  ++  no-apply-note-update
    |=  [nid=@ud upd=u-note:n]
    ^+  no-core
    ?-  -.upd
        %created
      =.  notes.notebook-state
        (~(put by notes.notebook-state) nid note.upd)
      no-core
        %updated
      =.  notes.notebook-state
        (~(put by notes.notebook-state) nid note.upd)
      no-core
        %deleted
      =.  notes.notebook-state
        (~(del by notes.notebook-state) nid)
      no-core
        %published
      no-core   :: host-side only; subscriber doesn't track published state
        %unpublished
      no-core
        %history-archived
      ::  append archived revision to local per-notebook history cache
      =/  existing=(list note-revision:n)
        (fall (~(get by history.notebook-state) nid) ~)
      =.  history.notebook-state
        (~(put by history.notebook-state) nid [note-revision.upd existing])
      no-core
    ==
  ::  +no-peek: handle per-notebook scry requests
  ::  kind: the path segment after /v0/ (e.g. %notebook, %notes, %note, etc.)
  ::  rest: the remainder of the pole after kind/ship/name (typed as *)
  ::
  ++  no-peek
    |=  [kind=@ rest=*]
    ^-  (unit (unit cage))
    ::  read gate: group-mode notebooks re-check the group's live can-read
    ::  (the members map isn't pruned on revocation), non-group use the
    ::  members map. Mirrors +se-can-view / +se-can-edit.
    ?>  (can-view-flag flag src.bowl)
    ?+  kind  ~
        %notebook
      =/  nd=notebook-detail:n  [flag notebook.notebook-state visibility.notebook-state]
      ``notes-notebook+!>(nd)
    ::
        %folders
      =/  flds=(list folder:n)
        ~(val by folders.notebook-state)
      ``notes-folders+!>(flds)
    ::
        %notes
      =/  nts=(list note:n)
        ~(val by notes.notebook-state)
      ``notes-notes+!>(nts)
    ::
        %note
      =/  nid=@ud  (slav %ud ;;(@ -.rest))
      ?~  note=(~(get by notes.notebook-state) nid)
        ~
      ``notes-note+!>(u.note)
    ::
        %note-history
      =/  nid=@ud  (slav %ud ;;(@ -.rest))
      =/  revs=(list note-revision:n)
        (fall (~(get by history.notebook-state) nid) ~)
      ``notes-note-history+!>(revs)
    ::
        %folder
      =/  fid=@ud  (slav %ud ;;(@ -.rest))
      ?~  fld=(~(get by folders.notebook-state) fid)
        ~
      ``notes-folder+!>(u.fld)
    ::
        %members
      =/  mrecords=(list member-record:n)
        %+  turn  ~(tap by members.notebook-state)
        |=  [who=ship r=role:n]
        [who r]
      ``notes-members+!>(mrecords)
    ==
  ::  +no-watch: handle local UI stream subscription for this notebook
  ::
  ++  no-watch
    ^+  no-core
    ?>  ?=(^ (~(get by members.notebook-state) src.bowl))
    %-  give
    :+  %fact
      [`path`/v0/notes/(scot %p ship.flag)/[name.flag]/stream]~
    notes-response+!>(`response:n`[%snapshot flag visibility.notebook-state notebook-state])
  ::  +no-read-json: per-notebook read surface for the v1 GET API. Same
  ::  data as +no-peek but JSON-encoded for HTTP. `rest` is the path
  ::  remainder after /notes/~/v1/notebooks/{host}/{name}. Membership-
  ::  gated like no-peek.
  ::
  ++  no-read-json
    |=  rest=path
    ^-  (unit json)
    ::  our.bowl, not src.bowl — see read-notebooks-json. The HTTP auth
    ::  gate already ran; identity is the ship.
    ?>  ?=(^ (~(get by members.notebook-state) our.bowl))
    ?+    rest  ~
        ~
      ::  notebook detail
      :-  ~
      %-  notebook-detail:enjs:notes-json
      [flag notebook.notebook-state visibility.notebook-state]
    ::
        [%folders ~]
      `(folders:enjs:notes-json ~(val by folders.notebook-state))
    ::
        [%folders @ ~]
      =/  fid=@ud  (slav %ud i.t.rest)
      ?~  fld=(~(get by folders.notebook-state) fid)  ~
      `(folder:enjs:notes-json u.fld)
    ::
        [%notes ~]
      `(notes:enjs:notes-json ~(val by notes.notebook-state))
    ::
        [%notes @ ~]
      =/  nid=@ud  (slav %ud i.t.rest)
      ?~  note=(~(get by notes.notebook-state) nid)  ~
      `(note:enjs:notes-json u.note)
    ::
        [%notes @ %history ~]
      =/  nid=@ud  (slav %ud i.t.rest)
      :-  ~
      %-  note-revisions:enjs:notes-json
      (fall (~(get by history.notebook-state) nid) ~)
    ::
        [%members ~]
      =/  mrecords=(list member-record:n)
        %+  turn  ~(tap by members.notebook-state)
        |=  [who=ship r=role:n]
        [who r]
      `(member-records:enjs:notes-json mrecords)
    ==
  --
--

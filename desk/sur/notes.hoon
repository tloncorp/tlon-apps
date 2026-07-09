::  notes: shared notebook surface types
::
|%
+$  role
  ?(%owner %editor %viewer)
::  notebook visibility: private (default) rejects joins from non-members;
::  public allows anyone to join.
::
+$  visibility
  ?(%public %private)
::  $flag: global notebook identity (ship + slug term)
::
+$  flag  [=ship name=@tas]
::  $flag-v9: legacy flag type used by state-1..9 (name was @t cord)
+$  flag-v9  [=ship name=@t]
::  $notebook: top-level container
::
+$  notebook
  $:  id=@ud
      title=@t
      created-by=ship
      created-at=@da
      updated-at=@da
      updated-by=ship
  ==
::  $nest: channel identifier shared with %groups. Structurally identical
::  to groups' nest (kind term + host + name); for %notes channels the
::  kind is always %notes and [host name] is the notebook flag. Used by the
::  %group-channel-join / %group-channel-leave channel-host pokes from %groups.
::
+$  nest  [kind=@tas host=@p name=@tas]
::  channel-host poke payloads. %groups pokes %group-channel-join /
::  %group-channel-leave to auto-join/leave a notes channel as the group
::  fleet changes. join carries the group flag so the host can record
::  affiliation; leave just identifies the nest.
::
+$  channel-join   [=nest group=flag]
+$  channel-leave  [=nest]
::
+$  group-channel
  $:  meta=[title=@t description=@t image=@t cover=@t]
      created=@da
      section=@tas
      readers=(set @tas)
      join=?
  ==
+$  group-create
  $:  %group
      =flag
      %channel
      =nest
      %add
      channel=group-channel
  ==
::  %group action to remove the notes channel from a group (mirror of
::  group-create's %add), sent when a group-mode notebook is deleted.
::
+$  group-channel-del
  $:  %group
      =flag
      %channel
      =nest
      %del
      ~
  ==
::  $folder: directory node inside a notebook
::
+$  folder
  $:  id=@ud
      notebook-id=@ud
      name=@t
      parent-folder-id=(unit @ud)
      created-by=ship
      created-at=@da
      updated-at=@da
      updated-by=ship
  ==
::  $note: leaf document node
::
+$  note
  $:  id=@ud
      notebook-id=@ud
      folder-id=@ud
      title=@t
      slug=(unit @t)
      body-md=@t
      created-by=ship
      created-at=@da
      updated-by=ship
      updated-at=@da
      revision=@ud
  ==
::
+$  members  (map ship role)
+$  notebook-members  members  ::  legacy alias for v0 migration types
::  $note-revision: an archived prior version of a note
::
+$  note-revision
  $:  rev=@ud
      at=@da
      author=ship
      title=@t
      body-md=@t
  ==
::  $invite-info: pending invite we've received
::
+$  invite-info  [from=ship sent-at=@da title=@t]
::
+$  import-node
  $%  [%folder name=@t children=(list import-node)]
      [%note title=@t body-md=@t]
  ==
::  $notebook-state-v8: notebook-state shape used by state-8 books map
::
+$  notebook-state-v8
  $:  =notebook
      notebook-members=notebook-members
      folders=(map @ud folder)
      notes=(map @ud note)
  ==
::  $notebook-state: all data for a single notebook (state-14+).
::  group: optional Tlon group affiliation. When set, the notebook is a group
::  channel — read permission defers to the group's can-read. Set once at
::  create (host) and propagated to subscribers via the %snapshot. Lives on
::  notebook-state (not $notebook) so it stays out of the on-disk log, which
::  embeds $notebook via u-notebook.
::
+$  notebook-state
  $:  =notebook
      =members
      =visibility
      folders=(map @ud folder)
      notes=(map @ud note)
      history=(map note-id=@ud (list note-revision))
      group=(unit flag)
  ==
::  $notebook-state-13: frozen pre-group notebook-state, embedded by states
::  9..12 books maps and their migration arms (group arrived in state-14).
::
+$  notebook-state-13
  $:  =notebook
      =members
      =visibility
      folders=(map @ud folder)
      notes=(map @ud note)
      history=(map note-id=@ud (list note-revision))
  ==
::  Actions (client → agent)
::
::  $a-notes: top-level client actions.
::  notebook-scoped actions are routed via [%notebook =flag =a-notebook].
::
+$  a-notes
  $%  [%create-notebook title=@t]
      ::  %create-group-notebook: born inside a group. defers read perms to
      ::  the group; readers are the group role-ids the channel is restricted
      ::  to (empty = open). forwarded opaquely to %groups on registration.
      [%create-group-notebook title=@t group=flag readers=(set @tas)]
      [%join =flag]
      [%leave =flag]
      [%accept-invite =flag]
      [%decline-invite =flag]
      [%notebook =flag =a-notebook]
      ::  api-key management — local-only (?> =(our.bowl src.bowl) at the
      ::  poke handler). Regenerate replaces the stored key; clear erases
      ::  it (disabling the X-Api-Key bypass).
      [%regenerate-api-key ~]
      [%clear-api-key ~]
      ::  %register-mcp: register %notes as an openapi upstream with the
      ::  local %mcp-proxy. base-url defaults to 'http://localhost:8080'
      ::  if ~. The api-key is minted on demand if missing. Local-only.
      [%register-mcp base-url=(unit @t)]
  ==
::  $a-notebook: actions scoped to a specific notebook.
::  Outer tag carries flag so inner tags drop the subject prefix.
::
+$  a-notebook
  $%  [%rename title=@t]
      [%delete ~]
      [%visibility =visibility]
      [%invite who=ship]
      [%create-folder parent=@ud name=@t]
      [%folder id=@ud =a-folder]
      [%create-note folder=@ud title=@t body=@t]
      [%note id=@ud =a-note]
      [%batch-import folder=@ud notes=(list [title=@t body=@t])]
      [%batch-import-tree parent=@ud tree=(list import-node)]
  ==
::  $a-folder: actions scoped to a specific folder
::
+$  a-folder
  $%  [%rename name=@t]
      [%move new-parent=@ud]
      [%delete recursive=?]
      ::  %update: REST-friendly combined rename+move. Either or both
      ::  fields may be set; the handler is a no-op for fields left ~.
      [%update name=(unit @t) parent=(unit @ud)]
  ==
::  $a-note: actions scoped to a specific note
::
+$  a-note
  $%  [%rename title=@t]
      [%move folder=@ud]
      [%delete ~]
      [%update body=@t expected-revision=@ud]
      ::  %modify: REST-friendly combined rename+move. Either or both
      ::  fields may be set; body updates stay on %update so the
      ::  revision-check semantics don't get tangled with metadata edits.
      [%modify title=(unit @t) folder=(unit @ud)]
      [%publish html=@t]
      [%unpublish ~]
      [%restore rev=@ud]
  ==
::  Commands (poke surface — actor authenticated via src.bowl)
::
::  $c-notes: tagged union of cross-ship messages.
::  %notify-invite — host pokes invitee with a pending invite (carries title
::    for inbox rendering pre-join). src.bowl must equal the host of `flag`.
::  %notebook — subscriber forwards a notebook-scoped command to the host.
::    src.bowl is the actor; permission checks happen in se-core.
::
+$  c-notes
  $%  [%notify-invite =flag title=@t]
      [%notebook =flag =c-notebook]
  ==
::  $c-cmd: `command for a specific notebook` — the flag carries routing
::  context, c-notebook carries the verb. Not a wire type; c-notes
::  %notebook arm peels into this on the way in. se-core's arms now take
::  the flag from door context (se-abed) and the c-notebook payload
::  directly, so this shape isn't threaded through se-poke anymore —
::  kept here in case other code still wants the combined shape.
::
+$  c-cmd  [=flag =c-notebook]
::  $c-notebook: notebook-scoped commands. Mirrors a-notebook minus
::  client-only verbs (%restore is purely client-side restatement of %update).
::  Adds %member-join/%member-leave for peer join/leave signals.
::
+$  c-notebook
  $%  [%rename title=@t]
      [%delete ~]
      [%visibility =visibility]
      [%invite who=ship]
      [%create-folder parent=@ud name=@t]
      [%folder id=@ud =a-folder]
      [%create-note folder=@ud title=@t body=@t]
      [%note id=@ud =a-note]
      [%batch-import folder=@ud notes=(list [title=@t body=@t])]
      [%batch-import-tree parent=@ud tree=(list import-node)]
      [%member-join ~]
      [%member-leave ~]
  ==
::  Updates (agent → subscriber)
::
+$  u-notebook
  $%  [%created =notebook =visibility]
      [%updated =notebook]
      [%deleted ~]
      [%visibility =visibility]
      [%member-joined who=ship =role]
      [%member-left who=ship]
      [%invite-received from=ship title=@t]
      [%invite-removed ~]
      [%folder id=@ud =u-folder]
      [%note id=@ud =u-note]
  ==
::
+$  u-folder
  $%  [%created =folder]
      [%updated =folder]
      [%deleted ~]
  ==
::
+$  u-note
  $%  [%created =note]
      [%updated =note]
      [%deleted ~]
      [%published html=@t]
      [%unpublished ~]
      [%history-archived =note-revision]
  ==
::  $update: single log entry — time-keyed u-notebook
::
+$  update  [=time =u-notebook]
::  $u-notes: wire/stream shape — carries flag so listeners know which notebook
::
+$  u-notes  [=flag =u-notebook]
::  $u-inbox: events pushed on /v0/inbox/stream for cross-cutting UI signals
::  (pending invites + a "notebooks changed, please re-scry" ping).
::
+$  u-inbox
  $%  [%invite-received =flag from=ship sent-at=@da title=@t]
      [%invite-removed =flag]
      [%notebooks-changed ~]
  ==
::  Responses (subscription facts)
::
::  $r-notes: facts pushed to subscribers on /v0/notes/~ship/name/stream
::  %snapshot carries visibility so subscribers can seed their local cache.
::
+$  r-notes
  $%  [%snapshot =flag =visibility =notebook-state]
      [%update =flag =update]
  ==
::  $log: time-ordered append-only update log (one per notebook, u-notebook entries)
::
+$  log    ((mop time u-notebook) lte)
++  log-on  ((on time u-notebook) lte)
::  $net: host vs subscriber discriminator
::
+$  net
  $~  [%pub *log]
  $%  [%pub =log]
      [%sub =time init=_|]
  ==
::  Scry response types — typed marks for peek endpoints
::
::  $notebook-summary: one item from /v0/notebooks (carries flag + visibility)
::
+$  notebook-summary  [=flag =notebook =visibility]
::  $notebook-detail: one item from /v0/notebook/~ship/name
::
+$  notebook-detail   [=flag =notebook =visibility]
::  $member-record: one item from /v0/members list
::
+$  member-record     [=ship =role]
::  $invite-record: one item from /v0/invites list
::
+$  invite-record     [=flag =invite-info]
::  $published-record: one item from /v0/published list — metadata only.
::  HTML body is served via /notes/pub/~host/name/note-id, not this list.
::
+$  published-record  [=flag note-id=@ud]
::  Type aliases
::
+$  action    a-notes
+$  command   c-notes
+$  response  r-notes
::  v1: HTTP / request-id surface
::
::  Wraps a-notes / c-notes / r-notes / update with a correlating
::  request-id so the client gets a typed terminal response keyed to
::  its action. Consumed by the HTTP API mount (/notes/~/v1) and the
::  per-request SSE paths (/v1/notes/~ship/name/request/...).
::
++  v1
  |%
  +$  request-id  @uv
  +$  poke-status  ?(%sending %acked %nacked)
  ::  $action-error: enumerated failure modes returned in response-body.
  ::  %conflict — expected-revision mismatch (drives editor conflict banner).
  +$  action-error
    $?  %not-authorized
        %not-found
        %invalid-name
        %conflict
        %request-too-large
        %unknown
    ==
  +$  action            [=request-id =a-notes]
  +$  command           [=request-id =c-notes]
  +$  response          [id=request-id body=response-body]
  +$  response-update   [id=request-id body=response-update-body]
  ::  $response-body: subscriber → client.
  ::  %ok        — a notebook mutation (snapshot/update); carries flag inline
  ::  %notebook  — a freshly-created notebook's summary (flag + metadata +
  ::               visibility). Returned by %create-notebook so the caller
  ::               learns the slugified flag without re-scrying.
  ::  %api-key   — the current api-key after a regenerate/clear. ~ = cleared.
  ::  %error     — typed failure
  ::  %pending   — cross-ship request still in flight; poll / sub the path
  +$  response-body
    $%  [%no-change ~]
        [%ok =r-notes]
        [%notebook summary=notebook-summary]
        [%api-key key=(unit @t)]
        [%error type=action-error message=tang]
        [%pending status=poke-status]
    ==
  ::  $response-update-body: host → subscriber. Carries the host's
  ::  applied update (or error); subscriber wraps it as a response
  ::  using the request-path flag for client delivery.
  +$  response-update-body
    $%  [%no-change ~]
        [%ok =update]
        [%error type=action-error message=tang]
    ==
  ::  $incoming-request: subscriber-side tracking record for a single
  ::  in-flight action. http-id non-null means an Eyre POST is being
  ::  held open waiting for the terminal response. final-at is set
  ::  when result is %ok / %error / %no-change; cleanup uses it to
  ::  evict the entry after a grace window.
  +$  incoming-request
    $:  id=request-id
        http-id=(unit @ta)
        =poke-status
        result=(unit response-body)
        final-at=(unit @da)
        fetched=?
    ==
  +$  requests  (map request-id incoming-request)
  ::  Frozen request chain for states 11–12. Identical to the live chain
  ::  above except %snapshot carries notebook-state-13 (pre-group). states
  ::  11/12 transitively embed notebook-state via r-notes %snapshot
  ::  inside the requests map, so the old states must freeze this chain too —
  ::  freezing books alone left requests pointing at the group-bearing
  ::  notebook-state and broke loads of any on-disk state with a stored
  ::  snapshot in requests.
  +$  r-notes-13
    $%  [%snapshot =flag =visibility notebook-state=notebook-state-13]
        [%update =flag =update]
    ==
  +$  response-body-13
    $%  [%no-change ~]
        [%ok r-notes=r-notes-13]
        [%notebook summary=notebook-summary]
        [%api-key key=(unit @t)]
        [%error type=action-error message=tang]
        [%pending status=poke-status]
    ==
  +$  incoming-request-13
    $:  id=request-id
        http-id=(unit @ta)
        =poke-status
        result=(unit response-body-13)
        final-at=(unit @da)
        fetched=?
    ==
  +$  requests-13  (map request-id incoming-request-13)
  --
::  Versioned state — newest first
::
::  state-14: notebook-state gains optional `group` for group-channel mode.
::
+$  state-14
  $:  %14
      books=(map flag [=net =notebook-state])
      next-id=@ud
      published=(map [=flag note-id=@ud] @t)
      invites=(map flag invite-info)
      requests=requests:v1
      api-key=(unit @t)
  ==
::
+$  state  state-14
::  state-12: adds api-key for the X-Api-Key HTTP auth bypass.
::
+$  state-12
  $:  %12
      books=(map flag [=net notebook-state=notebook-state-13])
      next-id=@ud
      published=(map [=flag note-id=@ud] @t)
      invites=(map flag invite-info)
      requests=requests-13:v1
      api-key=(unit @t)
  ==
::  state-11: adds requests map for HTTP / request-id correlation
::
+$  state-11
  $:  %11
      books=(map flag [=net notebook-state=notebook-state-13])
      next-id=@ud
      published=(map [=flag note-id=@ud] @t)
      invites=(map flag invite-info)
      requests=requests-13:v1
  ==
::  state-10: flag.name tightened to @tas slug (no requests map)
::
+$  state-10
  $:  %10
      books=(map flag [=net notebook-state=notebook-state-13])
      next-id=@ud
      published=(map [=flag note-id=@ud] @t)
      invites=(map flag invite-info)
  ==
::  state-9: visibility + history moved per-notebook; members renamed.
::  Uses flag-v9 (name=@t) in map keys — stored atoms weren't valid @tas.
::
+$  state-9
  $:  %9
      books=(map flag-v9 [=net notebook-state=notebook-state-13])
      next-id=@ud
      published=(map [=flag-v9 note-id=@ud] @t)
      invites=(map flag-v9 invite-info)
  ==
::  state-8: adds updated-by, u-notebook log; visibilities + history at top level
::
+$  state-8
  $:  %8
      books=(map flag-v9 [=net =notebook-state-v8])
      next-id=@ud
      published=(map [=flag-v9 note-id=@ud] @t)
      visibilities=(map flag-v9 visibility)
      invites=(map flag-v9 invite-info)
      history=(map [=flag-v9 note-id=@ud] (list note-revision))
  ==
::  Legacy entity types — for migrating states 0-7 which lack updated-by
::  on notebook and folder.
::
+$  notebook-v0
  $:  id=@ud
      title=@t
      created-by=ship
      created-at=@da
      updated-at=@da
  ==
::
+$  folder-v0
  $:  id=@ud
      notebook-id=@ud
      name=@t
      parent-folder-id=(unit @ud)
      created-by=ship
      created-at=@da
      updated-at=@da
  ==
::
+$  notebook-state-v0
  $:  notebook=notebook-v0
      notebook-members=notebook-members
      folders=(map @ud folder-v0)
      notes=(map @ud note)
  ==
::  net-v0: old log used raw u-notes (flat), not u-notebook
::
+$  net-v0
  $%  [%pub log=*]
      [%sub =time init=_|]
  ==
::  invite-info-5: invite from state-5 (lacks title)
::
+$  invite-info-5  [from=ship sent-at=@da]
::  state-7: master current state (pre-refactor).
::  Uses net-v0 (log=*) since the on-disk log has u-notes entries (old flat type).
::  Uses notebook-state-v0 since notebook and folder lacked updated-by.
::
+$  state-7
  $:  %7
      books=(map flag-v9 [net=net-v0 notebook-state=notebook-state-v0])
      next-id=@ud
      published=(map [=flag-v9 note-id=@ud] @t)
      visibilities=(map flag-v9 visibility)
      invites=(map flag-v9 invite-info)
      history=(map [=flag-v9 note-id=@ud] (list note-revision))
  ==
::  state-6: invites carry notebook title.
::  Also uses v0 types for books.
::
+$  state-6
  $:  %6
      books=(map flag-v9 [net=net-v0 notebook-state=notebook-state-v0])
      next-id=@ud
      published=(map [=flag-v9 note-id=@ud] @t)
      visibilities=(map flag-v9 visibility)
      invites=(map flag-v9 invite-info)
  ==
::  state-5: pending invites with shape [from sent-at] — kept for migration
::
+$  state-5
  $:  %5
      books=(map flag-v9 [net=net-v0 notebook-state=notebook-state-v0])
      next-id=@ud
      published=(map [=flag-v9 note-id=@ud] @t)
      visibilities=(map flag-v9 visibility)
      invites=(map flag-v9 invite-info-5)
  ==
::  state-4: adds per-notebook visibility
::
+$  state-4
  $:  %4
      books=(map flag-v9 [net=net-v0 notebook-state=notebook-state-v0])
      next-id=@ud
      published=(map [=flag-v9 note-id=@ud] @t)
      visibilities=(map flag-v9 visibility)
  ==
::  state-3: published keyed by (flag, note-id)
::
+$  state-3
  $:  %3
      books=(map flag-v9 [net=net-v0 notebook-state=notebook-state-v0])
      next-id=@ud
      published=(map [=flag-v9 note-id=@ud] @t)
  ==
::  state-2: adds published notes cache keyed only by note-id
::
+$  state-2
  $:  %2
      books=(map flag-v9 [net=net-v0 notebook-state=notebook-state-v0])
      next-id=@ud
      published=(map @ud @t)
  ==
::  state-1: dual-mode host/subscriber state
::
+$  state-1
  $:  %1
      books=(map flag-v9 [net=net-v0 notebook-state=notebook-state-v0])
      next-id=@ud
  ==
::  state-0: legacy single-player state (kept for migration)
::
+$  state-0
  $:  %0
      notebooks=(map @ud notebook-v0)
      folders=(map @ud folder-v0)
      notes=(map @ud note)
      members=(map @ud notebook-members)
      next-id=@ud
      updates=*
      next-update-id=@ud
  ==
::
--

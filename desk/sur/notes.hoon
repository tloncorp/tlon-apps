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
::
--

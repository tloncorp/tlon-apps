::  lib/notes-json: JSON encoding/decoding for notes types
::
/-  n=notes
|%
::  +enjs: encode notes types to JSON
::
++  enjs
  =,  enjs:format
  |%
  ++  notebook
    |=  nb=notebook:n
    ^-  json
    %-  pairs
    :~  'id'^(numb id.nb)
        'title'^s+title.nb
        ::  rootFolderId is deterministically id+1 (set by se-create-notebook)
        'rootFolderId'^(numb +(id.nb))
        'createdBy'^s+(scot %p created-by.nb)
        'createdAt'^(numb (unt:chrono:userlib created-at.nb))
        'updatedAt'^(numb (unt:chrono:userlib updated-at.nb))
        'updatedBy'^s+(scot %p updated-by.nb)
    ==
  ::
  ++  folder
    |=  fld=folder:n
    ^-  json
    %-  pairs
    :~  'id'^(numb id.fld)
        'notebookId'^(numb notebook-id.fld)
        'name'^s+name.fld
        'parentFolderId'^?~(parent-folder-id.fld ~ (numb u.parent-folder-id.fld))
        'createdBy'^s+(scot %p created-by.fld)
        'createdAt'^(numb (unt:chrono:userlib created-at.fld))
        'updatedAt'^(numb (unt:chrono:userlib updated-at.fld))
        'updatedBy'^s+(scot %p updated-by.fld)
    ==
  ::
  ++  note
    |=  nt=note:n
    ^-  json
    %-  pairs
    :~  'id'^(numb id.nt)
        'notebookId'^(numb notebook-id.nt)
        'folderId'^(numb folder-id.nt)
        'title'^s+title.nt
        'slug'^?~(slug.nt ~ s+u.slug.nt)
        'bodyMd'^s+body-md.nt
        'createdBy'^s+(scot %p created-by.nt)
        'createdAt'^(numb (unt:chrono:userlib created-at.nt))
        'updatedBy'^s+(scot %p updated-by.nt)
        'updatedAt'^(numb (unt:chrono:userlib updated-at.nt))
        'revision'^(numb revision.nt)
    ==
  ::  +note-revision: archived prior version of a note
  ::
  ++  note-revision
    |=  nr=note-revision:n
    ^-  json
    %-  pairs
    :~  'rev'^(numb rev.nr)
        'at'^(numb (unt:chrono:userlib at.nr))
        'author'^s+(scot %p author.nr)
        'title'^s+title.nr
        'bodyMd'^s+body-md.nr
    ==
  ::  +u-folder: encode a folder-scoped update
  ::
  ++  u-folder
    |=  [id=@ud upd=u-folder:n]
    ^-  json
    ?-  -.upd
        %created
      %-  pairs
      :~  'type'^s+'folder-created'
          'id'^(numb id)
          'folder'^(folder folder.upd)
      ==
        %updated
      %-  pairs
      :~  'type'^s+'folder-updated'
          'id'^(numb id)
          'folder'^(folder folder.upd)
      ==
        %deleted
      %-  pairs
      :~  'type'^s+'folder-deleted'
          'id'^(numb id)
      ==
    ==
  ::  +u-note: encode a note-scoped update
  ::
  ++  u-note
    |=  [id=@ud upd=u-note:n]
    ^-  json
    ?-  -.upd
        %created
      %-  pairs
      :~  'type'^s+'note-created'
          'id'^(numb id)
          'note'^(note note.upd)
      ==
        %updated
      %-  pairs
      :~  'type'^s+'note-updated'
          'id'^(numb id)
          'note'^(note note.upd)
      ==
        %deleted
      %-  pairs
      :~  'type'^s+'note-deleted'
          'id'^(numb id)
      ==
        %published
      %-  pairs
      :~  'type'^s+'note-published'
          'id'^(numb id)
          'html'^s+html.upd
      ==
        %unpublished
      %-  pairs
      :~  'type'^s+'note-unpublished'
          'id'^(numb id)
      ==
        %history-archived
      %-  pairs
      :~  'type'^s+'note-history-archived'
          'id'^(numb id)
          'revision'^(note-revision note-revision.upd)
      ==
    ==
  ::  +u-notebook: encode a notebook-scoped update
  ::
  ++  u-notebook
    |=  [=flag:n upd=u-notebook:n]
    ^-  json
    %-  pairs
    ?-  -.upd
        %created
      :~  'type'^s+'notebook-created'
          'host'^s+(scot %p ship.flag)
          'flagName'^s+name.flag
          'notebook'^(notebook notebook.upd)
          'visibility'^s+(scot %tas visibility.upd)
      ==
        %updated
      :~  'type'^s+'notebook-updated'
          'host'^s+(scot %p ship.flag)
          'flagName'^s+name.flag
          'notebook'^(notebook notebook.upd)
      ==
        %deleted
      :~  'type'^s+'notebook-deleted'
          'host'^s+(scot %p ship.flag)
          'flagName'^s+name.flag
      ==
        %visibility
      :~  'type'^s+'notebook-visibility-changed'
          'host'^s+(scot %p ship.flag)
          'flagName'^s+name.flag
          'visibility'^s+(scot %tas visibility.upd)
      ==
        %member-joined
      :~  'type'^s+'member-joined'
          'host'^s+(scot %p ship.flag)
          'flagName'^s+name.flag
          'who'^s+(scot %p who.upd)
          'role'^s+(scot %tas role.upd)
      ==
        %member-left
      :~  'type'^s+'member-left'
          'host'^s+(scot %p ship.flag)
          'flagName'^s+name.flag
          'who'^s+(scot %p who.upd)
      ==
        %invite-received
      :~  'type'^s+'invite-received'
          'host'^s+(scot %p ship.flag)
          'flagName'^s+name.flag
          'from'^s+(scot %p from.upd)
          'title'^s+title.upd
      ==
        %invite-removed
      :~  'type'^s+'invite-removed'
          'host'^s+(scot %p ship.flag)
          'flagName'^s+name.flag
      ==
        %folder
      :~  'type'^s+'folder-update'
          'host'^s+(scot %p ship.flag)
          'flagName'^s+name.flag
          'folderUpdate'^(u-folder id.upd u-folder.upd)
      ==
        %note
      :~  'type'^s+'note-update'
          'host'^s+(scot %p ship.flag)
          'flagName'^s+name.flag
          'noteUpdate'^(u-note id.upd u-note.upd)
      ==
    ==
  ::  +notebook-summary: encode one /v0/notebooks item
  ::
  ++  notebook-summary
    |=  ns=notebook-summary:n
    ^-  json
    %-  pairs
    :~  'host'^s+(scot %p ship.flag.ns)
        'flagName'^s+name.flag.ns
        'notebook'^(notebook notebook.ns)
        'visibility'^s+(scot %tas visibility.ns)
    ==
  ::  +notebook-summaries: encode (list notebook-summary)
  ::
  ++  notebook-summaries
    |=  items=(list notebook-summary:n)
    ^-  json
    [%a (turn items notebook-summary)]
  ::  +notebook-detail: encode one /v0/notebook item
  ::
  ++  notebook-detail
    |=  nd=notebook-detail:n
    ^-  json
    %-  pairs
    :~  'host'^s+(scot %p ship.flag.nd)
        'flagName'^s+name.flag.nd
        'notebook'^(notebook notebook.nd)
        'visibility'^s+(scot %tas visibility.nd)
    ==
  ::  +member-record: encode one /v0/members item
  ::
  ++  member-record
    |=  mr=member-record:n
    ^-  json
    %-  pairs
    :~  'ship'^s+(scot %p ship.mr)
        'role'^s+(scot %tas role.mr)
    ==
  ::  +member-records: encode (list member-record)
  ::
  ++  member-records
    |=  items=(list member-record:n)
    ^-  json
    [%a (turn items member-record)]
  ::  +invite-record: encode one /v0/invites item
  ::
  ++  invite-record
    |=  ir=invite-record:n
    ^-  json
    %-  pairs
    :~  'host'^s+(scot %p ship.flag.ir)
        'flagName'^s+name.flag.ir
        'from'^s+(scot %p from.invite-info.ir)
        'sentAt'^(numb (unt:chrono:userlib sent-at.invite-info.ir))
        'title'^s+title.invite-info.ir
    ==
  ::  +invite-records: encode (list invite-record)
  ::
  ++  invite-records
    |=  items=(list invite-record:n)
    ^-  json
    [%a (turn items invite-record)]
  ::  +published-record: encode one /v0/published item
  ::
  ++  published-record
    |=  pr=published-record:n
    ^-  json
    %-  pairs
    :~  'host'^s+(scot %p ship.flag.pr)
        'flagName'^s+name.flag.pr
        'noteId'^(numb note-id.pr)
    ==
  ::  +published-records: encode (list published-record)
  ::
  ++  published-records
    |=  items=(list published-record:n)
    ^-  json
    [%a (turn items published-record)]
  ::  +u-inbox: encode an /v0/inbox/stream event. Wraps the payload in
  ::  {type:'update', update:<payload>} for FE compat with the existing
  ::  applyNotebookUpdate / applyInboxEvent dispatch.
  ::
  ++  u-inbox
    |=  evt=u-inbox:n
    ^-  json
    =/  payload=json
      ?-    -.evt
          %invite-received
        %-  pairs
        :~  'type'^s+'invite-received'
            'host'^s+(scot %p ship.flag.evt)
            'flagName'^s+name.flag.evt
            'from'^s+(scot %p from.evt)
            'sentAt'^(numb (div (sub sent-at.evt ~1970.1.1) ~s1))
            'title'^s+title.evt
        ==
      ::
          %invite-removed
        %-  pairs
        :~  'type'^s+'invite-removed'
            'host'^s+(scot %p ship.flag.evt)
            'flagName'^s+name.flag.evt
        ==
      ::
          %notebooks-changed
        (pairs ~[['type' s+'notebooks-changed']])
      ==
    (pairs ~[['type' s+'update'] ['update' payload]])
  ::  +note-revisions: encode (list note-revision)
  ::
  ++  note-revisions
    |=  items=(list note-revision:n)
    ^-  json
    [%a (turn items note-revision)]
  ::  +folders: encode (list folder)
  ::
  ++  folders
    |=  items=(list folder:n)
    ^-  json
    [%a (turn items folder)]
  ::  +notes: encode (list note)
  ::
  ++  notes
    |=  items=(list note:n)
    ^-  json
    [%a (turn items note)]
  ::  +response: encode r-notes response
  ::
  ++  response
    |=  res=response:n
    ^-  json
    ?-  -.res
        %update
      %-  pairs
      :~  'type'^s+'update'
          'host'^s+(scot %p ship.flag.res)
          'flagName'^s+name.flag.res
          'time'^(numb (unt:chrono:userlib time.update.res))
          'update'^(u-notebook flag.res u-notebook.update.res)
      ==
        %snapshot
      %-  pairs
      :~  'type'^s+'snapshot'
          'host'^s+(scot %p ship.flag.res)
          'flagName'^s+name.flag.res
          'visibility'^s+(scot %tas visibility.res)
      ==
    ==
  ::  +tang-json: render a tang as a JSON array.
  ::  TODO Phase 2+: render each tank to a tape with wash/re. Today we
  ::  emit an empty array; the typed errorType field carries the
  ::  actionable info, the tang is debug-only.
  ::
  ++  tang-json
    |=  ts=tang
    ^-  json
    [%a ~]
  ::  v1: request-id-wrapped response shapes
  ::  encoded for delivery over /notes/~/v1 HTTP and /v1 SSE paths.
  ::
  ++  v1
    |%
    ++  action-error
      |=  e=action-error:v1:n
      ^-  json
      s+(scot %tas e)
    ::
    ++  poke-status
      |=  s=poke-status:v1:n
      ^-  json
      s+(scot %tas s)
    ::  +response: subscriber → client. Encoded as {requestId, body}.
    ::
    ++  response
      |=  res=response:v1:n
      ^-  json
      %-  pairs
      :~  'requestId'^s+(scot %uv id.res)
          'body'^(response-body body.res)
      ==
    ::
    ++  response-body
      |=  bod=response-body:v1:n
      ^-  json
      ?-  -.bod
          %no-change
        (pairs ~[['type' s+'no-change']])
      ::
          %ok
        ::  ^response = outer r-notes encoder
        %-  pairs
        :~  'type'^s+'ok'
            'response'^(^response r-notes.bod)
        ==
      ::
          %notebook
        ::  notebook-summary = outer encoder (host, flagName, notebook, visibility)
        %-  pairs
        :~  'type'^s+'notebook'
            'notebook'^(notebook-summary summary.bod)
        ==
      ::
          %api-key
        %-  pairs
        :~  'type'^s+'api-key'
            'apiKey'^?~(key.bod ~ s+u.key.bod)
        ==
      ::
          %error
        %-  pairs
        :~  'type'^s+'error'
            'errorType'^(action-error type.bod)
            'message'^(tang-json message.bod)
        ==
      ::
          %pending
        %-  pairs
        :~  'type'^s+'pending'
            'status'^(poke-status status.bod)
        ==
      ==
    ::  +response-update: host → subscriber. Not delivered to browser
    ::  clients directly; subscriber transforms to response. Encoded for
    ::  debug visibility / future tooling.
    ::
    ++  response-update
      |=  ru=response-update:v1:n
      ^-  json
      %-  pairs
      :~  'requestId'^s+(scot %uv id.ru)
          'body'^(response-update-body body.ru)
      ==
    ::
    ++  response-update-body
      |=  bod=response-update-body:v1:n
      ^-  json
      ?-  -.bod
          %no-change
        (pairs ~[['type' s+'no-change']])
      ::
          %ok
        ::  encode update.time + raw u-notebook (no flag; caller knows it)
        %-  pairs
        :~  'type'^s+'ok'
            'time'^(numb (unt:chrono:userlib time.update.bod))
            'update'^(u-notebook-bare u-notebook.update.bod)
        ==
      ::
          %error
        %-  pairs
        :~  'type'^s+'error'
            'errorType'^(action-error type.bod)
            'message'^(tang-json message.bod)
        ==
      ==
    ::  +u-notebook-bare: u-notebook encoder without the flag (the
    ::  request path carries it).
    ::
    ++  u-notebook-bare
      |=  upd=u-notebook:n
      ^-  json
      %-  pairs
      ?-  -.upd
          %created
        :~  'type'^s+'notebook-created'
            'notebook'^(notebook notebook.upd)
            'visibility'^s+(scot %tas visibility.upd)
        ==
          %updated
        :~  'type'^s+'notebook-updated'
            'notebook'^(notebook notebook.upd)
        ==
          %deleted
        ~[['type' s+'notebook-deleted']]
          %visibility
        :~  'type'^s+'notebook-visibility-changed'
            'visibility'^s+(scot %tas visibility.upd)
        ==
          %member-joined
        :~  'type'^s+'member-joined'
            'who'^s+(scot %p who.upd)
            'role'^s+(scot %tas role.upd)
        ==
          %member-left
        :~  'type'^s+'member-left'
            'who'^s+(scot %p who.upd)
        ==
          %invite-received
        :~  'type'^s+'invite-received'
            'from'^s+(scot %p from.upd)
            'title'^s+title.upd
        ==
          %invite-removed
        ~[['type' s+'invite-removed']]
          %folder
        :~  'type'^s+'folder-update'
            'folderUpdate'^(u-folder id.upd u-folder.upd)
        ==
          %note
        :~  'type'^s+'note-update'
            'noteUpdate'^(u-note id.upd u-note.upd)
        ==
      ==
    --
  --
::  +dejs: decode JSON to notes types
::
++  dejs
  =,  dejs:format
  |%
  ::  +get-type: extract "type" string from a JSON object
  ++  get-type
    |=  jon=json
    ^-  @t
    ?>  ?=([%o *] jon)
    =/  typ=(unit json)  (~(get by p.jon) 'type')
    ?>  ?=(^ typ)
    ?>  ?=([%s *] u.typ)
    p.u.typ
  ::  +a-folder: parse a-folder action object {type, ...fields}
  ::
  ++  a-folder
    |=  jon=json
    ^-  a-folder:n
    ?>  ?=([%o *] jon)
    =/  tag=@t  (get-type jon)
    ?+  tag  ~|(unknown-a-folder+tag !!)
        %'rename'
      [%rename ((ot ~[['name' so]]) jon)]
        %'move'
      [%move ((ot ~[['newParent' ni]]) jon)]
        %'delete'
      [%delete ((ot ~[['recursive' bo]]) jon)]
        %'update'
      :-  %update
      ((ot ~[['name' (mu so)] ['parent' (mu ni)]]) jon)
    ==
  ::  +a-note: parse a-note action object {type, ...fields}
  ::
  ++  a-note
    |=  jon=json
    ^-  a-note:n
    ?>  ?=([%o *] jon)
    =/  tag=@t  (get-type jon)
    ?+  tag  ~|(unknown-a-note+tag !!)
        %'rename'
      [%rename ((ot ~[['title' so]]) jon)]
        %'move'
      [%move ((ot ~[['folder' ni]]) jon)]
        %'delete'
      [%delete ~]
        %'update'
      :-  %update
      ((ot ~[['body' so] ['expectedRevision' ni]]) jon)
        %'publish'
      [%publish ((ot ~[['html' so]]) jon)]
        %'unpublish'
      [%unpublish ~]
        %'restore'
      [%restore ((ot ~[['rev' ni]]) jon)]
        %'modify'
      :-  %modify
      ((ot ~[['title' (mu so)] ['folder' (mu ni)]]) jon)
    ==
  ::  +a-notebook: parse a-notebook action object {type, ...fields}
  ::
  ++  a-notebook
    |=  jon=json
    ^-  a-notebook:n
    ?>  ?=([%o *] jon)
    =/  tag=@t  (get-type jon)
    ?+  tag  ~|(unknown-a-notebook+tag !!)
        %'rename'
      [%rename ((ot ~[['title' so]]) jon)]
        %'delete'
      [%delete ~]
        %'visibility'
      =/  raw=@t  ((ot ~[['visibility' so]]) jon)
      ?.  ?|(=('public' raw) =('private' raw))
        ~|(bad-visibility+raw !!)
      [%visibility ?:(=('public' raw) %public %private)]
        %'invite'
      [%invite ((ot ~[['who' (su ;~(pfix sig fed:ag))]]) jon)]
        %'create-folder'
      :-  %create-folder
      ((ot ~[['parent' ni] ['name' so]]) jon)
        %'folder'
      :-  %folder
      ((ot ~[['id' ni] ['action' a-folder]]) jon)
        %'create-note'
      :-  %create-note
      ((ot ~[['folder' ni] ['title' so] ['body' so]]) jon)
        %'note'
      :-  %note
      ((ot ~[['id' ni] ['action' a-note]]) jon)
        %'batch-import'
      :-  %batch-import
      ((ot ~[['folder' ni] ['notes' (ar (ot ~[['title' so] ['body' so]]))]]) jon)
        %'batch-import-tree'
      :-  %batch-import-tree
      ((ot ~[['parent' ni] ['tree' (ar import-node)]]) jon)
    ==
  ::  +action: parse top-level a-notes from JSON
  ::  format: {"type": "...", ...fields}
  ::
  ++  action
    |=  jon=json
    ^-  action:n
    ?>  ?=([%o *] jon)
    =/  tag=@t  (get-type jon)
    ?+  tag  ~|(unknown-action+tag !!)
        %'create-notebook'
      =/  title=(unit json)  (~(get by p.jon) 'title')
      ?>  ?=(^ title)
      [%create-notebook (so u.title)]
        %'create-group-notebook'
      =/  title=(unit json)  (~(get by p.jon) 'title')
      ?>  ?=(^ title)
      =/  group=flag:n
        =/  raw
          %.  (need (~(get by p.jon) 'group'))
          (ot ~[['host' (su ;~(pfix sig fed:ag))] ['flagName' so]])
        [-.raw `@tas`+.raw]
      ::  readers: JSON array of role-id strings → (set @tas). absent → ~.
      =/  readers-j=(unit json)  (~(get by p.jon) 'readers')
      =/  readers=(set @tas)
        ?~  readers-j  ~
        ((as (cu |=(t=@t `@tas``@`t) so)) u.readers-j)
      [%create-group-notebook (so u.title) group readers]
        %'join'
      :-  %join
      =/  raw  ((ot ~[['ship' (su ;~(pfix sig fed:ag))] ['name' so]]) jon)
      [-.raw `@tas`+.raw]
        %'leave'
      :-  %leave
      =/  raw  ((ot ~[['ship' (su ;~(pfix sig fed:ag))] ['name' so]]) jon)
      [-.raw `@tas`+.raw]
        %'accept-invite'
      :-  %accept-invite
      =/  raw  ((ot ~[['ship' (su ;~(pfix sig fed:ag))] ['name' so]]) jon)
      [-.raw `@tas`+.raw]
        %'decline-invite'
      :-  %decline-invite
      =/  raw  ((ot ~[['ship' (su ;~(pfix sig fed:ag))] ['name' so]]) jon)
      [-.raw `@tas`+.raw]
        %'register-mcp'
      =/  bu-j=(unit json)  (~(get by p.jon) 'baseUrl')
      =/  bu=(unit @t)
        ?~  bu-j  ~
        ?.  ?=([%s *] u.bu-j)  ~
        `p.u.bu-j
      [%register-mcp bu]
        %'regenerate-api-key'  [%regenerate-api-key ~]
        %'clear-api-key'       [%clear-api-key ~]
        %'notebook'
      :-  %notebook
      =/  flag-json=(unit json)  (~(get by p.jon) 'flag')
      =/  act-json=(unit json)   (~(get by p.jon) 'action')
      ?>  ?=(^ flag-json)
      ?>  ?=(^ act-json)
      =/  =flag:n
        ?>  ?=([%s *] u.flag-json)
        =/  raw-tape=tape  (trip p.u.flag-json)
        =/  idx  (find "/" raw-tape)
        ?>  ?=(^ idx)
        =/  ship-text=@t  (crip (scag u.idx raw-tape))
        =/  name-text=@tas  `@tas`(crip (slag +(u.idx) raw-tape))
        [(slav %p ship-text) name-text]
      [flag (a-notebook u.act-json)]
    ==
  ::
  ++  import-node
    |=  jon=json
    ^-  import-node:n
    ?>  ?=([%o *] jon)
    ?:  (~(has by p.jon) 'children')
      :-  %folder
      ((ot ~[['name' so] ['children' (ar import-node)]]) jon)
    :-  %note
    ((ot ~[['title' so] ['body' so]]) jon)
  ::  v1: request-id-wrapped action parsing
  ::  POST body: {"requestId": "0v...", "action": <a-notes JSON>}
  ::
  ++  v1
    |%
    ++  action
      |=  jon=json
      ^-  action:v1:n
      ?>  ?=([%o *] jon)
      =/  rid-j=(unit json)  (~(get by p.jon) 'requestId')
      =/  act-j=(unit json)  (~(get by p.jon) 'action')
      ?>  ?=(^ rid-j)
      ?>  ?=(^ act-j)
      ?>  ?=([%s *] u.rid-j)
      =/  rid=@uv  (slav %uv p.u.rid-j)
      ::  ^action: outer a-notes parser
      [rid (^action u.act-j)]
    --
  --
--

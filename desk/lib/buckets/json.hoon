::  JSON codecs for the Buckets client surface
::
/-  b=buckets
|%
::
++  enjs
  =,  enjs:format
  |%
  ++  flag
    |=  f=flag:b
    ^-  json
    (pairs ~[['host' s+(scot %p ship.f)] ['name' s+name.f]])
  ::
  ++  bucket
    |=  buc=bucket:b
    ^-  json
    %-  pairs
    :~  ['id' (numb id.buc)]
        ['title' s+title.buc]
        ['createdBy' s+(scot %p created-by.buc)]
        ['createdAt' (numb (unt:chrono:userlib created-at.buc))]
        ['updatedBy' s+(scot %p updated-by.buc)]
        ['updatedAt' (numb (unt:chrono:userlib updated-at.buc))]
    ==
  ::
  ++  file
    |=  fil=file:b
    ^-  json
    %-  pairs
    :~  ['mime' s+mime.fil]
        ['size' (numb size.fil)]
        ['checksum' ?~(checksum.fil ~ s+u.checksum.fil)]
        ['objectKey' s+object-key.fil]
        ['status' s+(scot %tas status.fil)]
    ==
  ::
  ++  entry
    |=  ent=entry:b
    ^-  json
    =/  common=(list [cord json])
      :~  ['id' (numb id.ent)]
          ['parentId' ?~(parent.ent ~ (numb u.parent.ent))]
          ['name' s+name.ent]
          ['createdBy' s+(scot %p created-by.ent)]
          ['createdAt' (numb (unt:chrono:userlib created-at.ent))]
          ['updatedBy' s+(scot %p updated-by.ent)]
          ['updatedAt' (numb (unt:chrono:userlib updated-at.ent))]
      ==
    ?-  -.kind.ent
      %folder  (pairs (snoc common ['kind' s+'folder']))
      %file
    %-  pairs
    %+  snoc  (snoc common ['kind' s+'file'])
    ['file' (file +.kind.ent)]
    ==
  ::
  ++  bucket-state
    |=  st=bucket-state:b
    ^-  json
    =/  ents=(list json)
      %+  turn  ~(val by entries.st)
      entry
    =/  writer-roles=(list json)
      %+  turn  ~(tap in writers.st)
      |=(role=@tas s+(scot %tas role))
    %-  pairs
    :~  ['bucket' (bucket bucket.st)]
        ['group' (flag group.st)]
        ['writers' [%a writer-roles]]
        ['entries' [%a ents]]
        ['revision' (numb revision.st)]
    ==
  ::
  ++  update
    |=  upd=u-bucket:b
    ^-  json
    ?-  -.upd
        %create
      (pairs ~[['type' s+'bucket-created'] ['bucket' (bucket bucket.upd)]])
    ::
        %delete
      (pairs ~[['type' s+'bucket-deleted']])
    ::
        %meta
      (pairs ~[['type' s+'bucket-updated'] ['bucket' (bucket bucket.upd)]])
    ::
        %writers
      =/  roles=(list json)
        %+  turn  ~(tap in writers.upd)
        |=(role=@tas s+(scot %tas role))
      (pairs ~[['type' s+'writers-updated'] ['writers' [%a roles]]])
    ::
        %entry
      =/  typ=@t
        ?-  -.u-entry.upd
          %create  'entry-created'
          %update  'entry-updated'
        ==
      %-  pairs
      :~  ['type' s+typ]
          ['id' (numb id.upd)]
          ['entry' (entry entry.u-entry.upd)]
      ==
    ::
        %entries-deleted
      =/  ids=(list json)  (turn ids.upd numb)
      (pairs ~[['type' s+'entries-deleted'] ['ids' [%a ids]]])
    ==
  ::
  ++  grant
    |=  gra=grant:b
    ^-  json
    %-  pairs
    :~  ['token' s+token.gra]
        ['entryId' (numb entry-id.gra)]
        ['expiresAt' s+(scot %da expires-at.gra)]
    ==
  ::
  ++  read-token
    |=  tok=read-token:b
    ^-  json
    %-  pairs
    :~  ['token' s+token.tok]
        ['expiresAt' s+(scot %da expires-at.tok)]
    ==
  ::
  ++  req-response
    |=  res=req-response:b
    ^-  json
    =/  bod=json
      ?-  -.body.res
        %ok       (frond 'ok' ~)
        %pending  (frond 'pending' ~)
        %grant    (frond 'grant' (grant grant.body.res))
        %token    (frond 'token' (read-token read-token.body.res))
      ::
          %error
        %-  frond
        :-  'error'
        %-  pairs
        :~  ['type' s+(scot %tas type.body.res)]
            ['message' s+message.body.res]
        ==
      ==
    %-  pairs
    :~  ['requestId' s+(scot %uv request-id.res)]
        ['body' bod]
    ==
  ::
  ++  response
    |=  res=response:b
    ^-  json
    ?-  -.res
        %snapshot
      %-  pairs
      :~  ['type' s+'snapshot']
          ['flag' (flag flag.res)]
          ['state' (bucket-state bucket-state.res)]
      ==
    ::
        %update
      %-  pairs
      :~  ['type' s+'update']
          ['flag' (flag flag.res)]
          ['revision' (numb revision.res)]
          ['update' (update u-bucket.res)]
      ==
    ==
  ::
  ++  snapshots
    |=  snaps=(list snapshot:b)
    ^-  json
    :-  %a
    %+  turn  snaps
    |=  snap=snapshot:b
    (pairs ~[['flag' (flag flag.snap)] ['state' (bucket-state bucket-state.snap)]])
  --
::
++  dejs
  =,  dejs:format
  |%
  ++  get
    |=  [key=@t jon=json]
    ^-  json
    ?>  ?=([%o *] jon)
    =/  val=(unit json)  (~(get by p.jon) key)
    ?>  ?=(^ val)
    u.val
  ::
  ++  maybe
    |=  [key=@t jon=json decoder=$-(json @t)]
    ^-  (unit @t)
    ?>  ?=([%o *] jon)
    =/  val=(unit json)  (~(get by p.jon) key)
    ?~  val  ~
    ((mu decoder) u.val)
  ::
  ++  maybe-ud
    |=  [key=@t jon=json]
    ^-  (unit @ud)
    ?>  ?=([%o *] jon)
    =/  val=(unit json)  (~(get by p.jon) key)
    ?~  val  ~
    ((mu ni) u.val)
  ::
  ++  knot
    |=  txt=@t
    ^-  @tas
    =/  parsed=(unit @tas)  (slaw %tas txt)
    ?~  parsed  ~|(invalid-buckets-knot+txt !!)
    u.parsed
  ::
  ++  flag
    |=  jon=json
    ^-  flag:b
    =/  raw
      %.  jon
      (ot ~[['host' (su ;~(pfix sig fed:ag))] ['name' so]])
    [-.raw (knot +.raw)]
  ::
  ++  roles
    |=  jon=json
    ^-  (set @tas)
    ((as (cu |=(t=@t `@tas``@`t) so)) jon)
  ::
  ::  +command: a request-id'd action. The client mints the id so it can
  ::  correlate the terminal response it gets back on /v1/requests.
  ::
  ++  command
    |=  jon=json
    ^-  command:b
    ?>  ?=([%o *] jon)
    :-  ((se %uv) (get 'requestId' jon))
    (action jon)
  ::
  ::  +action: the client's JSON stays flat — one "type" plus its fields — and
  ::  is folded into the nested $a-buckets envelope here rather than making
  ::  every caller construct it.
  ::
  ++  action
    |=  jon=json
    ^-  action:b
    ?>  ?=([%o *] jon)
    =/  typ=@t  (so (get 'type' jon))
    ?:  =(%'create' typ)
      :*  %create
          (knot (so (get 'name' jon)))
          (so (get 'title' jon))
          (flag (get 'group' jon))
          (roles (get 'readers' jon))
          (roles (get 'writers' jon))
      ==
    :+  %bucket  (flag (get 'flag' jon))
    ?+  typ  ~|(unknown-buckets-action+typ !!)
        %'delete-bucket'  [%delete ~]
        %'set-title'      [%set-title (so (get 'title' jon))]
        %'set-writers'    [%set-writers (roles (get 'writers' jon))]
    ::
        %'create-folder'
      :*  %create-folder
          (maybe-ud 'parentId' jon)
          (so (get 'name' jon))
      ==
    ::
        %'begin-upload'
      :*  %begin-upload
          (maybe-ud 'parentId' jon)
          (so (get 'name' jon))
          (so (get 'mime' jon))
          (ni (get 'size' jon))
          (maybe 'checksum' jon so)
      ==
    ::
        %'fail-upload'
      :*  %fail-upload
          ((se %uv) (get 'sessionId' jon))
          (so (get 'reason' jon))
      ==
    ::
        %'issue-bucket-read'  [%issue-bucket-read ~]
        %'issue-delete'       [%issue-delete (ni (get 'id' jon))]
    ::
        %'rename-entry'
      :+  %entry  (ni (get 'id' jon))
      [%rename (so (get 'name' jon))]
    ::
        %'move-entry'
      :+  %entry  (ni (get 'id' jon))
      [%move (maybe-ud 'parentId' jon)]
    ::
        %'delete-entry'
      :+  %entry  (ni (get 'id' jon))
      [%delete (bo (get 'recursive' jon))]
    ==
  --
--

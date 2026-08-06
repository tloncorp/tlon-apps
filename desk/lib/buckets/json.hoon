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
        ['objectUrl' ?~(object-url.fil ~ s+u.object-url.fil)]
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
  ++  session
    |=  ses=upload-session:b
    ^-  json
    %-  pairs
    :~  ['id' s+(scot %uv id.ses)]
        ['fileId' (numb file-id.ses)]
        ['requestedBy' s+(scot %p requested-by.ses)]
        ['createdAt' (numb (unt:chrono:userlib created-at.ses))]
        ['expiresAt' (numb (unt:chrono:userlib expires-at.ses))]
        ['status' s+(scot %tas status.ses)]
        ['error' ?~(error.ses ~ s+u.error.ses)]
    ==
  ::
  ++  bucket-state
    |=  st=bucket-state:b
    ^-  json
    =/  ents=(list json)
      %+  turn  ~(val by entries.st)
      entry
    =/  sess=(list json)
      %+  turn  ~(val by sessions.st)
      session
    =/  roles=(list json)
      %+  turn  ~(tap in readers.st)
      |=(role=@tas s+(scot %tas role))
    %-  pairs
    :~  ['bucket' (bucket bucket.st)]
        ['group' (flag group.st)]
        ['readers' [%a roles]]
        ['entries' [%a ents]]
        ['sessions' [%a sess]]
        ['revision' (numb revision.st)]
    ==
  ::
  ++  update
    |=  upd=update:b
    ^-  json
    ?-  -.upd
        %bucket-created
      (pairs ~[['type' s+'bucket-created'] ['bucket' (bucket bucket.upd)]])
    ::
        %bucket-deleted
      (pairs ~[['type' s+'bucket-deleted']])
    ::
        %folder-created
      (pairs ~[['type' s+'folder-created'] ['entry' (entry entry.upd)]])
    ::
        %upload-begun
      %-  pairs
      :~  ['type' s+'upload-begun']
          ['session' (session upload-session.upd)]
          ['entry' (entry entry.upd)]
      ==
    ::
        %upload-ready
      %-  pairs
      :~  ['type' s+'upload-ready']
          ['session' (session upload-session.upd)]
          ['entry' (entry entry.upd)]
      ==
    ::
        %upload-failed
      %-  pairs
      :~  ['type' s+'upload-failed']
          ['session' (session upload-session.upd)]
          ['entry' (entry entry.upd)]
      ==
    ::
        %entry-updated
      (pairs ~[['type' s+'entry-updated'] ['entry' (entry entry.upd)]])
    ::
        %entries-deleted
      =/  ids=(list json)  (turn ids.upd numb)
      (pairs ~[['type' s+'entries-deleted'] ['ids' [%a ids]]])
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
          ['actor' s+(scot %p actor.res)]
          ['update' (update update.res)]
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
  ++  flag
    |=  jon=json
    ^-  flag:b
    =/  raw
      %.  jon
      (ot ~[['host' (su ;~(pfix sig fed:ag))] ['name' so]])
    [-.raw `@tas`+.raw]
  ::
  ++  readers
    |=  jon=json
    ^-  (set @tas)
    ((as (cu |=(t=@t `@tas``@`t) so)) jon)
  ::
  ++  action
    |=  jon=json
    ^-  action:b
    ?>  ?=([%o *] jon)
    =/  typ=@t  (so (get 'type' jon))
    ?+  typ  ~|(unknown-buckets-action+typ !!)
        %'create'
      :*  %create
          `@tas`(so (get 'name' jon))
          (so (get 'title' jon))
          (flag (get 'group' jon))
          (readers (get 'readers' jon))
      ==
    ::
        %'delete-bucket'
      [%delete-bucket (flag (get 'flag' jon))]
    ::
        %'create-folder'
      :*  %create-folder
          (flag (get 'flag' jon))
          (maybe-ud 'parentId' jon)
          (so (get 'name' jon))
      ==
    ::
        %'begin-upload'
      :*  %begin-upload
          (flag (get 'flag' jon))
          (maybe-ud 'parentId' jon)
          (so (get 'name' jon))
          (so (get 'mime' jon))
          (ni (get 'size' jon))
          (maybe 'checksum' jon so)
      ==
    ::
        %'finish-upload'
      :*  %finish-upload
          (flag (get 'flag' jon))
          ((se %uv) (get 'sessionId' jon))
          (so (get 'objectUrl' jon))
      ==
    ::
        %'fail-upload'
      :*  %fail-upload
          (flag (get 'flag' jon))
          ((se %uv) (get 'sessionId' jon))
          (so (get 'reason' jon))
      ==
    ::
        %'rename-entry'
      :*  %rename-entry
          (flag (get 'flag' jon))
          (ni (get 'id' jon))
          (so (get 'name' jon))
      ==
    ::
        %'move-entry'
      :*  %move-entry
          (flag (get 'flag' jon))
          (ni (get 'id' jon))
          (maybe-ud 'parentId' jon)
      ==
    ::
        %'delete-entry'
      :*  %delete-entry
          (flag (get 'flag' jon))
          (ni (get 'id' jon))
          (bo (get 'recursive' jon))
      ==
    ==
  --
--

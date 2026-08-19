::  buckets: group-owned shared file manifest and upload coordinator
::
::  This agent is a third-party %groups channel host. It stores metadata and
::  upload lifecycle only; file bytes move directly between clients and object
::  storage. Group admins may request creation, but the group host remains the
::  authoritative Bucket and storage owner.
::
::  Every client action carries a request-id and gets exactly one terminal
::  response. Bearer tokens for the storage broker are minted here and
::  returned only to the requester — they never appear in a broadcast.
::
/-  b=buckets
/+  default-agent, dbug, verb
|%
+$  card  card:agent:gall
+$  current-state  state:b
::  +upload-window: how long a pending upload session stays usable.
::
::  Must stay comfortably longer than Memex's own window, which is at most
::  BUCKETS_PUT_URL_SECONDS (capped at 900) plus BUCKETS_COMPLETION_GRACE_SECONDS
::  (default 600). If this expires first, a completion Memex still considers
::  live arrives to find no session.
::
++  upload-window  ~h1
::  +object-window: lifetime of a read or delete capability.
::
++  object-window  ~m10
::  +request-timeout: how long a subscriber waits for the host's answer
::  before reporting failure to its client.
::
++  request-timeout  ~m2
::  +max-object-size: mirrors Memex's BUCKETS_MAX_OBJECT_BYTES default, so an
::  oversized upload is refused before any state is committed.
::
++  max-object-size  5.368.709.120
--
=|  current-state
=*  state  -
%-  agent:dbug
%^  verb  |  %warn
^-  agent:gall
=<
  |_  =bowl:gall
  +*  this  .
      def   ~(. (default-agent this %|) bowl)
      cor   ~(. +> [bowl ~ ~])
  ++  on-init
    ^-  (quip card _this)
    =^  cards  state  abet:init:cor
    [cards this]
  ++  on-save  !>(state)
  ++  on-load
    |=  old=vase
    ^-  (quip card _this)
    =^  cards  state  abet:(load:cor old)
    [cards this]
  ++  on-poke
    |=  [=mark =vase]
    ^-  (quip card _this)
    =^  cards  state  abet:(poke:cor mark vase)
    [cards this]
  ++  on-watch
    |=  =path
    ^-  (quip card _this)
    =^  cards  state  abet:(watch:cor `(pole knot)`path)
    [cards this]
  ++  on-peek
    |=  =path
    ^-  (unit (unit cage))
    ?>  =(src our):bowl
    (peek:cor `(pole knot)`path)
  ++  on-agent
    |=  [=wire =sign:agent:gall]
    ^-  (quip card _this)
    =^  cards  state  abet:(agent:cor `(pole knot)`wire sign)
    [cards this]
  ++  on-arvo
    |=  [=wire =sign-arvo]
    ^-  (quip card _this)
    =^  cards  state  abet:(arvo:cor `(pole knot)`wire sign-arvo)
    [cards this]
  ++  on-leave  on-leave:def
  ++  on-fail
    |=  [=term =tang]
    ^-  (quip card _this)
    %-  (slog 'buckets: on-fail' >term< tang)
    [~ this]
  --
::
|_  [=bowl:gall cards=(list card) reply=(unit response-body:b)]
++  cor   .
++  abet  [(flop cards) state]
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
::  +answer: record the terminal body for the action being applied. Arms that
::  mint a token or refuse call this; +settle turns it into the response.
::
++  answer  |=(body=response-body:b cor(reply `body))
::
++  init
  ^+  cor
  (emit [%pass /groups %agent [our.bowl %groups] %watch /v1/groups])
::
::  +load: %buckets has never run on a live ship, so there is nothing to
::  migrate from yet. When that changes, add a +state-N-to-N+1 arm per
::  version and chain them with =? — never migrate straight to current.
::
++  load
  |=  old=vase
  ^+  cor
  =/  loaded=versioned-state:b  !<(versioned-state:b old)
  ?>  ?=(%0 -.loaded)
  =.  state  loaded
  =?  cor  !(~(has by wex.bowl) [/groups our.bowl %groups])
    (emit [%pass /groups %agent [our.bowl %groups] %watch /v1/groups])
  cor
::
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?+  mark  ~|(bad-buckets-mark+mark !!)
      %buckets-action-1
    ?>  =(src.bowl our.bowl)
    =+  cmd=!<(command:b vase)
    (dispatch-local request-id.cmd act.cmd)
  ::
      %buckets-command-1
    =+  cmd=!<(command:b vase)
    (dispatch-remote request-id.cmd act.cmd)
  ::
      %buckets-broker-command-1
    ?>  =(src.bowl our.bowl)
    (apply-broker-command !<(broker-command:b vase))
  ::
      %group-channel-join
    ?>  =(src.bowl our.bowl)
    =+  join=!<(channel-join:b vase)
    ?>  =(%buckets kind.nest.join)
    =/  =flag:b  [host.nest.join name.nest.join]
    ?:  =(our.bowl ship.flag)  cor
    (start-sub flag group.join)
  ::
      %group-channel-leave
    ?>  =(src.bowl our.bowl)
    =+  leave=!<(channel-leave:b vase)
    ?>  =(%buckets kind.nest.leave)
    =/  =flag:b  [host.nest.leave name.nest.leave]
    ?:  =(our.bowl ship.flag)  cor
    (stop-sub flag)
  ==
::
::  +dispatch-local: a client on our own ship submitted an action. Apply it
::  if we host the bucket, otherwise forward it to the host and wait.
::
++  dispatch-local
  |=  [rid=request-id:b act=a-buckets:b]
  ^+  cor
  =/  paths=(list path)  ~[/v1/requests]
  ?-  -.act
      %create
    ?.  ?=(%duke (clan:title ship.group.act))
      (deny rid paths %invalid-input 'only a planet may host a bucket')
    ?.  (group-is-admin-for-create group.act our.bowl)
      (deny rid paths %not-authorized 'only a group admin may create a bucket')
    ?.  =(ship.group.act our.bowl)
      (forward rid act ship.group.act)
    =.  cor
      (create-bucket name.act title.act group.act readers.act writers.act our.bowl)
    (settle rid paths)
  ::
      %bucket
    ?~  sp=(~(get by spaces) flag.act)
      (deny rid paths %not-found 'no such bucket')
    ?.  =(%pub net.u.sp)
      (forward rid act ship.flag.act)
    =/  st=bucket-state:b  (need-state flag.act)
    ?.  (action-authorized st flag.act our.bowl a-bucket.act)
      (deny rid paths %not-authorized 'not authorized for this bucket')
    =.  cor  (apply-bucket flag.act a-bucket.act our.bowl)
    (settle rid paths)
  ==
::
::  +dispatch-remote: a subscriber forwarded a command to us as host. The
::  actor is src.bowl; the answer goes back on that ship's request path.
::
++  dispatch-remote
  |=  [rid=request-id:b act=a-buckets:b]
  ^+  cor
  =/  paths=(list path)  ~[(host-req-path src.bowl rid)]
  ?-  -.act
      %create
    ?>  =(ship.group.act our.bowl)
    ?.  ?=(%duke (clan:title ship.group.act))
      (deny rid paths %invalid-input 'only a planet may host a bucket')
    ?.  (group-is-admin-for-create group.act src.bowl)
      (deny rid paths %not-authorized 'only a group admin may create a bucket')
    =.  cor
      (create-bucket name.act title.act group.act readers.act writers.act src.bowl)
    (settle rid paths)
  ::
      %bucket
    ?>  =(ship.flag.act our.bowl)
    ?~  sp=(~(get by spaces) flag.act)
      (deny rid paths %not-found 'no such bucket')
    =/  st=bucket-state:b  (need-state flag.act)
    ?.  (action-authorized st flag.act src.bowl a-bucket.act)
      (deny rid paths %not-authorized 'not authorized for this bucket')
    =.  cor  (apply-bucket flag.act a-bucket.act src.bowl)
    (settle rid paths)
  ==
::
::  +forward: hand a command to the authoritative host, subscribe for its
::  answer, and arm a timeout so a silent host can't strand the client.
::
++  forward
  |=  [rid=request-id:b act=a-buckets:b host=ship]
  ^+  cor
  =/  until=@da  (add now.bowl request-timeout)
  =.  pending  (~(put by pending) rid [host until])
  =.  cor
    %-  emit
    :*  %pass  (req-poke-wire host rid)  %agent  [host %buckets]
        %poke  buckets-command-1+!>(`command:b`[rid act])
    ==
  =.  cor
    %-  emit
    :*  %pass  (req-watch-wire host rid)  %agent  [host %buckets]
        %watch  (host-req-path our.bowl rid)
    ==
  =.  cor
    (emit [%pass (req-wake-wire host rid) %arvo %b %wait until])
  (respond rid ~[/v1/requests] [%pending ~])
::
::  +settle: emit the terminal response for a request, defaulting to %ok when
::  the applied action produced nothing to hand back.
::
++  settle
  |=  [rid=request-id:b paths=(list path)]
  ^+  cor
  =/  body=response-body:b  ?~(reply [%ok ~] u.reply)
  =.  cor  cor(reply ~)
  (respond rid paths body)
::
++  deny
  |=  [rid=request-id:b paths=(list path) type=action-error:b msg=@t]
  ^+  cor
  (respond rid paths [%error type msg])
::
++  respond
  |=  [rid=request-id:b paths=(list path) body=response-body:b]
  ^+  cor
  =/  res=req-response:b  [rid body]
  (give [%fact paths buckets-req-response-1+!>(res)])
::
++  host-req-path
  |=  [who=ship rid=request-id:b]
  ^-  path
  /v1/request/(scot %p who)/(scot %uv rid)
::
++  req-poke-wire
  |=  [host=ship rid=request-id:b]
  ^-  wire
  /buckets/req/(scot %p host)/(scot %uv rid)/poke
::
++  req-watch-wire
  |=  [host=ship rid=request-id:b]
  ^-  wire
  /buckets/req/(scot %p host)/(scot %uv rid)/watch
::
++  req-wake-wire
  |=  [host=ship rid=request-id:b]
  ^-  wire
  /buckets/req/(scot %p host)/(scot %uv rid)/wake
::
::  +request-live: is a forwarded request still waiting on the host?
::
::  Tracked in state rather than read off wex.bowl, because Gall has already
::  dropped the subscription by the time a %kick reaches us — the one case
::  where we most need to know the request was still outstanding.
::
++  request-live
  |=  rid=request-id:b
  ^-  ?
  (~(has by pending) rid)
::
::  +close-request: retire a settled request, dropping its subscription and
::  cancelling the timeout at the instant it was armed for.
::
++  close-request
  |=  [host=ship rid=request-id:b]
  ^+  cor
  =/  got=(unit [host=ship until=@da])  (~(get by pending) rid)
  =.  pending  (~(del by pending) rid)
  =.  cor
    %-  emit
    :*  %pass  (req-watch-wire host rid)  %agent  [host %buckets]
        %leave  ~
    ==
  ?~  got  cor
  (emit [%pass (req-wake-wire host rid) %arvo %b %rest until.u.got])
::
++  need-space
  |=  =flag:b
  ^-  space:b
  (~(got by spaces) flag)
::
++  need-state
  |=  =flag:b
  ^-  bucket-state:b
  =/  sp=space:b  (need-space flag)
  ?>  ?=(^ state.sp)
  u.state.sp
::
++  put-state
  |=  [=flag:b st=bucket-state:b]
  ^+  cor
  =/  sp=space:b  (need-space flag)
  =.  spaces  (~(put by spaces) flag [net.sp `st `group.st])
  cor
::
++  create-bucket
  |=  [name=@tas title=@t group=flag:b readers=(set @tas) writers=(set @tas) actor=ship]
  ^+  cor
  ?>  =(ship.group our.bowl)
  =/  =flag:b  [our.bowl name]
  ?:  (~(has by spaces) flag)
    =/  st=bucket-state:b  (need-state flag)
    ?>  =(group group.st)
    ?>  =(title title.bucket.st)
    ?>  =(readers readers.st)
    ?>  =(writers writers.st)
    ?>  =(actor created-by.bucket.st)
    =.  cor  (register-bucket flag st)
    (give [%fact ~[/v1] buckets-response-1+!>(`response:b`[%snapshot flag st])])
  =/  id=@ud  +(next-id)
  =.  next-id  id
  =/  buc=bucket:b  [id title actor now.bowl actor now.bowl]
  =/  st=bucket-state:b  [buc group readers writers ~ 0]
  =.  spaces  (~(put by spaces) flag [%pub `st `group])
  =.  cor  (register-bucket flag st)
  (give [%fact ~[/v1] buckets-response-1+!>(`response:b`[%snapshot flag st])])
::
++  register-bucket
  |=  [=flag:b st=bucket-state:b]
  ^+  cor
  =/  channel=group-channel:b
    [[title.bucket.st '' '' ''] now.bowl %default readers.st |]
  =/  add=group-create:b
    [%group group.st %channel [%buckets flag] %add channel]
  %-  emit
  :*  %pass  /buckets/(scot %p ship.flag)/[name.flag]/create
      %agent  [our.bowl %groups]
      %poke  group-action-4+!>(add)
  ==
::
::  +apply-bucket: run one verb against a bucket we host. The flag and the
::  actor come from the envelope rather than from the payload.
::
++  apply-bucket
  |=  [=flag:b act=a-bucket:b actor=ship]
  ^+  cor
  ?-  -.act
    %delete         (delete-bucket flag actor)
    %set-title      (set-title flag title.act actor)
    %set-readers    (set-readers flag readers.act actor)
    %set-writers    (set-writers flag writers.act actor)
    %create-folder  (create-folder flag parent.act name.act actor)
    %begin-upload   (begin-upload flag parent.act name.act mime.act size.act checksum.act actor)
    %fail-upload    (fail-upload flag session.act reason.act actor)
    %issue-read     (issue-object-capability %read flag id.act actor)
    %issue-delete   (issue-object-capability %delete flag id.act actor)
    %entry          (apply-entry flag id.act a-entry.act actor)
  ==
::
++  apply-entry
  |=  [=flag:b id=@ud act=a-entry:b actor=ship]
  ^+  cor
  ?-  -.act
    %rename  (rename-entry flag id name.act actor)
    %move    (move-entry flag id parent.act actor)
    %delete  (delete-entry flag id recursive.act actor)
  ==
::
++  delete-bucket
  |=  [=flag:b actor=ship]
  ^+  cor
  =/  st=bucket-state:b  (need-state flag)
  =/  del=group-channel-del:b
    [%group group.st %channel [%buckets flag] %del ~]
  =.  cor
    %-  emit
    :*  %pass  /buckets/(scot %p ship.flag)/[name.flag]/delete
        %agent  [our.bowl %groups]
        %poke  group-action-4+!>(del)
    ==
  =/  res=response:b
    [%update flag +(revision.st) [%delete ~]]
  =.  cor  (give [%fact ~[/v1 (updates-path flag)] buckets-response-1+!>(res)])
  =.  sessions  (drop-bucket-sessions flag)
  =.  spaces  (~(del by spaces) flag)
  cor
::
++  set-title
  |=  [=flag:b title=@t actor=ship]
  ^+  cor
  =/  st=bucket-state:b  (need-state flag)
  =.  bucket.st
    bucket.st(title title, updated-by actor, updated-at now.bowl)
  (commit-update flag st [%meta bucket.st] actor)
::
++  set-writers
  |=  [=flag:b writers=(set @tas) actor=ship]
  ^+  cor
  =/  st=bucket-state:b  (need-state flag)
  =.  writers.st  writers
  (commit-update flag st [%writers writers] actor)
::
++  set-readers
  |=  [=flag:b readers=(set @tas) actor=ship]
  ^+  cor
  =/  st=bucket-state:b  (need-state flag)
  =.  readers.st  readers
  (commit-update flag st [%readers readers] actor)
::
++  create-folder
  |=  [=flag:b parent=(unit @ud) name=@t actor=ship]
  ^+  cor
  =/  st=bucket-state:b  (need-state flag)
  ?.  (valid-parent st parent)
    (answer [%error %not-found 'no such parent folder'])
  =/  id=@ud  +(next-id)
  =.  next-id  id
  =/  ent=entry:b
    [id parent name actor now.bowl actor now.bowl [%folder ~]]
  =.  entries.st  (~(put by entries.st) id ent)
  (commit-update flag st [%entry id [%create ent]] actor)
::
::  +begin-upload: reserve an entry id and object key, open a host-private
::  session, and hand the session id back to the uploader as its broker
::  token. The entry is not published until the object lands, so nothing is
::  broadcast here and the token never leaves this response.
::
++  begin-upload
  |=  $:  =flag:b
          parent=(unit @ud)
          name=@t
          mime=@t
          size=@ud
          checksum=(unit @t)
          actor=ship
      ==
  ^+  cor
  =/  st=bucket-state:b  (need-state flag)
  ?.  (valid-parent st parent)
    (answer [%error %not-found 'no such parent folder'])
  ?:  =(0 size)
    (answer [%error %invalid-input 'file size must be greater than zero'])
  ?:  (gth size max-object-size)
    (answer [%error %invalid-input 'file exceeds the maximum object size'])
  ?.  (valid-mime mime)
    (answer [%error %invalid-input 'missing or malformed content type'])
  =.  cor  prune-broker-authority
  =/  id=@ud  +(next-id)
  =.  next-id  id
  =/  sid=@uv  `@uv`eny.bowl
  =/  fil=file:b  [mime size checksum (scot %uv sid) %pending]
  =/  ent=entry:b
    [id parent name actor now.bowl actor now.bowl [%file fil]]
  =/  expiry=@da  (add now.bowl upload-window)
  =/  ses=upload-session:b
    [sid flag ent actor now.bowl expiry %pending ~ ~]
  =.  sessions  (~(put by sessions) sid ses)
  (answer [%grant [(scot %uv sid) id expiry]])
::
::  +publish-upload: move a completed session's entry into the manifest and
::  broadcast it. The session is retained as %complete so a repeated
::  completion is a no-op rather than a second entry.
::
++  publish-upload
  |=  [ses=upload-session:b actor=ship]
  ^+  cor
  =/  st=bucket-state:b  (need-state flag.ses)
  =/  ent=entry:b  entry.ses
  =/  fil=file:b  (entry-file ent)
  =.  fil  fil(status %ready)
  =.  ent  ent(updated-by actor, updated-at now.bowl, kind [%file fil])
  =.  sessions  (~(put by sessions) id.ses ses(status %complete, entry ent))
  =.  entries.st  (~(put by entries.st) id.ent ent)
  (commit-update flag.ses st [%entry id.ent [%create ent]] actor)
::
++  fail-upload
  |=  [=flag:b sid=@uv reason=@t actor=ship]
  ^+  cor
  ?~  got=(~(get by sessions) sid)
    (answer [%error %not-found 'no such upload session'])
  =/  ses=upload-session:b  u.got
  ?.  =(flag flag.ses)
    (answer [%error %not-found 'no such upload session'])
  ?.  =(%pending status.ses)
    (answer [%error %invalid-input 'upload session is not pending'])
  ?.  =(requested-by.ses actor)
    (answer [%error %not-authorized 'not the uploader'])
  ::  Nothing was published, so there is nothing to broadcast — the session
  ::  is kept briefly so the uploader can read the reason back.
  =.  sessions  (~(put by sessions) sid ses(status %failed, error `reason))
  cor
::
::  +issue-object-capability: mint a short-lived read or delete grant for a
::  published file and return it to the requester alone.
::
++  issue-object-capability
  |=  [kind=object-kind:b =flag:b id=@ud actor=ship]
  ^+  cor
  =.  cor  prune-broker-authority
  =/  st=bucket-state:b  (need-state flag)
  ?~  got=(~(get by entries.st) id)
    (answer [%error %not-found 'no such entry'])
  =/  ent=entry:b  u.got
  ?.  ?=(%file -.kind.ent)
    (answer [%error %invalid-input 'entry is a folder'])
  =/  fil=file:b  +.kind.ent
  ?.  =(%ready status.fil)
    (answer [%error %invalid-input 'file is not ready'])
  =/  token=@t  (scot %uv `@uv`eny.bowl)
  =/  expiry=@da  (add now.bowl object-window)
  =/  aut=object-capability:b  [kind flag id actor expiry]
  =.  object-capabilities  (~(put by object-capabilities) token aut)
  (answer [%grant [token id expiry]])
::
::  +prune-broker-authority: drop expired capabilities, expired pending
::  sessions, and any reservation whose session is gone.
::
++  prune-broker-authority
  ^+  cor
  =.  object-capabilities
    %-  malt
    %+  skim  ~(tap by object-capabilities)
    |=  [token=@t aut=object-capability:b]
    (gth expires-at.aut now.bowl)
  =.  sessions
    %-  malt
    %+  skim  ~(tap by sessions)
    |=  [sid=@uv ses=upload-session:b]
    ?.  =(%pending status.ses)  &
    (gth expires-at.ses now.bowl)
  =.  reservations
    %-  malt
    %+  skim  ~(tap by reservations)
    |=  [reservation=@t sid=@uv]
    (~(has by sessions) sid)
  cor
::
++  drop-bucket-sessions
  |=  =flag:b
  ^-  (map @uv upload-session:b)
  %-  malt
  %+  skip  ~(tap by sessions)
  |=  [sid=@uv ses=upload-session:b]
  =(flag flag.ses)
::
::  +session-token: resolve the opaque string Memex presents back to the
::  session that minted it.
::
++  session-token
  |=  token=@t
  ^-  (unit upload-session:b)
  ?~  sid=(slaw %uv token)  ~
  (~(get by sessions) u.sid)
::
++  apply-broker-command
  |=  cmd=broker-command:b
  ^+  cor
  ?-  -.cmd
      %authorize-upload
    (authorize-broker-upload capability.cmd broker-reservation-id.cmd)
  ::
      %complete-upload
    (complete-broker-upload broker-receipt.cmd)
  ==
::
++  authorize-broker-upload
  |=  [token=@t reservation=@t]
  ^+  cor
  ?~  got=(session-token token)  cor
  =/  ses=upload-session:b  u.got
  ?.  =(%pending status.ses)  cor
  ?.  (gth expires-at.ses now.bowl)  cor
  ?~  sp=(~(get by spaces) flag.ses)  cor
  ?~  st-unit=state.u.sp  cor
  =/  st=bucket-state:b  u.st-unit
  ?.  (group-can-write group.st flag.ses writers.st requested-by.ses)  cor
  ?^  accepted=reservation.ses  cor
  ?^  occupied=(~(get by reservations) reservation)  cor
  =.  sessions  (~(put by sessions) id.ses ses(reservation `reservation))
  =.  reservations  (~(put by reservations) reservation id.ses)
  cor
::
++  complete-broker-upload
  |=  receipt=broker-receipt:b
  ^+  cor
  ?~  sid=(~(get by reservations) broker-reservation-id.receipt)  cor
  ?~  got=(~(get by sessions) u.sid)  cor
  =/  ses=upload-session:b  u.got
  ?:  =(%complete status.ses)  cor
  ?.  =(%pending status.ses)  cor
  ?.  (gth expires-at.ses now.bowl)  cor
  ?~  sp=(~(get by spaces) flag.ses)  cor
  ?~  st-unit=state.u.sp  cor
  =/  st=bucket-state:b  u.st-unit
  ?.  (group-can-write group.st flag.ses writers.st requested-by.ses)  cor
  =/  fil=file:b  (entry-file entry.ses)
  ?.  ?&  =(object-id.receipt object-key.fil)
          ?|  =(host.receipt (ship-text our.bowl))
              =(host.receipt (scot %p our.bowl))
          ==
          =(bucket-id.receipt (scot %ud id.bucket.st))
          =(size.receipt size.fil)
          =(mime-type.receipt mime.fil)
      ==
    cor
  (publish-upload ses requested-by.ses)
::
++  rename-entry
  |=  [=flag:b id=@ud name=@t actor=ship]
  ^+  cor
  =/  st=bucket-state:b  (need-state flag)
  ?~  got=(~(get by entries.st) id)
    (answer [%error %not-found 'no such entry'])
  =/  ent=entry:b  u.got
  =.  ent  ent(name name, updated-by actor, updated-at now.bowl)
  =.  entries.st  (~(put by entries.st) id ent)
  (commit-update flag st [%entry id [%update ent]] actor)
::
++  move-entry
  |=  [=flag:b id=@ud parent=(unit @ud) actor=ship]
  ^+  cor
  =/  st=bucket-state:b  (need-state flag)
  ?.  (valid-parent st parent)
    (answer [%error %not-found 'no such parent folder'])
  ?~  got=(~(get by entries.st) id)
    (answer [%error %not-found 'no such entry'])
  =/  ent=entry:b  u.got
  ?:  ?&(?=(^ parent) =(u.parent id))
    (answer [%error %invalid-input 'an entry cannot contain itself'])
  ?:  ?&  ?=(%folder -.kind.ent)
          ?=(^ parent)
          (descendant st id u.parent)
      ==
    (answer [%error %invalid-input 'a folder cannot move inside itself'])
  =.  ent  ent(parent parent, updated-by actor, updated-at now.bowl)
  =.  entries.st  (~(put by entries.st) id ent)
  (commit-update flag st [%entry id [%update ent]] actor)
::
++  delete-entry
  |=  [=flag:b id=@ud recursive=? actor=ship]
  ^+  cor
  =/  st=bucket-state:b  (need-state flag)
  ?.  (~(has by entries.st) id)
    (answer [%error %not-found 'no such entry'])
  =/  ids=(set @ud)  (descendants st id)
  ?.  ?|(recursive =(1 ~(wyt in ids)))
    (answer [%error %invalid-input 'folder is not empty'])
  =.  entries.st
    %-  ~(rep in ids)
    |=  [key=@ud acc=_entries.st]
    (~(del by acc) key)
  =.  sessions
    %-  malt
    %+  skip  ~(tap by sessions)
    |=  [key=@uv ses=upload-session:b]
    ?.  =(flag flag.ses)  |
    (~(has in ids) id.entry.ses)
  (commit-update flag st [%entries-deleted ~(tap in ids)] actor)
::
::  +commit-update: bump the revision, stamp attribution on the bucket, and
::  broadcast. The actor is passed in rather than read from src.bowl, which on
::  a broker callback is us rather than the uploader.
::
++  commit-update
  |=  [=flag:b st=bucket-state:b upd=u-bucket:b actor=ship]
  ^+  cor
  =.  revision.st  +(revision.st)
  =.  bucket.st
    bucket.st(updated-by actor, updated-at now.bowl)
  =.  cor  (put-state flag st)
  =/  res=response:b  [%update flag revision.st upd]
  (give [%fact ~[/v1 (updates-path flag)] buckets-response-1+!>(res)])
::
++  valid-parent
  |=  [st=bucket-state:b parent=(unit @ud)]
  ^-  ?
  ?~  parent  &
  ?~  ent=(~(get by entries.st) u.parent)  |
  =(%folder -.kind.u.ent)
::
::  +valid-mime: a content type must be present and look like type/subtype.
::  Memex refuses anything else, so refuse it here before committing state.
::
++  valid-mime
  |=  mime=@t
  ^-  ?
  =/  txt=tape  (trip mime)
  ?~  txt  |
  ?~  cut=(find "/" txt)  |
  &(!=(0 u.cut) !=(+(u.cut) (lent txt)))
::
++  entry-file
  |=  ent=entry:b
  ^-  file:b
  ?-  -.kind.ent
    %folder  ~|(%entry-is-a-folder !!)
    %file    +.kind.ent
  ==
::
++  descendant
  |=  [st=bucket-state:b ancestor=@ud candidate=@ud]
  ^-  ?
  =/  cur=(unit @ud)  `candidate
  |-
  ?~  cur  |
  ?:  =(u.cur ancestor)  &
  ?~  ent=(~(get by entries.st) u.cur)  |
  $(cur parent.u.ent)
::
++  descendants
  |=  [st=bucket-state:b root=@ud]
  ^-  (set @ud)
  ?>  (~(has by entries.st) root)
  =/  acc=(set @ud)  (silt ~[root])
  =/  queue=(list @ud)  ~[root]
  |-
  ?~  queue  acc
  =/  kids=(list @ud)
    %+  murn  ~(tap by entries.st)
    |=  [id=@ud ent=entry:b]
    ?~  parent.ent  ~
    ?:  =(u.parent.ent i.queue)  `id  ~
  %=  $
    queue  (weld t.queue kids)
    acc    (~(gas in acc) kids)
  ==
::
++  group-can-read
  |=  [group=flag:b =flag:b who=ship]
  ^-  ?
  ?:  =(who ship.flag)  &
  =/  pax=path
    /(scot %p our.bowl)/groups/(scot %da now.bowl)/v2/groups/(scot %p ship.group)/[name.group]/channels/can-read/noun
  =/  test=$-([ship nest:b] ?)  .^($-([ship nest:b] ?) %gx pax)
  (test who [%buckets ship.flag name.flag])
::
++  group-is-admin-for-create
  |=  [group=flag:b who=ship]
  ^-  ?
  ?:  =(who ship.group)  &
  =/  pax=path
    /(scot %p our.bowl)/groups/(scot %da now.bowl)/v2/groups/(scot %p ship.group)/[name.group]/seats/(scot %p who)/is-admin/noun
  .^(? %gx pax)
::
++  group-permissions
  |=  [group=flag:b =flag:b who=ship]
  ^-  (unit [admin=? roles=(set @tas)])
  ?:  =(who ship.flag)  `[& ~]
  =/  pax=path
    /(scot %p our.bowl)/groups/(scot %da now.bowl)/v2/groups/(scot %p ship.group)/[name.group]/channels/buckets/(scot %p ship.flag)/[name.flag]/can-write/(scot %p who)/noun
  .^((unit [admin=? roles=(set @tas)]) %gx pax)
::
++  group-is-admin
  |=  [group=flag:b =flag:b who=ship]
  ^-  ?
  =/  permissions=(unit [admin=? roles=(set @tas)])
    (group-permissions group flag who)
  ?~  permissions  |
  admin.u.permissions
::
++  group-can-write
  |=  [group=flag:b =flag:b writers=(set @tas) who=ship]
  ^-  ?
  ?.  (group-can-read group flag who)  |
  =/  permissions=(unit [admin=? roles=(set @tas)])
    (group-permissions group flag who)
  ?~  permissions  |
  ?|  admin.u.permissions
      =(~ writers)
      !=(~ (~(int in writers) roles.u.permissions))
  ==
::
::  +action-authorized: may `who` run this verb on this bucket? Admin verbs
::  gate on the group's admin set, writes on the bucket's writer roles, and a
::  read grant only needs read access.
::
++  action-authorized
  |=  [st=bucket-state:b =flag:b who=ship act=a-bucket:b]
  ^-  ?
  ?-  -.act
    %delete         (group-is-admin group.st flag who)
    %set-title      (group-is-admin group.st flag who)
    %set-readers    (group-is-admin group.st flag who)
    %set-writers    (group-is-admin group.st flag who)
    %issue-read     (group-can-read group.st flag who)
    %create-folder  (group-can-write group.st flag writers.st who)
    %begin-upload   (group-can-write group.st flag writers.st who)
    %fail-upload    (group-can-write group.st flag writers.st who)
    %issue-delete   (group-can-write group.st flag writers.st who)
    %entry          (group-can-write group.st flag writers.st who)
  ==
::
++  ship-text
  |=  who=ship
  ^-  @t
  (crip (slag 1 (trip (scot %p who))))
::
++  broker-simple-verdict
  |=  result=@t
  ^-  json
  (pairs:enjs:format ~[['result' s+result]])
::
++  broker-upload-verdict
  |=  [token=@t reservation=@t]
  ^-  json
  =/  denied=json  (broker-simple-verdict 'denied')
  ?~  got=(session-token token)  denied
  =/  ses=upload-session:b  u.got
  ?.  (gth expires-at.ses now.bowl)
    (broker-simple-verdict 'expired')
  ?.  =(%pending status.ses)  denied
  ::  Echo the reservation bound on first exchange, ignoring the one Memex
  ::  proposed. Memex mints a fresh id per grant call, so a client retrying
  ::  after a lost response arrives with a new one; denying that would make
  ::  the upload unrecoverable, and the Pioneer contract requires the echo.
  ?~  accepted=reservation.ses  denied
  ?~  sp=(~(get by spaces) flag.ses)  denied
  ?~  st-unit=state.u.sp  denied
  =/  st=bucket-state:b  u.st-unit
  ?.  (group-can-write group.st flag.ses writers.st requested-by.ses)  denied
  =/  fil=file:b  (entry-file entry.ses)
  =/  checksum-json=json
    ?~  checksum.fil  ~
    %-  pairs:enjs:format
    :~  ['algorithm' s+'crc32c']
        ['value' s+u.checksum.fil]
    ==
  =/  upload=json
    %-  pairs:enjs:format
    :~  ['bucketName' s+(scot %tas name.flag.ses)]
        ['bucketId' s+(scot %ud id.bucket.st)]
        ['sessionId' s+(scot %uv id.ses)]
        ['objectId' s+object-key.fil]
        ['actorShip' s+(ship-text requested-by.ses)]
        ['size' (numb:enjs:format size.fil)]
        ['mimeType' s+mime.fil]
        ['checksum' checksum-json]
        ['expiresAtMillis' (numb:enjs:format (mul 1.000 (unt:chrono:userlib expires-at.ses)))]
        ['brokerReservationId' s+u.accepted]
    ==
  %-  pairs:enjs:format
  :~  ['result' s+'authorized']
      ['upload' upload]
  ==
::
++  broker-object-verdict
  |=  [kind=object-kind:b token=@t object=@t]
  ^-  json
  =/  denied=json  (broker-simple-verdict 'denied')
  ?~  got=(~(get by object-capabilities) token)  denied
  =/  aut=object-capability:b  u.got
  ?.  =(kind kind.aut)  denied
  ?.  (gth expires-at.aut now.bowl)
    (broker-simple-verdict 'expired')
  ?~  sp=(~(get by spaces) flag.aut)  denied
  ?~  st-unit=state.u.sp  denied
  =/  st=bucket-state:b  u.st-unit
  ?.  ?:  =(%read kind)
        (group-can-read group.st flag.aut actor.aut)
      (group-can-write group.st flag.aut writers.st actor.aut)
    denied
  ?~  ent-unit=(~(get by entries.st) entry-id.aut)  denied
  =/  ent=entry:b  u.ent-unit
  ?.  ?=(%file -.kind.ent)  denied
  =/  fil=file:b  +.kind.ent
  ?.  =(%ready status.fil)  denied
  ?.  =(object object-key.fil)  denied
  =/  payload=json
    ?:  =(kind %read)
      %-  pairs:enjs:format
      :~  ['bucketId' s+(scot %ud id.bucket.st)]
          ['objectId' s+object-key.fil]
          ['displayFilename' s+name.ent]
      ==
    %-  pairs:enjs:format
    :~  ['bucketId' s+(scot %ud id.bucket.st)]
        ['objectId' s+object-key.fil]
    ==
  =/  key=@t  ?:(=(kind %read) 'read' 'delete')
  %-  pairs:enjs:format
  :~  ['result' s+'authorized']
      [key payload]
  ==
::
::  +broker-complete-verdict: expiry reports as %expired rather than %denied.
::  Memex maps 403 to non-retryable and 410 to expired, so collapsing a lapsed
::  window into a denial turns a recoverable upload into a dead one.
::
++  broker-complete-verdict
  |=  reservation=@t
  ^-  json
  =/  denied=json  (broker-simple-verdict 'denied')
  ?~  sid=(~(get by reservations) reservation)  denied
  ?~  got=(~(get by sessions) u.sid)  denied
  =/  ses=upload-session:b  u.got
  ?:  =(%complete status.ses)  (broker-simple-verdict 'completed')
  ?.  (gth expires-at.ses now.bowl)
    (broker-simple-verdict 'expired')
  denied
::
++  updates-path
  |=  =flag:b
  ^-  path
  /v1/buckets/(scot %p ship.flag)/[name.flag]/updates
::
++  sub-wire
  |=  =flag:b
  ^-  wire
  /buckets/sub/(scot %p ship.flag)/[name.flag]
::
++  start-sub
  |=  [=flag:b group=flag:b]
  ^+  cor
  ?:  (~(has by spaces) flag)  cor
  =.  spaces  (~(put by spaces) flag [%sub ~ `group])
  %-  emit
  [%pass (sub-wire flag) %agent [ship.flag %buckets] %watch (updates-path flag)]
::
++  stop-sub
  |=  =flag:b
  ^+  cor
  ?~  sp=(~(get by spaces) flag)  cor
  ?.  =(%sub net.u.sp)  cor
  =.  cor  (emil (drop (report-active flag u.sp |)))
  =.  spaces  (~(del by spaces) flag)
  %-  emit
  [%pass (sub-wire flag) %agent [ship.flag %buckets] %leave ~]
::
::  +resub: re-establish a dropped subscription without discarding the
::  replica. A kick is not a revocation — the host kicks deliberately when
::  access is pulled, but Gall also kicks on restart and transient failure.
::
++  resub
  |=  =flag:b
  ^+  cor
  ?~  sp=(~(get by spaces) flag)  cor
  ?.  =(%sub net.u.sp)  cor
  %-  emit
  [%pass (sub-wire flag) %agent [ship.flag %buckets] %watch (updates-path flag)]
::
++  report-active
  |=  [=flag:b sp=space:b joined=?]
  ^-  (unit card)
  =/  grp=(unit flag:b)
    ?~  state.sp  pending-group.sp
    `group.u.state.sp
  ?~  grp  ~
  =/  nes=nest:b  [%buckets ship.flag name.flag]
  :-  ~
  :*  %pass  /report-active  %agent  [our.bowl %groups]
      %poke  group-channel-active+!>([u.grp nes joined])
  ==
::
++  watch
  |=  =(pole knot)
  ^+  cor
  ?+  pole  ~|(bad-buckets-watch+pole !!)
      [%v1 ~]
    ?>  =(src.bowl our.bowl)
    =/  facts=(list card)
      %+  murn  local-snapshots
      |=  snap=snapshot:b
      `[%give %fact ~ buckets-response-1+!>(`response:b`[%snapshot flag.snap bucket-state.snap])]
    (emil facts)
  ::
  ::  Terminal responses for actions submitted by clients on this ship. All
  ::  local clients share one path; tokens in a %grant are scoped to this
  ::  ship's user, who is the only subscriber.
  ::
      [%v1 %requests ~]
    ?>  =(src.bowl our.bowl)
    cor
  ::
  ::  A subscriber attaches here while waiting for our answer to one of its
  ::  forwarded commands. Only the requester named in the path may listen.
  ::
      [%v1 %request who=@ rid=@ ~]
    ?>  =(src.bowl (slav %p who.pole))
    cor
  ::
      [%v1 %buckets host=@ name=@ %updates ~]
    =/  =flag:b  [(slav %p host.pole) `@tas`name.pole]
    ?>  =(ship.flag our.bowl)
    =/  st=bucket-state:b  (need-state flag)
    ?>  (group-can-read group.st flag src.bowl)
    (give [%fact ~ buckets-response-1+!>(`response:b`[%snapshot flag st])])
  ==
::
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  ?+  pole  ~
      [%x %v1 %buckets ~]
    ``buckets-snapshots-1+!>(local-snapshots)
  ::
      [%x %v1 %buckets host=@ name=@ ~]
    =/  =flag:b  [(slav %p host.pole) `@tas`name.pole]
    ?~  sp=(~(get by spaces) flag)  ~
    ?~  state.u.sp  ~
    ``buckets-response-1+!>(`response:b`[%snapshot flag u.state.u.sp])
  ::
      [%x %v1 %broker %upload cap=@ reservation=@ ~]
    ``json+!>((broker-upload-verdict cap.pole reservation.pole))
  ::
      [%x %v1 %broker %read cap=@ object=@ ~]
    ``json+!>((broker-object-verdict %read cap.pole object.pole))
  ::
      [%x %v1 %broker %delete cap=@ object=@ ~]
    ``json+!>((broker-object-verdict %delete cap.pole object.pole))
  ::
      [%x %v1 %broker %complete reservation=@ ~]
    ``json+!>((broker-complete-verdict reservation.pole))
  ::
      [%u %joined host=@ name=@ ~]
    =/  =flag:b  [(slav %p host.pole) `@tas`name.pole]
    ``loob+!>((~(has by spaces) flag))
  ==
::
++  local-snapshots
  ^-  (list snapshot:b)
  %+  murn  ~(tap by spaces)
  |=  [=flag:b sp=space:b]
  ?~  state.sp  ~
  `[flag u.state.sp]
::
++  agent
  |=  [=(pole knot) =sign:agent:gall]
  ^+  cor
  ?+  pole  cor
      [%groups ~]
    ?+  -.sign  cor
        %kick  (emit [%pass /groups %agent [our.bowl %groups] %watch /v1/groups])
        %fact
      ::  an r-groups fact is [flag r-group]; we only need the flag head.
      =+  !<([=flag:b *] q.cage.sign)
      (recheck-host-subs flag)
        %watch-ack
      ?~  p.sign  cor
      ((slog leaf+"buckets: groups watch failed" u.p.sign) cor)
    ==
  ::
      [%buckets %sub host=@ name=@ ~]
    =/  =flag:b  [(slav %p host.pole) `@tas`name.pole]
    ?~  sp=(~(get by spaces) flag)  cor
    ?.  =(%sub net.u.sp)  cor
    ?+  -.sign  cor
        %fact
      ?.  =(%buckets-response-1 p.cage.sign)  cor
      (apply-response !<(response:b q.cage.sign))
    ::
    ::  A kick is not a revocation, so re-watch rather than dropping the
    ::  replica. The host's nack below is what tells us access is gone.
        %kick
      (resub flag)
    ::
        %watch-ack
      ?~  p.sign  cor
      (stop-sub flag)
    ==
  ::
      [%buckets %req host=@ rid=@ %watch ~]
    =/  host=ship  (slav %p host.pole)
    =/  rid=request-id:b  (slav %uv rid.pole)
    ?+  -.sign  cor
        %fact
      ?.  =(%buckets-req-response-1 p.cage.sign)  cor
      ?.  (request-live rid)  cor
      =/  res=req-response:b  !<(req-response:b q.cage.sign)
      =.  cor  (close-request host rid)
      (respond rid ~[/v1/requests] body.res)
    ::
        %kick
      ?.  (request-live rid)  cor
      =.  cor  (close-request host rid)
      (deny rid ~[/v1/requests] %unknown 'host closed the request stream')
    ::
        %watch-ack
      ?~  p.sign  cor
      ?.  (request-live rid)  cor
      =.  cor  (close-request host rid)
      (deny rid ~[/v1/requests] %unknown 'host refused the request stream')
    ==
  ::
  ::  The poke-ack only reports delivery. A nack means the host crashed on
  ::  the command, so answer now rather than waiting for the timeout.
      [%buckets %req host=@ rid=@ %poke ~]
    =/  host=ship  (slav %p host.pole)
    =/  rid=request-id:b  (slav %uv rid.pole)
    ?+  -.sign  cor
        %poke-ack
      ?~  p.sign  cor
      ?.  (request-live rid)  cor
      =.  cor  (close-request host rid)
      %-  (slog leaf+"buckets: host command failed" u.p.sign)
      (deny rid ~[/v1/requests] %unknown 'host rejected the command')
    ==
  ::
      [%buckets @ @ ?(%create %delete) ~]
    ?+  -.sign  cor
        %poke-ack
      ?~  p.sign  cor
      ((slog leaf+"buckets: group channel registration failed" u.p.sign) cor)
    ==
  ::
      [%report-active ~]
    ?+  -.sign  cor
        %poke-ack
      ?~  p.sign  cor
      ((slog leaf+"buckets: active-channel report failed" u.p.sign) cor)
    ==
  ==
::
++  arvo
  |=  [=(pole knot) =sign-arvo]
  ^+  cor
  ?+  pole  cor
      [%buckets %req host=@ rid=@ %wake ~]
    ?.  ?=([%behn %wake *] sign-arvo)  cor
    =/  host=ship  (slav %p host.pole)
    =/  rid=request-id:b  (slav %uv rid.pole)
    ?.  (request-live rid)  cor
    =.  pending  (~(del by pending) rid)
    =.  cor
      %-  emit
      :*  %pass  (req-watch-wire host rid)  %agent  [host %buckets]
          %leave  ~
      ==
    (deny rid ~[/v1/requests] %unknown 'the host did not answer in time')
  ==
::
++  apply-response
  |=  res=response:b
  ^+  cor
  ?-  -.res
      %snapshot
    =/  sp=space:b  (need-space flag.res)
    ?>  =(%sub net.sp)
    =.  sp  sp(state `bucket-state.res, pending-group `group.bucket-state.res)
    =.  spaces  (~(put by spaces) flag.res sp)
    =.  cor  (emil (drop (report-active flag.res sp &)))
    (give [%fact ~[/v1] buckets-response-1+!>(res)])
  ::
      %update
    =/  sp=space:b  (need-space flag.res)
    ?>  =(%sub net.sp)
    ?~  state.sp  cor
    =/  st=bucket-state:b  u.state.sp
    ::  Ignore duplicates and re-establish the subscription on a gap. The
    ::  replacement watch begins with a full snapshot, so later deltas cannot
    ::  be applied to a stale replica.
    ?:  (lte revision.res revision.st)  cor
    ?.  =(revision.res +(revision.st))
      (resub flag.res)
    ?:  =(%delete -.u-bucket.res)
      =.  cor  (give [%fact ~[/v1] buckets-response-1+!>(res)])
      =.  cor  (emil (drop (report-active flag.res sp |)))
      =.  spaces  (~(del by spaces) flag.res)
      cor
    =.  st  (apply-update st u-bucket.res)
    =.  revision.st  revision.res
    =.  spaces  (~(put by spaces) flag.res [net.sp `st `group.st])
    (give [%fact ~[/v1] buckets-response-1+!>(res)])
  ==
::
++  apply-update
  |=  [st=bucket-state:b upd=u-bucket:b]
  ^-  bucket-state:b
  ?-  -.upd
      %create   st(bucket bucket.upd)
      %delete   st
      %meta     st(bucket bucket.upd)
      %readers  st(readers readers.upd)
      %writers  st(writers writers.upd)
  ::
      %entry
    st(entries (~(put by entries.st) id.upd entry.u-entry.upd))
  ::
      %entries-deleted
    =.  entries.st
      %-  ~(rep in (silt ids.upd))
      |=  [key=@ud acc=_entries.st]
      (~(del by acc) key)
    st
  ==
::
::  +recheck-host-subs: read permissions may have shifted in `changed`, so
::  re-run can-read for subscribers of buckets bound to that group and kick
::  any who lost access. Scoped to the one group — a fact about some other
::  group is not a reason to scry for every subscriber we have. Grants are
::  handled by %groups' auto-join, so this only revokes.
::
++  recheck-host-subs
  |=  changed=flag:b
  ^+  cor
  =/  kicks=(list card)
    %+  murn  ~(val by sup.bowl)
    |=  [who=ship pax=path]
    ^-  (unit card)
    ?.  ?=([%v1 %buckets @ @ %updates ~] pax)  ~
    =/  =flag:b  [(slav %p i.t.t.pax) `@tas`i.t.t.t.pax]
    ?~  sp=(~(get by spaces) flag)  ~
    ?.  =(%pub net.u.sp)  ~
    ?~  state.u.sp  ~
    ?.  =(changed group.u.state.u.sp)  ~
    ?:  (group-can-read group.u.state.u.sp flag who)  ~
    `[%give %kick ~[pax] `who]
  (emil kicks)
--

::  buckets: group-owned shared file manifest and upload coordinator
::
::  This agent is a third-party %groups channel host. It stores metadata and
::  upload lifecycle only; file bytes move directly between clients and object
::  storage.
::
/-  b=buckets
/+  default-agent, dbug, verb
|%
+$  card  card:agent:gall
+$  current-state  state-0:b
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
      cor   ~(. +> [bowl ~])
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
  ++  on-arvo   on-arvo:def
  ++  on-leave  on-leave:def
  ++  on-fail
    |=  [=term =tang]
    ^-  (quip card _this)
    %-  (slog 'buckets: on-fail' >term< tang)
    [~ this]
  --
::
|_  [=bowl:gall cards=(list card)]
++  cor   .
++  abet  [(flop cards) state]
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
::
++  init
  ^+  cor
  (emit [%pass /groups %agent [our.bowl %groups] %watch /v1/groups])
::
::  Greenfield version 0. Future state versions must migrate explicitly here.
::
++  load
  |=  old=vase
  ^+  cor
  =+  !<(loaded=state-0:b old)
  ?>  =(%0 -.loaded)
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
    (dispatch-local !<(action:b vase))
  ::
      %buckets-command-1
    =+  cmd=!<(command:b vase)
    =/  act=action:b  action.cmd
    ?>  !=(%create -.act)
    =/  =flag:b  (action-flag act)
    ?>  =(ship.flag our.bowl)
    =/  st=bucket-state:b  (need-state flag)
    ?>  (group-can-read group.st flag src.bowl)
    (apply-action act)
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
++  dispatch-local
  |=  act=action:b
  ^+  cor
  ?+  -.act  (dispatch-existing act)
    %create
  (create-bucket name.act title.act group.act readers.act)
  ==
::
++  dispatch-existing
  |=  act=action:b
  ^+  cor
  =/  =flag:b  (action-flag act)
  =/  sp=space:b  (need-space flag)
  ?:  =(%pub net.sp)
    (apply-action act)
  (forward-action flag act)
::
++  action-flag
  |=  act=action:b
  ^-  flag:b
  ?-  -.act
    %create          ~|(%create-has-no-flag !!)
    %delete-bucket   flag.act
    %create-folder   flag.act
    %begin-upload    flag.act
    %finish-upload   flag.act
    %fail-upload     flag.act
    %rename-entry    flag.act
    %move-entry      flag.act
    %delete-entry    flag.act
  ==
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
  |=  [name=@tas title=@t group=flag:b readers=(set @tas)]
  ^+  cor
  ?>  =(ship.group our.bowl)
  =/  =flag:b  [our.bowl name]
  ?>  !(~(has by spaces) flag)
  =/  id=@ud  +(next-id)
  =.  next-id  id
  =/  buc=bucket:b  [id title our.bowl now.bowl our.bowl now.bowl]
  =/  st=bucket-state:b  [buc group readers ~ ~ 0]
  =.  spaces  (~(put by spaces) flag [%pub `st `group])
  =/  channel=group-channel:b
    [[title '' '' ''] now.bowl %default readers |]
  =/  add=group-create:b
    [%group group %channel [%buckets flag] %add channel]
  =.  cor
    %-  emit
    :*  %pass  /buckets/(scot %p ship.flag)/[name.flag]/create
        %agent  [our.bowl %groups]
        %poke  group-action-4+!>(add)
    ==
  (give [%fact ~[/v1] buckets-response-1+!>(`response:b`[%snapshot flag st])])
::
++  apply-action
  |=  act=action:b
  ^+  cor
  ?-  -.act
    %create          ~|(%cannot-forward-create !!)
    %delete-bucket   (delete-bucket flag.act)
    %create-folder   (create-folder flag.act parent.act name.act)
    %begin-upload    (begin-upload flag.act parent.act name.act mime.act size.act checksum.act)
    %finish-upload   (finish-upload flag.act session.act object-url.act)
    %fail-upload     (fail-upload flag.act session.act reason.act)
    %rename-entry    (rename-entry flag.act id.act name.act)
    %move-entry      (move-entry flag.act id.act parent.act)
    %delete-entry    (delete-entry flag.act id.act recursive.act)
  ==
::
++  forward-action
  |=  [=flag:b act=action:b]
  ^+  cor
  %-  emit
  :*  %pass  /buckets/cmd/(scot %p ship.flag)/[name.flag]
      %agent  [ship.flag %buckets]
      %poke  buckets-command-1+!>(`command:b`[act])
  ==
::
++  delete-bucket
  |=  =flag:b
  ^+  cor
  ?>  =(src.bowl our.bowl)
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
    [%update flag +(revision.st) src.bowl [%bucket-deleted ~]]
  =.  cor  (give [%fact ~[/v1 (updates-path flag)] buckets-response-1+!>(res)])
  =.  spaces  (~(del by spaces) flag)
  cor
::
++  create-folder
  |=  [=flag:b parent=(unit @ud) name=@t]
  ^+  cor
  =/  st=bucket-state:b  (need-state flag)
  ?>  (valid-parent st parent)
  =/  id=@ud  +(next-id)
  =.  next-id  id
  =/  ent=entry:b
    [id parent name src.bowl now.bowl src.bowl now.bowl [%folder ~]]
  =.  entries.st  (~(put by entries.st) id ent)
  (commit-update flag st [%folder-created ent])
::
++  begin-upload
  |=  $:  =flag:b
          parent=(unit @ud)
          name=@t
          mime=@t
          size=@ud
          checksum=(unit @t)
      ==
  ^+  cor
  =/  st=bucket-state:b  (need-state flag)
  ?>  (valid-parent st parent)
  =/  id=@ud  +(next-id)
  =.  next-id  id
  =/  sid=@uv  `@uv`eny.bowl
  =/  fil=file:b
    [mime size checksum (scot %uv sid) ~ %pending]
  =/  ent=entry:b
    [id parent name src.bowl now.bowl src.bowl now.bowl [%file fil]]
  =/  ses=upload-session:b
    [sid id src.bowl now.bowl (add now.bowl ~h1) %pending ~]
  =.  entries.st   (~(put by entries.st) id ent)
  =.  sessions.st  (~(put by sessions.st) sid ses)
  (commit-update flag st [%upload-begun ses ent])
::
++  finish-upload
  |=  [=flag:b sid=@uv object-url=@t]
  ^+  cor
  =/  st=bucket-state:b  (need-state flag)
  =/  ses=upload-session:b  (~(got by sessions.st) sid)
  ?>  =(%pending status.ses)
  ?>  =(requested-by.ses src.bowl)
  =/  ent=entry:b  (~(got by entries.st) file-id.ses)
  =/  fil=file:b  (entry-file ent)
  =.  fil  fil(object-url `object-url, status %ready)
  =.  ent  ent(updated-by src.bowl, updated-at now.bowl, kind [%file fil])
  =.  ses  ses(status %complete)
  =.  entries.st   (~(put by entries.st) id.ent ent)
  =.  sessions.st  (~(put by sessions.st) sid ses)
  (commit-update flag st [%upload-ready ses ent])
::
++  fail-upload
  |=  [=flag:b sid=@uv reason=@t]
  ^+  cor
  =/  st=bucket-state:b  (need-state flag)
  =/  ses=upload-session:b  (~(got by sessions.st) sid)
  ?>  =(%pending status.ses)
  ?>  =(requested-by.ses src.bowl)
  =/  ent=entry:b  (~(got by entries.st) file-id.ses)
  =/  fil=file:b  (entry-file ent)
  =.  fil  fil(status %failed)
  =.  ent  ent(updated-by src.bowl, updated-at now.bowl, kind [%file fil])
  =.  ses  ses(status %failed, error `reason)
  =.  entries.st   (~(put by entries.st) id.ent ent)
  =.  sessions.st  (~(put by sessions.st) sid ses)
  (commit-update flag st [%upload-failed ses ent])
::
++  rename-entry
  |=  [=flag:b id=@ud name=@t]
  ^+  cor
  =/  st=bucket-state:b  (need-state flag)
  =/  ent=entry:b  (~(got by entries.st) id)
  =.  ent  ent(name name, updated-by src.bowl, updated-at now.bowl)
  =.  entries.st  (~(put by entries.st) id ent)
  (commit-update flag st [%entry-updated ent])
::
++  move-entry
  |=  [=flag:b id=@ud parent=(unit @ud)]
  ^+  cor
  =/  st=bucket-state:b  (need-state flag)
  ?>  (valid-parent st parent)
  =/  ent=entry:b  (~(got by entries.st) id)
  ?<  ?&  ?=(^ parent)
          =(u.parent id)
      ==
  =?  st  ?&(?=(%folder -.kind.ent) ?=(^ parent))
    ?<  (descendant st id u.parent)
    st
  =.  ent  ent(parent parent, updated-by src.bowl, updated-at now.bowl)
  =.  entries.st  (~(put by entries.st) id ent)
  (commit-update flag st [%entry-updated ent])
::
++  delete-entry
  |=  [=flag:b id=@ud recursive=?]
  ^+  cor
  =/  st=bucket-state:b  (need-state flag)
  =/  ids=(set @ud)  (descendants st id)
  ?>  ?|(recursive =((lent ~(tap in ids)) 1))
  =.  entries.st
    %-  ~(rep in ids)
    |=  [key=@ud acc=_entries.st]
    (~(del by acc) key)
  =.  sessions.st
    %-  malt
    %+  skip  ~(tap by sessions.st)
    |=  [key=@uv ses=upload-session:b]
    (~(has in ids) file-id.ses)
  (commit-update flag st [%entries-deleted ~(tap in ids)])
::
++  commit-update
  |=  [=flag:b st=bucket-state:b upd=update:b]
  ^+  cor
  =.  revision.st  +(revision.st)
  =.  bucket.st
    bucket.st(updated-by src.bowl, updated-at now.bowl)
  =.  cor  (put-state flag st)
  =/  res=response:b  [%update flag revision.st src.bowl upd]
  (give [%fact ~[/v1 (updates-path flag)] buckets-response-1+!>(res)])
::
++  valid-parent
  |=  [st=bucket-state:b parent=(unit @ud)]
  ^-  ?
  ?~  parent  &
  ?~  ent=(~(get by entries.st) u.parent)  |
  =(%folder -.kind.u.ent)
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
        %fact  recheck-host-subs
        %kick  (emit [%pass /groups %agent [our.bowl %groups] %watch /v1/groups])
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
        %kick
      (stop-sub flag)
    ::
        %watch-ack
      ?~  p.sign  cor
      (stop-sub flag)
    ==
  ::
      [%buckets %cmd *]
    ?+  -.sign  cor
        %poke-ack
      ?~  p.sign  cor
      ((slog leaf+"buckets: host command failed" u.p.sign) cor)
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
    ?:  =(%bucket-deleted -.update.res)
      =.  cor  (give [%fact ~[/v1] buckets-response-1+!>(res)])
      =.  cor  (emil (drop (report-active flag.res sp |)))
      =.  spaces  (~(del by spaces) flag.res)
      cor
    =.  st  (apply-update st update.res)
    =.  revision.st  revision.res
    =.  spaces  (~(put by spaces) flag.res [net.sp `st `group.st])
    (give [%fact ~[/v1] buckets-response-1+!>(res)])
  ==
::
++  apply-update
  |=  [st=bucket-state:b upd=update:b]
  ^-  bucket-state:b
  ?-  -.upd
      %bucket-created
    st(bucket bucket.upd)
  ::
      %bucket-deleted  st
  ::
      %folder-created
    st(entries (~(put by entries.st) id.entry.upd entry.upd))
  ::
      %upload-begun
    %=  st
      entries   (~(put by entries.st) id.entry.upd entry.upd)
      sessions  (~(put by sessions.st) id.upload-session.upd upload-session.upd)
    ==
  ::
      %upload-ready
    %=  st
      entries   (~(put by entries.st) id.entry.upd entry.upd)
      sessions  (~(put by sessions.st) id.upload-session.upd upload-session.upd)
    ==
  ::
      %upload-failed
    %=  st
      entries   (~(put by entries.st) id.entry.upd entry.upd)
      sessions  (~(put by sessions.st) id.upload-session.upd upload-session.upd)
    ==
  ::
      %entry-updated
    st(entries (~(put by entries.st) id.entry.upd entry.upd))
  ::
      %entries-deleted
    =.  entries.st
      %-  ~(rep in (silt ids.upd))
      |=  [key=@ud acc=_entries.st]
      (~(del by acc) key)
    =.  sessions.st
      %-  malt
      %+  skip  ~(tap by sessions.st)
      |=  [key=@uv ses=upload-session:b]
      (~(has in (silt ids.upd)) file-id.ses)
    st
  ==
::
++  recheck-host-subs
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
    ?:  (group-can-read group.u.state.u.sp flag who)  ~
    `[%give %kick ~[pax] `who]
  (emil kicks)
--

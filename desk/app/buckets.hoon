::  buckets: group-owned shared file manifest and upload coordinator
::
::  This agent is a third-party %groups channel host. It stores metadata and
::  upload lifecycle only; file bytes move directly between clients and object
::  storage. Group admins may request creation, but the group host remains the
::  authoritative Bucket and storage owner.
::
/-  b=buckets
/+  default-agent, dbug, verb
|%
+$  card  card:agent:gall
+$  current-state  state:b
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
::  Persisted state migrations are explicit. Version 2 separates the writer
::  role-set from the group's reader roles; existing Buckets preserve their
::  previous behavior by initially granting those reader roles write access.
::
++  load
  |=  old=vase
  ^+  cor
  =+  !<(loaded=versioned-state:b old)
  =.  state
    ?-  -.loaded
      %0  [%2 (migrate-spaces spaces.loaded) next-id.loaded ~ ~]
      %1  [%2 (migrate-spaces spaces.loaded) next-id.loaded broker-capabilities.loaded broker-reservations.loaded]
      %2  loaded
    ==
  =?  cor  !(~(has by wex.bowl) [/groups our.bowl %groups])
    (emit [%pass /groups %agent [our.bowl %groups] %watch /v1/groups])
  cor
::
++  migrate-spaces
  |=  old=(map flag:b space-1:b)
  ^-  (map flag:b space:b)
  %-  malt
  %+  turn  ~(tap by old)
  |=  [=flag:b old-space=space-1:b]
  =/  new-state=(unit bucket-state:b)
    ?~  state.old-space  ~
    =/  old-state=bucket-state-1:b  u.state.old-space
    `[bucket.old-state group.old-state readers.old-state readers.old-state entries.old-state sessions.old-state revision.old-state]
  [flag net.old-space new-state pending-group.old-space]
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
    ?:  ?=(%create -.act)
      ?>  =(ship.group.act our.bowl)
      ?>  (group-is-admin-for-create group.act src.bowl)
      (create-bucket name.act title.act group.act readers.act writers.act src.bowl)
    =/  =flag:b  (action-flag act)
    ?>  =(ship.flag our.bowl)
    =/  st=bucket-state:b  (need-state flag)
    ?>  (action-authorized st flag src.bowl act)
    (apply-action act)
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
++  dispatch-local
  |=  act=action:b
  ^+  cor
  ?+  -.act  (dispatch-existing act)
    %create
  ?>  (group-is-admin-for-create group.act our.bowl)
  ?:  =(ship.group.act our.bowl)
    (create-bucket name.act title.act group.act readers.act writers.act our.bowl)
  (forward-create act)
  ==
::
++  forward-create
  |=  act=action:b
  ^+  cor
  ?+  -.act  ~|(%forward-create-requires-create !!)
    %create
  %-  emit
  :*  %pass  /buckets/cmd/create/(scot %p ship.group.act)/[name.act]
      %agent  [ship.group.act %buckets]
      %poke  buckets-command-1+!>(`command:b`[act])
  ==
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
    %set-title       flag.act
    %set-writers     flag.act
    %create-folder   flag.act
    %begin-upload    flag.act
    %finish-upload   flag.act
    %fail-upload     flag.act
    %issue-read      flag.act
    %issue-delete    flag.act
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
  =/  st=bucket-state:b  [buc group readers writers ~ ~ 0]
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
++  apply-action
  |=  act=action:b
  ^+  cor
  ?-  -.act
    %create          ~|(%cannot-forward-create !!)
    %delete-bucket   (delete-bucket flag.act)
    %set-title       (set-title flag.act title.act)
    %set-writers     (set-writers flag.act writers.act)
    %create-folder   (create-folder flag.act parent.act name.act)
    %begin-upload    (begin-upload flag.act parent.act name.act mime.act size.act checksum.act capability.act)
    %finish-upload   (finish-upload flag.act session.act object-url.act)
    %fail-upload     (fail-upload flag.act session.act reason.act)
    %issue-read      (issue-object-capability %read flag.act id.act capability.act)
    %issue-delete    (issue-object-capability %delete flag.act id.act capability.act)
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
++  set-title
  |=  [=flag:b title=@t]
  ^+  cor
  =/  st=bucket-state:b  (need-state flag)
  =.  bucket.st
    bucket.st(title title, updated-by src.bowl, updated-at now.bowl)
  (commit-update flag st [%bucket-updated bucket.st])
::
++  set-writers
  |=  [=flag:b writers=(set @tas)]
  ^+  cor
  =/  st=bucket-state:b  (need-state flag)
  =.  writers.st  writers
  (commit-update flag st [%writers-updated writers])
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
          capability=@t
      ==
  ^+  cor
  =/  st=bucket-state:b  (need-state flag)
  ?>  (valid-parent st parent)
  ?>  (gth (met 3 capability) 15)
  =.  cor  prune-broker-authority
  ?>  !(~(has by broker-capabilities) capability)
  =/  id=@ud  +(next-id)
  =.  next-id  id
  =/  sid=@uv  `@uv`eny.bowl
  =/  fil=file:b
    [mime size checksum (scot %uv sid) ~ %pending]
  =/  ent=entry:b
    [id parent name src.bowl now.bowl src.bowl now.bowl [%file fil]]
  =/  ses=upload-session:b
    [sid id src.bowl now.bowl (add now.bowl ~h1) %pending ~]
  =/  aut=broker-capability:b
    [%upload flag `sid id object-key.fil src.bowl expires-at.ses ~]
  =.  entries.st   (~(put by entries.st) id ent)
  =.  sessions.st  (~(put by sessions.st) sid ses)
  =.  broker-capabilities
    (~(put by broker-capabilities) capability aut)
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
++  issue-object-capability
  |=  [kind=broker-kind:b =flag:b id=@ud capability=@t]
  ^+  cor
  ?>  !=(%upload kind)
  ?>  (gth (met 3 capability) 15)
  =.  cor  prune-broker-authority
  ?>  !(~(has by broker-capabilities) capability)
  =/  st=bucket-state:b  (need-state flag)
  =/  ent=entry:b  (~(got by entries.st) id)
  =/  fil=file:b  (entry-file ent)
  ?>  =(%ready status.fil)
  =/  aut=broker-capability:b
    [kind flag ~ id object-key.fil src.bowl (add now.bowl ~m10) ~]
  =.  broker-capabilities
    (~(put by broker-capabilities) capability aut)
  cor
::
++  prune-broker-authority
  ^+  cor
  =/  kept=(map @t broker-capability:b)
    %-  malt
    %+  skim  ~(tap by broker-capabilities)
    |=  [capability=@t aut=broker-capability:b]
    (gth expires-at.aut now.bowl)
  =.  broker-capabilities  kept
  =.  broker-reservations
    %-  malt
    %+  skim  ~(tap by broker-reservations)
    |=  [reservation=@t capability=@t]
    (~(has by kept) capability)
  cor
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
  |=  [capability=@t reservation=@t]
  ^+  cor
  ?~  got=(~(get by broker-capabilities) capability)  cor
  =/  aut=broker-capability:b  u.got
  ?.  =(%upload broker-kind.aut)  cor
  ?.  (gth expires-at.aut now.bowl)  cor
  ?~  sid=session.aut  cor
  =/  st=bucket-state:b  (need-state flag.aut)
  ?~  ses=(~(get by sessions.st) u.sid)  cor
  ?.  =(%pending status.u.ses)  cor
  ?.  (group-can-write group.st flag.aut writers.st actor.aut)  cor
  ?~  accepted=broker-reservation-id.aut
    ?^  occupied=(~(get by broker-reservations) reservation)  cor
    =/  updated=broker-capability:b
      :*  %upload
          flag.aut
          session.aut
          entry-id.aut
          object-id.aut
          actor.aut
          expires-at.aut
          [~ reservation]
      ==
    =.  broker-capabilities
      (~(put by broker-capabilities) capability updated)
    =.  broker-reservations
      (~(put by broker-reservations) reservation capability)
    cor
  ?:  =(u.accepted reservation)  cor
  cor
::
++  complete-broker-upload
  |=  receipt=broker-receipt:b
  ^+  cor
  ?~  cap=(~(get by broker-reservations) broker-reservation-id.receipt)  cor
  ?~  got=(~(get by broker-capabilities) u.cap)  cor
  =/  aut=broker-capability:b  u.got
  ?.  =(%upload broker-kind.aut)  cor
  ?~  sid=session.aut  cor
  =/  st=bucket-state:b  (need-state flag.aut)
  ?.  (group-can-write group.st flag.aut writers.st actor.aut)  cor
  ?~  ses-unit=(~(get by sessions.st) u.sid)  cor
  =/  ses=upload-session:b  u.ses-unit
  ?:  =(%complete status.ses)  cor
  ?.  =(%pending status.ses)  cor
  =/  ent=entry:b  (~(got by entries.st) entry-id.aut)
  =/  fil=file:b  (entry-file ent)
  ?.  ?&  =(object-id.receipt object-id.aut)
          ?|  =(host.receipt (ship-text our.bowl))
              =(host.receipt (scot %p our.bowl))
          ==
          =(bucket-id.receipt (scot %ud id.bucket.st))
          =(size.receipt size.fil)
          =(mime-type.receipt mime.fil)
      ==
    cor
  =.  fil  fil(object-url ~, status %ready)
  =.  ent
    ent(updated-by actor.aut, updated-at now.bowl, kind [%file fil])
  =.  ses  ses(status %complete)
  =.  entries.st   (~(put by entries.st) id.ent ent)
  =.  sessions.st  (~(put by sessions.st) id.ses ses)
  (commit-update flag.aut st [%upload-ready ses ent])
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
  ^-  [admin=? roles=(set @tas)]
  ?:  =(who ship.flag)  [& ~]
  =/  pax=path
    /(scot %p our.bowl)/groups/(scot %da now.bowl)/v2/groups/(scot %p ship.group)/[name.group]/channels/buckets/(scot %p ship.flag)/[name.flag]/can-write/(scot %p who)/noun
  .^([admin=? roles=(set @tas)] %gx pax)
::
++  group-is-admin
  |=  [group=flag:b =flag:b who=ship]
  ^-  ?
  =/  permissions=[admin=? roles=(set @tas)]
    (group-permissions group flag who)
  admin.permissions
::
++  group-can-write
  |=  [group=flag:b =flag:b writers=(set @tas) who=ship]
  ^-  ?
  ?.  (group-can-read group flag who)  |
  =/  permissions=[admin=? roles=(set @tas)]
    (group-permissions group flag who)
  ?|  admin.permissions
      =(~ writers)
      !=(~ (~(int in writers) roles.permissions))
  ==
::
++  action-authorized
  |=  [st=bucket-state:b =flag:b who=ship act=action:b]
  ^-  ?
  ?-  -.act
    %create          |
    %delete-bucket   (group-is-admin group.st flag who)
    %set-title       (group-is-admin group.st flag who)
    %set-writers     (group-is-admin group.st flag who)
    %issue-read      (group-can-read group.st flag who)
    %create-folder   (group-can-write group.st flag writers.st who)
    %begin-upload    (group-can-write group.st flag writers.st who)
    %finish-upload   (group-can-write group.st flag writers.st who)
    %fail-upload     (group-can-write group.st flag writers.st who)
    %issue-delete    (group-can-write group.st flag writers.st who)
    %rename-entry    (group-can-write group.st flag writers.st who)
    %move-entry      (group-can-write group.st flag writers.st who)
    %delete-entry    (group-can-write group.st flag writers.st who)
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
  |=  [capability=@t reservation=@t]
  ^-  json
  =/  denied=json  (broker-simple-verdict 'denied')
  ?~  got=(~(get by broker-capabilities) capability)  denied
  =/  aut=broker-capability:b  u.got
  ?.  =(%upload broker-kind.aut)  denied
  ?.  (gth expires-at.aut now.bowl)
    (broker-simple-verdict 'expired')
  ?~  accepted=broker-reservation-id.aut  denied
  ?.  =(u.accepted reservation)  denied
  ?~  sid=session.aut  denied
  ?~  sp=(~(get by spaces) flag.aut)  denied
  ?~  st-unit=state.u.sp  denied
  =/  st=bucket-state:b  u.st-unit
  ?~  ses=(~(get by sessions.st) u.sid)  denied
  ?.  =(%pending status.u.ses)  denied
  ?.  (group-can-write group.st flag.aut writers.st actor.aut)  denied
  =/  ent=entry:b  (~(got by entries.st) entry-id.aut)
  =/  fil=file:b  (entry-file ent)
  =/  checksum-json=json
    ?~  checksum.fil  ~
    %-  pairs:enjs:format
    :~  ['algorithm' s+'crc32c']
        ['value' s+u.checksum.fil]
    ==
  =/  upload=json
    %-  pairs:enjs:format
    :~  ['bucketName' s+(scot %tas name.flag.aut)]
        ['bucketId' s+(scot %ud id.bucket.st)]
        ['sessionId' s+(scot %uv u.sid)]
        ['objectId' s+object-id.aut]
        ['actorShip' s+(ship-text actor.aut)]
        ['size' (numb:enjs:format size.fil)]
        ['mimeType' s+mime.fil]
        ['checksum' checksum-json]
        ['expiresAtMillis' (numb:enjs:format (mul 1.000 (unt:chrono:userlib expires-at.aut)))]
        ['brokerReservationId' s+u.accepted]
    ==
  %-  pairs:enjs:format
  :~  ['result' s+'authorized']
      ['upload' upload]
  ==
::
++  broker-object-verdict
  |=  [kind=broker-kind:b capability=@t object=@t]
  ^-  json
  =/  denied=json  (broker-simple-verdict 'denied')
  ?~  got=(~(get by broker-capabilities) capability)  denied
  =/  aut=broker-capability:b  u.got
  ?.  =(kind broker-kind.aut)  denied
  ?.  =(object object-id.aut)  denied
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
  =/  payload=json
    ?:  =(kind %read)
      %-  pairs:enjs:format
      :~  ['bucketId' s+(scot %ud id.bucket.st)]
          ['objectId' s+object-id.aut]
          ['displayFilename' s+name.ent]
      ==
    %-  pairs:enjs:format
    :~  ['bucketId' s+(scot %ud id.bucket.st)]
        ['objectId' s+object-id.aut]
    ==
  =/  key=@t  ?:(=(kind %read) 'read' 'delete')
  %-  pairs:enjs:format
  :~  ['result' s+'authorized']
      [key payload]
  ==
::
++  broker-complete-verdict
  |=  reservation=@t
  ^-  json
  =/  denied=json  (broker-simple-verdict 'denied')
  ?~  cap=(~(get by broker-reservations) reservation)  denied
  ?~  got=(~(get by broker-capabilities) u.cap)  denied
  =/  aut=broker-capability:b  u.got
  ?~  sid=session.aut  denied
  ?~  sp=(~(get by spaces) flag.aut)  denied
  ?~  st-unit=state.u.sp  denied
  ?~  ses=(~(get by sessions.u.st-unit) u.sid)  denied
  ?.  =(%complete status.u.ses)  denied
  (broker-simple-verdict 'completed')
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
      %bucket-updated
    st(bucket bucket.upd)
  ::
      %writers-updated
    st(writers writers.upd)
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

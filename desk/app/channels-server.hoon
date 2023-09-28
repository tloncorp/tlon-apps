::  channels-server: diary, heap & chat channel storage for groups
::
::    this is the server-side from which /app/channels gets its data.
::
::  TODO: import state from diary
::
/-  d=channel, g=groups
/+  utils=channel-utils
/+  default-agent, verb, dbug, neg=negotiate
%-  %-  agent:neg
    [| [~.channels^%0 ~ ~] ~]
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  +$  current-state
    $:  %0
        =v-channels:d
    ==
  --
=|  current-state
=*  state  -
=<
  %+  verb  |
  %-  agent:dbug
  |_  =bowl:gall
  +*  this  .
      def   ~(. (default-agent this %|) bowl)
      cor   ~(. +> [bowl ~])
  ++  on-init
    ^-  (quip card _this)
    =^  cards  state
      abet:init:cor
    [cards this]
  ::
  ++  on-save  !>(state)
  ++  on-load
    |=  =vase
    ^-  (quip card _this)
    =^  cards  state
      abet:(load:cor vase)
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
      abet:(watch:cor path)
    [cards this]
  ::
  ++  on-peek    on-peek:def
  ++  on-leave   on-leave:def
  ++  on-fail    on-fail:def
  ++  on-agent
    |=  [=wire =sign:agent:gall]
    ^-  (quip card _this)
    =^  cards  state
      abet:(agent:cor wire sign)
    [cards this]
  ::
  ++  on-arvo    on-arvo:def
  --
::
|_  [=bowl:gall cards=(list card)]
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
++  safe-watch
  |=  [=wire =dock =path]
  ^+  cor
  ?:  (~(has by wex.bowl) wire dock)  cor
  (emit %pass wire %agent dock %watch path)
::
++  load
  |=  =vase
  |^  ^+  cor
  =+  !<(old=versioned-state vase)
  ?>  ?=(%0 -.old)
  =.  state  old
  inflate-io
  ::
  +$  versioned-state  $%(current-state)
  --
::
++  init
  ^+  cor
  =.  cor
    %-  emil
    %-  turn  :_  |=(=note:agent:gall [%pass /migrate note])
    ^-  (list note:agent:gall)
    :~  [%agent [our.bowl %diary] %poke %diary-migrate-server !>(~)]
        [%agent [our.bowl %heap] %poke %heap-migrate-server !>(~)]
        [%agent [our.bowl %chat] %poke %chat-migrate-server !>(~)]
    ==
  inflate-io
::
++  inflate-io
  (safe-watch /groups [our.bowl %groups] /groups)
::
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?+    mark  ~|(bad-poke+mark !!)
      %channel-command
    =+  !<(=c-channels:d vase)
    ?-    -.c-channels
        %create
      =<  di-abet
      =/  =nest:d  [han.create-diary.c-channels our.bowl name.create-diary.c-channels]
      (di-create:di-core nest create-diary.c-channels)
    ::
        %diary
      =/  diary-core  (di-abed:di-core nest.c-channels)
      di-abet:(di-c-diary:diary-core c-diary.c-channels)
    ==
  ::
      %channel-migration
    ?>  =(our src):bowl
    =+  !<(new-channels=v-channels:d vase)
    =.  v-channels  (~(uni by new-channels) v-channels)  ::  existing overrides migration
    %+  roll  ~(tap by v-channels)
    |=  [[=nest:d =diary:d] cr=_cor]
    di-abet:di-migrate:(di-abed:di-core:cr nest)
  ==
::
++  watch
  |=  =(pole knot)
  ^+  cor
  ?+    pole  ~|(bad-watch-path+pole !!)
      [=han:d name=@ %create ~]
    ?>  =(our src):bowl
    =*  nest  [han.pole our.bowl name.pole]
    ?.  (~(has by v-channels) nest)  cor
    di-abet:di-watch-create:(di-abed:di-core nest)
  ::
      [=han:d name=@ %updates ~]
    =/  di  (di-abed:di-core han.pole our.bowl name.pole)
    ?>  (can-read:di-perms:di src.bowl)
    cor
  ::
      [=han:d name=@ %updates after=@ ~]
    =<  di-abet
    %-  di-watch-updates:(di-abed:di-core han.pole our.bowl name.pole)
    (slav %da after.pole)
  ::
      [=han:d name=@ %checkpoint %time-range from=@ ~]
    =<  di-abet
    %-  di-watch-checkpoint:(di-abed:di-core han.pole our.bowl name.pole)
    [(slav %da from.pole) ~]
  ::
      [=han:d name=@ %checkpoint %time-range from=@ to=@ ~]
    =<  di-abet
    %^    di-watch-checkpoint:(di-abed:di-core han.pole our.bowl name.pole)
        (slav %da from.pole)
      ~
    (slav %da to.pole)
  ::
      [=han:d name=@ %checkpoint %before n=@ud ~]
    =<  di-abet
    %-  di-watch-checkpoint-page:(di-abed:di-core han.pole our.bowl name.pole)
    (slav %ud n.pole)
  ::
      [%said =han:d host=@ name=@ %note time=@ quip=?(~ [@ ~])]
    =/  host=ship   (slav %p host.pole)
    =/  =nest:d     [han.pole host name.pole]
    =/  =plan:d     =,(pole [(slav %ud time) ?~(quip ~ `(slav %ud -.quip))])
    ?>  =(our.bowl host)
    di-abet:(di-said:(di-abed:di-core nest) plan)
  ==
::
++  agent
  |=  [=(pole knot) =sign:agent:gall]
  ^+  cor
  ?+    pole  ~|(bad-agent-wire+pole !!)
      [=han:d *]
    ?+    -.sign  !!
        %poke-ack
      ?~  p.sign  cor
      %-  (slog 'diary-server: poke failure' >wire< u.p.sign)
      cor
    ==
  ::
      [%groups ~]
    ?+    -.sign  !!
        %kick       watch-groups
        %watch-ack
      ?~  p.sign  cor
      =/  =tank
        leaf+"Failed groups subscription in {<dap.bowl>}, unexpected"
      ((slog tank u.p.sign) cor)
    ::
        %fact
      ?.  =(act:mar:g p.cage.sign)  cor
      (take-groups !<(=action:g q.cage.sign))
    ==
  ::
      [%migrate ~]
    ?+  -.sign  !!
        %poke-ack
      ?~  p.sign  cor
      %-  (slog 'channels-server: migration poke failure' >wire< u.p.sign)
      cor
    ==
  ==
::
++  watch-groups  (safe-watch /groups [our.bowl %groups] /groups)
++  take-groups
  |=  =action:g
  =/  affected=(list nest:d)
    %+  murn  ~(tap by v-channels)
    |=  [=nest:d =diary:d]
    ?.  =(p.action group.perm.perm.diary)  ~
    `nest
  =/  diff  q.q.action
  ?+    diff  cor
      [%fleet * %del ~]
    ~&  "%channel-server: revoke perms for {<affected>}"
    %+  roll  affected
    |=  [=nest:d co=_cor]
    ^+  cor
    %+  roll  ~(tap in p.diff)
    |=  [=ship ci=_cor]
    ^+  cor
    =/  di  (di-abed:di-core:ci nest)
    di-abet:(di-revoke:di ship)
  ::
      [%fleet * %add-sects *]    (recheck-perms affected ~)
      [%fleet * %del-sects *]    (recheck-perms affected ~)
      [%channel * %edit *]       (recheck-perms affected ~)
      [%channel * %del-sects *]  (recheck-perms affected ~)
      [%channel * %add-sects *]  (recheck-perms affected ~)
      [%cabal * %del *]
    =/  =sect:g  (slav %tas p.diff)
    %+  recheck-perms  affected
    (~(gas in *(set sect:g)) ~[p.diff])
  ==
::
++  recheck-perms
  |=  [affected=(list nest:d) sects=(set sect:g)]
  ~&  "%channel-server recheck permissions for {<affected>}"
  %+  roll  affected
  |=  [=nest:d co=_cor]
  =/  di  (di-abed:di-core:co nest)
  di-abet:(di-recheck:di sects)
::
++  di-core
  |_  [=nest:d =diary:d gone=_|]
  +*  di-notes  ~(. not notes.diary)
  ++  di-core  .
  ++  emit  |=(=card di-core(cor (^emit card)))
  ++  emil  |=(caz=(list card) di-core(cor (^emil caz)))
  ++  give  |=(=gift:agent:gall di-core(cor (^give gift)))
  ++  di-perms  ~(. perms:utils our.bowl now.bowl nest group.perm.perm.diary)
  ++  di-abet
    %_  cor
        v-channels
      ?:(gone (~(del by v-channels) nest) (~(put by v-channels) nest diary))
    ==
  ::
  ++  di-abed
    |=  n=nest:d
    di-core(nest n, diary (~(got by v-channels) n))
  ::
  ++  di-area  `path`/[han.nest]/[name.nest]
  ++  di-sub-path  `path`(weld di-area /updates)
  ++  di-watch-create
    =/  =cage  [%channel-update !>([now.bowl %create perm.perm.diary])]
    (give %fact ~[/[han.nest]/[name.nest]/create] cage)
  ::
  ++  di-watch-updates
    |=  =@da
    ^+  di-core
    ?>  (can-read:di-perms src.bowl)
    =/  =log:d  (lot:log-on:d log.diary `da ~)
    =.  di-core  (give %fact ~ %channel-logs !>(log))
    di-core
  ::
  ++  di-watch-checkpoint
    |=  [from=@da to=(unit @da)]
    ^+  di-core
    ?>  (can-read:di-perms src.bowl)
    =/  =notes:d  (lot:on-notes:d notes.diary `from to)
    =/  chk=u-checkpoint:d  -.diary(notes notes)
    =.  di-core  (give %fact ~ %channel-checkpoint !>(chk))
    (give %kick ~ ~)
  ::
  ++  di-watch-checkpoint-page
    |=  n=@
    ^+  di-core
    ?>  (can-read:di-perms src.bowl)
    =/  =notes:d  (gas:on-notes:d *notes:d (bat:mo-notes:d notes.diary ~ n))
    =/  chk=u-checkpoint:d  -.diary(notes notes)
    =.  di-core  (give %fact ~ %channel-checkpoint !>(chk))
    (give %kick ~ ~)
  ::
  ++  di-create
    |=  [n=nest:d new=create-diary:d]
    ^+  di-core
    |^
    =.  nest  n
    ?:  (~(has by v-channels) n)
      %-  (slog leaf+"channel-server: create already exists: {<n>}" ~)
      di-core
    ?>  can-nest
    ?>  am-host:di-perms
    ?>  ((sane %tas) name.nest)
    =.  diary
      %*  .  *diary:d
        perm  [0 writers.new group.new]
      ==
    =.  di-core
      =/  =cage  [%channel-update !>([now.bowl %create perm.perm.diary])]
      =/  =path  /[han.nest]/[name.nest]/create
      =.  di-core  (give %fact ~[path] cage)
      (give %kick ~[path] ~)
    =/  =channel:g
      :-  [title description '' '']:new
      [now.bowl %default | readers.new]
    =/  =action:g
      [group.new now.bowl %channel nest %add channel]
    =/  =dock    [our.bowl %groups]
    =/  =wire    (snoc di-area %create)
    (emit %pass wire %agent dock %poke act:mar:g !>(action))
    ::
    ::  +can-nest: does group exist, are we allowed
    ::
    ++  can-nest
      ^-  ?
      =/  groups
        .^  groups:g
          %gx
          /(scot %p our.bowl)/groups/(scot %da now.bowl)/groups/noun
        ==
      =/  gop  (~(got by groups) group.new)
      %-  ~(any in bloc.gop)
      ~(has in sects:(~(got by fleet.gop) our.bowl))
    --
  ::
  ++  di-c-diary
    |=  =c-diary:d
    ^+  di-core
    ?>  am-host:di-perms
    ?-    -.c-diary
        %view
      ?>  (is-admin:di-perms src.bowl)
      =^  changed  view.diary  (next-rev:d view.diary view.c-diary)
      ?.  changed  di-core
      (di-update %view view.diary)
    ::
        %sort
      ?>  (is-admin:di-perms src.bowl)
      =^  changed  sort.diary  (next-rev:d sort.diary sort.c-diary)
      ?.  changed  di-core
      (di-update %sort sort.diary)
    ::
        %order
      ?>  (is-admin:di-perms src.bowl)
      =^  changed  order.diary  (next-rev:d order.diary order.c-diary)
      ?.  changed  di-core
      (di-update %order order.diary)
    ::
        %add-writers
      ?>  (is-admin:di-perms src.bowl)
      =/  new-writers  (~(uni in writers.perm.perm.diary) sects.c-diary)
      =^  changed  perm.diary
        (next-rev:d perm.diary new-writers group.perm.perm.diary)
      ?.  changed  di-core
      (di-update %perm perm.diary)
    ::
        %del-writers
      ?>  (is-admin:di-perms src.bowl)
      =/  new-writers  (~(dif in writers.perm.perm.diary) sects.c-diary)
      =^  changed  perm.diary
        (next-rev:d perm.diary new-writers group.perm.perm.diary)
      ?.  changed  di-core
      (di-update %perm perm.diary)
    ::
        %note
      =^  update=(unit u-diary:d)  notes.diary
        (di-c-note c-note.c-diary)
      ?~  update  di-core
      (di-update u.update)
    ==
  ::
  ++  di-c-note
    |=  =c-note:d
    ^-  [(unit u-diary:d) _notes.diary]
    ?>  (can-write:di-perms src.bowl writers.perm.perm.diary)
    ?-    -.c-note
        %add
      ?>  =(src.bowl author.essay.c-note)
      ?>  =(han.nest -.han-data.essay.c-note)
      =/  id=id-note:d
        |-
        =/  note  (get:on-notes:d notes.diary now.bowl)
        ?~  note  now.bowl
        $(now.bowl `@da`(add now.bowl ^~((div ~s1 (bex 16)))))
      =/  new=note:d  [[id ~ ~] 0 essay.c-note]
      :-  `[%note id %set ~ new]
      (put:on-notes:d notes.diary id ~ new)
    ::
        %edit
      ?>  =(src.bowl author.essay.c-note)
      ?>  =(han.nest -.han-data.essay.c-note)
      =/  note  (get:on-notes:d notes.diary id.c-note)
      ?~  note  `notes.diary
      ?~  u.note  `notes.diary
      ?>  =(src.bowl author.u.u.note)
      =/  new=note:d  [-.u.u.note +(rev.u.u.note) essay.c-note]
      :-  `[%note id.c-note %set ~ new]
      (put:on-notes:d notes.diary id.c-note ~ new)
    ::
        %del
      =/  note  (get:on-notes:d notes.diary id.c-note)
      ?~  note  `(put:on-notes:d notes.diary id.c-note ~)
      ?~  u.note  `notes.diary
      ?>  =(src.bowl author.u.u.note)
      :-  `[%note id.c-note %set ~]
      (put:on-notes:d notes.diary id.c-note ~)
    ::
        ?(%add-feel %del-feel)
      =/  note  (get:on-notes:d notes.diary id.c-note)
      ?~  note  `notes.diary
      ?~  u.note  `notes.diary
      =/  [update=? =feels:d]  (di-c-feel feels.u.u.note c-note)
      ?.  update  `notes.diary
      :-  `[%note id.c-note %feels feels]
      (put:on-notes:d notes.diary id.c-note ~ u.u.note(feels feels))
    ::
        %quip
      =/  note  (get:on-notes:d notes.diary id.c-note)
      ?~  note  `notes.diary
      ?~  u.note  `notes.diary
      =^  update=(unit u-note:d)  quips.u.u.note
        (di-c-quip quips.u.u.note c-quip.c-note)
      ?~  update  `notes.diary
      :-  `[%note id.c-note u.update]
      (put:on-notes:d notes.diary id.c-note ~ u.u.note)
    ==
  ::
  ++  di-c-quip
    |=  [=quips:d =c-quip:d]
    ^-  [(unit u-note:d) _quips]
    ?-    -.c-quip
        %add
      ?>  =(src.bowl author.memo.c-quip)
      =/  id=id-quip:d
        |-
        =/  quip  (get:on-quips:d quips now.bowl)
        ?~  quip  now.bowl
        $(now.bowl `@da`(add now.bowl ^~((div ~s1 (bex 16)))))
      =/  =cork:d  [id ~]
      :-  `[%quip id %set ~ cork memo.c-quip]
      (put:on-quips:d quips id ~ cork memo.c-quip)
    ::
        %del
      =/  quip  (get:on-quips:d quips id.c-quip)
      ?~  quip  `(put:on-quips:d quips id.c-quip ~)
      ?~  u.quip  `quips
      ?>  =(src.bowl author.u.u.quip)
      :-  `[%quip id.c-quip %set ~]
      (put:on-quips:d quips id.c-quip ~)
    ::
        ?(%add-feel %del-feel)
      =/  quip  (get:on-quips:d quips id.c-quip)
      ?~  quip  `quips
      ?~  u.quip  `quips
      =/  [update=? =feels:d]  (di-c-feel feels.u.u.quip c-quip)
      ?.  update  `quips
      :-  `[%quip id.c-quip %feels feels]
      (put:on-quips:d quips id.c-quip ~ u.u.quip(feels feels))
    ==
  ::
  ++  di-c-feel
    |=  [=feels:d =c-feel:d]
    ^-  [changed=? feels:d]
    =/  =ship     ?:(?=(%add-feel -.c-feel) p.c-feel p.c-feel)
    ?>  =(src.bowl ship)
    =/  new-feel  ?:(?=(%add-feel -.c-feel) `q.c-feel ~)
    =/  [changed=? new-rev=@ud]
      =/  old-feel  (~(get by feels) ship)
      ?~  old-feel  &+0
      ?:  =(new-feel +.u.old-feel)
        |+rev.u.old-feel
      &++(rev.u.old-feel)
    ?.  changed  [| feels]
    &+(~(put by feels) ship new-rev new-feel)
  ::
  ++  di-update
    |=  =u-diary:d
    ^+  di-core
    =/  time
      |-
      =/  quip  (get:log-on:d log.diary now.bowl)
      ?~  quip  now.bowl
      $(now.bowl `@da`(add now.bowl ^~((div ~s1 (bex 16)))))
    =/  =update:d  [time u-diary]
    =.  log.diary  (put:log-on:d log.diary update)
    (di-give-update update)
  ::
  ++  di-subscription-paths
    ^-  (list path)
    %+  skim  ~(tap in (~(gas in *(set path)) (turn ~(val by sup.bowl) tail)))
    |=  =path
    =((scag 3 path) di-sub-path)
  ::
  ++  di-give-update
    |=  =update:d
    ^+  di-core
    =/  paths  di-subscription-paths
    ?:  =(~ paths)
      di-core
    (give %fact paths %channel-update !>(update))
  ::
  ++  di-subscriptions
    ^-  (set [ship path])
    %+  roll  ~(val by sup.bowl)
    |=  [[=ship =path] out=(set [ship path])]
    ?.  =((scag 3 path) di-sub-path)
      out
    (~(put in out) [ship path])
  ::
  ++  di-migrate
    ^+  di-core
    =/  paths  di-subscription-paths
    %-  emil
    %+  turn  paths
    |=  =path
    =/  =log:d
      ?.  ?=([@ @ @ @ ~] path)  log.diary
      =/  after  (slaw %da i.t.t.t.path)
      ?~  after  log.diary
      (lot:log-on:d log.diary after ~)
    [%give %fact ~[path] %channel-logs !>(log)]
  ::
  ++  di-revoke
    |=  her=ship
    ^+  di-core
    %+  roll  ~(tap in di-subscriptions)
    |=  [[=ship =path] di=_di-core]
    ?.  =(ship her)  di
    (emit:di %give %kick ~[path] `ship)
  ::
  ++  di-recheck
    |=  sects=(set sect:g)
    ::  if we have sects, we need to delete them from writers
    =?  di-core  !=(sects ~)
      =/  =c-channels:d  [%diary nest %del-writers sects]
      =/  =cage  [%channel-command !>(c-channels)]
      (emit %pass di-area %agent [our.bowl dap.bowl] %poke cage)
    ::  if subs read permissions removed, kick
    %+  roll  ~(tap in di-subscriptions)
    |=  [[=ship =path] di=_di-core]
    ?:  (can-read:di-perms:di ship)  di
    (emit:di %give %kick ~[path] `ship)
  ::
  ++  di-said
    |=  =plan:d
    ^+  di-core
    =.  di-core
      %^  give  %fact  ~
      ?.  (can-read:di-perms src.bowl)
        channel-denied+!>(~)
      (said:utils nest plan notes.diary)
    (give %kick ~ ~)
  --
--

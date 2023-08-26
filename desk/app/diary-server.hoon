::  XX add /said subscriptions
/-  d=diary, g=groups
/-  e=epic
/+  default-agent, verb, dbug
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  +$  current-state
    $:  %0
        =shelf:d
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
      abet:(inflate-io:cor vase)
    [cards this]
  ::
  ++  on-save  !>([state okay:d])
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
+*  epos  ~(. epos-lib [bowl %diary-update okay:d])
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
  =+  !<([old=versioned-state cool=epic:e] vase)
  ?>  ?=(%0 -.old)
  =.  state  old
  (give %fact ~[/epic] epic+!>(okay:d))
  ::
  +$  versioned-state  $%(current-state)
  --
::
++  inflate-io
  (safe-watch /groups [our.bowl %groups] /groups)
::
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?+    mark  ~|(bad-poke+mark !!)
      %diary-command
    =+  !<(=c-shelf:d vase)
    ?-    -.c-shelf
        %create
      di-abet:(di-create:di-core [our.bowl name.c-shelf] create-diary.c-shelf)
    ::
        %diary
      =/  diary-core  (di-abed:di-core flag.c-shelf)
      di-abet:(di-c-diary:diary-core c-diary.c-shelf)
    ==
  ==
::
++  watch
  |=  =(pole knot)
  ^+  cor
  ?+    pole  ~|(bad-watch-path+pole !!)
      [%epic ~]  (give %fact ~ epic+!>(okay:d))
      [%diary name=@ %updates ~]
    ?>  (di-can-read:(di-abed:di-core our.bowl name.pole) src.bowl)
    cor
  ::
      [%diary name=@ %updates after=@ ~]
    =<  di-abet
    %-  di-watch-updates:(di-abed:di-core our.bowl name.pole)
    (slav %da after.pole)
  ::
      [%diary name=@ %notes %time-range from=@ ~]
    =<  di-abet
    (di-watch-notes:(di-abed:di-core our.bowl name.pole) (slav %da from.pole) ~)
  ::
      [%diary name=@ %notes %time-range from=@ to=@ ~]
    =<  di-abet
    %^  di-watch-notes:(di-abed:di-core our.bowl name.pole)
        (slav %da from.pole)
      ~
    (slav %da to.pole)
  ::
      [%diary name=@ %notes %before n=@ud ~]
    =<  di-abet
    (di-watch-note-page:(di-abed:di-core our.bowl name.pole) (slav %ud n.pole))
  ==
::
++  agent
  |=  [=(pole knot) =sign:agent:gall]
  ^+  cor
  ?+    pole  ~|(bad-agent-wire+pole !!)
      [%groups ~]
    ?+    -.sign  !!
        %kick       watch-groups
        %watch-ack
      ?~  p.sign
        cor
      =/  =tank
        leaf+"Failed groups subscription in {<dap.bowl>}, unexpected"
      ((slog tank u.p.sign) cor)
    ::
        %fact
      ?.  =(act:mar:g p.cage.sign)  cor
      (take-groups !<(=action:g q.cage.sign))
    ==
  ==
::
++  watch-groups  (safe-watch /groups [our.bowl %groups] /groups)
++  take-groups
  |=  =action:g
  =/  affected=(list flag:d)
    %+  murn  ~(tap by shelf)
    |=  [=flag:d =diary:d]
    ?.  =(p.action group.perm.perm.diary)  ~
    `flag
  =/  diff  q.q.action
  ?+    diff  cor
      [%fleet * %del ~]
    ~&  "%diary-server: revoke perms for {<affected>}"
    %+  roll  affected
    |=  [=flag:d co=_cor]
    ^+  cor
    %+  roll  ~(tap in p.diff)
    |=  [=ship ci=_cor]
    ^+  cor
    =/  di  (di-abed:di-core:ci flag)
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
  |=  [affected=(list flag:d) sects=(set sect:g)]
  ~&  "%diary-server recheck permissions for {<affected>}"
  %+  roll  affected
  |=  [=flag:d co=_cor]
  =/  di  (di-abed:di-core:co flag)
  di-abet:(di-recheck:di sects)
::
++  di-core
  |_  [=flag:d =diary:d gone=_|]
  +*  di-notes  ~(. not notes.diary)
  ++  di-core  .
  ++  emit  |=(=card di-core(cor (^emit card)))
  ++  emil  |=(caz=(list card) di-core(cor (^emil caz)))
  ++  give  |=(=gift:agent:gall di-core(cor (^give gift)))
  ++  di-abet
    %_  cor
        shelf
      ?:(gone (~(del by shelf) flag) (~(put by shelf) flag diary))
    ==
  ::
  ++  di-abed
    |=  f=flag:d
    di-core(flag f, diary (~(got by shelf) f))
  ::
  ++  di-apex
    |=  f=flag:d
    di-core(flag f, diary (~(gut by shelf) f *diary:d))
  ::
  ++  di-area  `path`/diary/(scot %p p.flag)/[q.flag]
  ++  di-am-host  =(our.bowl p.flag)
  ++  di-groups-scry
    ^-  path
    =*  group  group.perm.perm.diary
    :-  (scot %p our.bowl)
    /groups/(scot %da now.bowl)/groups/(scot %p p.group)/[q.group]
  ::
  ++  di-from-admin
    ?:  =(p.flag src.bowl)  &
    .^  admin=?
    ;:  weld
        /gx
        di-groups-scry
        /channel/[dap.bowl]/(scot %p p.flag)/[q.flag]
        /fleet/(scot %p src.bowl)/is-bloc/loob
    ==  ==
  ::
  ++  di-can-write
    ?:  =(p.flag src.bowl)  &
    =/  =path
      %+  welp  di-groups-scry
      /channel/[dap.bowl]/(scot %p p.flag)/[q.flag]/can-write/(scot %p src.bowl)/noun
    =+  .^(write=(unit [bloc=? sects=(set sect:g)]) %gx path)
    ?~  write  |
    =/  perms  (need write)
    ?:  |(bloc.perms =(~ writers.perm.perm.diary))  &
    !=(~ (~(int in writers.perm.perm.diary) sects.perms))
  ::
  ++  di-can-read
    |=  her=ship
    =/  =path
      %+  welp  di-groups-scry
      /channel/[dap.bowl]/(scot %p p.flag)/[q.flag]/can-read/(scot %p her)/loob
    .^(? %gx path)
  ::
  ++  di-give-update
    |=  =update:d
    (give %fact ~[/diary/[q.flag]] %diary-update !>(update))
  ::
  ++  di-watch-updates
    |=  =@da
    ^+  di-core
    ?>  (di-can-read src.bowl)
    =/  =log:d  (lot:log-on:d log.diary `da ~)
    =.  di-core  (give %fact ~ %diary-logs !>(log))
    di-core
  ::
  ++  di-watch-notes
    |=  [from=@da to=(unit @da)]
    ^+  di-core
    ?>  (di-can-read src.bowl)
    =/  =notes:d  (lot:on-notes:d notes.diary `from to)
    =.  di-core  (give %fact ~ %diary-notes !>(notes))
    (give %kick ~ ~)
  ::
  ++  di-watch-note-page
    |=  n=@
    ^+  di-core
    ?>  (di-can-read src.bowl)
    =/  =notes:d  (gas:on-notes:d *notes:d (bat:mo-notes:d notes.diary ~ n))
    =.  di-core  (give %fact ~ %diary-notes !>(notes))
    (give %kick ~ ~)
  ::
  ++  di-create
    |=  [f=flag:d new=create-diary:d]
    ^+  di-core
    |^
    =.  flag  f
    ?:  (~(has by shelf) f)
      %-  (slog leaf+"diary: create already exists: {<f>}" ~)
      di-core
    ?>  can-nest
    ?>  di-am-host
    ?>  ((sane %tas) q.flag)
    =.  diary
      %*  .  *diary:d
        perm  [0 writers.new group.new]
      ==
    =.  di-core  (di-give-update now.bowl %create perm.perm.diary)
    =/  =channel:g
      :-  [title description '' '']:new
      [now.bowl %default | readers.new]
    =/  =action:g
      [group.new now.bowl %channel [dap.bowl flag] %add channel]
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
    ?>  di-am-host
    ?-    -.c-diary
        %view
      ?>  di-from-admin
      =^  changed  view.diary  (next-rev:d view.diary view.c-diary)
      ?.  changed  di-core
      (di-update %view view.diary)
    ::
        %sort
      ?>  di-from-admin
      =^  changed  sort.diary  (next-rev:d sort.diary sort.c-diary)
      ?.  changed  di-core
      (di-update %sort sort.diary)
    ::
        %order
      ?>  di-from-admin
      =^  changed  order.diary  (next-rev:d order.diary order.c-diary)
      ?.  changed  di-core
      (di-update %order order.diary)
    ::
        %add-writers
      ?>  di-from-admin
      =/  new-writers  (~(uni in writers.perm.perm.diary) sects.c-diary)
      =^  changed  perm.diary
        (next-rev:d perm.diary new-writers group.perm.perm.diary)
      ?.  changed  di-core
      (di-update %perm perm.diary)
    ::
        %del-writers
      ?>  di-from-admin
      =/  new-writers  (~(dif in writers.perm.perm.diary) sects.c-diary)
      =^  changed  perm.diary
        (next-rev:d perm.diary new-writers group.perm.perm.diary)
      ?.  changed  di-core
      (di-update %perm perm.diary)
    ::
        %notes
      =^  update=(unit u-diary:d)  notes.diary
        (di-c-note c-note.c-diary)
      ?~  update  di-core
      (di-update u.update)
    ==
  ::
  ++  di-c-note
    |=  =c-note:d
    ^-  [(unit u-diary:d) _notes.diary]
    ?>  di-can-write
    ?-    -.c-note
        %add
      ?>  =(src.bowl author.essay.c-note)
      =/  id=id-note:d
        |-
        =/  note  (get:on-notes:d notes.diary now.bowl)
        ?~  note  now.bowl
        $(now.bowl `@da`(add now.bowl ^~((div ~s1 (bex 16)))))
      =/  new=note:d  [[now.bowl ~ ~] 0 essay.c-note]
      :-  `[%notes id %set ~ new]
      (put:on-notes:d notes.diary id ~ new)
    ::
        %edit
      ?>  =(src.bowl author.essay.c-note)
      =/  note  (get:on-notes:d notes.diary id.c-note)
      ?~  note  `notes.diary
      ?~  u.note  `notes.diary
      ?>  =(src.bowl author.u.u.note)
      =/  new=note:d  [-.u.u.note +(rev.u.u.note) essay.c-note]
      :-  `[%notes id.c-note %set ~ new]
      (put:on-notes:d notes.diary id.c-note ~ new)
    ::
        %del
      =/  note  (get:on-notes:d notes.diary id.c-note)
      ?~  note  `(put:on-notes:d notes.diary id.c-note ~)
      ?~  u.note  `notes.diary
      ?>  =(src.bowl author.u.u.note)
      :-  `[%notes id.c-note %set ~]
      (put:on-notes:d notes.diary id.c-note ~)
    ::
        ?(%add-feel %del-feel)
      =/  note  (get:on-notes:d notes.diary id.c-note)
      ?~  note  `notes.diary
      ?~  u.note  `notes.diary
      =/  [update=? =feels:d]  (di-c-feel feels.u.u.note c-note)
      ?.  update  `notes.diary
      :-  `[%notes id.c-note %feels feels]
      (put:on-notes:d notes.diary id.c-note ~ u.u.note(feels feels))
    ::
        %quips
      =/  note  (get:on-notes:d notes.diary id.c-note)
      ?~  note  `notes.diary
      ?~  u.note  `notes.diary
      =^  update=(unit u-note:d)  quips.u.u.note
        (di-c-quip quips.u.u.note c-quip.c-note)
      ?~  update  `notes.diary
      :-  `[%notes id.c-note u.update]
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
      =/  =cork:d  [now.bowl ~]
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
  ++  di-subscriptions
    %+  roll  ~(val by sup.bowl)
    |=  [[=ship =path] out=(set [ship path])]
    ?.  =((scag 4 path) (snoc di-area %updates))
      out
    (~(put in out) [ship path])
  ::
  ++  di-revoke
    |=  her=ship
    %+  roll  ~(tap in di-subscriptions)
    |=  [[=ship =path] di=_di-core]
    ?.  =(ship her)  di
    di(cor (emit %give %kick ~[path] `ship))
  ::
  ++  di-recheck
    |=  sects=(set sect:g)
    ::  if we have sects, we need to delete them from writers
    =?  cor  &(!=(sects ~) =(p.flag our.bowl))
      =/  =cage  [act:mar:d !>([flag now.bowl %del-sects sects])]
      (emit %pass di-area %agent [our.bowl dap.bowl] %poke cage)
    ::  if subs read permissions removed, kick
    %+  roll  ~(tap in di-subscriptions)
    |=  [[=ship =path] di=_di-core]
    ?:  (di-can-read:di ship)  di
    di(cor (emit %give %kick ~[path] `ship))
  --
--

/-  boards, g=groups
/+  n=nectar, q=quorum, j=quorum-json
/+  verb, dbug
/+  *sss
/+  default-agent
^-  agent:gall
=>
  |%
  +$  state-0
    $:  %0
        our-boards=(map flag:q board:q)    ::  synchronized state
        all-remarks=(map flag:q remark:q)  ::  local state
        sub-boards=_(mk-subs boards ,[%quorum %updates @ @ ~])
        pub-boards=_(mk-pubs boards ,[%quorum %updates @ @ ~])
    ==
  +$  versioned-state
    $%  state-0
    ==
  +$  card  card:agent:gall
  ++  search  (cury seek ~[[%score %&] [%act-date %&]])
  ++  quest   (cury seek ~[[%best %|] [%pub-date %&] [%score %&]])
  ++  seek
    |=  [order=(lest spec:order:q) index=@ud posts=(list post:q)]
    ^-  page:q
    (flip index (sort:poast:q order posts))
  ++  flip
    =/  pag-len=@ud  20
    |*  [pag=@ud lis=(list)]
    =/  lis-len=@ud  (lent lis)
    :-  (scag pag-len (slag (mul pag pag-len) lis))
    %+  add  (div lis-len pag-len)
    =(0 (mod lis-len pag-len))
  --
=|  state-0
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
  ++  on-watch
    |=  =path
    ^-  (quip card _this)
    =^  cards  state
      abet:(watch:cor path)
    [cards this]
  ::
  ++  on-peek   peek:cor
  ::
  ++  on-leave   on-leave:def
  ++  on-fail    on-fail:def
  ::
  ++  on-agent
    |=  [=wire =sign:agent:gall]
    ^-  (quip card _this)
    =^  cards  state
      abet:(agent:cor wire sign)
    [cards this]
  ::
  ++  on-arvo
    |=  [=wire sign=sign-arvo]
    ^-  (quip card _this)
    =^  cards  state
      abet:(arvo:cor wire sign)
    [cards this]
  --
|_  [=bowl:gall cards=(list card)]
::
+*  da-boards  =/  da  (da boards ,[%quorum %updates @ @ ~])
               (da sub-boards bowl -:!>(*result:da) -:!>(*from:da) -:!>(*fail:da))
    du-boards  =/  du  (du boards ,[%quorum %updates @ @ ~])
               (du pub-boards bowl -:!>(*result:du))
::
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
++  pull  |=([caz=(list card) sub=_sub-boards] =.(sub-boards sub (emil caz)))
++  push  |=([caz=(list card) pub=_pub-boards] =.(pub-boards pub (emil caz)))
::
++  init
  ^+  cor
  watch-groups
::
++  load
  |=  =vase
  ^+  cor
  =/  old  !<(versioned-state vase)
  %=    cor
      state
    ?-  -.old
      %0  old
    ==
  ==
::
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?+    mark  ~|(bad-poke/mark !!)
  :: %groups pokes ::
      %quorum-create
    =+  !<(req=create:q vase)
    |^  ^+  cor
    ~_  leaf+"Create failed: check group permissions"
    ?>  =(our.bowl src.bowl)  ::  only accept creates from local ship
    ?>  can-nest
    ?>  ((sane %tas) name.req)
    =/  =flag:q  [our.bowl name.req]
    ?<  (~(has by our-boards) flag)  ::  can't re-create a board
    =.  our-boards  (~(put by our-boards) flag *board:q)
    bo-abet:(bo-init:(bo-abed:bo-core flag) req)
    ++  can-nest  ::  does group exist, are we allowed
      ^-  ?
      =/  gop  (~(got by groups) group.req)
      %-  ~(any in bloc.gop)
      ~(has in sects:(~(got by fleet.gop) our.bowl))
    ++  groups  ::  all groups on this ship
      .^  groups:g
        %gx
        /(scot %p our.bowl)/groups/(scot %da now.bowl)/groups/noun
      ==
    --
  ::
      %channel-join
    =+  !<(j=join:q vase)
    ^+  cor
    ?:  =(our.bowl src.bowl)  ::  we're initiating a join on a remote ship
      ?<  =(our.bowl p.chan.j)  ::  cannot join board we host
      ?<  (~(has by all-boards) chan.j)  ::  must not be in board to join
      bo-abet:(bo-request-join:(bo-abed:bo-core chan.j) j)
    ?:  =(our.bowl p.chan.j)  ::  remote ship's asking to join a local channel
      ?>  (~(has by our-boards) chan.j)  ::  local must have requested channel
      bo-abet:(bo-respond-join:(bo-abed:bo-core chan.j) j)
    ~|(bad-channel-join/j !!)
  ::
      %quorum-leave
    =+  !<(l=leave:q vase)
    ^+  cor
    ?>  =(our.bowl src.bowl)  ::  only accept leaves from local ship
    ?<  =(our.bowl p.l)  ::  cannot leave board we host
    ?>  (~(has by all-boards) l)  ::  must be in board to leave
    bo-abet:bo-leave:(bo-abed:bo-core l)
  ::
      %quorum-remark-action
    =+  !<(act=remark-action:q vase)
    ?>  =(our.bowl src.bowl)  ::  only accept remarks from local ship
    bo-abet:(bo-remark-diff:(bo-abed:bo-core p.act) q.act)
  :: native pokes ::
      %quorum-action
    =+  !<(=action:q vase)
    ?>  (~(has by all-boards) p.action)
    =/  board-core  (bo-abed:bo-core p.action)
    ?:  =(p.p.action our.bowl)
      bo-abet:(bo-push:board-core q.action)
    bo-abet:(bo-proxy:board-core q.action)
  ::
      %quorum-import
    =+  !<(=import:q vase)
    ?>  =(our.bowl src.bowl)  ::  only accept imports from local ship
    ?>  =(%atom (rear path.import))
    ?>  (~(has by our-boards) flag.import)
    =+  ;;(upds=(list [@p @da update:q]) (cue .^(@ %cx path.import)))
    ?>  =/  upd-cmds  (silt `(list term)`(turn upds |=([* * u=update:q] -.u)))
        =/  gud-cmds  (silt `(list term)`~[%new-thread %new-reply %edit-thread %vote])
        =(0 ~(wyt in (~(dif in upd-cmds) gud-cmds)))  ::  only accept expected insert cmds
    =/  id-offset=@  (dec next-id:metadata:(~(got by our-boards) flag.import))
    %+  roll  upds
    |=  [[who=@p wen=@da =update:q] co=_cor]
    =.  co  co(bowl bowl.co(src who, now wen))
    =?  update  ?=(?(%new-reply %edit-thread %vote) -.update)
      update(+< (add id-offset +<.update))
    =?  update  ?=(?(%edit-thread) -.update)
      update(best-id (bind best-id.update |=(id=@ (add id-offset id))))
    =/  bo  (bo-abed:bo-core:co flag.import)
    bo-abet:(bo-unsafe-push:bo update)
  :: sss pokes ::
      %sss-on-rock
    ?-  msg=!<(from:da-boards (fled vase))
      [[%quorum *] *]  cor
    ==
  ::
      %sss-fake-on-rock
    ?-  msg=!<(from:da-boards (fled vase))
      [[%quorum *] *]  (emil (handle-fake-on-rock:da-boards msg))
    ==
  ::
      %sss-to-pub
    ?-  msg=!<(into:du-boards (fled vase))
      [[%quorum *] *]  (push (apply:du-boards msg))
    ==
  ::
      %sss-boards
    =/  res  !<(into:da-boards (fled vase))
    =/  =flag:q  [`@p`(slav %p +>-.path.res) `@tas`(slav %tas +>+<.path.res)]
    bo-abet:(bo-pull:(bo-abed:bo-core flag) res)
  ==
::
++  watch
  |=  path=(pole knot)
  ^+  cor
  ?+    path  ~|(bad-watch-path/path !!)
      [%briefs ~]               ?>(from-self cor)
      [?(%meta %search) %ui ~]  ?>(from-self cor)
  ::
      [%quorum ship=@ name=@ path=*]
    =/  ship=@p    (slav %p ship.path)
    =/  name=term  (slav %tas name.path)
    bo-abet:(bo-watch:(bo-abed:bo-core ship name) path.path)
  ==
::
++  peek
  |=  path=(pole knot)
  ^-  (unit (unit cage))
  =/  all-boards=(map flag:q board:q)  all-boards
  ?+    path  [~ ~]
      [%x %boards ~]
    ``quorum-metadatas+!>((turn ~(val by all-boards) |=(b=board:q metadata.b)))
  ::
      [%x %briefs ~]
    =/  briefs=briefs:q
      %-  ~(gas by *briefs:q)
      %+  turn  ~(tap in ~(key by all-boards))
      |=(=flag:q [flag bo-brief:(bo-abed:bo-core flag)])
    ``quorum-briefs+!>(briefs)
  ::
      [%x %search index=@ query=@ ~]
    =/  index=@ud  (slav %ud index.path)
    =/  query=@t   (slav %t query.path)
    =/  posts=(list post:q)
      %-  zing
      %+  turn  ~(val by all-boards)
      |=(b=board:q (~(search via:q b) query))
    ``quorum-page+!>((search index posts))
  ::
      [%x %quorum ship=@ name=@ path=*]
    =/  ship=@p    (slav %p ship.path)
    =/  name=term  (slav %tas name.path)
    ?>  (~(has by all-boards) ship name)
    (bo-peek:(bo-abed:bo-core ship name) path.path)
  ::
      [%u %quorum ship=@ name=@ ~]
    =/  ship=@p    (slav %p ship.path)
    =/  name=term  (slav %tas name.path)
    ``loob+!>((~(has by all-boards) [ship name]))
  ==
::
++  agent
  |=  [path=(pole knot) =sign:agent:gall]
  ^+  cor
  ?+    path  cor
      [~ %sss %on-rock @ @ @ %quorum %updates @ @ ~]
    (pull ~ (chit:da-boards |3:path sign))
  ::
      [~ %sss %scry-request @ @ @ %quorum %updates @ @ ~]
    (pull (tell:da-boards |3:path sign))
  ::
      [~ %sss %scry-response @ @ @ %quorum %updates @ @ ~]
    (push (tell:du-boards |3:path sign))
  ::
      [%quorum ship=@ name=@ path=*]
    =/  ship=@p    (slav %p ship.path)
    =/  name=term  (slav %tas name.path)
    bo-abet:(bo-agent:(bo-abed:bo-core ship name) path.path sign)
  ::
      [%groups ~]
    ?+    -.sign  !!
        %kick
      watch-groups
    ::
        %watch-ack
      ?~  p.sign  cor
      =/  =tank
        leaf/"Failed groups subscription in {<dap.bowl>}, unexpected"
      ((slog tank u.p.sign) cor)
    ::
        %fact
      ?.  =(act:mar:g p.cage.sign)  cor
      (take-groups !<(=action:g q.cage.sign))
    ==
  ==
::
++  arvo
  |=  [path=(pole knot) sign=sign-arvo]
  ^+  cor
  cor
::
++  give-brief
  |=  [=flag:q =brief:briefs:q]
  ^+  cor
  (give %fact ~[/briefs] quorum-brief-update+!>([flag brief]))
::
++  watch-groups
  ^+  cor
  (emit %pass /groups %agent [our.bowl %groups] %watch /groups)
::
++  take-groups
  |=  =action:g
  ^+  cor
  =/  affected=(list flag:q)
    %+  murn  ~(tap by all-boards)
    |=  [=flag:q =board:q]
    ?.  =(p.action group.perm.metadata.board)  ~
    `flag
  =/  =diff:g  q.q.action
  ?+    diff  cor
      [%fleet * %del ~]
    ~&  "%quorum: revoke perms for {<affected>}"
    %+  roll  affected
    |=  [=flag:q co=_cor]
    =/  bo  (bo-abed:bo-core:co flag)
    bo-abet:(bo-revoke:bo ~(tap in p.diff))
  ::
    [%fleet * %add-sects *]    (recheck-perms affected ~)
    [%fleet * %del-sects *]    (recheck-perms affected ~)
    [%channel * %edit *]       (recheck-perms affected ~)
    [%channel * %del-sects *]  (recheck-perms affected ~)
    [%channel * %add-sects *]  (recheck-perms affected ~)
  ::
      [%cabal * %del *]
    =/  =sect:g  (slav %tas p.diff)
    %+  recheck-perms  affected
    (~(gas in *(set sect:g)) ~[p.diff])
  ==
::
++  recheck-perms
  |=  [affected=(list flag:q) sects=(set sect:g)]
  ~&  "%quorum: recheck permissions for {<affected>}"
  %+  roll  affected
  |=  [=flag:q co=_cor]
  =/  bo  (bo-abed:bo-core:co flag)
  bo-abet:(bo-recheck:bo sects)
::
++  from-self  =(our src):bowl
::
++  all-boards
  ^-  (map flag:q board:q)
  %-  ~(uni by our-boards)
  %-  malt
  ^-  (list [flag:q board:q])
  %+  turn  ~(tap by read:da-boards)
  |=([* [stale=? fail=? =board:q]] [board.metadata.board board])
::
++  bo-core
  |_  [=flag:q =board:q =remark:q gone=_|]
  ++  bo-core  .
  ++  bo-abet
    ::  NOTE: If we're operating on an invalid/placeholder board (e.g.
    ::  during `+bo-request-join`), don't save anything during `+bo-abet`.
    ?:  =(0 next-id.metadata.board)  cor
    %_    cor
        all-remarks
      ?:(gone (~(del by all-remarks) flag) (~(put by all-remarks) flag remark))
    ::
        our-boards
      ?.  bo-iam-host
        our-boards
      ?:(gone (~(del by our-boards) flag) (~(put by our-boards) flag board))
    ==
  ++  bo-abed
    |=  f=flag:q
    %=  bo-core
      flag    f
      board   (~(gut by all-boards) f *board:q)
      remark  (~(gut by all-remarks) f *remark:q)
    ==
  ++  bo-area  `path`/quorum/(scot %p p.flag)/[q.flag]
  ++  bo-up-area  |=(p=path `(list path)`~[p (welp bo-area p)])
  ++  bo-du-path  [%quorum %updates (scot %p p.flag) q.flag ~]
  ++  bo-da-path  [p.flag dap.bowl %quorum %updates (scot %p p.flag) q.flag ~]
  ::
  ++  bo-groups-scry
    =*  group  group.perm.metadata.board
    /(scot %p our.bowl)/groups/(scot %da now.bowl)/groups/(scot %p p.group)/[q.group]
  ::
  ++  bo-iam-host  =(p.flag our.bowl)
  ++  bo-can-admin  |(=(p.flag src.bowl) =(p.group.perm.metadata.board src.bowl))
  ++  bo-can-write
    ?:  =(p.flag src.bowl)  &
    =/  =path
      %+  welp  bo-groups-scry
      /channel/[dap.bowl]/(scot %p p.flag)/[q.flag]/can-write/(scot %p src.bowl)/noun
    =+  .^(write=(unit [bloc=? sects=(set sect:g)]) %gx path)
    ?~  write  |
    =/  perms  (need write)
    ?:  |(bloc.perms =(~ writers.perm.metadata.board))  &
    !=(~ (~(int in writers.perm.metadata.board) sects.perms))
  ::
  ++  bo-can-read
    |=  her=ship
    =/  =path
      %+  welp  bo-groups-scry
      /channel/[dap.bowl]/(scot %p p.flag)/[q.flag]/can-read/(scot %p her)/loob
    .^(? %gx path)
  ++  bo-groups-channel
    ^-  channel:g
    =/  =path  /(scot %p our.bowl)/groups/(scot %da now.bowl)/groups/light/noun
    =+  .^(=groups:g %gx path)
    =/  =group:g  (~(got by groups) group.perm.metadata.board)
    (~(got by channels.group) [dap.bowl flag])
  ::
  ++  bo-pass
    |%
    ++  writer-sect
      |=  [ships=(set ship) =association:met:q]
      =/  =sect:g
        (rap 3 %quorum '-' (scot %p p.flag) '-' q.flag ~)
      =/  title=@t
        (rap 3 'Writers: ' title.metadatum.association ~)
      =/  desc=@t
        (rap 3 'The writers role for the ' title.metadatum.association ' notebook' ~)
      %+  poke-group  %import-writers
      :+  group.association   now.bowl
      [%cabal sect %add title desc '' '']
    ::
    ++  poke-group
      |=  [=term =action:g]
      ^+  bo-core
      =/  =dock      [our.bowl %groups] :: [p.p.action %groups] XX: check?
      =/  =wire      (snoc bo-area term)
      =.  cor
        (emit %pass wire %agent dock %poke act:mar:g !>(action))
      bo-core
    ::
    ++  create-channel
      |=  [=term group=flag:g =channel:g]
      ^+  bo-core
      %+  poke-group  term
      ^-  action:g
      :+  group  now.bowl
      [%channel [dap.bowl flag] %add channel]
    ::
    ++  import-channel
      |=  =association:met:q
      =/  meta=data:meta:g
        [title description '' '']:metadatum.association
      (create-channel %import group.association meta now.bowl zone=%default %| ~)
    ::
    ++  add-channel
      |=  req=create:q
      %+  create-channel  %create
      [group.req =,(req [[title description '' ''] now.bowl %default %| readers])]
    ::
    --
  ::
  ++  bo-init
    |=  req=create:q
    =/  upd=update:q  =,(req [%new-board group ~(tap in writers) title description ~])
    =.  bo-core  (bo-push upd)
    ::  NOTE: Uncomment for testing of instant/always rocks.
    ::  =.  cor  (push ~ (rule:du-boards bo-du-path `1 1))
    =.  cor  (push (secret:du-boards [bo-du-path]~))
    =.  last-read.remark  next-id.metadata.board
    (add-channel:bo-pass req)
  ::
  ++  bo-brief
    [last=last-read.remark count=(sub next-id.metadata.board last-read.remark)]
  ::
  ++  bo-peek
    |=  path=(pole knot)
    ^-  (unit (unit cage))
    ?+    path  [~ ~]
        [%metadata ~]
      ``quorum-metadata+!>(metadata.board)
    ::
        [%perm ~]
      ``quorum-perm+!>(perm.metadata.board)
    ::
        [%questions index=@ ~]
      =/  index=@ud  (slav %ud index.path)
      ``quorum-page+!>((quest index ~(threads via:q board)))
    ::
        [%search index=@ query=@ ~]
      =/  index=@ud  (slav %ud index.path)
      =/  query=@t   (slav %t query.path)
      ``quorum-page+!>((search index (~(search via:q board) query)))
    ::
        [%thread post-id=@ ~]
      =/  post-id=@ud  (slav %ud post-id.path)
      ``quorum-thread+!>((~(threadi via:q board) post-id))
    ==
  ::
  ++  bo-watch
    |=  path=(pole knot)
    ^+  bo-core
    ?+    path  ~|(bad-watch-path/path !!)
        [?(%meta %search) %ui ~]
      ?>(from-self bo-core)
    ::
        [%thread post-id=@ %ui ~]
      =/  post-id=@ud  (slav %ud post-id.path)
      ?>(from-self bo-core)
    ==
  ::
  ++  bo-agent
    |=  [path=(pole knot) =sign:agent:gall]
    ^+  bo-core
    ?+    path  !!
        ~                                         ::  `+bo-proxy` response
      ?>  ?=(%poke-ack -.sign)
      ?~  p.sign  bo-core
      %-  (slog u.p.sign)
      bo-core
    ::
        [%create ~]                               ::  `+bo-init` response
      ?>  ?=(%poke-ack -.sign)
      %.  bo-core  :: TODO rollback creation if poke fails?
      ?~  p.sign  same
      (slog leaf/"groups create poke failed" u.p.sign)
    ::
        [%edit ~]                               ::  `+bo-proxy` edit response
      ?>  ?=(%poke-ack -.sign)
      %.  bo-core  :: TODO rollback edit if poke fails?
      ?~  p.sign  same
      (slog leaf/"groups edit poke failed" u.p.sign)
    ::
        [%join ~]                                 ::  `+bo-request-join` response
      ?>  ?=(%poke-ack -.sign)
      ?~  p.sign
        ::  NOTE: Don't need to notify or give briefs; this is handled
        ::  by SSS updates.
        =.  cor  (pull (surf:da-boards bo-da-path))
        bo-core
      ((slog leaf/"quorum join poke failed" u.p.sign) bo-core)
    ==
  ::
  ++  bo-request-join
    |=  j=join:q
    ^+  bo-core
    =/  =dock  [p.flag dap.bowl]
    =/  =cage  [%channel-join !>(j)]
    =.  cor  (emit %pass (snoc bo-area %join) %agent dock %poke cage)
    bo-core
  ::
  ++  bo-respond-join
    |=  j=join:q
    ^+  bo-core
    ?>  (bo-can-read src.bowl)
    =.  cor  (push (allow:du-boards [src.bowl]~ [bo-du-path]~))
    bo-core
  ::
  ++  bo-leave
    ^+  bo-core
    =.  bo-core  (bo-notify [%delete-board ~])
    =.  cor  (pull ~ (quit:da-boards bo-da-path))
    =.  cor  (emit %give %fact ~[/briefs] quorum-leave+!>(flag))
    bo-core(gone &)
  ::
  ++  bo-revoke
    |=  bad-ships=(list ship)
    ^+  bo-core
    ?.  bo-iam-host
      ?~  (find ~[our.bowl] bad-ships)  bo-core
      bo-leave
    bo-core(cor (push (block:du-boards bad-ships [bo-du-path]~)))
  ::
  ++  bo-recheck
    |=  sects=(set sect:g)
    ^+  bo-core
    ?.  bo-iam-host
      ::  if our read permissions restored, re-subscribe
      ?.  (bo-can-read our.bowl)  bo-core
      (bo-request-join [group.perm.metadata.board flag])
    ::  if we have sects, we need to delete them from writers
    =?  cor  !=(sects ~)
      =/  =cage  [%quorum-action !>([flag %del-sects sects])]
      (emit %pass bo-area %agent [our.bowl dap.bowl] %poke cage)
    ::  if subs read permissions removed, kick
    =/  [all-ships=(unit (set ship)) *]  (~(got by read:du-boards) bo-du-path)
    ?>  ?=(^ all-ships)
    =/  bad-ships=(list ship)
      %+  murn  ~(tap in u.all-ships)
      |=(=ship ?:((bo-can-read ship) ~ `ship))
    bo-core(cor (push (block:du-boards bad-ships [bo-du-path]~)))
  ::
  ++  bo-remark-diff
    |=  diff=remark-diff:q
    ^+  bo-core
    =.  cor  (give %fact (bo-up-area /meta/ui) quorum-remark-action+!>([flag diff]))
    =.  remark
      ?-  -.diff
        %read     remark(last-read next-id.metadata.board)
        %watch    !!  ::  remark(watching &)
        %unwatch  !!  ::  remark(watching |)
        %read-at  !!
      ==
    =.  cor  (give-brief flag bo-brief)
    bo-core
  ++  bo-notify
    |=  =update:q
    ^+  bo-core
    =-  bo-core(cor (give %fact - %json !>((action:enjs:j flag update))))
    ^-  (list path)
    %+  welp  (bo-up-area /search/ui)
    ?+    -.update  (bo-up-area /meta/ui)
        ?(%new-thread %edit-thread %new-reply %edit-post %delete-post %vote)
      =-  [(welp bo-area /thread/(scot %ud post-id.-)/ui)]~
      ?+  -.update    (~(root via:q board) +<.update)
        %delete-post  (~(root via:q board) post-id.update)
        %new-thread   =+(p=*post:q p(post-id next-id.metadata.board))
      ==
    ==
  ++  bo-proxy
    |=  =update:q
    ^+  bo-core
    ?>  bo-can-write
    =/  =dock  [p.flag dap.bowl]
    =/  =cage  [%quorum-action !>([flag update])]
    =.  cor  (emit %pass bo-area %agent dock %poke cage)
    bo-core
  ++  bo-pull
    |=  res=into:da-boards
    ^+  bo-core
    =/  =update:q
      ?-  what.res
        %tomb  [%delete-board ~]
        %wave  q.act.wave.res
        %rock  =,  metadata.rock.res
               :*  %new-board  group.perm  ~(tap in writers.perm)
                   title  description  ~(tap in allowed-tags)
      ==       ==
    ?:  ?=(%delete-board -.update)
      bo-leave
    ::  NOTE: Notify *before* state change to avoid errors during deletions.
    =.  bo-core  (bo-notify update)
    =.  cor  (pull (apply:da-boards res))
    =?  cor  ?=(?(%new-board %new-thread %new-reply) -.update)
      (give-brief flag bo-brief)
    bo-core
  ++  bo-push
    |=  =update:q
    ^+  bo-core
    ?>  bo-can-write
    ::  NOTE: Assert that we're the host if we're doing an admin action.
    ?<  &(?=(?(%new-board %delete-board %add-sects %del-sects) -.update) !bo-can-admin)
    (bo-unsafe-push update)
  ++  bo-unsafe-push
    |=  =update:q
    ^+  bo-core
    ::  NOTE: Notify *before* state change to avoid errors during deletions.
    =.  bo-core  (bo-notify update)
    ?:  ?=(%delete-board -.update)
      =.  cor  (push (kill:du-boards [bo-du-path]~))
      =.  cor  (emit %give %fact ~[/briefs] quorum-leave+!>(flag))
      bo-core(gone &)
    =.  board  (apply:q board bowl [flag update])
    =.  cor  (push (give:du-boards bo-du-path bowl [flag update]))
    =?  cor  ?=(?(%new-board %new-thread %new-reply) -.update)
      (give-brief flag bo-brief)
    ::  TODO: This is a bit hacky and gross, and should be removed by
    ::  tighter metadata integration if possible.
    ?:  ?=(%edit-board -.update)
      ?~  (both title.update description.update)
        bo-core
      =/  act=action:g
        :*  group.perm.metadata.board  now.bowl
            %channel  [dap.bowl flag]  %edit
            =/  =channel:g  bo-groups-channel
            channel(meta [title.metadata.board description.metadata.board '' ''])
        ==
      =/  =dock  [p.flag %groups]
      =/  =cage  [act:mar:g !>(act)]
      bo-core(cor (emit %pass (snoc bo-area %edit) %agent dock %poke cage))
    bo-core
  --
--

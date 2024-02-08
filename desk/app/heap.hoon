/-  h=heap, c=channels, g=groups, ha=hark, e=epic, c2=chat-2
/-  meta
/+  default-agent, verb, dbug
/+  cur=curios
/+  volume, cutils=channel-utils
/+  epos-lib=saga
::  performance, keep warm
/+  heap-json
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  +$  current-state
    $:  %1
        =stash:h
        voc=(map [flag:h time] (unit said:h))
        ::  true represents imported, false pending import
        imp=(map flag:h ?)
        hidden-curios=(set time)
    ==
  ::
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
  ++  on-save  !>([state okay:h])
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
  ++  on-arvo
    |=  [=wire sign=sign-arvo]
    ^-  (quip card _this)
    =^  cards  state
      abet:(arvo:cor wire sign)
    [cards this]
  --
|_  [=bowl:gall cards=(list card)]
+*  epos  ~(. epos-lib [bowl %heap-update okay:h])
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
++  init
  ^+  cor
  watch-groups
::
++  watch-groups
  ^+  cor
  (emit %pass /groups %agent [our.bowl %groups] %watch /groups)
::
++  poke
  |=  [=mark =vase]
  |^  ^+  cor
  ?+    mark  ~|(bad-poke/mark !!)
  ::
      %flag
    =+  !<(f=flag:h vase)
    ?<  =(our.bowl p.f)
    (join [*flag:g f])
  ::
      %channel-join
    =+  !<(j=join:h vase)
    ?<  =(our.bowl p.chan.j)
    (join j)
  ::
      ?(%channel-leave %heap-leave)
    =+  !<(=leave:h vase)
    ?<  =(our.bowl p.leave)  :: cannot leave chat we host
    he-abet:he-leave:(he-abed:he-core leave)
  ::
      %post-toggle
    =+  !<(toggle=post-toggle:c vase)
    ?>  from-self
    (toggle-curio toggle)
  ::
      %leave-old-channels
    =/  groups-path  /(scot %p our.bowl)/groups/(scot %da now.bowl)/groups/noun
    =/  groups  .^(groups:g %gx groups-path)
    =/  heap-flags-from-groups
      %+  turn  ~(tap by groups)
      |=  [group-flag=flag:g group=group:g]
      %+  turn
        %+  skim  ~(tap by channels.group)
        |=  [=nest:g *]
        ?:(=(%heap p.nest) %.y %.n)
      |=  [=nest:g *]
      q.nest
    =/  heaps-without-groups
      %+  skim  ~(tap by stash)
      |=  [=flag:g *]
      ?:(=((find [flag]~ (zing heap-flags-from-groups)) ~) %.y %.n)
    %+  roll
      heaps-without-groups
    |=  [[=flag:g *] core=_cor]
    he-abet:he-leave:(he-abed:he-core:core flag)
  ::
     %recheck-all-perms
    %+  roll
      ~(tap by stash)
    |=  [[=flag:h *] core=_cor]
    =/  he  (he-abed:he-core:core flag)
    he-abet:(he-recheck:he ~)
  ::
      %heap-create
    =+  !<(req=create:h vase)
    (create req)
  ::
      ?(%heap-action-0 %heap-action)
    =+  !<(=action:h vase)
    =/  heap-core  (he-abed:he-core p.action)
    ?:  =(p.p.action our.bowl)
      he-abet:(he-update:heap-core q.action)
    he-abet:(he-proxy:heap-core q.action)
  ::
      %heap-remark-action
    =+  !<(act=remark-action:h vase)
    he-abet:(he-remark-diff:(he-abed:he-core p.act) q.act)
  ::
      %heap-migrate-server  ?>(from-self server:migrate)
      %heap-migrate         ?>(from-self client:migrate)
  ::
      %heap-migrate-refs
    ?>  from-self
    =+  !<(flag=[ship term] vase)
    (refs:migrate flag)
  ==
  ++  join
    |=  =join:h
    ^+  cor
    ?<  (~(has by stash) chan.join)
    he-abet:(he-join:he-core join)
  ::
  ++  toggle-curio
    |=  toggle=post-toggle:c
    ^+  cor
    =.  hidden-curios
      ?-  -.toggle
        %hide  (~(put in hidden-curios) id-post.toggle)
        %show  (~(del in hidden-curios) id-post.toggle)
      ==
    (give %fact ~[/ui] toggle-curio+!>(toggle))
  ::
  ++  create
    |=  req=create:h
    |^  ^+  cor
      ~_  leaf+"Create failed: check group permissions"
      ?>  can-nest
      ?>  ((sane %tas) name.req)
      =/  =flag:h  [our.bowl name.req]
      =|  =heap:h
      =/  =perm:h  [writers.req group.req]
      =.  perm.heap  perm
      =.  net.heap  [%pub ~]
      =.  stash  (~(put by stash) flag heap)
      he-abet:(he-init:(he-abed:he-core flag) req)
    ++  can-nest
      ^-  ?
      =/  gop  (~(got by groups) group.req)
      %-  ~(any in bloc.gop)
      ~(has in sects:(~(got by fleet.gop) our.bowl))
    ::
    ++  groups
      .^  groups:g
        %gx
        /(scot %p our.bowl)/groups/(scot %da now.bowl)/groups/noun
      ==
    --
  --
++  load
  |=  =vase
  |^  ^+  cor
  =+  !<([old=versioned-state cool=epic:e] vase)
  |-
  ?-  -.old
    %0  $(old (state-0-to-1 old))
    ::
      %1
    =.  state  old
    =.  cor  restore-missing-subs
    =.  cor  (emit %pass / %agent [our.bowl dap.bowl] %poke %recheck-all-perms !>(0))
    =.  cor  (emit %pass / %agent [our.bowl dap.bowl] %poke %leave-old-channels !>(0))
    =.  cor
      %+  roll  ~(tap in `(set @p)`(~(run in ~(key by stash)) head))
      |=  [=ship cr=_cor]
      ?:  =(ship our.bowl)  cr
      (watch-epic:cr ship &)
    ?:  =(okay:h cool)  cor
    ::  speak the good news
    =.  cor  (emil (drop load:epos))
    =/  heaps  ~(tap in ~(key by stash))
    |-
    ?~  heaps
      cor
    =.  cor
      he-abet:he-upgrade:(he-abed:he-core i.heaps)
    $(heaps t.heaps)
  ==
  ::
  +$  versioned-state  $%(current-state state-0)
  ::
  +$  state-0
    $:  %0
        =stash:h
        voc=(map [flag:h time] (unit said:h))
        ::  true represents imported, false pending import
        imp=(map flag:h ?)
    ==
  ::
  +$  state-1  current-state
  ++  state-0-to-1
    |=  s=state-0
    ^-  state-1
    %*  .  *state-1
      stash  stash.s
      voc  voc.s
      imp  imp.s
      hidden-curios  ~
    ==
  ::
  ++  restore-missing-subs
    %+  roll
      ~(tap by stash)
    |=  [[=flag:h *] core=_cor]
    he-abet:he-safe-sub:(he-abed:he-core:core flag)
  ::
  --
::
++  watch
  |=  =(pole knot)
  ^+  cor
  ?+    pole  ~|(bad-watch-path/pole !!)
      [%briefs ~]  ?>(from-self cor)
      [%ui ~]      ?>(from-self cor)
    ::
      [%epic ~]    (give %fact ~ epic+!>(okay:h))
    ::
      [%heap ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    he-abet:(he-watch:(he-abed:he-core ship name.pole) rest.pole)
    ::
      [%said host=@ name=@ %curio time=@ ~]
    =/  host=ship   (slav %p host.pole)
    =/  =flag:h     [host name.pole]
    =/  =time       (slav %ud time.pole)
    (watch-said flag time)
  ==
::
++  watch-said
  |=  [=flag:h =time]
  ?.  (~(has by stash) flag)
    (proxy-said flag time)
  he-abet:(he-said:(he-abed:he-core flag) time)
++  said-wire
  |=  [=flag:h =time]
  ^-  wire
  /said/(scot %p p.flag)/[q.flag]/curio/(scot %ud time)
::
++  take-said
  |=  [=flag:h =time =sign:agent:gall]
  =/  =wire  (said-wire flag time)
  ^+  cor
  ?+    -.sign  !!
      %watch-ack
    %.  cor
    ?~  p.sign  same
    (slog leaf/"Preview failed" u.p.sign)
  ::
      %kick
    ?:  (~(has by voc) [flag time])
      cor  :: subscription ended politely
    ::  XX: only versioned subscriptions should rewatch on kick
    (give %kick ~[wire] ~)
    ::  (proxy-said flag time)
  ::
      %fact
    =.  cor  (give %fact ~[wire] cage.sign)
    =.  cor  (give %kick ~[wire] ~)
    ?+    p.cage.sign  ~|(funny-mark/p.cage.sign !!)
        %heap-said
      =+  !<(=said:h q.cage.sign)
      =.  voc  (~(put by voc) [flag time] `said)
      cor
    ::
        %heap-denied
      =.  voc  (~(put by voc) [flag time] ~)
      cor
    ==
  ==
::
++  proxy-said
  |=  [=flag:h =time]
  =/  =dock  [p.flag dap.bowl]
  =/  wire  (said-wire flag time)
  ?:  (~(has by wex.bowl) wire dock)
    cor
  (emit %pass wire %agent dock %watch wire)
::
++  agent
  |=  [=(pole knot) =sign:agent:gall]
  ^+  cor
  ?+    pole  ~|(bad-agent-wire/pole !!)
      ~  cor
      [%migrate ~]  cor
      [%epic ~]  (take-epic sign)
      [%hark ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  cor
    %-  (slog leaf/"Failed to hark" u.p.sign)
    cor
  ::
      [%heap ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    he-abet:(he-agent:(he-abed:he-core ship name.pole) rest.pole sign)
  ::
      [%said host=@ name=@ %curio time=@ ~]
    =/  host=ship   (slav %p host.pole)
    =/  =flag:h     [host name.pole]
    =/  id=time     (slav %ud time.pole)
    (take-said flag id sign)
  ::
      [%groups ~]
    ?+    -.sign  !!
      %kick  watch-groups
    ::
        %watch-ack
      %.  cor
      ?~  p.sign  same
      =/  =tank
        leaf/"Failed groups subscription in {<dap.bowl>}, unexpected"
      (slog tank u.p.sign)
    ::
        %fact
      ?.  =(act:mar:g p.cage.sign)  cor
      (take-groups !<(=action:g q.cage.sign))
    ==
  ==
++  watch-epic
  |=  [her=ship leave=?]
  ^+  cor
  =/  =wire  /epic
  =/  =dock  [her dap.bowl]
  ?:  leave
    %-  emil
    :~  [%pass wire %agent [her dap.bowl] %leave ~]
        [%pass wire %agent [her dap.bowl] %watch /epic]
    ==
  ?:  (~(has by wex.bowl) [wire dock])
    cor
  (emit %pass wire %agent [her dap.bowl] %watch /epic)
::
++  take-epic
  |=  =sign:agent:gall
  ^+  cor
  ?+    -.sign  cor
      %kick
    (watch-epic src.bowl |)
  ::
      %fact
    ?.  =(%epic p.cage.sign)
      ~&  '!!! weird fact on /epic'
      cor
    =+  !<(=epic:e q.cage.sign)
    %+  roll  ~(tap by stash)
    |=  [[=flag:g =heap:h] out=_cor]
    ?.  =(src.bowl p.flag)  out
    he-abet:(he-take-epic:(he-abed:he-core:out flag) epic)
  ::
      %watch-ack
    %.  cor
    ?~  p.sign  same
    (slog leaf/"weird watch nack" u.p.sign)
  ==
::
++  take-groups
  |=  =action:g
  =/  affected=(list flag:h)
    %+  murn  ~(tap by stash)
    |=  [=flag:h =heap:h]
    ?.  =(p.action group.perm.heap)  ~
    `flag
  =/  diff  q.q.action
  ?+  diff  cor
      [%fleet * %del ~]
    ~&  "%heap: revoke perms for {<affected>}"
    %+  roll  affected
    |=  [=flag:h co=_cor]
    ^+  cor
    %+  roll  ~(tap in p.diff)
    |=  [=ship ci=_cor]
    ^+  cor
    =/  he  (he-abed:he-core:ci flag)
    he-abet:(he-revoke:he ship)
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
  |=  [affected=(list flag:h) sects=(set sect:g)]
  ~&  "%heap recheck permissions for {<affected>}"
  %+  roll  affected
  |=  [=flag:h co=_cor]
  =/  he  (he-abed:he-core:co flag)
  he-abet:(he-recheck:he sects)
++  arvo
  |=  [=wire sign=sign-arvo]
  ^+  cor
  ~&  arvo/wire
  cor
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  ?+  pole  [~ ~]
  ::
    [%x %stash ~]  ``stash+!>(stash)
    [%x %init ~]  ``noun+!>([briefs stash])
    [%x %briefs ~]  ``heap-briefs+!>(briefs)
    [%x %hidden-curios ~]  ``hidden-posts+!>(hidden-curios)
  ::
      [%x %heap ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    (he-peek:(he-abed:he-core ship name.pole) rest.pole)
  ::
      [%u %heap ship=@ name=@ ~]
    =/  =ship  (slav %p ship.pole)
    ``loob+!>((~(has by stash) [ship name.pole]))
  ::
  ==
::
++  briefs
  ^-  briefs:h
  %-  ~(gas by *briefs:h)
  %+  turn  ~(tap in ~(key by stash))
  |=  =flag:h
  :-  flag
  he-brief:(he-abed:he-core flag)
::
++  want-hark
  |=  [flag=?(~ flag:g) kind=?(%msg %to-us)]
  %+  (fit-level:volume [our now]:bowl)
    ?~  flag  ~
    [%channel %heap flag]
  ?-  kind
    %to-us  %soft
    %msg    %loud
  ==
::
++  give-brief
  |=  [=flag:h =brief:briefs:h]
  (give %fact ~[/briefs] heap-brief-update+!>([flag brief]))
::
++  pass-hark
  |=  =new-yarn:ha
  ^-  card
  =/  =wire  /hark
  =/  =dock  [our.bowl %hark]
  =/  =cage  hark-action-1+!>([%new-yarn new-yarn])
  [%pass wire %agent dock %poke cage]
++  flatten
  |=  content=(list inline:h)
  ^-  cord
  %-  crip
  %-  zing
  %+  turn
    content
  |=  c=inline:h
  ^-  tape
  ?@  c  (trip c)
  ?-  -.c
      ?(%break %block)  ""
      %tag    (trip p.c)
      %link   (trip q.c)
      ?(%code %inline-code)  ""
      %ship                  (scow %p p.c)
      ?(%italics %bold %strike %blockquote)  (trip (flatten p.c))
  ==
++  from-self  =(our src):bowl
::
++  migrate
  |%
  ++  server
    =/  server-channels=v-channels:c
      %+  convert-channels  &
      %-  ~(gas by *stash:h)
      %+  skim  ~(tap by stash)
      |=  [=flag:h =heap:h]
      =(our.bowl p.flag)
    =/  =cage  [%channel-migration !>(server-channels)]
    (emit %pass /migrate %agent [our.bowl %channels-server] %poke cage)
  ::
  ++  client
    =/  =v-channels:c  (convert-channels | stash)
    =/  =cage  [%channel-migration !>(v-channels)]
    (emit %pass /migrate %agent [our.bowl %channels] %poke cage)
  ::
  ++  refs
    |=  =flag:h
    ?~  old-heap=(~(get by stash) flag)  cor
    %-  emil
    ::  iterate over all heaps and, for every item/comment authored by us,
    ::  containing a chat reference that we have (almost certainly) converted,
    ::  send the new version of the item/comment as an edit to the host.
    ::
    %+  murn  (tap:on:curios:h curios.u.old-heap)
    |=  [=time =curio:h]
    ^-  (unit card)
    ?.  =(our.bowl author.curio)  ~
    =/  edit=(unit essay:c)
      =;  contains-chat-ref=?
        ?.  contains-chat-ref  ~
        `(convert-essay +.curio)
      %+  lien  p.content.curio
      |=  =block:h
      ?=([%cite %chan [%chat *] *] block)
    =/  command=(unit c-post:c)
      ?~  edit  ~
      ?~  replying.curio
        `[%edit time u.edit]
      `[%reply u.replying.curio %edit time -.u.edit]
    ?~  command  ~
    =/  =cage
      :-  %channel-action
      !>(`a-channels:c`[%channel [%heap flag] %post u.command])
    `[%pass /migrate %agent [our.bowl %channels] %poke cage]
  ::
  ++  old-chats
    =>  [c2=c2 bowl=bowl ..zuse]  ~+
    .^  (map flag:c2 chat:c2)
      %gx
      /(scot %p our.bowl)/chat/(scot %da now.bowl)/old/noun
    ==
  ::
  ++  convert-channels
    |=  [log=? =stash:h]
    ^-  v-channels:c
    %-  ~(gas by *v-channels:c)
    %+  turn  ~(tap by stash)
    |=  [=flag:h =heap:h]
    ^-  [nest:c v-channel:c]
    :-  [%heap flag]
    =/  posts=v-posts:c  (convert-posts curios.heap)
    %*    .  *v-channel:c
        posts   posts
        log     ?.(log ~ (convert-log curios.heap posts perm.heap log.heap))
        view    [1 view.heap]
        perm    [1 perm.heap]
        remark  :_  remark.heap
                ?~(tim=(ram:on-v-posts:c posts) *time key.u.tim)
        net
      ?-  -.net.heap
        %pub  [*ship &]
        %sub  [p load]:net.heap
      ==
    ==
  ::
  ++  convert-posts
    |=  old=curios:h
    ^-  v-posts:c
    =/  curios  (tap:on:curios:h old)
    =/  index=(map @da v-replies:c)
      %+  roll  curios
      |=  [[=time =curio:h] index=(map @da v-replies:c)]
      ?~  replying.curio  index
      =/  old-replies=v-replies:c  (~(gut by index) u.replying.curio *v-replies:c)
      %+  ~(put by index)  u.replying.curio
      (put:on-v-replies:c old-replies time `(convert-reply time curio))
    %+  gas:on-v-posts:c  *v-posts:c
    %+  murn  curios
    |=  [=time =curio:h]
    ^-  (unit [id-post:c (unit v-post:c)])
    ?^  replying.curio  ~
    =/  replies=v-replies:c  (~(gut by index) time *v-replies:c)
    (some time `(convert-post time curio replies))
  ::
  ++  convert-post
    |=  [id=@da old=curio:h replies=v-replies:c]
    ^-  v-post:c
    [[id replies (convert-feels feels.old)] %0 (convert-essay +.old)]
  ::
  ++  convert-feels
    |=  old=(map ship feel:h)
    ^-  v-reacts:c
    %-  ~(run by old)
    |=  =feel:h
    [%0 `feel]
  ::
  ++  convert-reply
    |=  [id=@da old=curio:h]
    ^-  v-reply:c
    [[id (convert-feels feels.old)] %0 (convert-memo +.old)]
  ::
  ++  convert-memo
    |=  old=heart:h
    ^-  memo:c
    [(convert-story content.old) author.old sent.old]
  ::
  ++  convert-essay
    |=  old=heart:h
    ^-  essay:c
    [(convert-memo old) %heap title.old]
  ::
  ++  convert-story
    |=  old=content:h
    ^-  story:c
    =-  (snoc - [%inline q.old])
    %+  turn  p.old
    |=  =block:h
    ^-  verse:c
    :-  %block
    ?.  ?=([%cite %chan *] block)  block
    =;  new=(unit path)
      ?~  new  block
      block(wer.cite u.new)
    =,  cite.block
    ?.  ?=(%chat p.nest)                     ~
    ?~  old=(~(get by old-chats) q.nest)     ~
    =*  dex  dex.pact.u.old
    =*  wit  wit.pact.u.old
    ?.  ?=([%msg @ @ ~] wer.cite.block)      ~
    ?~  who=(slaw %p i.t.wer)                ~
    ?~  tim=(slaw %ud i.t.t.wer)             ~
    ?~  id=(~(get by dex) [u.who u.tim])     ~
    =*  single  `/msg/(crip (a-co:co u.id))
    ?~  ret=(get:on:writs:c2 wit u.id)       single
    ?~  replying.u.ret                       single
    ?~  td=(~(get by dex) u.replying.u.ret)  single
    `/msg/(crip (a-co:co u.td))/(crip (a-co:co u.id))
  ::
  ++  convert-log
    |=  [=curios:h posts=v-posts:c =perm:c =log:h]
    ^-  log:c
    %+  gas:log-on:c  *log:c
    %-  zing
    %+  turn  (tap:log-on:h log)
    |=  [=time =diff:h]
    ^-  (list [id-post:c u-channel:c])
    =;  new=(list u-channel:c)
      ?~  new  ~
      ?~  t.new  [time i.new]~
      =.  time  (sub time ~s1)
      =>  .(new `(list u-channel:c)`new)
      |-
      ?~  new  ~
      [[time i.new] $(time +(time), new t.new)]
    ?-    -.diff
        ?(%add-sects %del-sects)  [%perm 0 perm]~
        ::  XX  here and in the other apps, we need to preserve the
        ::  posts in the %create log.  they show up there from the
        ::  december migration
        %view                     [%view 0 p.diff]~
        %create
      :-  [%create p.diff]
      %+  murn  (tap:on:curios:h q.diff)
      |=  [=^time =curio:h]
      =/  new-post  (get:on-v-posts:c posts time)
      ?~  new-post  ~
      (some %post time %set u.new-post)
    ::
        %curios
      =*  id  time
      =/  old-curio  (get:on:curios:h curios id)
      ?~  old-curio  [%post id %set ~]~
      ?~  replying.u.old-curio
        =/  new-post  (get:on-v-posts:c posts id)
        ?~  new-post  ~
        :_  ~
        :+  %post  id
        ?-  -.q.p.diff
          %del                    [%set ~]
          ?(%add %edit)           [%set u.new-post]
          ?(%add-feel %del-feel)  [%reacts ?~(u.new-post ~ reacts.u.u.new-post)]
        ==
      =/  new-post  (get:on-v-posts:c posts u.replying.u.old-curio)
      ?~  new-post  ~
      ?~  u.new-post  ~
      =/  new-reply  (get:on-v-replies:c replies.u.u.new-post id)
      ?~  new-reply  ~
      :_  ~
      :+  %post   u.replying.u.old-curio
      :+  %reply  id
      ^-  u-reply:c
      ?-  -.q.p.diff
        %del                    [%set ~]
        ?(%add %edit)           [%set u.new-reply]
        ?(%add-feel %del-feel)  [%reacts ?~(u.new-reply ~ reacts.u.u.new-reply)]
      ==
    ==
  --
::
++  he-core
  |_  [=flag:h =heap:h gone=_|]
  +*  he-curios  ~(. cur curios.heap)
  ++  he-core  .
  ::  TODO: archive??
  ++  he-abet
    %_  cor
        stash
      ?:(gone (~(del by stash) flag) (~(put by stash) flag heap))
    ==
  ++  he-abed
    |=  f=flag:h
    he-core(flag f, heap (~(got by stash) f))
  ++  he-area  `path`/heap/(scot %p p.flag)/[q.flag]
  ++  he-spin
    |=  [rest=path con=(list content:ha) but=(unit button:ha) lnk=path]
    ^-  new-yarn:ha
    =*  group  group.perm.heap
    =/  =nest:g  [dap.bowl flag]
    =/  rope  [`group `nest q.byk.bowl (welp /(scot %p p.flag)/[q.flag] rest)]
    =/  link
      (welp /groups/(scot %p p.group)/[q.group]/channels/heap/(scot %p p.flag)/[q.flag] ?~(lnk rest lnk))
    [& & rope con link but]
  ::
  ++  he-said
    |=  =time
    |^  ^+  he-core
    ?.  (he-can-read src.bowl)
      (give-kick heap-denied+!>(~))
    =/  [* =curio:h]  (got:he-curios time)
    %+  give-kick  %heap-said
    !>  ^-  said:h
    [flag curio]
    ++  give-kick
      |=  =cage
      =.  cor  (give %fact ~ cage)
      =.  cor  (give %kick ~ ~)
      he-core
    --
  ::
  ++  he-upgrade
    ^+  he-core
    ?.  ?=(%sub -.net.heap)  he-core
    ?.  ?=(%dex -.saga.net.heap)  he-core
    ?.  =(okay:h ver.saga.net.heap)
      ~&  future-shock/[ver.saga.net.heap flag]
      he-core
    he-make-chi
  ::
  ++  he-watch
    |=  =path
    ^+  he-core
    ?+    path  !!
      [%updates *]    (he-pub t.path)
      [%ui ~]         ?>(from-self he-core)
      [%ui %curios ~]  ?>(from-self he-core)
    ::
    ==
  ++  he-pass
    |%
    ++  poke-group
      |=  [=term =action:g]
      ^+  he-core
      =/  =dock      [our.bowl %groups] :: XX which ship
      =/  =wire      (snoc he-area term)
      =.  cor
        (emit %pass wire %agent dock %poke act:mar:g !>(action))
      he-core
    ::
    ++  create-channel
      |=  [=term group=flag:g =channel:g]
      ^+  he-core
      =/  =nest:g  [dap.bowl flag]
      (poke-group term group now.bowl %channel nest %add channel)
    ::
    ++  add-channel
      |=  req=create:h
      %+  create-channel  %create
      [group.req =,(req [[title description '' ''] now.bowl %default | readers])]
    --
  ::
  ++  he-init
    |=  req=create:h
    =/  =perm:h  [writers.req group.req]
    =.  cor
      (give-brief flag he-brief)
    =.  he-core  (he-update now.bowl %create perm curios.heap)
    (add-channel:he-pass req)
  ::
  ++  he-agent
    |=  [=wire =sign:agent:gall]
    ^+  he-core
    ?+  wire  !!
        ~  :: noop wire, should only send pokes
      he-core
    ::
        [%updates ~]
      (he-take-update sign)
    ::
        [%create ~]
      ?>  ?=(%poke-ack -.sign)
      %.  he-core  :: TODO rollback creation if poke fails?
      ?~  p.sign  same
      (slog leaf/"poke failed" u.p.sign)
    ==
  ::
  ++  he-brief  (brief:he-curios our.bowl last-read.remark.heap)
  ::
  ++  he-peek
    |=  =(pole knot)
    ^-  (unit (unit cage))
    ?+  pole  [~ ~]
      [%curios rest=*]  (peek:he-curios rest.pole)
      [%perm ~]        ``heap-perm+!>(perm.heap)
    ==
  ::
  ++  he-revoke
    |=  her=ship
    %+  roll  ~(tap in he-subscriptions)
    |=  [[=ship =path] he=_he-core]
    ?.  =(ship her)  he
    he(cor (emit %give %kick ~[path] `ship))
  ::
  ++  he-recheck
    |=  sects=(set sect:g)
    ::  if we have sects, we need to delete them from writers
    =?  cor  &(!=(sects ~) =(p.flag our.bowl))
      =/  =cage  [act:mar:h !>([flag now.bowl %del-sects sects])]
      (emit %pass he-area %agent [our.bowl dap.bowl] %poke cage)
    ::  if our read permissions restored, re-subscribe. If not, leave.
    =/  wecanread  (he-can-read our.bowl)
    =.  he-core
      ?:  wecanread
        he-safe-sub
      he-leave
    ::  if subs read permissions removed, kick
    %+  roll  ~(tap in he-subscriptions)
    |=  [[=ship =path] he=_he-core]
    ?:  (he-can-read:he ship)  he
    he(cor (emit %give %kick ~[path] `ship))
  ::
  ++  he-take-epic
    |=  her=epic:e
    ^+  he-core
    ?>  ?=(%sub -.net.heap)
    ?:  =(her okay:h)
      he-make-chi
    ?:  (gth her okay:h)
      =.  saga.net.heap  dex+her
      he-core
    he-make-lev
  ::
  ++  he-make-lev
    ?.  ?=(%sub -.net.heap)
      he-core
    ~&  make-lev/flag
    =.  saga.net.heap  lev+~
    =.  cor  (watch-epic p.flag |)
    he-core
  ::
  ++  he-make-chi
    ?.  ?=(%sub -.net.heap)
      he-core
    ~&  make-chi/flag
    =.  saga.net.heap  chi+~
    he-safe-sub
  ::
  ++  he-take-update
    |=  =sign:agent:gall
    ^+  he-core
    ?+    -.sign  he-core
        %kick
      ?>  ?=(%sub -.net.heap)
      ?:  =(%chi -.saga.net.heap)  he-sub
      he-core
    ::
        %watch-ack
      =?  net.heap  ?=(%sub -.net.heap)  net.heap(load ?=(~ p.sign))
      ?~  p.sign  he-core
      %-  (slog leaf/"Failed subscription" u.p.sign)
      ::  =.  gone  &
      he-core
    ::
        %fact
      =*  cage  cage.sign
      ?+  p.cage  (he-odd-update p.cage)
        %epic                             (he-take-epic !<(epic:e q.cage))
        ?(%heap-logs-0 %heap-logs)      (he-apply-logs !<(log:h q.cage))
        ?(%heap-update-0 %heap-update)  (he-update !<(update:h q.cage))
      ==
    ==
  ::
  ++  he-odd-update
    |=  =mark
    ?.  (is-old:epos mark)
      he-core
    ?.  ?=(%sub -.net.heap)
      he-core
    he-make-lev
  ::
  ++  he-proxy
    |=  =update:h
    ^+  he-core
    ?>  he-can-write
    =/  =dock  [p.flag dap.bowl]
    =/  =cage  [act:mar:h !>([flag update])]
    =.  cor
      (emit %pass he-area %agent dock %poke cage)
    he-core
  ::
  ++  he-groups-scry
    =*  group  group.perm.heap
    /(scot %p our.bowl)/groups/(scot %da now.bowl)/groups/(scot %p p.group)/[q.group]
  ::
  ++  he-is-host  |(=(p.flag src.bowl) =(p.group.perm.heap src.bowl))
  ++  he-am-host  =(our.bowl p.flag)
  ++  he-from-host  |(=(p.flag src.bowl) =(p.group.perm.heap src.bowl))
  ++  he-is-admin
    .^(? %gx (welp he-groups-scry /fleet/(scot %p src.bowl)/is-bloc/loob))
  ++  he-can-write
    ?:  he-is-host  &
    =/  =path
      %+  welp  he-groups-scry
      /channel/[dap.bowl]/(scot %p p.flag)/[q.flag]/can-write/(scot %p src.bowl)/noun
    =+  .^(write=(unit [bloc=? sects=(set sect:g)]) %gx path)
    ?~  write  |
    =/  perms  (need write)
    ?:  |(bloc.perms =(~ writers.perm.heap))  &
    !=(~ (~(int in writers.perm.heap) sects.perms))
  ::
  ++  he-can-read
    %~  can-read  perms:cutils
    [our.bowl now.bowl [%heap flag] group.perm.heap]
  ::
  ++  he-pub
    |=  =path
    ^+  he-core
    ?>  (he-can-read src.bowl)
    =/  =log:h
      ?~  path  log.heap
      =/  =time  (slav %da i.path)
      (lot:log-on:h log.heap `time ~)
    =.  cor  (give %fact ~ log:mar:h !>(log))
    he-core
  ::
  ++  he-has-sub
    ^-  ?
    (~(has by wex.bowl) [(snoc he-area %updates) p.flag dap.bowl])
  ::
  ++  he-safe-sub
    ^+  he-core
    ?:  |(he-has-sub =(our.bowl p.flag))
      he-core
    he-sub
  ::
  ++  he-sub
    ^+  he-core
    =/  tim=(unit time)
      (bind (ram:log-on:h log.heap) head)
    =/  base=wire  (snoc he-area %updates)
    =/  =path
      %+  weld  base
      ?~  tim  ~
      /(scot %da u.tim)
    =/  =card
      [%pass base %agent [p.flag dap.bowl] %watch path]
    =.  cor  (emit card)
    he-core
  ++  he-join
    |=  j=join:h
    ^+  he-core
    ?>  |(=(p.group.j src.bowl) =(src.bowl our.bowl))
    =|  =heap:h
    =.  net.heap
      ?:  =(our.bowl p.chan.j)  [%pub ~]
      [%sub p.chan.j | %chi ~]
    =.  stash  (~(put by stash) chan.j heap)
    =.  he-core  (he-abed chan.j)
    =.  group.perm.heap  group.j
    =.  last-read.remark.heap  now.bowl
    =.  cor  (give-brief flag he-brief)
    =.  cor  (watch-epic p.flag &)
    he-core
  ::
  ++  he-leave
    =/  =dock  [p.flag dap.bowl]
    =/  =wire  (snoc he-area %updates)
    =.  cor  (emit %pass wire %agent dock %leave ~)
    =.  cor  (emit %give %fact ~[/briefs] heap-leave+!>(flag))
    =.  gone  &
    he-core
  ::
  ++  he-apply-logs
    |=  =log:h
    ^+  he-core
    =/  updates=(list update:h)
      (tap:log-on:h log)
    %+  roll  updates
    |=  [=update:h he=_he-core]
    (he-update:he update)
  ::
  ++  he-subscriptions
    %+  roll  ~(val by sup.bowl)
    |=  [[=ship =path] out=(set [ship path])]
    ?.  =((scag 4 path) (snoc he-area %updates))
      out
    (~(put in out) [ship path])
  ::
  ++  he-give-updates
    |=  [=time d=diff:h]
    ^+  he-core
    =/  paths=(set path)
      %-  ~(gas in *(set path))
      (turn ~(tap in he-subscriptions) tail)
    =.  paths  (~(put in paths) (snoc he-area %ui))
    =/  cag=cage  [upd:mar:h !>([time d])]
    =.  cor  (give %fact ~[/ui] act:mar:h !>([flag [time d]]))
    =.  cor
      (give %fact ~(tap in paths) cag)
    he-core
  ::
  ++  he-remark-diff
    |=  diff=remark-diff:h
    ^+  he-core
    =.  cor
      (give %fact ~[(snoc he-area %ui)] heap-remark-action+!>([flag diff]))
    =.  remark.heap
      ?-  -.diff
        %watch    remark.heap(watching &)
        %unwatch  remark.heap(watching |)
        %read-at  !!
      ::
          %read
      =/  [=time =curio:h]  (need (ram:on:curios:h curios.heap))
      remark.heap(last-read `@da`(add time (div ~s1 100)))  ::  greater than last
      ==
    =.  cor
      (give-brief flag he-brief)
    he-core
  ::
  ++  he-check-ownership
    |=  =diff:curios:h
    =*  delta  q.diff
    =/  entry=(unit [=time =curio:h])  (get:he-curios p.diff)
    ?-  -.delta
        %add   =(src.bowl author.p.delta)
        %add-feel  =(src.bowl p.delta)
        %del-feel  =(src.bowl p.delta)
      ::
          %del
        ::  if no curio, then fail
        ?~  entry  |
        ::  only author or admin can delete
        ?|  =(src.bowl author.curio.u.entry)
            he-is-admin
        ==
      ::
          %edit
        ::  if no curio, then fail
        ?~  entry  |
        ::  author should always be the same
        ?.  =(author.p.delta author.curio.u.entry)  |
        ::  only author or admin can edit
        ?|  =(src.bowl author.p.delta)
            he-is-admin
        ==
    ==
  ::
  ++  he-update
    |=  [=time d=diff:h]
    ^+  he-core
    ?>  he-can-write
    :: we use now on the host to enforce host ordering
    =?  time  =(p.flag our.bowl)
      now.bowl
    =.  log.heap
      (put:log-on:h log.heap time d)
    =.  he-core
      (he-give-updates time d)
    ?-    -.d
        %curios
      =.  curios.heap  (reduce:he-curios time p.d)
      =.  cor  (give-brief flag he-brief)
      =/  want-soft-notify  (want-hark flag %to-us)
      =/  want-loud-notify  (want-hark flag %msg)
      ?-  -.q.p.d
          ?(%edit %del %add-feel %del-feel)  he-core
          %add
        =/  =heart:h  p.q.p.d
        =/  from-me  =(our.bowl author.heart)
        ?~  replying.heart
          =/  content  (trip (flatten q.content.heart))
          =/  loud-yarn
            %-  he-spin
              :^  ~
                :~  [%ship author.heart]
                    ' posted a block to a gallery '
                    (flatten q.content.heart)
                ==
                ~
                /curio/(rsh 4 (scot %ui time))
          =?  cor  &(want-loud-notify !from-me)
            (emit (pass-hark loud-yarn))
          he-core
        =/  op  (~(get cur curios.heap) u.replying.heart)
        ?~  op  he-core
        =/  curio  curio.u.op
        =/  in-replies
            %+  lien
              ~(tap in replied.curio)
            |=  =^time
            =/  curio  (~(get cur curios.heap) time)
            ?~  curio  %.n
            =(author.curio.u.curio our.bowl)
        =/  content  (trip (flatten q.content.curio))
        =/  title
          ?:  !=(title.heart ~)  (need title.heart)
          ?:  (lte (lent content) 80)  (crip content)
          (crip (weld (swag [0 77] content) "..."))
        =/  new-yarn
          %-  he-spin
            :^  /curio/(rsh 4 (scot %ui u.replying.heart))
              :~  [%ship author.heart]
                  ' commented on '
                  [%emph title]
                  ': '
                  [%ship author.heart]
                  ': '
                  (flatten q.content.heart)
              ==
              ~
              ~
        =/  am-op-author  =(author.curio.u.op our.bowl)
        =/  am-author  =(author.heart our.bowl)
        =?  cor  &(want-soft-notify |(&(!am-author in-replies) &(am-op-author !am-author)))
          (emit (pass-hark new-yarn))
        he-core
      ==
    ::
        %add-sects
      ?>  he-is-host
      =*  p  perm.heap
      =.  writers.p  (~(uni in writers.p) p.d)
      he-core
    ::
        %del-sects
      ?>  he-is-host
      =*  p  perm.heap
      =.  writers.p  (~(dif in writers.p) p.d)
      he-core
    ::
        %create
      ?>  he-is-host
      =:  perm.heap  p.d
          curios.heap  q.d
        ==
      he-core
    ::
        %view
      =.  view.heap  p.d
      he-core
    ==
  --
--

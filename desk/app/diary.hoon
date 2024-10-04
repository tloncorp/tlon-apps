/-  d=diary, g=groups, ha=hark, channels, c2=chat-2
/-  meta
/-  e=epic
/+  default-agent, verb, dbug
/+  not=notes
/+  qup=quips
/+  volume, cutils=channel-utils
/+  epos-lib=saga
::  performance, keep warm
/+  diary-json
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  +$  current-state
    $:  %2
        =shelf:d
        hidden-posts=(set time)
        voc=(map [flag:d plan:d] (unit said:d))
        ::  true represents imported, false pending import
        imp=(map flag:d ?)
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
+*  epos  ~(. epos-lib [bowl %diary-update okay:d])
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
++  init
  ^+  cor
  watch-groups
++  load
  |=  =vase
  |^  ^+  cor
  =+  !<([old=versioned-state cool=epic:e] vase)
  |-
  ?-  -.old
    %1  $(old (state-1-to-2 old))
    ::
      %2
    =.  state  old
    =.  cor  restore-missing-subs
    =.  cor  (emit %pass / %agent [our.bowl dap.bowl] %poke %recheck-all-perms !>(0))
    =.  cor  (emit %pass / %agent [our.bowl dap.bowl] %poke %leave-old-channels !>(0))
    =.  cor
      (emil (drop load:epos))
    =/  diaries  ~(tap in ~(key by shelf))
    =.  cor
      %+  roll
        ~(tap in (~(gas in *(set ship)) (turn diaries head)))
      |=  [=ship cr=_cor]
      ?:  =(ship our.bowl)  cr
      (watch-epic:cr ship &)
    |-
    ?~  diaries
      cor
    =.  cor  di-abet:di-upgrade:(di-abed:di-core i.diaries)
    $(diaries t.diaries)
  ==
  ::
  +$  versioned-state  $%(current-state state-1)
  +$  state-1
    $:  %1
        =shelf:d
        voc=(map [flag:d plan:d] (unit said:d))
        ::  true represents imported, false pending import
        imp=(map flag:d ?)
    ==
  +$  state-2  current-state
  ++  state-1-to-2
    |=  s=state-1
    ^-  state-2
    %*  .  *state-2
      shelf  shelf.s
      voc    voc.s
      hidden-posts  ~
      imp    imp.s
    ==
  ::
  ++  restore-missing-subs
    %+  roll
      ~(tap by shelf)
    |=  [[=flag:d *] core=_cor]
    di-abet:di-safe-sub:(di-abed:di-core:core flag)
  --
::
++  watch-epic
  |=  [her=ship leave=?]
  ^+  cor
  =/  =wire  /epic
  =/  =dock  [her dap.bowl]
  =?  cor  leave  (emit %pass wire %agent dock %leave ~)
  (emit %pass wire %agent dock %watch /epic)
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
    %+  roll  ~(tap by shelf)
    |=  [[=flag:g =diary:d] out=_cor]
    ?.  =(src.bowl p.flag)
      out
    di-abet:(di-take-epic:(di-abed:di-core:out flag) epic)
  ::
      %watch-ack
    %.  cor
    ?~  p.sign  same
    (slog leaf/"weird watch nack" u.p.sign)
  ==
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
    =+  !<(f=flag:d vase)
    ?<  =(our.bowl p.f)
    (join [*flag:g f])
  ::
      %channel-join
    =+  !<(j=join:d vase)
    ?<  =(our.bowl p.chan.j)
    (join j)
  ::
      ?(%channel-leave %diary-leave)
    =+  !<(=leave:d vase)
    ?<  =(our.bowl p.leave)  :: cannot leave chat we host
    di-abet:di-leave:(di-abed:di-core leave)
  ::
      %post-toggle
    =+  !<(toggle=post-toggle:d vase)
    ?>  from-self
    (toggle-post toggle)
  ::
      %leave-old-channels
    =/  groups-path  /(scot %p our.bowl)/groups/(scot %da now.bowl)/groups/noun
    =/  groups  .^(groups:g %gx groups-path)
    =/  diary-flags-from-groups
      %+  turn  ~(tap by groups)
      |=  [group-flag=flag:g group=group:g]
      %+  turn
        %+  skim  ~(tap by channels.group)
        |=  [=nest:g *]
        ?:(=(%diary p.nest) %.y %.n)
      |=  [=nest:g *]
      q.nest
    =/  diaries-without-groups
      %+  skim  ~(tap by shelf)
      |=  [=flag:g *]
      ?:(=((find [flag]~ (zing diary-flags-from-groups)) ~) %.y %.n)
    %+  roll
      diaries-without-groups
    |=  [[=flag:g *] core=_cor]
    di-abet:di-leave:(di-abed:di-core:core flag)
  ::
      %recheck-all-perms
    %+  roll
      ~(tap by shelf)
    |=  [[=flag:d *] core=_cor]
    =/  di  (di-abed:di-core:core flag)
    di-abet:(di-recheck:di ~)
  ::
      %diary-create
    =+  !<(req=create:d vase)
    (create req)
  ::
      ?(%diary-action-2 %diary-action-1 %diary-action-0 %diary-action)
    =+  !<(=action:d vase)
    =/  diary-core  (di-abed:di-core p.action)
    ?:  =(p.p.action our.bowl)
      di-abet:(di-update:diary-core q.action)
    di-abet:(di-proxy:diary-core q.action)
  ::
      %diary-remark-action
    =+  !<(act=remark-action:d vase)
    di-abet:(di-remark-diff:(di-abed:di-core p.act) q.act)
  ::
      %diary-migrate-server  ?>(from-self server:migrate)
      %diary-migrate         ?>(from-self client:migrate)
  ::
      %diary-migrate-refs
    ?>  from-self
    =+  !<(flag=[ship term] vase)
    (refs:migrate flag)
  ==
  ++  join
    |=  =join:d
    ^+  cor
    ?<  (~(has by shelf) chan.join)
    di-abet:(di-join:di-core join)
  ::
  ++  toggle-post
    |=  toggle=post-toggle:d
    ^+  cor
    =.  hidden-posts
      ?-  -.toggle
        %hide  (~(put in hidden-posts) time.toggle)
        %show  (~(del in hidden-posts) time.toggle)
      ==
    (give %fact ~[/ui] toggle-post+!>(toggle))
  ::
  ++  create
    |=  req=create:d
    |^  ^+  cor
    ~_  leaf+"Create failed: check group permissions"
    ?>  can-nest
    ?>  ((sane %tas) name.req)
    =/  =flag:d  [our.bowl name.req]
    =|  =diary:d
    =/  =perm:d  [writers.req group.req]
    =.  perm.diary  perm
    =.  net.diary  [%pub ~]
    =.  shelf  (~(put by shelf) flag diary)
    di-abet:(di-init:(di-abed:di-core flag) req)
    ::  +can-nest: does group exist, are we allowed
    ::
    ++  can-nest
      ^-  ?
      =/  gop  (~(got by groups) group.req)
      %-  ~(any in bloc.gop)
      ~(has in sects:(~(got by fleet.gop) our.bowl))
    ::  +groups:
    ::
    ::  this has to be duplicated because
    ::  +di-groups-scry does not allow me
    ::  to properly adjust for a possible
    ::  group.
    ::
    ++  groups
      .^  groups:g
        %gx
        /(scot %p our.bowl)/groups/(scot %da now.bowl)/groups/noun
      ==
    --
  --
::
++  watch
  |=  =(pole knot)
  ^+  cor
  ?+    pole  ~|(bad-watch-path/pole !!)
      [%briefs ~]  ?>(from-self cor)
      [%ui ~]      ?>(from-self cor)
    ::
      [%epic ~]    (give %fact ~ epic+!>(okay:d))
    ::
      [%diary ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    di-abet:(di-watch:(di-abed:di-core ship name.pole) rest.pole)
    ::
      [%said host=@ name=@ %note time=@ quip=?(~ [@ ~])]
    =/  host=ship   (slav %p host.pole)
    =/  =flag:d     [host name.pole]
    =/  =plan:d     =,(pole [(slav %ud time) ?~(quip ~ `(slav %ud -.quip))])
    (watch-said flag plan)
  ==
::
++  watch-said
  |=  [=flag:d =plan:d]
  ?.  (~(has by shelf) flag)
    (proxy-said flag plan)
  di-abet:(di-said:(di-abed:di-core flag) plan)
++  said-wire
  |=  [=flag:d =plan:d]
  ^-  wire
  %+  welp
    /said/(scot %p p.flag)/[q.flag]/note/(scot %ud p.plan)
  ?~(q.plan / /(scot %ud u.q.plan))
::
++  take-said
  |=  [=flag:d =plan:d =sign:agent:gall]
  =/  =wire  (said-wire flag plan)
  ^+  cor
  ?+    -.sign  !!
      %watch-ack
    %.  cor
    ?~  p.sign  same
    (slog leaf/"Preview failed" u.p.sign)
  ::
      %kick
    ?:  (~(has by voc) [flag plan])
      cor  :: subscription ended politely
    ::  XX: only versioned subscriptions should rewatch on kick
    (give %kick ~[wire] ~)
    :: (proxy-said flag time)
  ::
      %fact
    =.  cor  (give %fact ~[wire] cage.sign)
    =.  cor  (give %kick ~[wire] ~)
    ?+    p.cage.sign  ~|(funny-mark/p.cage.sign !!)
        %diary-said
      =+  !<(=said:d q.cage.sign)
      =.  voc  (~(put by voc) [flag plan] `said)
      cor
    ::
        %diary-denied
      =.  voc  (~(put by voc) [flag plan] ~)
      cor
    ==
  ==
::
++  proxy-said
  |=  [=flag:d =plan:d]
  =/  =dock  [p.flag dap.bowl]
  =/  wire  (said-wire flag plan)
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
  ::
      [%epic ~]  (take-epic sign)
  ::
      [%hark ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  cor
    %-  (slog leaf/"Failed to hark" u.p.sign)
    cor
  ::
      [%diary ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    di-abet:(di-agent:(di-abed:di-core ship name.pole) rest.pole sign)
  ::
      [%said host=@ name=@ %note time=@ quip=?(~ [@ ~])]
    =/  host=ship   (slav %p host.pole)
    =/  =flag:d     [host name.pole]
    =/  =plan:d     =,(pole [(slav %ud time) ?~(quip ~ `(slav %ud -.quip))])
    (take-said flag plan sign)
  ::
      [%groups ~]
    ?+    -.sign  !!
      %kick  watch-groups
    ::
        %watch-ack
      ?~  p.sign
       (give %fact ~ epic+!>(okay:d))
      =/  =tank
        leaf/"Failed groups subscription in {<dap.bowl>}, unexpected"
      ((slog tank u.p.sign) cor)
    ::
        %fact
      ?.  =(act:mar:g p.cage.sign)  cor
      (take-groups !<(=action:g q.cage.sign))
    ==
  ==
++  take-groups
  |=  =action:g
  =/  affected=(list flag:d)
    %+  murn  ~(tap by shelf)
    |=  [=flag:d =diary:d]
    ?.  =(p.action group.perm.diary)  ~
    `flag
  =/  diff  q.q.action
  ?+  diff  cor
      [%fleet * %del ~]
    ~&  "%diary: revoke perms for {<affected>}"
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
  ::
      [%cabal * %del *]
    =/  =sect:g  (slav %tas p.diff)
    %+  recheck-perms  affected
    (~(gas in *(set sect:g)) ~[p.diff])
  ==
::
++  recheck-perms
  |=  [affected=(list flag:d) sects=(set sect:g)]
  ~&  "%diary recheck permissions for {<affected>}"
  %+  roll  affected
  |=  [=flag:d co=_cor]
  =/  di  (di-abed:di-core:co flag)
  di-abet:(di-recheck:di sects)
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
    [%x %shelf ~]  ``shelf+!>(shelf)
    [%x %init ~]   ``noun+!>([briefs shelf])
    [%x %briefs ~]  ``diary-briefs+!>(briefs)
    [%x %hidden-posts ~]  ``hidden-posts+!>(hidden-posts)
  ::
      [%x %diary ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    (di-peek:(di-abed:di-core ship name.pole) rest.pole)
    ::
      [%u %diary ship=@ name=@ ~]
    =/  =ship  (slav %p ship.pole)
    ``loob+!>((~(has by shelf) [ship name.pole]))
  ::
  ==
::
++  briefs
  ^-  briefs:d
  %-  ~(gas by *briefs:d)
  %+  turn  ~(tap in ~(key by shelf))
  |=  =flag:d
  :-  flag
  di-brief:(di-abed:di-core flag)
::
++  give-brief
  |=  [=flag:d =brief:briefs:d]
  (give %fact ~[/briefs] diary-brief-update+!>([flag brief]))
::
++  pass-hark
  |=  =new-yarn:ha
  ^-  card
  =/  =wire  /hark
  =/  =dock  [our.bowl %hark]
  =/  =cage  hark-action-1+!>([%new-yarn new-yarn])
  [%pass wire %agent dock %poke cage]
::
++  from-self  =(our src):bowl
::
++  migrate
  |%
  ++  d  channels
  ++  a  ^d
  ++  server
    =/  server-channels=v-channels:d
      %+  convert-channels  &
      %-  ~(gas by *shelf:a)
      %+  skim  ~(tap by shelf)
      |=  [=flag:a =diary:a]
      =(our.bowl p.flag)
    =/  =cage  [%channel-migration !>(server-channels)]
    (emit %pass /migrate %agent [our.bowl %channels-server] %poke cage)
  ::
  ++  client
    =/  =v-channels:d  (convert-channels | shelf)
    =/  =cage  [%channel-migration !>(v-channels)]
    (emit %pass /migrate %agent [our.bowl %channels] %poke cage)
  ::
  ++  refs
    |=  =flag:a
    ?~  old-heap=(~(get by shelf) flag)  cor
    %-  emil
    ::  iterate over all notebooks and, for every post/comment authored by us,
    ::  containing a chat reference that we have (almost certainly) converted,
    ::  send the new version of the post/comment as an edit to the host.
    ::
    %-  zing
    %+  turn  (tap:on:notes:a notes.u.old-heap)
    |=  [=time =note:a]
    ^-  (list card)
    %+  weld
      ::  first, for the post itself
      ::
      ^-  (list card)
      ?.  =(our.bowl author.note)  ~
      =/  edit=(unit essay:d)
        =;  contains-chat-ref=?
          ?.  contains-chat-ref  ~
          `(convert-essay +.note)
        %+  lien  content.note
        |=  =verse:a
        ?=([%block %cite %chan [%chat *] *] verse)
      =/  command=(unit c-post:d)
        ?~  edit  ~
        `[%edit time u.edit]
      ?~  command  ~
      =/  =cage
        :-  %channel-action
        !>(`a-channels:d`[%channel [%diary flag] %post u.command])
      [%pass /migrate %agent [our.bowl %channels] %poke cage]~
    ::  then, repeat for the quips on the post
    ::
    %+  murn  (tap:on:quips:a quips.note)
    |=  [rtime=^time =quip:a]
    ^-  (unit card)
    ?.  =(our.bowl author.quip)  ~
    =/  edit=(unit memo:d)
      =;  contains-chat-ref=?
        ?.  contains-chat-ref  ~
        `(convert-memo +.quip)
      %+  lien  p.content.quip
      |=  =block:a
      ?=([%cite %chan [%chat *] *] block)
    =/  command=(unit c-post:d)
      ?~  edit  ~
      `[%reply time %edit rtime u.edit]
    ?~  command  ~
    =/  =cage
      :-  %channel-action
      !>(`a-channels:d`[%channel [%diary flag] %post u.command])
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
    |=  [log=? =shelf:a]
    ^-  v-channels:d
    %-  ~(gas by *v-channels:d)
    %+  turn  ~(tap by shelf)
    |=  [=flag:a =diary:a]
    ^-  [nest:d v-channel:d]
    :-  [%diary flag]
    =/  posts=v-posts:d  (convert-notes notes.diary)
    %*    .  *v-channel:d
        posts   posts
        order   [1 arranged-notes.diary]
        view    [1 view.diary]
        sort    [1 sort.diary]
        perm    [1 perm.diary]
        log     ?.(log ~ (convert-log notes.diary posts perm.diary log.diary))
        remark  :_  remark.diary
                ?~(tim=(ram:on-v-posts:d posts) *time key.u.tim)
        net
      ?-  -.net.diary
        %pub  [*ship &]
        %sub  [p load]:net.diary
      ==
    ==
  ::
  ++  convert-notes
    |=  old=notes:a
    ^-  v-posts:d
    %+  gas:on-v-posts:d  *v-posts:d
    =|  posts=(list [id-post:d (unit v-post:d)])
    =<  +
    %+  roll  (tap:on:notes:a old)
    |=  [[=time =note:a] count=@ud =_posts]
    ^+  [count posts]
    =.  count  +(count)
    :-  count
    :_  posts
    [time `(convert-note time count note)]
  ::
  ++  convert-note
    |=  [id=@da seq=@ud old=note:a]
    ^-  v-post:d
    :-  [id seq (convert-quips quips.old) (convert-feels feels.old)]
    [%0 (convert-essay +.old)]
  ::
  ++  convert-quips
    |=  old=quips:a
    ^-  v-replies:d
    %+  gas:on-v-replies:d  *v-replies:d
    %+  turn  (tap:on:quips:a old)
    |=  [=time =quip:a]
    ^-  [id-reply:d (unit v-reply:d)]
    [time `(convert-quip time quip)]
  ::
  ++  convert-quip
    |=  [id=@da old=quip:a]
    ^-  v-reply:d
    [[id (convert-feels feels.old)] %0 (convert-memo +.old)]
  ::
  ++  convert-essay
    |=  old=essay:a
    ^-  essay:d
    =-  [[- author.old sent.old] %diary title.old image.old]
    %+  turn  content.old
    |=  v=verse:a
    ^-  verse:d
    ?-  -.v
      %block   (convert-block +.v)
      %inline  v
    ==
  ::
  ++  convert-memo
    |=  old=memo:a
    ^-  memo:d
    [(convert-story content.old) author.old sent.old]
  ::
  ++  convert-story
    |=  old=story:a
    ^-  story:d
    (snoc (turn p.old convert-block) [%inline q.old])
  ::
  ++  convert-block
    |=  =block:a
    ^-  verse:d
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
  ++  convert-feels
    |=  old=(map ship feel:a)
    ^-  v-reacts:d
    %-  ~(run by old)
    |=  =feel:a
    [%0 `feel]
  ::
  ++  convert-log
    |=  [old=notes:a posts=v-posts:d =perm:d =log:a]
    ^-  log:d
    %+  gas:log-on:d  *log:d
    %-  zing
    %+  turn  (tap:log-on:a log)
    |=  [=time =diff:a]
    ^-  (list [id-post:d u-channel:d])
    =;  new=(list u-channel:d)
      ?~  new  ~
      ?~  t.new  [time i.new]~
      =.  time  (sub time ~s1)
      =>  .(new `(list u-channel:d)`new)
      |-
      ?~  new  ~
      [[time i.new] $(time +(time), new t.new)]
    ?-    -.diff
        ?(%add-sects %del-sects)  [%perm 0 perm]~
        %create
      :-  [%create p.diff]
      %+  murn  (tap:on:notes:a q.diff)
      |=  [=^time =note:a]
      =/  new-post  (get:on-v-posts:d posts time)
      ?~  new-post  ~
      (some %post time %set u.new-post)
    ::
        %view                     [%view 0 p.diff]~
        %sort                     [%sort 0 p.diff]~
        %arranged-notes           [%order 0 p.diff]~
        %notes
      =*  id  time
      =/  old-note  (get:on:notes:a old id)
      ?~  old-note  [%post id %set ~]~
      =/  new-post  (get:on-v-posts:d posts id)
      ?~  new-post  ~
      ?-  -.q.p.diff
          %del                    [%post id %set ~]~
          ?(%add %edit)           [%post id %set u.new-post]~
          ?(%add-feel %del-feel)
        [%post id %reacts ?~(u.new-post ~ reacts.u.u.new-post)]~
      ::
          %quips
        ?~  u.new-post  ~
        =*  id-reply  p.p.q.p.diff
        =/  new-reply  (get:on-v-replies:d replies.u.u.new-post id-reply)
        ?~  new-reply  ~
        :_  ~
        :+  %post   id
        :+  %reply  id-reply
        ?-  -.q.p.q.p.diff
          %del                    [%set ~]
          %add                    [%set u.new-reply]
          ?(%add-feel %del-feel)  [%reacts ?~(u.new-reply ~ reacts.u.u.new-reply)]
        ==
      ==
    ==
  --
::
++  di-core
  |_  [=flag:d =diary:d gone=_|]
  +*  di-notes  ~(. not notes.diary)
  ++  di-core  .
  ::  TODO: archive??
  ++  di-abet
    %_  cor
        shelf
      ?:(gone (~(del by shelf) flag) (~(put by shelf) flag diary))
    ==
  ++  di-abed
    |=  f=flag:d
    di-core(flag f, diary (~(got by shelf) f))
  ++  di-area  `path`/diary/(scot %p p.flag)/[q.flag]
  ++  di-spin
    |=  [rest=path con=(list content:ha) but=(unit button:ha) lnk=path]
    ^-  new-yarn:ha
    =*  group  group.perm.diary
    =/  =nest:g  [dap.bowl flag]
    =/  rope  [`group `nest q.byk.bowl (welp /(scot %p p.flag)/[q.flag] rest)]
    =/  link
      (welp /groups/(scot %p p.group)/[q.group]/channels/diary/(scot %p p.flag)/[q.flag] ?~(lnk rest lnk))
    [& & rope con link but]
  ++  di-said
    |=  =plan:d
    |^  ^+  di-core
    ?.  (di-can-read src.bowl)
      (give-kick diary-denied+!>(~))
    =/  [* =note:d]  (got:di-notes p.plan)
    =/  =outline:d  (trace:di-notes note)
    %+  give-kick  %diary-said
    !>  ^-  said:d
    [flag outline]
    ++  give-kick
      |=  =cage
      =.  cor  (give %fact ~ cage)
      =.  cor  (give %kick ~ ~)
      di-core
    --
  ::  when we get a new %diary agent update, we need to check if we should
  ::  upgrade any lagging diaries. if we're lagging, we need to change
  ::  the saga to "chi" to resume syncing updates from the host. otherwise
  ::  we can no-op, because we're not in sync yet.
  ::
  ++  di-upgrade
    ^+  di-core
    ::  if we're the host, no-op
    ::
    ?.  ?=(%sub -.net.diary)
      di-core
    ::  if we're ahead or synced, no-op
    ::
    ?.  ?=(%dex -.saga.net.diary)
      di-core
    ::  if we're still behind even with the upgrade, no-op
    ::
    ?.  =(okay:d ver.saga.net.diary)
      ~&  future-shock/[ver.saga.net.diary flag]
      di-core
    ::  safe to sync and resume updates from host
    ::
    =>  .(saga.net.diary `saga:e`saga.net.diary)
    di-make-chi
  ::
  ++  di-make-dex
    |=  her=epic:e
    ?.  ?=(%sub -.net.diary)
      di-core
    =.  saga.net.diary  dex+her
    di-core
  ::
  ++  di-make-lev
    ?.  ?=(%sub -.net.diary)
      di-core
    =.  saga.net.diary  lev/~
    di-core
  ::
  ++  di-make-chi
    ?.  ?=(%sub -.net.diary)
      di-core
    =.  saga.net.diary  chi/~
    di-safe-sub
  ::
  ++  di-has-sub
    ^-  ?
    (~(has by wex.bowl) [(snoc di-area %updates) p.flag dap.bowl])
  ::
  ++  di-safe-sub
    ?:  |(di-has-sub =(our.bowl p.flag))
      di-core
    di-sub
  ::
  ++  di-watch
    |=  =path
    ^+  di-core
    ?+    path  !!
      [%updates *]    (di-pub t.path)
      [%ui ~]         ?>(from-self di-core)
      [%ui %notes ~]  ?>(from-self di-core)
    ::
    ==
  ++  di-pass
    |%
    ++  poke-group
      |=  [=term =action:g]
      ^+  di-core
      =/  =dock      [our.bowl %groups] :: [p.p.action %groups] XX: check?
      =/  =wire      (snoc di-area term)
      =.  cor
        (emit %pass wire %agent dock %poke act:mar:g !>(action))
      di-core
    ::
    ++  create-channel
      |=  [=term group=flag:g =channel:g]
      ^+  di-core
      %+  poke-group  term
      ^-  action:g
      :+  group  now.bowl
      [%channel [dap.bowl flag] %add channel]
    ::
    ++  add-channel
      |=  req=create:d
      %+  create-channel  %create
      [group.req =,(req [[title description '' ''] now.bowl %default | readers])]
    ::
    --
  ++  di-init
    |=  req=create:d
    =/  =perm:d  [writers.req group.req]
    =.  cor
      (give-brief flag di-brief)
    =.  di-core  (di-update now.bowl %create perm notes.diary)
    (add-channel:di-pass req)
  ::
  ++  di-agent
    |=  [=wire =sign:agent:gall]
    ^+  di-core
    ?+  wire  !!
        ~  :: noop wire, should only send pokes
      di-core
    ::
        [%updates ~]
      (di-take-update sign)
    ::
        [%create ~]
      ?>  ?=(%poke-ack -.sign)
      %.  di-core  :: TODO rollback creation if poke fails?
      ?~  p.sign  same
      (slog leaf/"poke failed" u.p.sign)
    ==
  ::
  ++  di-brief  (brief:di-notes our.bowl last-read.remark.diary)
  ::
  ++  di-peek
    |=  =(pole knot)
    ^-  (unit (unit cage))
    ?+  pole  [~ ~]
        [%notes rest=*]  (peek:di-notes rest.pole)
        [%perm ~]        ``diary-perm+!>(perm.diary)
    ==
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
    ::  if our read permissions restored, re-subscribe. If not, leave.
    =/  wecanread  (di-can-read our.bowl)
    =.  di-core
      ?:  wecanread
        di-safe-sub
      di-leave
    ::  if subs read permissions removed, kick
    %+  roll  ~(tap in di-subscriptions)
    |=  [[=ship =path] di=_di-core]
    ?:  (di-can-read:di ship)  di
    di(cor (emit %give %kick ~[path] `ship))
  ::
  ++  di-take-epic
    |=  her=epic:e
    ^+  di-core
    ?:  (lth her okay:d)  di-make-lev
    ?:  (gth her okay:d)  (di-make-dex her)
    di-make-chi
 ::
 ++  di-take-update
    |=  =sign:agent:gall
    ^+  di-core
    ?+    -.sign  di-core
        %kick
      ?>  ?=(%sub -.net.diary)
      ?:  =(%chi -.saga.net.diary)  di-sub
      di-core
    ::
        %watch-ack
      =?  net.diary  ?=(%sub -.net.diary)  net.diary(load ?=(~ p.sign))
      ?~  p.sign  di-core
      %-  (slog leaf/"Failed subscription" u.p.sign)
      :: =.  gone  &
      di-core
    ::
        %fact
      =*  cage  cage.sign
      ?+  p.cage  (di-odd-update p.cage)
        %epic                             (di-take-epic !<(epic:e q.cage))
        ?(%diary-logs %diary-logs-0 %diary-logs-1 %diary-logs-2)      (di-apply-logs !<(log:d q.cage))
        ?(%diary-update %diary-update-0 %diary-update-1 %diary-update-2)  (di-update !<(update:d q.cage))
      ==
    ==
  ::
  ++  di-odd-update
    |=  =mark
    ?.  (is-old:epos mark)
      di-core
    ?.  ?=(%sub -.net.diary)
      di-core
    di-make-lev
  ::
  ++  di-proxy
    |=  =update:d
    ^+  di-core
        ::  don't allow anyone else to proxy through us
    ?.  =(src.bowl our.bowl)
      ~|("%diary-action poke failed: only allowed from self" !!)
    ::  must have permission to write
    ?.  di-can-write
      ~|("%diary-action poke failed: can't write to host" !!)
    =/  =dock  [p.flag dap.bowl]
    =/  =cage  [act:mar:d !>([flag update])]
    =.  cor
      (emit %pass di-area %agent dock %poke cage)
    di-core
  ::
  ++  di-groups-scry
    =*  group  group.perm.diary
    /(scot %p our.bowl)/groups/(scot %da now.bowl)/groups/(scot %p p.group)/[q.group]
  ::
  ++  di-am-host  =(our.bowl p.flag)
  ++  di-from-host  |(=(p.flag src.bowl) =(p.group.perm.diary src.bowl))
  ++  di-can-write
    ?:  =(p.flag src.bowl)  &
    =/  =path
      %+  welp  di-groups-scry
      /channel/[dap.bowl]/(scot %p p.flag)/[q.flag]/can-write/(scot %p src.bowl)/noun
    =+  .^(write=(unit [bloc=? sects=(set sect:g)]) %gx path)
    ?~  write  |
    =/  perms  (need write)
    ?:  |(bloc.perms =(~ writers.perm.diary))  &
    !=(~ (~(int in writers.perm.diary) sects.perms))
  ::
  ++  di-can-read
    %~  can-read  perms:cutils
    [our.bowl now.bowl [%diary flag] group.perm.diary]
  ::
  ++  di-pub
    |=  =path
    ^+  di-core
    ?>  (di-can-read src.bowl)
    =/  =log:d
      ?~  path  log.diary
      =/  =time  (slav %da i.path)
      (lot:log-on:d log.diary `time ~)
    =.  cor  (give %fact ~ log:mar:d !>(log))
    di-core
  ::
  ++  di-sub
    ^+  di-core
    =/  tim=(unit time)
      (bind (ram:log-on:d log.diary) head)
    =/  base=wire  (snoc di-area %updates)
    =/  =path
      %+  weld  base
      ?~  tim  ~
      /(scot %da u.tim)
    =/  =card
      [%pass base %agent [p.flag dap.bowl] %watch path]
    =.  cor  (emit card)
    di-core
  ::
  ++  di-join
    |=  j=join:d
    ^+  di-core
    ?>  |(=(p.group.j src.bowl) =(src.bowl our.bowl))
    =|  diary:d
    =.  net.diary
      ?:  =(our.bowl p.chan.j)  [%pub ~]
      [%sub p.chan.j | %chi ~]
    =.  shelf  (~(put by shelf) chan.j diary)
    =.  di-core  (di-abed chan.j)
    =.  group.perm.diary  group.j
    =.  last-read.remark.diary  now.bowl
    =.  cor  (give-brief flag di-brief)
    =.  cor  (watch-epic p.flag &)
    di-core
  ::
  ++  di-leave
    =/  =dock  [p.flag dap.bowl]
    =/  =wire  (snoc di-area %updates)
    =.  cor  (emit %pass wire %agent dock %leave ~)
    =.  cor  (emit %give %fact ~[/briefs] diary-leave+!>(flag))
    =.  gone  &
    di-core
  ::
  ++  di-apply-logs
    |=  =log:d
    ^+  di-core
    =/  updates=(list update:d)
      (tap:log-on:d log)
    %+  roll  updates
    |=  [=update:d di=_di-core]
    (di-update:di update)
  ::
  ++  di-subscriptions
    %+  roll  ~(val by sup.bowl)
    |=  [[=ship =path] out=(set [ship path])]
    ?.  =((scag 4 path) (snoc di-area %updates))
      out
    (~(put in out) [ship path])
  ::
  ++  di-give-updates
    |=  [=time d=diff:d]
    ^+  di-core
    =/  paths=(set path)
      %-  ~(gas in *(set path))
      (turn ~(tap in di-subscriptions) tail)
    =.  paths  (~(put in paths) (snoc di-area %ui))
    =.  cor  (give %fact ~[/ui] act:mar:^d !>([flag [time d]]))
    =/  cag=cage  [upd:mar:^d !>([time d])]
    =.  cor
      (give %fact ~(tap in paths) cag)
    di-core
  ::
  ++  di-remark-diff
    |=  diff=remark-diff:d
    ^+  di-core
    =.  cor
      (give %fact ~[(snoc di-area %ui)] diary-remark-action+!>([flag diff]))
    =.  remark.diary
      ?-  -.diff
        %watch    remark.diary(watching &)
        %unwatch  remark.diary(watching |)
        %read-at  !!
      ::
          %read
      =/  [=time =note:d]  (need (ram:on:notes:d notes.diary))
      remark.diary(last-read `@da`(add time (div ~s1 100)))  ::  greater than last
      ==
    =.  cor
      (give-brief flag di-brief)
    di-core
  ::
  ++  di-check-ownership
    |=  =diff:notes:d
    =*  delta  q.diff
    =/  entry=(unit [=time =note:d])  (get:di-notes p.diff)
    ?-  -.delta
        %add   =(src.bowl author.p.delta)
        %add-feel  =(src.bowl p.delta)
        %del-feel  =(src.bowl p.delta)
        %quips  (di-check-quips-ownership p.diff p.delta)
      ::
          %del  ?~(entry | =(src.bowl author.note.u.entry))
      ::
          %edit
        ?&  =(src.bowl author.p.delta)
            ?~(entry | =(src.bowl author.note.u.entry))
        ==
    ==
  ::
  ++  di-check-quips-ownership
    |=  [note-time=time =diff:quips:d]
    =*  delta  q.diff
    =/  parent=(unit [=time =note:d])  (get:di-notes note-time)
    ?~  parent  |  :: note missing, nothing to do
    =/  quips  ~(. qup quips.note.u.parent)
    =/  entry=(unit [=time =quip:d])  (get:quips p.diff)
    ?-  -.delta
        %add   =(src.bowl author.p.delta)
        %add-feel  =(src.bowl p.delta)
        %del-feel  =(src.bowl p.delta)
        %del  ?~(entry | =(src.bowl author.quip.u.entry))
    ==
  ++  di-update
    |=  [=time dif=diff:d]
    ?>  di-can-write
    ^+  di-core
    :: we use now on the host to enforce host ordering
    =?  time  =(p.flag our.bowl)
      now.bowl
    =.  log.diary
      (put:log-on:d log.diary time dif)
    =.  di-core
      (di-give-updates time dif)
    ?-    -.dif
        %notes
      ::  accept the fact from host unconditionally, otherwise make
      ::  sure that it's coming from the right person
      ?>  ?|  di-from-host
              &(di-am-host (di-check-ownership p.dif))
          ==
      =.  notes.diary  (reduce:di-notes time p.dif)
      =.  cor  (give-brief flag di-brief)
      =/  cons=(list (list content:ha))
        ::  when using time, we need to use the new time if we're adding,
        ::  otherwise the time on the diff is correct
        =-  (hark:di-notes [flag bowl - q.p.dif])
        ?+  -.q.p.dif  p.p.dif
          %add  time
        ==
      =/  rope
        ?:  =(%quips -.q.p.dif)
          /note/(rsh 4 (scot %ui p.p.dif))
        ~
      =/  link
        ?:  =(%add -.q.p.dif)
          /note/(rsh 4 (scot %ui time))
        ~
      =.  cor
        %-  emil
        %+  turn  cons
        |=  cs=(list content:ha)
        (pass-hark (di-spin rope cs ~ link))
      di-core
    ::
        %add-sects
      ?>  di-from-host
      =*  p  perm.diary
      =.  writers.p  (~(uni in writers.p) p.dif)
      di-core
    ::
        %del-sects
      ?>  di-from-host
      =*  p  perm.diary
      =.  writers.p  (~(dif in writers.p) p.dif)
      di-core
    ::
        %create
      ?>  di-from-host
      =:  notes.diary  q.dif
          perm.diary   p.dif
        ==
      di-core
    ::
        %sort
      =.  sort.diary  p.dif
      di-core
    ::
        %view
      =.  view.diary  p.dif
      di-core
    ::
        %arranged-notes
      =.  arranged-notes.diary  p.dif
      di-core
    ==
  --
--

/-  g=groups, ha=hark
/-  g-one=group
/-  m-one=metadata-store
/-  meta
/-  e=epic
/+  default-agent, verb, dbug
/+  groups-json  :: unused, nice for perf
/+  of
/+  epos-lib=saga
/*  desk-bill  %bill  /desk/bill
^-  agent:gall
=>
  |%
  ++  okay  `epic:e`0
  +$  card  card:agent:gall
  ++  import-epoch  ~2022.10.11
  +$  current-state
    $:  %0
        groups=net-groups:g
        xeno=gangs:g
        ::  graph -> agent
        shoal=(map flag:g dude:gall)
    ==
  ::
  --
=|  current-state
=*  state  -
=< 
  %+  verb  &
  %-  agent:dbug
  |_  =bowl:gall
  +*  this  .
      def   ~(. (default-agent this %|) bowl)
      cor   ~(. +> [bowl ~])
  ++  on-init  
    ^-  (quip card _this)
    `this
  ::
  ++  on-save  !>([state okay])
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
+*  epos  ~(. epos-lib [bowl %group-update okay])
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
++  check-known
  |=  =ship
  ^-  ?(%alien %known)
  =-  (fall (~(get by -) ship) %alien)
  .^((map ^ship ?(%alien %known)) %ax /(scot %p our.bowl)//(scot %da now.bowl)/peers)
++  mar
  |%
  ++  act  `mark`(rap 3 %group-action '-' (scot %ud okay) ~)
  ++  upd  `mark`(rap 3 %group-update '-' (scot %ud okay) ~)
  --
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?+    mark  ~|(bad-mark/mark !!)
  ::
      %group-import  (import-groups !<(imports:g vase))
  ::
      %group-leave
    =+  !<(=flag:g vase)
    ?<  =(our.bowl p.flag)
    go-abet:go-leave:(go-abed:group-core flag)
  ::
      %group-create
    =+  !<(=create:g vase)
    ?>  ((sane %tas) name.create)
    =/  =flag:g  [our.bowl name.create]
    =/  =fleet:g
      %-  ~(run by members.create)
      |=  sects=(set sect:g)
      ^-  vessel:fleet:g
      [sects *time]
    =/  =group:g
      :*  fleet
          ~  ~  ~  ~  ~  ~
          cordon.create
          secret.create
          title.create
          description.create
          image.create
          cover.create
      ==
    =.  groups  (~(put by groups) flag *net:g group)
    =.  cor  (give-invites flag ~(key by members.create))
    go-abet:(go-init:(go-abed:group-core flag) ~)
  ::
      ?(%group-action %group-action-0)
    =+  !<(=action:g vase)
    =.  p.q.action  now.bowl
    =/  group-core  (go-abed:group-core p.action)
    ?:  &(!=(our.bowl p.p.action) from-self)
      go-abet:(go-proxy:group-core q.action)
    go-abet:(go-update:group-core q.action)
  ::
      %group-invite
    =+  !<(=invite:g vase)
    ?:  =(q.invite our.bowl)
      :: invitee
      ga-abet:(ga-invite:(ga-abed:gang-core p.invite) invite)
    :: inviter
    =/  cage  group-invite+!>(invite)
    (emit [%pass /gangs/invite %agent [q.invite dap.bowl] %poke cage])
  ::
      %group-join
    =+  !<(=join:g vase)
    =/  =gang:g  (~(gut by xeno) flag.join [~ ~ ~])
    =/  =claim:g  [join-all.join %adding]
    =.  cam.gang  `claim
    =.  xeno  (~(put by xeno) flag.join gang)
    ga-abet:ga-start-join:(ga-abed:gang-core flag.join)
  ::
      %group-knock
    =+  !<(=flag:g vase)
    =/  =gang:g  (~(gut by xeno) flag [~ ~ ~])
    =/  =claim:g  [| %knocking]
    =.  cam.gang  `claim
    =.  xeno  (~(put by xeno) flag gang)
    ga-abet:ga-knock:(ga-abed:gang-core flag)
  ::
      %group-rescind
    =+  !<(=flag:g vase)
    ga-abet:ga-rescind:(ga-abed:gang-core flag)
  ::
      %group-cancel
    =+  !<(=flag:g vase)
    ga-abet:ga-cancel:(ga-abed:gang-core flag)
  ::
      %invite-decline
    =+  !<(=flag:g vase)
    ga-abet:ga-invite-reject:(ga-abed:gang-core flag)
  ==
::  +load: load next state
++  load
  |=  =vase
  |^  ^+  cor
   =/  maybe-old=(each [p=versioned-state q=epic:e] tang)
  (mule |.(!<([versioned-state epic:e] vase)))
  ::  XX only save when epic changes
  =/  [old=versioned-state cool=epic:e bad=?]
    ?.  ?=(%| -.maybe-old)  [p q &]:p.maybe-old
    =;  [sta=versioned-state ba=?]  [sta okay ba]
    =-  %+  fall  -  ~&  >  %bad-load  [state &]
    (mole |.([!<(versioned-state vase) |]))
  ::
  =.  state  old
  ?:  =(okay cool)  cor
  =.  cor  (emil (drop load:epos))
  =/  groups  ~(tap in ~(key by groups))
  |-
  ?~  groups
    cor
  =.  cor
    go-abet:go-upgrade:(go-abed:group-core i.groups)
  $(groups t.groups)
  ::
  +$  versioned-state  $%(current-state)
  --
::
++  watch
  |=  =(pole knot)
  ^+  cor
  ?+  pole  ~|(bad-watch/pole !!)
    [%init ~]             (give %kick ~ ~)
    [%groups %ui ~]       cor
    [%groups ~]           cor
    [%gangs %updates ~]   cor
  ::
    [%epic ~]  (give %fact ~ epic+!>(okay))
  ::
      [%bait s=@ n=@ gs=@ gn=@ ~]
    =,(pole (cast [(slav %p gs) gn] [(slav %p s) n]))
  ::
      [%groups ship=@ name=@ rest=*]
    =/  ship=@p  (slav %p ship.pole)
    go-abet:(go-watch:(go-abed:group-core ship name.pole) rest.pole)
  ::
      [%gangs %index ship=@ ~]
    =/  =ship  (slav %p ship.pole)
    ?:  =(our.bowl ship)  res-gang-index
    ::  XX remove when ames fix is in
    =+  (check-known ship)
    ?.  ?=(%known -)  (hi-and-req-gang-index ship)
    (req-gang-index ship)
  ::
     [%gangs ship=@ name=@ rest=*]
    =/  ship=@p  (slav %p ship.pole)
    ga-abet:(ga-watch:(ga-abed:gang-core ship name.pole) rest.pole)
  ::
     [%chan app=@ ship=@ name=@ rest=*]
    =/  ship=@p  (slav %p ship.pole)
    =/  =nest:g  [app.pole ship name.pole]
    (watch-chan nest)
  ==
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  ?+    pole  [~ ~]
      [%x %groups ~]
    ``groups+!>(`groups:g`(~(run by groups) tail))
  ::
      [%x %gangs ~]
    ``gangs+!>(`gangs:g`xeno)
  ::
      [%x %groups ship=@ name=@ rest=*]
    =/  ship  (slav %p ship.pole)
    (go-peek:(go-abed:group-core ship name.pole) rest.pole)
  ::
      [%x %exists ship=@ name=@ rest=*]
      =/  src  (slav %p ship.pole)
      ``noun+!>((~(has by groups) [src name.pole]))
  ==
::
++  agent
  |=  [=(pole knot) =sign:agent:gall]
  ^+  cor
  ?+    pole  ~|(bad-agent-take/pole !!)
      ~   cor
      [%epic ~]  (take-epic sign)
      [%hark ~]  cor
      [%helm *]  cor
      [%cast ship=@ name=@ ~]  (take-cast [(slav %p ship.pole) name.pole] sign)
  ::
      [%groups ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    go-abet:(go-agent:(go-abed:group-core ship name.pole) rest.pole sign)
  ::
      [%gangs %index ship=@ ~]
    (take-gang-index (slav %p ship.pole) sign)
  ::
      [%gangs ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    ga-abet:(ga-agent:(ga-abed:gang-core ship name.pole) rest.pole sign)
  ::
      [%chan app=@ ship=@ name=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    =/  =nest:g  [app.pole ship name.pole]
    (take-chan nest sign)
    

  ==
::
++  arvo
  |=  [=wire sign=sign-arvo]
  ^+  cor
  !!
::
++  cast
  |=  [grp=flag:g gra=flag:g]
  ^+  cor
  ?^  dud=(~(get by shoal) gra)
    =.  cor   (give %fact ~ dude+!>(u.dud))
    (give %kick ~ ~)
  =/  grp-path=path   /(scot %p p.grp)/[q.grp]
  =/  gra-path=path   /(scot %p p.gra)/[q.gra]
  =/  =wire          [%cast gra-path]
  =/  =path          :(welp /groups grp-path /bait gra-path)
  ?:  (~(has by wex.bowl) wire p.grp dap.bowl)
    cor
  (emit %pass wire %agent [p.grp dap.bowl] %watch path)
::
++  take-cast
  |=  [gra=flag:g =sign:agent:gall]
  ^+  cor
  =/  matching=(list path)
    =-  ~(tap in -)
    %-  ~(gas in *(set path))
    %+  murn  ~(val by sup.bowl)
    |=  [=ship =path]
    ^-  (unit ^path)
    ?.  =((scag 3 path) [%bait (scot %p p.gra) q.gra ~])
      ~
    `path
  ?+    -.sign  cor
      %kick  (give %kick matching ~)
  ::
      %watch-ack
    ?~  p.sign  cor
    (give %kick matching ~)
  ::
      %fact
    ?.  =(p.cage.sign %dude)
      ~&  trash-fish/p.cage.sign
      cor
    =+  !<(=dude:gall q.cage.sign)
    =.  shoal  (~(put by shoal) gra dude)
    =.  cor  (give %fact matching cage.sign)
    (give %kick matching ~)
  ==
::
++  watch-epic
  |=  her=ship
  ^+  cor
  =/  =wire  /epic
  =/  =dock  [her dap.bowl]
  ?:  (~(has by wex.bowl) [wire dock])
    cor
  (emit %pass wire %agent [her dap.bowl] %watch /epic)
::
++  take-epic
  |=  =sign:agent:gall
  ^+  cor
  ?+    -.sign  cor
      %kick
    (watch-epic src.bowl)
  ::
      %fact
    ?.  =(%epic p.cage.sign)
      ~&  [p.cage.sign '!!! weird fact on /epic']
      cor
    =+  !<(=epic:e q.cage.sign)
    ?.  =(epic okay)  cor
    ~&  >>  "good news everyone!"
    %+  roll  ~(tap by groups)
    |=  [[=flag:g =net:g =group:g] out=_cor]
    ?:  =(our.bowl p.flag)  out
    go-abet:(go-take-epic:(go-abed:group-core:out flag) epic)
  ::
      %watch-ack
    %.  cor
    ?~  p.sign
      same
    (slog leaf/"weird watch nack" u.p.sign)
  ==
::
++  watch-chan
  |=  =nest:g
  ^+  cor
  ?.  =(our.bowl p.q.nest)
    =/  =wire  /chan/[p.nest]/(scot %p p.q.nest)/[q.q.nest]
    ?:  (~(has by wex.bowl) [wire p.q.nest dap.bowl])
      cor
    (emit [%pass wire %agent [p.q.nest dap.bowl] %watch `path`wire])
  =/  gs  ~(tap by groups)
  |-  
  ?~  gs
    ~|(no-group-found/nest !!)
  =/  [=flag:g =net:g =group:g]  i.gs
  ?.  (~(has by channels.group) nest)
    $(gs t.gs)
  ?.  (go-can-read:(go-abed:group-core flag) src.bowl (~(got by channels.group) nest))
    $(gs t.gs)
  =/  =preview:channel:g
    =,  group
    :*  nest
        meta:(~(got by channels.group) nest)
        flag  meta  cordon  now.bowl  secret.group
    ==
  =.  cor  (emit %give %fact ~ channel-preview+!>(preview))
  (emit %give %kick ~ ~)
::
++  take-chan
  |=  [=nest:g =sign:agent:gall]
  =/  =wire  =,(nest /chan/[p]/(scot %p p.q)/[q.q])
  ^+  cor
  ?+    -.sign  ~|(bad-chan-take/[-.sign nest] !!)
      %watch-ack
    ?~  p.sign  cor
    :: TODO: propagate upwards 
    %-  (slog leaf/"Failed to fetch group" u.p.sign)
    cor
  ::
      %fact
    ?.  =(%channel-preview p.cage.sign)
      cor
    =+  !<(=preview:channel:g q.cage.sign) :: XX: really necessary?
    =.  cor  (emit %give %fact ~[wire] cage.sign)
    (emit %give %kick ~[wire] ~)
  ::
      %kick  :: XX: better?
    (emit %give %kick ~[wire] ~)
  ==
::
++  from-self  =(our src):bowl
++  pass-hark
  |=  [all=? desk=? =yarn:ha]
  ^-  card
  =/  =wire  /hark
  =/  =dock  [our.bowl %hark]
  =/  =cage  hark-action+!>([%add-yarn all desk yarn])
  [%pass wire %agent dock %poke cage]
++  spin
  |=  [=rope:ha wer=path but=(unit button:ha) con=(list content:ha)]
  ^-  yarn:ha
  =/  id  (end [7 1] (shax eny.bowl))
  [id rope now.bowl con wer but]
::
++  give-invites
  |=  [=flag:g ships=(set ship)]
  %-  emil
    %+  turn
      ~(tap in ships)
    |=  =ship
    ^-  card
    =/  cage  group-invite+!>(`invite:g`[flag ship])
    =/  line  `wire`/gangs/(scot %p p.flag)/[q.flag]/invite
    [%pass line %agent [ship dap.bowl] %poke cage]

++  import-groups
  |=  =imports:g
  ^+  cor
  =/  imports  ~(tap by imports)
  |-
  ?~  imports  cor
  =.  cor  (import-group i.imports)
  $(imports t.imports)
::
++  import-group
  |=  $:  =flag:g
          =association:met:g
          chan=(map flag:g association:met:g)
          roles=(set flag:g)
          =group:old:g
      ==
  |^
  =/  [cabals=(map sect:g cabal:g) members=(jug ship sect:g)]
    %+  roll  ~(tap by roles)
    |=  [=flag:g cabals=(map sect:g cabal:g) members=(jug ship sect:g)]
    ^-  [(map sect:g cabal:g) (jug ship sect:g)]
    =/  =sect:g  (sect-for-flag flag)
    :_  (~(put ju members) p.flag sect)
    %+  ~(put by cabals)  sect
    ?~  ass=(~(get by chan) flag)
      *cabal:g
    :_  ~
    :*  (rap 3 'Writers: ' title.metadatum.u.ass ~)
        (rap 3 'The writers role for the ' title.metadatum.u.ass ' channel' ~)
        ''
        ''
    ==
  =/  =channels:channel:g
    %-  ~(gas by *channels:channel:g)
    %+  murn  ~(tap by chan)
    |=  [=flag:g =association:met:g]
    ^-  (unit [nest:g channel:g])
    ?~  dud=(graph-meta-to-agent metadatum.association)
      ~
    :-  ~
    :-  [u.dud flag]
    ^-  channel:g
    :*  (old-assoc-to-new-meta association)
        date-created.metadatum.association
        %default
        |
        ::
        ^-  (set sect:g)
        ?.  (~(has in roles) flag)  ~
        (silt (sect-for-flag flag) ~)
    ==
  =|  zones=(map zone:g realm:zone:g)
  =|  zone-ord=(list zone:g)
  =|  bloc=(set sect:g)  :: admin perms set up in +go-init at end
  =/  =cordon:g  (policy-to-cordon policy.group)
  =/  meta=data:meta
    (old-assoc-to-new-meta association)
  =/  =fleet:g
    %-  ~(gas by *fleet:g)
    %+  turn  ~(tap in members.group)
    |=  =ship
    ^-  [_ship vessel:fleet:g]
    [ship (~(get ju members) ship) now.bowl]
  =/  admins=(set ship)  (~(get ju tags.group) %admin)
  =/  =group:g
    :*  fleet
        cabals
        zones
        zone-ord
        bloc
        channels
        ~(key by channels)
        cordon
        =(%invite -.policy.group)
        meta
    ==
  =/  =net:g
    ?:  =(p.flag our.bowl)
      pub/(put:log-on:g *log:g import-epoch create/group)
    [%sub (sub import-epoch ~d1) | chi/~]
  =.  groups  (~(put by groups) flag [net group])
  =.  shoal
    %-  ~(gas by shoal)
    %+  turn  ~(tap in imported.group)
    |=(=nest:g [q p]:nest)
  go-abet:(go-init:(go-abed:group-core flag) admins) :: setup defaults
  ::
  ++  sect-for-flag
    |=  =flag:g
    `sect:g`(rap 3 'import/' (scot %p p.flag) '/' q.flag ~)
  ::
  ++  graph-mark-to-agent
  |=  =mark
  ^-  (unit term)
  ?+  mark  ~
    %graph-validator-chat     `%chat
    %graph-validator-link     `%heap
    %graph-validator-publish  `%diary
  ==

  ::
  ++  graph-meta-to-agent
    |=  =metadatum:m-one
    ^-  (unit dude:gall)
    ?.  ?=(%graph -.config.metadatum)
      ~
    ?+  module.config.metadatum  ~
      %chat  `%chat
      %link  `%heap
      %publish   `%diary  :: TODO
    ==
  ::
  ++  old-assoc-to-new-meta
   |=  =association:m-one
   (old-to-new-meta metadatum.association)
  ::
  ++  get-hex
    |=  =color:m-one
    (crip (welp ~['#'] (trip (en:base16:mimes:html 3 color))))
  ++  old-to-new-meta
    |=  =metadatum:m-one
    ^-  data:meta
    =,(metadatum [title description picture (get-hex color)])
  ::
  ++  policy-to-cordon
    |=  =policy:g-one
    ^-  cordon:g
    ?-    -.policy
        %open
      [%open banned ban-ranks]:policy
    ::
        %invite
      [%shut pending.policy ~]
    ==
  ::
  ++  scry
    |=  [care=@tas =dude:gall =path]
    ^+  path
    :*  care
        (scot %p our.bowl)
        dude
        (scot %da now.bowl)
        path
    ==
  ::
  ++  old-flag-path
    `path`/ship/(scot %p p.flag)/[q.flag]
  ::
  ++  scry-group
    =-  .^((unit group:g-one) -)
    %^  scry  %gx  %group-store
    `path`[%groups (snoc old-flag-path %noun)]
  ::
  ++  scry-meta
    =-  .^(associations:m-one -)
    %^  scry  %gx  %metadata-store
    `path`[%group (snoc old-flag-path %noun)]
  --

++  group-core
  |_  [=flag:g =net:g =group:g gone=_|]
  ++  go-core  .
  ++  go-abet
    =.  groups 
      ?:  gone  (~(del by groups) flag)
      (~(put by groups) flag net group)
    ?.  gone  cor
    =/  =action:g  [flag now.bowl %del ~]
    (give %fact ~[/groups/ui] act:mar !>(action))
  ++  go-abed
    |=  f=flag:g
    ^+  go-core
    =/  [n=net:g gr=group:g]  (~(got by groups) f)
    go-core(flag f, group gr, net n)
  ::
  ++  go-area  `path`/groups/(scot %p p.flag)/[q.flag]
  ++  go-rope
    |=  thread=path
    [`flag ~ q.byk.bowl (welp /(scot %p p.flag)/[q.flag] thread)]
  ++  go-link
    |=  link=path 
    (welp /groups/(scot %p p.flag)/[q.flag] link)
  ++  go-is-our-bloc
    (~(has in go-bloc-who) our.bowl)
  ++  go-is-bloc
    |(=(src.bowl p.flag) (~(has in go-bloc-who) src.bowl))
  ++  go-bloc-who
    %+  roll  ~(tap by fleet.group)
    |=  [[who=ship =vessel:fleet:g] out=(set ship)]
    ?:  =(~ (~(int in sects.vessel) bloc.group))
      out
    (~(put in out) who)
  ::
  ++  go-pass
    |%
    ++  leave
      ^-  card
      =/  =wire  (snoc go-area %updates)
      =/  =dock  [p.flag dap.bowl]
      [%pass wire %agent dock %leave ~]
    ::
    ++  remove-self
      ^-  card
      =/  =wire  (snoc go-area %proxy)
      =/  =dock  [p.flag dap.bowl]
      =/  =cage
        :-  act:mar
        !>  ^-  action:g
        [flag now.bowl %fleet (silt our.bowl ~) %del ~]
      [%pass wire %agent dock %poke cage]
    ::
    ++  join-pinned
      ^-  (list card)
      %+  turn  
        %+  skim
          ~(tap by channels.group)
        |=  [nes=nest:g =channel:g]
        join.channel 
      |=  [nes=nest:g =channel:g]
      ^-  card
      =/  =dock  [our.bowl p.nes] :: TODO: generally remove chat hard-coding j
      =/  =cage  channel-join+!>(q.nes)
      =/  =wire  (snoc go-area %join-pinned)
      [%pass wire %agent dock %poke cage]
    --
  ::
  ++  go-leave
    =.  cor  (emit leave:go-pass)
    =.  cor  (emit remove-self:go-pass)
    =.  cor  (emit %give %fact ~[/groups /groups/ui] group-leave+!>(flag))
    go-core(gone &)
  ::
  ++  go-init
    |=  admins=(set ship)
    =.  cabals.group
      %+  ~(put by cabals.group)  %admin
      :_  ~
      ['Admin' 'Admins can add and remove channels and edit metadata' '' '']
    =.  bloc.group  (~(put in bloc.group) %admin)
    =.  zones.group
      %+  ~(put by zones.group)  %default
      :-  ['Sectionless' '' '' '']
      %+  murn  ~(tap by channels.group)
      |=  [=nest:g =channel:g]
      ^-  (unit nest:g)
      ?.  =(zone.channel %default)
        ~
      `nest
    =.  zone-ord.group  (~(push of zone-ord.group) %default)
    =.  fleet.group
      %-  ~(rut by fleet.group)
      |=  [=ship =vessel:fleet:g]
      ?.  (~(has in admins) ship)
        vessel
      vessel(sects (~(put in sects.vessel) %admin))
    ?.  =(our.bowl p.flag)
      (go-safe-sub &)
    =/  our=vessel:fleet:g  (~(gut by fleet.group) our.bowl *vessel:fleet:g)
    =.  sects.our  (~(put in sects.our) %admin)
    =.  fleet.group  (~(put by fleet.group) our.bowl our)
    =/  =diff:g  [%create group]
    (go-tell-update now.bowl diff)
  ::
  ++  go-has-sub
    (~(has by wex.bowl) [(snoc go-area %updates) p.flag dap.bowl])
  ::
  ++  go-safe-sub
    |=  init=_|
    ^+  go-core
    ?:  go-has-sub
      go-core
    (go-sub init)
  ::
  ++  go-sub
    |=  init=_|
    ^+  go-core
    =/  =time
      ?.(?=(%sub -.net) *time p.net)
    =/  base=wire  (snoc go-area %updates)
    =/  =path      (snoc base ?:(init %init (scot %da time)))
    =/  =card
      [%pass base %agent [p.flag dap.bowl] %watch path]
    =.  cor  (emit card)
    go-core
  ::
  ++  go-watch
    |=  =(pole knot)
    ^+  go-core
    ?+    pole  !!
        [%updates rest=*]  (go-pub rest.pole)
        [%ui ~]            go-core
        [%preview ~]       go-preview
    ::
        [%bait host=@ name=@ ~]
      ?>  ?=(%open -.cordon.group)
      =/  =flag:g  [(slav %p host.pole) name.pole]
      =;  =nest:g
        =.  cor  (give %fact ~ dude+!>(p.nest))
        =.  cor  (give %kick ~ ~)
        go-core
      %-  need
      %+  roll  ~(tap in imported.group)
      |=  [=nest:g out=(unit nest:g)]
      ^-  (unit nest:g)
      ?.  =(~ out)  out
      ?.  =(q.nest flag)  ~
      `nest
    ==
  ::
  ++  go-preview
    :: TODO: either use ?> to enforce request permissions; or return a preview
    ::   with limited info? for rendering a secret group reference
    :: ?>  (~(has by fleet.group) src.bowl)
    :: TODO: if user is in the allowed to join list, they should see a preview;
    ::   reusing some of the below logic
    :: ?>  ?|  =(p.flag our.bowl) :: self
    ::     =(p.flag src.bowl) :: subscription
    ::     &((~(has in ships) src.bowl) =(1 ~(wyt in ships)))  :: user join
    =/  =preview:g
      =,  group
      [flag meta cordon now.bowl secret.group]
    =.  cor
      (emit %give %fact ~ group-preview+!>(preview))
    =.  cor
      (emit %give %kick ~ ~)
    go-core
  ::
  ++  go-peek
    |=  =(pole knot)
    ^-  (unit (unit cage))
    :-  ~
    ?+    pole  ~
        [%fleet %ships ~]
      `ships+!>(~(key by fleet.group))
      ::
        [%fleet ship=@ %vessel ~]
      =/  src  (slav %p ship.pole)
      `noun+!>((~(got by fleet.group) src))
      ::
        [%channel app=@ ship=@ name=@ rest=*]
      =/  nes=nest:g  [app.pole (slav %p ship.pole) name.pole]
      =/  =channel:g  (~(got by channels.group) nes)
      ?+    rest.pole  ~
          [%can-read src=@ ~]
        =/  src  (slav %p src.rest.pole)
        `loob+!>((go-can-read src channel))
      ==
    ==
  ::
  ++  go-can-read
    |=  [src=ship =channel:g]
    =/  open  =(-.cordon.group %open)
    =/  ves  (~(get by fleet.group) src)
    =/  visible  =(~ readers.channel)
    ?:  ?|  &(open visible)
            &(!=(~ ves) visible)
        ==
      &
    ?~  ves  |
    !=(~ (~(int in readers.channel) sects.u.ves))
  ++  go-agent
    |=  [=wire =sign:agent:gall]
    ^+  go-core
    ?+  wire  !!
        [%updates ~]  (go-take-update sign)
    ::
        [%join-pinned ~]
      ?>  ?=(%poke-ack -.sign)
      ?~  p.sign
        go-core
      %-  (slog leaf/"Failed to autojoin channel" u.p.sign)
      go-core
    ::
        [%proxy ~]
      ?>  ?=(%poke-ack -.sign)
      ?~  p.sign  go-core
      %-  (slog leaf/"Error forwarding poke" u.p.sign)
      go-core
    ==
  ::
  ++  go-upgrade
    ^+  go-core
    ?.  ?=(%sub -.net)       go-core
    ?.  ?=(%dex -.saga.net)  go-core
    ?.  =(okay ver.saga.net)  
      ~&  future-shock/[ver.saga.net flag]
      go-core
    go-make-chi
  ::
  ++  go-take-epic
    |=  her=epic:e
    ^+  go-core
    ?>  ?=(%sub -.net)
    ?:  =(her okay)
      go-make-chi
    ?:  (gth her okay)
      =.  saga.net  dex+her
      go-core
    go-make-lev
  ::
  ++  go-take-update
    |=  =sign:agent:gall
    ^+  go-core
    ?+    -.sign  (go-sub |)
        %kick
      ?>  ?=(%sub -.net)
      ?.  ?=(%chi -.saga.net)  go-core
      (go-sub load.net)
    ::
        %watch-ack
      =?  cor  (~(has by xeno) flag)
        ga-abet:(ga-watched:(ga-abed:gang-core flag) p.sign)
      %.  go-core
      ?~  p.sign  same
      (slog leaf/"Failed subscription" u.p.sign)
    ::
        %fact
      =*  cage  cage.sign
      ::  XX: does init need to be handled specially?
      ?+  p.cage  (go-odd-update p.cage)
        %epic                             (go-take-epic !<(epic:e q.cage))
        ?(%group-log-0 %group-log)        (go-apply-log !<(log:g q.cage))
        ?(%group-update-0 %group-update)  (go-update !<(update:g q.cage))
        ?(%group-init-0 %group-init)      (go-fact-init !<(init:g q.cage))
      ==
    ==
  ::
  ++  go-odd-update
    |=  =mark
    ?.  (is-old:epos mark)
      go-core
    ?.  ?=(%sub -.net)
      go-core
    go-make-lev
  ::
  ++  go-make-lev
    ?.  ?=(%sub -.net)
       go-core
    ~&  "took lev epic: {<flag>}"
    =.  saga.net  lev/~
    =.  cor  (watch-epic p.flag)
    go-core
  ::
  ++  go-make-chi
    ^+  go-core
    ?.  ?=(%sub -.net)
       go-core
    ~&  "took chi epic: {<flag>}"
    =.  saga.net  chi/~
    (go-safe-sub load.net)
  ::
  ++  go-proxy
    |=  =update:g
    ^+  go-core
    ?>  go-is-bloc
    =/  =wire  (snoc go-area %proxy)
    =/  =dock  [p.flag dap.bowl]
    =/  =cage  group-action+!>([flag update])
    =.  cor  (emit %pass wire %agent dock %poke cage)
    go-core
  ::
  ++  go-pub
    |=  =path
    ^+  go-core
    ?>  ?=(%pub -.net)
    =;  =cage
      =.  cor  (give %fact ~ cage)
      go-core
    ?:  ?=([%init ~] path)  
      =/  [=time *]  (need (ram:log-on:g p.net))
      group-init+!>([time group])
    ?>  ?=([@ ~] path)
    =/  =time  (slav %da i.path)
    =/  =log:g
      (lot:log-on:g p.net `time ~)
    group-log+!>(log)
  ::
  ++  go-apply-log
    |=  =log:g
    =/  updates=(list update:g)
      (tap:log-on:g log)
    %+  roll  updates
    |=  [=update:g go=_go-core]
    (go-update:go update)
  ::
  ++  go-fact-init
    |=  [=time gr=group:g]
    =.  group  gr
    =.  net  [%sub time & %chi ~]
    =/  create=diff:g  [%create group]
    =.  cor  
      (give %fact ~[/groups /groups/ui] act:mar !>(`action:g`[flag now.bowl create]))
    =.  cor
      (give %fact ~[/groups /groups/ui] gang-gone+!>(flag))
    =.  cor
      (emil join-pinned:go-pass)
    go-core
  ::
  ++  go-give-update
    |=  [=time =diff:g]
    ^+  go-core
    =/  paths=(set path)
      %+  roll  ~(val by sup.bowl)
      |=  [[=ship =path] out=(set path)]
      ?.  =((scag 4 path) (snoc go-area %updates))
        out
      (~(put in out) path)
    =.  paths  (~(put in paths) (snoc go-area %ui))
    =.  cor
      (give %fact ~(tap in paths) upd:mar !>(`update:g`[time diff]))
    =.  cor
      (give %fact ~[/groups /groups/ui] act:mar !>(`action:g`[flag time diff]))
    go-core
  ::
  ++  go-tell-update
    |=  [=time =diff:g]
    ^+  go-core
    =.  go-core  (go-give-update time diff)
    ?.  ?=(%pub -.net)
      go-core
    =.  p.net
      (put:log-on:g p.net time diff)
    go-core
  ::
  ++  go-update
    |=  [=time =diff:g]
    ^+  go-core
    =.  go-core
      (go-tell-update time diff)
    =.  net
      ?:    ?=(%pub -.net)
        pub/(put:log-on:g p.net time diff)
      [%sub time load.net %chi ~]
    ?-  -.diff
      %channel  (go-channel-update [p q]:diff)
      %fleet    (go-fleet-update [p q]:diff)
      %cabal    (go-cabal-update [p q]:diff)
      %bloc     (go-bloc-update p.diff)
      %cordon   (go-cordon-update p.diff)
      %create   go-core(group p.diff)
      %zone     (go-zone-update +.diff)
      %meta     (go-meta-update p.diff)
      %secret   (go-secret-update p.diff)
      %del      go-core(gone &)
    ==
  ::
  ++  go-secret-update
    |=  secret=?
    =.  secret.group  secret
    go-core
  ++  go-meta-update
    |=  meta=data:meta
    =.  meta.group  meta
    go-core
  ++  go-zone-update
    |=  [=zone:g =delta:zone:g]
    ^+  go-core
    ?-    -.delta
        %add
      =/  =realm:zone:g  [meta.delta ~]
      =.  zones.group    (~(put by zones.group) zone realm)
      =.  zone-ord.group  (~(push of zone-ord.group) zone)
      go-core
    ::
        %del
      ~|  %cant-delete-default-zone
      ?<  =(%default zone) 
      =.  zones.group  
        (~(del by zones.group) zone)
      =.  zone-ord.group
        (~(del of zone-ord.group) zone)
      =.  channels.group
        %-  ~(run by channels.group)
        |=  =channel:g
        channel(zone ?:(=(zone zone.channel) %default zone.channel))
      go-core
    ::
        %edit
      =.  zones.group
        %+  ~(jab by zones.group)  zone
        |=  realm:zone:g
        +<(met meta.delta)
      go-core
    ::
        %mov
      =.  zone-ord.group
        (~(into of zone-ord.group) idx.delta zone)
      go-core
    ::
        %mov-nest
      =/  =realm:zone:g  (~(got by zones.group) zone)
      ?>  (~(has of ord.realm) nest.delta)
      =.  ord.realm  
        (~(into of ord.realm) [idx nest]:delta)
      =.  zones.group    (~(put by zones.group) zone realm)
      go-core
    ==
  ++  go-bloc-update
    |=  =diff:bloc:g
    ?>  go-is-bloc
    ^+  go-core
    =.  bloc.group
      ?-  -.diff
        %add  (~(uni in bloc.group) p.diff)
        %del  (~(dif in bloc.group) p.diff)
      ==
    go-core
  ++  go-cordon-update
    |=  =diff:cordon:g
    |^  ^+  go-core
    ?-  -.diff 
      %open     (open p.diff)
      %shut     (shut p.diff)
      %swap     ?>(go-is-bloc =.(cordon.group p.diff go-core))
    ==
    ::
    ++  open
      |=  =diff:open:cordon:g
      ^+  go-core
      ?>  go-is-bloc
      =*  cordon  cordon.group
      ?>  ?=(%open -.cordon) 
      ?-  -.diff
      ::
          %add-ships
        ?<  &((~(has in p.diff) our.bowl) =(p.flag our.bowl))
        =.  fleet.group
        %-  malt
          %+  skip 
            ~(tap by fleet.group)
          |=  [=ship =vessel:fleet:g]
          (~(has in p.diff) ship)          
        =.  ships.ban.cordon  (~(uni in ships.ban.cordon) p.diff)
        %+  go-give-update
          now.bowl
        [%fleet p.diff [%del ~]]
      ::
          %del-ships 
        =.  ships.ban.cordon  (~(dif in ships.ban.cordon) p.diff)
        go-core
      ::
          %add-ranks
        =/  foes
          %-  malt
          %+  skim 
            ~(tap by fleet.group)
          |=  [=ship =vessel:fleet:g]
          (~(has in p.diff) (clan:title ship))
        =.  fleet.group  (~(dif by fleet.group) foes)
        =.  ranks.ban.cordon  (~(uni in ranks.ban.cordon) p.diff)
        %+  go-give-update
          now.bowl
        [%fleet ~(key by foes) [%del ~]]
      ::
          %del-ranks
        =.  ranks.ban.cordon  (~(dif in ranks.ban.cordon) p.diff)
        go-core
      ==
    ::
    ++  shut
      |=  =diff:shut:cordon:g
      ^+  go-core
      =*  cordon  cordon.group
      ?>  ?=(%shut -.cordon)
      ?+    [-.diff p.diff]  !!  :: should never happen, compiler bug
      ::
          [%add-ships %pending]
        ?>  go-is-bloc          
        =.  pend.cordon.group  (~(uni in pend.cordon) q.diff)
        =.  ask.cordon.group  (~(dif in ask.cordon) q.diff)
        =.  cor  (give-invites flag q.diff)
        go-core
      ::
          [%del-ships %pending]
        ?>  go-is-bloc
        =.  pend.cordon.group  (~(dif in pend.cordon) q.diff)
        go-core
      ::
          [%add-ships %ask]
        ?>  |(go-is-bloc =(~(tap in q.diff) ~[src.bowl]))
        =.  ask.cordon.group  (~(uni in ask.cordon) q.diff)
        =/  ships  q.diff
        ?:  from-self  go-core
        =/  link  (go-link /info/members/pending)
        =/  yarn
          %-  spin
          :*  (go-rope /asks)
              link
              `['View all members' link]
              %+  welp
                ^-  (list content:ha)
                %+  join  `content:ha`', '
                `(list content:ha)`(turn ~(tap in ships) |=(=ship ship/ship))
              :~  ?:  =(~(wyt in ships) 1)  ' has '
                  ' have '
                  'requested to join '
                  [%emph title.meta.group]
              ==
          ==
        =?  cor  go-is-our-bloc
          (emit (pass-hark & & yarn))
        go-core
      ::
          [%del-ships %ask]
        ?>  |(go-is-bloc =(~(tap in q.diff) ~[src.bowl]))
        =.  ask.cordon.group  (~(dif in ask.cordon) q.diff)
        go-core
      ==
    --
  ::
  ++  go-cabal-update
    |=  [=sect:g =diff:cabal:g]
    ?>  go-is-bloc
    ^+  go-core
    ?-    -.diff
        %add
      =/  =cabal:g
        [meta.diff ~]
      =.  cabals.group  (~(put by cabals.group) sect cabal)
      go-core
    ::
        %del
      =.  cabals.group  (~(del by cabals.group) sect)
      go-core
    ==
  ::
  ++  go-fleet-update
    |=  [ships=(set ship) =diff:fleet:g]
    ^+  go-core
    =/  user-join  &((~(has in ships) src.bowl) =(1 ~(wyt in ships)))
    ?-    -.diff
        %add
      ?>  ?|  =(p.flag our.bowl) :: self
              =(p.flag src.bowl) :: subscription
              user-join
          ==
      ?<  ?&  =(-.cordon.group %shut) 
              ?-  -.cordon.group
                  ?(%open %afar)  |
                  %shut
                =/  cross  (~(int in pend.cordon.group) ships)
                ~&  [cross ~(wyt in ships) ~(wyt in cross)]
                !=(~(wyt in ships) ~(wyt in cross))
              ==
          ==      
      =?  cor  !user-join  (give-invites flag ships)
      =.  fleet.group
        %-  ~(uni by fleet.group)
          %-  malt
          ^-  (list [ship vessel:fleet:g])
          %+  turn
            ~(tap in ships)
          |=  =ship
          ::  only give time when joining
          =/  joined  ?:((~(has in ships) src.bowl) now.bowl *time)
          ::  if ship previously added, retain sects
          =/  vessel  (~(gut by fleet.group) ship *vessel:fleet:g)
          [ship [sects=sects.vessel joined=joined]]
      ?:  from-self  go-core
      =/  link  (go-link /info/members)
      =/  yarn
        %-  spin
        :*  (go-rope /joins)
            link
            `['View all members' link]
            %+  welp
              ^-  (list content:ha)
              %+  join  `content:ha`', '
              `(list content:ha)`(turn ~(tap in ships) |=(=ship ship/ship))
            :~  ?:  =(~(wyt in ships) 1)  ' has joined '
                ' have joined '
                [%emph title.meta.group]
            ==
        ==
      =?  cor  go-is-our-bloc
        (emit (pass-hark & & yarn))
      ?-  -.cordon.group
          ?(%open %afar)  go-core
          %shut  
        =.  pend.cordon.group  (~(dif in pend.cordon.group) ships)
        go-core
      ==
    ::
        %del
      ?<  &((~(has in ships) our.bowl) =(p.flag our.bowl))
      ?>  ?|(=(p.flag src.bowl) (~(has in ships) src.bowl))
      =.  fleet.group
      %-  malt
        %+  skip 
          ~(tap by fleet.group)
        |=  [=ship =vessel:fleet:g]
        (~(has in ships) ship)
      ?:  from-self  go-core
      =/  link  (go-link /info/members)
      =/  yarn
        %-  spin
        :*  (go-rope /leaves)
            link
            `['View all members' link]
            %+  welp
              ^-  (list content:ha)
              %+  join  `content:ha`', '
              `(list content:ha)`(turn ~(tap in ships) |=(=ship ship/ship))
            :~  ?:  =(~(wyt in ships) 1)  ' has left '
                ' have left '
                [%emph title.meta.group]
            ==
        ==
      =?  cor  go-is-our-bloc
        (emit (pass-hark & & yarn))
      ?:  (~(has in ships) our.bowl)
        go-core(gone &)
      go-core
    ::
        %add-sects
      ~|  strange-sect/sect
      ?>  go-is-bloc
      ?>  =(~ (~(dif in sects.diff) ~(key by cabals.group)))
      =.  fleet.group  
        %-  ~(rut by fleet.group)
        |=  [=ship =vessel:fleet:g]
        ?.  (~(has in ships) ship)  vessel
        vessel(sects (~(uni in sects.vessel) sects.diff))
      ?:  from-self  go-core
      =/  link  (go-link /info/members)
      =/  ship-list=(list content:ha)  
        %+  join  `content:ha`', '
        `(list content:ha)`(turn ~(tap in ships) |=(=ship ship/ship))
      =/  role-list
        %-  crip
        %+  join  ', '
        %+  turn 
          ~(tap in sects.diff) 
        |=  =sect:g
        =/  cabal  (~(got by cabals.group) sect)
        title.meta.cabal
      =/  yarn
        %-  spin
        :*  (go-rope /add-roles)
            link
            `['View all members' link]
            %+  welp
              ship-list
            :~  ?:  =(~(wyt in ships) 1)  ' is now a(n) '
                ' are now a(n) '
                [%emph role-list]
            ==
        ==
      =?  cor  go-is-our-bloc
        (emit (pass-hark & & yarn))
      go-core
    ::
        %del-sects
      ?>  go-is-bloc
      =.  fleet.group
        %-  ~(rut by fleet.group)
        |=  [=ship =vessel:fleet:g]
        ?.  (~(has in ships) ship)  vessel
        vessel(sects (~(dif in sects.vessel) sects.diff))
      go-core
    ==
  ++  go-channel-update
    |=  [ch=nest:g =diff:channel:g]
    ^+  go-core
    ?>  go-is-bloc
    =*  by-ch  ~(. by channels.group)
    ?-    -.diff
        %add
      =/  =zone:g  zone.channel.diff
      =.  zones.group
        %+  ~(jab by zones.group)  zone
        |=(=realm:zone:g realm(ord (~(push of ord.realm) ch)))
      =.  channels.group  (put:by-ch ch channel.diff)
      ?:  from-self  go-core
      =/  link  (go-link /channels)
      =/  yarn
        %-  spin
        :*  (go-rope /channel/add)
            link
            `['Subscribe to channel' link]
            :~  [%emph title.meta.channel.diff]
                ' has been added to '
                [%emph title.meta.group]
            ==
        ==
      =.  cor  (emit (pass-hark & & yarn))
      go-core
    ::
        %del
      =/  =channel:g   (got:by-ch ch)
      =.  zones.group
        %+  ~(jab by zones.group)  zone.channel
        |=(=realm:zone:g realm(ord (~(del of ord.realm) ch)))
      =.  channels.group  (del:by-ch ch)
      ?:  from-self  go-core
      =/  link  (go-link /channels)
      =/  yarn
        %-  spin
        :*  (go-rope /channel/del)
            link
            ~
            :~  [%emph title.meta.channel]
                ' has been removed from '
                [%emph title.meta.group]
            ==
        ==
      =.  cor  (emit (pass-hark & & yarn))
      go-core
    ::
        %add-sects
      =/  =channel:g  (got:by-ch ch)
      =.  readers.channel  (~(uni in readers.channel) sects.diff)
      =.  channels.group  (put:by-ch ch channel)
      go-core
    ::
        %del-sects
      =/  =channel:g  (got:by-ch ch)
      =.  readers.channel  (~(dif in readers.channel) sects.diff)
      =.  channels.group  (put:by-ch ch channel)
      ::  TODO: revoke?
      go-core
    ::
        %zone
      =/  =channel:g  (got:by-ch ch)
      =.  zones.group
        %+  ~(jab by zones.group)  zone.channel
        |=(=realm:zone:g realm(ord (~(del of ord.realm) ch)))
      =.  zone.channel   zone.diff
      =.  channels.group  (put:by-ch ch channel)
      =/  =realm:zone:g  (~(got by zones.group) zone.diff)
      =.  ord.realm  (~(push of ord.realm) ch)
      =.  zones.group  (~(put by zones.group) zone.diff realm)
      go-core
    ::
        %join
      =/  =channel:g  (got:by-ch ch)
      =.  join.channel  join.diff
      =.  channels.group  (put:by-ch ch channel)
      go-core
    ==
  --
::
++  res-gang-index
  ^+  cor
  =;  =cage
    =.  cor  (emit %give %fact ~ cage)
    (emit %give %kick ~ ~)
  :-  %group-previews
  !>  ^-  previews:g
  %-  ~(gas by *previews:g)
  %+  murn  ~(tap by groups)
  |=  [=flag:g =net:g =group:g]
  ^-  (unit [flag:g preview:g])
  ?.  &(=(our.bowl p.flag) !secret.group)
    ~
  `[flag =,(group [flag meta cordon now.bowl |])]
::
++  req-gang-index
  |=  =ship
  ^+  cor
  =/  =wire  /gangs/index/(scot %p ship)
  =/  =dock  [ship dap.bowl]
  (emit %pass wire %agent dock %watch `path`wire)
::
++  hi-and-req-gang-index
  |=  =ship
  ^+  cor
  =/  hi-wire=wire  /helm/hi/(scot %p ship)
  =/  hi-dock=dock  [ship %hood]
  =/  gang-wire  /gangs/index/(scot %p ship)
  =/  gang-dock  [ship dap.bowl]
  %-  emil
  :~  [%pass hi-wire %agent hi-dock %poke %helm-hi !>('')]
      [%pass gang-wire %agent gang-dock %watch `path`gang-wire]
  ==
::
++  take-gang-index
  |=  [=ship =sign:agent:gall]
  ^+  cor
  =/  =path  /gangs/index/(scot %p ship)
  ?+  -.sign  !!
      %kick  (emit %give %kick ~[path] ~)
  ::
      %watch-ack
    ?~  p.sign  cor
    %-  (slog leaf/"failed to watch gang index" u.p.sign)
    (emit %give %kick ~[path] ~)
  ::
      %fact
    ?.  =(%group-previews p.cage.sign)  cor
    =+  !<(=previews:g q.cage.sign)
    =.  cor  (emit %give %fact ~[path] cage.sign)
    (emit %give %kick ~[path] ~)
  ==
::
++  gang-core
  |_  [=flag:g =gang:g]
  ++  ga-core  .
  ++  ga-abet  
    =.  xeno  (~(put by xeno) flag gang)
    ?.  (~(has by groups) flag)  cor
    =/  [=net:g =group:g]  (~(got by groups) flag)
    ?.  &(?=(%sub -.net) !load.net)  cor
    =.  xeno  (~(del by xeno) flag)
    ga-give-update
  ::
  ++  ga-abed
    |=  f=flag:g
    =/  ga=gang:g  (~(gut by xeno) f [~ ~ ~])
    ga-core(flag f, gang ga)
  ::
  ++  ga-area  `wire`/gangs/(scot %p p.flag)/[q.flag]
  ++  ga-pass
    |%
    ++  poke-host  |=([=wire =cage] (pass-host wire %poke cage))
    ++  pass-host
      |=  [=wire =task:agent:gall]
      ^-  card
      [%pass (welp ga-area wire) %agent [p.flag dap.bowl] task]
    ++  add-self
      =/  =vessel:fleet:g  [~ now.bowl]
      =/  =action:g  [flag now.bowl %fleet (silt ~[our.bowl]) %add ~]
      (poke-host /join/add act:mar !>(action))
    ::
    ++  knock
      =/  ships=(set ship)  (~(put in *(set ship)) our.bowl)
      =/  =action:g  [flag now.bowl %cordon %shut %add-ships %ask ships]
      (poke-host /knock act:mar !>(action))
    ++  rescind
      =/  ships=(set ship)  (~(put in *(set ship)) our.bowl)
      =/  =action:g  [flag now.bowl %cordon %shut %del-ships %ask ships]
      (poke-host /rescind act:mar !>(action))
    ++  get-preview
      =/  =task:agent:gall  [%watch /groups/(scot %p p.flag)/[q.flag]/preview]
      (pass-host /preview task)
    --
  ++  ga-start-join
    ^+  ga-core
    =.  cor  (emit add-self:ga-pass)
    ga-core
  ::
  ++  ga-cancel
    ^+  ga-core
    =.  cam.gang  ~
    =.  cor  ga-give-update
    ga-core
  ::
  ++  ga-knock
    ^+  ga-core
    =.  cor  (emit knock:ga-pass)
    ga-core
  ++  ga-rescind
    ^+  ga-core
    =.  cor  (emit rescind:ga-pass)
    ga-core
  ++  ga-watch
    |=  =(pole knot)
    ^+  ga-core
    =.  cor  (emit get-preview:ga-pass)
    ga-core
  ::
  ++  ga-give-update
    (give %fact ~[/gangs/updates] gangs+!>((~(put by xeno) flag gang)))
  ++  ga-agent
    |=  [=wire =sign:agent:gall]
    ^+  ga-core
    ?+    wire  ~|(bad-agent-take/wire !!)
          [%invite ~]
        ?>  ?=(%poke-ack -.sign)
        :: ?~  p.sign  ga-core
        :: %-  (slog leaf/"Failed to invite {<ship>}" u.p.sign)
        ga-core
      ::
          [%preview ~]
        ?+  -.sign  ~|(weird-take/[wire -.sign] !!)
          %watch-ack
          ?~  p.sign  ga-core :: TODO: report retreival failure
          %-  (slog u.p.sign)
          ga-core
          ::
            %fact
          ?.  =(%group-preview p.cage.sign)  ga-core
          =+  !<(=preview:g q.cage.sign)
          =.  pev.gang  `preview
          =.  cor  ga-give-update
          =/  =path  (snoc ga-area %preview)
          =.  cor
            (emit %give %fact ~[path] cage.sign)
          =.  cor
            (emit %give %kick ~[path] ~)
          ?:  from-self  ga-core
          ?~  pev.gang   ga-core
          ?~  vit.gang   ga-core
          =/  link  /find
          =/  yarn
            %-  spin
            :*  [`flag ~ q.byk.bowl /(scot %p p.flag)/[q.flag]/invite]
                link
                `['Join Group' link]
                :~  [%ship src.bowl]
                    ' sent you an invite to '
                    [%emph title.meta.u.pev.gang]
                ==
            ==
          =.  cor  (emit (pass-hark & & yarn))
          ga-core
          ::
            %kick
          ?.  (~(has by xeno) flag)  ga-core
          ?^  pev.gang  ga-core
          ga-core(cor (emit get-preview:ga-pass))
        ==
      ::
          [%join %add ~]
        ?>  ?=(%poke-ack -.sign)
        ?>  ?=(^ cam.gang)
        ?^  p.sign
          =.  progress.u.cam.gang  %error
          %-  (slog leaf/"Joining failed" u.p.sign)
          ga-core
        =.  progress.u.cam.gang  %watching
        =/  =net:g  [%sub now.bowl | %chi ~]
        =|  =group:g
        =.  groups  (~(put by groups) flag net group)
        ::
        =.  cor
          go-abet:(go-sub:(go-abed:group-core flag) &)
        ga-core
          [%knock ~]
        ?>  ?=(%poke-ack -.sign)
        ?>  ?=(^ cam.gang)
        ?^  p.sign
          =.  progress.u.cam.gang  %error
          %-  (slog leaf/"Knocking failed" u.p.sign)
          ga-core
        =.  cor  ga-give-update
        ga-core
          [%rescind ~]
        ?>  ?=(%poke-ack -.sign)        
        ?^  p.sign
          ?>  ?=(^ cam.gang)
          =.  progress.u.cam.gang  %error
          %-  (slog leaf/"Rescind failed" u.p.sign)
          ga-core
        =.  cam.gang  ~
        =.  cor  ga-give-update
        ga-core
    ==
  ::
  ++  ga-watched
    |=  p=(unit tang)
    ?>  ?=(^ cam.gang)
    ?^  p
      %-  (slog leaf/"Failed to join" u.p)
      =.  progress.u.cam.gang  %error
      ga-core
    ga-core
  ::
  ++  ga-invite
    |=  =invite:g
    =.  vit.gang  `invite
    =.  cor  (emit get-preview:ga-pass)
    =.  cor  ga-give-update
    ga-core
  ::
  ++  ga-invite-reject
    ^+  ga-core
    =.  vit.gang  ~
    =.  cor  ga-give-update
    ga-core
  --
--

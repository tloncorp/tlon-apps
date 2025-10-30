/-  u=ui, gv=groups-ver, c=chat, cv=chat-ver, d=channels, a=activity
/+  default-agent, dbug, verb, vita-client
::  performance, keep warm
/+  mark-warmer
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  +$  current-state
    $:  %3
        hidden-contact-suggestions=(set ship)
        manual-contact-suggestions=(set ship)
        pins=(list whom:u)
        first-load=?
    ==
  --
=|  current-state
=*  state  -
=<
  %^  verb  |  %warn
  %-  agent:dbug
  %-  (agent:vita-client [| ~sogryp-dister-dozzod-dozzod])
  |_  =bowl:gall
  +*  this  .
      def   ~(. (default-agent this %.n) bowl)
      cor   ~(. +> [bowl ~])
  ++  on-init
    ^-  (quip card _this)
    =^  cards  state
      abet:init:cor
    [cards this]
  ::
  ++  on-save   !>(state)
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
  ++  on-watch  on-watch:def
  ++  on-leave  on-leave:def
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
  ++  on-fail   on-fail:def
  ++  on-peek   peek:cor
  --
|_  [=bowl:gall cards=(list card)]
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
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
++  init
  ^+  cor
  =/  =cage  settings-event+!>([%put-entry %groups %groups %'showActivityMessage' [%b &]])
  =?  cor  first-load  (emit %pass /set-activity %agent [our.bowl %settings] %poke cage)
  =.  first-load  |
  cor
::
++  load
  |=  =vase
  |^  ^+  cor
      =+  !<(old=versioned-state vase)
      =?  old  ?=(~ old)     *current-state
      =?  old  ?=(%0 -.old)  (state-0-to-1 old)
      =?  old  ?=(%1 -.old)  (state-1-to-2 old)
      =?  old  ?=(%2 -.old)  (state-2-to-3 old)
      ?>  ?=(%3 -.old)
      =.  state  old
      init
  ::
  +$  versioned-state  $@(~ $%(state-3 state-2 state-1 state-0))
  +$  state-3  current-state
  +$  state-2
    $:  %2
        hidden-contact-suggestions=(set ship)
        pins=(list whom:u)
        first-load=?
    ==
  +$  state-1
    $:  %1
        pins=(list whom:u)
        first-load=?
    ==
  ::
  ++  state-2-to-3
    |=(state-2 [%3 hidden-contact-suggestions ~ pins first-load])
  ++  state-1-to-2
    |=(state-1 [%2 ~ pins first-load])
  +$  state-0  [%0 first-load=?]
  ++  state-0-to-1
    |=(state-0 [%1 ~ first-load])
  --
::
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  ?+    pole  [~ ~]
      [%x %pins ~]  ``ui-pins+!>(pins)
  ::
      [%x %hidden-contact-suggestions ~]
    ``ships+!>(hidden-contact-suggestions)
  ::
      [%x %suggested-contacts ~]
    ``ships+!>(get-suggested-contacts)
  ::
      [%x %init ~]
    =+  .^([=groups-ui:v2:gv =gangs:v2:gv] (scry %gx %groups /init/v1/noun))
    =+  .^([=unreads:d channels=channels:v1:old:d] (scry %gx %channels /v1/init/noun))
    =+  .^(chat=chat-0:u (scry %gx %chat /init/noun))
    =+  .^(profile=? (scry %gx %profile /bound/loob))
    =/  init=init-0:u
      :*  groups-ui
          gangs
          channels
          unreads
          pins
          chat
          profile
      ==
    ``ui-init+!>(`init-0:u`init)
      [%x %v1 %init ~]
    =+  .^([=groups-ui:v2:gv =gangs:v2:gv] (scry %gx %groups /init/v1/noun))
    =+  .^([=unreads:d =channels:v1:old:d] (scry %gx %channels /v2/init/noun))
    =+  .^(chat=chat-0:u (scry %gx %chat /init/noun))
    =+  .^(profile=? (scry %gx %profile /bound/loob))
    =/  init=init-1:u
      :*  groups-ui
          gangs
          channels
          unreads
          pins
          chat
          profile
      ==
    ``ui-init-1+!>(`init-1:u`init)
  ::
      [%x %v1 %heads since=?(~ [u=@ ~])]
    =+  .^(chan=channel-heads:v7:d (scry %gx %channels %v2 %heads (snoc since.pole %channel-heads)))
    =+  .^(chat=chat-heads:v3:cv (scry %gx %chat %heads (snoc since.pole %chat-heads)))
    ``ui-heads+!>(`mixed-heads:u`[chan chat])
  ::
      [%x %v2 %heads since=?(~ [u=@ ~])]
    =+  .^(chan=channel-heads:v8:d (scry %gx %channels %v3 %heads (snoc since.pole %channel-heads-2)))
    =+  .^(chat=chat-heads:v5:cv (scry %gx %chat %v2 %heads (snoc since.pole %chat-heads-2)))
    ``ui-heads-2+!>(`mixed-heads-2:u`[chan chat])
  ::
      [%x %v3 %heads since=?(~ [u=@ ~])]
    =+  .^(chan=channel-heads:v9:d (scry %gx %channels %v4 %heads (snoc since.pole %channel-heads-3)))
    =+  .^(chat=chat-heads:v6:cv (scry %gx %chat %v3 %heads (snoc since.pole %chat-heads-3)))
    ``ui-heads-3+!>(`mixed-heads-3:u`[chan chat])
  ::
      [%x %v2 %init ~]
    =+  .^([=groups-ui:v2:gv =gangs:v2:gv] (scry %gx %groups /init/v1/noun))
    =+  .^([* =channels:v1:d] (scry %gx %channels /v2/init/noun))
    =+  .^(chat=chat-0:u (scry %gx %chat /init/noun))
    =+  .^(=activity:v2:old:a (scry %gx %activity /activity/noun))
    =+  .^(profile=? (scry %gx %profile /bound/loob))
    =/  init=init-2:u
      :*  groups-ui
          gangs
          channels
          activity
          pins
          [clubs dms invited]:chat
          profile
      ==
    ``ui-init-2+!>(`init-2:u`init)
  ::
      [%x %v3 %init ~]
    =+  .^([=groups-ui:v2:gv =gangs:v2:gv] (scry %gx %groups /init/v1/noun))
    =+  .^([* =channels:v1:d] (scry %gx %channels /v2/init/noun))
    =+  .^(chat=chat-0:u (scry %gx %chat /init/noun))
    =+  .^(=activity:v3:old:a (scry %gx %activity /v1/activity/noun))
    =+  .^(profile=? (scry %gx %profile /bound/loob))
    =/  init=init-3:u
      :*  groups-ui
          gangs
          channels
          activity
          pins
          [clubs dms invited]:chat
          profile
      ==
    ``ui-init-3+!>(`init-3:u`init)
  ::
      [%x %v4 %init ~]
    =+  .^([=groups-ui:v2:gv =gangs:v2:gv] (scry %gx %groups /init/v1/noun))
    =+  .^(=channel-0:u (scry %gx %channels /v3/init/noun))
    =+  .^(chat=chat-2:u (scry %gx %chat /v1/init/noun))
    =+  .^(=activity:a (scry %gx %activity /v4/activity/noun))
    =+  .^(profile=? (scry %gx %profile /bound/loob))
    =/  init=init-4:u
      :*  groups-ui
          gangs
          channel-0
          activity
          pins
          chat
          profile
      ==
    ``ui-init-4+!>(init)
  ::
      [%x %v5 %init ~]
    =+  .^([=groups-ui:v7:gv =foreigns:v8:gv] (scry %gx %groups /v2/init/noun))
    =+  .^(=channel-8:u (scry %gx %channels /v4/init/noun))
    =+  .^(chat=chat-2:u (scry %gx %chat /v1/init/noun))
    =+  .^(=activity:a (scry %gx %activity /v4/activity/noun))
    =+  .^(profile=? (scry %gx %profile /bound/loob))
    =/  init=init-5:u
      :*  groups-ui
          foreigns
          channel-8
          activity
          pins
          chat
          profile
      ==
    ``ui-init-5+!>(init)
  ::
      [%x %v6 %init ~]
    =+  .^([=groups-ui:v9:gv =foreigns:v8:gv] (scry %gx %groups /v3/init/noun))
    =+  .^(=channel-8:u (scry %gx %channels /v4/init/noun))
    =+  .^(chat=chat-2:u (scry %gx %chat /v1/init/noun))
    =+  .^(=activity:a (scry %gx %activity /v4/activity/noun))
    =+  .^(profile=? (scry %gx %profile /bound/loob))
    =/  init=init-6:u
      :*  groups-ui
          foreigns
          channel-8
          activity
          pins
          chat
          profile
      ==
    ``ui-init-6+!>(init)
  ::
      [%x %v5 %changes since=@ ~]
    =+  .^(activity=json (scry %gx %activity /v4/activity/changes/[since.pole]/json))
    =+  .^(channels=json (scry %gx %channels /v5/changes/[since.pole]/json))
    =+  .^(chat=json (scry %gx %chat /v3/changes/[since.pole]/json))
    =+  .^(groups=json (scry %gx %groups /v1/changes/[since.pole]/json))
    =+  .^(contacts=json (scry %gx %contacts /v1/changes/[since.pole]/json))
    :^  ~  ~  %json
    !>  %-  pairs:enjs:format
    :~  'activity'^activity
        'channels'^channels
        'chat'^chat
        'groups'^groups
        'contacts'^contacts
    ==
  ::
      [%x %v6 %changes since=@ ~]
    =+  .^(activity=json (scry %gx %activity /v4/activity/changes/[since.pole]/json))
    =+  .^(channels=json (scry %gx %channels /v5/changes/[since.pole]/json))
    =+  .^(chat=json (scry %gx %chat /v3/changes/[since.pole]/json))
    =+  .^(groups=json (scry %gx %groups /v1/changes/[since.pole]/json))
    =+  .^(contacts=json (scry %gx %contacts /v2/changes/[since.pole]/json))
    :^  ~  ~  %json
    !>  %-  pairs:enjs:format
    :~  'activity'^activity
        'channels'^channels
        'chat'^chat
        'groups'^groups
        'contacts'^contacts
    ==
  ::
      [%x %v7 %changes since=@ ~]
    =+  .^(activity=json (scry %gx %activity /v4/activity/changes/[since.pole]/json))
    =+  .^(channels=json (scry %gx %channels /v5/changes/[since.pole]/json))
    =+  .^(chat=json (scry %gx %chat /v3/changes/[since.pole]/json))
    =+  .^(groups=json (scry %gx %groups /v2/changes/[since.pole]/json))
    =+  .^(contacts=json (scry %gx %contacts /v2/changes/[since.pole]/json))
    :^  ~  ~  %json
    !>  %-  pairs:enjs:format
    :~  'activity'^activity
        'channels'^channels
        'chat'^chat
        'groups'^groups
        'contacts'^contacts
    ==
  ::
      [%x %v5 %init-posts channels=@ context=@ ~]
    =+  .^(channels=json (scry %gx %channels /v5/init-posts/[channels.pole]/[context.pole]/json))
    =+  .^(chat=json (scry %gx %chat /v3/init-posts/[channels.pole]/[context.pole]/json))
    :^  ~  ~  %json
    !>  %-  pairs:enjs:format
    :~  'channels'^channels
        'chat'^chat
    ==
  ==
::
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?+    mark  ~|(bad-mark/mark !!)
    %ui-vita  (emit (active:vita-client bowl))
    %ui-import-pals  import-pals
  ::
      %ui-show-contact
    =+  !<(=ship vase)
    =.  hidden-contact-suggestions
      (~(del in hidden-contact-suggestions) ship)
    cor
  ::
      %ui-hide-contact
    =+  !<(=ship vase)
    =.  hidden-contact-suggestions
      (~(put in hidden-contact-suggestions) ship)
    cor
  ::
      %ui-add-contact-suggestions
    =+  ship-list=!<((list @p) vase)
    =.  manual-contact-suggestions
      (~(gas in manual-contact-suggestions) ship-list)
    cor
  ::
      %ui-vita-toggle
    =+  !<(=vita-enabled:u vase)
    (emit %pass /vita-toggle %agent [our.bowl dap.bowl] %poke vita-client+!>([%set-enabled vita-enabled]))
  ::
      %ui-action
    =+  !<(=action:u vase)
    ?>  ?=(%pins -.action)
    =.  pins
      ?-  -.a-pins.action
        %del  (skip pins (cury test whom.a-pins.action))
      ::
          %add
        ::  be careful not to insert duplicates
        ::
        |-
        ?~  pins  [whom.a-pins.action]~
        ?:  =(i.pins whom.a-pins.action)  pins
        [i.pins $(pins t.pins)]
      ==
    ::TODO  eventually, give %fact if that changed anything
    cor
  ==
::
++  agent
  |=  [=(pole knot) =sign:agent:gall]
  ^+  cor
  ?+    pole  ~|(bad-agent-take/pole !!)
    ~  cor
    [%contact ~]  cor
    [%vita-toggle ~]  cor
    [%set-activity ~]  cor
  ==
::
++  arvo
  |=  [=wire sign=sign-arvo]
  ^+  cor
  ?+  wire  !!
    [%build ~]  cor
  ==
++  get-suggested-contacts
  =+  .^(chat-running=? (scry %gu %chat /$))
  =/  suggestions=(set ship)  manual-contact-suggestions
  =?  suggestions  chat-running
    =+  .^  [dms=(map ship dm:c) *]
      (scry %gx %chat /full/noun)
    ==
    %-  ~(uni in suggestions)
    %-  sy
    %+  murn
      ~(tap by dms)
    |=  [=ship =dm:c]
    ?~  latest=(ram:on:writs:c wit.pact.dm)  ~
    =/  count  (wyt:on:writs:c wit.pact.dm)
    =/  cutoff  (sub now.bowl ~d30)
    ?.  &((gth count 10) (gth -.u.latest cutoff))  ~
    `ship
  =+  .^(pals-running=? (scry %gu %pals /$))
  =?  suggestions  pals-running
    =+  .^(targets=(set ship) (scry %gx %pals /targets/noun))
    (~(uni in suggestions) targets)
  (~(dif in suggestions) hidden-contact-suggestions)
++  import-pals
  =+  .^(pals-running=? (scry %gu %pals /$))
  ?.  pals-running  cor
  =+  .^(targets=(set ship) (scry %gx %pals /targets/noun))
  %-  emil
  %+  turn
    ~(tap in targets)
  |=  =ship
  [%pass /contact %agent [our.bowl %contacts] %poke contact-action-1+!>([%page ship ~])]
--

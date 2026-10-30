/-  u=ui, gv=groups-ver, c=chat, cv=chat-ver, d=channels, dv=channels-ver,
    a=activity, av=activity-ver, b=buckets, ct=contacts
/+  default-agent, dbug, verb, vita-client, logs
::  performance, keep warm
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  +$  current-state
    $:  %4
        hidden-contact-suggestions=(set ship)
        manual-contact-suggestions=(set ship)
        discovered-contacts=(set ship)
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
      =?  old  ?=(%3 -.old)  (state-3-to-4 old)
      ?>  ?=(%4 -.old)
      =.  state  old
      init
  ::
  +$  versioned-state  $@(~ $%(state-4 state-3 state-2 state-1 state-0))
  +$  state-4  current-state
  +$  state-3
    $:  %3
        hidden-contact-suggestions=(set ship)
        manual-contact-suggestions=(set ship)
        pins=(list whom:u)
        first-load=?
    ==
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
  ++  state-3-to-4
    |=  state-3
    [%4 hidden-contact-suggestions manual-contact-suggestions ~ pins first-load]
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
      [%x %v1 %discovery-known ~]
    ``ships+!>(discovery-known)
  ::
      [%x %v1 %heads since=?(~ [u=@ ~])]
    =+  .^(chan=channel-heads:v7:dv (scry %gx %channels %v2 %heads (snoc since.pole %channel-heads)))
    =+  .^(chat=chat-heads:v3:cv (scry %gx %chat %heads (snoc since.pole %chat-heads)))
    ``ui-heads+!>(`mixed-heads:u`[chan chat])
  ::
      [%x %v2 %heads since=?(~ [u=@ ~])]
    =+  .^(chan=channel-heads:v8:dv (scry %gx %channels %v3 %heads (snoc since.pole %channel-heads-2)))
    =+  .^(chat=chat-heads:v5:cv (scry %gx %chat %v2 %heads (snoc since.pole %chat-heads-2)))
    ``ui-heads-2+!>(`mixed-heads-2:u`[chan chat])
  ::
      [%x %v3 %heads since=?(~ [u=@ ~])]
    =+  .^(chan=channel-heads:v9:dv (scry %gx %channels %v4 %heads (snoc since.pole %channel-heads-3)))
    =+  .^(chat=chat-heads:v6:cv (scry %gx %chat %v3 %heads (snoc since.pole %chat-heads-3)))
    ``ui-heads-3+!>(`mixed-heads-3:u`[chan chat])
  ::
      [%x %v4 %heads since=?(~ [u=@ ~])]
    =+  .^(chan=channel-heads:v10:dv (scry %gx %channels %v5 %heads (snoc since.pole %channel-heads-4)))
    =+  .^(chat=chat-heads:v7:cv (scry %gx %chat %v4 %heads (snoc since.pole %chat-heads-4)))
    ``ui-heads-4+!>(`mixed-heads-4:u`[chan chat])
  ::
      [%x %v4 %init ~]
    =+  .^([=groups-ui:v2:gv =gangs:v2:gv] (scry %gx %groups /init/v1/noun))
    =+  .^(=channel-0:u (scry %gx %channels /v3/init/noun))
    =+  .^(chat=chat-2:u (scry %gx %chat /v1/init/noun))
    =+  .^(=activity:v8:av (scry %gx %activity /v4/activity/noun))
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
    =+  .^(=activity:v8:av (scry %gx %activity /v4/activity/noun))
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
    =+  .^(=activity:v8:av (scry %gx %activity /v4/activity/noun))
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
      [%x %v7 %init ~]
    =+  .^([=groups-ui:v9:gv =foreigns:v8:gv] (scry %gx %groups /v3/init/noun))
    =+  .^(channel=channel-10:u (scry %gx %channels /v6/init/noun))
    =+  .^(chat=chat-2:u (scry %gx %chat /v1/init/noun))
    =+  .^(=activity:v8:av (scry %gx %activity /v4/activity/noun))
    =+  .^(profile=? (scry %gx %profile /bound/loob))
    =/  init=init-7:u
      :*  groups-ui
          foreigns
          channel
          activity
          pins
          chat
          profile
      ==
    ``ui-init-7+!>(init)
  ::
      [%x %v8 %init ~]
    =+  .^([=groups-ui:v9:gv =foreigns:v8:gv] (scry %gx %groups /v3/init/noun))
    =+  .^(channel=channel-10:u (scry %gx %channels /v6/init/noun))
    =+  .^(chat=chat-2:u (scry %gx %chat /v1/init/noun))
    =+  .^(=activity:v9:av (scry %gx %activity /v5/activity/noun))
    =+  .^(profile=? (scry %gx %profile /bound/loob))
    =/  init=init-8:u
      :*  groups-ui
          foreigns
          channel
          activity
          pins
          chat
          profile
      ==
    ``ui-init-8+!>(init)
  ::
  ::  /v9: v10-native activity (carries notebook/note sources)
  ::
      [%x %v9 %init ~]
    =+  .^([=groups-ui:v9:gv =foreigns:v8:gv] (scry %gx %groups /v3/init/noun))
    =+  .^(channel=channel-10:u (scry %gx %channels /v6/init/noun))
    =+  .^(chat=chat-2:u (scry %gx %chat /v1/init/noun))
    =+  .^(=activity:v10:av (scry %gx %activity /v6/activity/noun))
    =+  .^(profile=? (scry %gx %profile /bound/loob))
    =/  init=init-9:u
      :*  groups-ui
          foreigns
          channel
          activity
          pins
          chat
          profile
      ==
    ``ui-init-9+!>(init)
  ::
  ::  /v10: v11-native groups (carries the group blob)
  ::
      [%x %v10 %init ~]
    =+  .^([=groups-ui:v11:gv =foreigns:v8:gv] (scry %gx %groups /v4/init/noun))
    =+  .^(channel=channel-10:u (scry %gx %channels /v6/init/noun))
    =+  .^(chat=chat-2:u (scry %gx %chat /v1/init/noun))
    =+  .^(=activity:v10:av (scry %gx %activity /v6/activity/noun))
    =+  .^(profile=? (scry %gx %profile /bound/loob))
    =/  init=init-10:u
      :*  groups-ui
          foreigns
          channel
          activity
          pins
          chat
          profile
      ==
    ``ui-init-10+!>(init)
  ::
  ::  /v11: buckets, whose writer roles no agent but their own models
  ::
      [%x %v11 %init ~]
    =+  .^([=groups-ui:v11:gv =foreigns:v8:gv] (scry %gx %groups /v4/init/noun))
    =+  .^(channel=channel-10:u (scry %gx %channels /v6/init/noun))
    =+  .^(chat=chat-2:u (scry %gx %chat /v1/init/noun))
    =+  .^(=activity:v10:av (scry %gx %activity /v6/activity/noun))
    =+  .^(profile=? (scry %gx %profile /bound/loob))
    ::  Safe to read unguarded: %buckets ships in this desk's bill, so it is
    ::  running wherever this arm is.
    =+  .^(buckets=(list summary:b) (scry %gx %buckets /v1/buckets/noun))
    =/  init=init-11:u
      :*  groups-ui
          foreigns
          channel
          activity
          pins
          chat
          profile
          buckets
      ==
    ``ui-init-11+!>(init)
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
      [%x %v8 %changes since=@ ~]
    =+  .^(activity=json (scry %gx %activity /v4/activity/changes/[since.pole]/json))
    =+  .^(channels=json (scry %gx %channels /v6/changes/[since.pole]/json))
    =+  .^(chat=json (scry %gx %chat /v4/changes/[since.pole]/json))
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
      [%x %v9 %changes since=@ ~]
    =+  .^(activity=json (scry %gx %activity /v5/activity/changes/[since.pole]/json))
    =+  .^(channels=json (scry %gx %channels /v6/changes/[since.pole]/json))
    =+  .^(chat=json (scry %gx %chat /v4/changes/[since.pole]/json))
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
  ::  /v10: v10-native activity (carries notebook/note sources)
  ::
      [%x %v10 %changes since=@ ~]
    =+  .^(activity=json (scry %gx %activity /v6/activity/changes/[since.pole]/json))
    =+  .^(channels=json (scry %gx %channels /v6/changes/[since.pole]/json))
    =+  .^(chat=json (scry %gx %chat /v4/changes/[since.pole]/json))
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
  ::  /v11: v11-native groups (carries the group blob)
  ::
      [%x %v11 %changes since=@ ~]
    =+  .^(activity=json (scry %gx %activity /v6/activity/changes/[since.pole]/json))
    =+  .^(channels=json (scry %gx %channels /v6/changes/[since.pole]/json))
    =+  .^(chat=json (scry %gx %chat /v4/changes/[since.pole]/json))
    =+  .^(groups=json (scry %gx %groups /v3/changes/[since.pole]/json))
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
    ::TODO bump chat
    =+  .^(chat=json (scry %gx %chat /v3/init-posts/[channels.pole]/[context.pole]/json))
    :^  ~  ~  %json
    !>  %-  pairs:enjs:format
    :~  'channels'^channels
        'chat'^chat
    ==
  ::
      [%x %v6 %init-posts channels=@ context=@ ~]
    =+  .^(channels=json (scry %gx %channels /v6/init-posts/[channels.pole]/[context.pole]/json))
    =+  .^(chat=json (scry %gx %chat /v4/init-posts/[channels.pole]/[context.pole]/json))
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
      %ui-discover-contacts
    ?>  =(our src):bowl
    (discover-contacts !<((list discovered-contact:u) vase))
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
      ::
          %set-order
        ::  reorder, in place, only the pins the payload names: build the
        ::  requested sequence (payload that is already pinned, deduped), then
        ::  walk the current order substituting the next requested item at each
        ::  named slot and leaving omitted pins where they are
        ::
        =/  cur=(set whom:u)  (sy pins)
        =/  want=(list whom:u)
          =/  ord=(list whom:u)  order.a-pins.action
          =|  seen=(set whom:u)
          |-  ^-  (list whom:u)
          ?~  ord  ~
          ?:  ?|((~(has in seen) i.ord) !(~(has in cur) i.ord))
            $(ord t.ord)
          [i.ord $(seen (~(put in seen) i.ord), ord t.ord)]
        =/  want-set=(set whom:u)  (sy want)
        |-  ^-  (list whom:u)
        ?~  pins  ~
        ?.  (~(has in want-set) i.pins)
          [i.pins $(pins t.pins)]
        ?~  want  $(pins t.pins)
        [i.want $(pins t.pins, want t.want)]
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
    [%logs ~]  cor
  ::
      [%discover ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  cor
    (emit (~(fail logs bowl /logs) %error ~['failed to save discovered contact'] u.p.sign ~))
  ::
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
  ::  discovered matches the user has since removed come back as suggestions
  ::
  =.  suggestions
    (~(uni in suggestions) (~(dif in discovered-contacts) book-ships))
  (~(dif in suggestions) hidden-contact-suggestions)
::  +book-ships: ships saved in the address book
::
++  book-ships
  ^-  (set ship)
  =+  .^(=book:ct (scry %gx %contacts /v1/book/contact-book-0))
  %-  sy
  %+  murn  ~(tap in ~(key by book))
  |=(=kip:ct ?@(kip `kip ~))
::  +discovery-known: ships contact discovery leaves alone
::
::    saved, suggested and hidden ships already have a relationship with the
::    user, and discovered ones have been announced before.
::
++  discovery-known
  ^-  (set ship)
  %-  ~(uni in discovered-contacts)
  %-  ~(uni in hidden-contact-suggestions)
  (~(uni in get-suggested-contacts) book-ships)
::  +discover-contacts: record address-book matches and save the new ones
::
++  discover-contacts
  |=  matches=(list discovered-contact:u)
  ^+  cor
  =/  known  discovery-known
  =/  new=(map ship (unit @t))
    %-  malt
    %+  skip  matches
    |=(d=discovered-contact:u (~(has in known) ship.d))
  =.  discovered-contacts  (~(uni in discovered-contacts) ~(key by new))
  %-  emil
  %+  turn  ~(tap by new)
  |=  [=ship nickname=(unit @t)]
  ^-  card
  =/  =contact:ct
    ?~  nickname  ~
    ?:  =('' u.nickname)  ~
    (~(put by *contact:ct) %nickname text+u.nickname)
  [%pass /discover %agent [our.bowl %contacts] %poke contact-action-1+!>(`action:ct`[%page ship contact])]
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

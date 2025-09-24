/-  c=chat, cv=chat-ver, d=channels, g=groups
/-  u=ui, e=epic, activity, s=story, meta
/-  ha=hark
/-  contacts-0
/+  default-agent, verb-lib=verb, dbug,
    neg=negotiate, discipline, logs,
    em=emojimart
/+  pac=dm
/+  cc=chat-conv, chc=channel-conv
/+  utils=channel-utils
/+  volume
/+  wood-lib=wood
::  performance, keep warm
/+  chat-json
::
/%  m-chat-blocked-by      %chat-blocked-by
/%  m-chat-changed-writs   %chat-changed-writs
/%  m-chat-club-action     %chat-club-action
/%  m-chat-club-action-0   %chat-club-action-0
/%  m-chat-club-action-1   %chat-club-action-1
/%  m-chat-dm-action       %chat-dm-action
/%  m-chat-dm-action-1     %chat-dm-action-1
/%  m-chat-dm-diff         %chat-dm-diff
/%  m-chat-dm-diff-1       %chat-dm-diff-1
/%  m-chat-heads           %chat-heads
/%  m-chat-heads-1         %chat-heads-1
/%  m-chat-heads-2         %chat-heads-2
/%  m-chat-heads-3         %chat-heads-3
/%  m-chat-paged-writs     %chat-paged-writs
/%  m-chat-paged-writs-1   %chat-paged-writs-1
/%  m-chat-paged-writs-2   %chat-paged-writs-2
/%  m-chat-paged-writs-3   %chat-paged-writs-3
/%  m-chat-scam            %chat-scam
/%  m-chat-scam-1          %chat-scam-1
/%  m-chat-scam-2          %chat-scam-2
/%  m-chat-scam-3          %chat-scam-3
/%  m-chat-scan            %chat-scan
/%  m-chat-scan-1          %chat-scan-1
/%  m-chat-scan-2          %chat-scan-2
/%  m-chat-scan-3          %chat-scan-3
/%  m-chat-toggle-message  %chat-toggle-message
/%  m-chat-unblocked-by    %chat-unblocked-by
/%  m-chat-unread-update   %chat-unread-update
/%  m-chat-unreads         %chat-unreads
/%  m-chat-writ-1          %chat-writ-1
/%  m-chat-writ-2          %chat-writ-2
/%  m-chat-writ-3          %chat-writ-3
/%  m-clubs                %clubs
/%  m-epic                 %epic
/%  m-hidden-messages      %hidden-messages
/%  m-ships                %ships
/%  m-writ                 %writ
/%  m-writ-response        %writ-response
/%  m-writ-response-1      %writ-response-1
/%  m-writ-response-2      %writ-response-2
/%  m-writ-response-3      %writ-response-3
::
/*  desk-bill  %bill  /desk/bill  ::  keep warm
::
%-  %-  discipline
    :+  ::  marks
        ::
        :~  :+  %chat-blocked-by      &  -:!>(*vale:m-chat-blocked-by)
            :+  %chat-changed-writs   |  -:!>(*vale:m-chat-changed-writs)
            ::  our previous mark version was actually incorrect so to
            ::  correct, we need to turn off checking here
            ::  TODO: flip back on next upgrade
            :+  %chat-club-action     |  -:!>(*vale:m-chat-club-action)
            :+  %chat-club-action-0   &  -:!>(*vale:m-chat-club-action-0)
            :+  %chat-club-action-1   &  -:!>(*vale:m-chat-club-action-1)
            :+  %chat-dm-action       &  -:!>(*vale:m-chat-dm-action)
            :+  %chat-dm-action-1     &  -:!>(*vale:m-chat-dm-action-1)
            :+  %chat-dm-diff         &  -:!>(*vale:m-chat-dm-diff)
            :+  %chat-dm-diff-1       &  -:!>(*vale:m-chat-dm-diff-1)
            :+  %chat-heads           &  -:!>(*vale:m-chat-heads)
            :+  %chat-heads-1         &  -:!>(*vale:m-chat-heads-1)
            :+  %chat-heads-2         &  -:!>(*vale:m-chat-heads-2)
            :+  %chat-heads-3         &  -:!>(*vale:m-chat-heads-3)
            :+  %chat-paged-writs     &  -:!>(*vale:m-chat-paged-writs)
            :+  %chat-paged-writs-1   &  -:!>(*vale:m-chat-paged-writs-1)
            :+  %chat-paged-writs-2   &  -:!>(*vale:m-chat-paged-writs-2)
            :+  %chat-paged-writs-3   |  -:!>(*vale:m-chat-paged-writs-3)
            :+  %chat-scam            &  -:!>(*vale:m-chat-scam)
            :+  %chat-scam-1          &  -:!>(*vale:m-chat-scam-1)
            :+  %chat-scam-2          &  -:!>(*vale:m-chat-scam-2)
            :+  %chat-scam-3          &  -:!>(*vale:m-chat-scam-3)
            :+  %chat-scan            &  -:!>(*vale:m-chat-scan)
            :+  %chat-scan-1          &  -:!>(*vale:m-chat-scan-1)
            :+  %chat-scan-2          &  -:!>(*vale:m-chat-scan-2)
            :+  %chat-scan-3          &  -:!>(*vale:m-chat-scan-3)
            :+  %chat-toggle-message  &  -:!>(*vale:m-chat-toggle-message)
            :+  %chat-unblocked-by    &  -:!>(*vale:m-chat-unblocked-by)
            :+  %chat-unread-update   &  -:!>(*vale:m-chat-unread-update)
            :+  %chat-unreads         &  -:!>(*vale:m-chat-unreads)
            :+  %chat-writ-1          &  -:!>(*vale:m-chat-writ-1)
            :+  %chat-writ-2          &  -:!>(*vale:m-chat-writ-2)
            :+  %chat-writ-3          &  -:!>(*vale:m-chat-writ-3)
            :+  %clubs                &  -:!>(*vale:m-clubs)
            :+  %epic                 &  -:!>(*vale:m-epic)
            :+  %hidden-messages      &  -:!>(*vale:m-hidden-messages)
            :+  %ships                &  -:!>(*vale:m-ships)
            :+  %writ                 &  -:!>(*vale:m-writ)
            :+  %writ-response        &  -:!>(*vale:m-writ-response)
            :+  %writ-response-1      &  -:!>(*vale:m-writ-response-1)
            :+  %writ-response-2      &  -:!>(*vale:m-writ-response-2)
            :+  %writ-response-3      &  -:!>(*vale:m-writ-response-3)
        ==
      ::  facts
      ::
      :~  [/ %chat-blocked-by %chat-unblocked-by %chat-toggle-message %chat-club-action %writ-response %ships ~]
          [/club/$ %writ-response ~]
          [/clubs %chat-club-action ~]
          [/dm/$ %writ-response ~]
          [/dm/invited %ships ~]
          [/epic %epic ~]
          [/unreads %chat-unread-update ~]
        ::
          [/v1 %chat-club-action-1 %writ-response-1 ~]
          [/v1/club/$ %writ-response-1 ~]
          [/v1/clubs %chat-club-action-1 ~]
          [/v1/dm/$ %writ-response-1 ~]
        ::
          [/v2 %chat-club-action-1 %writ-response-2 ~]
          [/v2/club/$ %writ-response-2 ~]
          [/v2/clubs %chat-club-action-1 ~]
          [/v2/dm/$ %writ-response-2 ~]
        ::
          [/v3 %chat-club-action-1 %writ-response-3 ~]
          [/v3/club/$ %writ-response-3 ~]
          [/v3/clubs %chat-club-action-1 ~]
          [/v3/dm/$ %writ-response-3 ~]
      ==
    ::  scries
    ::
    :~  [/x/blocked %ships]
        [/x/blocked-by %ships]
        [/x/clubs %clubs]
        [/x/dm %ships]
        [/x/dm/$/search %chat-scan]
        [/x/dm/$/search/bounded %chat-scam]
        [/x/dm/$/writs %chat-paged-writs]
        [/x/dm/$/writs/writ %writ]
        [/x/dm/archive %ships]
        [/x/dm/invited %ships]
        [/x/full %noun]
        [/x/heads %chat-heads]
        [/x/hidden-messages %hidden-messages]
        [/x/init %noun]
        [/x/old %noun]
        [/x/unreads %chat-unreads]
      ::
        [/x/v1/club/$/search %chat-scan-1]
        [/x/v1/club/$/search/bounded %chat-scam-1]
        [/x/v1/club/$/writs %chat-paged-writs-1]
        [/x/v1/club/$/writs/writ %chat-writ-1]
        [/x/v1/dm/$/search %chat-scan-1]
        [/x/v1/dm/$/search/bounded %chat-scam-1]
        [/x/v1/dm/$/writs %chat-paged-writs-1]
        [/x/v1/dm/$/writs/writ %chat-writ-1]
        [/x/v1/heads %chat-heads-1]
        [/x/v1/init %noun]
      ::
        [/x/v2/club/$/search %chat-scan-2]
        [/x/v2/club/$/search/bounded %chat-scam-2]
        [/x/v2/club/$/writs %chat-paged-writs-2]
        [/x/v2/club/$/writs/writ %chat-writ-2]
        [/x/v2/dm/$/search %chat-scan-2]
        [/x/v2/dm/$/search/bounded %chat-scam-2]
        [/x/v2/dm/$/writs %chat-paged-writs-2]
        [/x/v2/dm/$/writs/writ %chat-writ-2]
        [/x/v2/heads %chat-heads-2]
      ::
        [/x/v3/changes/$ %chat-changed-writs]
        [/x/v3/club/$/search %chat-scan-3]
        [/x/v3/club/$/search/bounded %chat-scam-3]
        [/x/v3/club/$/writs %chat-paged-writs-3]
        [/x/v3/club/$/writs/writ %chat-writ-3]
        [/x/v3/dm/$/search %chat-scan-3]
        [/x/v3/dm/$/search/bounded %chat-scam-3]
        [/x/v3/dm/$/writs %chat-paged-writs-3]
        [/x/v3/dm/$/writs/writ %chat-writ-3]
        [/x/v3/heads %chat-heads-3]
        [/x/v3/init-posts %chat-changed-writs]
    ==
::
%-  %-  agent:neg
    :+  |
      [~.chat-dms^%1 ~ ~]
    [%chat^[~.chat-dms^%1 ~ ~] ~ ~]
%-  agent:dbug
%+  verb-lib  |
::
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  ++  okay  `epic:e`1
  ++  wood-state
    ^-  state:wood-lib
    :*  ver=|
        odd=&
        veb=|
    ==
  ++  club-eq  2 :: reverb control: max number of forwards for clubs
  +$  current-state
    $:  %10
        dms=(map ship dm:c)
        clubs=(map id:club:c club:c)
        pins=(list whom:c)
        sends=(map whom:c (qeu sent-id))
        blocked=(set ship)
        blocked-by=(set ship)
        hidden-messages=(set id:c)
        old-chats=(map flag:v2:cv chat:v2:cv)  :: for migration
        old-pins=(list whom:v2:cv)
    ==
  +$  sent-id
    $@  time             ::  top-level msg
    [top=id:c new=time]  ::  or reply
  --
=|  current-state
=*  state  -
=<
  |_  =bowl:gall
  +*  this  .
      def   ~(. (default-agent this %|) bowl)
      log   ~(. logs [our.bowl /logs])
      cor   ~(. +> [bowl ~])
  ++  on-init
    ^-  (quip card _this)
    =^  cards  state
      abet:init:cor
    [cards this]
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
  ++  on-fail
    |=  [=term =tang]
    ^-  (quip card _this)
    :_  this
    [(fail:log term tang ~)]~
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
+*  wood  ~(. wood-lib [bowl wood-state])
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
++  now-id   `id:c`[our now]:bowl
++  scry-path
  |=  [agent=term =path]
  ^-  ^path
  (welp /(scot %p our.bowl)/[agent]/(scot %da now.bowl) path)
++  init  cor
::  +load: load next state
++  load
  |^  |=  =vase
  ^+  cor
  =+  !<([old=versioned-state cool=@ud] vase)
  =?  old  ?=(%2 -.old)  (state-2-to-3 old)
  =?  old  ?=(%3 -.old)  (state-3-to-4 old)
  =?  old  ?=(%4 -.old)  (state-4-to-5 old)
  =?  old  ?=(%5 -.old)  (state-5-to-6 old)
  =?  old  ?=(%6 -.old)  (state-6-to-7 old)
  =?  old  ?=(%7 -.old)  (state-7-to-8 old)
  =?  old  ?=(%8 -.old)  (state-8-to-9 old)
  =?  old  ?=(%9 -.old)  (state-9-to-10 old)
  ?>  ?=(%10 -.old)
  cor(state old)
  ::
  +$  versioned-state
    $%  state-10
        state-9
        state-8
        state-7
        state-6
        state-5
        state-4
        state-3
        state-2
    ==
  +$  state-2
    $:  %2
        chats=(map flag:v2:cv chat:v2:cv)
        dms=(map ship dm:v2:cv)
        clubs=(map id:club:v2:cv club:v2:cv)
        drafts=(map whom:v2:cv story:v2:cv)
        pins=(list whom:v2:cv)
        bad=(set ship)
        inv=(set ship)
        voc=(map [flag:v2:cv id:v2:cv] (unit said:v2:cv))
        fish=(map [flag:v2:cv @] id:v2:cv)
        ::  true represents imported, false pending import
        imp=(map flag:v2:cv ?)
    ==
  +$  state-3
    $:  %3
        chats=(map flag:v2:cv chat:v2:cv)
        dms=(map ship dm:v2:cv)
        clubs=(map id:club:v2:cv club:v2:cv)
        drafts=(map whom:v2:cv story:v2:cv)
        pins=(list whom:v2:cv)
        blocked=(set ship)
        blocked-by=(set ship)
        bad=(set ship)
        inv=(set ship)
        voc=(map [flag:v2:cv id:v2:cv] (unit said:v2:cv))
        fish=(map [flag:v2:cv @] id:v2:cv)
        ::  true represents imported, false pending import
        imp=(map flag:v2:cv ?)
    ==
  +$  state-4
    $:  %4
        chats=(map flag:v2:cv chat:v2:cv)
        dms=(map ship dm:v2:cv)
        clubs=(map id:club:v2:cv club:v2:cv)
        drafts=(map whom:v2:cv story:v2:cv)
        pins=(list whom:v2:cv)
        blocked=(set ship)
        blocked-by=(set ship)
        hidden-messages=(set id:v2:cv)
        bad=(set ship)
        inv=(set ship)
        voc=(map [flag:v2:cv id:v2:cv] (unit said:v2:cv))
        fish=(map [flag:v2:cv @] id:v2:cv)
        ::  true represents imported, false pending import
        imp=(map flag:v2:cv ?)
    ==
  +$  state-5
    $:  %5
        dms=(map ship dm-5)
        clubs=(map id:club:v3:cv club-5)
        pins=(list whom:v3:cv)
        bad=(set ship)
        inv=(set ship)
        blocked=(set ship)
        blocked-by=(set ship)
        hidden-messages=(set id:v3:cv)
        old-chats=(map flag:v2:cv chat:v2:cv)  :: for migration
        old-pins=(list whom:v2:cv)
    ==
  +$  club-5    [heard:club:v3:cv remark=remark-5 =pact:v3:cv crew:club:v3:cv]
  +$  dm-5      [=pact:v3:cv remark=remark-5 net:dm:v3:cv pin=_|]
  +$  remark-5  [last-read=time watching=_| unread-threads=(set id:c)]
  +$  state-6
    $:  %6
        dms=(map ship dm:v3:cv)
        clubs=(map id:club:v3:cv club:v3:cv)
        pins=(list whom:v3:cv)
        bad=(set ship)
        inv=(set ship)
        blocked=(set ship)
        blocked-by=(set ship)
        hidden-messages=(set id:c)
        old-chats=(map flag:v2:cv chat:v2:cv)  :: for migration
        old-pins=(list whom:v2:cv)
    ==
  +$  state-7
    $:  %7
        dms=(map ship dm:v3:cv)
        clubs=(map id:club:v3:cv club:v3:cv)
        pins=(list whom:v3:cv)
        sends=(map whom:v3:cv (qeu sent-id))
        blocked=(set ship)
        blocked-by=(set ship)
        hidden-messages=(set id:v3:cv)
        old-chats=(map flag:v2:cv chat:v2:cv)  :: for migration
        old-pins=(list whom:v2:cv)
    ==
  +$  state-8
    $:  %8
        dms=(map ship dm:v4:cv)
        clubs=(map id:club:v4:cv club:v4:cv)
        pins=(list whom:v4:cv)
        sends=(map whom:v4:cv (qeu sent-id))
        blocked=(set ship)
        blocked-by=(set ship)
        hidden-messages=(set id:v4:cv)
        old-chats=(map flag:v2:cv chat:v2:cv)  :: for migration
        old-pins=(list whom:v2:cv)
    ==
  +$  state-9
    $:  %9
        dms=(map ship dm:v5:cv)
        clubs=(map id:club:v5:cv club:v5:cv)
        pins=(list whom:v5:cv)
        sends=(map whom:v5:cv (qeu sent-id))
        blocked=(set ship)
        blocked-by=(set ship)
        hidden-messages=(set id:v5:cv)
        old-chats=(map flag:v2:cv chat:v2:cv)  :: for migration
        old-pins=(list whom:v2:cv)
    ==
  +$  state-10  current-state
  ::
  ++  state-9-to-10
    |=  state-9
    ^-  state-10
    :*  %10
        (~(run by dms) dm-9-to-10)
        (~(run by clubs) club-9-to-10)
        pins
        sends
        blocked
        blocked-by
        hidden-messages
        old-chats
        old-pins
    ==
  ++  club-9-to-10
    |=  =club:v5:cv
    ^-  club:v6:cv
    club(pact (pact-9-to-10 pact.club))
  ++  dm-9-to-10
    |=  =dm:v5:cv
    ^-  dm:v6:cv
    dm(pact (pact-9-to-10 pact.dm))
  ++  pact-9-to-10
    |=  pact:v5:cv
    ^-  pact:v6:cv
    =;  [num=@ud writs=(list [time (may:v6:cv writ:v6:cv)])]
      [num (gas:on:writs:v6:cv ~ writs) dex upd=~]
    %+  roll  (tap:on:writs:v5:cv wit)
    |=  [[=time =writ:v5:cv] num=@ud writs=(list [time (may:v6:cv writ:v6:cv)])]
    ^+  [num writs]
    =.  num  +(num)
    :-  num
    =/  new-writ  (v6:writ:v5:cc writ)
    [[time %& new-writ(seq num)] writs]
  ++  state-8-to-9
    |=  state-8
    ^-  state-9
    :*  %9
        (~(run by dms) dm-8-to-9)
        (~(run by clubs) club-8-to-9)
        pins
        sends
        blocked
        blocked-by
        hidden-messages
        old-chats
        old-pins
    ==
  ++  club-8-to-9
    |=  =club:v4:cv
    ^-  club:v5:cv
    club(pact (pact-8-to-9 pact.club))
  ++  dm-8-to-9
    |=  =dm:v4:cv
    ^-  dm:v5:cv
    dm(pact (pact-8-to-9 pact.dm))
  ++  pact-8-to-9
    |=  =pact:v4:cv
    ^-  pact:v5:cv
    =;  writs=(list [time writ:v5:cv])
      ::  default num here because it will be numbered above
      [0 (gas:on:writs:v5:cv ~ writs) dex.pact]
    %+  turn  (tap:on:writs:v4:cv wit.pact)
    |=  [=time =writ:v4:cv]
    [time (writ-8-to-9 writ)]
  ++  writ-8-to-9
    |=  =writ:v4:cv
    ^-  writ:v5:cv
    =,  -.writ
    ::  default seq here because it will be numbered above
    [[id 0 time reacts replies reply-meta] +.writ]
  ::
  ++  state-7-to-8
    |=  state-7
    ^-  state-8
    :*  %8
        (~(run by dms) dm-7-to-8)
        (~(run by clubs) club-7-to-8)
        pins
        sends
        blocked
        blocked-by
        hidden-messages
        old-chats
        old-pins
    ==
  ++  club-7-to-8
    |=  =club:v3:cv
    ^-  club:v4:cv
    club(pact (pact-7-to-8 pact.club))
  ++  dm-7-to-8
    |=  =dm:v3:cv
    ^-  dm:v4:cv
    dm(pact (pact-7-to-8 pact.dm))
  ++  pact-7-to-8
    |=  =pact:v3:cv
    ^-   pact:v4:cv
    pact(wit (run:on:writs:v3:cv wit.pact v4:writ:v3:cc))
  ::
  ++  state-6-to-7
    |=  state-6
    ^-  state-7
    [%7 dms clubs pins ~ blocked blocked-by hidden-messages old-chats old-pins]
  ++  state-5-to-6
    |=  s=state-5
    ^-  state-6
    s(- %6, dms (dms-5-to-6 dms.s), clubs (clubs-5-to-6 clubs.s))
  ::
  ++  dms-5-to-6
    |=  dms=(map ship dm-5)
    ^-  (map ship dm:v3:cv)
    %-  ~(run by dms)
    |=  dm=dm-5
    ^-  dm:v3:cv
    dm(remark (remark-5-to-6 wit.pact.dm remark.dm))
  ::
  ++  clubs-5-to-6
    |=  clubs=(map id:club:v3:cv club-5)
    ^-  (map id:club:v3:cv club:v3:cv)
    %-  ~(run by clubs)
    |=  club=club-5
    ^-  club:v3:cv
    club(remark (remark-5-to-6 wit.pact.club remark.club))
  ::
  ++  remark-5-to-6
    |=  [=writs:v3:cv remark=remark-5]
    ^-  remark:v3:cv
    :_  remark
    ?~(tim=(ram:on:writs:v3:cv writs) *time key.u.tim)
  ::
  ++  state-4-to-5
    |=  state-4
    ^-  state-5
    :-  %5
    :+  (dms-4-to-5 dms)
      (clubs-4-to-5 clubs)
    [(pins-4-to-5 pins) bad inv blocked blocked-by hidden-messages chats pins]
  ::
  ++  pins-4-to-5
    |=  pins=(list whom:v2:cv)
    ^-  (list whom:v3:cv)
    %+  murn  pins
    |=(w=whom:v2:cv ?:(?=(%flag -.w) ~ (some w)))
  ::
  ++  dms-4-to-5
    |=  dms=(map ship dm:v2:cv)
    ^-  (map ship dm-5)
    %-  ~(run by dms)
    |=  dm:v2:cv
    ^-  dm-5
    [(pact-4-to-5 pact) remark net pin]
  ::
  ++  clubs-4-to-5
    |=  clubs=(map id:club:v2:cv club:v2:cv)
    ^-  (map id:club:c club-5)
    %-  ~(run by clubs)
    |=  club:v2:cv
    [heard remark (pact-4-to-5 pact) crew]
  ::
  ++  pact-4-to-5
    |=  =pact:v2:cv
    ^-  pact:v3:cv
    :_  dex.pact
    =/  writs  (tap:on:writs:v2:cv wit.pact)
    =/  reply-index=(map @da replies:v3:cv)
      %+  roll  writs
      |=  [[=time =writ:v2:cv] reply-index=(map @da replies:v3:cv)]
      ?~  replying.writ  reply-index
      =/  old-replies=replies:v3:cv  (~(gut by reply-index) time *replies:v3:cv)
      =/  reply-time  (~(get by dex.pact) u.replying.writ)
      ?~  reply-time  reply-index
      %+  ~(put by reply-index)  u.reply-time
      (put:on:replies:v3:cv old-replies time (reply-4-to-5 u.replying.writ time writ))
    %+  gas:on:writs:v3:cv  *writs:v3:cv
    %+  murn  writs
    |=  [=time =writ:v2:cv]
    ^-  (unit [^time writ:v3:cv])
    ?^  replying.writ  ~
    =/  =replies:v3:cv  (~(gut by reply-index) time *replies:v3:cv)
    (some time (writ-4-to-5 time writ replies))
  ::
  ++  writ-4-to-5
    |=  [=time old=writ:v2:cv =replies:v3:cv]
    ^-  writ:v3:cv
    =;  qm=reply-meta:v7:d
      :-  [id.old time feels.old replies qm]
      (essay-4-to-5 +.old)
    ::
    =/  last-repliers=(set ship)
      =|  repliers=(set ship)
      =/  entries=(list [* reply:v3:cv])  (bap:on:replies:v3:cv replies)
      |-
      ?:  |(=(~ entries) =(3 ~(wyt in repliers)))
        repliers
      =/  [* =reply:v3:cv]  -.entries
      ?:  (~(has in repliers) author.reply)
        $(entries +.entries)
      (~(put in repliers) author.reply)
    :*  (wyt:on:replies:v3:cv replies)
        last-repliers
        (biff (ram:on:replies:v3:cv replies) |=([=^time *] `time))
    ==
  ::
  ++  reply-4-to-5
    |=  [parent-id=id:v3:cv =time old=writ:v2:cv]
    ^-  reply:v3:cv
    [[id.old parent-id time feels.old] (memo-4-to-5 +.old)]
  ::
  ++  memo-4-to-5
    |=  memo:v2:cv
    ^-  memo:v7:old:d
    [(story-4-to-5 author content) author sent]
  ::
  ++  essay-4-to-5
    |=  memo:v2:cv
    ^-  essay:v3:cv
    [(memo-4-to-5 +<) %chat ?-(-.content %story ~, %notice [%notice ~])]
  ::
  ++  story-4-to-5
    |=  [=ship old=content:v2:cv]
    ^-  story:v7:old:d
    ?-    -.old
        %notice  ~[%inline pfix.p.old ship+ship sfix.p.old]~
        %story
      %+  welp
        (turn p.p.old (lead %block))
      [%inline q.p.old]~
    ==
  ::
  ++  state-3-to-4
    |=  s=state-3
    ^-  state-4
    %*  .  *state-4
      dms     dms.s
      clubs   clubs.s
      drafts  drafts.s
      pins    pins.s
      blocked  blocked.s
      blocked-by  blocked-by.s
      hidden-messages  ~
      bad     bad.s
      inv     inv.s
      fish    fish.s
      voc     voc.s
      chats   chats.s
    ==
  ++  state-2-to-3
    |=  s=state-2
    ^-  state-3
    %*  .  *state-3
      dms     dms.s
      clubs   clubs.s
      drafts  drafts.s
      pins    pins.s
      blocked  ~
      blocked-by  ~
      bad     bad.s
      inv     inv.s
      fish    fish.s
      voc     voc.s
      chats   chats.s
    ==
  --
::
++  poke
  |=  [=mark =vase]
  |^  ^+  cor
  ?+    mark  ~|(bad-poke/mark !!)
      %chat-negotiate
    ::TODO  arguably should just be a /mar/negotiate
    (emit (initiate:neg !<(@p vase) dap.bowl))
  ::
      %chat-dm-rsvp
    =+  !<(=rsvp:dm:c vase)
    di-abet:(di-rsvp:(di-abed:di-core ship.rsvp) ok.rsvp)
  ::
      %chat-blocked
    ?<  from-self
    (has-blocked src.bowl)
  ::
      %chat-unblocked
    ?<  from-self
    (has-unblocked src.bowl)
  ::
      %chat-block-ship
    =+  !<(=ship vase)
    ?>  from-self
    (block ship)
  ::
      %chat-unblock-ship
    =+  !<(=ship vase)
    ?>  from-self
    (unblock ship)
  ::
      %chat-toggle-message
    =+  !<(toggle=message-toggle:c vase)
    ?>  from-self
    (toggle-message toggle)
  ::
      %chat-unblocked
    ?<  from-self
    (has-unblocked src.bowl)
  ::
      %chat-block-ship
    =+  !<(=ship vase)
    ?>  from-self
    (block ship)
  ::
      %chat-unblock-ship
    =+  !<(=ship vase)
    ?>  from-self
    (unblock ship)
  ::
      %chat-toggle-message
    =+  !<(toggle=message-toggle:c vase)
    ?>  from-self
    (toggle-message toggle)
  ::
      %chat-remark-action
    =+  !<(act=remark-action:c vase)
    ?-  -.p.act
      %ship  di-abet:(di-remark-diff:(di-abed:di-core p.p.act) q.act)
      %club  cu-abet:(cu-remark-diff:(cu-abed:cu-core p.p.act) q.act)
    ==
  ::
      %chat-dm-action-1
    =+  !<(=action:dm:c vase)
    ::  don't allow anyone else to proxy through us
    ?.  =(src.bowl our.bowl)
      ~|("%dm-action poke failed: only allowed from self" !!)
    ::  don't proxy to self, creates an infinite loop
    ?:  =(p.action our.bowl)
      di-abet:(di-ingest-diff:(di-abed-soft:di-core p.action) q.action)
    di-abet:(di-proxy:(di-abed-soft:di-core p.action) q.action)
  ::
      %chat-dm-diff-1
    =+  !<(=diff:dm:c vase)
    di-abet:(di-take-counter:(di-abed-soft:di-core src.bowl) diff)
  ::
      %chat-club-create
    cu-abet:(cu-create:cu-core !<(=create:club:c vase))
  ::
      %chat-club-action-1
    =+  !<(=action:club:c vase)
    =/  cu  (cu-abed p.action)
    cu-abet:(cu-diff:cu q.action)
  ::
      %chat-dm-archive  di-abet:di-archive:(di-abed:di-core !<(ship vase))
      %chat-migrate-server  ?>(from-self server:migrate)
      %chat-migrate         ?>(from-self client:migrate)
  ::
      %chat-migrate-refs
    ?>  from-self
    =+  !<(flag=[ship term] vase)
    (refs:migrate flag)
      %chat-trim
    ?>  from-self
    trim:migrate
  ::  backwards compatibility
  ::
  ::  v3 types
    ::
  ::
      %chat-dm-action
    =;  new=action:dm:c
      $(mark %chat-dm-action-1, vase !>(new))
    =+  !<(=action:dm:v3:cv vase)
    action(q (v4:diff-writs:v3:cc q.action))
  ::
      %chat-dm-diff
    =;  new=diff:dm:c
      $(mark %chat-dm-diff-1, vase !>(new))
    (v4:diff-writs:v3:cc !<(=diff:dm:v3:cv vase))
  ::
      ?(%chat-club-action %chat-club-action-0)
    =;  new=action:club:c
      $(mark %chat-club-action-1, vase !>(new))
    =+  !<(=action:club:v3:cv vase)
    ?.  ?=(%writ -.q.q.action)  action
    action(diff.q.q (v4:diff-writs:v3:cc diff.q.q.action))
  ::  v2 types
  ::
    ::
  ::
      %dm-rsvp
    =+  `rsvp:dm:c`!<(rsvp:dm:v2:cv vase)  ::NOTE  safety check
    $(mark %chat-dm-rsvp)
  ::
      %dm-diff
    =;  new=diff:dm:v3:cv
      $(mark %chat-dm-diff, vase !>(new))
    (v3:diff-writs:v2:cc !<(=diff:dm:v2:cv vase))
  ::
      %club-action
    =;  new=action:club:v3:cv
      $(mark %chat-club-action, vase !>(new))
    =+  !<(=action:club:v2:cv vase)
    ?.  ?=(%writ -.q.q.action)  action
    action(diff.q.q (v3:diff-writs:v2:cc diff.q.q.action))
  ::
      %egg-any
    =+  !<(=egg-any:gall vase)
    ?-  -.egg-any
        ?(%15 %16)
      ?.  ?=(%live +<.egg-any)
        ~&  [dap.bowl %egg-any-not-live]
        cor
      =/  bak=_cor
        (load -:!>(*[versioned-state:load @ud]) q.old-state.egg-any)
      ::  restore previous data, doing a "deep merge" where possible.
      ::  in doing so we must take care around sequence numbers.
      ::  to keep that logic simple, we merge the message lists and
      ::  re-number all the messages in sequence.
      ::
      =.  dms
        %+  roll  ~(tap by dms:bak)
        |=  [[=ship =dm:c] =_dms]
        %+  ~(put by dms)  ship
        ?.  (~(has by dms) ship)
          dm
        =/  hav  (~(got by dms) ship)
        =/  [num=@ud wit=writs:c]
          %^  (dip:on:writs:c ,@ud)
              (uni:on:writs:c wit.pact.dm wit.pact.hav)
            0
          |=  [n=@ud k=time v=(may:c writ:c)]
          ^-  [(unit (may:c writ:c)) ? @ud]
          :_  [| +(n)]
          :-  ~
          ?:(?=(%| -.v) v(seq +(n)) v(seq +(n)))
        :*  :^    num
                wit
              (~(uni by dex.pact.dm) dex.pact.hav)
            ::NOTE  if we renumbered message above, arguably this should
            ::      also add new upd entries for all those posts, but we
            ::      assume (for now) that /changes consistency across exports
            ::      isn't strictly necessary
            (uni:updated-on:c upd.pact.dm upd.pact.hav)
          ::
            remark.hav
            net.hav
            |(pin.hav pin.dm)
        ==
      =.  clubs
        %+  roll  ~(tap by clubs:bak)
        |=  [[=id:club:c =club:c] =_clubs]
        %+  ~(put by clubs)  id
        ?.  (~(has by clubs) id)
          club
        =/  hav  (~(got by clubs) id)
        :*  (~(uni in heard.club) heard.hav)
            remark.hav
          ::
            :^    (max num.pact.club num.pact.hav)
                (uni:on:writs:c wit.pact.club wit.pact.hav)
              (~(uni by dex.pact.club) dex.pact.hav)
            (uni:updated-on:c upd.pact.club upd.pact.hav)
          ::
            crew.hav
        ==
      =.  pins             pins:bak
      =.  blocked          (~(uni in blocked:bak) blocked)
      =.  blocked-by       (~(uni in blocked-by:bak) blocked-by)
      =.  hidden-messages  (~(uni in hidden-messages:bak) hidden-messages)
      cor
    ==
  ==
  ++  pin
    |=  ps=(list whom:c)
    =.  pins  ps
    cor
  --
  ::
  ++  has-blocked
    |=  =ship
    ^+  cor
    ?<  (~(has in blocked-by) ship)
    ?<  =(our.bowl ship)
    =.  blocked-by  (~(put in blocked-by) ship)
    (give %fact ~[/] chat-blocked-by+!>(ship))
  ::
  ++  has-unblocked
    |=  =ship
    ^+  cor
    ?>  (~(has in blocked-by) ship)
    ?<  =(our.bowl ship)
    =.  blocked-by  (~(del in blocked-by) ship)
    (give %fact ~[/] chat-unblocked-by+!>(ship))
  ::
  ++  block
    |=  =ship
    ^+  cor
    ?<  (~(has in blocked) ship)
    ?<  =(our.bowl ship)
    =.  blocked  (~(put in blocked) ship)
    (emit %pass di-area:di-core:cor %agent [ship dap.bowl] %poke %chat-blocked !>(0))
  ::
  ++  unblock
    |=  =ship
    ^+  cor
    ?>  (~(has in blocked) ship)
    =.  blocked  (~(del in blocked) ship)
    (emit %pass di-area:di-core:cor %agent [ship dap.bowl] %poke %chat-unblocked !>(0))
  ::
  ++  toggle-message
    |=  toggle=message-toggle:c
    ^+  cor
    =.  hidden-messages
      ?-  -.toggle
        %hide  (~(put in hidden-messages) id.toggle)
        %show  (~(del in hidden-messages) id.toggle)
      ==
    (give %fact ~[/] chat-toggle-message+!>(toggle))
  ::
++  watch
  |=  =(pole knot)
  ^+  cor
  ?+    pole  ~|(bad-watch-path+`path`pole !!)
  ::  catch-all
  ::
      ~  ?>(from-self cor)
      [?(%v1 %v2 %v3) ~]  ?>(from-self cor)
  ::
      [%clubs ~]  ?>(from-self cor)
      [%v1 %clubs ~]  ?>(from-self cor)

      [%unreads ~]  ?>(from-self cor)
      [%dm %invited ~]  ?>(from-self cor)
  ::
      [%dm ship=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    di-abet:(di-watch:(di-abed:di-core ship) %v0 rest.pole)
  ::
      [ver=?(%v1 %v2 %v3) %dm ship=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    di-abet:(di-watch:(di-abed:di-core ship) ver.pole rest.pole)
  ::
      [%club id=@ rest=*]
    =/  =id:club:c  (slav %uv id.pole)
    cu-abet:(cu-watch:(cu-abed id) %v0 rest.pole)
  ::
      [ver=?(%v1 %v2 %v3) %club id=@ rest=*]
    =/  =id:club:c  (slav %uv id.pole)
    cu-abet:(cu-watch:(cu-abed id) ver.pole rest.pole)
  ::
      [%epic ~]
    (give %fact ~ epic+!>(okay))
  ==
::
++  agent
  |=  [=(pole knot) =sign:agent:gall]
  ^+  cor
  ?+    pole  ~|(bad-agent-wire/pole !!)
      ~  cor
  ::
      [%logs *]  cor
      [%epic ~]  cor
      [%hook *]  cor
      [%logs ~]  cor
  ::
      [%migrate ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  cor
    %-  (slog 'Failed to do chat data migration' u.p.sign)
    cor
  ::
      [%activity %submit ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  cor
    %-  (slog 'Failed to send activity' u.p.sign)
    cor
  ::
      [%said *]
    ::  old chat used to fetch previews, we don't do those here anymore
    ::
    cor
  ::
      [%groups ~]
    ::  old chat used to watch groups. we no longer want/need to.
    ::
    (emit %pass /groups %agent [our.bowl %groups] %leave ~)
  ::
      [%chat ship=@ *]
    ::  old chat used to have chat subscriptions. we no longer care about these
    ::
    ?~  who=(slaw %p ship.pole)  cor
    (emit %pass pole %agent [u.who dap.bowl] %leave ~)
  ::
      [%contacts ship=@ ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  cor
    %-  (slog leaf/"Failed to heed contact {(trip ship.pole)}" u.p.sign)
    cor
  ::
    [?(%v1 %v2) %dm ship=@ rest=*]  $(pole +.pole)
    [?(%v1 %v2) %club id=@ rest=*]  $(pole +.pole)
  ::
      [%dm ship=@ rest=*]
    =/  =ship  (slav %p ship.pole)
    di-abet:(di-agent:(di-abed:di-core ship) rest.pole sign)
  ::
      [%club id=@ rest=*]
    =/  =id:club:c  (slav %uv id.pole)
    cu-abet:(cu-agent:(cu-abed id) rest.pole sign)
  ==
++  give-kick
  |=  [pas=(list path) =cage]
  =.  cor  (give %fact pas cage)
  (give %kick ~ ~)
::
++  arvo
  |=  [=wire sign=sign-arvo]
  ^+  cor
  ~&  arvo/wire
  cor
++  peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  [~ ~]
    [%x %full ~]  ``noun+!>([dms clubs])
    [%x %old ~]  ``noun+!>(old-chats)  ::  legacy data, for migration use
  ::
    [%x %clubs ~]  ``clubs+!>((~(run by clubs) |=(=club:c crew.club)))
  ::
    [%x %blocked ~]  ``ships+!>(blocked)
  ::
    [%x %blocked-by ~]  ``ships+!>(blocked-by)
  ::
    [%x %hidden-messages ~]  ``hidden-messages+!>(hidden-messages)
  ::
    [%x %unreads ~]  ``chat-unreads+!>(unreads)
  ::
      [%x %init ~]
    =-  ``noun+!>(-)
    :*  (~(run by clubs) |=(=club:c crew.club))
        ~(key by accepted-dms)
        unreads
        ~(key by pending-dms)
        pins
    ==
  ::
      [%x %v1 %init ~]
    =-  ``noun+!>(-)
    :*  ~(key by accepted-dms)
        ~(key by pending-dms)
        (~(run by clubs) |=(=club:c crew.club))
        blocked
        blocked-by
        hidden-messages
    ==
  ::
      [%x %heads ?(~ [@ ~])]
    =/  since=(unit time)
      ?~  t.t.path  ~
      ?^  tim=(slaw %da i.t.t.path)  `u.tim
      `(slav %ud i.t.t.path)
    :^  ~  ~  %chat-heads
    !>((v3:heads:v5:cc (v5:heads:v6:cc (heads since))))
  ::
      [%x ?(%v1 %v2 %v3) %heads ?(~ [@ ~])]
    =*  ver  i.t.path
    =/  since=(unit time)
      ?~  t.t.t.path  ~
      ?^  tim=(slaw %da i.t.t.t.path)  `u.tim
      `(slav %ud i.t.t.t.path)
    ?-  ver
      %v1  ``[%chat-heads-1 !>((v4:heads:v6:cc (heads since)))]
      %v2  ``[%chat-heads-2 !>((v5:heads:v6:cc (heads since)))]
      %v3  ``[%chat-heads-3 !>(`chat-heads:v6:cv`(heads since))]
    ==
  ::
      [%x %v3 %changes since=@ rest=*]
    =+  since=(slav %da i.t.t.t.path)
    =/  changes=(map whom:c writs:c)
      %-  ~(gas by *(map whom:c writs:c))
      %+  weld
        %+  murn  ~(tap by dms)
        |=  [who=ship =dm:c]
        ^-  (unit [whom:c writs:c])
        %+  bind
          (~(changes pac pact.dm) since)
        (lead [%ship who])
      %+  murn  ~(tap by clubs)
      |=  [=id:club:c =club:c]
      ^-  (unit [whom:c writs:c])
      %+  bind
        (~(changes pac pact.club) since)
      (lead [%club id])
    ?+  t.t.t.t.path  [~ ~]
      ~  ``chat-changed-writs+!>(changes)
    ::
        [%count ~]
      :^  ~  ~  %json
      !>  ^-  json
      %-  numb:enjs:format
      %-  ~(rep by changes)
      |=  [[* w=writs:c] sum=@ud]
      (add sum (wyt:on:writs:c w))
    ==
  ::
      [%x %v3 %init-posts channels=@ context=@ ~]
    =+  channels=(slav %ud i.t.t.t.path)
    =+  context=(slav %ud i.t.t.t.t.path)
    =*  a  activity
    =/  activity
      %-  ~(gas by *activity:a)
      .^  (list [source:a activity-summary:a])  %gx
        (scry-path %activity /v4/activity/unreads/activity-summary-pairs-4)
      ==
    :^  ~  ~  %chat-changed-writs
    !>  %-  ~(gas by *(map whom:c writs:c))
    =*  type  $%([%ship who=ship =dm:c] [%club =id:club:c =club:c])
    %+  turn
      %+  scag  channels
      %+  sort
        (welp (turn ~(tap by dms) (lead %ship)) (turn ~(tap by clubs) (lead %club)))
      |=  [a=type b=type]
      %+  gth
        ?-(-.a %ship recency.remark.dm.a, %club recency.remark.club.a)
      ?-(-.b %ship recency.remark.dm.b, %club recency.remark.club.b)
    |=  arg=type
    ^-  [whom:c writs:c]
    =/  [=whom:c =pact:c]
      ?-  -.arg
        %ship  [[%ship who.arg] pact.dm.arg]
        %club  [[%club id.arg] pact.club.arg]
      ==
    :-  whom
    %+  gas:on:writs:c  ~
    =/  around=(unit time)
      ?~  act=(~(get by activity) %dm whom)  ~
      ?~(unread.u.act ~ `time.u.unread.u.act)
    ?~  around
      ::NOTE  equivalent of /newest scry
      (top:mope:pac wit.pact context)
    ::NOTE  analogous to /around scry
    =/  older  (bat:mope:pac wit.pact `+(u.around) context)
    =/  newer  (tab:on:writs:c wit.pact `u.around context)
    (weld older newer)
  ::
      [%x %dm ~]
    ``ships+!>(~(key by accepted-dms))
  ::
      [%x %dm %invited ~]
    ``ships+!>(~(key by pending-dms))
  ::
      [%x %dm %archive ~]
    ``ships+!>(~(key by archived-dms))
  ::
      [%x %dm @ *]
    =/  =ship  (slav %p i.t.t.path)
    (di-peek:(di-abed:di-core ship) %x %v0 t.t.t.path)
  ::
      [%x ?(%v1 %v2 %v3) %dm @ *]
    =/  =ship  (slav %p i.t.t.t.path)
    (di-peek:(di-abed:di-core ship) %x i.t.path t.t.t.t.path)
  ::
      [%x %club @ *]
    (cu-peek:(cu-abed (slav %uv i.t.t.path)) %x %v0 t.t.t.path)
  ::
      [%x ?(%v1 %v2 %v3) %club @ *]
    (cu-peek:(cu-abed (slav %uv i.t.t.t.path)) %x i.t.path t.t.t.t.path)
  ::
      [%u %dm @ *]
    =/  =ship  (slav %p i.t.t.path)
    =/  has  (~(has by dms) ship)
    ?.  has
      ``loob+!>(|)
    ?~  t.t.t.path  ``loob+!>(has)
    (di-peek:(di-abed:di-core ship) %u %v0 t.t.t.path)
  ::
      [%u %club @ *]
    =/  =id:club:c  (slav %uv i.t.t.path)
    =/  has  (~(has by clubs) id)
    ?.  has
      ``loob+!>(|)
    ?~  t.t.t.path  ``loob+!>(has)
    (cu-peek:(cu-abed:cu-core id) %u %v0 t.t.t.path)
  ::
  ==
::
++  heads
  |=  since=(unit time)
  ^-  chat-heads:c
  %+  murn
    %+  welp
      (turn ~(tap by dms) |=([=@p dm:c] [ship+p pact remark]))
    (turn ~(tap by clubs) |=([=id:club:c club:c] [club+id pact remark]))
  |=  [=whom:c =pact:c =remark:c]
  ^-  (unit [_whom time (unit writ:c)])
  ::  if there is no latest post, give nothing
  ::
  ?~  vp=(ram:on:writs:c wit.pact)  ~
  ::  if the request is bounded, check that latest message is "in bounds"
  ::  (and not presumably already known by the requester)
  ::
  ?.  ?|  ?=(~ since)
          |((gth key.u.vp u.since) (gth recency.remark u.since))
      ==
    ~
  ::  latest is in range (or recency was changed), give it directly
  ::
  ?:  ?=(%| -.val.u.vp)  ~
  `[whom recency.remark `+.val.u.vp]
::
++  unreads
  ^-  unreads:c
  %-  ~(gas by *unreads:c)
  %+  welp
    %+  turn  ~(tap by clubs)
    |=  [=id:club:c =club:c]
    =/  loyal  (~(has in team.crew.club) our.bowl)
    =/  invited  (~(has in hive.crew.club) our.bowl)
    ?:  &(!loyal !invited)
      [club/id *time 0 ~ ~]
    =/  cu  (cu-abed id)
    [club/id cu-unread:cu]
  %+  murn  ~(tap in ~(key by dms))
  |=  =ship
  =/  di  (di-abed:di-core ship)
  ?:  ?=(?(%invited %archive) net.dm.di)  ~
  ?:  =([~ ~] pact.dm.di)  ~
  `[ship/ship di-unread:di]
++  give-unread
  |=  [=whom:c =unread:unreads:c]
  (give %fact ~[/unreads] chat-unread-update+!>([whom unread]))
::
++  pass-hark
  |=  =cage
  ^-  card
  =/  =wire  /hark
  =/  =dock  [our.bowl %hark]
  [%pass wire %agent dock %poke cage]
::
++  pass-activity
  =,  activity
  |=  $:  =whom
          $=  concern
          $%  [%invite ~]
              [%post key=message-key]
              [%delete-post key=message-key]
              [%reply key=message-key top=message-key]
              [%delete-reply key=message-key top=message-key]
          ==
          content=story:d
          mention=?
      ==
  ^+  cor
  ?.  .^(? %gu (scry-path %activity /$))
    cor
  =;  actions=(list action)
    %-  emil
    %+  turn  actions
    |=  =action
    =/  =cage  activity-action+!>(action)
    [%pass /activity/submit %agent [our.bowl %activity] %poke cage]
  ?:  ?&  ?=(?(%post %reply) -.concern)
          .=  our.bowl
          p.id:?-(-.concern %post key.concern, %reply key.concern)
      ==
    =/  =source
      ?:  ?=(%post -.concern)  [%dm whom]
      [%dm-thread top.concern whom]
    :~  [%read source [%all `now.bowl |]]
        [%bump source]
    ==
  ?:  ?=(%delete-reply -.concern)
    =/  =source:activity  [%dm-thread top.concern whom]
    =/  =incoming-event:activity
      [%dm-reply key.concern top.concern whom content mention]
    [%del-event source incoming-event]~
  ?:  ?=(%delete-post -.concern)
    :~  [%del %dm-thread key.concern whom]
        [%del-event [%dm whom] [%dm-post key.concern whom content mention]]
    ==
  :_  ~
  :-  %add
  ?-  -.concern
    %post    [%dm-post key.concern whom content mention]
    %reply   [%dm-reply key.concern top.concern whom content mention]
    %invite  [%dm-invite whom]
  ==
::
++  make-notice
    |=  [=ship text=cord]
    ^-  delta:writs:c
    =/  =story:d  ~[[%inline ~[[%ship ship] text]]]
    =/  =memo:d  [story our.bowl now.bowl]
    [%add [memo [%chat /notice] ~ ~] `now.bowl]
::
++  get-ship-dw
  |=  =delta:writs:c
  ^-  ship
  ?>  ?=(?(%add %add-react %del-react) -.delta)
  ?-  -.delta
    %add  (get-author-ship:utils author.essay.delta)
    %add-react  (get-author-ship:utils author.delta)
    %del-react  (get-author-ship:utils author.delta)
  ==
::
++  get-ship-dr
  |=  =delta:replies:c
  ^-  ship
  ?>  ?=(?(%add %add-react %del-react) -.delta)
  ?-  -.delta
    %add  (get-author-ship:utils author.memo.delta)
    %add-react  (get-author-ship:utils author.delta)
    %del-react  (get-author-ship:utils author.delta)
  ==
::
++  check-writ-ownership
  |=  diff=diff:writs:c
  =*  her    p.p.diff
  =*  delta  q.diff
  =*  should  =(her src.bowl)
  ?-  -.delta
      %reply  (check-reply-ownership delta should)
      %add  ?.  should  |
            =(src.bowl (get-ship-dw delta))
      %del  should
      %add-react  =(src.bowl (get-ship-dw delta))
      %del-react  =(src.bowl (get-ship-dw delta))
  ==
::
++  check-reply-ownership
  |=  [d=delta:writs:c should=?]
  ?>  ?=(%reply -.d)
  =*  delta  delta.d
  ?-  -.delta
      %add  ?.(should | =(src.bowl (get-ship-dr delta)))
      %del  should
      %add-react  =(src.bowl (get-ship-dr delta))
      %del-react  =(src.bowl (get-ship-dr delta))
  ==
::
++  diff-to-response
  |=  [=diff:writs:c =pact:c]
  ^-  (unit response:writs:c)
  =;  delta=?(~ response-delta:writs:c)
    ?~  delta  ~
    `[p.diff delta]
  ?+  -.q.diff  q.diff
      %add
    =/  time=(unit time)    (~(get by dex.pact) p.diff)
    ?~  time  ~
    =/  writ=(unit (may:c writ:c))  (get:on:writs:c wit.pact u.time)
    ?~  writ  ~&(%diff-to-response-miss ~)
    ?:  ?=(%| -.u.writ)  ~&(%diff-to-response-miss-on-tomb ~)
    [%add essay.q.diff seq.u.writ u.time]
  ::
      %reply
    =;  delta=?(~ response-delta:replies:c)
      ?~  delta  ~
      [%reply id.q.diff meta.q.diff delta]
    ?+  -.delta.q.diff  delta.q.diff
        %add
      =/  time=(unit time)  (~(get by dex.pact) id.q.diff)
      ?~  time  ~
      [%add memo.delta.q.diff u.time]
    ==
  ==
++  from-self  =(our src):bowl
++  migrate
  |%
  ++  t  v2:cv
  ++  server
    =/  server-channels=v-channels:d
      %+  convert-channels  &
      %-  ~(gas by *(map flag:t chat:t))
      %+  skim  ~(tap by old-chats)
      |=  [=flag:t =chat:t]
      =(our.bowl p.flag)
    =/  =cage  [%channel-migration !>(server-channels)]
    (emit %pass /migrate %agent [our.bowl %channels-server] %poke cage)
  ::
  ++  client
    =/  =v-channels:d  (convert-channels | old-chats)
    =/  =cage  [%channel-migration !>(v-channels)]
    =.  cor  (emit %pass /migrate %agent [our.bowl %channels] %poke cage)
    =+  pins=old-pins
    |-
    ?~  pins  cor
    =/  =^cage  [%ui-action !>(`action:u`[%pins %add (convert-pin i.pins)])]
    =.  cor  (emit %pass /migrate %agent [our.bowl %groups-ui] %poke cage)
    $(pins t.pins)
  ::
  ++  refs
    |=  =flag:t
    ?~  old-chat=(~(get by old-chats) flag)  cor
    %-  emil
    ::  iterate over all chats and, for every message/reply authored by us,
    ::  containing a chat reference that we have (almost certainly) converted,
    ::  send the new version of the message/reply as an edit to the host.
    ::
    %+  murn  (tap:on:writs:t wit.pact.u.old-chat)
    |=  [=time =writ:t]
    ^-  (unit card)
    ?.  =(our.bowl author.writ)  ~
    =/  edit=(unit essay:d)
      =;  contains-chat-ref=?
        ?.  contains-chat-ref  ~
        `(convert-essay +.writ)
      ?.  ?=(%story -.content.writ)  |
      %+  lien  p.p.content.writ
      |=  =block:t
      ?=([%cite %chan [%chat *] *] block)
    =/  command=(unit c-post:d)
      ?~  edit  ~
      ?~  replying.writ
        `[%edit time u.edit]
      =/  parent-time  (~(get by dex.pact.u.old-chat) u.replying.writ)
      ?~  parent-time  ~
      `[%reply u.parent-time %edit time -.u.edit]
    ?~  command  ~
    =/  =cage
      :-  %channel-action-1
      !>(`a-channels:d`[%channel [%chat flag] %post u.command])
    `[%pass /migrate %agent [our.bowl %channels] %poke cage]
  ::
  ++  trim
    =-  =.  old-chats  -  cor
    ^-  (map flag:t chat:t)
    %-  ~(run by old-chats)
    |=  old-chat=chat:t
    =/  citations=(set [ship time])
      %-  sy
      ^-  (list [ship time])
      %-  zing
      ^-  (list (list [ship time]))
      %+  murn  (tap:on:writs:t wit.pact.old-chat)
      |=  [=time =writ:t]
      ^-  (unit (list [ship ^time]))
      ::  return citer message and cited message
      ?.  =(our.bowl author.writ)  ~
      =/  cite-targets=(list [ship ^time])
        ?.  ?=(%story -.content.writ)  ~
        %+  murn  p.p.content.writ
        |=  =block:t
        ^-  (unit [ship ^time])
        ?.  ?=([%cite %chan [%chat *] *] block)  ~
        ?.  ?=([%msg @ @ ~] wer.cite.block)  ~
        =/  who  (slaw %p i.t.wer.cite.block)
        ?~  who  ~
        =/  tim  (slaw %ud i.t.t.wer.cite.block)
        ?~  tim  ~
        `[u.who u.tim]
      ?~  cite-targets
        ~
      `[id.writ cite-targets]
    %=  old-chat
      log  ~
      dex.pact
        %-  malt
        %+  murn  ~(tap by dex.pact.old-chat)
        |=  [=id:t =time]
        ?.  (~(has in citations) id)  ~
        `[id time]
      wit.pact
        %-  malt
        %+  murn  (tap:on:writs:t wit.pact.old-chat)
        |=  [=time =writ:t]
        ?.  (~(has in citations) id.writ)  ~
        `[time writ]
    ==
  ++  convert-pin
    |=  =whom:t
    ^-  whom:u
    ?.  ?=(%flag -.whom)
      [%chat whom]
    ?.  (~(has by old-chats) p.whom)
      [%group p.whom]
    [%channel %chat p.whom]
  ::
  ++  convert-channels
    |=  [log=? =_old-chats]
    ^-  v-channels:d
    %-  ~(gas by *v-channels:d)
    %+  turn  ~(tap by old-chats)
    |=  [=flag:t =chat:t]
    ^-  [nest:d v-channel:d]
    :-  [%chat flag]
    =/  posts=v-posts:d  (convert-posts pact.chat)
    %*    .  *v-channel:d
        count   (wyt:on-v-posts:d posts)
        posts   posts
        log     ?.(log ~ (convert-log pact.chat posts perm.chat log.chat))
        perm    [1 perm.chat]
        remark  :_  remark.chat
                ?~(tim=(ram:on-v-posts:d posts) *time key.u.tim)
        net
      ?-  -.net.chat
        %pub  [*ship &]
        %sub  [host load]:net.chat
      ==
    ==
  ::
  ++  convert-posts
    |=  old=pact:t
    ^-  v-posts:d
    =/  writs  (tap:on:writs:t wit.old)
    =/  reply-index=(map @da v-replies:d)
      %+  roll  writs
      |=  [[=time =writ:t] reply-index=(map @da v-replies:d)]
      ?~  replying.writ  reply-index
      ::  this writ is replying to something, so temporarily put it into the
      ::  reply index. below, we will incorporate it into the parent writ.
      ::
      =/  parent-time  (~(get by dex.old) u.replying.writ)
      ?~  parent-time  reply-index
      =/  old-replies=v-replies:d  (~(gut by reply-index) u.parent-time *v-replies:d)
      %+  ~(put by reply-index)  u.parent-time
      (put:on-v-replies:d old-replies time [%& (convert-quip time writ)])
    %+  gas:on-v-posts:d  *v-posts:d
    =|  posts=(list [id-post:d (may:d v-post:d)])
    =<  posts
    %+  roll  writs
    |=  [[=time =writ:t] count=@ud =_posts]
    ^+  [count posts]
    ?^  replying.writ
      [count posts]
    ::  this writ is a top-level message. incorporate the replies to it found
    ::  by the above code.
    ::
    =/  replies=v-replies:d  (~(gut by reply-index) time *v-replies:d)
    =.  count  +(count)
    :-  count
    :_  posts
    [time %& (convert-post time count writ replies)]
  ::
  ++  convert-post
    |=  [id=@da seq=@ud old=writ:t replies=v-replies:d]
    ^-  v-post:d
    =/  modified-at=@da
      %-  ~(rep in replied.old)
      |=  [[=ship =time] mod=_id]
      ?:((gth time mod) time mod)
    :-  [id seq modified-at replies (convert-feels feels.old)]
    [%0 (convert-essay +.old)]
  ::
  ++  convert-feels
    |=  old=(map ship feel:t)
    ^-  v-reacts:d
    %-  ~(run by old)
    |=  =feel:t
    ?~  react=(kill:em feel)
      [%0 `[%any feel]]
    [%0 `u.react]
  ::
  ++  convert-quip
    |=  [id=@da old=writ:t]
    ^-  v-reply:d
    [[id (convert-feels feels.old)] %0 (convert-memo +.old)]
  ::
  ++  convert-memo
    |=  old=memo:t
    ^-  memo:d
    [(convert-story author.old content.old) author.old sent.old]
  ::
  ++  convert-essay
    |=  old=memo:t
    ^-  essay:d
    :*  (convert-memo old)
        [%chat ?-(-.content.old %story ~, %notice /notice)]
        ~
        ~
    ==
  ::
  ++  convert-story
    |=  [=ship old=content:t]
    ^-  story:d
    ?-    -.old
        %notice  ~[%inline pfix.p.old ship+ship sfix.p.old]~
        %story
      =-  (snoc - [%inline q.p.old])
      %+  turn  p.p.old
      |=  =block:t
      ^-  verse:s
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
      ?~  ret=(get:on:writs:t wit u.id)        single
      ?~  replying.u.ret                       single
      ?~  td=(~(get by dex) u.replying.u.ret)  single
      `/msg/(crip (a-co:co u.td))/(crip (a-co:co u.id))
    ==
  ::
  ++  convert-log
    |=  [[=writs:t =index:t] posts=v-posts:d =perm:d =log:t]
    ^-  log:d
    %+  gas:log-on:d  *log:d
    %-  zing
    %+  turn  (tap:log-on:t log)
    |=  [=time =diff:t]
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
      :-  [%create p.diff ~]
      %+  murn  (tap:on:writs:t wit.q.diff)
      |=  [=^time =writ:t]
      =/  new-post  (get:on-v-posts:d posts time)
      ?~  new-post  ~
      (some %post time %set u.new-post)
    ::
        %writs
      =*  id  p.p.diff
      =/  old-time  (~(get by index) id)
      ?~  old-time  ~
      =/  old-writ  (get:on:writs:t writs u.old-time)
      ?~  old-writ  [%post u.old-time %set %| *tombstone:d]~
      ?~  replying.u.old-writ
        =/  new-post  (get:on-v-posts:d posts u.old-time)
        ?~  new-post  ~
        :_  ~
        :+  %post  u.old-time
        ?-  -.q.p.diff
          %del                    [%set %| *tombstone:d]
          ?(%add %edit)           [%set u.new-post]
          ?(%add-feel %del-feel)  [%reacts ?:(?=(%| -.u.new-post) ~ reacts.u.new-post)]
       ==
      =/  new-post-id  (~(get by index) u.replying.u.old-writ)
      ?~  new-post-id  ~
      =/  new-post  (get:on-v-posts:d posts u.new-post-id)
      ?~  new-post  ~
      ?:  ?=(%| -.u.new-post)  ~
      =/  new-quip  (get:on-v-replies:d replies.+.u.new-post u.old-time)
      ?~  new-quip  ~
      :_  ~
      :+  %post   u.new-post-id
      :+  %reply  u.old-time
      ^-  u-reply:d
      ?-  -.q.p.diff
        %del                    [%set %| *tombstone:d]
        ?(%add %edit)           [%set u.new-quip]
        ?(%add-feel %del-feel)  [%reacts ?:(?=(%| -.u.new-quip) ~ reacts.u.new-quip)]
      ==
    ==
  --
::
++  cu-abed  cu-abed:cu-core
::
++  cu-core
  |_  [=id:club:c =club:c gone=_| counter=@ud]
  +*  cu-pact  ~(. pac pact.club)
      log      ~(. logs [our.bowl /logs])
  ++  cu-core  .
  ++  cu-abet
    ::  shouldn't need cleaning, but just in case
    =.  cu-core  cu-clean
    =.  clubs
      ?:  gone
        (~(del by clubs) id)
      (~(put by clubs) id club)
    cor
  ++  cu-abed
    |=  i=id:club:c
    ~|  no-club/i
    cu-core(id i, club (~(gut by clubs) i *club:c))
  ++  cu-clean
    =.  hive.crew.club
      %-  ~(rep in hive.crew.club)
      |=  [=ship hive=(set ship)]
      ?:  (~(has in team.crew.club) ship)  hive
      (~(put in hive) ship)
    cu-core
  ++  cu-out  (~(del in cu-circle) our.bowl)
  ++  cu-circle
    (~(uni in team.crew.club) hive.crew.club)
  ::
  ++  cu-area  `wire`/club/(scot %uv id)
  ++  cu-area-writs  `wire`/club/(scot %uv id)/writs
  ::
  ++  cu-uid
    =/  uid  `@uv`(shax (jam ['clubs' (add counter eny.bowl)]))
    [uid cu-core(counter +(counter))]
  ::
  ++  cu-activity
    =,  activity
    |=  $:  $=  concern
            $%  [%invite ~]
                [%post key=message-key]
                [%delete-post key=message-key]
                [%reply key=message-key top=message-key]
                [%delete-reply key=message-key top=message-key]
            ==
            content=story:d
            mention=?
        ==
    ?.  ?|  =(net.crew.club %done)
            &(=(net.crew.club %invited) =(%invite -.concern))
        ==
      cu-core
    =.  cor  (pass-activity [%club id] concern content mention)
    cu-core
  ::
  ++  cu-pass
    |%
    ++  act
      |=  [=ship =diff:club:c]
      ^-  card
      =/  =wire
        %+  weld  cu-area
        ^-  wire
        :-  %gossip
        ?.  ?=(%writ -.q.diff)  ~
        =,  p.diff.q.diff
        /(scot %uv p.diff)/(scot %p p)/(scot %ud q)
      =/  =dock  [ship dap.bowl]
      =/  =cage  chat-club-action-1+!>(`action:club:c`[id diff])
      [%pass wire %agent dock %poke cage]
    ::
    ++  gossip
      |=  =diff:club:c
      ^-  (list card)
      %+  turn  ~(tap in cu-out)
      |=  =ship
      (act ship diff)
    --
  ::
  ++  cu-init
    |=  [=net:club:c =create:club:c]
    =/  clab=club:c
      [*heard:club:c *remark:c *pact:c (silt our.bowl ~) hive.create *data:meta net |]
    cu-core(id id.create, club clab)
  ::
  ++  cu-unread
    %+  unread:cu-pact  our.bowl
    [recency last-read unread-threads]:remark.club
  ::
  ++  cu-create
    |=  =create:club:c
    =.  cu-core  (cu-init %done create)
    =.  cu-core  (cu-diff 0v0 [%init team hive met]:crew.club)
    =.  cor  (give-unread club/id cu-unread)
    =/  =delta:writs:c
      %+  make-notice  our.bowl
      %+  rap  3
      :~  ' started a group chat with '
          (scot %ud ~(wyt in hive.create))
          ' other members'
      ==
    =.  cu-core
      (cu-diff 0v0 [%writ now-id delta])
    cu-core
  ::
  ::  NB: need to be careful not to forward automatically generated
  ::  messages like this, each node should generate its own notice
  ::  messages, and never forward. XX: defend against?
  ++  cu-post-notice
    |=  [=ship text=cord]
    =/  =id:c             [ship now.bowl]
    =/  =delta:writs:c    (make-notice ship text)
    =/  w-d=diff:writs:c  [id delta]
    =.  pact.club  (reduce:cu-pact now.bowl from-self w-d)
    (cu-give-writs-diff w-d)
  ::
  ++  cu-give-action
    |=  =action:club:c
    =/  action-5  (v5:action-club:v6:cc action)
    =.  cor
      =/  =cage  chat-club-action+!>((v3:action-club:v5:cc action-5))
      (emit %give %fact ~[/ /clubs] cage)
    =.  cor
      =/  cage  chat-club-action-1+!>(action-5)
      (emit %give %fact ~[/v1 /v1/clubs /v2 /v2/clubs] cage)
    =.  cor
      =/  cage  chat-club-action-1+!>(action)
      (emit %give %fact ~[/v3 /v3/clubs] cage)
    cu-core
  ::
  ++  cu-give-writs-diff
    |=  =diff:writs:c
    =/  =whom:c  [%club id]
    =/  response=(unit response:writs:c)
      (diff-to-response diff pact.club)
    ?~  response
      =.  cor  (emit (tell:log %crit ~['+diff-to-response miss (cu)'] ~))
      cu-core
    =/  old-response-3=[whom:v3:cv response:writs:v3:cv]
      :-  whom
      %-  v3:response-writs:v5:cc
      (v5:response-writs:v6:cc u.response)
    =/  old-response-4=[whom:v4:cv response:writs:v4:cv]
      [whom (v4:response-writs:v6:cc u.response)]
    =/  old-response-5=[whom:v5:cv response:writs:v5:cv]
      [whom (v5:response-writs:v6:cc u.response)]
    =/  new-response=[whom:c response:writs:c]  [whom u.response]
    =.  cor
      =/  cage  writ-response+!>(old-response-3)
      (emit %give %fact ~[/ cu-area cu-area-writs] cage)
    =.  cor
      =/  cage  writ-response-1+!>(old-response-4)
      (emit %give %fact ~[/v1 v1+cu-area v1+cu-area-writs] cage)
    =.  cor
      =/  =cage  writ-response-2+!>(old-response-5)
      (emit %give %fact ~[/v2 v2+cu-area v2+cu-area-writs] cage)
    =.  cor
      =/  =cage  writ-response-3+!>(new-response)
      (emit %give %fact ~[/v3 v3+cu-area v3+cu-area-writs] cage)
    cu-core
  ::
  ++  cu-diff
    |=  [=uid:club:c =delta:club:c]
    ::  generate a uid if we're hearing from a pre-upgrade ship or if we're sending
    =^  uid  cu-core
      ?:  |(from-self (lte uid club-eq))  cu-uid
      [uid cu-core]
    =/  diff  [uid delta]
    ?:  (~(has in heard.club) uid)  cu-core
    =.  heard.club  (~(put in heard.club) uid)
    =.  cor  (emil (gossip:cu-pass diff))
    =?  cu-core  !?=(%writ -.delta)  (cu-give-action [id diff])
    ?-    -.delta
    ::
        %meta
      =.  met.crew.club  meta.delta
      cu-core
    ::
        %init
      =.  cor  (pass-activity [%club id] [%invite ~] *story:d |)
      ::  ignore if already initialized
      ?:  ?|  !=(~ hive.crew.club)
              !=(~ team.crew.club)
              !=(*data:meta met.crew.club)
          ==
        cu-core
      =:  hive.crew.club  hive.delta
          team.crew.club  team.delta
          met.crew.club   met.delta
      ==
      cu-core
    ::
        %writ
      =/  loyal  (~(has in team.crew.club) our.bowl)
      =/  invited  (~(has in hive.crew.club) our.bowl)
      ?:  &(!loyal !invited)
         cu-core
      =/  had=(unit [=time writ=(may:c writ:c)])
        (get:cu-pact p.diff.delta)
      =/  reply=(unit [=time reply=(may:c reply:c)])
        ?.  ?=(%reply -.q.diff.delta)  ~
        ?~  had  ~
        ?:  ?=(%| -.writ.u.had)  ~
        (get-reply:cu-pact id.q.diff.delta replies.writ.u.had)
      ::  log shortcode reactions for group DMs
      ::
      =?  cor  ?=(%add-react -.q.diff.delta)
        =/  react-text
          ?@  react.q.diff.delta  react.q.diff.delta
          p.react.q.diff.delta
        ?^  (kill:em react-text)
          =/  message  ~[leaf+"Shortcode reaction detected in chat backend (group DM)"]
          =/  metadata
            :~  'event'^s+'Backend Shortcode Reaction Chat GroupDM'
                'context'^s+'chat_server_group_dm_add_react'
                'club_id'^s+(scot %uv id)
                'react'^s+react-text
            ==
          (emit (tell:log %crit message metadata))
        cor
      =.  pact.club  (reduce:cu-pact now.bowl from-self diff.delta)
      ?-  -.q.diff.delta
          ?(%add-react %del-react)  (cu-give-writs-diff diff.delta)
          %add
        =.  time.q.diff.delta  (~(get by dex.pact.club) p.diff.delta)
        =*  essay  essay.q.diff.delta
        =?    last-read.remark.club
            =((get-author-ship:utils author.essay) our.bowl)
          (add now.bowl (div ~s1 100))
        =.  recency.remark.club  now.bowl
        =.  cor  (give-unread club/id cu-unread)
        =/  concern  [%post p.diff.delta now.bowl]
        =/  mention  (was-mentioned:utils content.essay our.bowl ~)
        =.  cu-core  (cu-activity concern content.essay mention)
        (cu-give-writs-diff diff.delta)
      ::
          %del
        =?  cu-core  &(?=(^ had) ?=(%& -.writ.u.had))
          =*  content  content.writ.u.had
          =/  mention  (was-mentioned:utils content our.bowl ~)
          (cu-activity [%delete-post [id time]:writ.u.had] content mention)
        (cu-give-writs-diff diff.delta)
      ::
          %reply
        =*  reply-id  id.q.diff.delta
        =*  delt  delta.q.diff.delta
        =/  entry=(unit [=time writ=(may:c writ:c)])  (get:cu-pact p.diff.delta)
        ?~  entry  cu-core
        ?:  ?=(%| -.writ.u.entry)  cu-core
        =.  meta.q.diff.delta  `reply-meta.writ.u.entry
        ::  log shortcode reactions for group DM replies
        ::
        =?  cor  ?=(%add-react -.delt)
          =/  react-text
            ?@  react.delt  react.delt
            p.react.delt
          ?^  (kill:em react-text)
            =/  message  ~[leaf+"Shortcode reaction detected in chat backend (group DM reply)"]
            =/  metadata
              :~  'event'^s+'Backend Shortcode Reaction Chat GroupDM Reply'
                  'context'^s+'chat_server_group_dm_reply_add_react'
                  'club_id'^s+(scot %uv id)
                  'reply_ship'^s+(scot %p p.reply-id)
                  'reply_time'^s+(scot %ud q.reply-id)
                  'react'^s+react-text
              ==
            (emit (tell:log %crit message metadata))
          cor
        ?-  -.delt
            ?(%add-react %del-react)  (cu-give-writs-diff diff.delta)
        ::
            %del
          =?  cu-core  &(?=(^ reply) ?=(%& -.reply.u.reply))
            =*  content  content.reply.u.reply
            =/  mention  (was-mentioned:utils content our.bowl ~)
            =/  concern
              [%delete-reply [id time]:reply.u.reply [id time]:writ.u.entry]
            (cu-activity concern content mention)
          (cu-give-writs-diff diff.delta)
        ::
            %add
          =*  memo  memo.delt
          =?  last-read.remark.club  =(author.memo our.bowl)
            (add now.bowl (div ~s1 100))
          =?  unread-threads.remark.club  !=(our.bowl author.memo)
            (~(put in unread-threads.remark.club) p.diff.delta)
          =.  recency.remark.club  now.bowl
          =.  cor  (give-unread club/id cu-unread)
          =*  op  writ.u.entry
          =/  top-con  [id time]:op
          =/  concern  [%reply [id.q.diff.delta now.bowl] top-con]
          =/  mention  (was-mentioned:utils content.memo our.bowl ~)
          =.  cu-core  (cu-activity concern content.memo mention)
          (cu-give-writs-diff diff.delta)
        ==
      ==
    ::
        %team
      =*  ship  ship.delta
      =/  loyal  (~(has in team.crew.club) ship)
      ?:  &(!ok.delta loyal)
        ?.  =(our src):bowl
          cu-core
        cu-core(gone &)
      ?:  &(ok.delta loyal)  cu-core
      ?.  (~(has in hive.crew.club) ship)
        cu-core
      =.  hive.crew.club  (~(del in hive.crew.club) ship)
      ?.  ok.delta
        (cu-post-notice ship ' declined the invite')
      =.  cor  (give-unread club/id cu-unread)
      =.  team.crew.club  (~(put in team.crew.club) ship)
      =?  last-read.remark.club  =(ship our.bowl)  now.bowl
      (cu-post-notice ship ' joined the chat')
    ::
        %hive
      ?:  add.delta
        ?:  ?|  (~(has in hive.crew.club) for.delta)
                (~(has in team.crew.club) for.delta)
            ==
          cu-core
        =.  hive.crew.club   (~(put in hive.crew.club) for.delta)
        =^  new-uid  cu-core
          cu-uid
        =.  cor  (emit (act:cu-pass for.delta new-uid %init [team hive met]:crew.club))
        (cu-post-notice for.delta ' was invited to the chat')
      ?.  (~(has in hive.crew.club) for.delta)
        cu-core
      =.  hive.crew.club  (~(del in hive.crew.club) for.delta)
      (cu-post-notice for.delta ' was uninvited from the chat')
    ==
  ::
  ++  cu-remark-diff
    |=  diff=remark-diff:c
    ^+  cu-core
    =?  cor  =(%read -.diff)
      %-  emil
      =+  .^(=carpet:ha %gx /(scot %p our.bowl)/hark/(scot %da now.bowl)/desk/groups/latest/noun)
      %+  murn
        ~(tap by cable.carpet)
      |=  [=rope:ha =thread:ha]
      ?.  =(/club/(scot %uv id) ted.rope)  ~
      =/  =cage  hark-action-1+!>([%saw-rope rope])
      `(pass-hark cage)
    =.  remark.club
      ?-  -.diff
        %watch    remark.club(watching &)
        %unwatch  remark.club(watching |)
        %read-at  !!
      ::
          %read
        ::  now.bowl should always be greater than the last message id
        ::  because ids are generated by us
        %=  remark.club
          last-read  now.bowl
          unread-threads  *(set id:c)
        ==
      ==
    =.  cor
      (give-unread club/id cu-unread)
    cu-core
  ::
  ++  cu-peek
    |=  [care=@tas ver=?(%v0 %v1 %v2 %v3) =(pole knot)]
    ^-  (unit (unit cage))
    ?+  pole  [~ ~]
      [%writs rest=*]  (peek:cu-pact care ver rest.pole)
      [%crew ~]   ``chat-club-crew+!>(crew.club)
    ::
        [%search %bounded kind=?(%text %mention) from=@ tries=@ nedl=@ ~]
      :+  ~  ~
      =;  =scam:c
        ?-  ver
          %v0  chat-scam+!>((v3:scam:v5:cc (v5:scam:v6:cc scam)))
          %v1  chat-scam-1+!>((v4:scam:v6:cc scam))
          %v2  chat-scam-2+!>((v5:scam:v6:cc scam))
          %v3  chat-scam-3+!>(`scam:v6:cv`scam)
        ==
      %^    ?-  kind.pole
              %text     text:tries-bound:search:cu-pact
              %mention  mention:tries-bound:search:cu-pact
            ==
          ?:  =(%$ from.pole)  ~
          `(slav %ud from.pole)
        (slav %ud tries.pole)
      ?-  kind.pole
        %text     (fall (slaw %t nedl.pole) nedl.pole)
        %mention  (slav %p nedl.pole)
      ==
    ::
        [%search %text skip=@ count=@ nedl=@ ~]
      :+  ~  ~
      =;  =scan:c
        ?-  ver
          %v0  chat-scan+!>((v3:scan:v5:cc (v5:scan:v6:cc scan)))
          %v1  chat-scan-1+!>((v4:scan:v5:cc (v5:scan:v6:cc scan)))
          %v2  chat-scan-2+!>((v5:scan:v6:cc scan))
          %v3  chat-scan-3+!>(`scan:v6:cv`scan)
        ==
      %^    text:hits-bound:search:cu-pact
          (slav %ud skip.pole)
        (slav %ud count.pole)
      (fall (slaw %t nedl.pole) nedl.pole)
    ::
        [%search %mention skip=@ count=@ nedl=@ ~]
      :+  ~  ~
      =;  =scan:c
        ?-  ver
          %v0  chat-scan+!>((v3:scan:v5:cc (v5:scan:v6:cc scan)))
          %v1  chat-scan-1+!>((v4:scan:v5:cc (v5:scan:v6:cc scan)))
          %v2  chat-scan-2+!>((v5:scan:v6:cc scan))
          %v3  chat-scan-3+!>(`scan:v6:cv`scan)
        ==
      %^    mention:hits-bound:search:cu-pact
          (slav %ud skip.pole)
        (slav %ud count.pole)
      (slav %p nedl.pole)
    ==
  ::
  ++  cu-watch
    |=  [ver=?(%v0 %v1 %v2 %v3) =path]
    ^+  cu-core
    ?>  =(src our):bowl
    ?+  path  !!
      ~  cu-core
      [%writs ~]  cu-core
    ==
  ::
  ++  cu-agent
    |=  [=wire =sign:agent:gall]
    ^+  cu-core
    ?+    wire  ~|(bad-club-take/wire !!)
        [%gossip *]
      ?>  ?=(%poke-ack -.sign)
      ?~  p.sign  cu-core
      ::  if we already tried hard, this is the end of the road
      ::
      ?:  ?=([%archaic ~] t.wire)
        %-  (slog leaf/"Failed to gossip {<src.bowl>} {<id>}" u.p.sign)
        cu-core
      ::  if they're know version mismatching, we should do nothing
      ::TODO  might want to mark the local msg as (partially?) undelivered...
      ::
      ?.  ?=(%await (read-status:neg bowl src.bowl dap.bowl))
        %-  (slog leaf/"Failed to gossip {<src.bowl>} {<id>}" u.p.sign)
        cu-core
      ::  if a poke failed, but we also don't have a negotiated version for
      ::  them, they might still be on the old (pre-2024) chat backend. try
      ::  sending them an old-style poke if we can, for backcompat.
      ::  we do our best to recover the message from the wire.
      ::
      =.  cor
        =;  c=(unit cage)
          ?~  c  cor
          %+  emit  %pass
          [(weld cu-area /gossip/archaic) %agent [src.bowl %chat] %poke u.c]
        ?+  t.wire  ~
            [@ @ @ ~]
          %-  some
          :-  %club-action
          !>  ^-  action:club:v2:cv
          =/  =uid:club:c
            (slav %uv i.t.wire)
          =/  mid=id:c
            [(slav %p i.t.t.wire) (slav %ud i.t.t.t.wire)]
          =/  msg=(unit [=time writ=(may:c writ:c)])
            (get:cu-pact mid)
          :^  id  uid  %writ
          ^-  diff:writs:v2:cv
          :-  mid
          ?~  msg  [%del ~]
          ?:  ?=(%| -.writ.u.msg)  [%del ~]
          :-  %add
          ^-  memo:v2:cv
          =,  writ.u.msg
          [~ (get-author-ship:utils author) sent [%story ~ (verses-to-inlines content)]]
        ==
      cu-core
    ==
  ::
  --
::
++  pending-dms
  (dms-by-net %invited ~)
::
++  accepted-dms
  (dms-by-net %inviting %done ~)
::
++  archived-dms
  (dms-by-net %archive ~)
::
++  dms-by-net
  |=  nets=(list net:dm:c)
  =/  nets  (~(gas in *(set net:dm:c)) nets)
  %-  ~(gas by *(map ship dm:c))
  %+  skim  ~(tap by dms)
  |=  [=ship =dm:c]
  (~(has in nets) net.dm)
::
++  give-invites
  |=  =ship
  =/  invites
    ?:  (~(has by dms) ship)
      ~(key by pending-dms)
    (~(put in ~(key by pending-dms)) ship)
  (give %fact ~[/ /dm/invited] ships+!>(invites))
::
++  verses-to-inlines  ::  for backcompat
  |=  l=(list verse:d)
  ^-  (list inline:v2:cv)
  %-  zing
  %+  turn  l
  |=  v=verse:d
  ^-  (list inline:v2:cv)
  ?-  -.v
      %block   ~
      %inline
    %+  murn  p.v
    |=  i=inline:d
    ^-  (unit inline:v2:cv)
    ?@  i    `i
    ?+  -.i  `i
      %sect        ~
      %task        ~
      %italics     `[-.i ^$(p.v p.i)]
      %bold        `[-.i ^$(p.v p.i)]
      %strike      `[-.i ^$(p.v p.i)]
      %blockquote  `[-.i ^$(p.v p.i)]
    ==
  ==
::
++  di-core
  |_  [=ship =dm:c gone=_|]
  +*  di-pact  ~(. pac pact.dm)
      di-hark  ~(. hark-dm:ch [now.bowl ship])
      log      ~(. logs [our.bowl /logs])
  ++  di-core  .
  ++  di-abet
    =.  dms
      ?:  gone  (~(del by dms) ship)
      (~(put by dms) ship dm)
    cor
  ++  di-abed
    |=  s=@p
    di-core(ship s, dm (~(got by dms) s))
  ::
  ++  di-abed-soft
    |=  s=@p
    =/  dm  (~(get by dms) s)
    ?^  dm  di-core(ship s, dm u.dm)
    =|  =remark:c
    =/  new=dm:c
      :*  *pact:c
          remark(watching &)
          ?:  =(s our.bowl)  %done
          ?:(=(src our):bowl %inviting %invited)
          |
      ==
    =.  di-core  di-core(ship s, dm new)
    ?:  &(!=(s our.bowl) =(src our):bowl)  di-core
    (di-activity [%invite ~] *story:d &)
  ::
  ++  di-area  `path`/dm/(scot %p ship)
  ++  di-area-writs  `path`/dm/(scot %p ship)/writs
  ::
  ++  di-activity
    |=  $:  $=  concern
            $%  [%invite ~]
                [%post key=message-key:activity]
                [%delete-post key=message-key:activity]
                [%reply key=message-key:activity top=message-key:activity]
                [%delete-reply key=message-key:activity top=message-key:activity]
            ==
            content=story:d
            mention=?
        ==
    ?.  ?|  =(net.dm %done)
            &(=(net.dm %invited) =(%invite -.concern))
        ==
      di-core
    =.  cor  (pass-activity [%ship ship] concern content mention)
    di-core
  ::
  ++  di-proxy
    |=  =diff:dm:c
    =.  di-core  (di-ingest-diff diff)
    ::  track the id of the message we sent so that we can handle nacks
    ::  gracefully, such as retrying with an older protocol version.
    ::  note that we don't put this information in the wire. +proxy:di-pass
    ::  always uses the same wire. this is important, because ames gives
    ::  message ordering guarantees only within the same flow, so we want to
    ::  re-use the same flow (duct stack) for the same target ship whenever
    ::  we can. (arguably rsvp pokes should go over that same flow also, but
    ::  they only happen once, and their ordering wrt the messages isn't _that_
    ::  important.)
    ::
    =.  sends
      %+  ~(put by sends)  [%ship ship]
      %-  ~(put to (~(gut by sends) [%ship ship] ~))
      ?.  ?=(%reply -.q.diff)
        q.p.diff
      [[p.p q.p] q.id.q]:diff
    =.  cor  (emit (proxy:di-pass diff))
    di-core
  ::
  ++  di-archive
    =.  net.dm  %archive
    (di-post-notice ' archived the channel')
  ::
  ++  di-give-writs-diff
    |=  =diff:writs:c
    =/  =whom:c  [%ship ship]
    =/  response=(unit response:writs:c)
      (diff-to-response diff pact.dm)
    ?~  response
      =.  cor  (emit (tell:log %crit ~['+diff-to-response miss (di)'] ~))
      di-core
    =/  old-response-3=[whom:v3:cv response:writs:v3:cv]
      :-  whom
      %-  v3:response-writs:v5:cc
      (v5:response-writs:v6:cc u.response)
    =/  old-response-4=[whom:v4:cv response:writs:v4:cv]
      [whom (v4:response-writs:v6:cc u.response)]
    =/  old-response-5=[whom:v5:cv response:writs:v5:cv]
      [whom (v5:response-writs:v6:cc u.response)]
    =/  new-response=[whom:c response:writs:c]  [whom u.response]
    =.  cor
      =/  =cage
        writ-response+!>(old-response-3)
      (emit %give %fact ~[/ di-area di-area-writs] cage)
    =.  cor
      =/  =cage  writ-response-1+!>(old-response-4)
      (emit %give %fact ~[/v1 v1+di-area v1+di-area-writs] cage)
    =.  cor
      =/  =cage  writ-response-2+!>(old-response-5)
      (emit %give %fact ~[/v2 v2+di-area v2+di-area-writs] cage)
    =.  cor
      =/  =cage  writ-response-3+!>(new-response)
      (emit %give %fact ~[/v3 v3+di-area v3+di-area-writs] cage)
    di-core
  ::
  ++  di-ingest-diff
    |=  =diff:dm:c
    =?  net.dm  &(?=(%inviting net.dm) !from-self)  %done
    =/  =wire  /contacts/(scot %p ship)
    =/  =cage  contact-action+!>(`action-0:contacts-0`[%heed ~[ship]])
    =.  cor  (emit %pass wire %agent [our.bowl %contacts] %poke cage)
    =/  old-unread  di-unread
    =/  had=(unit [=time writ=(may:c writ:c)])
      (get:di-pact p.diff)
    =/  reply=(unit [=time reply=(may:c reply:c)])
      ?.  ?=(%reply -.q.diff)  ~
      ?~  had  ~
      ?:  ?=(%| -.writ.u.had)  ~
      (get-reply:di-pact id.q.diff replies.writ.u.had)
    ::  log shortcode reactions for regular DMs
    ::
    =?  cor  ?=(%add-react -.q.diff)
      =/  react-text
        ?@  react.q.diff  react.q.diff
        p.react.q.diff
      ?^  (kill:em react-text)
        =/  message  ~[leaf+"Shortcode reaction detected in chat backend (regular DM)"]
        =/  metadata
          :~  'event'^s+'Backend Shortcode Reaction Chat DM'
              'context'^s+'chat_server_dm_add_react'
              'ship'^s+(scot %p ship)
              'react'^s+react-text
          ==
        (emit (tell:log %crit message metadata))
      cor
    =.  pact.dm  (reduce:di-pact now.bowl from-self diff)
    =?  cor  &(=(net.dm %invited) !=(ship our.bowl))
      (give-invites ship)
    ?-  -.q.diff
        ?(%add-react %del-react)  (di-give-writs-diff diff)
    ::
        %add
      =.  time.q.diff  (~(get by dex.pact.dm) p.diff)
      =*  essay  essay.q.diff
      =?    last-read.remark.dm
          =((get-author-ship:utils author.essay) our.bowl)
        (add now.bowl (div ~s1 100))
      =.  recency.remark.dm  now.bowl
      =?  cor  &(!=(old-unread di-unread) !=(net.dm %invited))
        (give-unread ship/ship di-unread)
      =/  concern  [%post p.diff now.bowl]
      =/  mention  (was-mentioned:utils content.essay our.bowl ~)
      =.  di-core  (di-activity concern content.essay mention)
      (di-give-writs-diff diff)
    ::
        %del
      =?  di-core  &(?=(^ had) ?=(%& -.writ.u.had))
        =*  content  content.writ.u.had
        =/  mention  (was-mentioned:utils content our.bowl ~)
        (di-activity [%delete-post [id time]:writ.u.had] content mention)
      (di-give-writs-diff diff)
    ::
        %reply
      =*  delta  delta.q.diff
      =/  entry=(unit [=time writ=(may:c writ:c)])  (get:di-pact p.diff)
      ::  if we don't have the entry, we can't reply to it
      ?~  entry  di-core
      ?:  ?=(%| -.writ.u.entry)  di-core
      =.  meta.q.diff  `reply-meta.writ:(need entry)
      ::  log shortcode reactions for regular DM replies
      ::
      =?  cor  ?=(%add-react -.delta)
        =/  react-text
          ?@  react.delta  react.delta
          p.react.delta
        ?^  (kill:em react-text)
          =/  message  ~[leaf+"Shortcode reaction detected in chat backend (regular DM reply)"]
          =/  metadata
            :~  'event'^s+'Backend Shortcode Reaction Chat DM Reply'
                'context'^s+'chat_server_dm_reply_add_react'
                'ship'^s+(scot %p ship)
                'reply_ship'^s+(scot %p p.id.q.diff)
                'reply_time'^s+(scot %ud q.id.q.diff)
                'react'^s+react-text
            ==
          (emit (tell:log %crit message metadata))
        cor
      ?-  -.delta
          ?(%add-react %del-react)  (di-give-writs-diff diff)
      ::
          %del
        =?  di-core  &(?=(^ reply) ?=(%& -.reply.u.reply))
          =*  content  content.reply.u.reply
          =/  mention  (was-mentioned:utils content our.bowl ~)
          =/  concern
            [%delete-reply [id time]:reply.u.reply [id time]:writ.u.entry]
          (di-activity concern content mention)
        (di-give-writs-diff diff)
      ::
          %add
        =*  memo  memo.delta
        =?  unread-threads.remark.dm  !=(our.bowl author.memo)
            (~(put in unread-threads.remark.dm) p.diff)
        =?  last-read.remark.dm  =(author.memo our.bowl)
          (add now.bowl (div ~s1 100))
        =.  recency.remark.dm  now.bowl
        =?  cor  &(!=(old-unread di-unread) !=(net.dm %invited))
          (give-unread ship/ship di-unread)
        =/  top-con  [id time]:writ.u.entry
        =/  concern  [%reply [id.q.diff now.bowl] top-con]
        =/  mention  (was-mentioned:utils content.memo our.bowl ~)
        =.  di-core  (di-activity concern content.memo mention)
        (di-give-writs-diff diff)
      ==
    ==
  ::
  ++  di-take-counter
    |=  =diff:dm:c
    ?<  (~(has in blocked) ship)
    (di-ingest-diff diff)
  ::
  ++  di-post-notice
    |=  text=cord
    =/  =delta:writs:c  (make-notice ?:(from-self our.bowl ship) text)
    (di-ingest-diff [our now]:bowl delta)
  ::
  ++  di-rsvp
    |=  ok=?
    =?  cor  &(=(our src):bowl (can-poke:neg bowl [ship dap.bowl]))
      (emit (proxy-rsvp:di-pass ok))
    ?>  |(=(src.bowl ship) =(our src):bowl)
    ::  TODO hook into archive
    ?.  ok
      %-  (note:wood %odd leaf/"gone {<ship>}" ~)
      ?:  =(src.bowl ship)
        di-core
      di-core(gone &)
    =.  cor
      (emit [%pass /contacts/heed %agent [our.bowl %contacts] %poke contact-action-0+!>([%heed ~[ship]])])
    =.  net.dm  %done
    (di-post-notice ' joined the chat')
  ::
  ++  di-watch
    |=  [ver=?(%v0 %v1 %v2 %v3) =path]
    ^+  di-core
    ?>  =(src.bowl our.bowl)
    ?+  path  !!
      ~  di-core
      [%writs ~]  di-core
    ==
  ::
  ++  di-agent
    |=  [=wire =sign:agent:gall]
    ^+  di-core
    ?+    wire  ~|(bad-dm-take/wire !!)
        [%contacts %heed ~]
      ?>  ?=(%poke-ack -.sign)
      ?~  p.sign  di-core
      ::  TODO: handle?
      %-  (slog leaf/"Failed to add contact" u.p.sign)
      di-core
    ::
        [%proxy *]
      ?>  ?=(%poke-ack -.sign)
      ::  for pokes whose id we care about, pop it from the queue
      ::
      =^  sent=(unit sent-id)  sends
        ?.  ?=([%diff ~] t.wire)  [~ sends]
        =/  queue=(qeu sent-id)
          (~(gut by sends) [%ship ship] ~)
        ?:  =(~ queue)
          ~&  [dap.bowl %strange-empty-sends-queue [%ship ship]]
          [~ sends]
        =^  id  queue  ~(get to queue)
        :-  `id
        (~(put by sends) [%ship ship] queue)
      ?~  p.sign  di-core
      ::  if we already tried hard, this is the end of the road.
      ::
      ?:  ?=([%archaic ~] t.wire)
        %-  (slog leaf/"Failed to dm {<ship>} again" u.p.sign)
        di-core
      ::  if they're just known version mismatching, we should do nothing
      ::TODO  might want to mark the local msg as undelivered though...
      ::
      ?.  ?=(%await (read-status:neg bowl ship dap.bowl))
        %-  (slog leaf/"Failed to dm {<ship>}" u.p.sign)
        di-core
      ::  if a poke failed, but we also don't have a negotiated version for
      ::  them, they might still be on the old (pre-2024) chat backend. try
      ::  sending them an old-style poke if we can, for backcompat.
      ::  we do our best to recover the message from the wire.
      ::
      =.  cor
        =;  c=(unit cage)
          ?~  c  cor
          %+  emit  %pass
          [(weld di-area /proxy/archaic) %agent [ship %chat] %poke u.c]
        |-
        ?+  t.wire  ~
            [%rsvp @ ~]
          =/  ok=?  ;;(? (slav %f i.t.t.wire))
          `[%dm-rsvp !>(`rsvp:dm:v2:cv`[our.bowl ok])]
        ::
            [%diff ~]
          ?>  ?=(^ sent)
          =*  s  u.sent
          ::NOTE  we just pretend it's an old-style wire, to avoid duplicating
          ::      code. the re-serialization overhead isn't too big, and this
          ::      isn't the common path anyway.
          ?@  s
            $(t.wire /(scot %ud s))
          $(t.wire /(scot %p p.top.s)/(scot %ud q.top.s)/(scot %ud new.s))
        ::
            [@ ?(~ [@ @ ~])]
          %-  some
          :-  %dm-diff
          !>  ^-  diff:dm:v2:cv
          ?~  t.t.wire
            =/  id=time  (slav %ud i.t.wire)
            :-  [our.bowl id]
            =/  msg=(unit [=time writ=(may:c writ:c)])
              (get:di-pact our.bowl id)
            ?~  msg  [%del ~]
            ?:  ?=(%| -.writ.u.msg)
              [%del ~]
            :-  %add
            ^-  memo:v2:cv
            =,  writ.u.msg
            [~ (get-author-ship:utils author) sent [%story ~ (verses-to-inlines content)]]
          =/  =id:c     [(slav %p i.t.wire) (slav %ud i.t.t.wire)]
          =/  rid=time  (slav %ud i.t.t.t.wire)
          =/  msg=(unit memo:v7:d)
            %+  biff  (get:di-pact id)
            |=  [time writ=(may:c writ:c)]
            ^-  (unit memo:v7:d)
            ?~  id=(~(get by dex.pact.dm) our.bowl rid)  ~
            ?:  ?=(%| -.writ)  ~
            ?~  rep=(get:on:replies:c replies.writ u.id)  ~
            ?:  ?=(%| -.u.rep)  ~
            `(v7:memo:v8:chc +>.u.rep)
          :-  [our.bowl rid]
          ?~  msg  [%del ~]
          :-  %add
          ^-  memo:v2:cv
          =,  u.msg
          [~ (get-author-ship:utils author) sent [%story ~ (verses-to-inlines content)]]
        ==
      di-core
    ==
  ::
  ++  di-peek
    |=  [care=@tas ver=?(%v0 %v1 %v2 %v3) =(pole knot)]
    ^-  (unit (unit cage))
    ?+    pole  [~ ~]
        [%writs rest=*]
      (peek:di-pact care ver rest.pole)
    ::
        [%search %bounded kind=?(%text %mention) from=@ tries=@ nedl=@ ~]
      =;  =scam:c
        :+  ~  ~
        ?-  ver
          %v0  chat-scam+!>((v3:scam:v5:cc (v5:scam:v6:cc scam)))
          %v1  chat-scam-1+!>((v4:scam:v6:cc scam))
          %v2  chat-scam-2+!>((v5:scam:v6:cc scam))
          %v3  chat-scam-3+!>(`scam:v6:cv`scam)
        ==
      %^    ?-  kind.pole
              %text     text:tries-bound:search:di-pact
              %mention  mention:tries-bound:search:di-pact
            ==
          ?:  =(%$ from.pole)  ~
          `(slav %ud from.pole)
        (slav %ud tries.pole)
      ?-  kind.pole
        %text     (fall (slaw %t nedl.pole) nedl.pole)
        %mention  (slav %p nedl.pole)
      ==
    ::
        [%search %text skip=@ count=@ nedl=@ ~]
      =;  =scan:c
        :+  ~  ~
        ?-  ver
          %v0  chat-scan+!>((v3:scan:v5:cc (v5:scan:v6:cc scan)))
          %v1  chat-scan-1+!>((v4:scan:v5:cc (v5:scan:v6:cc scan)))
          %v2  chat-scan-2+!>((v5:scan:v6:cc scan))
          %v3  chat-scan-3+!>(`scan:v6:cv`scan)
        ==
      %^    text:hits-bound:search:di-pact
          (slav %ud skip.pole)
        (slav %ud count.pole)
      (fall (slaw %t nedl.pole) nedl.pole)
    ::
        [%search %mention skip=@ count=@ nedl=@ ~]
      =;  =scan:c
        :+  ~  ~
        ?-  ver
          %v0  chat-scan+!>((v3:scan:v5:cc (v5:scan:v6:cc scan)))
          %v1  chat-scan-1+!>((v4:scan:v5:cc (v5:scan:v6:cc scan)))
          %v2  chat-scan-2+!>((v5:scan:v6:cc scan))
          %v3  chat-scan-3+!>(`scan:v6:cv`scan)
        ==
      %^    mention:hits-bound:search:di-pact
          (slav %ud skip.pole)
        (slav %ud count.pole)
      (slav %p nedl.pole)
    ==
  ::
  ++  di-unread
    %+  unread:di-pact  our.bowl
    [recency last-read unread-threads]:remark.dm
  ++  di-remark-diff
    |=  diff=remark-diff:c
    ^+  di-core
    =?  cor  =(%read -.diff)
      %-  emil
      =+  .^(=carpet:ha %gx /(scot %p our.bowl)/hark/(scot %da now.bowl)/desk/groups/latest/noun)
      %+  murn
        ~(tap by cable.carpet)
      |=  [=rope:ha =thread:ha]
      ?.  =(/dm/(scot %p ship) ted.rope)  ~
      =/  =cage  hark-action-1+!>([%saw-rope rope])
      `(pass-hark cage)
    =.  remark.dm
      ?-  -.diff
        %watch    remark.dm(watching &)
        %unwatch  remark.dm(watching |)
        %read-at  !! ::  ca-core(last-read.remark.chat p.diff)
      ::
          %read
        ::  now.bowl should always be greater than the last message id
        ::  because ids are generated by us
        %=  remark.dm
          last-read  now.bowl
          unread-threads  *(set id:c)
        ==
      ==
    =.  cor  (give-unread ship/ship di-unread)
    di-core
  ++  di-pass
    |%
    ++  pass
      |=  [=wire =dock =task:agent:gall]
      ^-  card
      [%pass (welp di-area wire) %agent dock task]
    ++  poke-them  |=([=wire =cage] (pass wire [ship dap.bowl] %poke cage))
    ++  proxy-rsvp  |=(ok=? (poke-them /proxy/rsvp/(scot %f ok) chat-dm-rsvp+!>([our.bowl ok])))
    ++  proxy
      |=  =diff:dm:c
      ::NOTE  static wire important for ordering guarantees and preventing flow
      ::      proliferation, see also +di-proxy
      (poke-them /proxy/diff chat-dm-diff-1+!>(diff))
    --
  --
--

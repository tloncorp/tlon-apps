::  talk-cli: cli chat client using groups' chat
::
::    pulls all known messages into a single stream.
::    type ;help for usage instructions.
::
/-  chat, cite, groups
/+  shoe, default-agent, verb, dbug
::
|%
+$  card  card:shoe
::
+$  state-1
  $:  %1
      sessions=(map sole-id session)                ::  sole sessions
      bound=(map target glyph)                      ::  bound glyphs
      binds=(jug glyph target)                      ::  glyph lookup
      settings=(set term)                           ::  frontend flags
      width=@ud                                     ::  display width
      timez=(pair ? @ud)                            ::  timezone adjustment
  ==
::
+$  sole-id  sole-id:shoe
+$  session
  $:  viewing=(set target)                          ::  connected targets
      history=(list [whom:chat id:chat])            ::  scrollback pointers
      count=@ud                                     ::  (lent history)
      audience=target                               ::  active target
  ==
::
+$  target  whom:chat                               ::  polymorphic id for channels
::
+$  glyph  char
++  glyphs  "!@#$%^&()-=_+[]\{}'\\:\",.<>?"
::
+$  command
  $%  [%target target]                              ::  set messaging target
      [%say (unit ship) (list inline:chat)]         ::  send message
      $:  %reference                                ::  reference a message
          $@(rel=@ud [zeros=@u abs=@ud])            ::
          (list inline:chat)                        ::
      ==                                            ::
      $:  %thread                                   ::  reply to a message thread
          $@(rel=@ud [zeros=@u abs=@ud])            ::
          (list inline:chat)                        ::
      ==                                            ::
      :: [%eval cord hoon]                          ::  send #-message
    ::                                              ::
      [%join target]                                ::  postive rsvp response
      [%deny target]                                ::  negative rsvp response
    ::                                              ::
      [%view $?(~ target)]                          ::  notice chat
      [%flee target]                                ::  ignore chat
    ::                                              ::
      [%bind glyph target]                          ::  bind glyph
      [%unbind glyph (unit target)]                 ::  unbind glyph
      [%what (unit $@(char target))]                ::  glyph lookup
    ::                                              ::
      [%settings ~]                                 ::  show active settings
      [%set term]                                   ::  set settings flag
      [%unset term]                                 ::  unset settings flag
      [%width @ud]                                  ::  adjust display width
      [%timezone ? @ud]                             ::  adjust time printing
    ::                                              ::
      [%select $@(rel=@ud [zeros=@u abs=@ud])]      ::  rel/abs msg selection
      [%chats ~]                                    ::  list available chats
      [%dms ~]                                      ::  list available dms
      [%clubs ~]                                    ::  list available clubs
      [%targets ~]                                  ::  list available targets
      [%help ~]                                     ::  print usage info
  ==                                                ::
::
--
=|  state-1
=*  state  -
::
%-  agent:dbug
%+  verb  |
%-  (agent:shoe command)
^-  (shoe:shoe command)
=<
  |_  =bowl:gall
  +*  this       .
      talk-core  +>
      tc         ~(. talk-core bowl)
      def        ~(. (default-agent this %|) bowl)
      des        ~(. (default:shoe this command) bowl)
  ::
  ++  on-init
    ^-  (quip card _this)
    [~ this(width 80)]
  ::
  ++  on-save  !>(state)
  ::
  ++  on-load
    |=  old-state=vase
    |^  ^-  (quip card _this)
        =/  old  !<(versioned-state old-state)
        =^  cards  state
          ?-  -.old
            %1  [~ old]
            %0  [~ (state-0-to-1 old)]
          ==
        [cards this]
    ::
    +$  versioned-state
      $%  state-1
          state-0
      ==
    ::
    +$  state-0
      $:  %0
          sessions=(map sole-id session-0)              ::  sole sessions
          bound=(map flag:chat glyph)                   ::  bound chat glyphs
          binds=(jug glyph flag:chat)                   ::  chat glyph lookup
          settings=(set term)                           ::  frontend flags
          width=@ud                                     ::  display width
          timez=(pair ? @ud)                            ::  timezone adjustment
    ==
    ::
    +$  session-0
      $:  viewing=(set flag:chat)                       ::  connected chats
          history=(list [flag:chat id:chat])            ::  scrollback pointers
          count=@ud                                     ::  (lent history)
          audience=flag:chat                            ::  active target
      ==
    ::  +state-0-to-1: state adapter
    ::
    ++  state-0-to-1
      |=  =state-0
      |^  ^-  state-1
      :*  %1
          (session-0-to-1 sessions.state-0)
          (bound bound.state-0)
          (binds binds.state-0 bound.state-0)
          settings.state-0
          width.state-0
          timez.state-0
      ==
      ::
      ++  history
        |=  history=(list [flag:chat id:chat])
        ^-  (list [whom:chat id:chat])
        %+  turn  history
        |=  [=flag:chat =id:chat]
        [[%flag flag] id]
      ::
      ++  bound
        |=  bound=(map flag:chat glyph)
        ^-  (map whom:chat glyph)
        %-  malt
        %+  turn  ~(tap by bound)
        |=  [=flag:chat =glyph]
        [[%flag flag] glyph]
      ::
      ++  session-0-to-1
        |=  sessions=(map sole-id session-0)
        ^-  (map sole-id session)
        %-  ~(run by sessions)
        |=  =session-0
        %=  session-0
          history   (history history.session-0)
          audience  `whom:chat`[%flag audience.session-0]
          viewing   (~(run in viewing.session-0) |=(=flag:chat [%flag flag]))
        ==
      ::
      ++  binds
        |=  $:  binds=(jug glyph flag:chat)
                bound=(map flag:chat glyph)
            ==
        ^-  (jug glyph whom:chat)
        =/  glyphs=(list glyph)
          ~(val by bound)
        =|  new-binds=(jug glyph whom:chat)
        |-
        ?~  glyphs  new-binds
        %=    $
            new-binds
          =/  targets=(list whom:chat)
            =+  flags=(~(get ju binds) i.glyphs)
            %~  tap  in
            ^-  (set whom:chat)
            %-  ~(run in flags)
            |=(=flag:chat [%flag flag])
          |-  ^-  (jug glyph whom:chat)
          ?~  targets  new-binds
          %=  $
            new-binds  (~(put ju new-binds) i.glyphs i.targets)
            targets    t.targets
          ==
        ::
            glyphs
          t.glyphs
        ==
      --
    --
  ::
  ++  on-poke
    |=  [=mark =vase]
    ^-  (quip card _this)
    =^  cards  state
      ?+  mark        (on-poke:def mark vase)
        %noun         (poke-noun:tc !<(* vase))
      ==
    [cards this]
  ::
  ++  on-agent
    |=  [=wire =sign:agent:gall]
    ^-  (quip card _this)
    =^  cards  state
      ?-    -.sign
        %poke-ack   [- state]:(on-agent:def wire sign)
        %watch-ack  [- state]:(on-agent:def wire sign)
      ::
          %kick
        :_  state
        ?+    wire  ~
            [%dm ship=@ %ui ~]  
          =/  =ship  (slav %p +<.wire)
          (connect:tc [%ship ship])
        ::
            [%club id=@ %ui ~]  
          =/  =club-id  (slav %uv +<.wire)
          (connect:tc [%club club-id])
        ::
            [%chat ship=@ name=@ %ui ~]  
          =/  =ship  (slav %p +<.wire)
          =/  name=term  (slav %tas +>-.wire)
          (connect:tc [%flag [ship name]])
        ==
      ::
          %fact  
        ?+     p.cage.sign  ~|([dap.bowl %bad-sub-mark wire p.cage.sign] !!)
            %writ-diff
          ?+    wire  ~
              [%dm ship=@ %ui ~] 
            %+  on-update:tc  
              :-  %ship 
              (slav %p +<.wire)
            !<(diff:dm:chat q.cage.sign)
          ::  
              [%club id=@ %ui ~]
            %+  on-update:tc  
              :-  %club 
              (slav %uv +<.wire)
            !<(diff:writs:chat q.cage.sign)
          ::
              [%chat ship=@ name=@ %ui ~]
            %+  on-update:tc
              :+  %flag  
                (slav %p +<.wire)
              (slav %tas +>-.wire)
            !<(diff:writs:chat q.cage.sign)
          ==
        ==
      ==
    [cards this]
  ++  on-arvo
    |=  [=wire =sign-arvo]
    ^-  (quip card _this)
    =^  cards  state
      ?+    wire  (on-arvo:def wire sign-arvo)
          [%timer %view-dm who=@ ses=@ ship=@ ~]
        ?+    sign-arvo  (on-arvo:def wire sign-arvo)
            [%behn %wake *]
          =/  ship=@p  (slav %p +>+>-.wire)
          =/  =sole-id  
            :-  (slav %p +>-.wire) 
            (slav %ta +>+<.wire)
          =/  =command  [%view [%ship ship]]
          ?~  error.sign-arvo
            (work:(make:sh:tc sole-id) command)
          (on-arvo:def wire sign-arvo)
        ==
      ==
    [cards this]
  ::
  ++  on-watch  on-watch:def
  ++  on-leave  on-leave:def
  ++  on-peek   on-peek:def
  ++  on-fail   on-fail:def
  ::
  ++  command-parser
    |=  =sole-id
    parser:(make:sh:tc sole-id)
  ::
  ++  tab-list
    |=  =sole-id
    tab-list:sh:tc
  ::
  ++  on-command
    |=  [=sole-id =command]
    =^  cards  state
      (work:(make:sh:tc sole-id) command)
    [cards this]
  ::
  ++  on-connect
    |=  =sole-id
    ^-  (quip card _this)
    [[prompt:(make:sh-out:tc sole-id)]~ this]
  ::
  ++  can-connect     can-connect:des
  ++  on-disconnect   on-disconnect:des
  --
::
|_  =bowl:gall
::  +subscription-check: confirm whether a target is subscribed to or not
::
++  subscription-check
  |=  =target
  ^-  ?
  =/  =wire
    (weld (target-to-path target) /ui)
  (~(has by wex.bowl) [wire our-self %chat])
::  +connect: subscribe to chats, dms, and clubs
::
++  connect
  |=  =target
  ^-  (list card)
  =/  =path
    (weld (target-to-path target) /ui)
  ?:  (subscription-check target)  ~
  :_  ~
  [%pass path %agent [our-self %chat] %watch (weld path /writs)]
::  +poke-noun: debug helpers
::
++  poke-noun
  |=  a=*
  |^  ^-  (quip card _state)
  ?.  ?=(poke-options a)
    ~|([%unknown-command ~] !!)
  ?-    -.a
  ::  check if target is in %chat agent
  ::
      %target-exists
    ?:  (target-exists p.a)  [~ state]
    ~&  "target not found in %chat agent"
    [~ state]
  ::  are our session's histories equal to our counts?
  ::
      %history-equal-to-count
    =/  sez=(list [=sole-id =session])
      ~(tap by sessions)
    |-
    ?~  sez  [~ state]
    ?:  .=  count.session.i.sez
        (lent history.session.i.sez)
      $(sez t.sez)
    ~&  "session {(scow %ta ses.sole-id.i.sez)}'s history is not equal to its count"
    $(sez t.sez)
  ::  do all targets across sessions in view have a subscription?
  ::
      %subscription-status
    =/  sez=(list [=sole-id =session])
      ~(tap by sessions)
    |-
    ?~  sez  [~ state]
    =*  check-targets
      %+  turn  ~(tap in viewing.session.i.sez)
      ::  output warning if target is not subscribed
      ::
      |=  =target
      ^-  _target
      ?:  (subscription-check target)
        target
      =;  output=tape
        ~&  output
        target
      %+  weld
        "session {(scow %ta ses.sole-id.i.sez)} is not subscribed to "
      ~(full tr target)
    $(sez t.sez)
  ==
  ::  +poke-options: +poke-noun will accept the following actions
  ::
  +$  poke-options
    $%  [%target-exists p=target]
        [%subscription-status ~]
        [%history-equal-to-count ~]
    ==
  --
::
::TODO  better moon support. (name:title our.bowl)
++  our-self  our.bowl
++  crew  crew:club:chat
++  club-id  id:club:chat
::
++  get-session
  |=  =sole-id
  ^-  session
  (~(gut by sessions) sole-id %*(. *session audience [%flag [our-self %$]]))
::  +tor: term ordering for chats 
::
++  tor
  |=  [[* a=term] [* b=term]]
  (aor a b)
::  +get-chats: get known chats 
::
++  get-chats  ~+
  ^-  (set flag:chat)
  (scry-for (set flag:chat) %chat /chat)
::  +get-accepted-dms: get known dms that are mutual and ones we've initiated
::
++  get-accepted-dms  ~+
  ^-  (set ship)
  (scry-for (set ship) %chat /dm)
::  +get-pending-dms: get known dm invites
::
++  get-pending-dms  ~+
  ^-  (set ship)
  (scry-for (set ship) %chat /dm/invited)
::  +get-clubs: get known clubs
::
++  get-clubs  ~+
  ^-  (map club-id crew)
  =/  clubs  
    (scry-for (map club-id crew) %chat /clubs)
  ::  remove archived
  ::
  =/  ids=(list club-id)  
    ~(tap in ~(key by clubs))
  |-
  ?~  ids  clubs
  =/  team  team:(~(got by clubs) i.ids)
  =/  hive  hive:(~(got by clubs) i.ids)
  ?.  &(=(~ team) =(~ hive))
    $(ids t.ids)
  $(clubs (~(del by clubs) i.ids), ids t.ids)
::  +target-exists: check whether a channel exists
::
++  target-exists
  |=  =target
  ^-  ?
  ?-   -.target
      %flag  (~(has in get-chats) p.target)
      %club  (~(has by get-clubs) p.target)
      %ship
    %.  p.target
    %~  has  in 
    (~(uni in get-accepted-dms) get-pending-dms)
  ==
::  +message-exists: check whether a message exists
::
++  message-exists
  |=  [=whom:chat =id:chat]
  ^-  ?
  =/  =time  q.id
  =/  author=ship  p.id
  %+  scry-for-existence  %chat
  %+  weld  (target-to-path whom)
  /writs/writ/id/(scot %p author)/(scot %ud time)
::  +build-history: add messages to history and output to a given session
::
++  build-history
  |=  [=sole-id =session =target]
  ^-  (quip card _state)
  =/  messages  
    (flop (bap:on:writs:chat (get-messages target)))
  =|  cards=(list card)
  |-  
  ?~  messages  [cards state] 
  =/  =writ:chat  +.i.messages
  =/  =id:chat    id.writ
  =/  =memo:chat  +.writ
  =^  caz  session
    (~(read-post se sole-id session) target id memo)
  =.  sessions  (~(put by sessions) sole-id session)  
  $(messages t.messages, cards (weld cards caz))
::  +get-messages: scry for latest 20 messages
::
++  get-messages
  |=  =target
  ^-  ((mop time writ:chat) lte) 
  %^  scry-for  ((mop time writ:chat) lte)
    %chat
  (weld (target-to-path target) /writs/newest/20)
::  +on-update: get new messages
::
++  on-update 
  |=  [=whom:chat =diff:writs:chat]
  ^-  (quip card _state)
  ?.  ?=(%add -.q.diff)  [~ state]
  =*  id=id:dm:chat  p.diff
  =*  memo=memo:chat  p.q.diff
  (update-session whom memo id)
::  +update-session: process message updates
::
++  update-session
  |=  $:  =whom:chat
          =memo:chat 
          =id:chat 
      ==
  ^-  (quip card _state)
  =/  sez=(list [=sole-id =session])
    ~(tap by sessions)
  =|  cards=(list card)
  |-
  ?~  sez  [cards state]
  =^  caz  session.i.sez
    ?.  (~(has in viewing.session.i.sez) whom)
      [~ session.i.sez]
    (~(read-post se i.sez) whom id memo)
  =.  sessions  (~(put by sessions) i.sez)
  $(sez t.sez, cards (weld cards caz))
::  +se: session event handling
::
++  se
  |_  [=sole-id =session]
  +*  sh-out  ~(. ^sh-out sole-id session)
  ::
  ::  +read-post: add message to state and show it to user
  ::
  ++  read-post
    |=  $:  =target
            =id:chat
            =memo:chat
        ==
    ^-  (quip card _session)
    :-  (show-post:sh-out target memo) 
    %_  session
      history  [[target id] history.session]
      count    +(count.session)
    ==
  ::
  ++  notice-remove
    |=  =target
    ^-  (quip card _session)
    ?.  (~(has in viewing.session) target)
      [~ session]
    :-  [(show-delete:sh-out target) ~]
    session(viewing (~(del in viewing.session) target))
  --
::  +bind-default-glyph: bind to default, or random available
::
++  bind-default-glyph
  |=  =target
  ^-  (quip card _state)
  =;  =glyph  (bind-glyph glyph target)
  |^  =/  g=glyph  (choose glyphs)
      ?.  (~(has by binds) g)  g
      =/  available=(list glyph)
        %~  tap  in
        (~(dif in `(set glyph)`(sy glyphs)) ~(key by binds))
      ?~  available  g
      (choose available)
  ++  choose
    |=  =(list glyph)
    =;  i=@ud  (snag i list)
    (mod (mug target) (lent list))
  --
::  +bind-glyph: add binding for glyph
::
++  bind-glyph
  |=  [=glyph =target]
  ^-  (quip card _state)
  ::TODO  should send these to settings store eventually
  ::  if the target was already bound to another glyph, un-bind that
  ::
  =?  binds  (~(has by bound) target)
    (~(del ju binds) (~(got by bound) target) target)
  =.  bound  (~(put by bound) target glyph)
  =.  binds  (~(put ju binds) glyph target)
  [(show-glyph:sh-out glyph `target) state]
::  +unbind-glyph: remove all binding for glyph
::
++  unbind-glyph
  |=  [=glyph targ=(unit target)]
  ^-  (quip card _state)
  ?^  targ
    =.  binds  (~(del ju binds) glyph u.targ)
    =.  bound  (~(del by bound) u.targ)
    [(show-glyph:sh-out glyph ~) state]
  =/  ole=(set target)
    (~(get ju binds) glyph)
  =.  binds  (~(del by binds) glyph)
  =.  bound
    |-
    ?~  ole  bound
    =.  bound  $(ole l.ole)
    =.  bound  $(ole r.ole)
    (~(del by bound) n.ole)
  [(show-glyph:sh-out glyph ~) state]
::  +decode-glyph: find the target that matches a glyph, if any
::
++  decode-glyph
  |=  [=session =glyph]
  ^-  (unit target)
  =+  lax=(~(get ju binds) glyph)
  ::  no target
  ?:  =(~ lax)  ~
  %-  some
  ::  single target
  ?:  ?=([* ~ ~] lax)  n.lax
  ::  in case of multiple matches, pick one we're viewing
  =.  lax  (~(uni in lax) viewing.session)
  ?:  ?=([* ~ ~] lax)  n.lax
  ::  in case of multiple audiences, pick the most recently active one
  |-  ^-  target
  ?~  history.session  -:~(tap in lax)
  =*  tar  -.i.history.session
  ?:  (~(has in lax) tar)
    tar
  $(history.session t.history.session)
::
::  +sh: shoe handling
::
++  sh
  |_  [=sole-id session]
  +*  session  +<+
      sh-out   ~(. ^sh-out sole-id session)
      put-ses  state(sessions (~(put by sessions) sole-id session))
  ::
  ++  make
    |=  =^sole-id
    %_  ..make
      sole-id  sole-id
      +<+      (get-session sole-id)
    ==
  ::  +read: command parser
  ::
  ::    parses the command line buffer.
  ::    produces commands which can be executed by +work.
  ::
  ++  parser
    |^
      %+  stag  |
      %+  knee  *command  |.  ~+
      =-  ;~(pose ;~(pfix mic -) message)  
      ;~  pose
        (stag %say dm)
        (stag %target targ)
      :: 
        ;~((glue ace) (tag %join) targ)
        ;~((glue ace) (tag %deny) targ)
      ::
        ;~((glue ace) (tag %view) targ)
        ;~((glue ace) (tag %flee) targ)
        ;~(plug (tag %view) (easy ~))
      ::
        ;~((glue ace) (tag %bind) glyph targ)
        ;~((glue ace) (tag %unbind) ;~(plug glyph (punt ;~(pfix ace targ))))
        ;~(plug (perk %what ~) (punt ;~(pfix ace ;~(pose glyph targ))))
      ::
        ;~(plug (tag %settings) (easy ~))
        ;~((glue ace) (tag %set) flag)
        ;~((glue ace) (tag %unset) flag)
        ;~(plug (cold %width (jest 'set width ')) dem:ag)
      ::
        ;~  plug
          (cold %timezone (jest 'set timezone '))
          ;~  pose
            (cold %| (just '-'))
            (cold %& (just '+'))
          ==
          %+  sear
            |=  a=@ud
            ^-  (unit @ud)
            ?:(&((gte a 0) (lte a 14)) `a ~)
          dem:ag
        ==
      ::
        ;~(plug (tag %chats) (easy ~))
        ;~(plug (tag %dms) (easy ~))
        ;~(plug (tag %clubs) (easy ~))
        ;~(plug (tag %targets) (easy ~))
        ;~(plug (tag %help) (easy ~))
      ::
        (stag %thread ;~(plug ;~(pfix ket nump) ;~(pfix ace content)))
        (stag %reference ;~(plug ;~(pfix hax nump) ;~(pfix ace content)))
        (stag %select nump)
      ==
    ::
    ::TODO
    :: ++  cmd
    ::   |*  [cmd=term req=(list rule) opt=(list rule)]
    ::   |^  ;~  plug
    ::         (tag cmd)
    ::       ::
    ::         ::TODO  this feels slightly too dumb
    ::         ?~  req
    ::           ?~  opt  (easy ~)
    ::           (opt-rules opt)
    ::         ?~  opt  (req-rules req)
    ::         ;~(plug (req-rules req) (opt-rules opt))  ::TODO  rest-loop
    ::       ==
    ::   ++  req-rules
    ::     |*  req=(lest rule)
    ::     =-  ;~(pfix ace -)
    ::     ?~  t.req  i.req
    ::     ;~(plug i.req $(req t.req))
    ::   ++  opt-rules
    ::     |*  opt=(lest rule)
    ::     =-  (punt ;~(pfix ace -))
    ::     ?~  t.opt  ;~(pfix ace i.opt)
    ::     ;~(pfix ace ;~(plug i.opt $(opt t.opt)))
    ::   --
    ::
    ++  group    ;~((glue fas) ship sym)
    ++  tag      |*(a=@tas (cold a (jest a)))  ::TODO  into stdlib
    ++  ship     ;~(pfix sig fed:ag)
    ++  name     ;~(pfix fas urs:ab)
    ++  club-id  (cook |=(a=@ `@uv`a) ;~(pfix (jest '0v') viz:ag))
    ::  +tarl: local flag:chat, as /path
    ::
    ++  tarl  (stag our-self name)
    ::  +targ: any target, as tarl, tarp, ship, club id, ~ship/path or glyph
    ::
    ++  targ
      ;~  pose
        %+  cook
          |=  =target
          target
        ;~  pose
          (stag %flag tarl)
          (stag %flag ;~(plug ship name))
          (stag %club club-id)
          (stag %ship ship)
        ==
        (sear (cury decode-glyph session) glyph)
      ==
    ::  +tars: set of comma-separated targs
    ::
    ++  tars
      %+  cook  ~(gas in *(set target))
      (most ;~(plug com (star ace)) targ)
    ::  +ships: set of comma-separated ships
    ::
    ++  ships
      %+  cook  ~(gas in *(set ^ship))
      (most ;~(plug com (star ace)) ship)
    ::  +glyph: shorthand character
    ::
    ++  glyph  (mask glyphs)
    ::  +flag: valid flag
    ::
    ++  flag
      %-  perk  :~
        %notify
        %showtime
      ==
    ::  +nump: message number reference
    ::
    ++  nump
      ;~  pose
        ;~(pfix hep dem:ag)
        ;~  plug
          (cook lent (plus (just '0')))
          ;~(pose dem:ag (easy 0))
        ==
        (stag 0 dem:ag)
        (cook lent (star mic))
      ==
    ::  +dm: send a direct message to a ship
    ::
    ++  dm 
      ;~  plug 
        (cook |=(s=@p [~ s]) ship)
        ;~(pfix ace content)
      ==
    ::  +message: all messages
    ::
    ++  message
      ;~  pose
        :: ;~(plug (cold %eval hax) expr)
        (stag %say ;~(plug (easy [~]) content))
      ==
    ::  +content: simple messages
    ::
    ++  content
      ;~  pose
        (cook (late ~) (cook |=(url=@t [%link url url]) turl))
        ;~(less mic text)
      ==
    ::  +turl: url parser
    ::
    ++  turl
      =-  (sear - (plus next))
      |=  t=tape
      ^-  (unit cord)
      ?~((rust t aurf:de-purl:html) ~ `(crip t))
    ::  +text: text message body
    ::
    ++  text
      %+  cook
        |=  a=(list $@(@t [%ship @p]))
        ^-  (list inline:chat)
        %-  flop
        %+  roll  a
        |=  [i=$@(@t [%ship @p]) l=(list inline:chat)]
        ^+  l
        ?~  l    [i]~
        ?^  i    [i l]
        ?^  i.l  [i l]
        [(cat 3 i.l i) t.l]
      (plus ;~(pose (stag %ship ;~(pfix sig fed:ag)) next))
    ::  +expr: parse expression into [cord hoon]
    ::
    ++  expr
      |=  tub=nail
      %.  tub
      %+  stag  (crip q.tub)
      wide:(vang & [&1:% &2:% (scot %da now.bowl) |3:%])
    --
  ::  +tab-list: command descriptions
  ::
  ++  tab-list
    ^-  (list [@t tank])
    :~
      [';view' leaf+";view (glyph / ~ship / 0v.group.chat.id / ~host/chat)"]
      [';flee' leaf+";flee [glyph / ~ship / 0v.group.chat.id / ~host/chat]"]
    ::
      [';join' leaf+";join [glyph / ~ship / 0v.group.chat.id]"]
      [';deny' leaf+";deny [glyph / ~ship / 0v.group.chat.id]"]
    ::
      [';bind' leaf+";bind [glyph] [~ship / 0v.group.chat.id / ~host/chat]"]
      [';unbind' leaf+";unbind [glyph] (~ship / 0v.group.chat.id / ~host/chat)"]
      [';what' leaf+";what (glyph / ~ship / 0v.group.chat.id / ~host/chat)"]
    ::
      [';settings' leaf+";settings"]
      [';set' leaf+";set key (value)"]
      [';unset' leaf+";unset key"]
    ::
      [';chats' leaf+";chats"]
      [';dms' leaf+";dms"]
      [';clubs' leaf+";clubs"]
      [';targets' leaf+";targets"]
      [';help' leaf+";help"]
    ==
  ::  +work: run user command
  ::
  ++  work
    |=  job=command
    ^-  (quip card _state)
    |^  ?-   -.job
            %target     (set-target +.job)
            %say        (say +.job)
            %reference  (reference +.job)
            %thread     (thread +.job)
            :: %eval      (eval +.job)
        ::
            %join       (rsvp-or-print & +.job)
            %deny       (rsvp-or-print | +.job)
        ::
            %view       (view +.job)
            %flee       (flee +.job)
        ::
            %bind       (bind-glyph +.job)
            %unbind     (unbind-glyph +.job)
            %what       (lookup-glyph +.job)
        ::
            %settings   show-settings
            %set        (set-setting +.job)
            %unset      (unset-setting +.job)
            %width      (set-width +.job)
            %timezone   (set-timezone +.job)
        ::
            %select     (select +.job)
            %chats      chats
            %dms        dms
            %clubs      clubs
            %targets    targets
            %help       help
        ::
        ==
    ::  +act: build action card
    ::
    ++  act
      |=  [what=term app=term =cage]
      ^-  card
      :*  %pass
          /cli-command/[what]
          %agent
          [our-self app]
          %poke
          cage
      ==
    ::  +compose-channel: set audience and render message history
    ::
    ++  compose-channel
      |=  =target
      ^-  (quip card _state)
      =.  audience  target
      =.  viewing  (~(put in viewing) target)
      =^  history-cards  state
        (build-history sole-id session target)
      :_  state
      %+  weld  [prompt:sh-out]~
      `(list card)`history-cards
    ::  +change-channel: send rsvp response, bind glyph, subscribe, 
    ::  set audience, and render message history
    ::
    ++  switch-channel
      |=  =target
      ^-  (quip card _state)
      =^  rsvp-cards     state  (rsvp & target)
      =^  compose-cards  state  (compose-channel target)
      ::  send watch card for target not in view
      ::
      =^  watch-cards    state
        ?:  (~(has in viewing) target)  [~ state]
        [(connect target) state]
      ::  bind an unbound target
      ::
      =^  bind-cards     state
        ?:  (~(has by bound) target)  [~ state]
        (bind-default-glyph target)
      :_  state 
      ^-  (list card)
      ;:  weld 
        rsvp-cards
        bind-cards
        watch-cards
        compose-cards
      ==
    ::  +set-target: set audience, update prompt
    ::
    ++  set-target
      |=  =target
      ^-  (quip card _state)
      ?:  (~(has in viewing) target)
        (compose-channel target)
      =.  audience  target
      [[prompt:sh-out ~] put-ses]
    ::  +view: start printing messages from a chat
    ::
    ++  view
      |=  target=$?(~ target)
      ^-  (quip card _state)
      ::  without argument, print all we're viewing
      ::
      ?~  target
        [[(show-targets:sh-out ~(tap in viewing))]~ state]
      ::  only view existing chats
      ::
      ?.  (target-exists target)
        [[(note:sh-out "no such chat")]~ put-ses]
      (switch-channel target)
    ::  +flee: stop printing messages from a chat
    ::
    ++  flee
      |=  =target
      ^-  (quip card _state)
      ?.  (~(has in viewing) target)  
        [~ put-ses]
      =.  viewing  (~(del in viewing) target)
      =/  =path
        (weld (target-to-path target) /ui)
      :_  put-ses
      :_  ~
      [%pass path %agent [our-self %chat] %leave ~]
    ::  +rsvp-or-print: send rsvp response or produce a printout if error occurs
    ::
    ++  rsvp-or-print
      |=  [ok=? =target]
      |^  ^-  (quip card _state)
          =/  printout=(unit tape)
            (error target)
          ?~  printout
            (rsvp ok target)
          :_  put-ses
          [(note:sh-out u.printout)]~
      ++  error
        |=  =whom:chat
        ^-  (unit tape)
        ?-   -.whom
            %flag  `"chat invite handling not supported"
            %ship
          =/  =ship  p.whom
          ?:  (~(has in get-pending-dms) ship)  ~
          `"no pending dm invite from {(scow %p ship)}"
        ::
            %club
          =/  =club-id  p.whom
          =/  crew=(unit crew)  
            (~(get by get-clubs) club-id)
          ?~  crew
            `"no group chat invite for {(scow %uv club-id)}"
          ?:  (~(has in hive.u.crew) our-self)  ~
          `"no pending group chat invite for {(scow %uv club-id)}"
        ==
      --
    ::  +rsvp: send rsvp response
    ::
    ++  rsvp
      |=  [ok=? =target]
      ^-  (quip card _state)
      ?-   -.target
          %flag  [~ state]
          %ship
        =/  =ship  +.target
        ?.  (~(has in get-pending-dms) ship)
          [~ state]
        :_  state
        :_  ~
        %^  act  %rsvp-response
          %chat
        [%dm-rsvp !>(`rsvp:dm:chat`[ship ok])]
      ::
          %club
        =/  =club-id  +.target
        =/  crew=(unit crew)  
          (~(get by get-clubs) club-id)
        ?~  crew  [~ state]
        ?.  (~(has in hive.u.crew) our-self)
          [~ state]
        :_  state
        :_  ~
        %^  act  %rsvp-response
          %chat
        :-  %club-action
        !>  ^-  action:club:chat
        [club-id *echo:club:chat %team our-self ok]   
      ==
    :: +send: make a poke card based on audience
    ::
    ++  send
      |=  $:  msg=(list inline:chat)
              replying=(unit id:chat)
              block=(list block:chat)
          ==
      =/  =memo:chat 
        [replying our.bowl now.bowl %story block msg]
      %^  act  %out-message
        %chat
      ?-   -.audience
          %ship 
        :-  %dm-action
        !>  ^-  action:dm:chat
        [p.audience [our now]:bowl %add memo]
      ::
          %club   
        :-  %club-action
        !>  ^-  action:club:chat
        ::TODO  change 1 to *echo:club:chat once #2009 is fixed
        [p.audience 1 %writ [our now]:bowl %add memo]   
      ::
          %flag
        :-  %chat-action-0
        !>  ^-  action:chat
        [p.audience now.bowl %writs [our now]:bowl %add memo]
      ==
    ::  +say: send messages
    ::
    ++  say
      |=  [who=(unit ship) msg=(list inline:chat)]
      ^-  (quip card _state)
      ?~  who  [[(send msg ~ ~)]~ put-ses]
      =/  =whom:chat  [%ship (need who)]
      =.  audience  whom
      =^  cards  state
        ?:  (target-exists whom)
          ::  for existing dm, switch channel then pass message
          ::
          =+  (switch-channel whom)
          [(weld -.- [(send msg ~ ~)]~) +.-]
        ::  for new dm, pass message then switch channel
        ::
        :_  state
        %+  welp  [(send msg ~ ~)]~
        ::  delay the channel change so our message arrives to 
        ::  %chat before we scry
        ::
        :_  ~ 
        :*  %pass
            ;:  weld 
              /timer/view-dm
              /(scot %p who.sole-id)
              /(scot %ta ses.sole-id)/(scot %p u.who)
            ==
            %arvo
            %b
            %wait
            (add now.bowl ~s0)
        ==
      [cards state]
    ::  +reference: use a pointer to reference a message
    ::
    ++  reference
      |=  $:  num=$@(rel=@ud [zeros=@u abs=@ud])
              msg=(list inline:chat)
          ==
      ^-  (quip card _state)
      =/  pack=(each [=whom:chat =writ:chat] tape)
        (pointer-to-message num)
      ?-   -.pack
          %|  [[(note:sh-out p.pack)]~ state]
          %&
        ?.  ?=(%flag -.whom.p.pack)
          :_  state
          [(note:sh-out "message referencing is only available in chats from a group")]~
        =/  =seal:chat   -.writ.p.pack
        =/  =memo:chat   +.writ.p.pack
        =/  host=ship    p.p.whom.p.pack
        =/  name=@tas    q.p.whom.p.pack
        =/  =time        q.id.seal
        =/  wer=path  /msg/(scot %p author.memo)/(scot %ud time)
        =/  =block:chat
          [%cite `cite:cite`[%chan `nest:groups`[%chat [host name]] wer]]
        =.  audience  whom.p.pack
        :_  put-ses
        [(send ?~(msg ~ msg) ~ [block]~)]~
      ==
    ::  +thread: thread reply with pointer reference
    ::
    ++  thread
      |=  $:  num=$@(rel=@ud [zeros=@u abs=@ud])
              msg=(list inline:chat)
          ==
      ^-  (quip card _state)
      =/  pack=(each [=whom:chat =writ:chat] tape)
        (pointer-to-message num)
      ?-   -.pack
          %|  [[(note:sh-out p.pack)]~ state]
          %&
        =/  replying=(unit id:chat)
          ?~  replying.writ.p.pack
            `id.writ.p.pack
          replying.writ.p.pack
        =.  audience  whom.p.pack
        :_  put-ses
        [(send msg replying ~)]~
      ==
    ::  +eval: run hoon, send code and result as message
    ::
    ::    this double-virtualizes and clams to disable .^ for security reasons
    ::
    ++  eval
      |=  [txt=cord exe=hoon]
      ~&  %eval-tmp-disabled
      [~ state]
      ::TODO  why -find.eval??
      :: (say %code txt (eval:store bowl exe))
    ::  +lookup-glyph: print glyph info for all, glyph or target
    ::
    ++  lookup-glyph
      |=  qur=(unit $@(glyph target))
      ^-  (quip card _state)
      =-  [[- ~] state]
      ?^  qur
        ?^  u.qur
          =+  gyf=(~(get by bound) u.qur)
          (print:sh-out ?~(gyf "none" [u.gyf]~))
        :: TODO pass through +nome?
        =+  pan=~(tap in (~(get ju binds) `@t`u.qur))
        ?:  =(~ pan)  (print:sh-out "~")
        =<  (effect:sh-out %mor (turn pan .))
        |=(t=target [%txt ~(meta tr t)])
      %-  print-more:sh-out
      %-  ~(rep by binds)
      |=  $:  [=glyph targets=(set target)]
              lis=(list tape)
          ==
      %+  weld  lis
      ^-  (list tape)
      %-  ~(rep in targets)
      |=  [=whom:chat l=(list tape)]
      %+  weld  l
      ^-  (list tape)
      [glyph ' ' ~(meta tr whom)]~
    ::  +show-settings: print enabled flags, timezone and width settings
    ::
    ++  show-settings
      ^-  (quip card _state)
      :_  state
      :~  %-  print:sh-out
          %-  zing
          ^-  (list tape)
          :-  "flags: "
          %+  join  ", "
          (turn `(list @t)`~(tap in settings) trip)
        ::
          %-  print:sh-out
          %+  weld  "timezone: "
          ^-  tape
          :-  ?:(p.timez '+' '-')
          (scow %ud q.timez)
        ::
          (print:sh-out "width: {(scow %ud width)}")
      ==
    ::  +set-setting: enable settings flag
    ::
    ++  set-setting
      |=  =term
      ^-  (quip card _state)
      [~ state(settings (~(put in settings) term))]
    ::  +unset-setting: disable settings flag
    ::
    ++  unset-setting
      |=  =term
      ^-  (quip card _state)
      [~ state(settings (~(del in settings) term))]
    ::  +set-width: configure cli printing width
    ::
    ++  set-width
      |=  w=@ud
      [~ state(width (max 40 w))]
    ::  +set-timezone: configure timestamp printing adjustment
    ::
    ++  set-timezone
      |=  tz=[? @ud]
      [~ state(timez tz)]
    ::  +select: expand message from number reference
    ::
    ++  select
      ::NOTE  rel is the nth most recent message,
      ::      abs is the last message whose numbers ends in n
      ::      (with leading zeros used for precision)
      ::
      |=  num=$@(rel=@ud [zeros=@u abs=@ud])
      ^-  (quip card _state)
      =/  pack=(each [=whom:chat =writ:chat] tape)
        (pointer-to-message num)
      ?-   -.pack
          %|  [[(note:sh-out p.pack)]~ state]
          %&
        =/  tum=tape
          ?@  num
            (scow %s (new:si | +(num)))
          (scow %ud (index (dec count) num))
        =.  audience  whom.p.pack
        :_  put-ses
        ^-  (list card)
        :~  (print:sh-out ['?' ' ' tum])
            (effect:sh-out ~(render-activate mr whom.p.pack +.writ.p.pack))
            prompt:sh-out
        ==
      ==
    ::  +pointer-to-message: get message from number reference
    ::  or reason why it's not there
    ::
    ++  pointer-to-message
      |=  num=$@(rel=@ud [zeros=@u abs=@ud])
      ^-  (each [whom:chat writ:chat] tape)
      |^  ?@  num
            =+  tum=(scow %s (new:si | +(num)))
            ?:  (gte rel.num count)
              [%| "{tum}: no such message"]
            (produce tum rel.num)
          ?.  (gte abs.num count)
            ?:  =(count 0)
              [%| "0: no messages"]
            =+  msg=(index (dec count) num)
            (produce (scow %ud msg) (sub count +(msg)))
          [%| "…{(reap zeros.num '0')}{(scow %ud abs.num)}: no such message"]
      ::  +produce: produce message if it exists
      ::
      ++  produce
        |=  [number=tape index=@ud]
        ^-  (each [whom:chat writ:chat] tape)
        =/  [=whom:chat =id:chat]  
          (snag index history)
        ?.  (message-exists whom id)
          [%| "…{number}: message was deleted"]
        =+  %^  scry-for-marked  ,[* =writ:chat]
              %chat
            (writ-scry-path whom id)
        [%& [whom writ]]
      --
    ::  +index: get message index from absolute reference
    ::
    ++  index
      |=  [max=@ud nul=@u fin=@ud]
      ^-  @ud
      =+  dog=|-(?:(=(0 fin) 1 (mul 10 $(fin (div fin 10)))))
      =.  dog  (mul dog (pow 10 nul))
      =-  ?:((lte - max) - (sub - dog))
      (add fin (sub max (mod max dog)))
    ::  +chats: display list of joined chats
    ::
    ++  chats
      ^-  (quip card _state)
      =/  targets=(set target)
        (~(run in get-chats) (lead %flag))
      :_  state
      [(show-targets:sh-out ~(tap in targets))]~ 
    ::  +dms: display list of known dms
    ::
    ++  dms
      ^-  (quip card _state)
      =/  targets=(set target)
        %-  %~  run  in 
            (~(uni in get-accepted-dms) get-pending-dms)
        (lead %ship)
      :_  state
      [(show-targets:sh-out ~(tap in targets))]~
    ::  +clubs: display list of known clubs
    ::
    ++  clubs
      ^-  (quip card _state)
      =/  targets=(set target)
        (~(run in ~(key by get-clubs)) (lead %club))
      :_  state
      [(show-targets:sh-out ~(tap in targets))]~
    ::  +targets: display list of known targets
    ::
    ++  targets
      ^-  (quip card _state)
      =^  dm-cards    state  dms
      =^  chat-cards  state  chats
      =^  club-cards  state  clubs
      :_  state
      :(weld dm-cards chat-cards club-cards)
    ::  +help: print (link to) usage instructions
    ::
    ++  help
      ^-  (quip card _state)
      :_  state
      =-  (turn - print-more:sh-out)
      :~  %-  limo
          :*  ";[targets / chats / clubs / dms] to print available chat channels."
              ";view [~ship / 0vgroup.chat.id / ~host/chat] to print messages for a chat you've already joined."
              ";flee [~ship / 0vgroup.chat.id / ~host/chat] to stop printing messages for a chat."
              ";join [~ship / 0vgroup.chat.id] to accept a dm or group chat invite without changing the chat you're viewing."
              ";deny [~ship / 0vgroup.chat.id] to decline a dm or group chat invite."
              ";~ship [message] to send a dm and print its messages."
              ";[scrollback.pointer] to select a message."
              ";#[scrollback.pointer] [message] to reference a message with a response (only chats from groups supported)."
              ";^[scrollback.pointer] [message] to send a thread response."
              "For more details:"
              "https://urbit.org/getting-started/getting-around"
              ~
          ==
      ==
    --
  --
::
::  +sh-out: ouput to session
::
++  sh-out
  |_  [=sole-id session]
  ++  make
    |=  =^sole-id
    %_  ..make
      sole-id  sole-id
      +<+      (get-session sole-id)
    ==
  ::  +effex: emit shoe effect card
  ::
  ++  effex
    |=  effect=shoe-effect:shoe
    ^-  card
    [%shoe ~[sole-id] effect]
  ::  +effect: emit console effect card
  ::
  ++  effect
    |=  effect=sole-effect:shoe
    ^-  card
    (effex %sole effect)
  ::  +print: puts some text into the cli as-is
  ::
  ++  print
    |=  txt=tape
    ^-  card
    (effect %txt txt)
  ::  +print-more: puts lines of text into the cli
  ::
  ++  print-more
    |=  txs=(list tape)
    ^-  card
    %+  effect  %mor
    (turn txs |=(t=tape [%txt t]))
  ::  +note: prints left-padded ---| txt
  ::
  ++  note
    |=  txt=tape
    ^-  card
    =+  lis=(simple-wrap txt (sub width 16))
    %-  print-more
    =+  ?:((gth (lent lis) 0) (snag 0 lis) "")
    :-  (runt [14 '-'] '|' ' ' -)
    %+  turn  (slag 1 lis)
    |=(a=tape (runt [14 ' '] '|' ' ' a))
  ::  +prompt: update prompt to display current audience
  ::
  ++  prompt
    ^-  card
    %+  effect  %pro
    :+  &  %talk-line
    =+  ~(show tr audience)
    ?:(=(1 (lent -)) "{-} " "[{-}] ")
  ::  +show-post: print incoming message
  ::
  ::    every five messages, prints the message number also.
  ::    if the message mentions the user's ship,
  ::    and the %notify flag is set, emit a bell.
  ::
  ++  show-post
    |=  [=target =memo:chat]
    ^-  (list card)
    %+  weld
      ^-  (list card)
      ?.  =(0 (mod count 5))  ~
      :_  ~
      =+  num=(scow %ud count)
      %-  print
      (runt [(sub 13 (lent num)) '-'] "[{num}]")
    ^-  (list card)
    :-  (effex ~(render-inline mr target memo))
    =;  mentioned=?
      ?.  mentioned  ~
      [(effect %bel ~)]~
    ?.  ?=(%story -.content.memo)  |
    %+  lien  q.p.content.memo
    (cury test %ship our.bowl)
  ::  +show-create: print mailbox creation notification
  ::
  ++  show-create
    |=  =target
    ^-  card
    (note "new: {~(phat tr target)}")
  ::  +show-delete: print mailbox deletion notification
  ::
  ++  show-delete
    |=  =target
    ^-  card
    (note "del: {~(phat tr target)}")
  ::  +show-glyph: print glyph un/bind notification
  ::
  ++  show-glyph
    |=  [=glyph target=(unit target)]
    ^-  (list card)
    :_  [prompt ~]
    %-  note
    %+  weld  "set: {[glyph ~]} "
    ?~  target  "unbound"
    ~(phat tr u.target)
  ::  +show-targets: print list of targets
  ::
  ++  show-targets
    |=  targets=(list target)
    |^  ^-  card
    %-  print-more
    %+  turn  (sort targets order)
    |=  =target
    =/  glyph=(unit tape)
      ?.  (~(has by bound) target)  ~
      (some ~(glyph tr target))
    :(weld (fall glyph " ") " " ~(meta tr target))
    ::  +order: ships go before chats who go before clubs
    ::
    ++  order
      |=  [a=target b=target]
      ^-  ?
      ?:  &(?=(%ship -.a) ?=(%ship -.b))  
        (aor (scot %p p.a) (scot %p p.b))
      ?:  ?=(%ship -.a)  &
      ?:  ?=(%ship -.b)  |
      ?:  &(?=(%flag -.a) ?=(%flag -.b))  (tor +.a +.b)
      (gte -.a -.b)  ::  %flag before %club
    --
  --
::
::  +tr: render targets, one of $whom: ship, flag, or club
::
++  tr
  |_  =target
  ::  +full: render target fully
  ::
  ++  full
    ^-  tape
    ?-   -.target
        %ship  "{(scow %p p.target)}"
        %club  "{(scow %uv p.target)}"
        %flag  "{(scow %p p.p.target)}/{(trip q.p.target)}"
    ==
  ::  +phat: render chat target with local shorthand
  ::
  ::    renders as ~ship/path.
  ::    for local mailboxes, renders just /path.
  ::
  ++  phat
    ^-  tape
    ?.  ?=(%flag -.target)
      ~(full tr target)
    %+  weld
      ?:  =(our-self p.p.target)  ~
      (scow %p p.p.target)
    "/{(trip q.p.target)}"
  ::  +show: render as tape, as glyph if we can
  ::
  ++  show
    ^-  tape
    =+  cha=(~(get by bound) target)
    ?~  cha  ~(phat tr target)
    [u.cha ~]
  ::  +glyph: tape for glyph of target, defaulting to *
  ::
  ++  glyph
    ^-  tape
    [(~(gut by bound) target '*') ~]
  ::  +meta: render target with meta data
  ::
  ++  meta
    |^  ^-  tape
    ?-   -.target
        %flag  ~(phat tr target)
        %ship  ~(full tr target)
        %club
      =/  =club-id  p.target
      =/  crew=(unit crew)
        (~(get by get-clubs) club-id)
      ?~  crew
        "{(scow %uv club-id)}  club doesn't exist"
      =+  team=team.u.crew
      =+  hive=hive.u.crew
      ?:  &(=(~ team) =(~ hive))
        "{(scow %uv club-id)}  club doesn't have any members"
      %+  weld  
        "{(scow %uv club-id)}"
      ?.  =(*cord title.met.u.crew)
        "  {(trip title.met.u.crew)}"
      (render-club-members club-id (club-members team hive))
    ==
    ::  +club-members: produce list of club members
    ::
    ++  club-members
      |=  [team=(set ship) hive=(set ship)]
      ^-  (list ship)
      ?:  =(~ team)  (sort ~(tap in hive) lth)
      ?:  =(~ hive)  (sort ~(tap in team) lth)
      =/  members  (~(uni in team) hive)
      (sort ~(tap in members) lth)
    ::  +render-club-members: produce club members as tape
    ::
    ::    print up to four members and produce
    ::    a count for the rest.
    ::
    ++  render-club-members
      |=  [=club-id members=(list ship)]
      ^-  tape
      =/  members=(list tape)
        %+  turn  members
        |=  =ship
        "  {(cite:title ship)}"
      =|  out=tape
      =+  tally=0
      |- 
      ?~  members  
        %+  weld  out
        ?:  (lte tally 4)  ~ 
        " +{(scow %ud (sub tally 4))}"
      ?:  (gte tally 4)  
        $(tally +(tally), members t.members)
      %=  $
        tally    +(tally)
        out      (weld out i.members)
        members  t.members
      ==
    --
  --
::
::  +mr: render messages
::
++  mr
  |_  $:  source=target
          memo:chat
      ==
  +*  showtime  (~(has in settings) %showtime)
      notify    (~(has in settings) %notify)
  ::
  ++  content-width
    ::  termwidth, minus author, timestamp, and padding
    %+  sub  width
    %+  add  15
    ?:(showtime 12 0)
  ::
  ++  render-notice
    ?>  ?=(%notice -.content)
    =/  glyph=(unit glyph)
      (~(get by bound) source)
    =/  prepend=tape
      (runt [14 '-'] ?~(glyph '|' u.glyph) ' ' " ") 
    :+  %sole  %klr
    %+  weld  prepend
    ^-  styx
    [[`%un ~ ~] ~[pfix.p.content (scot %p author) sfix.p.content]]~
  ::
  ++  render-inline
    |^  ^-  shoe-effect:shoe
    ?.  ?=(%story -.content)
      render-notice
    :+  %row
      :-  16
      %-  thread-indent
      ?.  showtime
        ~[(sub width 17)]
      ~[(sub width 27) 12]
    =;  cols=(list dime)
      ?~  replying  cols
      (into cols 1 `dime`[%t ''])
    :+  :-  %t
        %-  crip
        ;:  weld
          (nome author)
          ~(glyph tr source)
          ?~(replying *tape "^")
        ==
      t+(crip line)
    ?.  showtime  ~
    :_  ~
    :-  %t
    =.  sent
      %-  ?:(p.timez add sub)
      [sent (mul q.timez ~h1)]
    =+  dat=(yore sent)
    =*  t   (d-co:co 2)
    =,  t.dat
    =+  begin=?~(replying " ~" "  ~")
    %-  crip
    :(weld begin (t h) "." (t m) "." (t s))
    ::  +thread-indent: indent column if $replying:memo is not ~
    ::  meaning we have a thread message
    ::
    ++  thread-indent
      |=  widths=(list @ud)
      ^-  (list @ud)
      ?~  replying  widths
      :-  1
      %+  turn  widths
      |=  a=@
      ?.  (gth a 12)
        a
      (sub a 3)
    --
  ::
  ++  line
    ^-  tape
    ?>  ?=(%story -.content)
    %-  zing
    %+  join  "\0a"
    %+  weld
      (blocks-as-tapes p.p.content)
    (inlines-as-tapes & q.p.content)
  ::
  ++  inlines-as-tapes
    |=  [lim=? lis=(list inline:chat)]
    |^  ^-  (list tape)
        %-  murn
        :_  |=(ls=(list tape) ?:(=(~ ls) ~ (some `tape`(zing ls))))
        (roll lis process-inline)
    ::
    ++  process-inline
      =/  quote=@ud  0
      |=  [=inline:chat out=(list (list tape))]
      ?@  inline  (append-inline out (trip inline))
      ?-  -.inline
        %tag                        (append-inline out "#{(trip p.inline)}")
        %block                      (append-solo out "[{(trip p.inline)}]")
        %ship                       (append-inline out (scow %p p.inline))
        %break                      ?:  =(0 quote)  (snoc out ~)
                                    (snoc out [(snoc (reap quote '>') ' ') ~])
      ::
          %code
        =.  out  (append-solo out "```")
        =.  out  (append-inline out (trip p.inline))
        (append-solo out "```")
      ::
          ?(%italics %bold %strike %blockquote %inline-code)
        ~?  ?=(%blockquote -.inline)  inline
        =/  lim=tape
          ?-  -.inline
            %italics      "_"
            %bold         "**"
            %strike       "~~"
            %blockquote   "\""
            %inline-code  "`"
          ==
        =?  out  !?=(%blockquote -.inline)
          (append-inline out lim)
        =.  out
          ?:  ?=(%inline-code -.inline)
            (append-inline out (trip p.inline))
          =?  quote  ?=(%blockquote -.inline)  +(quote)
          =?  out    ?=(%blockquote -.inline)  $(inline [%break ~])
          |-
          ?~  p.inline  out
          =.  out  ^$(inline i.p.inline)
          ::TODO  this still renders a trailing newline before nested quotes
          ?.  =([%break ~]~ t.p.inline)
            $(p.inline t.p.inline)
          $(p.inline t.p.inline, quote (dec quote))
        ?:  ?=(%blockquote -.inline)  out
        (append-inline out lim)
      ::
          %link
        =?  out  !=(p.inline q.inline)
          (append-inline out (snoc (trip q.inline) ' '))
        ?.  lim
          (append-solo out (trip p.inline))
        %+  append-inline  out
        =+  wyd=content-width
        =+  ful=(trip p.inline)
        ::  if the full url fits, just render it.
        ?:  (gte wyd (lent ful))  ful
        ::  if it doesn't, prefix with _ and truncate domain with ellipses
        =.  wyd  (sub wyd 2)
        :-  '_'
        =-  (weld - "_")
        =+  prl=(rust ful aurf:de-purl:html)
        ?~  prl  (scag wyd ful)
        =+  hok=r.p.p.u.prl
        =;  domain=tape
          %+  swag
            [(sub (max wyd (lent domain)) wyd) wyd]
          domain
        ?.  ?=(%& -.hok)
          +:(scow %if p.hok)
        %+  reel  p.hok
        |=  [a=knot b=tape]
        ?~  b  (trip a)
        (welp b '.' (trip a))
      ==
    ::
    ++  append-solo
      |=  [content=(list (list tape)) newline=tape]
      ^+  content
      %+  weld  content
      `_content`~[[newline]~ ~]
    ::
    ++  append-inline
      |=  [content=(list (list tape)) inline=tape]
      ^+  content
      ?:  =(~ content)
        ~[~[inline]]
      =/  last
        (dec (lent content))
      =/  old=(list tape)
        (snag last content)
      =/  new=(list tape)
        ?.  =(~ old)  (snoc old inline)
        ::  clean up leading space, common after solo elements
        ?:  ?=([%' ' *] inline)  [t.inline]~
        [inline]~
      (snap content last new)
    --
  ::
  ++  blocks-as-tapes
    |=  blocks=(list block:chat)
    |^  ^-  (list tape)
        (zing (turn blocks process-block))
    ::  +process-block: build a block
    ::
    ++  process-block
      |=  =block:chat
      ^-  (list tape)
      ?-  -.block
        %image  ["[ #img: {(trip alt.block)} ]"]~
      ::
          %cite
        ?-  -.cite.block
            %group  =,  cite.block
          ["[ #group: {(scow %p p.flag)}/{(trip q.flag)} ]"]~
        ::
            %desk   =,  cite.block
          ["[ #desk: {(scow %p p.flag)}/{(trip q.flag)}{(spud wer)} ]"]~
        ::
            %bait
          ["[ #bait: ]"]~  ::TODO  implement once %lure is released
        ::
            %chan   =,  cite.block
          =/  =path   (flop wer)
          =/  =id:chat
            :-  (slav %p +<.path)
            (slav %ud -.path)
          =/  =whom:chat  [%flag q.nest]
          ?.  (message-exists whom id)
            ["[ #chat: message was deleted ]"]~
          ?.  ?=(%story -.content)
            ["[ #chat: message was a notice ]"]~
          =+  %^  scry-for-marked  ,[* =writ:chat]
                %chat
              (writ-scry-path whom id)
          %-  render-message-block
          %+  simple-wrap  
            %+  weld
              "{(cite:title -.id)} said: "
            ~(line mr whom +.writ)
          (sub content-width 7)
        ==
      ==
    ::  +render-message-block: make a message block
    ::
    ++  render-message-block
      |=  original-message=(list tape)
      ^-  (list tape)
      =+  msg=(scag 2 original-message)
      =|  block=(list tape)
      =/  aces=[line-one=@ud line-two=@ud]
        (block-width msg)
      |-
      ?~  msg  block
      =/  line=(list tape)
        (scag 1 `(list tape)`msg)
      %=    $
          block
        %^    into
            block
          ?~(block 0 1)
        %-  zing
        %^    into
            (weld ["[ "]~ line)
          ?~(block 2 5)
        %+  runt
          :_  ' '
          ?~(block line-one.aces line-two.aces)
        ?~  block  " ]"
        ?.((gth (lent original-message) 2) " ]" "…]")
      ::
          msg
        t.msg
      ==
    ::  +block-width: determine number of aces needed for line blocks
    ::
    ++  block-width
      |=  message=(list tape)
      ^-  [@ud @ud]
      ?~  message  [0 0]
      =/  line-one=@ud
        (sub content-width (add 7 (lent i.message)))
      ?~  t.message  [0 0]
      =/  line-two=@ud
        (sub content-width (add 7 (lent i.t.message)))
      ?:  |(=(0 line-one) =(0 line-two))
        [line-one line-two]
      ?:  (gth line-one line-two)
        [(sub (lent i.t.message) (lent i.message)) 0]
      [0 (sub (lent i.message) (lent i.t.message))]
    --
  ::  +activate: produce sole-effect for printing message details
  ::
  ++  render-activate
    ^-  sole-effect:shoe
    ~[%mor [%tan meta] body]
  ::  +meta: render message metadata (serial, timestamp, author, target)
  ::
  ++  meta
    ^-  tang
    =+  hed=leaf+"sent at {(scow %da sent)}"
    =/  src=tape  ~(phat tr source)
    [%rose [" " ~ ~] [hed >author< [%rose [", " "to " ~] [leaf+src]~] ~]]~
  ::  +body: long-form render of message contents
  ::
  ++  body
    ?.  ?=(%story -.content)
      +:render-notice
    |-  ^-  sole-effect:shoe
    :-  %mor
    ;:  weld
      ::  if a part of a thread, print top-level message
      ::
      ?~  replying  ~
      =-  (snoc - [%txt "---"])
      ?.  (message-exists source u.replying)
        [txt+"^   …message was deleted"]~
      =+  %^  scry-for-marked  ,[* =writ:chat]
            %chat
          (writ-scry-path source u.replying)
      [[%txt (weld "^   " ~(line mr source +.writ))]]~
      ::  if block is referenced, print it, too
      ::
      ?:  =(~ p.p.content)  ~
      =-  (snoc - [%txt "---"])
      (turn (blocks-as-tapes p.p.content) (lead %txt))
      ::TODO  we could actually be doing styling here with %klr
      ::      instead of producing plain %txt output. maybe one day...
      (turn (inlines-as-tapes | q.p.content) (lead %txt))
    ==
  ::  +nome: prints a ship name in 14 characters, left-padding with spaces
  ::
  ++  nome
    |=  =ship
    ^-  tape
    =+  raw=(cite:title ship)
    (runt [(sub 14 (lent raw)) ' '] raw)
  --
::  +simple-wrap: wrap text
::
++  simple-wrap
  |=  [txt=tape wid=@ud]
  ^-  (list tape)
  ?~  txt  ~
  =/  [end=@ud nex=?]
    =+  ret=(find "\0a" (scag +(wid) `tape`txt))
    ?^  ret  [u.ret &]
    ?:  (lte (lent txt) wid)  [(lent txt) &]
    =+  ace=(find " " (flop (scag +(wid) `tape`txt)))
    ?~  ace  [wid |]
    [(sub wid u.ace) &]
  :-  (tufa (scag end `(list @)`txt))
  $(txt (slag ?:(nex +(end) end) `tape`txt))
::  +target-to-path: make first part of a target's path
::
++  target-to-path
  |=  =target
  ^-  path
  ?-  -.target
    %ship  /dm/(scot %p p.target)
    %club  /club/(scot %uv p.target)
    %flag  /chat/(scot %p p.p.target)/(scot %tas q.p.target)
  ==
::  +writ-scry-path: make scry path for writ retrieval
::
++  writ-scry-path
  |=  [=whom:chat =id:chat]
  ^-  path
  %+  weld  (target-to-path whom)
  /writs/writ/id/[(scot %p p.id)]/[(scot %ud q.id)]/writ
::
++  scry-for-existence
  |*  [app=term =path]
  .^(? %gu (scot %p our.bowl) app (scot %da now.bowl) path)
::
++  scry-for-marked
  |*  [=mold app=term =path]
  .^(mold %gx (scot %p our.bowl) app (scot %da now.bowl) path)
::
++  scry-for
  |*  [=mold app=term =path]
  (scry-for-marked mold app (snoc `^path`path %noun))
--


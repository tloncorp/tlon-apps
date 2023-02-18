::  talk-cli: cli chat client using groups' chat
::
::    pulls all known messages into a single stream.
::    type ;help for usage instructions.
::
/-  chat
/+  shoe, default-agent, verb, dbug
::
|%
+$  card  card:shoe
::
+$  versioned-state
  $%  state-0
  ==
::
+$  state-0
  $:  %0
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
+$  target  whom:chat                               :: polymorphic id for channels
::
+$  glyph  char
++  glyphs  "!@#$%^&()-=_+[]\{}'\\:\",.<>?"
::
+$  command
  $%  [%target target]                              ::  set messaging target
      [%say (unit ship) (list inline:chat)]         ::  send message
      :: [%eval cord hoon]                          ::  send #-message
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
      [%help ~]                                     ::  print usage info
  ==                                                ::
::
--
=|  state-0
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
    =^  cards  state  (prep:tc ~)
    [cards this]
  ::
  ++  on-save  !>(state)
  ::
  ++  on-load
    |=  old-state=vase
    ^-  (quip card _this)
    =/  old  !<(versioned-state old-state)
    =^  cards  state  (prep:tc `old)
    [cards this]
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
        ?+  wire  ~
          [%chat %ui ~]  ~[connect:tc]
        ==
      ::
          %fact
        ?+  p.cage.sign  ~|([dap.bowl %bad-sub-mark wire p.cage.sign] !!)
            %chat-action-0
          %-  on-chat-update:tc
          !<(action:chat q.cage.sign)
        ==
      ==
    [cards this]
  ::
  ++  on-watch  on-watch:def
  ++  on-leave  on-leave:def
  ++  on-peek   on-peek:def
  ++  on-arvo   on-arvo:def
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
::  +prep: setup & state adapter
::
++  prep
  |=  old=(unit versioned-state)
  ^-  (quip card _state)
  ?~  old
    [~[connect] state(width 80)]
  ::
  ?>  ?=(%0 -.u.old)
  :_  u.old
  ?:  %-  ~(has by wex.bowl)
      [/chat/ui our-self %chat]
    ~
  ~[connect]
::  +connect: connect to the chat backend
::
++  connect
  ^-  card
  [%pass /chat/ui %agent [our-self %chat] %watch /ui]
::
::TODO  better moon support. (name:title our.bowl)
++  our-self  our.bowl
++  crew  crew:club:chat
++  club-id  id:club:chat
::
++  get-session
  |=  =sole-id
  ^-  session
  (~(gut by sessions) sole-id %*(. *session audience [our-self %$]))
::  +tor: term ordering for targets
::
++  tor
  |=  [[* a=term] [* b=term]]
  (aor a b)
::  +get-chats: get known chat channels
::
++  get-chats  ~+
  ^-  (set flag:chat)
  (scry-for (set flag:chat) %chat /chat)
::  +get-dms: get known dms
::
++  get-dms  ~+
  ^-  (set ship)
  %.  ~(tap in (scry-for (set ship) %chat /dm))
    ~(gas in (scry-for (set ship) %chat /dm/invited))
::  +get-clubs: get known clubs
::
++  get-clubs  ~+
  ^-  (map club-id crew)
  (scry-for (map club-id crew) %chat /clubs)
::  +target-exists: check whether a channel exists
::
++  target-exists
  |=  =target
  ^-  ?
  ?-   -.target
      %ship  (~(has in get-dms) p.target)
      %flag  (~(has in get-chats) p.target)
      %club  (~(has by get-clubs) p.target)
  ==
::  +poke-noun: debug helpers
::
++  poke-noun
  |=  a=*
  ^-  (quip card _state)
  ?:  ?=(%connect a)
    [[connect ~] state]
  [~ state]
::  +on-chat-update: get new messages
::
++  on-chat-update
  |=  [=flag:chat =time =diff:chat]
  ^-  (quip card _state)
  ?.  ?=(%writs -.diff)    [~ state]
  ?.  ?=(%add -.q.p.diff)  [~ state]
  =*  id=id:chat        p.p.diff
  =*  memo=memo:chat  p.q.p.diff
  =/  sez=(list [=sole-id =session])
    ~(tap by sessions)
  =|  cards=(list card)
  |-
  ?~  sez  [cards state]
  =^  caz  session.i.sez
    ?.  (~(has in viewing.session.i.sez) flag)
      [~ session.i.sez]
    (~(read-post se i.sez) flag id memo)
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
    |=  [=target =id:chat =memo:chat]
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
::
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
        (stag %target targ)
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
        ;~(plug (tag %help) (easy ~))
      ::
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
    ++  group  ;~((glue fas) ship sym)
    ++  tag   |*(a=@tas (cold a (jest a)))  ::TODO  into stdlib
    ++  ship  ;~(pfix sig fed:ag)
    ++  name  ;~(pfix fas urs:ab)
    ::  +tarl: local target, as /path
    ::
    ++  tarl  (stag our-self name)
    ::  +targ: any target, as tarl, tarp, ~ship/path or glyph
    ::
    ++  targ
      ;~  pose
        tarl
        ;~(plug ship name)
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
    ::  +message: all messages
    ::
    ++  message
      ;~  pose
        :: ;~(plug (cold %eval hax) expr)
        (stag %say content)
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
      [';view' leaf+";view (glyph) (~ship) (club-id) (~ship/chat-name)"]
      [';flee' leaf+";flee (glyph) (~ship) (club-id) (~ship/chat-name)"]
    ::
      [';bind' leaf+";bind [glyph] (~ship) (club-id) (~ship/chat-name)"]
      [';unbind' leaf+";unbind [glyph]"]
      [';what' leaf+";what (glyph) (~ship) (club-id) (~ship/chat-name)"]
    ::
      [';settings' leaf+";settings"]
      [';set' leaf+";set key (value)"]
      [';unset' leaf+";unset key"]
    ::
      [';chats' leaf+";chats"]
      [';help' leaf+";help"]
    ==
  ::  +work: run user command
  ::
  ++  work
    |=  job=command
    ^-  (quip card _state)
    |^  ?-  -.job
          %target    (set-target +.job)
          %say       (say +.job)
          :: %eval      (eval +.job)
        ::
          %view      (view +.job)
          %flee      (flee +.job)
        ::
          %bind      (bind-glyph +.job)
          %unbind    (unbind-glyph +.job)
          %what      (lookup-glyph +.job)
        ::
          %settings  show-settings
          %set       (set-setting +.job)
          %unset     (unset-setting +.job)
          %width     (set-width +.job)
          %timezone  (set-timezone +.job)
        ::
          %select    (select +.job)
          %chats     chats
          %help      help
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
    ::  +set-target: set audience, update prompt
    ::
    ++  set-target
      |=  =target
      ^-  (quip card _state)
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
        [[(show-chats:sh-out ~(tap in viewing))]~ state]
      ::  only view existing chats
      ::
      ?.  (target-exists target)
        [[(note:sh-out "no such chat")]~ put-ses]
      =.  audience  target
      =.  viewing   (~(put in viewing) target)
      =^  cards  state
        ?:  (~(has by bound) target)
          [~ state]
        (bind-default-glyph target)
      [[prompt:sh-out cards] put-ses]
    ::  +flee: stop printing messages from a chat
    ::
    ++  flee
      |=  =target
      ^-  (quip card _state)
      =.  viewing  (~(del in viewing) target)
      [~ put-ses]
    ::  +say: send messages
    ::
    ++  say
      |=  msg=(list inline:chat)
      ^-  (quip card _state)
      :_  state
      :_  ~
      %^  act  %out-message
        %chat
      :-  %chat-action-0
      !>  ^-  action:chat
      =/  =memo:chat  [~ our.bowl now.bowl %story ~ msg]
      [audience now.bowl %writs [our now]:bowl %add memo]
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
        =+  pan=~(tap in (~(get ju binds) `@t`u.qur))
        ?:  =(~ pan)  (print:sh-out "~")
        =<  (effect:sh-out %mor (turn pan .))
        |=(t=target [%txt ~(phat tr t)])
      %-  print-more:sh-out
      %-  ~(rep by binds)
      |=  $:  [=glyph tars=(set target)]
              lis=(list tape)
          ==
      %+  weld  lis
      ^-  (list tape)
      %-  ~(rep in tars)
      |=  [t=target l=(list tape)]
      %+  weld  l
      ^-  (list tape)
      [glyph ' ' ~(phat tr t)]~
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
      |^  ?@  num
            =+  tum=(scow %s (new:si | +(num)))
            ?:  (gte rel.num count)
              %-  just-print
              "{tum}: no such telegram"
            (activate tum rel.num)
          ?.  (gte abs.num count)
            ?:  =(count 0)
              (just-print "0: no messages")
            =+  msg=(index (dec count) num)
            (activate (scow %ud msg) (sub count +(msg)))
          %-  just-print
          "…{(reap zeros.num '0')}{(scow %ud abs.num)}: no such telegram"
      ::  +just-print: full [cards state] output with a single print card
      ::
      ++  just-print
        |=  txt=tape
        [[(print:sh-out txt) ~] state]
      ::  +index: get message index from absolute reference
      ::
      ++  index
        |=  [max=@ud nul=@u fin=@ud]
        ^-  @ud
        =+  dog=|-(?:(=(0 fin) 1 (mul 10 $(fin (div fin 10)))))
        =.  dog  (mul dog (pow 10 nul))
        =-  ?:((lte - max) - (sub - dog))
        (add fin (sub max (mod max dog)))
      ::  +activate: echo message selector and print details
      ::
      ++  activate
        |=  [number=tape index=@ud]
        ^-  (quip card _state)
        ::NOTE  careful, messages may get deleted, so this may crash...
        =/  [=flag:chat =id:chat]  (snag index history)
        =.  audience  flag
        =+  %^  scry-for-marked  ,[* =writ:chat]
              %chat
            /chat/(scot %p p.flag)/[q.flag]/writs/writ/id/[(scot %p p.id)]/[(scot %ud q.id)]/writ
        :_  put-ses
        ^-  (list card)
        :~  (print:sh-out ['?' ' ' number])
            (effect:sh-out ~(render-activate mr flag +.writ))
            prompt:sh-out
        ==
      --
    ::  +chats: display list of joined chats
    ::
    ++  chats
      ^-  (quip card _state)
      =/  targets=(set target)
        %-  ~(run in get-chats)
          |=  =flag:chat
          [%flag flag]
      :_  state
      [(show-targets:sh-out ~(tap in targets))]~ 
    ::  +dms: display list of known dms
    ::
    ++  dms
      ^-  (quip card _state)
      =/  targets=(set target)
        %-  ~(run in get-dms)
          |=  =ship
          [%ship ship]
      :_  state
      [(show-targets:sh-out ~(tap in targets))]~
    ::  +clubs: display list of known clubs
    ::
    ++  clubs
      ^-  (quip card _state)
      =/  targets=(set target)
        %-  ~(run in ~(key by get-clubs))
          |=  =club-id
          [%club club-id]
      :_  state
      [(show-targets:sh-out ~(tap in targets))]~
    ::  +help: print (link to) usage instructions
    ::
    ++  help
      ^-  (quip card _state)
      :_  state
      =-  (turn - print:sh-out)
      :~  ";view ~host/chat to print messages for a chat you've already joined."
          ";flee ~host/chat to stop printing messages for a chat."
          "For more details:"
          "https://urbit.org/using/operations/using-your-ship/#messaging"
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
  ::  +show-chats: print list of targets
  ::
  ++  show-chats
    |=  chats=(list target)
    ^-  card
    %-  print-more
    %+  turn  (sort chats tor)
    |=  flag:chat
    "{(nome:mr p)}/{(trip q)}"
  --
::
::  +tr: render targets (chat identifiers)
::
++  tr
  |_  tr=target
  ::  +full: render target fully, always (as ~ship/path)
  ::
  ++  full
    ^-  tape
    "{(scow %p p.tr)}/{(trip q.tr)}"
  ::  +phat: render target with local shorthand
  ::
  ::    renders as ~ship/path.
  ::    for local mailboxes, renders just /path.
  ::
  ++  phat
    ^-  tape
    %+  weld
      ?:  =(our-self p.tr)  ~
      (scow %p p.tr)
    "/{(trip q.tr)}"
  ::  +show: render as tape, as glyph if we can
  ::
  ++  show
    ^-  tape
    =+  cha=(~(get by bound) tr)
    ?~(cha phat [u.cha ~])
  ::  +glyph: tape for glyph of target, defaulting to *
  ::
  ++  glyph
    ^-  tape
    [(~(gut by bound) tr '*') ~]
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
    ?:(showtime 11 0)
  ::
  ++  render-notice
    ?>  ?=(%notice -.content)
    :+  %sole  %klr
    ^-  styx
    [[`%un ~ ~] ~[pfix.p.content (scot %p author) sfix.p.content]]~
  ::
  ++  render-inline
    ^-  shoe-effect:shoe
    ?.  ?=(%story -.content)
      render-notice
    :+  %row
      :-  15
      ?.  showtime
        ~[(sub width 16)]
      ~[(sub width 26) 9]
    :+  t+(crip (weld (nome author) ~(glyph tr source)))
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
    %-  crip
    :(weld "~" (t h) "." (t m) "." (t s))
  ::
  ++  line
    ^-  tape
    ?>  ?=(%story -.content)
    %-  zing
    %+  join  "\0a"
    %+  weld
      (turn p.p.content block-as-tape)
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
  ++  block-as-tape
    |=  =block:chat
    ^-  tape
    ?-  -.block
      %image  "[img: {(trip alt.block)}]"
    ::
        %cite
      ?-  -.cite.block
          %chan   =,  cite.block
        ::NOTE  we cannot safely scry because of no existence checks...
        "#{(trip p.nest)}: <ref>"
      ::
          %group  =,  cite.block
        "#group: {(scow %p p.flag)}/{(trip q.flag)}"
      ::
          %desk   =,  cite.block
        "#desk: {(scow %p p.flag)}/{(trip q.flag)}{(spud wer)}"
      ::
          %bait
        "#bait"  ::TODO  scry once we can do it safely
      ==
    ==
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
    ?>  ?=(%story -.content)
    |-  ^-  sole-effect:shoe
    :-  %mor
    %+  weld
      ?:  =(~ p.p.content)  ~
      =-  (snoc - [%txt "---"])
      %+  turn  p.p.content
      |=  =block:chat
      txt+(block-as-tape block)
    ::TODO  we could actually be doing styling here with %klr
    ::      instead of producing plain %txt output. maybe one day...
    (turn (inlines-as-tapes | q.p.content) (lead %txt))
  ::  +nome: prints a ship name in 14 characters, left-padding with spaces
  ::
  ++  nome
    |=  =ship
    ^-  tape
    =+  raw=(cite:title ship)
    (runt [(sub 14 (lent raw)) ' '] raw)
  --
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
::
++  scry-for-marked
  |*  [=mold app=term =path]
  .^(mold %gx (scot %p our.bowl) app (scot %da now.bowl) path)
::
++  scry-for
  |*  [=mold app=term =path]
  (scry-for-marked mold app (snoc `^path`path %noun))
--


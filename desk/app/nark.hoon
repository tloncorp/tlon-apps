/-  n=nark, e=epic, g=groups, c=chat
/+  default-agent, verb, dbug, etch
/+  nark
!:
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  ++  okay  `epic:e`0
  +$  current-state
    $:  %0
      =bags:n
    ==
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
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
++  init  ^+  cor   watch-nark
::  +load: load next state
++  load
  |=  =vase
  |^  ^+  cor
  =/  maybe-old=(each [p=versioned-state q=epic:e] tang)
  (mule |.(!<([versioned-state epic:e] vase)))
  =/  [old=versioned-state cool=epic:e bad=?]
    ?.  ?=(%| -.maybe-old)  [p q &]:p.maybe-old
    =;  [sta=versioned-state ba=?]  [sta okay ba]
    =-  %+  fall  -  ~&  >  %bad-load  [state &]
    (mole |.([!<(versioned-state vase) |]))
  =.  state  old
  ?:  =(okay cool)  cor
  =?  cor  bad  (emit (keep !>(old)))
  =-  (give %fact ~(tap in -) epic+!>(okay))
  %-  ~(gas in *(set path))
  %+  murn  ~(val by sup.bowl)
  |=  [=ship =path]
  ^-  (unit _path)
  ?.  |(=(/epic path) ?=([%nark @ @ %updates *] path))  ~
  `path
  ::
  ++  keep
    |=  bad=^vase
    ^-  card
    ~&  >  %keep
    [%pass /keep/chat %arvo %k %fard q.byk.bowl %keep %noun bad]
  ::
  +$  versioned-state   $%(state-0)
  +$  state-0  current-state
  --
::
++  watch-nark
  ^+  cor
  (emit %pass /nark %agent [our.bowl %groups] %watch /nark)
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
++  poke
  |=  [=mark =vase]
  |^  ^+  cor
  ?+    mark  ~|(bad-poke/mark !!)
      %holt  cor
      %stow  (stow !<(diff:n vase))
  ==
  ++  grab
    cor
  ++  stow
    |=  =diff:n
    ?>  ?=(%stow -.diff)
    ~&  >>  %stow
    =<  na-abet
    (na-hook:(na-abed:na-core flag.diff nest.diff) hook.diff)
  ::
  --
::
++  watch
  |=  =(pole knot)
  ^+  cor
  ?+    pole  ~|(bad-watch-path/pole !!)
      [%ui ~]  ?>(from-self cor)
      ::
        [%bait host=@ old=@ ~]
      ~&  >>  `@t`old.pole
      ~&  >>  (slav %p host.pole)
      =/  cage  !>((en-vase:etch !>('%nark response: i am bait')))
      ~&  >>  result+!<(json cage) 
      =.  cor  (give %fact ~ json+cage) 
      =.  cor  (give %kick ~ ~)
      cor
      ::
        [%bait gh=@ gn=@ h=@ n=@ wer=*]
      =/  host=ship  (slav %p gh.pole)  
      :: TODO: translate?
      =/  =flag:c  [host gn.pole]
      =/  sender=ship  (slav %p h.pole)
      =/  =time  (slav %ud (head (flop wer.pole)))
      =/  =id:c  [sender time]
      (watch-bait flag id)   
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
      [%epic ~]
    (take-epic sign)
  ::
      [%hark ~]
    ?>  ?=(%poke-ack -.sign)
    ?~  p.sign  cor
    %-  (slog leaf/"Failed to hark" u.p.sign)
    cor
  ::
      [%nark ~]
    ?+    -.sign  !!
      %kick  watch-nark
    ::
        %watch-ack
      %.  cor
      ?~  p.sign  same
      =/  =tank
        leaf/"Failed subscription in {<dap.bowl>}, unexpected"
      (slog tank u.p.sign)
    ::
        %fact
      ?.  =(%nark-action p.cage.sign)  cor
      ~&  >>  nark+!<(=action:n q.cage.sign)  cor
    ==
  ==
::
++  watch-bait
  |=  [=flag:c =id:c]
  ~&  >>  bait+[flag id]
  =/  scrier  (scrier:nark flag bowl)
  =/  exists=_|  scry-groups:scrier
  =/  cage  !>((en-vase:etch !>(exists)))
  =.  cor  (give %fact ~ json+cage) 
  =.  cor  (give %kick ~ ~)
  cor
  ::
++  take-epic
  |=  =sign:agent:gall
  ^+  cor
  ?+    -.sign  cor
      %kick
    (watch-epic src.bowl)
  ::
      %fact
    ?:  =(%epic p.cage.sign)
      ~&  '!!! weird fact on /epic'
      cor
    =+  !<(=epic:e q.cage.sign)
    ?.  =(epic okay)  :: is now our guy
      cor
    cor
  ::
      %watch-ack
    %.  cor
    ?~  p.sign  same
    (slog leaf/"weird watch nack" u.p.sign)
  ==
::
++  arvo
  |=  [=wire sign=sign-arvo]
  ^+  cor
  ~&  arvo/wire
  cor
::
++  peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  [~ ~]
  ::
    [%x %nark ~]  [~ ~]
  ==
::
++  from-self  =(our src):bowl
++  na-abed  na-abed:na-core
::
++  na-core
  |_  [=flag:g =nest:g =tags:n =dues:n]
  ++  na-core  .
  ++  na-abet
    =+  (~(put by tags) nest dues)
    =.  bags  (~(put by bags) flag -)
    cor
  ::
  ++  na-abed
    |=  [f=flag:g c=nest:g]
    ^+  na-core
    =/  t=tags:n   (fall (~(get by bags) f) *tags:n)
    =/  d=dues:n   (fall (~(get by t) c) *dues:n)
    na-core(flag f, nest c, tags t, dues d)
  ::
  ++  na-hook
    |=  =hook:n
    ^+  na-core
    =-  =.  dues  -  na-core
    ?-    -.dues
        %chat
      =-  dues(p -)
      (~(put by p.dues) *id:c [%index hook])
    ==

  ++  na-pass
    |%
    ++  act
      |=  [=ship =diff:n]
      ^-  card
      =/  =wire  /nark/pass
      =/  =dock  [ship dap.bowl]
      =/  =cage  nark-action+!>(`action:n`[[ship now.bowl] diff])
      [%pass wire %agent dock %poke cage]
    --
  ::
  ++  na-init  cor
  ::
  ++  na-peek
    |=  =path
    ^-  (unit (unit cage))
    ?+  path  [~ ~]
      [%out ~]  ~
    ==
  ::
  ++  na-watch
    |=  =path
    ^+  na-core
    ?>  =(src our):bowl
    ?+  path  !!
      [%ui ~]  na-core
    ==
  ::
  ++  na-agent
    |=  [=wire =sign:agent:gall]
    ^+  na-core
    ?+    wire  ~|(bad-nark-take/wire !!)
        [%gossip ~]
      ?>  ?=(%poke-ack -.sign)
      ?~  p.sign  na-core
      %-  (slog leaf/"Failed {<src.bowl>} {<wire>}" u.p.sign)
      na-core
    ==
  ::
  --
--

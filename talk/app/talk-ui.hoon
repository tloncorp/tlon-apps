/-  u=ui, g=groups, c=chat
/+  default-agent, dbug, verb
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  +$  current-state  ~
  --
=|  current-state
=*  state  -
=<
  %+  verb  |
  %-  agent:dbug
  |_  =bowl:gall
  +*  this  .
      def   ~(. (default-agent this %.n) bowl)
      cor   ~(. +> [bowl ~])
  ++  on-init
    ^-  (quip card _this)
    `this
  ++  on-save   on-save:def
  ++  on-load   on-load:def
  ++  on-poke   on-poke:def
  ++  on-watch  on-watch:def
  ++  on-leave  on-leave:def
  ++  on-agent  on-agent:def
  ++  on-arvo   on-arvo:def
  ++  on-fail   on-fail:def
  ++  on-peek   peek:cor
  --
|_  [bowl:gall cards=(list card)]
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
++  scry
  |=  [care=@tas =dude:gall =path]
  ^+  path
  :*  care
      (scot %p our)
      dude
      (scot %da now)
      path
  ==
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  ?+    pole  [~ ~]
      [%x %init ~]
    =/  =init:u
      :*  .^(groups:g (scry %gx %groups /groups/light/noun))
          .^(gangs:g (scry %gx %groups /gangs/noun))
          .^(briefs:c (scry %gx %chat /briefs/noun))
          .^((map flag:c chat:c) (scry %gx %chat /chats/noun))
          .^((map id:club:c crew:club:c) (scry %gx %chat /clubs/noun))
          .^((set ship) (scry %gx %chat /dm/noun))
          .^((set ship) (scry %gx %chat /dm/invited/noun))
          .^((list whom:c) (scry %gx %chat /pins/noun))
      ==
    ``ui-init+!>(init)
  ==
--

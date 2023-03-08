/-  u=ui, g=groups, c=chat, d=diary, h=heap
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
          :-  .^(briefs:c (scry %gx %chat /briefs/noun))
              .^((map flag:c chat:c) (scry %gx %chat /chats/noun))
          :-  .^(briefs:h (scry %gx %heap /briefs/noun))
              .^(stash:h (scry %gx %heap /stash/noun))
          :-  .^(briefs:d (scry %gx %diary /briefs/noun))
              .^(shelf:d (scry %gx %diary /shelf/noun))
      ==
    ``ui-init+!>(init)
  ::
      [%x %migration ~]
    =/  =migration:u
      :*  .^(imported:u (scry %gx %chat /imp/noun))
          .^(imported:u (scry %gx %heap /imp/noun))
          .^(imported:u (scry %gx %diary /imp/noun))
          .^((list ship) (scry %gx %group-store /wait/noun))
      ==
    ``ui-migration+!>(migration)
  ==
--

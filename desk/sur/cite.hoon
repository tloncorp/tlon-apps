/-  g=groups
=<  cite
|%
++  purse
  |=  =(pole knot)
  ^-  (unit cite)
  ?.  =(~.1 -.pole)  ~
  =.  pole  +.pole
  ?+    pole  ~
      [%chan agent=@ ship=@ name=@ rest=*]
    =/  ship  (slaw %p ship.pole)
    ?~  ship  ~
    `[%chan [agent.pole u.ship name.pole] rest.pole]
  ::
      [%desk ship=@ name=@ rest=*]
    =/  ship  (slaw %p ship.pole)
    ?~  ship  ~
    `[%desk [u.ship name.pole] rest.pole]
  ::
      [%group ship=@ name=@ ~]
    =/  ship  (slaw %p ship.pole)
    ?~  ship  ~
    `[%group u.ship name.pole]
  ==
++  parse 
  |=  =path
  ^-  cite
  (need (purse path))
::
++  print
  |=  c=cite
  |^  ^-  path
  :-  (scot %ud 1)
  ?-  -.c
    %chan   chan/(welp (nest nest.c) wer.c)
    %desk   desk/(welp (flag flag.c) wer.c)
    %group  group/(flag flag.c)
  ==
  ++  flag
    |=  f=flag:g
    ~[(scot %p p.f) q.f]
  ++  nest 
    |=  n=nest:g
    [p.n (flag q.n)]
  --
::
+$  cite
  $%  [%chan =nest:g wer=path]
      [%group =flag:g]
      [%desk =flag:g wer=path]
  ==
--


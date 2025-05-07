
=<  cite
|%
+$  flag  (pair ship term)
::
+$  nest  (pair term flag)
::
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
::
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
    %bait   bait/:(welp (flag grp.c) (flag gra.c) wer.c)
  ==
  ++  flag
    |=  f=^flag
    ~[(scot %p p.f) q.f]
  ++  nest 
    |=  n=^nest
    [p.n (flag q.n)]
  --
::
+$  cite
  $%  [%chan =nest wer=path]
      [%group =flag]
      [%desk =flag wer=path]
      [%bait grp=flag gra=flag wer=path]
      :: scry into groups when you receive a bait for a chat that doesn't exist yet
      :: work out what app
  ==
--

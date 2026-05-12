::  guard: custom card types for compile-time marked-data guard rails
::
::    integrates /lib/rail's type-safe cages into the gall agent card type,
::    and provides helpers for translating between safe and unsafe cards,
::    agent function and output.
::
/+  *rail
::
|%
+$  card  (wind note gift)
+$  note
  $%  $<(%agent note:agent:gall)
      [%agent [=ship name=term] =task]
  ==
+$  task
  $%  $<(?(%poke %poke-as) task:agent:gall)
      [%poke =rail]
      [%poke-as =mark =rail]
  ==
+$  gift
  $%  $<(%fact gift:agent:gall)
      [%fact paths=(list path) =rail]
  ==
+$  sign
  $%  $<(%fact sign:agent:gall)
      [%fact =rail]
  ==
::
++  on-poke
  |*  f=$-(rail *)
  |=  =cage
  (f (en-rail cage))
::
++  on-agent
  |*  f=$-([wire sign] *)
  |=  [=wire =sign:agent:gall]
  ?.  ?=(%fact -.sign)  (f wire sign)
  (f wire sign(cage (en-rail cage.sign)))
::
++  unsafe  ::  gall-style card into unsafe guard-style card
  |=  cad=card:agent:gall
  ^-  card
  ?<  ?=(%slip -.cad)
  ?+  cad  cad
    [%pass * %agent * %poke *]     cad(cage.task.q [%unsafe cage.task.q.cad])
    [%pass * %agent * %poke-as *]  cad(cage.task.q [%unsafe cage.task.q.cad])
    [%give %fact *]                cad(cage.p [%unsafe cage.p.cad])
  ==
::
++  un
  |%
  ++  card
    |=  cad=^card
    ^-  card:agent:gall
    ?<  ?=(%slip -.cad)
    ?+  cad  cad
      [%pass * %agent * %poke *]     cad(rail.task.q (de-rail rail.task.q.cad))
      [%pass * %agent * %poke-as *]  cad(rail.task.q (de-rail rail.task.q.cad))
      [%give %fact *]                cad(rail.p (de-rail rail.p.cad))
    ==
  ::
  ++  step
    |*  [caz=(list ^card) cor=*]
    ^-  [(list card:agent:gall) _cor]
    [(turn caz card) cor]
  ::
  ++  peek
    |=  ray=(unit (unit rail))
    ?.  ?=([~ ~ *] ray)  ray
    ``(de-rail u.u.ray)
  --
--

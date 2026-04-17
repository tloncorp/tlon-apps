::  guardian: custom card types for compile-time marked-data guard rails
::
::    xx
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
::
++  exit
  |=  cad=card:agent:gall
  ^-  card
  ?<  ?=(%slip -.cad)
  ?+  cad  cad
    [%pass * %agent * %poke *]     cad(cage.task.q [%unsafe cage.task.q.cad])
    [%pass * %agent * %poke-as *]  cad(cage.task.q [%unsafe cage.task.q.cad])
    [%give %fact *]                cad(cage.p [%unsafe cage.p.cad])
  ==
::
++  unguard
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

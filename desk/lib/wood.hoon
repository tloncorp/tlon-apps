::  $wood: logging
/-  g=groups
=<  wood
|%
+$  rock
  $:  ver=_0  :: version negotiation
      odd=_1  :: strange 
      veb=_0
      err=_1
      flags=(set flag:g)
  ==
+$  grain  ?(%ver %odd %veb %err)
+$  wave
  $%  [%set =grain pri=@ud]
      [%add =(set flag:g)]
      [%del =(set flag:g)]
  ==
++  wood
  |_  [=bowl:gall rock]
  +*  rock  +<+
  ++  twig 
    |_  =flag:g
    ++  twig  .
    ::
    :: +ping: Print strING
    ++  ping
      |=  [=grain print=(trap tape)]
      (ping-raw grain `flag print)
    ::
    :: +pang: Print tANG
    ++  pang
      |=  [=grain print=(trap [tape tang])]
      (pang-raw grain `flag print)
    --
  ::
  ++  wash
    |=  =wave
    ^+  rock
    ?-    -.wave
        %add  rock(flags (~(uni in flags) set.wave))
        %del  rock(flags (~(uni in flags) set.wave))
    ::
        %set
      ?-  grain.wave
        %ver  rock(ver pri.wave)
        %odd  rock(odd pri.wave)
        %veb  rock(veb pri.wave)
        %err  rock(err pri.wave)
      ==
    ==
  ::
  ++  fly
    |=  =flag:g
    ^-  tape
    "{(scow %p p.flag)}/{(trip q.flag)}"
  ::
  ++  slog
    |=  pri=@ud
    %*(. ^slog pri (dec pri))
  ::
  ++  should-print
    |=  [pri=@ud fog=(unit flag:g)]
    ?&  |(=(~ flags) (fall (bind fog ~(has in flags)) &))
        !=(0 pri)
    ==
  ::
  ++  ping-raw
    |=  [=grain fog=(unit flag:g) print=(trap tape)]
    ^+  same
    =/  pri=@ud  (get-pri grain)
    ?.  (should-print pri fog)
      same
    ((slog pri) leaf/(line fog (print)))
  ::
  ++  line
    |=  [fog=(unit flag:g) =tape]
    ^+  tape
    "%{(trip dap.bowl)}{?~(fog "" ['@' (fly u.fog)])}: {tape}"
  ::
  ++  pang-raw
    |=  [=grain fog=(unit flag:g) print=(trap [tape tang])]
    ^+  same
    =/  pri=@ud  (get-pri grain)
    ?.  (should-print pri fog)
      same
    =/  [=tape =tang]  (print)
    ((slog pri) leaf/(line fog tape) tang)
  ::
  ++  pang
    |=  [=grain print=(trap [tape tang])]
    (pang-raw grain ~ print)
  ::
  ++  ping
    |=  [=grain print=(trap tape)]
    (ping-raw grain ~ print)
  ::
  ++  get-pri
    |=  =grain
    ^-  @ud
    ?-  grain
      %ver  ver
      %odd  odd
      %veb  veb
      %err  err
    ==
  --
--

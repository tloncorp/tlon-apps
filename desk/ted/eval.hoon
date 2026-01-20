::  /ted/eval.hoon
::
/-  spider, e=eval
/+  strandio
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
::  handle both CLI [~ cord] and HTTP cord
=+  !<(arg-data=?(~ [~ cord]) arg)
=/  input=cord
  ?~  arg-data  ''
  +.arg-data
;<  =bowl:spider  bind:m  get-bowl:strandio
=/  ast=(unit hoon)  (rush input vest)
?~  ast
  (pure:m !>(`eval-output:e`[%| 'syntax error']))
=/  fowl=[our=@p now=@da eny=@uvJ]
  [our.bowl now.bowl (shaz (cat 3 (mix [now eny]:bowl) %eny))]
=/  subject  [fowl ..zuse]
=/  minted=(each [=type =nock] (list tank))
  (mule |.((~(mint ut -:!>(subject)) %noun u.ast)))
?:  ?=(%| -.minted)
  =/  err=tape
    %-  of-wall:format
    %+  turn  p.minted
    |=  =tank
    (of-wall:format (wash [0 80] tank))
  (pure:m !>(`eval-output:e`[%| (crip err)]))
::  mock with |=(^ ~) blocks scry
=/  =toon
  (mock [subject nock.p.minted] |=(^ ~))
%-  pure:m
!>  ^-  eval-output:e
?-  -.toon
  %0
    =/  result=tape
      (of-wall:format (~(win re (sell type.p.minted p.toon)) 0 80))
    [%& (crip result)]
  %1  [%| '.^ not supported']
  %2
    =/  err=tape
      %-  zing
      %+  turn  `(list tank)`p.toon
      |=(=tank "{(of-wall:format (~(win re tank) 0 80))}\0a")
    [%| (crip ?~(err "crash" err))]
==

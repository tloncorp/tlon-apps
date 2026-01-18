::  /ted/eval.hoon - Inline Hoon evaluation for chat
::
::  Evaluates Hoon code in a sandboxed environment and returns
::  the result as a formatted string. Scry (.^) is disabled for security.
::
/-  spider, e=eval
/+  strandio
::
=,  strand=strand:spider
::
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
::  Extract input cord from vase
::
=+  !<(input=eval-input:e arg)
::  Get bowl for entropy and time
::
;<  =bowl:spider  bind:m  get-bowl:strandio
::  Parse the input as Hoon
::
=/  ast=(unit hoon)  (rush input vest)
?~  ast
  ::  Syntax error - return error message
  ::
  (pure:m !>(`eval-output:e`[%error 'syntax error']))
::  Build a minimal subject with:
::  - our: ship identity
::  - now: current time
::  - eny: entropy
::  - ..zuse: standard library
::
=/  fowl=[our=@p now=@da eny=@uvJ]
  :+  our.bowl
    now.bowl
  (shaz (cat 3 (mix [now eny]:bowl) %eny))
::
=/  subject  [fowl ..zuse]
::  Compile the Hoon (catching crashes with mule)
::
=/  minted=(each [=type =nock] (list tank))
  %-  mule  |.
  (~(mint ut -:!>(subject)) %noun u.ast)
::  If compilation failed, return the error
::
?:  ?=(%| -.minted)
  =/  err=tape
    %-  zing
    %+  turn  p.minted
    |=  =tank
    "{(of-wall:format (~(win re tank) 0 80))}\0a"
  (pure:m !>(`eval-output:e`[%error (crip err)]))
::  Execute the compiled nock (sandboxed - no scry allowed)
::  The empty gate |=(^ ~) ensures all .^ calls return null
::
=/  =toon
  (mock [subject nock.p.minted] |=(^ ~))
::  Format and return result based on execution outcome
::
%-  pure:m
!>  ^-  eval-output:e
?-  -.toon
    ::  Success - pretty print the result
    ::
    %0
  =/  result=tape
    (of-wall:format (~(win re (sell type.p.minted p.toon)) 0 80))
  [%ok (crip result)]
    ::  Blocked on scry - not allowed in chat eval
    ::
    %1
  [%error '.^ (scry) is not supported in chat eval']
    ::  Crash during execution
    ::
    %2
  =/  err=tape
    %-  zing
    %+  turn  `(list tank)`p.toon
    |=  =tank
    "{(of-wall:format (~(win re tank) 0 80))}\0a"
  [%error (crip ?~(err "crash" err))]
==

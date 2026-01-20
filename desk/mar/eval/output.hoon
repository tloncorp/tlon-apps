::  /mar/eval/output.hoon
::
/-  e=eval
|_  =eval-output:e
++  grad  %noun
++  grow
  |%
  ++  noun  eval-output
  ++  json
    ^-  ^json
    ?-  -.eval-output
      %&  (pairs:enjs:format ~[['status' s+'ok'] ['output' s+p.eval-output]])
      %|  (pairs:enjs:format ~[['status' s+'error'] ['output' s+p.eval-output]])
    ==
  --
++  grab
  |%
  ++  noun  eval-output:e
  --
--

::  /mar/eval/output.hoon - Mark for eval thread output
::
/-  e=eval
|_  =eval-output:e
++  grad  %noun
++  grow
  |%
  ++  noun  eval-output
  ++  json
    ^-  ^json
    %-  pairs:enjs:format
    :~  ['status' s+(scot %tas status.eval-output)]
        ['output' s+output.eval-output]
    ==
  --
++  grab
  |%
  ++  noun  eval-output:e
  --
--

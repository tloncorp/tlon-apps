::  /mar/eval/input.hoon - Mark for eval thread input
::
/-  e=eval
|_  =eval-input:e
++  grad  %noun
++  grow
  |%
  ++  noun  eval-input
  ++  json  s+eval-input
  --
++  grab
  |%
  ++  noun  cord
  ++  json
    |=  =json
    ^-  eval-input:e
    ?>  ?=(%s -.json)
    p.json
  --
--

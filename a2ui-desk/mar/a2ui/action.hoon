::  a2ui-action: A2UI user action poke payload
::
/-  *a2ui
/+  j=a2ui-json
::
|_  act=action-input
++  grad  %noun
++  grow
  |%
  ++  noun  act
  ++  json  (action-input:enjs:j act)
  --
++  grab
  |%
  ++  noun  action-input
  ++  json
    |=  jon=^json
    ^-  action-input
    (action-input:dejs:j jon)
  --
--

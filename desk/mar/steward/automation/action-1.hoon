::  %steward-automation-action-1: complete task projection action
::
/-  a=steward-automation
/+  aj=steward-automation-json
|_  =action:v1:a
++  grad  %noun
++  grow
  |%
  ++  noun  action
  ++  json  (action-to-json:aj action)
  --
++  grab
  |%
  ++  noun  action:v1:a
  ++  json  action-from-json:aj
  --
--

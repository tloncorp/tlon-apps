::  %steward-prompts-action-1: local projection, edit, or finalize action
::
/-  a=steward-prompts
/+  aj=steward-prompts-json
|_  =action:v1:a
++  grad  %noun
++  grow
  |%
  ++  noun  action
  ++  json  (action:enjs:aj action)
  --
++  grab
  |%
  ++  noun  action:v1:a
  ++  json  action:dejs:aj
  --
--

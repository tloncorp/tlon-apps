::  %steward-automation-tasks-1: the ship-keyed automation task state
::  returned by the tasks scry
::
/-  a=steward-automation
/+  aj=steward-automation-json
|_  all=(map ship tasks:v1:a)
++  grad  %noun
++  grow
  |%
  ++  noun  all
  ++  json  (ship-tasks:enjs:aj all)
  --
++  grab
  |%
  ++  noun  (map ship tasks:v1:a)
  ++  json  ship-tasks:dejs:aj
  --
--

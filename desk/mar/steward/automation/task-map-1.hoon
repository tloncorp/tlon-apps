::  %steward-automation-task-map-1: an ID-keyed automation scry result
::
/-  a=steward-automation
/+  aj=steward-automation-json
|_  tasks=task-map:v1:a
++  grad  %noun
++  grow
  |%
  ++  noun  tasks
  ++  json  (task-map:enjs:aj tasks)
  --
++  grab
  |%
  ++  noun  task-map:v1:a
  ++  json  task-map:dejs:aj
  --
--

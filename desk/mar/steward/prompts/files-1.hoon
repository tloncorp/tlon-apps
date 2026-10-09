::  %steward-prompts-files-1: the ship-keyed workspace projection
::  returned by the files scry
::
/-  a=steward-prompts
/+  aj=steward-prompts-json
|_  all=(map ship prompts:v1:a)
++  grad  %noun
++  grow
  |%
  ++  noun  all
  ++  json  (ship-files:enjs:aj all)
  --
++  grab
  |%
  ++  noun  (map ship prompts:v1:a)
  ++  json  ship-files:dejs:aj
  --
--

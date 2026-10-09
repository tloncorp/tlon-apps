::  %steward-prompts-dispatch-1: a pending edit command handed to the
::  harness on the bot's /v1/prompts/harness feed
::
/-  a=steward-prompts
/+  aj=steward-prompts-json
|_  =dispatch:v1:a
++  grad  %noun
++  grow
  |%
  ++  noun  dispatch
  ++  json  (dispatch:enjs:aj dispatch)
  --
++  grab
  |%
  ++  noun  dispatch:v1:a
  --
--

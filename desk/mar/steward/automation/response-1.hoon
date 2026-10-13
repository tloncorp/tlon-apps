::  %steward-automation-response-1: the terminal response for one edit,
::  facted bot → owner and owner → client, and the HTTP response body
::
/-  a=steward-automation
/+  aj=steward-automation-json
|_  =response:v1:a
++  grad  %noun
++  grow
  |%
  ++  noun  response
  ++  json  (response:enjs:aj response)
  --
++  grab
  |%
  ++  noun  response:v1:a
  --
--

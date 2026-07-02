::  notes-action-1: HTTP / request-id wrapped action
::    POST body JSON: {"requestId": "0v...", "action": <a-notes JSON>}
::
/-  n=notes
/+  notes-json
|_  =action:v1:n
++  grad  %noun
++  grab
  |%
  ++  noun  action:v1:n
  ++  json  action:v1:dejs:notes-json
  --
++  grow
  |%
  ++  noun  action
  --
--

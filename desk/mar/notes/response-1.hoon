::  notes-response-1: subscriber → client response.
::    Faceted on /v1/notes/~ship/name/request/<uv> and returned as the
::    body of POST /notes/~/v1 (or its GET /request/<uv> follow-up).
::
/-  n=notes
/+  notes-json
|_  =response:v1:n
++  grad  %noun
++  grab
  |%
  ++  noun  response:v1:n
  --
++  grow
  |%
  ++  noun  response
  ++  json  (response:v1:enjs:notes-json response)
  --
--

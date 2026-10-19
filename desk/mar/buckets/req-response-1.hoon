::  buckets-req-response-1: terminal answer to one client action
::
::  Pinned to the v1 noun, which carries no broker detail on an %error. The
::  JSON is the v2 encoding of the lifted value, which adds nothing for an
::  answer that has nothing to add.
::
/-  b=buckets
/+  util=buckets-util
/=  buckets-json  /lib/buckets/json
|_  res=req-response:v1:b
++  grad  %noun
++  grab
  |%
  ++  noun  req-response:v1:b
  --
++  grow
  |%
  ++  noun  res
  ++  json  (req-response:enjs:buckets-json (req-response-1-to-2:util res))
  --
--

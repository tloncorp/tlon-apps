::  buckets-req-response-2: terminal answer to one client action
::
::  As -1, with the storage broker's own account of a refusal on an %error.
::
/-  b=buckets
/=  buckets-json  /lib/buckets/json
|_  res=req-response:v2:b
++  grad  %noun
++  grab
  |%
  ++  noun  req-response:v2:b
  --
++  grow
  |%
  ++  noun  res
  ++  json  (req-response:enjs:buckets-json res)
  --
--

::  buckets-req-response-1: terminal answer to one client action
::
/-  b=buckets
/=  buckets-json  /lib/buckets/json
|_  res=req-response:b
++  grad  %noun
++  grab
  |%
  ++  noun  req-response:b
  --
++  grow
  |%
  ++  noun  res
  ++  json  (req-response:enjs:buckets-json res)
  --
--

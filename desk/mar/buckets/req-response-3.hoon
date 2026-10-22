::  buckets-req-response-3: terminal answer to one client action
::
::  As -2, with %capacity: the room left on the host's hosting account.
::
/-  b=buckets
/=  buckets-json  /lib/buckets/json
|_  res=req-response:v3:b
++  grad  %noun
++  grab
  |%
  ++  noun  req-response:v3:b
  --
++  grow
  |%
  ++  noun  res
  ++  json  (req-response:enjs:buckets-json res)
  --
--

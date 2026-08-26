::  buckets-summaries-1: the local buckets without their contents
::
::  What listing and routing need. buckets-snapshots-1 carries every entry of
::  every bucket, which is unbounded and is only wanted when opening one.
::
/-  b=buckets
/=  buckets-json  /lib/buckets/json
|_  sums=(list summary:b)
++  grad  %noun
++  grab
  |%
  ++  noun  (list summary:b)
  --
++  grow
  |%
  ++  noun  sums
  ++  json  (summaries:enjs:buckets-json sums)
  --
--

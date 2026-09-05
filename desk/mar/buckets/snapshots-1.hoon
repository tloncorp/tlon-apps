::  buckets-snapshots-1: complete local manifest replica
::
/-  b=buckets
/=  buckets-json  /lib/buckets/json
|_  snaps=(list snapshot:b)
++  grad  %noun
++  grab
  |%
  ++  noun  (list snapshot:b)
  --
++  grow
  |%
  ++  noun  snaps
  ++  json  (snapshots:enjs:buckets-json snaps)
  --
--

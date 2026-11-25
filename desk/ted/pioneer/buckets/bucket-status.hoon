::  Answer whether this ship still hosts a bucket id, and if it does, which
::  object keys the bucket still references, for the broker's sweep.
::
::  The broker purges the bucket's stored objects on gone, and the objects a
::  live answer does not list, so this answers only what +bucket-liveness
::  says. An id it will not answer for -- one above the agent's high-water
::  mark -- fails this strand, which the broker counts as unknown. It is
::  asked about first: the answer itself would be missing, and a missing
::  result through .^ crashes Spider and every other strand with it.
::
/-  spider
/+  *strandio
/=  buckets-json  /lib/buckets/json
=,  strand=strand:spider
=,  dejs:format
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=+  !<(arg=(unit json) arg)
?>  ?=(^ arg)
=/  id=@t
  (so (get:dejs:buckets-json 'bucketId' u.arg))
;<  answers=?  bind:m  (scry ? /gu/buckets/v1/broker/bucket/[id])
?.  answers
  (strand-fail:strand %bucket-id-not-issued ~)
;<  verdict=json  bind:m
  (scry json /gx/buckets/v1/broker/bucket/[id]/json)
(pure:m !>(verdict))

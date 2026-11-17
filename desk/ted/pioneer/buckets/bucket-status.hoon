::  Answer whether this ship still hosts a bucket id, for the broker's sweep.
::
::  The broker purges the bucket's stored objects on gone, so this answers
::  only what +bucket-liveness says. An id it will not answer for fails the
::  scry, and with it the thread, which the broker counts as unknown.
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
;<  verdict=json  bind:m
  (scry json /gx/buckets/v1/broker/bucket/[id]/json)
(pure:m !>(verdict))

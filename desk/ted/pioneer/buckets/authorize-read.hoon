::  Exchange an opaque read capability for an object-bound verdict.
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
=*  jon  u.arg
=/  capability=@t
  (so (get:dejs:buckets-json 'capability' jon))
=/  object=@t
  (so (get:dejs:buckets-json 'objectId' jon))
;<  verdict=json  bind:m
  (scry json /gx/buckets/v1/broker/read/[capability]/[object]/json)
(pure:m !>(verdict))

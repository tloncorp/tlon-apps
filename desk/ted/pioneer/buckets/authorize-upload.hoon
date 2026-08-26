::  Exchange an opaque upload capability for authoritative Bucket metadata.
::
/-  spider, b=buckets
/+  *strandio
/=  buckets-json  /lib/buckets/json
=,  strand=strand:spider
=,  dejs:format
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
;<  our=@p  bind:m  get-our
=+  !<(arg=(unit json) arg)
?>  ?=(^ arg)
=*  jon  u.arg
=/  capability=@t
  (so (get:dejs:buckets-json 'capability' jon))
=/  reservation=@t
  (so (get:dejs:buckets-json 'brokerReservationId' jon))
;<  ~  bind:m
  %+  poke  [our %buckets]
  buckets-broker-command-1+!>(`broker-command:b`[%authorize-upload capability reservation])
;<  verdict=json  bind:m
  (scry json /gx/buckets/v1/broker/upload/[capability]/[reservation]/json)
(pure:m !>(verdict))

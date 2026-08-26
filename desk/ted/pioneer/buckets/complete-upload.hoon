::  Commit Memex's verified object receipt to the Bucket manifest.
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
=/  reservation=@t
  (so (get:dejs:buckets-json 'brokerReservationId' jon))
=/  receipt=json
  (get:dejs:buckets-json 'receipt' jon)
=/  object=@t
  (so (get:dejs:buckets-json 'objectId' receipt))
=/  host=@t
  (so (get:dejs:buckets-json 'host' receipt))
=/  bucket=@t
  (so (get:dejs:buckets-json 'bucketId' receipt))
=/  size=@ud
  (ni (get:dejs:buckets-json 'size' receipt))
=/  mime=@t
  (so (get:dejs:buckets-json 'mimeType' receipt))
=/  broker-receipt=broker-receipt:b
  [reservation object host bucket size mime]
;<  ~  bind:m
  %+  poke  [our %buckets]
  buckets-broker-command-1+!>(`broker-command:b`[%complete-upload broker-receipt])
;<  verdict=json  bind:m
  (scry json /gx/buckets/v1/broker/complete/[reservation]/json)
(pure:m !>(verdict))

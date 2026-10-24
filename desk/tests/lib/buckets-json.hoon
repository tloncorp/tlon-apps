::  tests for the %buckets JSON encoders
::
::  These pin the wire shape of a request answer, which is what a client
::  reads off /v1/requests and what Eyre serves for a held POST.
::
/-  b=buckets
/+  *test
/=  buckets-json  /lib/buckets/json
|%
::  +error-of: the error object a refused answer encodes to
::
++  error-of
  |=  body=response-body:b
  ^-  (map @t json)
  =/  jon=json  (req-response:enjs:buckets-json [0v1 body])
  =/  err=json
    (get:dejs:buckets-json 'error' (get:dejs:buckets-json 'body' jon))
  ?>  ?=([%o *] err)
  p.err
::
::  The broker's account goes out beside the agent's own tags: its code, its
::  word on retrying, the delay as a number of milliseconds, and what the
::  delay covers.
::
++  test-error-carries-the-broker-detail
  %+  expect-eq
    !>  ^-  (map @t json)
    %-  ~(gas by *(map @t json))
    :~  ['type' s+'unknown']
        ['message' s+'slow down']
        ['code' s+'rate_limited']
        ['retryable' b+&]
        ['retryAfterMs' (numb:enjs:format 5.000)]
        ['scope' s+'host']
    ==
  !>((error-of [%error %unknown 'slow down' `['rate_limited' & `~s5 `'host']]))
::
::  A delay or scope the broker did not give is left out rather than sent
::  as zero or empty: a client reading the key absent knows nothing was
::  asked of it.
::
++  test-error-omits-a-delay-and-scope-not-given
  %+  expect-eq
    !>  ^-  (map @t json)
    %-  ~(gas by *(map @t json))
    :~  ['type' s+'unknown']
        ['message' s+'nope']
        ['code' s+'unknown']
        ['retryable' b+|]
    ==
  !>((error-of [%error %unknown 'nope' `['unknown' | ~ ~]]))
::
::  An error this agent raised itself has nothing from the broker on it.
::
++  test-error-without-a-broker-has-only-the-agent-tags
  %+  expect-eq
    !>  ^-  (map @t json)
    %-  ~(gas by *(map @t json))
    :~  ['type' s+'not-found']
        ['message' s+'no such bucket']
    ==
  !>((error-of [%error %not-found 'no such bucket' ~]))
::
::  A capacity answer goes out as the four fields a writer needs and nothing
::  else: no account, no tier, no other bucket.
::
++  test-capacity-carries-the-four-fields
  %+  expect-eq
    !>  ^-  (map @t json)
    %-  ~(gas by *(map @t json))
    :~  ['bytes' (numb:enjs:format 123)]
        ['files' (numb:enjs:format 4)]
        ['maxObjectBytes' (numb:enjs:format 99)]
        ['mimeTypes' a+~[s+'image/png']]
    ==
  !>  ^-  (map @t json)
  =/  jon=json
    (req-response:enjs:buckets-json [0v1 [%capacity 123 4 99 (silt ~['image/png'])]])
  =/  cap=json
    (get:dejs:buckets-json 'capacity' (get:dejs:buckets-json 'body' jon))
  ?>  ?=([%o *] cap)
  p.cap
::
++  test-decodes-query-capacity
  %+  expect-eq
    !>  ^-  action:b
    [%bucket [~sampel-palnet %project-files] [%query-capacity ~]]
  !>  ^-  action:b
  %-  action:dejs:buckets-json
  %-  need
  %-  de:json:html
  '{"type":"query-capacity","flag":{"host":"~sampel-palnet","name":"project-files"}}'
--

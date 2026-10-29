::  tests for the %buckets JSON encoders
::
::  These pin the wire shape of a request answer, which is what a client
::  reads off /v1/requests and what Eyre serves for a held POST.
::
/-  b=buckets
/+  *test, util=buckets-util
/=  buckets-json  /lib/buckets/json
|%
::  +error-of: the error object a refused answer encodes to
::
++  iris-json
  |=  [status=@ud body=@t]
  ^-  client-response:iris
  :+  %finished
    [status ~]
  `['application/json' [(met 3 body) body]]
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
  !>((error-of [%error %unknown 'slow down' `['rate_limited' & `5.000 `'host']]))
::
::  A delay the broker sent in milliseconds comes back out as the same
::  number, whole seconds or not: it is held in milliseconds, so nothing
::  between the broker and the client changes it.
::
++  test-retry-after-round-trips
  =/  through
    |=  ms=@ud
    ^-  json
    =/  body=@t
      %-  crip
      "\{\"code\":\"rate_limited\",\"retryAfterMs\":{(a-co:co ms)}}"
    =/  refusal  (broker-error:util (iris-json 429 body) 3.600.000)
    %-  ~(got by (error-of [%error %unknown 'slow down' `broker-error.refusal]))
    'retryAfterMs'
  ;:  weld
    (expect-eq !>((numb:enjs:format 55.590)) !>((through 55.590)))
    (expect-eq !>((numb:enjs:format 1)) !>((through 1)))
    (expect-eq !>((numb:enjs:format 5.000)) !>((through 5.000)))
  ==
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
--

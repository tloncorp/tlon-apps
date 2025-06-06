::  posthog: submit an log event to Posthog
::
/-  spider
/+  io=strandio, l=logs
::
=+  posthog-key='phc_GyI5iD7kM6RRbb1hIU0fiGmTCh4ha44hthJYJ7a89td'
=+  posthog-url='https://eu.i.posthog.com/capture/'
=+  posthog-retry=3
=+  posthog-retry-delay=~s5
::
=,  strand=strand:spider
^-  thread:spider
::  .arg: a pair of origin and log item
::
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=+  !<(arg=(unit (trel path log-item:l log-data:l)) arg)
?>  ?=(^ arg)
=*  origin  p.u.arg
=*  log-item  q.u.arg
=*  log-data  r.u.arg
;<  =bowl:strand  bind:m  get-bowl:io
;<  is-fake=?  bind:m  (scry:io ? %j /fake)
=/  log-event-json=$>(%o json)  (log-event:enjs:l event.log-item)
::  retrieve desk hash
::
;<  hash=@uv  bind:m  (scry:io @uv %cz q.byk.bowl ~)
::

=/  id=@t
  ?.  is-fake
    (scot %p our.bowl)
  (cat 3 'fake' (scot %p our.bowl))

=/  props=$>(%o json)
  :-  %o
  %-  ~(uni by p.log-event-json)
  ^-  (map @t json)
  %-  my
  %+  weld  log-data
  ^-  log-data:l
  :~  'distinct_id'^s+id
      'origin'^s+(spat origin)
      'hash'^s+(scot %uv hash)
  ==
::  find event label
::
=/  label=$>(%s json)
  =+  event=(~(get by p.props) 'event')
  ?~  event  s+'Backend Log'
  ?>(?=(%s -.u.event) u.event)
=/  event=json
  %-  pairs:enjs:format
  =/  timestamp=@t
    %-  crip
    =+  (yore time.log-item)
    =*  d  (d-co:co 2)
    "{(d y)}-{(d m)}-{(d d.t)}".
    "T{(d h.t)}:{(d m.t)}:{(d s.t)}".
    ".{(d ?~(f.t 0 (div (mul 100 i.f.t) 0x1.0000)))}".
    "Z"
  :~  'api_key'^s+posthog-key
      'distinct_id'^s+id
      timestamp+s+timestamp
      event+label
      properties+props
  ==
::
=/  =request:http
  :*  %'POST'
      posthog-url
      ~['content-type'^'application/json']
      `(as-octs:mimes:html (en:json:html event))
  ==
::  retry loop
::
|-
?:  =(0 posthog-retry)
  (pure:m !>(~))
;<  ~  bind:m  (send-request:io request)
;<  =client-response:iris  bind:m  take-client-response:io
::NOTE  this logic must be adjusted when %iris supports
::      partial responses
?>  ?=(%finished -.client-response)
?:  =(200 status-code.response-header.client-response)
  (pure:m !>(`client-response))
=*  status-code  status-code.response-header.client-response
%-  (slog leaf+"posthog request failed: status {<status-code>}" ~)
;<  ~  bind:m  (sleep:io posthog-retry-delay)
$(posthog-retry (dec posthog-retry))

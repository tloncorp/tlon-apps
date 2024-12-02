::  posthog: submit an log event to PostHog
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
=+  !<(arg=(unit (pair path log-item:l)) arg)
?>  ?=(^ arg)
=*  origin  p.u.arg
=*  log-item  q.u.arg
;<  =bowl:strand  bind:m  get-bowl:io
=/  log-event-json=$>(%o json)  (log-event:enjs:l event.log-item)
=/  props=json
  :-  %o
  %-  ~(uni by p.log-event-json)
  ^-  (map @t json)
  %-  my
  :~  'distinct_id'^s+(scot %p our.bowl)
      'origin'^s+(spat origin)
  ==
=/  event=json
  %-  pairs:enjs:format
  :~  'api_key'^s+posthog-key
      timestamp/(time:enjs:format time.log-item)
      event/s+'Backend Log'
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

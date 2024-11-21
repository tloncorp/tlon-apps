::  posthog: submit an log event to PostHog
::
/-  spider
/+  io=strandio, l=logs
::
=+  posthog-key='phc_GyI5iD7kM6RRbb1hIU0fiGmTCh4ha44hthJYJ7a89td'
=+  posthog-url='https://eu.i.posthog.com/capture/'
=+  posthog-retry=3
=+  posthog-retry-delay=~s30
::
=,  strand=strand:spider
^-  thread:spider
::  .arg: a pair of origin agent and log item
::
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=+  !<(arg=(unit (pair @tas log-item:l)) arg)
?>  ?=(^ arg)
=*  agent  p.u.arg
=*  log-item  q.u.arg
;<  =bowl:strand  bind:m  get-bowl:io
=/  log-event-json=$>(%o json)  (log-event:enjs:l event.log-item)
=/  props=json
  :-  %o
  %-  ~(uni by p.log-event-json)
  ^-  (map @t json)
  %-  my
  :~  'distinct_id'^s+(scot %p our.bowl)
      'agent'^s+agent
  ==
=/  event=json
  %-  pairs:enjs:format
  :~  'api_key'^s+posthog-key
      timestamp/(id-event:enjs:l id.log-item)
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
|-
?:  =(0 posthog-retry)
  (pure:m !>(~))
;<  ~  bind:m  (send-request:io request)
;<  =client-response:iris  bind:m  take-client-response:io
::NOTE  this logic must be adjusted when %iris supports
::      partial responses
?.  ?&  ?=(%finished -.client-response)
        =(200 status-code.response-header.client-response)
    ==
  ?>  ?=(%finished -.client-response)
  =*  status-code  status-code.response-header.client-response
  %-  (slog leaf+"posthog request failed: status {<status-code>}" ~)
  ;<  ~  bind:m  (sleep:io posthog-retry-delay)
  $(posthog-retry (dec posthog-retry))
(pure:m !>(`client-response))

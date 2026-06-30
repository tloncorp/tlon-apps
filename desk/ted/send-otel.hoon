::  send-otel: submit an log event to open telemetry provider
::
/-  spider
/+  io=strandio, l=logs
::
=+  otel-provider-url='http://alloy.alloy.svc.cluster.local:4318/v1/logs'
=+  retry=3
=+  retry-delay=~s5
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
=/  log-event-json=$>(%o json)  (log-event:enjs:l event.log-item)
::  retrieve desk hash
::
;<  hash=@uv  bind:m  (scry:io @uv %cz q.byk.bowl ~)
::
;<  is-fake=?  bind:m  (scry:io ? %j /fake)
=,  enjs:format
::
=/  ship-id=json
  =;  id=@t  s+id
  ?.  is-fake
    %+  rsh  [3 1]
    (scot %p our.bowl)
  (cat 3 'fake' (scot %p our.bowl))
=/  timestamp=json
  :-  %s
  %-  crip
  %-  (d-co:co 0)
  ::  unix nanoseconds
  (mul (unm:chrono:userlib -.log-item) 1.000.000)
=/  resource=json
  %-  frond
  :-  'attributes'
  :-  %a 
  :~  %-  pairs
      :~  'key'^s+'service.name'
          ::  remove the leading '/' because grafana will append service
          ::  name with a leading slash to service namespace to
          ::  construct the final service name.
          ::
          'value'^(frond 'stringValue' s+(rsh [3 1] (spat origin)))
      ==
    ::
      %-  pairs
      :~  'key'^s+'service.namespace'
          'value'^(frond 'stringValue' s+'urbit')
      ==
      ::TODO per-agent criticality setting
      :: %-  pairs
      :: :~  'key'^'service.criticality'
      ::     'value'^(frond 'stringValue' s+'urbit')
      :: ==
    ::
  ==
=/  severity-number=json
  =/  =volume:l
    vol.event.log-item
  ?-  volume
    %trace  (numb 1)
    %dbug   (numb 5)
    %info   (numb 9)
    %warn   (numb 13)
    %error  (numb 17)
    %fatal  (numb 21)
  ==
=/  exception=(list json)
  ?:  ?=(%tell -.event.log-item)  ~
  =/  message=@t
    =/  lines=(list ^tape)
      %-  zing
      (turn echo.event.log-item (cury wash [0 80]))
    (crip (zing (join "\0a" lines)))
  =/  stacktrace=@t
    =/  lines=(list ^tape)
      %-  zing
      (turn trace.event.log-item (cury wash [0 80]))
    (crip (zing (join "\0a" lines)))
  :~  %-  pairs
      :~  'key'^s+'exception.message'
          'value'^(frond 'stringValue' s+message)
      ==
    ::
      %-  pairs
      :~  'key'^s+'exception.stacktrace'
          'value'^(frond 'stringValue' s+stacktrace)
      ==
  ==
=/  scope=json  o+~
=/  log-attributes=json
  :-  %a
  ;:  weld
    :~  %-  pairs
        :~  'key'^s+'ship'
            'value'^(frond 'stringValue' ship-id)
        ==
    ==
  ::
    exception
  ==
=/  body=json
  ?:  ?=(%fail -.event.log-item)
    =/  lines=(list ^tape)
    ::
      %-  zing
      (turn echo.event.log-item (cury wash [0 80]))
    :-  %s
    (crip (zing (join "\0a" lines)))
  =/  lines=(list ^tape)
    %-  zing
    (turn echo.event.log-item (cury wash [0 80]))
  :-  %s
  (crip (zing (join "\0a" lines)))

::  unix epoch milisecond time to nanoseconds
=/  log-record=json
  %-  pairs
  :~  'timeUnixNano'^timestamp
      'severityNumber'^severity-number
      'body'^(frond 'stringValue' body)
      'attributes'^log-attributes
  ==
=/  logs=json
  %+  frond  'resourceLogs'
  :-  %a
  :_  ~
  %-  pairs
  :~  'resource'^resource
      :-  'scopeLogs'
      :-  %a
      :~  %-  pairs
          :~  'scope'^scope
              'logRecords'^a+~[log-record]
          ==
      ==
  ==
~&  (en:json:html logs)
=/  =request:http
  :*  %'POST'
      otel-provider-url
      ~['content-type'^'application/json']
      `(as-octs:mimes:html (en:json:html logs))
  ==
::  retry loop
::
|-
?:  =(0 retry)
  (pure:m !>(~))
;<  ~  bind:m  (send-request:io request)
;<  =client-response:iris  bind:m  take-client-response:io
::NOTE  this logic must be adjusted when %iris supports
::      partial responses
?>  ?=(%finished -.client-response)
?:  =(200 status-code.response-header.client-response)
  %-  %-  slog 
    =*  full-file  full-file.client-response
    ?~  full-file  ~
    ~[leaf+"otel-response:" `@t`q.data.u.full-file]
  (pure:m !>(`client-response))
=*  status-code  status-code.response-header.client-response
%-  %-  slog 
  :-  leaf+"otel request failed: status {<status-code>}"
  =*  full-file  full-file.client-response
  ?~  full-file  ~
  ~[leaf+"otel-response:" `@t`q.data.u.full-file]
;<  ~  bind:m  (sleep:io retry-delay)
$(retry (dec retry))

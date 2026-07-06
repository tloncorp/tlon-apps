::  send-otel: submit an log event to open telemetry provider
::
/-  spider
/+  io=strandio, l=logs
::
=+  otel-provider-url='http://alloy.alloy.svc.cluster.local:4318/v1/logs'
=+  retry=3
=+  retry-delay=~s5
::
=>
|%
::  +json-val-to-attr: convert json value to otel attribute
::
++  json-val-to-attr
  |=  val=json
  ^-  json
  =,  enjs:format
  ?-  -.val
    %s  (frond 'stringValue' s+p.val)
    %n  (frond 'intValue' s+p.val)
    %b  (frond 'boolValue' b+p.val)
    %a  a+(turn p.val json-val-to-attr)
    %o  o+(~(run by p.val) json-val-to-attr)
  ==
::  +json-obj-to-attrs: convert flattened json object to otel attributes list
::
++  json-obj-to-attrs
  |=  obf=(list (pair @t json))
  ^-  (list json)
  %+  turn  obf
  |=  [key=@t val=json]
  %-  pairs:enjs:format
  :~  'key'^s+key
      'value'^(json-val-to-attr val)
  ==
--
=,  strand=strand:spider
^-  thread:spider
::  args
::
::  .otel: open telemetry endpoint
::  .path: origin
::  .log-item: log report
::  .log-data: log report supplement
::
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=+  !<(arg=(unit [otel=@t =path =log-item:l =log-data:l]) arg)
?>  ?=(^ arg)
=*  otel      otel.u.arg
=*  origin    path.u.arg
=*  log-item  log-item.u.arg
=*  log-data  log-data.u.arg
::
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
          'value'^(frond 'stringValue' s+(spat origin))
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
  =/  [message=json trace=tang]
    =*  tang  tang.event.log-item
    ?~  tang
      [s+'failed in unknown' ~['missing']]
    ?~  t.tang
      [s+'failed in unknown' tang]
    =*  head  i.tang
    ?:  ?=(@ head)
      :_  t.tang
      s+(crip "failed in {(trip head)}")
    ?:  ?=(%leaf -.head)
      :_  t.tang
      s+(crip "failed in {p.head}")
    [s+'failed in unknown' tang]
  =/  stacktrace=@t
    =/  lines=(list ^tape)
      %-  zing
      (turn trace (cury wash [0 80]))
    (crip (zing (join "\0a" lines)))
  :~  %-  pairs
      :~  'key'^s+'exception.message'
          'value'^(frond 'stringValue' message)
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
    exception
    (json-obj-to-attrs log-data)
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
      otel
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

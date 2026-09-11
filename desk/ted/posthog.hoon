::  posthog: submit an log event to Posthog
::
/-  spider
/+  io=strandio, l=logs
::
=+  posthog-key='phc_GyI5iD7kM6RRbb1hIU0fiGmTCh4ha44hthJYJ7a89td'
=+  posthog-url='https://eu.i.posthog.com/batch/'
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
=/  timestamp=@t
  %-  crip
  =+  (yore time.log-item)
  =*  d  (d-co:co 2)
  "{(d y)}-{(d m)}-{(d d.t)}".
  "T{(d h.t)}:{(d m.t)}:{(d s.t)}".
  ".{(d ?~(f.t 0 (div (mul 100 i.f.t) 0x1.0000)))}".
  "Z"
=/  event=json
  %-  pairs:enjs:format
  :~  'distinct_id'^s+id
      timestamp+s+timestamp
      event+label
      properties+props
  ==
::  crashes also go to posthog error tracking as $exception events, grouped
::  by the fingerprint %logs attached, so first-seen and regression alerts
::  come from the product instead of a hand-kept list. the plain event
::  above is kept so existing dashboards keep working.
::
=/  exception=(unit json)
  ?.  ?=(%fail -.event.log-item)  ~
  =/  fingerprint=(unit @t)
    =+  fp=(~(get by p.props) 'fingerprint')
    ?~  fp  ~
    ?.  ?=(%s -.u.fp)  ~
    `p.u.fp
  ?~  fingerprint  ~
  =/  message=@t  (crip (head-line:l echo.event.log-item))
  ::  "/app/groups/hoon:<[2.150 5].[2.152 41]>" -> line 2150, column 5
  ::
  =/  span-pos
    |=  t=tape
    ^-  [lineno=@ud colno=@ud]
    =/  i  (find "<[" t)
    ?~  i  [0 0]
    =/  rest=tape  (slag (add 2 u.i) t)
    =/  ln=tape  (scag (fall (find " " rest) 0) rest)
    =/  after=tape  (slag +((lent ln)) rest)
    =/  cn=tape  (scag (fall (find "]" after) 0) after)
    :-  (fall (rush (crip (skip ln |=(c=@tD =(c 46)))) dem) 0)
    (fall (rush (crip cn) dem) 0)
  =/  frames=(list json)
    %+  turn  (tang-lines:l tang.event.log-item)
    |=  line=tape
    =/  t=tape  (trim-line:l line)
    =/  span=?  (span-line:l t)
    =/  pos=[lineno=@ud colno=@ud]  ?.(span [0 0] (span-pos t))
    %-  pairs:enjs:format
    %+  weld
      ^-  (list [@t json])
      :~  'platform'^s+'custom'
          'lang'^s+'hoon'
          'function'^s+(crip t)
          'lineno'^(numb:enjs:format lineno.pos)
          'colno'^(numb:enjs:format colno.pos)
          'resolved'^b+&
          'in_app'^b+&
      ==
    ^-  (list [@t json])
    ?.  span  ~
    ~['filename'^s+(crip (scag (need (find ":<[" t)) t))]
  :-  ~
  %-  pairs:enjs:format
  :~  'distinct_id'^s+id
      timestamp+s+timestamp
      event+s+'$exception'
      :-  'properties'
      :-  %o
      %-  ~(gas by p.props)
      :~  '$exception_fingerprint'^s+u.fingerprint
          '$lib'^s+'urbit-logs'
          '$issue_name'^(fall (~(get by p.props) 'signature') s+message)
          '$issue_description'^s+message
          :-  '$exception_list'
          :-  %a
          :_  ~
          %-  pairs:enjs:format
          :~  'type'^s+(spat origin)
              'value'^s+message
              'mechanism'^(pairs:enjs:format ~['handled'^b+| 'synthetic'^b+| 'type'^s+'generic'])
              'stacktrace'^(pairs:enjs:format ~['type'^s+'raw' 'frames'^a+frames])
          ==
      ==
  ==
=/  body=json
  %-  pairs:enjs:format
  :~  'api_key'^s+posthog-key
      :-  'batch'
      :-  %a
      ?~(exception ~[event] ~[event u.exception])
  ==
::
=/  =request:http
  :*  %'POST'
      posthog-url
      ~['content-type'^'application/json']
      `(as-octs:mimes:html (en:json:html body))
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

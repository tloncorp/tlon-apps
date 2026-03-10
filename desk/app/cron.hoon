::  %cron: scheduled poke agent
::
::  Fires pokes on a repeating timer.
::
::  HTTP API (all paths under /cron):
::    GET    /cron           list all timers
::    POST   /cron           create a timer
::    GET    /cron/:id       get a timer
::    PUT    /cron/:id       update a timer
::    DELETE /cron/:id       delete a timer
::
/-  c=cron
/+  default-agent, server
::
|%
+$  card  card:agent:gall
+$  versioned-state
  $%  state-0
  ==
+$  state-0
  $:  %0
      next-id=@ud
      timers=timers:c
  ==
--
::
=|  state-0
=*  state  -
^-  agent:gall
=<
::
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %|) bowl)
    cor   ~(. +> [bowl ~])
::
++  on-init
  ^-  (quip card _this)
  :_  this
  ~[[%pass /eyre/connect %arvo %e %connect [~ /cron] dap.bowl]]
::
++  on-save   !>(state)
++  on-load
  |=  old=vase
  ^-  (quip card _this)
  =/  sot  (mole |.(!<(state-0 old)))
  :_  ?~(sot this this(state u.sot))
  ~[[%pass /eyre/connect %arvo %e %connect [~ /cron] dap.bowl]]
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  =^  cards  state
    abet:(poke:cor mark vase)
  [cards this]
::
++  on-arvo
  |=  [=wire =sign-arvo]
  ^-  (quip card _this)
  =^  cards  state
    abet:(arvo:cor wire sign-arvo)
  [cards this]
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
  ?+  path  (on-watch:def path)
    [%http-response *]  `this
  ==
::
++  on-peek   on-peek:def
++  on-leave  on-leave:def
++  on-agent
  |=  [=wire =sign:agent:gall]
  ^-  (quip card _this)
  ?+  wire  (on-agent:def wire sign)
      [%fire *]
    ?+  -.sign  `this
        %poke-ack
      ?~  p.sign  `this
      %-  (slog [leaf+"cron: poke nacked" u.p.sign])
      `this
    ==
  ==
++  on-fail   on-fail:def
--
::
|_  [=bowl:gall cards=(list card)]
++  abet   [(flop cards) state]
++  cor    .
++  emit   |=(=card cor(cards [card cards]))
++  emit-list
  |=  caz=(list card)
  ^+  cor
  |-  ?~  caz  cor
  $(caz t.caz, cor (emit i.caz))
::
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?+    mark  ~|(bad-mark+mark !!)
      %handle-http-request
    =+  !<([req-id=@ta =inbound-request:eyre] vase)
    (handle-http req-id inbound-request)
  ::
      %noun
    ?+  q.vase  cor
        %rebind
      (emit [%pass /eyre/connect %arvo %e %connect [~ /cron] dap.bowl])
    ==
  ==
::
++  arvo
  |=  [=wire =sign-arvo]
  ^+  cor
  ?+    wire  cor
      [%eyre %connect ~]
    ?>  ?=([%eyre %bound *] sign-arvo)
    ~?  !accepted.sign-arvo
      [dap.bowl 'eyre: /cron bind rejected']
    cor
  ::
      [%timer @ @ ~]
    ?>  ?=([%behn %wake *] sign-arvo)
    =/  raw-id   i.t.wire
    =/  raw-ver  i.t.t.wire
    =/  tid=(unit @ud)  (slaw %ud raw-id)
    =/  ver=(unit @ud)  (slaw %ud raw-ver)
    ?~  tid  cor
    ?~  ver  cor
    ?~  t=(~(get by timers.state) u.tid)  cor
    =/  =timer:c  u.t
    ::  ignore stale fires (from before update/delete)
    ?.  &(active.timer =(u.ver version.timer))  cor
    ::  fire the poke
    =/  ps=poke-spec:c  poke.timer
    =/  real-body=@t  (fill-body body.ps now.bowl)
    =.  cor  (emit [%pass ~[%fire (scot %ud u.tid)] %agent [ship.ps agent.ps] %poke mark.ps !>(real-body)])
    ::  bump version and reschedule
    =/  next-ver=@ud  (add version.timer 1)
    =.  timers.state
      (~(put by timers.state) u.tid timer(version next-ver))
    =/  next=time  (add now.bowl (mul ~s1 period.timer))
    (emit [%pass ~[%timer (scot %ud u.tid) (scot %ud next-ver)] %arvo %b %wait next])
  ==
::
++  handle-http
  |=  [req-id=@ta =inbound-request:eyre]
  ^+  cor
  =/  line  (parse-request-line:server url.request.inbound-request)
  =*  segs  site.line
  ?+    method.request.inbound-request  (reply req-id 405 ~ ~)
  ::
      %'GET'
    ?+    segs  (reply req-id 404 ~ ~)
        [%cron ~]    (list-timers req-id)
        [%cron @ ~]  (get-timer req-id i.t.segs)
    ==
  ::
      %'POST'
    ?+    segs  (reply req-id 404 ~ ~)
        [%cron ~]  (create-timer req-id inbound-request)
    ==
  ::
      %'PUT'
    ?+    segs  (reply req-id 404 ~ ~)
        [%cron @ ~]  (update-timer req-id i.t.segs inbound-request)
    ==
  ::
      %'DELETE'
    ?+    segs  (reply req-id 404 ~ ~)
        [%cron @ ~]  (delete-timer req-id i.t.segs)
    ==
  ==
::
++  list-timers
  |=  req-id=@ta
  ^+  cor
  =/  all=(list timer:c)
    (turn ~(tap by timers.state) |=([k=@ud v=timer:c] v))
  (reply-json req-id 200 [%a (turn all enjs-timer)])
::
++  get-timer
  |=  [req-id=@ta raw=knot]
  ^+  cor
  =/  tid=(unit @ud)  (slaw %ud raw)
  ?~  tid  (reply-err req-id 400 'invalid timer id')
  ?~  t=(~(get by timers.state) u.tid)
    (reply-err req-id 404 'timer not found')
  (reply-json req-id 200 (enjs-timer u.t))
::
++  create-timer
  |=  [req-id=@ta =inbound-request:eyre]
  ^+  cor
  ?~  body.request.inbound-request  (reply-err req-id 400 'missing body')
  =/  parsed=(unit json)  (de:json:html q.u.body.request.inbound-request)
  ?~  parsed  (reply-err req-id 400 'invalid json')
  ?.  ?=(%o -.u.parsed)  (reply-err req-id 400 'expected object')
  =/  obj  p.u.parsed
  ::  parse poke spec
  =/  poke-json=(unit json)  (~(get by obj) 'poke')
  ?~  poke-json  (reply-err req-id 400 'required: poke object')
  ?.  ?=(%o -.u.poke-json)  (reply-err req-id 400 'poke must be an object')
  =/  pobj  p.u.poke-json
  =/  ship-str=(unit cord)   (get-str pobj 'ship')
  =/  agent-str=(unit cord)  (get-str pobj 'agent')
  =/  mark-str=(unit cord)   (get-str pobj 'mark')
  =/  body-str=cord          (fall (get-str pobj 'body') '')
  ?~  ship-str   (reply-err req-id 400 'poke.ship required')
  ?~  agent-str  (reply-err req-id 400 'poke.agent required')
  ?~  mark-str   (reply-err req-id 400 'poke.mark required')
  =/  target-ship=(unit @p)  (slaw %p u.ship-str)
  ?~  target-ship  (reply-err req-id 400 'invalid poke.ship')
  ::  parse timer fields
  =/  cron=(unit cord)    (get-str obj 'cron')
  =/  period=(unit @ud)   (get-ud obj 'period')
  ?~  cron    (reply-err req-id 400 'required: cron (str)')
  ?~  period  (reply-err req-id 400 'required: period (ud seconds)')
  =/  tid=@ud  next-id.state
  =.  next-id.state  +(tid)
  =/  ps=poke-spec:c
    [ship=u.target-ship agent=`@tas``@`u.agent-str mark=`@tas``@`u.mark-str body=body-str]
  =/  =timer:c
    :*  id=tid
        poke=ps
        cron=u.cron
        period=u.period
        active=%.y
        created=now.bowl
        version=0
    ==
  =.  timers.state  (~(put by timers.state) tid timer)
  =/  next=time  (add now.bowl (mul ~s1 u.period))
  =.  cor  (emit [%pass ~[%timer (scot %ud tid) (scot %ud 0)] %arvo %b %wait next])
  (reply-json req-id 201 (enjs-timer timer))
::
++  update-timer
  |=  [req-id=@ta raw=knot =inbound-request:eyre]
  ^+  cor
  =/  tid=(unit @ud)  (slaw %ud raw)
  ?~  tid  (reply-err req-id 400 'invalid timer id')
  ?~  old=(~(get by timers.state) u.tid)
    (reply-err req-id 404 'timer not found')
  ?~  body.request.inbound-request  (reply-err req-id 400 'missing body')
  =/  parsed=(unit json)  (de:json:html q.u.body.request.inbound-request)
  ?~  parsed  (reply-err req-id 400 'invalid json')
  ?.  ?=(%o -.u.parsed)  (reply-err req-id 400 'expected object')
  =/  obj  p.u.parsed
  ::  merge poke spec with existing
  =/  old-ps=poke-spec:c  poke.u.old
  =/  new-ps=poke-spec:c
    =/  poke-json=(unit json)  (~(get by obj) 'poke')
    ?~  poke-json  old-ps
    ?.  ?=(%o -.u.poke-json)  old-ps
    =/  pobj  p.u.poke-json
    =/  s=(unit cord)  (get-str pobj 'ship')
    =/  a=(unit cord)  (get-str pobj 'agent')
    =/  m=(unit cord)  (get-str pobj 'mark')
    =/  b=(unit cord)  (get-str pobj 'body')
    :*  ship=(fall (bind s |=(c=cord (fall (slaw %p c) ship.old-ps))) ship.old-ps)
        agent=?~(a agent.old-ps `@tas``@`u.a)
        mark=?~(m mark.old-ps `@tas``@`u.m)
        body=(fall b body.old-ps)
    ==
  ::  merge timer fields
  =/  new-cron=cord     (fall (get-str obj 'cron') cron.u.old)
  =/  new-period=@ud    (fall (get-ud obj 'period') period.u.old)
  =/  new-active=?      (fall (get-bool obj 'active') active.u.old)
  =/  next-ver=@ud      (add version.u.old 1)
  =/  updated=timer:c
    :*  id=id.u.old
        poke=new-ps
        cron=new-cron
        period=new-period
        active=new-active
        created=created.u.old
        version=next-ver
    ==
  =.  timers.state  (~(put by timers.state) id.u.old updated)
  =?  cor  new-active
    =/  next=time  (add now.bowl (mul ~s1 new-period))
    (emit [%pass ~[%timer (scot %ud id.u.old) (scot %ud next-ver)] %arvo %b %wait next])
  (reply-json req-id 200 (enjs-timer updated))
::
++  delete-timer
  |=  [req-id=@ta raw=knot]
  ^+  cor
  =/  tid=(unit @ud)  (slaw %ud raw)
  ?~  tid  (reply-err req-id 400 'invalid timer id')
  ?.  (~(has by timers.state) u.tid)
    (reply-err req-id 404 'timer not found')
  =.  timers.state  (~(del by timers.state) u.tid)
  (reply req-id 204 ~ ~)
::
::  +enjs-timer: encode a timer as a JSON object
::
++  enjs-timer
  |=  t=timer:c
  ^-  json
  =,  enjs:format
  %-  pairs
  :~  ['id' (numb id.t)]
      ['poke' (enjs-poke-spec poke.t)]
      ['cron' s+cron.t]
      ['period' (numb period.t)]
      ['active' b+active.t]
      ['created' s+(scot %da created.t)]
      ['version' (numb version.t)]
  ==
::
::  +enjs-poke-spec: encode a poke spec as a JSON object
::
++  enjs-poke-spec
  |=  ps=poke-spec:c
  ^-  json
  =,  enjs:format
  %-  pairs
  :~  ['ship' s+(scot %p ship.ps)]
      ['agent' s+agent.ps]
      ['mark' s+mark.ps]
      ['body' s+body.ps]
  ==
::
::  +get-str: extract a string field from a JSON object map
::
++  get-str
  |=  [obj=(map @t json) key=@t]
  ^-  (unit cord)
  ?~  v=(~(get by obj) key)  ~
  ?.  ?=(%s -.u.v)  ~
  `p.u.v
::
::  +get-ud: extract an unsigned integer field from a JSON object map
::
++  get-ud
  |=  [obj=(map @t json) key=@t]
  ^-  (unit @ud)
  ?~  v=(~(get by obj) key)  ~
  ?.  ?=(%n -.u.v)  ~
  (rush p.u.v dum:ag)
::
::  +get-bool: extract a boolean field from a JSON object map
::
++  get-bool
  |=  [obj=(map @t json) key=@t]
  ^-  (unit ?)
  ?~  v=(~(get by obj) key)  ~
  ?.  ?=(%b -.u.v)  ~
  `p.u.v
::
::  +fill-body: replace {now} in body with current time
::
++  fill-body
  |=  [bod=@t now=time]
  ^-  @t
  =/  hay=tape  (trip bod)
  =/  ned=tape  (trip '{now}')
  =/  rep=tape  (trip (scot %da now))
  (crip (sub-tape hay ned rep))
::
::  +sub-tape: replace first occurrence of needle in haystack
::
++  sub-tape
  |=  [hay=tape ned=tape rep=tape]
  ^-  tape
  =/  ned-len=@ud  (lent ned)
  =/  out=tape  ~
  |-  ^+  out
  ?~  hay  out
  ?.  =(ned (scag ned-len `tape`hay))
    $(hay t.hay, out (snoc out i.hay))
  (weld (weld out rep) (slag ned-len `tape`hay))
::
::  +reply-json: send a JSON HTTP response
::
++  reply-json
  |=  [req-id=@ta status=@ud =json]
  ^+  cor
  =/  body=cord  (en:json:html json)
  =/  =simple-payload:http
    :-  [status ~[['content-type' 'application/json']]]
    `(as-octs:mimes:html body)
  (emit-list (give-simple-payload:app:server req-id simple-payload))
::
::  +reply-err: send a JSON error response
::
++  reply-err
  |=  [req-id=@ta status=@ud msg=cord]
  ^+  cor
  =/  err=json
    (pairs:enjs:format ~[['error' s+msg]])
  (reply-json req-id status err)
::
::  +reply: send a raw HTTP response
::
++  reply
  |=  [req-id=@ta status=@ud headers=(unit header-list:http) body=(unit octs)]
  ^+  cor
  =/  =simple-payload:http
    [[status (fall headers ~)] body]
  (emit-list (give-simple-payload:app:server req-id simple-payload))
--

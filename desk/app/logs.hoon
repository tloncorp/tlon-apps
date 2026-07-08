::  logs: gather log events and submit reports
::
/+  l=logs
/+  default-agent, dbug
::
/*  commit  %txt  /commit/txt
::
=>
  |%
  +$  card  card:agent:gall
  +$  current-state
    $:  %2
          volume=(unit volume:v1:l)  ::  volume threshold
          otel=(unit @t)             ::  open telemetry endpoint
    ==
  ::
  ++  commit  ?~(^commit 'unknown' -.^commit)
  --
%-  agent:dbug
^-  agent:gall
=|  current-state
=*  state  -
=<
  |_  =bowl:gall
  +*  this  .
      def  ~(. (default-agent this %|) bowl)
      cor  ~(. +> [bowl ~])
  ::
  ++  on-init
    ^-  (quip card _this)
    `this(volume `%info)
  ++  on-save  !>(state)
  ++  on-load
    |=  =vase
    ^-  (quip card _this)
    =^  cards  state
      abet:(load:cor vase)
    [cards this]
  ::
  ++  on-poke
    |=  [=mark =vase]
    ^-  (quip card _this)
    =^  cards  state
      abet:(poke:cor mark vase)
    [cards this]
  ++  on-watch  on-watch:def
  ++  on-peek  on-peek:def
  ++  on-leave  on-leave:def
  ++  on-agent  on-agent:def
  ++  on-arvo
    |=  [=wire =sign-arvo]
    =^  cards  state
      abet:(arvo:cor wire sign-arvo)
    [cards this]
  ++  on-fail  on-fail:def
  --
::
|_  [=bowl:gall cards=(list card)]
++  cor  .
++  abet  [(flop cards) state]
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
::
++  send-posthog-event
  |=  [origin=path =time =log-event:l =log-data:l]
  ^+  cor
  =/  fard=(fyrd:khan cage)
    [q.byk.bowl %posthog noun+!>(`[origin [time log-event] log-data])]
  ::
  (emit %pass /send/posthog [%arvo %k %fard fard])
::  +send-otel-event: send open telemetry event
::
++  send-otel-event
  |=  [otel=@t origin=path =time =log-event:l =log-data:l]
  ^+  cor
  =/  fard=(fyrd:khan cage)
    [q.byk.bowl %send-otel noun+!>(`[otel origin [time log-event] log-data])]
  ::
  (emit %pass /send/otel [%arvo %k %fard fard])
::
++  load
  |^  |=  =vase
  ^+  cor
  =+  !<(old=any-state vase)
  =?  old  ?=(~ old)  state-0-to-1
  =?  old  ?=(%1 -.old)  (state-1-to-2 old)
  ?>  ?=(%2 -.old)
  =.  state  old
  cor
  +$  any-state  ?(state-0 state-1 state-2)
  +$  state-0  ~
  +$  state-1
    $:  %1
          posthog=(unit volume:v0:l)
    ==
  +$  state-2  current-state
  ::
  ++  state-0-to-1
    [%1 `%info]
  ++  state-1-to-2
    |=  =state-1
    ^-  state-2
    [%2 (bind posthog.state-1 v1:volume:v0:conv:l) ~]
  --
::
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?>  =(our src):bowl
  ?+    mark  ~|(bad-mark+mark !!)
      %log-action-1
    =+  !<(=a-log:v1:l vase)
    ?-    -.a-log
        %log
      =+  vol=volume  ::TMI
      ?:  ?=(~ vol)  cor
      =/  level=@ud
        ?-  -.event.a-log
          %fail  (volume-val:l vol.event.a-log)
          %tell  (volume-val:l vol.event.a-log)
        ==
      ?.  (gte level (volume-val:l u.vol))
        cor
      =.  data.a-log  ['commit'^s+commit data.a-log]
      =.  cor  (send-posthog-event sap.bowl now.bowl +.a-log)
      =?  cor  ?=(^ otel)
        (send-otel-event u.otel sap.bowl now.bowl +.a-log)
      cor
    ::
        %set-volume
      cor(volume vol.a-log)
    ::
        %set-otel
      cor(otel url.a-log)
    ==
  ==
::
++  arvo
  |=  [=(pole knot) =sign-arvo]
  ?+    pole  ~|(bad-arvo-wire+pole !!)
      [%send %posthog ~]
    ?>  ?=([%khan %arow *] sign-arvo)
    =/  =(avow:khan cage)  p.sign-arvo
    ?:  ?=(%| -.avow)
      %-  (slog tang.p.avow)
      cor
    =/  =cage  p.avow
    =+  !<(response=(unit client-response:iris) q.cage)
    ?~  response
      ((slog leaf+"logs: failed to submit event to posthog" ~) cor)
    ?.  ?=(%finished -.u.response)
      ~|(bad-client-response+u.response !!)
    =*  status-code  status-code.response-header.u.response
    ?:  !=(200 status-code)
      %-  (slog leaf+"logs: failed to submit event to posthog: {<status-code>}" ~)
      cor
    cor
  ::
      [%send %otel ~]
    ?>  ?=([%khan %arow *] sign-arvo)
    =/  =(avow:khan cage)  p.sign-arvo
    ?:  ?=(%| -.avow)
      %-  (slog tang.p.avow)
      cor
    =/  =cage  p.avow
    =+  !<(response=(unit client-response:iris) q.cage)
    ?~  response
      ((slog leaf+"logs: failed to submit event to otel provider" ~) cor)
    ?.  ?=(%finished -.u.response)
      ~|(bad-client-response+u.response !!)
    =*  status-code  status-code.response-header.u.response
    ?:  !=(200 status-code)
      %-  (slog leaf+"logs: failed to submit event to otel provider: {<status-code>}" ~)
      cor
    cor
  ==
--

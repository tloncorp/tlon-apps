::  logs: gather log events and submit reports
::
/-  l=logs
/+  default-agent
=>
  |%
  +$  card  card:agent:gall
  +$  current-state  [%0 ~]
  --
=|  current-state
=*  state  -
^-  agent:gall
=<
  |_  =bowl:gall
  +*  this  .
      def  ~(. (default-agent this %|) bowl)
      cor  ~(. +> [bowl ~])
  ::
  ++  on-init  on-init:def
  ++  on-save  on-save:def
  ++  on-load  on-load:def
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
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
::
++  send-posthog-event
  |=  [origin=path =time =log-event:l]
  ^+  cor
  =/  fard=(fyrd:khan cage)
    [q.byk.bowl %posthog noun+!>(`[origin time log-event])]
  ::
  (emit %pass /posthog [%arvo %k %fard fard])
::
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?>  =(our src):bowl
  ?+    mark  ~|(bad-mark+mark !!)
      %log-action
    =+  !<(=a-log:l vase)
    ?-    -.a-log
        %log
      (send-posthog-event sap.bowl now.bowl +.a-log)
    ==
  ==
::
++  arvo
  |=  [=(pole knot) =sign-arvo]
  ?+    pole  ~|(bad-arvo-wire+pole !!)
      ::  /posthog
      ::
      [%posthog ~]
    ?>  ?=([%khan %arow *] sign-arvo)
    =/  =(avow:khan cage)  p.sign-arvo
    ?:  ?=(%| -.avow)
      %-  (slog tang.p.avow)
      cor
    =/  =cage  p.avow
    =+  !<(response=(unit client-response:iris) q.cage)
    ?~  response
      ((slog leaf+"logs: failed to submit event" ~) cor)
    ?.  ?=(%finished -.u.response)
      ~|(bad-client-response+u.response !!)
    =*  status-code  status-code.response-header.u.response
    ?:  !=(200 status-code)
      %-  (slog leaf+"logs: failed to submit event" ~)
      cor
    cor
  ==
--

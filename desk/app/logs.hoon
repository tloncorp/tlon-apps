::  logs: gather log events and submit reports
::
/-  l=logs
/+  default-agent
=>
  |%
  +$  card  card:agent:gall
  +$  current-state  [%0 =logs:l]
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
++  tick  ^~((div ~s1 (bex 16)))
++  add-log-event
  |=  [agent=@tas =log-event:l]
  ^-  [id-event:l _logs]
  =/  =log:l
    (fall (~(get by logs) agent) ~)
  =/  =id-event:l
    |-
    ?.  (has:on-log:l log now.bowl)  now.bowl
    $(now.bowl (add now.bowl tick))
  :-  id-event
  %+  ~(put by logs)  agent
  (put:on-log:l log id-event log-event)
::
++  send-posthog-event
  |=  [agent=@tas =id-event:l =log-event:l]
  ^+  cor
  =/  fard=(fyrd:khan cage)
    [q.byk.bowl %posthog noun+!>(`[agent ^-(log-item:l [id-event log-event])])]
  ::
  %^  emit  %pass
    /posthog/[agent]/(scot %da id-event)
  [%arvo ^-(note-arvo [%k %fard fard])]
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
      ?>  ?=([@ @ ~] sap.bowl)
      =+  agent=i.t.sap.bowl
      =^  id-event  logs  (add-log-event agent +.a-log)
      (send-posthog-event agent id-event +.a-log)
    ==
  ==
::
++  arvo
  |=  [=(pole knot) =sign-arvo]
  ?+    pole  ~|(bad-arvo-wire+pole !!)
      ::  /posthog/agent/id-event
      ::
      [%posthog agent=@tas id-event=@da ~]
    ?~  id-event=(slaw %da id-event.pole)
      ~|(evil-arvo-wire+pole !!)
    ?>  ?=([%khan %arow *] sign-arvo)
    =/  =(avow:khan cage)  p.sign-arvo
    ?:  ?=(%| -.avow)
      %-  (slog tang.p.avow)
      cor
    =/  =cage  p.avow
    =+  !<(response=(unit client-response:iris) q.cage)
    ?~  response
      ((slog leaf+"failed to submit event {<`@da`u.id-event>}" ~) cor)
    ?.  ?=(%finished -.u.response)
      ~|(bad-client-response+u.response !!)
    =*  status-code  status-code.response-header.u.response
    ?:  !=(200 status-code)
      %-  (slog leaf+"failed to submit event {<`@da`u.id-event>} to posthog" ~)
      cor
    ~&  posthog-log-ok+`@da`u.id-event
    cor
  ==
--

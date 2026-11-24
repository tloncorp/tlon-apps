::  Exercise the durable transport through test-agent; its cards are
::  inspected, never delivered.
/-  ac=acp
/+  *test-agent
/=  transport  /app/acp
|%
++  t0  ~2026.10.1
::  do-init resets the bowl, so the clock is set after it.
::
++  setup
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod)))
  ;<  *  bind:m  (do-init %acp transport)
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now t0)))
  (pure:m ~)
::
++  do-action
  |=  action=action:v1:ac
  (do-poke %acp-action-1 !>(action))
::
++  ex-update
  |=  [=path =update:v1:ac]
  (ex-fact ~[path] %acp-update-1 !>(update))
::
++  get-connections
  =/  m  (mare ,(map connection-id:v1:ac connection:v1:ac))
  ^-  form:m
  ;<  =vase  bind:m  get-save
  =/  state
    !<([%0 connections=(map connection-id:v1:ac connection:v1:ac)] vase)
  (pure:m connections.state)
::
++  test-ordered-replay-and-cumulative-acknowledgements
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  messages=(list message:v1:ac)
    ~[[1 t0 'one'] [2 t0 'two']]
  ;<  ~                bind:m  setup
  ;<  *                bind:m  (do-action [%open 'fixture'])
  ;<  one=(list card)  bind:m  (do-action [%send 'fixture' %agent 'one'])
  ;<  ~                bind:m
    %+  ex-cards  one
    :~  (ex-update /v1/fixture/agent [%messages 'fixture' %agent ~[(snag 0 messages)]])
        (ex-update /v1/agent [%messages 'fixture' %agent ~[(snag 0 messages)]])
    ==
  ;<  *                bind:m  (do-action [%send 'fixture' %agent 'two'])
  ;<  caz=(list card)  bind:m  (do-action [%send 'fixture' %client 'reply'])
  ;<  ~                bind:m
    %+  ex-cards  caz
    :~  (ex-update /v1/fixture/client [%messages 'fixture' %client ~[[1 t0 'reply']]])
    ==
  ;<  caz=(list card)  bind:m  (do-watch /v1/fixture/agent)
  ;<  ~                bind:m
    %+  ex-cards  caz
    :~  (ex-update /v1/fixture/agent [%connection 'fixture' & ~])
        (ex-update /v1/fixture/agent [%messages 'fixture' %agent messages])
    ==
  ;<  caz=(list card)  bind:m  (do-watch /v1/agent)
  ;<  ~                bind:m
    (ex-cards caz (ex-update /v1/agent [%messages 'fixture' %agent messages]) ~)
  ;<  caz=(list card)  bind:m  (do-action [%ack 'fixture' %agent 1])
  ;<  ~                bind:m  (ex-cards caz ~)
  ::  Re-subscribing replays only what is still unacknowledged.
  ;<  *                bind:m  (do-leave /v1/fixture/agent)
  ;<  caz=(list card)  bind:m  (do-watch /v1/fixture/agent)
  ;<  ~                bind:m
    %+  ex-cards  caz
    :~  (ex-update /v1/fixture/agent [%connection 'fixture' & ~])
        (ex-update /v1/fixture/agent [%messages 'fixture' %agent (slag 1 messages)])
    ==
  ;<  connections=(map connection-id:v1:ac connection:v1:ac)  bind:m
    get-connections
  =/  connection  (~(got by connections) 'fixture')
  ;<  ~  bind:m
    (ex-equal !>([next-to-client.connection next-to-agent.connection]) !>([2 3]))
  %+  ex-equal
    !>([~(wyt by to-client.connection) ~(wyt by to-agent.connection)])
  !>([1 1])
::
++  test-close-retains-queued-messages-until-acknowledged
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~                bind:m  setup
  ;<  *                bind:m  (do-action [%open 'fixture'])
  ;<  *                bind:m  (do-action [%send 'fixture' %client 'pending'])
  ;<  caz=(list card)  bind:m  (do-action [%close 'fixture' 'done'])
  ;<  ~                bind:m
    %+  ex-cards  caz
    :~  (ex-update /v1/fixture/client [%connection 'fixture' | `'done'])
        (ex-update /v1/fixture/agent [%connection 'fixture' | `'done'])
    ==
  ;<  caz=(list card)  bind:m  (do-action [%close 'fixture' 'done'])
  ;<  ~                bind:m  (ex-cards caz ~)
  ::  A closed connection with a queued message can't be dropped or sent to.
  ;<  ~  bind:m  (ex-fail (do-action [%drop 'fixture']))
  ;<  ~  bind:m  (ex-fail (do-action [%send 'fixture' %client 'later']))
  ;<  *  bind:m  (do-action [%ack 'fixture' %client 1])
  ;<  *  bind:m  (do-action [%drop 'fixture'])
  ;<  connections=(map connection-id:v1:ac connection:v1:ac)  bind:m
    get-connections
  (ex-equal !>(~(wyt by connections)) !>(0))
::
++  test-transport-rejects-remote-and-invalid-admission
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (ex-fail ((do-as ~nec) (do-action [%open 'fixture'])))
  ;<  ~  bind:m  (ex-fail (do-action [%open 'Bad ID']))
  (ex-fail (do-action [%send 'missing' %agent 'payload']))
--

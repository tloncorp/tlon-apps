::  acp: generic ship-side transport for Agent Client Protocol
::
::    ACP is bidirectional JSON-RPC. This agent deliberately treats every
::    envelope as opaque NDJSON text so protocol negotiation, extensions, and
::    future versions pass through unchanged. It provides durable ordered queues;
::    a local process only has to translate Eyre subscribe/poke traffic to
::    the adapter's newline-delimited stdio stream.
::
/-  ac=acp
/+  default-agent, dbug, queue-budget=harness-acp-queue
|%
+$  card  card:agent:gall
+$  state-0  [%0 connections=(map connection-id:v1:ac connection:v1:ac)]
++  max-connections  256
++  max-payload-bytes  1.048.576
++  max-id-bytes  128
--
%-  agent:dbug
=|  state-0
=*  state  -
^-  agent:gall
=<
  |_  =bowl:gall
  +*  this  .
      def  ~(. (default-agent this %.n) bowl)
      cor  ~(. +> [bowl ~])
  ++  on-init  `this
  ++  on-save  !>(state)
  ++  on-load
    |=  old=vase
    ^-  (quip card _this)
    `this(state !<(state-0 old))
  ++  on-poke
    |=  [=mark =vase]
    ^-  (quip card _this)
    =^  cards  state  abet:(poke:cor mark vase)
    [cards this]
  ++  on-watch
    |=  =path
    ^-  (quip card _this)
    ?>  =(src our):bowl
    =^  cards  state  abet:(watch:cor path)
    [cards this]
  ++  on-peek
    |=  =path
    ^-  (unit (unit cage))
    ?>  =(src our):bowl
    (peek:cor path)
  ++  on-agent  |=([=wire =sign:agent:gall] `this)
  ++  on-arvo  |=([=wire sign=sign-arvo] `this)
  ++  on-leave  |=(path `this)
  ++  on-fail
    |=  [=term =tang]
    ^-  (quip card _this)
    %-  (slog 'acp: on-fail' >term< tang)
    [~ this]
  --
|_  [=bowl:gall cards=(list card)]
++  cor  .
++  abet  [(flop cards) state]
++  emit  |=(=card cor(cards [card cards]))
++  give  |=(=gift:agent:gall (emit %give gift))
::
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?>  =(src.bowl our.bowl)
  ?>  =(%acp-action-1 mark)
  =+  !<(=action:v1:ac vase)
  ?-  -.action
    %open  (open connection.action)
    %send  (send connection.action target.action payload.action)
    %ack  (ack connection.action target.action through.action)
    %close  (close connection.action reason.action)
    %drop  (drop connection.action)
  ==
::
++  watch
  |=  =path
  ^+  cor
  ?+  path  ~|(bad-acp-watch-path+path !!)
      [%v1 %agent ~]
    %+  roll  ~(tap by connections.state)
    |=  [[id=connection-id:v1:ac connection=connection:v1:ac] result=_cor]
    =/  messages  (queued connection %agent)
    ?~  messages  result
    (give-agent-update:result [%messages id %agent messages])
      ::
      [%v1 @ ?(%client %agent) ~]
    =/  id=connection-id:v1:ac  i.t.path
    =/  target=peer:v1:ac  i.t.t.path
    =/  connection  (~(get by connections.state) id)
    ?~  connection  ~|(unknown-acp-connection+id !!)
    =/  reason  ?~(closed.u.connection ~ `reason.u.closed.u.connection)
    =.  cor  (give-update [%connection id open.u.connection reason] id target)
    (give-update [%messages id target (queued u.connection target)] id target)
  ==
::
++  peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  [~ ~]
      [%x %v1 @ ?(%client %agent) ~]
    =/  id=connection-id:v1:ac  i.t.t.path
    =/  target=peer:v1:ac  i.t.t.t.path
    =/  connection  (~(get by connections.state) id)
    ?~  connection  [~ ~]
    ``acp-update-1+!>(`update:v1:ac`[%messages id target (queued u.connection target)])
  ==
::
++  give-update
  |=  [=update:v1:ac id=connection-id:v1:ac target=peer:v1:ac]
  ^+  cor
  (give %fact ~[/v1/[id]/[target]] %acp-update-1 !>(update))
++  give-agent-update
  |=  update=update:v1:ac
  ^+  cor
  (give %fact ~[/v1/agent] %acp-update-1 !>(update))
::
++  give-connection
  |=  [id=connection-id:v1:ac open=? reason=(unit @t)]
  ^+  cor
  =.  cor  (give-update [%connection id open reason] id %client)
  (give-update [%connection id open reason] id %agent)
::
++  open
  |=  id=connection-id:v1:ac
  ^+  cor
  ?>  (valid-id id)
  =.  connections.state  (trim-closed connections.state)
  =/  found  (~(get by connections.state) id)
  ?^  found
    ?>  open.u.found
    (give-connection id & ~)
  ?>  (lth ~(wyt by connections.state) max-connections)
  =/  =connection:v1:ac  [& now.bowl ~ 1 1 ~ ~]
  =.  connections.state  (~(put by connections.state) id connection)
  (give-connection id & ~)
::
++  trim-closed
  |=  connections=(map connection-id:v1:ac connection:v1:ac)
  ^-  (map connection-id:v1:ac connection:v1:ac)
  %+  roll  ~(tap by connections)
  |=  $:  [id=connection-id:v1:ac connection=connection:v1:ac]
          kept=(map connection-id:v1:ac connection:v1:ac)
      ==
  ?:(open.connection (~(put by kept) id connection) kept)
::
++  valid-id
  |=  id=connection-id:v1:ac
  ^-  ?
  =/  chars  (trip id)
  ?&  (gte (lent chars) 1)
      (lte (lent chars) max-id-bytes)
      %+  levy  chars
      |=  char=@tD
      ?|  &((gte char 'a') (lte char 'z'))
          &((gte char '0') (lte char '9'))
          =('-' char)
      ==
  ==
::
++  send
  |=  [id=connection-id:v1:ac target=peer:v1:ac payload=@t]
  ^+  cor
  ?>  (lte (met 3 payload) max-payload-bytes)
  =/  found  (~(get by connections.state) id)
  ?~  found  ~|(unknown-acp-connection+id !!)
  ?>  open.u.found
  ~|  acp-queue-capacity+id
  ?>  (room:queue-budget connections.state id target payload)
  =/  sequence  ?:(=(target %client) next-to-client.u.found next-to-agent.u.found)
  =/  =message:v1:ac  [sequence now.bowl payload]
  =/  =connection:v1:ac  u.found
  =.  connection
    ?:  =(target %client)
      %=  connection
        to-client  (~(put by to-client.connection) sequence message)
        next-to-client  +(sequence)
      ==
    %=  connection
      to-agent  (~(put by to-agent.connection) sequence message)
      next-to-agent  +(sequence)
    ==
  =.  connections.state  (~(put by connections.state) id connection)
  =/  =update:v1:ac  [%messages id target ~[message]]
  =.  cor  (give-update update id target)
  ::  The harness receives agent-bound traffic from the shared subscription.
  ?:  =(target %client)  cor
  (give-agent-update update)
::
++  ack
  |=  [id=connection-id:v1:ac target=peer:v1:ac through=@ud]
  ^+  cor
  =/  found  (~(get by connections.state) id)
  ?~  found  ~|(unknown-acp-connection+id !!)
  =/  =connection:v1:ac  u.found
  =.  connection
    ?:  =(target %client)
      connection(to-client (drop-through to-client.connection through))
    connection(to-agent (drop-through to-agent.connection through))
  cor(connections.state (~(put by connections.state) id connection))
::
++  close
  |=  [id=connection-id:v1:ac reason=@t]
  ^+  cor
  =/  found  (~(get by connections.state) id)
  ?~  found  ~|(unknown-acp-connection+id !!)
  ?.  open.u.found  cor
  =/  connection  u.found(open |, closed `[now.bowl reason])
  =.  connections.state  (~(put by connections.state) id connection)
  (give-connection id | `reason)
::
++  drop
  |=  id=connection-id:v1:ac
  ^+  cor
  =/  found  (~(get by connections.state) id)
  ?~  found  cor
  ?>  ?&  =(open.u.found |)
          =(~ to-client.u.found)
          =(~ to-agent.u.found)
      ==
  cor(connections.state (~(del by connections.state) id))
::
++  queued
  |=  [connection=connection:v1:ac target=peer:v1:ac]
  ^-  (list message:v1:ac)
  =/  queue  ?:(=(target %client) to-client.connection to-agent.connection)
  ::  Map traversal is hash-ordered; delivery follows sequence numbers.
  =/  sorted
    %+  sort  ~(tap by queue)
    |=  [a=[@ud message:v1:ac] b=[@ud message:v1:ac]]
    (lth -.a -.b)
  (turn sorted |=([@ud message=message:v1:ac] message))
::
++  drop-through
  |=  [queue=(map @ud message:v1:ac) through=@ud]
  ^-  (map @ud message:v1:ac)
  %+  roll  ~(tap by queue)
  |=  [[sequence=@ud message=message:v1:ac] result=(map @ud message:v1:ac)]
  ?:  (lte sequence through)  result
  (~(put by result) sequence message)
--

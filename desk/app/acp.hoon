::  acp: generic ship-side transport for Agent Client Protocol
::
::    ACP is bidirectional JSON-RPC. This agent deliberately treats every
::    envelope as opaque NDJSON text so protocol negotiation, extensions, and
::    future versions pass through unchanged. It provides durable ordered queues;
::    a local process only has to translate Eyre subscribe/poke traffic to
::    the adapter's newline-delimited stdio stream.
::
/-  ac=acp
/+  default-agent, verb, dbug
|%
+$  card  card:agent:gall
+$  state-0  [%0 connections=(map connection-id:v1:ac connection:v1:ac)]
++  max-connections       32
++  max-queued-per-peer   10.000
++  max-payload-bytes     1.048.576
--
=|  state-0
=*  state  -
%-  agent:dbug
%^  verb  |  %warn
^-  agent:gall
=<
  |_  =bowl:gall
  +*  this  .
      def   ~(. (default-agent this %.n) bowl)
      cor   ~(. +> [bowl ~])
  ++  on-init  `this
  ++  on-save  !>(state)
  ++  on-load
    |=  old=vase
    ^-  (quip card _this)
    =/  attempt  (mule |.(!<(state-0 old)))
    ?:  ?=(%& -.attempt)  `this(state p.attempt)
    %-  (slog 'acp: incompatible pre-release state, resetting queues' ~)
    `this
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
  ++  on-arvo   |=([=wire sign=sign-arvo] `this)
  ++  on-leave  |=(path `this)
  ++  on-fail
    |=  [=term =tang]
    ^-  (quip card _this)
    %-  (slog 'acp: on-fail' >term< tang)
    [~ this]
  --
|_  [=bowl:gall cards=(list card)]
++  cor   .
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
    %open   (open connection.action)
    %send   (send connection.action target.action payload.action)
    %ack    (ack connection.action target.action through.action)
    %close  (close connection.action reason.action)
    %drop   (drop connection.action)
  ==
::
++  watch
  |=  =path
  ^+  cor
  ?+  path  ~|(bad-acp-watch-path+path !!)
    [%v1 @ ?(%client %agent) ~]
      =/  id=connection-id:v1:ac  i.t.path
      =/  target=peer:v1:ac  i.t.t.path
      =/  con  (~(get by connections.state) id)
      ?~  con  ~|(unknown-acp-connection+id !!)
      =.  cor  (give-update [%connection id open.u.con ?~(closed.u.con ~ `reason.u.closed.u.con)] id target)
      (give-update [%messages id target (queued u.con target)] id target)
  ==
::
++  peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  [~ ~]
      [%x %v1 @ ?(%client %agent) ~]
    =/  id=connection-id:v1:ac  i.t.t.path
    =/  target=peer:v1:ac  i.t.t.t.path
    =/  con  (~(get by connections.state) id)
    ?~  con  [~ ~]
    ``acp-update-1+!>(`update:v1:ac`[%messages id target (queued u.con target)])
  ==
::
++  give-update
  |=  [=update:v1:ac id=connection-id:v1:ac target=peer:v1:ac]
  ^+  cor
  (give %fact ~[/v1/[id]/[target]] %acp-update-1 !>(update))
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
  =/  old  (~(get by connections.state) id)
  ?^  old
    ?>  open.u.old
    (give-connection id & ~)
  ?>  (lth ~(wyt by connections.state) max-connections)
  =/  con=connection:v1:ac  [& now.bowl ~ 1 1 ~ ~]
  =.  connections.state  (~(put by connections.state) id con)
  (give-connection id & ~)
::
++  send
  |=  [id=connection-id:v1:ac target=peer:v1:ac payload=@t]
  ^+  cor
  ?>  (lte (met 3 payload) max-payload-bytes)
  =/  old  (~(get by connections.state) id)
  ?~  old  ~|(unknown-acp-connection+id !!)
  ?>  open.u.old
  =/  seq  ?:(=(target %client) next-to-client.u.old next-to-agent.u.old)
  =/  msg=message:v1:ac  [seq now.bowl payload]
  =/  con=connection:v1:ac  u.old
  ?:  =(target %client)
    ?>  (lth ~(wyt by to-client.con) max-queued-per-peer)
    =.  to-client.con  (~(put by to-client.con) seq msg)
    =.  next-to-client.con  +(seq)
    =.  connections.state  (~(put by connections.state) id con)
    (give-update [%messages id target ~[msg]] id target)
  ?>  (lth ~(wyt by to-agent.con) max-queued-per-peer)
  =.  to-agent.con  (~(put by to-agent.con) seq msg)
  =.  next-to-agent.con  +(seq)
  =.  connections.state  (~(put by connections.state) id con)
  (give-update [%messages id target ~[msg]] id target)
::
++  ack
  |=  [id=connection-id:v1:ac target=peer:v1:ac through=@ud]
  ^+  cor
  =/  old  (~(get by connections.state) id)
  ?~  old  ~|(unknown-acp-connection+id !!)
  =/  con=connection:v1:ac  u.old
  ?:  =(target %client)
    =.  to-client.con  (drop-through to-client.con through)
    =.  connections.state  (~(put by connections.state) id con)
    cor
  =.  to-agent.con  (drop-through to-agent.con through)
  =.  connections.state  (~(put by connections.state) id con)
  cor
::
++  close
  |=  [id=connection-id:v1:ac reason=@t]
  ^+  cor
  =/  old  (~(get by connections.state) id)
  ?~  old  ~|(unknown-acp-connection+id !!)
  ?.  open.u.old  cor
  =/  con  u.old(open |, closed `[now.bowl reason])
  =.  connections.state  (~(put by connections.state) id con)
  (give-connection id | `reason)
::
++  drop
  |=  id=connection-id:v1:ac
  ^+  cor
  =/  old  (~(get by connections.state) id)
  ?~  old  cor
  ?>  ?&  =(open.u.old |)
          =(~ to-client.u.old)
          =(~ to-agent.u.old)
      ==
  cor(connections.state (~(del by connections.state) id))
::
++  queued
  |=  [con=connection:v1:ac target=peer:v1:ac]
  ^-  (list message:v1:ac)
  =/  queue  ?:(=(target %client) to-client.con to-agent.con)
  =/  sorted
    %+  sort  ~(tap by queue)
    |=  [a=[@ud message:v1:ac] b=[@ud message:v1:ac]]
    (lth -.a -.b)
  (turn sorted |=([@ud msg=message:v1:ac] msg))
::
++  drop-through
  |=  [queue=(map @ud message:v1:ac) through=@ud]
  ^-  (map @ud message:v1:ac)
  %+  roll  ~(tap by queue)
  |=  [[seq=@ud msg=message:v1:ac] acc=(map @ud message:v1:ac)]
  ?:  (lte seq through)  acc
  (~(put by acc) seq msg)
--

::  tests for the generic %acp duplex transport
::
/-  a=acp
/+  *test-agent
/=  agent  /app/acp
|%
++  dap  %acp
+$  state-0  [%0 connections=(map connection-id:v1:a connection:v1:a)]
++  payload-a  '{"jsonrpc":"2.0","id":0,"method":"initialize"}'
++  payload-b  '{"jsonrpc":"2.0","id":0,"result":{"protocolVersion":1}}'
::
++  setup
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~dev)))
  ;<  *  bind:m  (do-init dap agent)
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now ~2026.7.22)))
  (pure:m ~)
::
++  open
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (do-poke %acp-action-1 !>(`action:v1:a`[%open 'conn-1']))
  (pure:m ~)
::
++  test-open-creates-connection
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  open
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-0 !<(vase q.res))
  =/  con  (~(get by connections.st) 'conn-1')
  ?>  ?=(^ con)
  (ex-equal !>(open.u.con) !>(&))
::
++  test-client-to-agent-envelope-is-queued
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  open
  ;<  caz=(list card)  bind:m
    (do-poke %acp-action-1 !>(`action:v1:a`[%send 'conn-1' %agent payload-a]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  %-  ex-fact
        :*  ~[/v1/conn-1/agent]
            %acp-update-1
            !>(`update:v1:a`[%messages 'conn-1' %agent ~[[1 ~2026.7.22 payload-a]]])
        ==
    ==
  ;<  res=cage  bind:m  (got-peek /x/v1/conn-1/agent)
  (ex-equal q.res !>(`update:v1:a`[%messages 'conn-1' %agent ~[[1 ~2026.7.22 payload-a]]]))
::
++  test-directions-have-independent-sequences
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  open
  ;<  *  bind:m
    (do-poke %acp-action-1 !>(`action:v1:a`[%send 'conn-1' %agent payload-a]))
  ;<  *  bind:m
    (do-poke %acp-action-1 !>(`action:v1:a`[%send 'conn-1' %client payload-b]))
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-0 !<(vase q.res))
  =/  con  (~(get by connections.st) 'conn-1')
  ?>  ?=(^ con)
  ?:  ?&  =(~(wyt by to-agent.u.con) 1)
          =(~(wyt by to-client.u.con) 1)
          =(next-to-agent.u.con 2)
          =(next-to-client.u.con 2)
      ==
    (ex-equal !>(&) !>(&))
  (ex-equal !>(|) !>(&))
::
++  test-ack-is-cumulative-for-one-peer
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  open
  ;<  *  bind:m
    (do-poke %acp-action-1 !>(`action:v1:a`[%send 'conn-1' %agent payload-a]))
  ;<  *  bind:m
    (do-poke %acp-action-1 !>(`action:v1:a`[%send 'conn-1' %client payload-b]))
  ;<  *  bind:m
    (do-poke %acp-action-1 !>(`action:v1:a`[%ack 'conn-1' %agent 1]))
  ;<  res=cage  bind:m  (got-peek /x/dbug/state)
  =/  st  !<(state-0 !<(vase q.res))
  =/  con  (~(get by connections.st) 'conn-1')
  ?>  ?=(^ con)
  ?:  ?&  =(~ to-agent.u.con)
          =(~(wyt by to-client.u.con) 1)
      ==
    (ex-equal !>(&) !>(&))
  (ex-equal !>(|) !>(&))
::
++  test-close-rejects-new-messages
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  open
  ;<  *  bind:m
    (do-poke %acp-action-1 !>(`action:v1:a`[%close 'conn-1' 'adapter exited']))
  %-  ex-fail
  (do-poke %acp-action-1 !>(`action:v1:a`[%send 'conn-1' %agent payload-a]))
::
++  test-foreign-pokes-are-rejected
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  %-  ex-fail
  %-  (do-as ~zod)
  (do-poke %acp-action-1 !>(`action:v1:a`[%open 'conn-1']))
--

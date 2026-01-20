/-  spider, c=chat, ch=channels
/+  *ph-io, *ph-test
=,  strand=strand:spider
=>
|%
++  dm-message
  |=  [author=ship =time =verse:ch]
  ^-  diff:dm:c
  =/  =essay:c
    [[~[verse] author time] chat+/ ~ ~]
  [[author time] %add essay `time]
::
--
|%
++  ph-test-dm-init
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~bud/chat/v3 [~bud %chat] /v3)
  ;<  =bowl:strand  bind:m  get-bowl
  ::  ~zod greets ~bud with a message
  ::
  =/  =verse:ch  [%inline ~['hi ' [%ship ~bud]]]
  =/  =action:dm:c
    [~bud (dm-message ~zod now.bowl verse)]
  =/  =dock  [~zod %chat]
  ;<  ~  bind:m  (poke-app [~zod %chat] chat-dm-action-1+action)
  :: ~bud receives invitation from ~zod
  ::
  ;<  =cage  bind:m  (wait-for-app-fact /~bud/chat/v3 [~bud %chat])
  ;<  ~  bind:m  (ex-equal !>(p.cage) !>(%ships))
  ;<  ~  bind:m
    (ex-equal q.cage !>((sy ~zod ~)))
  ;<  =^cage  bind:m  (wait-for-app-fact /~bud/chat/v3 [~bud %chat])
  (pure:m ~)
--

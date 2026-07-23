::  tests for the %acp Messenger bus
::
/-  ac=acp, av=activity-ver, cv=chat-ver, st=story
/+  *test-agent
/=  agent  /app/acp
|%
++  dap  %acp
+$  state-0
  $:  %0
      routing=(unit routing:ac)
      requests=(map @ud request:ac)
      delivering=(set @ud)
      seen=(set message-key:v9:av)
      next-request=@ud
  ==
::
++  scries
  |=  =path
  ^-  (unit vase)
  ?+  path  ~
    [%gu @ %activity @ %$ ~]  `!>(&)
  ==
::
++  setup
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (set-scry-gate scries)
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~dev)))
  ;<  *  bind:m  (do-init dap agent)
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now ~2026.7.23)))
  (pure:m ~)
::
++  configure
  =/  m  (mare ,~)
  ^-  form:m
  =/  route=routing:ac  [~zod (sy ~[~bus]) (sy ~[~bus]) (sy ~[[%chat ~zod %general]]) & &]
  ;<  *  bind:m  (do-poke %acp-action-1 !>(`action:ac`[%configure route]))
  (pure:m ~)
::
++  dm-fact
  |=  [sender=ship text=@t time=@da]
  ^-  [wire gill:gall sign:agent:gall]
  =/  key=message-key:v9:av  [[sender time] time]
  =/  event=event:v9:av
    [[%dm-post key [%ship sender] ~[[%inline ~[text]]] %.n] %.n %.n]
  =/  update=update:v9:av  [%add [%dm %ship sender] time event]
  [/activity [~dev %activity] [%fact %activity-update-5 !>(update)]]
::
++  channel-fact
  |=  [sender=ship text=@t mention=? time=@da]
  ^-  [wire gill:gall sign:agent:gall]
  =/  key=message-key:v9:av  [[sender time] time]
  =/  channel  [%chat ~zod %general]
  =/  group  [~zod %test]
  =/  event=event:v9:av
    [[%post key channel group ~[[%inline ~[text]]] mention] %.n %.n]
  =/  update=update:v9:av  [%add [%channel channel group] time event]
  [/activity [~dev %activity] [%fact %activity-update-5 !>(update)]]
::
++  test-init-watches-activity
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  *  bind:m  (set-scry-gate scries)
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~dev, src ~dev)))
  ;<  caz=(list card)  bind:m  (do-init dap agent)
  %+  ex-cards  caz
  ~[(ex-card [%pass /activity %agent [~dev %activity] %watch /v5])]
::
++  test-owner-dm-is-queued
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  configure
  ;<  caz=(list card)  bind:m  (do-agent (dm-fact ~zod 'hello' ~2026.7.23))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  %-  ex-fact
        :*  ~[/worker]
            %acp-update-1
            !>(`update:ac`[%requests ~[[1 ~2026.7.23 [%dm ~zod] ~zod '~zod/~2026.07.23' 'hello']]])
        ==
    ==
  ;<  res=cage  bind:m  (got-peek /x/requests)
  (ex-equal q.res !>(`update:ac`[%requests ~[[1 ~2026.7.23 [%dm ~zod] ~zod '~zod/~2026.07.23' 'hello']]]))
::
++  test-unlisted-dm-is-ignored
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  configure
  ;<  caz=(list card)  bind:m  (do-agent (dm-fact ~nec 'nope' ~2026.7.23))
  (ex-cards caz ~)
::
++  test-mentioned-channel-message-is-queued
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  configure
  ;<  caz=(list card)  bind:m
    (do-agent (channel-fact ~bus 'channel question' & ~2026.7.23))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  %-  ex-fact
        :*  ~[/worker]
            %acp-update-1
            !>(`update:ac`[%requests ~[[1 ~2026.7.23 [%channel %chat ~zod %general] ~bus '~bus/~2026.07.23' 'channel question']]])
        ==
    ==
  (pure:m ~)
::
++  test-unmentioned-channel-message-is-ignored
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  configure
  ;<  caz=(list card)  bind:m
    (do-agent (channel-fact ~bus 'background' | ~2026.7.23))
  (ex-cards caz ~)
::
++  test-reply-pokes-chat
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  configure
  ;<  *  bind:m  (do-agent (dm-fact ~zod 'hello' ~2026.7.23))
  ;<  caz=(list card)  bind:m
    (do-poke %acp-action-1 !>(`action:ac`[%reply 1 'hi']))
  =/  content=story:st  ~[[%inline ~['hi']]]
  =/  essay=essay:v7:cv  [[content ~dev ~2026.7.23] chat+/ ~ ~]
  =/  diff=diff:dm:v7:cv  [[~dev ~2026.7.23] %add essay `~2026.7.23]
  %+  ex-cards  caz
  ~[(ex-poke /reply/(scot %ud 1) [~dev %chat] %chat-dm-action-2 !>(`action:dm:v7:cv`[~zod diff]))]
::
++  test-successful-delivery-completes-request
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  configure
  ;<  *  bind:m  (do-agent (dm-fact ~zod 'hello' ~2026.7.23))
  ;<  *  bind:m  (do-poke %acp-action-1 !>(`action:ac`[%reply 1 'hi']))
  ;<  caz=(list card)  bind:m
    (do-agent [/reply/(scot %ud 1) [~dev %chat] [%poke-ack ~]])
  ;<  ~  bind:m
    %+  ex-cards  caz
    ~[(ex-fact ~[/worker] %acp-update-1 !>(`update:ac`[%completed 1]))]
  ;<  res=cage  bind:m  (got-peek /x/requests)
  (ex-equal q.res !>(`update:ac`[%requests ~]))
--

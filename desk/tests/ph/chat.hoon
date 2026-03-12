/-  spider, c=chat, cv=chat-ver, ch=channels, s=story
/+  *ph-io, *ph-test
=,  strand=strand:spider
=>
|%
++  dm-tick  ^~((div ~s1 (bex 16)))
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
  ;<  ~  bind:m  (watch-app /~zod/chat/v3 [~zod %chat] /v3)
  ;<  ~  bind:m  (watch-app /~bud/chat/v3 [~bud %chat] /v3)
  ;<  =bowl:strand  bind:m  get-bowl
  ::  ~zod greets ~bud with a message
  ::
  =/  =verse:ch  [%inline ~['hi ' [%ship ~bud]]]
  =/  msg=diff:dm:c
    (dm-message ~zod now.bowl verse)
  =/  =action:dm:c
    [~bud msg]
  ;<  sent=@da  bind:m  get-time
  ;<  ~  bind:m  (poke-app [~zod %chat] chat-dm-action-1+action)
  :: ~bud receives an invitation from ~zod
  ::
  ;<  pay=cage  bind:m  (wait-for-app-fact /~bud/chat/v3 [~bud %chat])
  ;<  ~  bind:m  (ex-equal !>(p.pay) !>(%ships))
  ;<  ~  bind:m
    (ex-equal q.pay !>((sy ~zod ~)))
  ::  ~bud receives a message from ~zod
  ::
  ;<  pay=cage  bind:m  (wait-for-app-fact /~bud/chat/v3 [~bud %chat])
  ;<  received=@da  bind:m  get-time
  ;<  ~  bind:m  (ex-equal !>(p.pay) !>(%writ-response-3))
  =/  writ-response-3=[whom:v6:cv response:writs:v6:cv]
    :-  ship+~zod  ::  whom
    ^-  response:writs:v6:cv  ::  response
    :-  [~zod sent]
    :*  %add
        ?>(?=(%add -.q.msg) essay.q.msg)
        1
        received
    ==
  ;<  ~  bind:m  (ex-equal q.pay !>(writ-response-3))
  ::  ~bud accepts the dm and sends a greeting back
  ::
  ;<  ~  bind:m  (poke-app [~bud %chat] chat-dm-rsvp+[~zod &])
  =/  =verse:ch  [%inline ~['hello ' [%ship ~zod]]]
  =/  msg=diff:dm:c
    (dm-message ~bud now.bowl verse)
  =/  =action:dm:c
    [~zod msg]
  ;<  sent=@da  bind:m  get-time
  ;<  ~  bind:m  (poke-app [~bud %chat] chat-dm-action-1+action)
  ::  ~zod receives a notice, and a message
  ::
  ;<  pay=cage  bind:m  (wait-for-app-fact /~zod/chat/v3 [~zod %chat])
  ;<  received=@da  bind:m  get-time
  ;<  ~  bind:m  (ex-equal !>(p.pay) !>(%writ-response-3))
  =/  writ-response-3=[whom:v6:cv response:writs:v6:cv]
    :-  ship+~bud  ::  whom
    ^-  response:writs:v6:cv  ::  response
    ::  all timestamps are .received, rather than sent, because the notice
    ::  is self-generated.
    ::
    :-  [~zod received]
    =/  =essay:c
      :*  [~[[%inline ~[[%ship ~bud] ' joined the chat']]] ~zod received]
          [%chat /notice]
          ~
          ~
      ==
    [%add essay 2 received]
  ;<  ~  bind:m  (ex-equal q.pay !>(writ-response-3))
  ;<  pay=cage  bind:m  (wait-for-app-fact /~zod/chat/v3 [~zod %chat])
  ;<  ~  bind:m  (ex-equal !>(p.pay) !>(%writ-response-3))
  =/  writ-response-3=[whom:v6:cv response:writs:v6:cv]
    :-  ship+~bud  ::  whom
    ^-  response:writs:v6:cv  ::  response
    :-  p.msg
    =/  =essay:c
      :*  [~[[%inline ~['hello ' [%ship ~zod]]]] ~bud q.p.msg]
          [%chat /]
          ~
          ~
      ==
    :*  %add
        essay
        3
        (add received dm-tick)
    ==
  ;<  ~  bind:m  (ex-equal q.pay !>(writ-response-3))
  (pure:m ~)
--

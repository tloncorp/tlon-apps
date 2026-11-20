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
++  club-id  `id:club:c`0v1
::  +club-init: the invitation ~zod sends ~bud
::
++  club-init
  ^-  delta:club:c
  [%init (sy ~zod ~) (sy ~bud ~) met:*crew:club:c]
::  +ex-club-delta: expect a club action of the kind of .delta
::
::    facts with other marks and club actions of other kinds are skipped.
::
++  ex-club-delta
  |=  [=ship =id:club:c =delta:club:c]
  =/  m  (strand ,~)
  ^-  form:m
  |-
  =*  loop  $
  ;<  =cage  bind:m
    (wait-for-app-fact /(scot %p ship)/chat/v4 [ship %chat])
  ?.  ?=(%chat-club-action-2 p.cage)  loop
  =+  !<(=action:club:c q.cage)
  ?.  =(-.delta -.q.q.action)  loop
  (ex-equal !>([p q.q]:action) !>([id delta]))
::  +ex-club-writ: expect a club message with the id of .diff
::
::    facts with other marks and other messages are skipped.
::
++  ex-club-writ
  |=  [=ship =id:club:c =diff:writs:c]
  =/  m  (strand ,~)
  ^-  form:m
  ?>  ?=(%add -.q.diff)
  |-
  =*  loop  $
  ;<  =cage  bind:m
    (wait-for-app-fact /(scot %p ship)/chat/v4 [ship %chat])
  ?.  ?=(%writ-response-4 p.cage)  loop
  =+  !<([=whom:c res=response:writs:c] q.cage)
  ?.  =(p.diff id.res)  loop
  ;<  ~  bind:m  (ex-equal !>(whom) !>(`whom:c`[%club id]))
  ?>  ?=(%add -.response.res)
  (ex-equal !>(essay.response.res) !>(essay.q.diff))
::  +invite-bud: ~zod creates an empty club and adds ~bud to it
::
++  invite-bud
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (poke-app [~zod %chat] chat-club-create+[club-id ~])
  =/  =action:club:c  [club-id 0v0 %hive ~zod ~bud &]
  ;<  ~  bind:m  (poke-app [~zod %chat] chat-club-action-2+action)
  (ex-club-delta ~bud club-id club-init)
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
    ::  all timestamps are .received, rather than .sent, because the notice
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
::  +ph-test-club-create: test club invitation on creation
::
::  scenario
::
::  ~zod creates a club and invites ~bud. ~bud receives the invitation.
::
++  ph-test-club-create
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~bud/chat/v4 [~bud %chat] /v4)
  =/  =create:club:c  [club-id (sy ~bud ~)]
  ;<  ~  bind:m  (poke-app [~zod %chat] chat-club-create+create)
  (ex-club-delta ~bud club-id club-init)
::  +ph-test-club-rsvp: test club invitation response
::
::  scenario
::
::  ~zod creates a club and then adds ~bud to it. ~bud receives the
::  invitation and accepts it. ~zod learns that ~bud has joined.
::
++  ph-test-club-rsvp
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~bud/chat/v4 [~bud %chat] /v4)
  ;<  ~  bind:m  invite-bud
  ;<  ~  bind:m  (watch-app /~zod/chat/v4 [~zod %chat] /v4)
  =/  =action:club:c  [club-id 0v0 %team ~bud &]
  ;<  ~  bind:m  (poke-app [~bud %chat] chat-club-action-2+action)
  (ex-club-delta ~zod club-id [%team ~bud &])
::  +ph-test-club-writ: test club message delivery
::
::  scenario
::
::  ~zod creates a club and then adds ~bud to it. ~bud receives the
::  invitation. ~zod sends a message and ~bud receives it.
::
++  ph-test-club-writ
  =/  m  (strand ,~)
  ^-  form:m
  ;<  ~  bind:m  (watch-app /~bud/chat/v4 [~bud %chat] /v4)
  ;<  ~  bind:m  invite-bud
  ;<  =bowl:strand  bind:m  get-bowl
  =/  msg=diff:writs:c
    (dm-message ~zod now.bowl [%inline ~['hi ' [%ship ~bud]]])
  =/  =action:club:c  [club-id 0v0 %writ msg]
  ;<  ~  bind:m  (poke-app [~zod %chat] chat-club-action-2+action)
  (ex-club-writ ~bud club-id msg)
--

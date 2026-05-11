::  a2ui: A2UI user action event store
::
::    pokes:
::      %a2ui-action  canonical `{userAction, tlonContext}` or legacy action JSON
::
::    watches:
::      /actions      emits one JSON action object per accepted action
::
::    scries:
::      /x/actions/all              JSON array of all stored actions
::      /x/actions/since/[da]       JSON array newer than `.received-at`
::      /x/actions/post/[post-id]   JSON array matching `.post-id`
::      /x/actions/channel/[id]     JSON array matching `.channel-id`
::
/-  *a2ui
/+  default-agent, dbug, aj=a2ui-json
::
=>
  |%
  +$  card  card:agent:gall
  +$  current-state  state
  --
=|  current-state
=*  state  -
::
%-  agent:dbug
^-  agent:gall
=<
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %|) bowl)
::
++  on-init
  ^-  (quip card _this)
  `this
++  on-save  !>(state)
++  on-load
  |=  =vase
  ^-  (quip card _this)
  =+  !<(old=current-state vase)
  ?>  ?=(%0 -.old)
  `this(state old)
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  ?+    mark  (on-poke:def mark vase)
      %a2ui-action
    =/  input=action-input  !<(action-input vase)
    =/  stored=stored-action
      (store-action input src.bowl now.bowl next-id.state)
    =/  updated-actions=(list stored-action)
      ^-  (list stored-action)
      [stored actions.state]
    =/  next-actions=(list stored-action)
      (scag max-actions updated-actions)
    =/  fact=card
      [%give %fact ~[/actions] %json !>((action:enjs:aj stored))]
    =/  forward=(unit card)
      ?~  action-host-ship.stored
        ~
      ?.  =(src.bowl our.bowl)
        ~
      =/  target=(unit @p)  (slaw %p u.action-host-ship.stored)
      ?~  target
        ~
      ?:  =(u.target our.bowl)
        ~
      (some [%pass /a2ui/forward/(scot %ud id.stored) %agent [u.target %a2ui] %poke [%a2ui-action !>(input)]])
    =/  cards=(list card)
      ?~  forward
        :~  fact
        ==
      :~  u.forward
          fact
      ==
    :_  this(next-id +(next-id.state), actions next-actions)
    cards
  ==
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
  ?>  =(our src):bowl
  ?+    path  (on-watch:def path)
      [%actions ~]
    `this
  ==
::
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  ?>  =(our src):bowl
  ?+    path  [~ ~]
      [%x %actions %all ~]
    ``json+!>((actions:enjs:aj (flop actions.state)))
  ::
      [%x %actions %since @ ~]
    =/  since=(unit @da)  (slaw %da i.t.t.t.path)
    ?~  since
      ``json+!>(a+~)
    ``json+!>((actions:enjs:aj (flop (actions-since u.since))))
  ::
      [%x %actions %post @ ~]
    =/  post-id=@t  ;;(@t i.t.t.t.path)
    ``json+!>((actions:enjs:aj (flop (actions-by-post post-id))))
  ::
      [%x %actions %channel @ ~]
    =/  channel-id=@t  ;;(@t i.t.t.t.path)
    ``json+!>((actions:enjs:aj (flop (actions-by-channel channel-id))))
  ==
::
++  on-leave  on-leave:def
++  on-agent  on-agent:def
++  on-arvo   on-arvo:def
++  on-fail   on-fail:def
--
::
|%
++  max-actions  200
::
++  store-action
  |=  [input=action-input source=@p received=@da id=@ud]
  ^-  stored-action
  =/  user=(unit user-action)  user-action.input
  =/  tlon=(unit tlon-context)  tlon-context.input
  =/  post-id=(unit @t)
    ?~  tlon
      post-id.input
    ?~(post-id.u.tlon post-id.input post-id.u.tlon)
  =/  channel-id=(unit @t)
    ?~  tlon
      channel-id.input
    ?~(channel-id.u.tlon channel-id.input channel-id.u.tlon)
  =/  author-id=(unit @t)
    ?~(tlon ~ author-id.u.tlon)
  =/  action-host-ship=(unit @t)
    ?~(tlon ~ action-host-ship.u.tlon)
  =/  name=(unit @t)
    ?~(user ~ `name.u.user)
  =/  surface-id=(unit @t)
    ?~(user ~ `surface-id.u.user)
  =/  source-component-id=(unit @t)
    ?~(user ~ `source-component-id.u.user)
  =/  timestamp=(unit @t)
    ?~(user ~ `timestamp.u.user)
  =/  context=json
    ?~(user ~ context.u.user)
  [id source received post-id channel-id author-id action-host-ship act.input blob-type.input payload.input name surface-id source-component-id timestamp context raw.input]
::
++  actions-since
  |=  since=@da
  ^-  (list stored-action)
  %+  skim  actions.state
  |=  act=stored-action
  (gth received-at.act since)
::
++  actions-by-post
  |=  post-id=@t
  ^-  (list stored-action)
  %+  skim  actions.state
  |=  act=stored-action
  ?~  post-id.act
    |
  =(post-id u.post-id.act)
::
++  actions-by-channel
  |=  channel-id=@t
  ^-  (list stored-action)
  %+  skim  actions.state
  |=  act=stored-action
  ?~  channel-id.act
    |
  =(channel-id u.channel-id.act)
--

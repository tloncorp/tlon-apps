::  app/a2ui.hoon: universal mini-app backend for interactive blobs
::
::    accepts user actions from the Tlon app frontend (button taps,
::    chess moves, form submissions, etc.) and stores them for
::    external bot consumption via scry.
::
::    poke:
::      %a2ui-action  typed action mark
::      %json         raw JSON (for easy frontend integration)
::
::    scry:
::      /x/actions/all            all stored actions
::      /x/actions/since/[da]     actions since a timestamp
::      /x/actions/post/[id]      actions for a specific post
::      /x/actions/channel/[id]   actions for a specific channel
::
::    subscribe:
::      /actions                  real-time action stream
::
/-  *a2ui
/+  default-agent, dbug, verb
::
|%
+$  card  card:agent:gall
+$  versioned-state
  $%  state-0
  ==
::
++  parse-action-json
  |=  jon=json
  ^-  action
  =/  obj  ((om:dejs:format json) jon)
  :*  (so:dejs:format (~(got by obj) 'postId'))
      (so:dejs:format (~(got by obj) 'channelId'))
      (so:dejs:format (~(got by obj) 'action'))
      (so:dejs:format (~(got by obj) 'blobType'))
      (fall (bind (~(get by obj) 'payload') so:dejs:format) '')
  ==
::
++  enjs-stored-action
  |=  sa=stored-action
  ^-  json
  %-  pairs:enjs:format
  :~  ['id' (numb:enjs:format id.sa)]
      ['timestamp' s+(scot %da timestamp.sa)]
      ['ship' s+(scot %p ship.sa)]
      ['postId' s+post-id.action.sa]
      ['channelId' s+channel-id.action.sa]
      ['action' s+act.action.sa]
      ['blobType' s+blob-type.action.sa]
      ['payload' s+payload.action.sa]
  ==
::
++  enjs-actions
  |=  acts=(list stored-action)
  ^-  json
  %-  pairs:enjs:format
  :~  ['actions' a+(turn acts enjs-stored-action)]
      ['count' (numb:enjs:format (lent acts))]
  ==
--
::
=|  state-0
=*  state  -
::
%-  agent:dbug
%+  verb  |
^-  agent:gall
|_  =bowl:gall
+*  this  .
    def   ~(. (default-agent this %|) bowl)
::
++  on-init
  ^-  (quip card _this)
  ~&  >  '%a2ui initialized'
  [~ this]
::
++  on-save  !>(state)
::
++  on-load
  |=  ole=vase
  ^-  (quip card _this)
  =/  old  !<(versioned-state ole)
  ?>  ?=(%0 -.old)
  [~ this(state old)]
::
++  on-poke
  |=  [=mark =vase]
  ^-  (quip card _this)
  |^
  ?+  mark  (on-poke:def mark vase)
    ::  %a2ui-action: typed action mark
    ::
      %a2ui-action
    (process !<(action vase))
    ::  %json: raw JSON poke (frontend integration)
    ::
      %json
    (process (parse-action-json !<(json vase)))
  ==
  ::
  ++  process
    |=  act=action
    ^-  (quip card _this)
    =/  sa=stored-action
      [next-id.state now.bowl src.bowl act]
    ::  prepend to list, cap at 200 actions
    ::
    =/  new-actions=(list stored-action)  [sa actions.state]
    =?  new-actions  (gth (lent new-actions) 200)
      (scag 200 new-actions)
    =.  actions.state  new-actions
    =.  next-id.state  +(next-id.state)
    ~&  >  "a2ui: action {(trip act.act)} from {(scow %p src.bowl)}"
    ::  notify subscribers
    ::
    :_  this
    :~  [%give %fact [/actions]~ %json !>((enjs-stored-action sa))]
    ==
  --
::
++  on-peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  (on-peek:def path)
    ::  /x/actions/all — all stored actions
    ::
      [%x %actions %all ~]
    ``json+!>((enjs-actions actions.state))
    ::  /x/actions/since/[timestamp] — actions since a @da
    ::
      [%x %actions %since @ ~]
    =/  since=@da  (slav %da i.t.t.t.path)
    =/  filtered
      (skim actions.state |=(sa=stored-action (gte timestamp.sa since)))
    ``json+!>((enjs-actions filtered))
    ::  /x/actions/post/[post-id] — actions for a specific post
    ::
      [%x %actions %post @ ~]
    =/  pid=@t  i.t.t.t.path
    =/  filtered
      (skim actions.state |=(sa=stored-action =(post-id.action.sa pid)))
    ``json+!>((enjs-actions filtered))
    ::  /x/actions/channel/[channel-id] — actions for a channel
    ::
      [%x %actions %channel @ ~]
    =/  cid=@t  i.t.t.t.path
    =/  filtered
      (skim actions.state |=(sa=stored-action =(channel-id.action.sa cid)))
    ``json+!>((enjs-actions filtered))
  ==
::
++  on-watch
  |=  =path
  ^-  (quip card _this)
  ?+  path  (on-watch:def path)
    ::  /actions — subscribe to all new actions in real time
    ::
      [%actions ~]
    [~ this]
  ==
::
++  on-agent  on-agent:def
++  on-arvo   on-arvo:def
++  on-leave  on-leave:def
++  on-fail   on-fail:def
--

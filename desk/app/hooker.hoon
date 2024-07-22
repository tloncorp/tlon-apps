/-  h=hooker, c=channels
/+  lib=hooker, rudder, default-agent, dbug, verb
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  +$  state-0
    $:  %0
        =workers:h
        =collection:h
    ==
  --
=|  state-0
=*  state  -
=<
  %+  verb  &
  %-  agent:dbug
  |_  =bowl:gall
  +*  this  .
      def   ~(. (default-agent this %.n) bowl)
      cor   ~(. +> [bowl ~])
  ++  on-init
    ^-  (quip card _this)
    =^  cards  state
      abet:init:cor
    [cards this]
  ::
  ++  on-save  !>(state)
  ++  on-load
    |=  =vase
    ^-  (quip card _this)
    =^  cards  state
      abet:(load:cor vase)
    [cards this]
  ::
  ++  on-poke
    |=  [=mark =vase]
    ^-  (quip card _this)
    =^  cards  state
      abet:(poke:cor mark vase)
    [cards this]
  ++  on-watch
    |=  =path
    ^-  (quip card _this)
    =^  cards  state
      abet:(watch:cor path)
    [cards this]
  ::
  ++  on-peek   peek:cor
  ::
  ++  on-leave   on-leave:def
  ++  on-fail    on-fail:def
  ::
  ++  on-agent
    |=  [=wire =sign:agent:gall]
    ^-  (quip card _this)
    =^  cards  state
      abet:(agent:cor wire sign)
    [cards this]
  ++  on-arvo
    |=  [=wire sign=sign-arvo]
    ^-  (quip card _this)
    =^  cards  state
      abet:(arvo:cor wire sign)
    [cards this]
  --
|_  [=bowl:gall cards=(list card)]
++  abet  [(flop cards) state]
++  cor   .
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))
++  give  |=(=gift:agent:gall (emit %give gift))
++  bind
  (emit [%pass /eyre/connect %arvo %e %connect [~ /hooker] dap.bowl])
++  init
  ^+  cor
  bind
++  load
  |=  =vase
  ^+  cor
  =/  old=(unit state-0)
    (mole |.(!<(state-0 vase)))
  =.  cor  bind
  ?^  old  cor(state u.old)
  ~&  >>>  "Incompatible load, nuking"
  %-  emil
  =-  (welp - cards)
  %+  turn  ~(tap in ~(key by wex.bowl))
  |=  [=wire =ship =term]
  ^-  card
  [%pass wire %agent [ship term] %leave ~]
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?+    mark  ~|(bad-poke/mark !!)
      %handle-http-request
    (serve !<(order:rudder vase))
  ::
      %hooker-action
    ?>  from-self
    =+  !<(=action:h vase)
    ?+  -.action  ~|(no-pokes/action !!)
        %create-worker
      abet:(create:worker-core +.action)
    ::
        %remove-worker
      abet:remove:(abed:worker-core path.action)
    ::
        %message
      (send-message [nest story]:action)
    ==
  ==
::
++  watch
  |=  =(pole knot)
  ^+  cor
  =?  pole  &(!?=([%http-response *] pole) !?=([%v0 *] pole))
    [%v0 pole]
  ?+  pole  ~|(bad-watch-path/path !!)
    [%v0 ~]  cor
    [%http-response *]  cor
  ==
::
++  agent
  |=  [=wire =sign:agent:gall]
  ^+  cor
  ~&  agent/wire
  cor
  :: ?+    wire  ~|(bad-agent-wire/wire !!)
  ::   ::   [%dm @ *]
  ::   :: =/  =ship  (slav %p i.t.wire)
  ::   :: di-abet:(di-agent:(di-abed:di-core ship) t.t.wire sign)
  :: ==
::
++  arvo
  |=  [=wire sign=sign-arvo]
  ^+  cor
  ?+    wire  ~|(bad-arvo-wire/wire !!)
      [%eyre %connect ~]
    ~!  sign
    ?>  ?=([%eyre %bound *] sign)
    cor
  ==
++  peek
  |=  =path
  ^-  (unit (unit cage))
  ~&  peek/path
  [~ ~]
  :: ?+  path  [~ ~]
  :: :: ::
  :: ::   [%x %chat ~]  ``flags+!>(~(key by chats))
  :: ==
::
++  serve
  |=  order:rudder
  ^+  cor
  ~&  "serving request: {<method.request>} {<url.request>}"
  ~&  "  headers: {<header-list.request>}"
  ~&  "  body: {<?~(body.request ~ `@t`q.u.body.request)>}"
  =/  =query:rudder  (purse:rudder url.request)
  =/  path=(unit path)  (decap:rudder /hooker site.query)
  ?~  path  cor
  =/  worker  (init:req:(abed:worker-core u.path) request)
  ?.  is-valid:req:worker  ~|("request not valid {<request>}" !!)
  =/  [payload=simple-payload:http =command:h]  transform:req:worker
  ~&  "sending command: {<command>}"
  =/  =wire  /command/[id]
  =/  =dock  [our.bowl dap.bowl]
  =/  =cage  hooker-action+!>(command)
  =/  poke  [%pass wire %agent dock %poke cage]
  (emil (welp (spout:rudder id payload) ~[poke]))
  :: (paint:rudder [%page *manx])
::
++  worker-core
  |_  [=path =worker:h gone=_| counter=@ud =request:http]
  ++  worker-core  .
  ++  abet
    =.  workers
      ?:  gone
        (~(del by workers) path)
      (~(put by workers) path worker)
    cor
  ++  abed
    |=  p=^path
    ~|  ['worker not found' p]
    worker-core(path p, worker (~(got by workers) p))
  ++  create
    |=  [p=^path =signature-header:h =transformer:h]
    =/  =worker:h
      :*  (shax (jam ['hooker' eny.bowl]))
          p
          signature-header
          transformer
      ==
    :: TODO: give update
    worker-core(path p, worker worker)
  ++  remove
    =.  gone  &
    :: TODO: give update
    worker-core
  ++  req
    |%
    ++  init
      |=  =request:http
      worker-core(request request)
    ++  transform
      ^-  [simple-payload:http command:h]
      ~&  "transforming request"
      :-  [[200 ['content-type' 'text/plain']~] `(as-octs:mimes:html 'OK')]
      ?-  transformer.worker
        %direct  transform-direct
        %github  transform-github
        %linear  transform-linear
      ==
    ++  is-valid
      ^-  ?
      ?.  &(=(%'POST' method.request) ?=(^ body.request))  |
      =+  signature-header.worker
      =/  header  (get-header:http name header-list.request)
      ?~  header  ~&("couldn't find header: {<name>} {<header-list.request>}" |)
      =/  their-sign=(unit @t)
        ?~  prefix  `u.header
        =;  parsed=(unit tape)
          ?~  parsed  ~
          `(crip u.parsed)
        %+  rush  u.header
        ;~(pfix (jest u.prefix) (star next))
      ~&  "their-sign: {<their-sign>}"
      ?~  their-sign  |
      =/  our-sign
        %+  en:base16:mimes:html  32
        (hmac-sha256t:hmac:crypto (en:base16:mimes:html 32 key.worker) q.u.body.request)
      ~&  "our-sign: {<our-sign>}"
      =(our-sign u.their-sign)
    ++  transform-direct
      ^-  command:h
      ?>  ?=(^ body.request)
      =/  json=(unit json)  (de:json:html q.u.body.request)
      ?~  json  ~|(['bad json' `@t`q.u.body.request] !!)
      (command:dejs:lib u.json)
    ++  transform-github
      ^-  command:h
      ~&  "transforming github request"
      ?>  ?=(^ body.request)
      ~&  "has body"
      =/  event-header  (get-header:http 'x-github-event' header-list.request)
      ?~  event-header  ~|('no github event' !!)
      ~|  "bad event: {<u.event-header>}"
      =/  event-type  ((su:dejs:format (perk %'pull_request' %issues ~)) [%s u.event-header])
      ~&  "event-type: {<event-type>}"
      ?+  event-type
        ~&  "storing github request: {<now.bowl>} {<`@t`q.u.body.request>}"
        [%store (scot %da now.bowl) (my [%body q.u.body.request] ~)]
      ::
          %'pull_request'  (pull-request:github:lib request)
      ==
    ++  transform-linear
      ?>  ?=(^ body.request)
      !!
    --
  --
++  send-message
  |=  [=nest:c =story:c]
  ^+  cor
  =/  =wire  /send-message/[kind.nest]/(scot %p ship.nest)/[name.nest]
  =/  =dock  [our.bowl %channels]
  =/  =c-post:c  [%add [story our.bowl now.bowl] [%chat ~]]
  =/  action  [%channel nest [%post c-post]]
  =/  =cage  channel-action+!>(`a-channels:c`action)
  (emit [%pass wire %agent dock %poke cage])
++  from-self  =(our src):bowl
++  scry-path
  |=  [agent=term =path]
  ^-  ^path
  (welp /(scot %p our.bowl)/[agent]/(scot %da now.bowl) path)
--
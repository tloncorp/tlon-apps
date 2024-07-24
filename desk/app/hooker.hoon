/-  h=hooker, c=channels
/+  lib=hooker, rudder, default-agent, dbug, verb
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  +$  state-0
    $:  %0
        =hooks:h
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
    (handle-action action)
  ::
      %hooker-orders
    ?>  from-self
    =+  !<(=orders:h vase)
    ~&  "hooker-orders: {<orders>}"
    |-
    ?~  orders  cor
    =.  cor  (handle-action i.orders)
    $(orders t.orders)
  ==
::
++  handle-action
  |=  =action:h
  ^+  cor
  ?-  -.action
      %create-hook
    abet:(create:hook-core +.action)
  ::
      %update-hook
    abet:(update:(abed:hook-core path.action) +.action)
  ::
      %remove-hook
    abet:remove:(abed:hook-core path.action)
  ::
      %message
    (send-message [nest story]:action)
  ::
      %store
    (store [key data]:action)
  ::
      %poke
    (arbitrary-poke +.action)
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
  |=  =order:rudder
  ^+  cor
  =*  request  request.order
  ~&  "serving request: {<method.request>} {<url.request>}"
  ~&  "  headers: {<header-list.request>}"
  ~&  "  body: {<?~(body.request ~ `@t`q.u.body.request)>}"
  =/  =query:rudder  (purse:rudder url.request)
  =/  suffix
    ?~  ext.query  site.query
    %-  stab
    (cat 3 (spat site.query) (cat 3 '.' u.ext.query))
  =/  path=(unit path)  (decap:rudder /hooker suffix)
  ~&  "path: {<path>}"
  ?~  path  cor
  =/  hook  (init:req:(abed:hook-core u.path) +.order)
  ?.  is-valid:req:hook  ~|("request not valid {<request>}" !!)
  =/  [payload=simple-payload:http =orders:h]  transform:req:hook
  ~&  "sending orders: {<orders>}"
  =/  =wire  /orders/[id.order]
  =/  =dock  [our.bowl dap.bowl]
  =/  =cage  hooker-orders+!>(orders)
  =/  poke  [%pass wire %agent dock %poke cage]
  (emil (welp (spout:rudder id.order payload) ~[poke]))
::
++  hook-core
  |_  [=path =hook:h gone=_| counter=@ud request=inbound-request:eyre]
  ++  hook-core  .
  ++  abet
    =.  hooks
      ?:  gone
        (~(del by hooks) path)
      (~(put by hooks) path hook)
    cor
  ++  abed
    |=  p=^path
    ~|  ['hook not found' p]
    ~&  "getting hook: {<p>}"
    ~&  "has hook: {<(~(has by hooks) p)>}"
    =/  hook  (~(got by hooks) p)
    ~&  "got hook: {<hook>}"
    hook-core(path p, hook hook)
  ++  create
    |=  [p=(unit ^path) =signature-header:h =whitelist:h]
    =^  path  counter
      ?:  ?=(^ p)  [u.p counter]
      [/(scot %uv (shax (jam ['path' eny.bowl]))) +(counter)]
    =^  key  counter
      [(shax (jam ['hooker' eny.bowl])) +(counter)]
    =/  =hook:h
      :*  key
          path
          signature-header
          whitelist
      ==
    :: TODO: give update
    hook-core(path path, hook hook)
  ++  update
    |=  [p=^path =signature-header:h =whitelist:h]
    =/  =hook:h
      :*  key.hook
          p
          signature-header
          whitelist
      ==
    :: TODO: give update
    hook-core(path p, hook hook)
  ++  remove
    =.  gone  &
    :: TODO: give update
    hook-core
  ++  req
    |%
    ++  init
      |=  request=inbound-request:eyre
      hook-core(request request)
    ++  transform
      ^-  [simple-payload:http orders:h]
      =*  req  request.request
      ?>  ?=(^ body.req)
      ~&  "transforming request"
      :-  [[200 ['content-type' 'text/plain']~] `(as-octs:mimes:html 'OK')]
      =/  json=(unit json)  (de:json:html q.u.body.req)
      ?~  json  ~|(['bad json' `@t`q.u.body.req] !!)
      ~&  "json: {<json>}"
      (orders:dejs:lib u.json)
    ++  is-valid
      ^-  ?
      =*  req  request.request
      ~&  "checking if request is valid {<method.req>} {<?=(^ body.req)>}"
      ?.  &(=(%'POST' method.req) ?=(^ body.req))  |
      =+  signature-header.hook
      =/  header  (get-header:http name header-list.req)
      ?~  header  ~&("couldn't find header: {<name>} {<header-list.req>}" |)
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
        (hmac-sha256t:hmac:crypto (en:base16:mimes:html 32 key.hook) q.u.body.req)
      ~&  "our-sign: {<our-sign>}"
      =/  signatures-match  =(our-sign u.their-sign)
      ?.  signatures-match  ~|('signatures do not match' !!)
      ::  if whitelist is empty, allow all
      ?:  =(*whitelist:h whitelist.hook)  &
      (~(has in whitelist.hook) address.request)
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
++  store
  |=  [key=@t =data:h]
  ^+  cor
  =.  collection  (~(put by collection) key data)
  cor
++  arbitrary-poke
  |=  [=wire =dock =mark =noun]
  ^+  cor
  ?:  =(our.bowl p.dock)
    =/  =tube:clay  (find-tube q.dock %noun mark)
    =/  =vase  (tube !>(noun))
    (emit [%pass wire %agent dock %poke [mark vase]])
  =/  =cage  [mark !>(noun)]
  (emit [%pass wire %agent dock %poke cage])
++  find-tube
  |=  [dap=term from=mark to=mark]
  ^-  tube:clay
  =+  .^(=desk %gd (scry-path dap /$))
  .^(tube:clay %cc (scry-path desk /[from]/[to]))
++  from-self  =(our src):bowl
++  scry-path
  |=  [agent=term =path]
  ^-  ^path
  (welp /(scot %p our.bowl)/[agent]/(scot %da now.bowl) path)
--
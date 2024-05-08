/-  u=ui, g=groups, c=channels, ch=chat
/+  *test-agent
/=  ui-agent  /app/groups-ui
|%
++  dap  %groups-ui-test
++  the-wire  /groups/(scot %p ~zod)/test
++  updates-wire  (weld the-wire /updates)
++  the-path  (weld updates-wire /init)
++  the-dock  [~zod dap]
++  the-group  [%test 'test' '' '' '' [%open ~ ~] ~ |]
++  flag  [~zod %test]
++  wait  /~/cache/wakeup/ui/init
++  cache  /~/cache/eyre/cache
++  url  (spat /tlon/v1/ui/init/noun)
++  test-cache-update
  %-  eval-mare
  =/  m  (mare ,~)
  ;<  *  bind:m  (do-init dap ui-agent)
  ;<  *  bind:m  (set-scry-gate scries)
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod)))
  ;<  bw=bowl  bind:m  get-bowl
  =/  now=time  now.bw
  ;<  caz=(list card)  bind:m  (do-poke %noun !>(%update-init))
  =/  next=time  (add now ~s5)
  ;<  *  bind:m
  (ex-cards caz (ex-arvo wait %b %wait next) ~)
  ;<  *  bind:m  (^wait ~s1)
  ;<  bw=bowl  bind:m  get-bowl
  =/  now=time  now.bw
  =/  new-next=time  (add now ~s5)
  ;<  caz=(list card)  bind:m  (do-poke %noun !>(%update-init))
  ;<  *  bind:m
    %+  ex-cards  caz
    :~  (ex-arvo wait %b %rest next)
        (ex-arvo wait %b %wait new-next)
    ==
  ;<  *  bind:m  (jab-bowl |=(b=bowl b(now new-next)))
  ::  wakeup & set response
  ;<  caz=(list card)  bind:m  (do-arvo wait %behn %wake ~)
  (ex-cards caz (ex-arvo cache %e set-response) ~)
++  set-response
  ^-  task:eyre
  =/  data=(unit octs)  `(as-octs:mimes:html (jam init))
  =/  =response-header:http
    [200 ['Content-Type' 'application/x-urb-jam'] ~]
  =/  =simple-payload:http  [response-header data]
  :*  %set-response
      url
      `[& %payload simple-payload]
  ==
++  scries
  |=  =path
  ^-  (unit vase)
  ?+  path  ~
    [%gx @ %groups @ %init %v1 *]     `!>(groups-init)
    [%gx @ %channels @ %v2 %init *]   `!>(channels-init)
    [%gx @ %chat @ %init *]           `!>(chat-init)
    [%gx @ %profile @ %bound *]       `!>(|)
  ==
++  init
  ^-  init:u
  :*  groups-ui:groups-init
      gangs:groups-init
      channels:channels-init
      unreads:channels-init
      ~
      chat-init
      |
  ==
++  groups-init
  ^-  [=groups-ui:g =gangs:g]
  =/  =group-ui:g
    :_  ~
    :*  (malt ~[[~zod ~ *@da]])
        ~
        ~
        ~
        ~
        ~
        ~
        [%open ~ ~]
        |
        ['' '' '' '']
        ~
    ==
  :-  (malt ~[[[~zod %test] group-ui]])
  (malt ~[[[~zod %foreign] `gang:g`[~ ~ ~]]])
::
++  channels-init
  ^-  [=unreads:c channels=channels:c]
  =/  =unreads:c
    (malt ~[[[%chat ~zod %yo] [*@da 0 ~ ~]]])
  =/  chan=channel:c
    [[*posts:c ~ %list %time [~ [~zod %test]]] [~zod &] *remark:c *pending-messages:c]
  =/  channels=channels:c
    (malt ~[[[%chat ~zod %yo] chan]])
  [unreads channels]
::
++  chat-init
  ^-  chat:u
  =/  =unreads:ch
    (malt ~[[[%ship ~bus] *unread:unreads:ch]])
  :*  ~
      (silt ~[~bus])
      unreads
      ~
      ~
  ==
--
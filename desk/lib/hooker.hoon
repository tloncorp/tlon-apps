/-  h=hooker, c=channels
/+  cj=channel-json
=*  z  ..zuse
|%
++  enjs
  =,  enjs:format
  |%
  ::
  +|  %primitives
  ++  ship
    |=  s=ship:z
    s+(scot %p s)
  ::
  +|  %basics
  ++  hook
    |=  hok=hook:h
    %-  pairs
    :~  path+(path path.hok)
        name/s/name.hok
        signature+(signature signature-header.hok)
        whitelist+(whitelist whitelist.hok)
    ==
  ::
  ++  signature
    |=  s=signature-header:h
    %-  pairs
    :~  name/s/name.s
        prefix/?~(prefix.s ~ s/u.prefix.s)
    ==
  ++  whitelist
    |=  w=whitelist:h
    :-  %a
    %+  turn
      ~(tap in w)
    |=  =address:eyre
    %-  pairs
    :~  type/s/-.address
        :-  %address
        :-  %s
        ?-  -.address
          %ipv4  (scot %if +.address)
          %ipv6  (scot %is +.address)
        ==
    ==
  ::
  :: +|  %action
  ::
  +|  %updates
  ++  response
    |=  r=response:h
    %+  frond  -.r
    ?-  -.r
      %create-hook  (hook hook.r)
      %update-hook  (hook hook.r)
      %remove-hook  (path path.r)
    ==
  ::
  --
::
++  dejs
  =,  dejs:format
  |%
  +|  %primitives
  ++  ship  `$-(json ship:z)`(su ship-rule)
  ++  ship-rule  ;~(pfix sig fed:ag)
  +|  %action
  ++  action
    %-  of
    %+  welp
      commands
    :~  create-hook/create
        update-hook/update
        remove-hook/pa
    ==
  ::
  ++  create
    %-  ot
    :~  path/(mu pa)
        name/so
        signature/signature
        whitelist/whitelist
    ==
  ++  update
    %-  ot
    :~  path/pa
        name/so
        signature/signature
        whitelist/whitelist
    ==
  ::
  ++  orders  (ar command)
  ++  command
    ^-  $-(json command:h)
    (of commands)
  ++  commands
    :~  message/message
        store/store
        poke/poke
    ==
  ::
  ++  message
    %-  ot
    :~  nest/nest:dejs:cj
        story/story:dejs:cj
    ==
  ::
  ++  store
    %-  ot
    :~  key/so
        data/(om so)
    ==
  ::
  ++  poke
    %-  ot
    :~  wire/pa
      ::
        :-  %dock
        %-  ot
        :~  ship/ship
            app/(se %tas)
        ==
      ::
        cask/cask
    ==
  ::
  ++  cask
    |=  j=json
    ^-  (^cask *)
    =/  atom  ((se %uw) j)
    ;;((^cask *) (cue atom))
  ::
  ++  signature
    %-  ot
    :~  name/so
        prefix/(mu so)
    ==
  ::
  ++  whitelist
    %-  as
    %-  of
    :~  ipv4/(se %if)
        ipv6/(se %is)
    ==
  --
--

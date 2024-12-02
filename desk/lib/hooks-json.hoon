/-  h=hooks, c=channels, m=meta
/+  cj=channel-json, gj=groups-json
=*  z  ..zuse
|%
++  enjs
  =,  enjs:format
  |%
  ++  id
    |=  i=id:h
    s+(scot %uv i)
  ++  hooks
    |=  hks=hooks:h
    %-  pairs
    :~  hooks+(hook-map hooks.hks)
        order+(order order.hks)
        crons+(crons crons.hks)
    ==
  ::
  ++  hook-map
    |=  hks=(map id:h hook:h)
    %-  pairs
    %+  turn
      ~(tap by hks)
    |=  [=id:h hk=hook:h]
    [(scot %uv id) (hook hk)]
  ::
  ++  hook
    |=  hk=hook:h
    %-  pairs
    :~  id+(id id.hk)
        version+s+`@tas`version.hk
        name+s+name.hk
        meta+(meta:enjs:gj meta.hk)
        src+s+src.hk
        compiled+b+?=(^ compiled.hk)
        config+(config-map config.hk)
    ==
  ::
  ++  config-map
    |=  cfg=(map nest:c config:h)
    %-  pairs
    %+  turn
      ~(tap by cfg)
    |=  [=nest:c con=config:h]
    [(nest-cord:enjs:cj nest) (config con)]
  ++  config
    |=  con=config:h
    %-  pairs
    %+  turn
      ~(tap by con)
    |=  [key=@t noun=*]
    [key s+(scot %uw `@uw`(jam noun))]
  ++  order
    |=  ord=(map nest:c (list id:h))
    %-  pairs
    %+  turn
      ~(tap by ord)
    |=  [=nest:c seq=(list id:h)]
    [(nest-cord:enjs:cj nest) a+(turn seq id)]
  ++  crons
    |=  crs=(map id:h (map origin:h cron:h))
    %-  pairs
    %+  turn
      ~(tap by crs)
    |=  [=id:h cr=(map origin:h cron:h)]
    [(scot %uv id) (cron-map cr)]
  ++  cron-map
    |=  cr=(map origin:h cron:h)
    %-  pairs
    %+  turn
      ~(tap by cr)
    |=  [=origin:h crn=cron:h]
    :_  (cron crn)
    ?@(origin 'global' (nest-cord:enjs:cj origin))
  ++  cron
    |=  crn=cron:h
    %-  pairs
    :~  hook+(id hook.crn)
        schedule+(schedule schedule.crn)
        config+(config config.crn)
    ==
  ++  schedule
    |=  sch=schedule:h
    %-  pairs
    :~  next+s+(scot %da next.sch)
        repeat+s+(scot %dr repeat.sch)
    ==
  ++  response
    |=  r=response:h
    %+  frond  -.r
    ?-  -.r
      %set  (set-rsp +.r)
      %gone  (id id.r)
      %order  (order-rsp +.r)
      %config  (config-rsp +.r)
      %wait  (wait-rsp +.r)
      %rest  (rest-rsp +.r)
    ==
  ++  set-rsp
    |=  [i=id:h name=@t src=@t meta=data:m error=(unit ^tang)]
    %-  pairs
    :~  id+(id i)
        name+s+name
        src+s+src
        meta+(meta:enjs:gj meta)
        error+?~(error ~ (tang u.error))
    ==
  ++  order-rsp
    |=  [=nest:c seq=(list id:h)]
    %-  pairs
    :~  nest+(nest:enjs:cj nest)
        seq+a+(turn seq id)
    ==
  ++  config-rsp
    |=  [i=id:h =nest:c con=config:h]
    %-  pairs
    :~  id+(id i)
        nest+(nest:enjs:cj nest)
        config+(config con)
    ==
  ++  wait-rsp
    |=  [i=id:h or=origin:h sch=$@(@dr schedule:h) con=config:h]
    %-  pairs
    :~  id+(id i)
        origin+s+?~(or 'global' (nest-cord:enjs:cj or))
        schedule+?@(sch s+(scot %dr sch) (schedule sch))
        config+(config con)
    ==
  ++  rest-rsp
    |=  [i=id:h or=origin:h]
    %-  pairs
    :~  id+(id i)
        origin+s+?~(or 'global' (nest-cord:enjs:cj or))
    ==
  ++  tang
    |=  t=^tang
    :-  %s
    %-  crip
    %+  roll  t
    |=  [tk=^tank tp=^tape]
    ~!  tk
    =/  next=^tape  ~(ram re tk)
    (welp (snoc tp '\0a') next)
  --
::
++  dejs
  =,  dejs:format
  |%
  ++  id  (se %uv)
  ++  action
    %-  of
    :~  add/add
        edit/edit
        del/id
        order/order
        config/config
        wait/wait
        rest/rest
    ==
  ++  add
    %-  ot
    :~  name/so
        src/so
    ==
  ++  edit
    %-  ot
    :~  id/id
        name/(mu so)
        src/(mu so)
        meta/(mu meta:dejs:gj)
    ==
  ++  order
    %-  ot
    :~  nest/nest:dejs:cj
        seq/(ar id)
    ==
  ++  config
    %-  ot
    :~  id/id
        nest/nest:dejs:cj
        config/(om noun)
    ==
  ++  noun
    |=  j=json
    (cue ((se %uw) j))
  ++  origin
    |=  j=json
    ?~(j ~ (nest:dejs:cj j))
  ++  wait
    %-  ot
    :~  id/id
        origin/origin
        schedule/schedule
        config/(om noun)
    ==
  ++  rest
    %-  ot
    :~  id/id
        origin/origin
    ==
  ++  schedule
    |=  j=json
    ?+  j  !!
        [%s *]  ((se %dr) j)
    ::
        [%o *]
      %.  j
      %-  ot
      :~  next/(se %da)
          repeat/(se %dr)
      ==
    ==
  --
--

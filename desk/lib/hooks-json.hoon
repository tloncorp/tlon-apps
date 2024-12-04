/-  h=hooks, c=channels, m=meta
/+  cj=channel-json, gj=groups-json
=*  z  ..zuse
|%
++  enjs
  =,  enjs:format
  |%
  ++  id
    |=  i=id-hook:h
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
    |=  hks=(map id-hook:h hook:h)
    %-  pairs
    %+  turn
      ~(tap by hks)
    |=  [id=id-hook:h hk=hook:h]
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
    |=  ord=(map nest:c (list id-hook:h))
    %-  pairs
    %+  turn
      ~(tap by ord)
    |=  [=nest:c seq=(list id-hook:h)]
    [(nest-cord:enjs:cj nest) a+(turn seq id)]
  ++  crons
    |=  crs=(map id-hook:h cron:h)
    %-  pairs
    %+  turn
      ~(tap by crs)
    |=  [id=id-hook:h cr=cron:h]
    [(scot %uv id) (cron cr)]
  ++  cron
    |=  cr=cron:h
    %-  pairs
    %+  turn
      ~(tap by cr)
    |=  [=origin:h =job:h]
    :_  (^job job)
    ?@(origin 'global' (nest-cord:enjs:cj origin))
  ++  job
    |=  =job:h
    %-  pairs
    :~  hook+(id id-hook.job)
        schedule+(schedule schedule.job)
        config+(config config.job)
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
      %cron  (cron-rsp +.r)
      %rest  (rest-rsp +.r)
    ==
  ++  set-rsp
    |=  [i=id-hook:h name=@t src=@t meta=data:m error=(unit ^tang)]
    %-  pairs
    :~  id+(id i)
        name+s+name
        src+s+src
        meta+(meta:enjs:gj meta)
        error+?~(error ~ (tang u.error))
    ==
  ++  order-rsp
    |=  [=nest:c seq=(list id-hook:h)]
    %-  pairs
    :~  nest+(nest:enjs:cj nest)
        seq+a+(turn seq id)
    ==
  ++  config-rsp
    |=  [i=id-hook:h =nest:c con=config:h]
    %-  pairs
    :~  id+(id i)
        nest+(nest:enjs:cj nest)
        config+(config con)
    ==
  ++  cron-rsp
    |=  [i=id-hook:h or=origin:h sch=$@(@dr schedule:h) con=config:h]
    %-  pairs
    :~  id+(id i)
        origin+s+?~(or 'global' (nest-cord:enjs:cj or))
        schedule+?@(sch s+(scot %dr sch) (schedule sch))
        config+(config con)
    ==
  ++  rest-rsp
    |=  [i=id-hook:h or=origin:h]
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
        cron/cron
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
  ++  cron
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

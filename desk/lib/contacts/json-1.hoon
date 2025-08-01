/-  c=contacts, g=groups
/+  gj=groups-json
|%
++  enjs
  =,  enjs:format
  |%
  ::
  ++  ship
    |=(her=@p n+(rap 3 '"' (scot %p her) '"' ~))
  ::
  ++  cid
    |=  =cid:c
    ^-  json
    s+(scot %uv cid)
  ::
  ++  kip
    |=  =kip:c
    ^-  json
    ?@  kip
      (ship kip)
    (cid +.kip)
  ::
  ++  value
    |=  val=value:c
    ^-  json
    ?@  val
      (frond type+s/%null)
    ?-  -.val
      %text  (pairs type+s/%text value+s+p.val ~)
      %numb  (pairs type+s/%numb value+(numb p.val) ~)
      %date  (pairs type+s/%date value+s+(scot %da p.val) ~)
      %tint  (pairs type+s/%tint value+s+(rsh 3^2 (scot %ux p.val)) ~)
      %ship  (pairs type+s/%ship value+(ship p.val) ~)
      %look  (pairs type+s/%look value+s/p.val ~)
      %flag  (pairs type+s/%flag value+(flag:enjs:gj p.val) ~)
      %set   (pairs type+s/%set value+a+(turn ~(tap in p.val) value) ~)
    ==
  ::
  ++  contact
    |=  con=contact:c
    ^-  json
    o+(~(run by con) value)
  ::
  ++  page
    |=  =page:c
    ^-  json
    a+[(contact con.page) (contact mod.page) ~]
  ::
  ++  book
    |=  =book:c
    ^-  json
    =|  kob=(map @ta json)
    :-  %o
    %-  ~(rep by book)
    |=  [[=kip:c =page:c] acc=_kob]
    ?^  kip
      (~(put by acc) (scot %uv +.kip) (^page page))
    (~(put by acc) (scot %p kip) (^page page))
  ::
  ++  directory
    |=  =directory:c
    ^-  json
    =|  dir=(map @ta json)
    :-  %o
    %-  ~(rep by directory)
    |=  [[who=@p con=contact:c] acc=_dir]
    (~(put by acc) (scot %p who) (contact con))
  ::
  ++  response
    |=  n=response:c
    ^-  json
    %+  frond  -.n
    ?-  -.n
      %self  (frond contact+(contact con.n))
      %page  %-  pairs
             :~  kip+(kip kip.n)
                 contact+(contact con.n)
                 mod+(contact mod.n)
             ==
      %wipe  (frond kip+(kip kip.n))
      %peer  %-  pairs
             :~  who+(ship who.n)
                 contact+(contact con.n)
             ==
    ==
  --
::
++  dejs
  =,  dejs:format
  |%
  ::
  ++  ship  (se %p)
  ::
  ++  cid
    |=  jon=json
    ^-  cid:c
    ?>  ?=(%s -.jon)
    (slav %uv p.jon)
  ::
  ++  kip
    |=  jon=json
    ^-  kip:c
    ?>  ?=(%s -.jon)
    ?:  =('~' (end [3 1] p.jon))
      (ship jon)
    id+(cid jon)
  ::  +ta: tag .wit parsed json with .mas
  ::
  ++  ta
    |*  [mas=@tas wit=fist]
    |=  jon=json
    [mas (wit jon)]
  ::
  ++  value
    ^-  $-(json value:c)
    |=  jon=json
    ?~  jon  ~
    =/  [type=@tas val=json]
      %.  jon
      (ot type+(se %tas) value+json ~)
    ?+  type  !!
      %text  %.  val  (ta %text so)
      %numb  %.  val  (ta %numb ni)
      %date  %.  val  (ta %date (se %da))
      %tint  %.  val
             %+  ta  %tint
             %+  cu
             |=(s=@t (slav %ux (cat 3 '0x' s)))
             so
      %ship  %.  val  (ta %ship ship)
      %look  %.  val  (ta %look so)
      %flag  %.  val  (ta %flag flag:dejs:gj)
      %set   %.  val  (ta %set (as value))
    ==
  ::
  ++  contact
    ^-  $-(json contact:c)
    (om value)
  ::
  ++  action
    ^-  $-(json action:c)
    %-  of
    :~  anon+ul
        self+contact
        page+(ot kip+kip contact+contact ~)
        edit+(ot kip+kip contact+contact ~)
        wipe+(ar kip)
        meet+(ar ship)
        drop+(ar ship)
        snub+(ar ship)
    ==
  --
--

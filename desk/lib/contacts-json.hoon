/-  c=contacts, g=groups
/+  gj=groups-json
|%
++  enjs
  =,  enjs:format
  |%
  ::  XX shadowed for compat, +ship:enjs removes the ~
  ::
  ++  ship
    |=(her=@p n+(rap 3 '"' (scot %p her) '"' ~))
  ::
  ++  action
    |=  a=action:c
    ^-  json
    %+  frond  -.a
    ?-  -.a
      %anon  ~
      %edit  a+(turn p.a field)
      %meet  a+(turn p.a ship)
      %heed  a+(turn p.a ship)
      %drop  a+(turn p.a ship)
      %snub  a+(turn p.a ship)
    ==
  ::
  ++  contact
    |=  c=contact:c
    ^-  json
    %-  pairs
    :~  nickname+s+nickname.c
        bio+s+bio.c
        status+s+status.c
        color+s+(scot %ux color.c)
        avatar+?~(avatar.c ~ s+u.avatar.c)
        cover+?~(cover.c ~ s+u.cover.c)
    ::
        =-  groups+a+-
        %-  ~(rep in groups.c)
        |=([f=flag:g j=(list json)] [s+(flag:enjs:gj f) j])
    ==
  ::
  ++  field
    |=  f=field:c
    ^-  json
    %+  frond  -.f
    ?-  -.f
      %nickname   s+nickname.f
      %bio        s+bio.f
      %status     s+status.f
      %color      s+(rsh 3^2 (scot %ux color.f))  :: XX confirm
      %avatar     ?~(avatar.f ~ s+u.avatar.f)
      %cover      ?~(cover.f ~ s+u.cover.f)
      %add-group  s+(flag:enjs:gj flag.f)
      %del-group  s+(flag:enjs:gj flag.f)
    ==
  ::
  ++  rolodex
    |=  r=rolodex:c
    ^-  json
    %-  pairs
    %-  ~(rep by r)
    |=  [[who=@p foreign:c] j=(list [@t json])]
    [[(scot %p who) ?.(?=([@ ^] for) ~ (contact con.for))] j]  :: XX stale flag per sub state?
  ::
  ++  news
    |=  n=news:c
    ^-  json
    %-  pairs
    :~  who+(ship who.n)
        con+?~(con.n ~ (contact con.n))
    ==
  --
::
++  dejs
  =,  dejs:format
  |%
  ::  for performance, @p is serialized above to json %n (no escape)
  ::  for mark roundtrips, ships are parsed from either %s or %n
  ::  XX do this elsewhere in groups?
  ::
  ++  ship  (se-ne %p)
  ++  se-ne
    |=  aur=@tas
    |=  jon=json
    ?+  jon  !!
      [%s *]  (slav aur p.jon)
    ::
      [%n *]  ~|  bad-n+p.jon
              =/  wyd  (met 3 p.jon)
              ?>  ?&  =('"' (end 3 p.jon))
                      =('"' (cut 3 [(dec wyd) 1] p.jon))
                  ==
              (slav aur (cut 3 [1 (sub wyd 2)] p.jon))
    ==
  ::
  ++  action
    ^-  $-(json action:c)
    %-  of
    :~  anon+ul
        edit+(ar field)
        meet+(ar ship)
        heed+(ar ship)
        drop+(ar ship)
        snub+(ar ship)
    ==
  ::
  ++  contact
    ^-  $-(json contact:c)
    %-  ot
    :~  nickname+so
        bio+so
        status+so
        color+nu
        avatar+(mu so)
        cover+(mu so)
        groups+(as flag:dejs:gj)
    ==
  ::
  ++  field
    ^-  $-(json field:c)
    %-  of
    :~  nickname+so
        bio+so
        status+so
        color+nu
        avatar+(mu so)
        cover+(mu so)
        add-group+flag:dejs:gj
        del-group+flag:dejs:gj
    ==
  --
--

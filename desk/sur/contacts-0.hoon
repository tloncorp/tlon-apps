/-  e=epic, g=groups
|%
+$  contact-0
  $:  nickname=@t
      bio=@t
      status=@t
      color=@ux
      avatar=(unit @t)
      cover=(unit @t)
      groups=(set flag:g)
  ==
::
+$  foreign-0  [for=$@(~ profile-0) sag=$@(~ saga-0)]
+$  profile-0  [wen=@da con=$@(~ contact-0)]
+$  rolodex  (map ship foreign-0)
::
+$  saga-0
  $@  $?  %want    ::  subscribing
          %fail    ::  %want failed
          %lost    ::  epic %fail
          ~        ::  none intended
      ==
  saga:e
::
+$  field-0
  $%  [%nickname nickname=@t]
      [%bio bio=@t]
      [%status status=@t]
      [%color color=@ux]
      [%avatar avatar=(unit @t)]
      [%cover cover=(unit @t)]
      [%add-group =flag:g]
      [%del-group =flag:g]
  ==
::
+$  action-0
  ::  %anon: delete our profile
  ::  %edit: change our profile
  ::  %meet: track a peer
  ::  %heed: follow a peer
  ::  %drop: discard a peer
  ::  %snub: unfollow a peer
  ::
  $%  [%anon ~]
      [%edit p=(list field-0)]
      [%meet p=(list ship)]
      [%heed p=(list ship)]
      [%drop p=(list ship)]
      [%snub p=(list ship)]
  ==
::  network
::
+$  update-0
  $%  [%full profile-0]
  ==
::  local
::
+$  news-0
  [who=ship con=$@(~ contact-0)]
::
++  get-contact
  |=  [=bowl:gall who=@p]
  =>  :_  ..get-contact
      [who=who our=our.bowl now=now.bowl]
  ~+  ^-  (unit contact-0)
  =/  base=path  /(scot %p our)/contacts/(scot %da now)
  ?.  ~+  .^(? %gu (weld base /$))
    ~
  =+  ~+  .^(rol=rolodex %gx (weld base /all/contact-rolodex))
  ?~  for=(~(get by rol) who)
    ~
  ?.  ?=([[@ ^] *] u.for)
    ~
  `con.for.u.for
--

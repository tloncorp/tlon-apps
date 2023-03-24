/-  e=epic, g=groups
|%
+$  contact
  $:  nickname=@t
      bio=@t
      status=@t
      color=@ux
      avatar=(unit @t)
      cover=(unit @t)
      groups=(set flag:g)
  ==
::
+$  foreign  [for=$@(~ profile) sag=$@(~ saga)]
+$  profile  [wen=@da con=$@(~ contact)]
+$  rolodex  (map ship foreign)
::
+$  epic  epic:e
+$  saga
  $@  $?  %want    ::  subscribing
          %fail    ::  %want failed
          %lost    ::  epic %fail
          ~        ::  none intended
      ==
  saga:e
::
+$  field
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
+$  action
  ::  %anon: delete our profile
  ::  %edit: change our profile
  ::  %meet: track a peer
  ::  %heed: follow a peer
  ::  %drop: discard a peer
  ::  %snub: unfollow a peer
  ::
  $%  [%anon ~]
      [%edit p=(list field)]
      [%meet p=(list ship)]
      [%heed p=(list ship)]
      [%drop p=(list ship)]
      [%snub p=(list ship)]
  ==
::
+$  update                ::  network
  $%  [%full profile]
  ==
::
+$  news                  ::  local
  [who=ship con=$@(~ contact)]
--

/-  *resource
|%
+$  contact
  $:  nickname=@t
      bio=@t
      status=@t
      color=@ux
      avatar=(unit @t)
      cover=(unit @t)
      groups=(set resource)
  ==
::
+$  profile  ?(~ update)
+$  rolodex  (map ship (pair profile ?(~ saga)))
::
+$  epic  @ud
+$  saga
  $@  $?  %try     ::  subscribing
          %fal     ::  failed
          %lev     ::  ahead
          %chi     ::  sympatico
          ~        ::  none intended
      ==           ::
  [%dex ver=epic]  ::  behind
::
+$  field
  $%  [%nickname nickname=@t]
      [%bio bio=@t]
      [%status status=@t]
      [%color color=@ux]
      [%avatar avatar=(unit @t)]
      [%cover cover=(unit @t)]
      [%add-group =resource]
      [%del-group =resource]
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
  [wen=@da con=?(~ contact)]
::
+$  news                  ::  local
  (pair ship ?(~ contact))
--

/-  *resource
|%
+$  rolodex  (map ship contact)
::
+$  contact
  $:  nickname=@t
      bio=@t
      status=@t
      color=@ux
      avatar=(unit @t)
      cover=(unit @t)
      groups=(set resource)
      last-updated=@da  :: XX move out?
  ==
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
  $%  [%drop ~]
      [%edit p=(list field)]
      [%heed =ship]  :: XX list?
      [%snub =ship]  :: XX list?
  ==
::
+$  update                ::  network
  $%  [%set c=contact]
      [%del wen=@da]
  ==
::
+$  log                   ::  local
  (pair ship (unit contact))
--

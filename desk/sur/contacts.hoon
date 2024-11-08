/-  e=epic, g=groups
|%
::
+|  %compat
::
++  okay  `epic`1
::
+|  %types
::  $value-type: contact field value type
::
+$  value-type
  $?  %text
      %numb
      %date
      %tint
      %ship
      %look
      %flag
      %set
  ==
::  $value: contact field value
::
+$  value
  $+  contact-value
  $@  ~
  $%  [%text p=@t]
      [%numb p=@ud]
      [%date p=@da]
      ::
      ::  color
      [%tint p=@ux]
      [%ship p=ship]
      ::
      ::  picture
      [%look p=@ta]
      ::
      ::  group
      [%flag p=flag:g]
      ::
      ::  uniform set
      [%set p=$|((set value) unis)]
  ==
::  +unis: whether set is uniformly typed
::
++  unis
  |=  set=(set value)
  ^-  ?
  ?~  set  &
  =/  typ  -.n.set
  |-
  ?&  =(typ -.n.set)
      ?~(l.set & $(set l.set))
      ?~(r.set & $(set r.set))
  ==
::  $contact: contact data
::
+$  contact  (map @tas value)
::  $profile: contact profile
::
::  .wen: last updated
::  .con: contact
::
+$  profile  [wen=@da con=contact]
::  $foreign: foreign profile
::
::  .for: profile
::  .sag: connection status
::
+$  foreign  [for=$@(~ profile) sag=saga]
::  $page: contact page
::
::  .con: peer contact
::  .mod: user overlay
::
+$  page  [con=contact mod=contact]
::  $cid: contact page id
::
+$  cid  @uvF
::  $kip: contact book key
::
+$  kip  $@(ship [%id cid])
::  $book: contact book
::
+$  book  (map kip page)
::  $directory: merged contacts
::
+$  directory  (map ship contact)
::  $peers: network peers
::
+$  peers  (map ship foreign)
::
+$  epic  epic:e
::
+$  saga
  $?  %want    ::  subscribing
      ~        ::  none intended
  ==
::  %anon: delete our profile
::  %self: edit our profile
::  %page: create a new contact page
::  %edit: edit a contact overlay
::  %wipe: delete a contact page
::  %meet: track a peer
::  %drop: discard a peer
::  %snub: unfollow a peer
::
+$  action
  $%  [%anon ~]
      [%self p=contact]
      [%page p=kip q=contact]
      [%edit p=kip q=contact]
      [%wipe p=(list kip)]
      [%meet p=(list ship)]
      [%drop p=(list ship)]
      [%snub p=(list ship)]
  ==
::  network update
::
::  %full: our profile
::
+$  update
  $%  [%full profile]
  ==
::  $response: local update
::
::  %self: profile update
::  %page: contact page update
::  %wipe: contact page delete
::  %peer: peer update
::
+$  response
  $%  [%self con=contact]
      [%page =kip con=contact mod=contact]
      [%wipe =kip]
      [%peer who=ship con=contact]
  ==
--

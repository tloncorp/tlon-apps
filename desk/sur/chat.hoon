/-  g=groups
|%
+$  writ   [seal memo]
+$  feel   @ta
::
+$  seal
  $:  =time
      feels=(map ship feel)
      replied=(set time)
  ==
::
+$  remark-action
  (pair flag remark-diff)
::
+$  remark-diff
  $%  [%read ~]
      [%read-at p=time]
      [?(%watch %unwatch) ~]
  ==
::
+$  flag  (pair ship term)
+$  diff
  $%  [%add p=memo]
      [%del p=time] 
      [%add-feel p=time q=ship r=feel]
      [%del-feel p=time q=ship]
    ::
      [%add-sects p=(set sect:g)]
      [%del-sects p=(set sect:g)]
  ==
::
+$  writs
  ((mop time writ) lte)
++  writs-on
  ((on time writ) lte)
+$  log
  ((mop time diff) lte)
++  log-on
  ((on time diff) lte)
+$  remark
  [last-read=time watching=_| ~]
::
+$  perm
  $:  writers=(set sect:g)
      ~
  ==
+$  chat
  [=net =remark =log =perm =writs]
::
+$  memo  
  $:  replying=(unit time)
      author=ship
      sent=time
      content=cord :: TODO
  ==
::
+$  net
  $~  [%load ~]
  $%  [%sub p=ship]
      [%pub ~] :: TODO: permissions?
      [%load ~]
  ==
::
+$  action
  (pair flag update)
+$  update
  (pair time diff)
+$  logs
  ((mop time diff) lte)
::
+$  create
  $:  group=flag  :: TODO: unmanaged-style group chats
      name=term
      title=cord
      description=cord
  ==
--

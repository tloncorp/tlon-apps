|%
+$  writs  (list [=time writ])
+$  writ   [seal memo]
::
+$  seal
  $:  =time
      feel=(jug term ship)
  ==
::

+$  flag  (pair ship term)
+$  diff
  $%  [%add p=memo]
      [%del p=time] 
      [%add-feel p=time q=term]
      [%del-feel p=time q=term]
  ==
::
+$  fleet
  ((mop time writ) lte)
++  fleet-on
  ((on time writ) lte)
+$  log
  ((mop time diff) lte)
++  log-on
  ((on time diff) lte)
+$  chat
  (trel net log fleet)
::
+$  memo  
  $:  author=ship
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
--

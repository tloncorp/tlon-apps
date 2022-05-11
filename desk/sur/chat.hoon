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
    ::
      [%create p=perm]
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
      group=flag
  ==
+$  chat
  [=net =remark =log =perm =writs]
::
+$  content
  (pair (list block) (list inline))
::
+$  block  *
::
+$  inline
  $@  @t
  $%  [%italics p=inline]
      [%bold p=inline]
      [%strike p=inline]
      [%inline-code p=inline]
      [%blockquote p=(list inline)]
      [%block p=@ud q=cord]
      [%code p=cord]
      [%tag p=cord]
      [%link p=cord q=cord]
      [%break ~]
  ==
::
+$  memo  
  $:  replying=(unit time)
      author=ship
      sent=time
      =content
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
      readers=(set sect:g)
  ==
--

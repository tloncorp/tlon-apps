/-  g=groups
|%
+$  writ   [seal memo]
+$  id     (pair ship time)
+$  feel   @ta
::
+$  seal
  $:  =id
      feels=(map ship feel)
      replied=(set id)
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
  $%  [%writs p=diff:writs]
      [%draft p=content]
    ::
      [%add-sects p=(set sect:g)]
      [%del-sects p=(set sect:g)]
    ::
      [%create p=perm]
  ==

+$  index   (map id time)
::
+$  pact
  $:  wit=writs
      dex=index
  ==
::
++  writs
  =<  writs
  |%
  +$  writs
    ((mop time writ) lte)
  ++  on
    ((^on time writ) lte)
  +$  diff
    (pair id delta)
  +$  delta
    $%  [%add p=memo]
        [%del ~]
        [%add-feel p=ship q=feel]
        [%del-feel p=ship]
    ==
  --
::
++  dm
  |%
  +$  dm
    $:  =writs
        dex=index
    ==
  +$  id      (pair ship time)
  +$  diff    diff:writs
  +$  action  (pair ship diff)
  --
::
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
  [=net =remark =log =perm =pact draft=content]
::
+$  content
  (pair (list block) (list inline))
::
+$  block
  $%  [%image src=cord height=@ud width=@ud alt=cord]
  ==
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
  $:  replying=(unit id)
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

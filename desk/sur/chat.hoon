/-  g=groups
/-  meta
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
+$  whom
  $%  [%flag p=flag]
      [%ship p=ship]
      [%club p=id:club]
  == 
::
++  briefs
  =<  briefs
  |% 
  +$  briefs
    (map whom brief)
  +$  brief
    [last=time count=@ud read-id=(unit id)]
  +$  update
    (pair whom brief)
  --
::
+$  remark-action
  (pair whom remark-diff)
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
      [%draft p=story]
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
++  club
  =<  club
  |%
  +$  id  @uwH
  +$  net  ?(%archive %invited %done)
  +$  club
    $:  team=(set ship)
        hive=(set ship)
        met=data:meta
        =pact
        =net
    ==
  ::
  +$  rsvp    [=id =ship ok=?]
  +$  create
    [=id team=(set ship) hive=(set ship)]
  ::
  +$  invite  create
  +$  diff    diff:writs
  +$  action  (pair id diff)
  --
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
  =<  dm
  |%
  +$  dm
    $:  =pact
        =remark
        =net
    ==
  +$  net     ?(%inviting %invited %archive %done)
  +$  id      (pair ship time)
  +$  diff    diff:writs
  +$  action  (pair ship diff)
  +$  rsvp    [=ship ok=?]
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
  [=net =remark =log =perm =pact draft=story]
::
+$  notice  [pfix=@t sfix=@t]
::
+$  content
  $%  [%story p=story]
      [%notice p=notice]
  ==
::
+$  draft
  (pair whom story)
::
+$  story
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

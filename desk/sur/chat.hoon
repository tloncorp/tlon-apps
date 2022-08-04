/-  g=groups
/-  meta
/-  cite
|%
+$  writ   [seal memo]
+$  id     (pair ship time)
+$  feel   @ta
+$  said   (pair flag writ)
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
    ::
      [%add-sects p=(set sect:g)]
      [%del-sects p=(set sect:g)]
    ::
      [%create p=perm q=(unit pact)]
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
  +$  id  @uvH
  +$  net  ?(%archive %invited %done)
  +$  club  [=pact crew]
  ::
  +$  crew
    $:  team=(set ship)
        hive=(set ship)
        met=data:meta
        =net
        pin=_|
    ==

  ::
  +$  rsvp    [=id =ship ok=?]
  +$  create
    [=id hive=(set ship)]
  ::
  +$  invite  [=id team=(set ship) hive=(set ship) met=data:meta]
  +$  echo    @ud  :: number of times diff has been echoed
  +$  diff    (pair echo delta)
  ::
  +$  delta    
    $%  [%writ =diff:writs]
        [%meta meta=data:meta]
        [%team =ship ok=?]
        [%hive by=ship for=ship add=?]
        [%init team=(set ship) hive=(set ship) met=data:meta]
    ==
  ::
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
        pin=_|
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
+$  chat
  [=net =remark =log =perm =pact]
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
      [%cite =cite]
  ==
::
+$  inline
  $@  @t
  $%  [%italics p=(list inline)]
      [%bold p=(list inline)]
      [%strike p=(list inline)]
      [%blockquote p=(list inline)]
      [%inline-code p=cord]
      [%ship p=ship]
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
::  $perm: represents the permissions for a channel and gives a pointer
::  back to the group it belongs to.
::
+$  perm
  $:  writers=(set sect:g)
      group=flag:g
  ==
::
::  $leave: a flag to pass for a channel leave
::
+$  leave  flag:g
::
::  $create: represents a request to create a channel
::    
::    The name will be used as part of the flag which represents the
::    channel. $create is consumed by the chat agent first 
::    and then passed to the groups agent to register the channel with 
::    the group. 
::  
::    Write permission is stored with the specific agent in the channel,
::    read permission is stored with the group's data.
::
+$  create
  $:  group=flag:g
      name=term
      title=cord
      description=cord
      readers=(set sect:g)
      writers=(set sect:g)
  ==
--

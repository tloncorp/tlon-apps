::
::  Yet another Triple J Production
::
::  special thanks to ~wicrun-wicrum and ~hodzod-walrus for walking us
::  through sss and nectar respectively.
::
/-  n=nectar, g=groups
/-  metadata-store
|%
::
::
+$  vote   ?(%up %down)
+$  edits  ((mop @da ,[who=@p content=@t]) gth)
++  om-edits  ((on @da ,[who=@p content=@t]) gth)
::
::
+$  flag   flag:g
+$  join   [group=flag:g chan=flag:g]
+$  leave  flag:g
++  met  metadata-store
::  $create: represents a request to create a channel
::
::    The name will be used as part of the flag which represents the
::    channel. $create is consumed by the diary agent first and then
::    passed to the groups agent to register the channel with the group.
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
::
::  $briefs: a map of diary unread information
::
::    brief: the last time a board was read, how many posts since,
::    and the id of the last read note
::
++  briefs
  =<  briefs
  |%
  +$  briefs
    (map flag brief)
  +$  brief
    [last=@ud count=@ud]
  +$  update
    (pair flag brief)
  --
::
::  $remark: a marker representing the last note I've read
::
+$  remark
  [last-read=@ud watching=_| ~]
::
+$  remark-action
  (pair flag remark-diff)
::
+$  remark-diff
  $%  [%read ~]
      [%read-at p=time]          :: NOTE: unused
      [?(%watch %unwatch) ~]     :: NOTE: unused
  ==
::
+$  perm
  $:  writers=(set sect:g)
      group=flag:g
  ==
::
::
+$  import  [=flag:g =path]
::
::
+$  metadata
  $:  board=flag
      perm=perm
      title=@t                ::  same as %groups title:meta
      description=@t          ::  same as %groups description:meta
      allowed-tags=(set term)
      next-id=@
  ==
::
+$  board
  $:  =metadata
      =database:n
  ==
::
+$  post
  $:  post-id=@
      parent-id=@
      comments=(set @)
      votes=(map @p vote)
      history=edits
      thread=(unit thread-meta)
      board=flag
      group=flag
  ==
::
+$  thread-meta
  $:  replies=(set @)
      best-id=@
      title=@t
      tags=(set term)
  ==
::
+$  thread
  $:  thread=post
      posts=(list post)
  ==
::
+$  page
  $:  posts=(list post)
      pages=@
  ==
::
::
++  query
  |%
  +$  param  ?(%content %author %tag)
  +$  token  [param=param check=@t]
  --
::
++  order
  |%
  +$  param  ?(%score %best %act-date %pub-date)
  +$  desc   ?
  +$  spec   [param=param desc=desc]
  --
::
::
++  table
  |%
  ::
  +$  spec   [name=term schema=(list [term column-type:n])]
  ++  specs  `(list spec)`~[spec:thread spec:post]
  +$  name   ?(%threads %posts)
  ++  names  `(list name)`~[name:thread name:post]
  ::
  ++  post
    |%
    ++  spec  `^spec`[name=name schema=schema]
    ++  name  %posts
    ++  schema
      :~  [%post-id [0 | %ud]]     ::  minimum value is 1
          [%parent-id [1 | %ud]]   ::  0 -> no parent
          [%child-ids [2 | %set]]  ::  (set @ud): comments on the post
          [%votes [3 | %map]]      ::  (map @p vote)
          [%history [4 | %blob]]   ::  (mop @da [who=@p content=@t])
      ==
    --
  ::
  ++  thread
    |%
    ++  spec  `^spec`[name=name schema=schema]
    ++  name  %threads
    ++  schema
      :~  [%post-id [0 | %ud]]     ::  join column for 'posts-schema'
          [%child-ids [1 | %set]]  ::  (set @ud): replies to the thread
          [%best-id [2 | %ud]]     ::  0 -> no best
          [%title [3 | %t]]        ::
          [%tags [4 | %set]]       ::  (set term)
      ==
    --
  --
::
::
+$  action
  (pair flag update)
::
+$  update
  $%  [%new-board group=flag writers=(list sect:g) title=@t description=@t tags=(list term)]
      [%edit-board title=(unit @t) description=(unit @t) tags=(unit (list term))]
      [%delete-board ~]
      [%new-thread title=@t tags=(list term) content=@t]
      [%edit-thread post-id=@ best-id=(unit @) title=(unit @t) tags=(unit (list term))]
      [%new-reply parent-id=@ content=@t is-comment=?]
      [%edit-post post-id=@ content=@t]
      [%delete-post post-id=@]
      [%vote post-id=@ dir=vote]
      [%add-sects sects=(list sect:g)]
      [%del-sects sects=(list sect:g)]
      [%placeholder ~]  :: to avoid mint vain errors with ?+
  ==
--

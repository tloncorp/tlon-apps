/-  g=groups
|%
::  $rope: notification origin
::    
::    Shows where a notification has come from. Used to group
::    notifications into threads
+$  rope
  $:  gop=(unit flag)                 :: originating group
      can=(unit nest:g)               :: originating channel
      des=desk                        :: originating desk
      ted=path                        :: threading identifer
  ==
::  $thread: notification group
::
+$  thread  (set id)
::  $id: notification identifier
+$  id   @uvH
::  $yarn: notification
+$  yarn
  $:  =id
      rop=rope                       :: origin
      tim=time                       :: time sent
      con=(list content)             :: content of notification
      wer=path                       :: where to link to in FE
      but=(unit button)              :: action, if any
  ==
::
+$  button
  $:  title=cord
      handler=path
  ==
+$  flag  (pair ship term)
::  $content: notification text to be rendered
+$  content
  $@  @t
  $%  [%ship p=ship]
      [%emph p=cord]
  ==
::  $action: Actions for hark
::  
::    %add-yarn adds a notification to the relevant inboxes, indicated
::    by the loobs in the type
::    %saw-seam marks all notifications in an inbox as unread
::    %saw-rope marks a particular rope as read in all inboxes
::
+$  action
  $%  [%add-yarn all=? desk=? =yarn] 
      [%saw-seam =seam]
      [%saw-rope =rope]
  ==
::
+$  update
  $:  yarns=(map id yarn)
      =seam
      threads=(map time thread)
  ==
::
+$  carpet
  $:  =seam
      yarns=(map id yarn)
      cable=(map rope thread)
      stitch=@ud
  ==
+$  blanket
  $:  =seam
      yarns=(map id yarn)
      =quilt
  ==
::  $seam: inbox identifier
::
::    All notifications end up in one of these inboxes
+$  seam
  $%  [%group =flag]
      [%desk =desk]
      [%all ~]
  ==
::  $rug: notifications inbox
::  
::    .new contains all "unread" notifications, grouped by $rope
::    .qul is an archive
::
+$  rug
  [new=(map rope thread) qul=quilt]
++  quilt
  =<  quilt
  |%
  ::  $quilt: inbox archive
  ::  
  ::    Threads are keyed by an autoincrementing counter that starts at
  ::    0
  ::
  +$  quilt  ((mop @ud thread) lte)
  ++  on  ((^on @ud thread) lte)
  --
::
++  skein
  $:  =time
      count=@ud
      ship-count=@ud
      top=yarn
      unread=?
  ==
--

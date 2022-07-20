|%
::
+$  rope
  $:  gop=(unit flag)                 :: originating group
      can=(unit flag)                 :: originating channel
      des=desk                        :: originating desk
      ted=path
  ==
::
+$  weave
  $:  saw=?                           :: seen?
      sem=(set seam)                 :: relevant indices
  ==
::
+$  thread
  [yarns=(set id) sen=?]
::
+$  yarn  
  $:  sem=(set seam)
      note  
  ==
::
+$  id   @uvH
::
+$  note
  $:  =id
      rop=rope
      tim=time
      con=(list content)             :: content of notification
      rig=origin                     :: originating path (should be list?)
      but=(unit button)              :: action, if any
  ==
::
+$  button
  $:  title=cord
      handler=path
  ==
::  $origin: originating path
+$  origin  path 
+$  flag  (pair ship term)
::
+$  content
  $%  [%ship p=ship]
      [%text p=cord]
      [%emph p=cord]
  ==
::
+$  action
  $%  ::
      [%add-note all=? desk=? =note]
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
+$  seam
  $%  [%group =flag]
      [%desk =desk]
      [%all ~]
  ==
+$  fibre
  [=seam =time]
::
+$  rug
  [new=(map rope thread) qul=quilt]
::
++  quilt
  =<  quilt
  |%
  +$  thread
    [yarns=(set id) sen=?]
  +$  quilt  ((mop @ud thread) lte)
  ++  on  ((^on @ud thread) lte)
  --
+$  bin  path
+$  lid  path
--

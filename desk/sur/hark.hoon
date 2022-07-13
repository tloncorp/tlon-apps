|%
::
+$  rope
  $:  gop=(unit flag)                 :: originating group
      can=(unit flag)                 :: originating channel
      des=desk                        :: originating desk
  ==
::
+$  cable  ?(%group %all)                       :: index 
+$  weave
  $:  sen=?                           :: seen?
      cab=(set cable)                 :: relevant indices
  ==
::
+$  thread
  [yarns=(set id) sen=?]
::
+$  yarn  note
::
+$  id   @uvH
::
+$  note
  $:  =id
      rop=rope
      ted=path                        :: threading identifier
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
      [%add-note inbox=? =note]
      [%saw-seam =seam]
  ==
+$  seam
  $%  [%group =flag]
      [%desk =desk]
  ==
::
++  quilt
  =<  quilt
  |%
  +$  thread
    [yarns=(set id) sen=?]
  +$  quilt  ((mop time thread) lte)
  ++  on  ((^on time thread) lte)
  --
+$  bin  path
+$  lid  path
--

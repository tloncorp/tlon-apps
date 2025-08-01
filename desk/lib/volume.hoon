::  volume: groups notification settings
::
/-  g=groups
::
^?
|%
+$  value  ?(~ level)  ::  default or set
+$  level
  $~  %soft
  $?  %loud  ::  always notify
      %soft  ::  sometimes notify
      %hush  ::  never notify
  ==
::
+$  scope
  $@  ~
  $%  [%group flag:g]
      [%channel nest:g]
  ==
+$  volume
  $:  base=level
      area=(map flag:g level)  ::  override per group
      chan=(map nest:g level)  ::  override per channel
  ==
::
::  +fit-level: full "do we want a notification for this" check
::
++  fit-level
  |=  [our=@p now=@da]
  =+  get-level=(get-level our now)
  |=  [=scope =level]
  %+  gte-level  level
  (get-level scope)
::  +gte-level: whether to send a notification
::
++  gte-level
  |=  [send=level conf=level]
  ^-  ?
  ?-  conf
    %hush  |
    %soft  !=(%loud send)
    %loud  &
  ==
::
++  get-level
  |=  [our=@p now=@da]
  |=  =scope
  ^-  level
  *level
--

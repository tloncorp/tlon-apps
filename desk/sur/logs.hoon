/+  mp=mop-extensions
::
|%
::  $echo: formatted message
+$  echo  (list tank)
::  $volume: echo volume
+$  volume  ?(%dbug %info %warn %crit)
++  volume-level
  ^~  ^-  (map volume @ud)
  %-  my
  :~  [%dbug 0]
      [%info 1]
      [%warn 2]
      [%crit 3]
  ==
::  $log-event
::
::  %fail: agent failure (always considered critical)
::  %tell: agent message
::
+$  log-event
  $%  [%fail desc=term trace=tang]
      [%tell vol=volume =echo]
  ==
::  $log-item: event with timestamp
+$  log-item  [=time event=log-event]
::  $log-data: supplemental data
+$  log-data  (list (pair @t json))
::
+$  a-log
  $%  [%log agent=dude:gall event=log-event data=log-data]
      [%set-dojo vol=(unit volume)]
      [%set-posthog vol=(unit volume)]
  ==
--

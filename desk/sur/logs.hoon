/+  mp=mop-extensions
::
|%
::  $echo: formatted message
+$  echo  (list tank)
::  $volume: echo volume
+$  volume  ?(%dbug %info %warn %crit)
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
  $%  [%log event=log-event data=log-data]
  ==
--

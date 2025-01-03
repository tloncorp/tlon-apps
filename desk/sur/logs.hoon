/+  mp=mop-extensions
::
|%
::  $echo: formatted message
+$  echo  (list tank)
::  $volume: echo volume
+$  volume  ?(%info %warn %crit)
::  $log-event
::
::  %fail: agent failure
::  %tell: agent message
::
+$  log-event
  $%  [%fail desc=term trace=tang]
      [%tell id=(unit @ta) vol=volume =echo]
  ==
::
::  $log-item: an event with timestamp
+$  log-item  [=time event=log-event]
::
+$  a-log
  $%  [%log log-event]
  ==
--

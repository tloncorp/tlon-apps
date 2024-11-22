/+  mp=mop-extensions
::
|%
::  $log-event
::
::  %fail: agent failure
::
+$  log-event
  $%  [%fail desc=term crash=tang]
  ==
::
::  $log-item: event with timestamp
+$  log-item  [=time event=log-event]
::
+$  a-log
  $%  [%log log-event]
  ==
--

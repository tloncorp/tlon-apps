/+  mp=mop-extensions
::
|%
::  $log-event
::
::XX  %tell: agent message
::  %fail: agent failure
::
+$  log-event
  $%  [%fail desc=term crash=tang]
  ==
+$  id-event  time
::
::  $log-item: event with timestamp
+$  log-item  [id=id-event event=log-event]
::
::  $log: time-ordered event log
+$  log  ((mop id-event log-event) lth)
++  on-log  ((on id-event log-event) lth)
++  mo-log  ((mp id-event log-event) lth)
::
::  $logs: log per agent
++  logs  (map @tas log)
::
+$  a-log
  $%  [%log log-event]
  ==
--

/+  mp=mop-extensions
::
|%
::  $echo: formatted message
+$  echo  (list tank)
::  $volume: log volume
+$  volume  ?(%trace %dbug %info %warn %error %fatal)
::  $log-event
::
::  %fail: agent crash
::  %tell: agent message
::
+$  log-event
  $%  [%fail =echo desc=term trace=tang]
      [%tell vol=volume =echo]
  ==
::  $log-item: event with timestamp
+$  log-item  [=time event=log-event]
::  $log-data: supplemental log attributes
+$  log-data  (list (pair @t json))
::  +$a-log: logs action
::
::  %log: log an event with supplemental data
::  %set-volume: global logging threshold
::
+$  a-log
  $%  [%log event=log-event data=log-data]
      [%set-volume vol=(unit volume)]
  ==
++  v1  .
++  v0
  |%
  +$  volume  ?(%dbug %info %warn %crit)
  +$  log-event
    $%  [%fail desc=term trace=tang]
        [%tell vol=volume =echo]
    ==
  +$  a-log
    $%  [%log event=log-event data=log-data]
        [%set-posthog vol=(unit volume)]
    ==
  --
--

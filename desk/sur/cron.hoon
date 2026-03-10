::  /sur/cron: types for the %cron timer agent
|%
::  +$  timer: a scheduled LLM prompt with a cron interval
+$  timer
  $:  id=@ud
      prompt=cord
      cron=cord
      period=@ud
      active=?
      created=time
      version=@ud
  ==
::  +$  timers: map of timers by sequential id
+$  timers  (map @ud timer)
--

::  /sur/cron: types for the %cron scheduled poke agent
|%
::  +$  poke-spec: target for a scheduled poke
+$  poke-spec
  $:  ship=@p
      agent=term
      mark=term
      body=@t
  ==
::  +$  timer: a scheduled poke on a repeating interval
+$  timer
  $:  id=@ud
      poke=poke-spec
      cron=cord
      period=@ud
      active=?
      created=time
      version=@ud
  ==
::  +$  timers: map of timers by sequential id
+$  timers  (map @ud timer)
--

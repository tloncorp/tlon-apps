::  Human confirmations for work operations. These are authorization receipts,
::  not tasks, workers, schedules or a second execution engine.
/-  h=harness
|%
+$  completion  [id=@uv value=(each json @t)]
+$  request
  $:  sid=session-id:h
      scope=@uv
      source=input-source:h
      actor=(unit @p)
      action=@t
      args=json
      fence=@uvH
      expires=@da
      status=?(%pending %running %done %failed %rejected)
      result=(unit (each json @t))
  ==
+$  state
  $:  owners=(set [binding=@t actor=@t])
      requests=(map @uv request)
  ==
--

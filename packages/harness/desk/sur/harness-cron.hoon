::  Shared scheduler data. The head owns time/admission; hands own delivery.
/-  h=harness, hh=harness-hand
|%
+$  pattern
  $:  minutes=(set @ud)
      hours=(set @ud)
      days=(set @ud)
      months=(set @ud)
      weekdays=(set @ud)
      any-day=?
      any-weekday=?
  ==
+$  job
  $:  kind=?(%prompt %reminder)
      timezone=@t
      destination=@t
      sid=@t
      run-sid=@t
      expression=@t
      pattern=pattern
      prompt=@t
      tools=(list tool-grant:h)
      next=@da
      remaining=@ud
      state=?(%active %paused %cancelled %complete)
      reason=@t
      last=(unit @uv)
  ==
+$  schedule
  $:  binding=@t
      actor=@t
      hand=@t
      fingerprint=@uvH
      job
  ==
+$  action
  $%  [%add id=@uv binding=@t actor=@t kind=?(%prompt %reminder) args=json]
      [%list binding=(unit @t)]
      [%cancel id=@uv]
      [%clear id=@uv]
      [%edit id=@uv revision=@uvH args=json]
      [%delete id=@uv]
      [%retry id=@uv input=@uv]
  ==
+$  request  [id=@t act=action]
--

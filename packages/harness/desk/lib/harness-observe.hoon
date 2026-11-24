::  Sparse operational events through the ship's existing Groups log sink.
::  No transcript scans, retained telemetry state, or exporter in Harness.
/-  h=harness, l=logs
/+  logs, failure=harness-failure
|%
++  summary
  |=  event=event:h
  ^-  (unit [level=volume:l name=@t data=log-data:l])
  ?+  -.event  ~
      %llm-completed
    ?.  =(%stop stop.event)  ~
    ::  Usage belongs to this final request, not the preceding tool rounds.
    :-  ~
    :*  %info
        'harness.turn.completed'
        :~  ['request' (numb:enjs:format req.event)]
            ['prompt_tokens' (numb:enjs:format prompt.usage.event)]
            ['completion_tokens' (numb:enjs:format completion.usage.event)]
        ==
    ==
      %llm-failed
    :-  ~
    :*  %error
        'harness.inference.failed'
        :~  ['request' (numb:enjs:format req.event)]
            ['kind' %s kind:(describe:failure err.event)]
        ==
    ==
      %compaction-failed
    :-  ~
    :*  %error
        'harness.compaction.failed'
        :~  ['request' (numb:enjs:format req.event)]
            ['kind' %s kind:(describe:failure err.event)]
        ==
    ==
      %halted
    `[%warn 'harness.turn.halted' ~[['kind' %s kind:(describe:failure reason.event)]]]
      %cancelled
    `[%info 'harness.turn.cancelled' ~]
  ==
++  tell
  |=  [=bowl:gall sid=@t level=volume:l name=@t data=log-data:l]
  ^-  card:agent:gall
  ::  Session names can contain user text; only a correlation hash leaves.
  =.  data  [['session' %s (scot %uv (sham sid))] data]
  (~(tell logs bowl /telemetry) level ~[leaf+(trip name)] data)
++  event
  |=  [=bowl:gall sid=@t event=event:h]
  ^-  (list card:agent:gall)
  =/  entry  (summary event)
  ?~  entry  ~
  ~[(tell bowl sid level.u.entry name.u.entry data.u.entry)]
++  crash
  |=  [=bowl:gall hook=term trace=tang]
  ^-  card:agent:gall
  ::  Stack traces may contain credentials or user input. Keep them local;
  ::  export only the Gall hook and a hash to correlate repeated failures.
  =/  data=log-data:l
    :~  ['hook' %s hook]
        ['failure' %s (scot %uv (sham trace))]
    ==
  (~(tell logs bowl /telemetry) %error ~[leaf+"harness.agent.failed"] data)
--

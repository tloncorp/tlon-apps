/-  h=hooks
/+  cu=channel-utils
|%
++  compile-hook
  |=  src=@t
  ^-  (each vase tang)
  (compile:cu src)
++  trigger-source
  |=  trig=trigger:h
  ^-  firehose-source:h
  ?-  -.trig
    %channels  %channels
    %groups  %groups
    %contacts  %contacts
    %activity  %activity
    %cron  %cron
    %webhook  %webhook
    %command  %command
  ==
++  same-resource
  |=  [expected=(unit resource-filter:h) actual=(unit resource-filter:h)]
  ^-  ?
  ?~  expected  &
  ?~  actual  |
  =((u.expected) (u.actual))
++  trigger-matches
  |=  [trig=trigger:h event=firehose-event:h]
  ^-  ?
  ?:  !=((trigger-source trig) source.event)
    |
  ?-  -.trig
    %channels
      &((=(type.trig type.event)) (same-resource ?~(nest.trig ~ `[%channels u.nest.trig]) resource.event))
    %groups
      &((=(type.trig type.event)) (same-resource ?~(flag.trig ~ `[%groups u.flag.trig]) resource.event))
    %contacts
      =(type.trig type.event)
    %activity
      =(type.trig type.event)
    %cron
      (same-resource ?~(id.trig ~ `[%id u.id.trig]) resource.event)
    %webhook
      (same-resource ?~(id.trig ~ `[%id u.id.trig]) resource.event)
    %command
      (same-resource ?~(id.trig ~ `[%id u.id.trig]) resource.event)
  ==
++  hitch-matches
  |=  [hit=hitch:h event=firehose-event:h]
  ^-  ?
  ?.  enabled.hit
    |
  %+  lien  triggers.hit
  |=  trig=trigger:h
  (trigger-matches trig event)
++  apply-hitch-patch
  |=  [hit=hitch:h patch=hitch-patch:h]
  ^-  hitch:h
  =?  triggers.hit  ?=(^ triggers.patch)  u.triggers.patch
  =?  config.hit  ?=(^ config.patch)  u.config.patch
  =?  state.hit  ?=(^ state.patch)  u.state.patch
  =?  enabled.hit  ?=(^ enabled.patch)  u.enabled.patch
  hit
++  truncate-text
  |=  [txt=@t max=@ud]
  ^-  @t
  =/  tape=tape  (trip txt)
  ?:  (gth (lent tape) max)
    (crip (slag (sub (lent tape) max) tape))
  txt
++  limit-logs
  |=  [limits=log-limits:h logs=(list log-entry:h)]
  ^-  (list log-entry:h)
  =/  trimmed
    %+  turn  logs
    |=  log=log-entry:h
    log(msg (truncate-text msg.log max-msg-length.limits))
  (scag max-entries-per-run.limits trimmed)
++  chain-next
  |=  [event=vase output=hook-output:h]
  ^-  (each vase @t)
  ?-  -.result.output
    %success
      ?~  out.result.output
        [%& event]
      [%& u.out.result.output]
    %error
      [%| msg.result.output]
  ==
++  effect-mark
  |=  effect=effect:h
  ^-  term
  ?-  -.effect
    %channels  %noun
    %groups  %noun
    %contacts  %noun
    %activity  %noun
    %dm  %noun
    %club  %noun
    %command  %noun
  ==
++  effect-payload
  |=  effect=effect:h
  ^-  vase
  ?-  -.effect
    %channels  action.effect
    %groups  action.effect
    %contacts  action.effect
    %activity  action.effect
    %dm  action.effect
    %club  action.effect
    %command  !>([cmd.effect args.effect])
  ==
--

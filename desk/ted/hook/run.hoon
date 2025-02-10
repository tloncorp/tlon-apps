/-  spider, h=hooks, c=channels, g=groups
/+  s=strandio, utils=channel-utils
=,  strand=strand:spider
^-  thread:spider
|=  arg=vase
|^
=/  m  (strand ,vase)
^-  form:m
=+  !<([~ =event:h =context-option src=@t] arg)
;<  our=@p  bind:m  get-our:s
=/  compiled=(each vase tang)  (compile:utils src)
?.  ?=(%& -.compiled)
  %-  (slog 'compilation error:' p.compiled)
  (pure:m !>(~))
;<  ctx=bowl:h  bind:m  (get-bowl context-option)
=/  gate  [p.p.compiled .*(q:subject:utils q.p.compiled)]
=+  !<(=outcome:h (slam gate !>([event ctx])))
?:  ?=(%.y -.outcome)
  %-  (slog 'hook ran successfully' ~)
  (pure:m !>(p.outcome))
%-  (slog 'hook failed:' p.outcome)
(pure:m !>(~))
+$  event-option
  $%  [%ref path=@t]
      [%event event:h]
  ==
+$  context-option
  $%  [%origin =origin:h state=(unit vase) config=(unit config:h)]
      [%context =bowl:h]
  ==
++  get-context
  |=  =context-option
  =/  m  (strand ,bowl:h)
  ^-  form:m
  ?:  ?=(%context -.context-option)  (pure:m context.context-option)
  =/  [=origin:h state=(unit vase) config=(unit config:h)]  +.context-option
  ;<  =v-channels:c  bind:m
    (scry:s v-channels:c /gx/channels/v3/v-channels/noun)
  =/  channel=(unit [=nest:c v-channel:c])
    ?~  origin  ~
    `[origin (~(gut by v-channels) origin *v-channel:c)]
  ;<  group=(unit group-ui:g)  bind:m
    =/  n  (strand (unit group-ui:g))
    ?~  channel  (pure:n ~)
    =*  flag  group.perm.perm.u.channel
    ;<  live=?  bind:n  (scry:s ? /gu/groups/$)
    ?.  live  (pure:n `*group-ui:g)
    ;<  exists=?  bind:n
      (scry:s ? /gx/groups/exists/(scot %p p.flag)/[q.flag]/noun)
    ?.  exists  (pure:n `*group-ui:g)
    ;<  =group-ui:g  bind:n
      (scry:s group-ui:g /gx/groups/groups/(scot %p p.flag)/[q.flag]/v1/noun)
    (pure:n (some group-ui))
  =/  cfg=config:h
    ?~  config  ~
    u.config
  ;<  =bowl:spider  bind:m  get-bowl:s
  =/  hook  *hook:h
  %-  pure:m
  :*  channel
      group
      v-channels
      hook(state ?~(state !>(~) u.state))
      ?~(origin ~ (~(gut by config.hook) origin ~))
      [now our src eny]:bowl
  ==
--

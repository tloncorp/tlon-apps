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
  ~&  "compilation error:"
  %-  (slog p.compiled)
  (pure:m !>(~))
~&  "compiled successfully"
;<  ctx=context:h  bind:m  (get-context context-option)
=+  !<(=outcome:h (slam p.compiled !>([event ctx])))
?:  ?=(%.y -.outcome)
  ~&  "hook ran successfully"
  (pure:m !>(p.outcome))
~&  "hook failed:"
%-  (slog p.outcome)
(pure:m !>(~))
+$  event-option
  $%  [%ref path=@t]
      [%event event:h]
  ==
+$  context-option
  $%  [%origin =origin:h state=(unit vase)]
      [%context =context:h]
  ==
++  get-context
  |=  =context-option
  =/  m  (strand ,context:h)
  ^-  form:m
  ?:  ?=(%context -.context-option)  (pure:m context.context-option)
  =/  [=origin:h state=(unit vase)]  +.context-option
  ;<  =v-channels:c  bind:m
    (scry:s v-channels:c /gx/channels/v3/v-channels/noun)
  =/  channel=(unit [=nest:c vc=v-channel:c])
    ?~  origin  ~
    `[origin (~(gut by v-channels) origin *v-channel:c)]
  ;<  group=(unit group-ui:g)  bind:m
    =/  n  (strand (unit group-ui:g))
    ?~  channel  (pure:n ~)
    =*  flag  group.perm.perm.vc.u.channel
    ;<  live=?  bind:n  (scry:s ? /gu/groups/$)
    ?.  live  (pure:n `*group-ui:g)
    ;<  exists=?  bind:n
      (scry:s ? /gx/groups/exists/(scot %p p.flag)/[q.flag]/noun)
    ?.  exists  (pure:n `*group-ui:g)
    ;<  =group-ui:g  bind:n
      (scry:s group-ui:g /groups/groups/(scot %p p.flag)/[q.flag]/v1/noun)
    (pure:n (some group-ui))
  ;<  =bowl:spider  bind:m  get-bowl:s
  =/  hook  *hook:h
  %-  pure:m
  :*  channel
      group
      v-channels
      hook(state ?~(state !>(~) u.state))
      [now our src eny]:bowl
  ==
--

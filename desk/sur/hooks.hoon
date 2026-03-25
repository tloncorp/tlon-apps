/-  c=channels, g=groups, gv=groups-ver, a=activity, ch=chat, co=contacts, m=meta
|%
::  $id-hook: a unique identifier for a hook
+$  id-hook  @uv
::
::  $hook: a function that runs on triggers in a channel, can produce
::         effects, and change its own state
::
::    .id: a unique identifier for the hook
::    .name: a human-readable name for the hook
::    .version: the version the hook was compiled with
::    .src: the source code of the hook
::    .compiled: the compiled hook
::    .state: the current state of the hook
::    .config: any configuration data for the instance of the hook
::             running on a channel
::
++  hook
  $:  id=id-hook
      version=%0
      name=@t
      meta=data:m
      src=@t
      compiled=(unit vase)
      state=vase
      config=(map nest:c config)
  ==
::  $hooks: collection of hooks, the order they should be run in, hooks
::          running on a schedule, and any hooks waiting to run
++  hooks
  $:  hooks=(map id-hook hook)
      order=(map nest:c (list id-hook))
      crons=(map id-hook cron)
      waiting=(map id-wait [=origin waiting-hook])
  ==
+$  origin  $@(~ nest:c)
+$  cron  (map origin job)
+$  job
  $:  =id-hook
      =schedule
      =config
  ==
+$  schedule  [next=@da repeat=@dr]
+$  id-wait  @uv
::  $waiting-hook: metadata for when a waiting hook fires from the timer
+$  waiting-hook
  $:  id=id-wait
      hook=id-hook
      data=vase
      fires-at=time
  ==
::  $config: configuration data for a hook instance
+$  config  (map @t *)
::
::  $action: what we can do with a hook
+$  action
  $%  [%add name=@t src=@t]
      [%edit id=id-hook name=(unit @t) src=(unit @t) meta=(unit data:m)]
      [%del id=id-hook]
      [%order =nest:c seq=(list id-hook)]
      [%config id=id-hook =nest:c =config]
      [%cron id=id-hook =origin schedule=$@(@dr schedule) =config]
      [%rest id=id-hook =origin]
  ==
::
::  $response: the result of an action on a hook
+$  response
  $%  [%set id=id-hook name=@t src=@t meta=data:m error=(unit tang)]
      [%gone id=id-hook]
      [%order =nest:c seq=(list id-hook)]
      [%config id=id-hook =nest:c =config]
      [%cron id=id-hook =origin schedule=$@(@dr schedule) =config]
      [%rest id=id-hook =origin]
  ==
::  $bowl: ambient state that a hook should know about not
::         necessarily tied to a specific event
::
::    .channel: the channel that the hook is operating on
::    .group: the group that the channel belongs to
::    .channels: all the channels in the group
::    .hook: the hook that's running
::    .config: the configuration data for this instance of the hook
::    .now: the current time
::    .our: the ship that the hook is running on
::    .src: the ship that triggered the hook
::    .eny: entropy for random number generation or key derivation
::
::TODO  this type should source versioned types from other
::      agents.
+$  bowl
  $:  channel=(unit [=nest:c v-channel:c])
      group=(unit group:v9:gv)
      channels=v-channels:c
      =hook
      =config
      now=time
      our=ship
      src=ship
      eny=@
  ==
::
::  $event: the data associated with the trigger of a hook
::
::    $on-post: a post was added, edited, deleted, or reacted to
::    $on-reply: a reply was added, edited, deleted, or reacted to
::    $cron: a scheduled wake-up
::    $wake: a delayed invocation of the hook called with metadata about
::           when it fired, its id, and the event it should run with
::
+$  event
  $%  [%on-post on-post]
      [%on-reply on-reply]
      [%cron ~]
      [%wake waiting-hook]
  ==
::
::  $on-post: a hook event that fires when posts are interacted with
+$  on-post
  $%  [%add post=v-post:c]
      [%edit original=v-post:c =essay:c]
      [%del original=v-post:c]
      [%react post=v-post:c =ship react=(unit react:c)]
  ==
::
::  $on-reply: a hook event that fires when replies are interacted with
+$  on-reply
  $%  [%add parent=v-post:c reply=v-reply:c]
      [%edit parent=v-post:c original=v-reply:c =memo:c]
      [%del parent=v-post:c original=v-reply:c]
      [%react parent=v-post:c reply=v-reply:c =ship react=(unit react:c)]
  ==
::
::  $args: the arguments passed to a hook
+$  args
  $:  =event
      =bowl
  ==
::  $outcome: the result of a hook running
+$  outcome  (each return tang)
::
::  $return: the data returned from a hook
::
::    .result: whether the action was allowed or denied and any
::             transformed values
::    .effects: any actions that should be taken on other agents or wait
::    .new-state: the new state of the hook after running
::
+$  return
  $:  $:  result=event-result
          effects=(list effect)
      ==
      new-state=vase
  ==
::
::  $event-result: whether to allow the action, and any transformations to
::           the event
::
::    $allowed: represents the action being allowed to go through, and
::              the new value of the action
::    $denied: represents the action being denied along with the reason
::             that the action was denied
::
+$  event-result
  $%  [%allowed =event]
      [%denied msg=(unit cord)]
  ==
::
::  $effect: an effect that a hook can have, limited to agents in
::           the %groups desk. %wait is a special effect that will wake
::           up the same hook at a later time.  (v1 hooks)
+$  effect
  $%  [%channels =a-channels:c]
      [%groups =a-groups:v7:gv]
      [%activity =action:a]
      [%dm =action:dm:ch]
      [%club =action:club:ch]
      [%contacts =action:co]
      [%wait waiting-hook]
  ==
::
+$  channel-preview  (list [name=@t meta=data:m])
::
+$  template
  $:  from=nest:c
      hooks=(map id-hook hook)
      order=(list id-hook)
      crons=(list [id-hook job])
  ==
::
::  %hooks v2 prototype types
::
+$  hook-id  @uv
+$  hitch-id  @uv
+$  run-id  @uv
+$  req-id  @uv
+$  version  [major=@ud minor=@ud patch=@ud]
+$  hook-meta
  $:  desc=@t
      author=@p
      icon=(unit @t)
      tags=(list @tas)
  ==
+$  visibility
  $%  [%private ~]
      [%ships ships=(set @p)]
      [%public ~]
  ==
+$  hook-preview
  $:  id=hook-id
      name=@t
      meta=hook-meta
      version=version
  ==
+$  config-schema  (list config-field)
+$  config-field
  $:  name=@tas
      type=field-type
      desc=@t
      default=(unit @t)
  ==
+$  field-type
  $~  [%text ~]
  $%  [%text ~]
      [%number ~]
      [%boolean ~]
      [%ship ~]
      [%nest ~]
      [%flag ~]
      [%duration ~]
      [%list type=field-type]
  ==
+$  hook-def
  $:  id=hook-id
      name=@t
      meta=hook-meta
      src=@t
      compiled=(unit vase)
      version=version
      schema=config-schema
      =visibility
  ==
+$  trigger
  $%  [%channels type=term nest=(unit nest:c)]
      [%groups type=term flag=(unit flag:g)]
      [%contacts type=term]
      [%activity type=term]
      [%cron id=(unit @tas)]
      [%webhook id=(unit @tas)]
      [%command id=(unit @tas)]
  ==
+$  hitch
  $:  id=hitch-id
      hook-id=hook-id
      triggers=(list trigger)
      config=vase
      state=vase
      enabled=?
  ==
+$  hitch-patch
  $:  triggers=(unit (list trigger))
      config=(unit vase)
      state=(unit vase)
      enabled=(unit ?)
  ==
+$  firehose-source
  ?(%channels %groups %contacts %activity %cron %webhook %command)
+$  resource-filter
  $%  [%channels nest:c]
      [%groups flag:g]
      [%id @tas]
  ==
+$  firehose-event
  $:  source=firehose-source
      type=term
      resource=(unit resource-filter)
      body=vase
      at=@da
  ==
+$  log-level  ?(%debug %info %warn %error)
+$  log-entry
  $:  at=@da
      level=log-level
      msg=@t
  ==
+$  result
  $%  [%success out=(unit vase)]
      [%error msg=@t stack=(unit tang)]
  ==
+$  hook-output
  $:  =result
      state=vase
      logs=(list log-entry)
  ==
+$  thread-status
  $?  %pending
      %running
      %done
      %crashed
  ==
+$  run-log
  $:  id=run-id
      hitch-id=hitch-id
      started-at=@da
      ended-at=(unit @da)
      trigger=trigger
      input=vase
      status=thread-status
      output=(unit hook-output)
      logs=(list log-entry)
  ==
+$  log-limits
  $:  max-entries-per-run=@ud
      max-runs-per-hitch=@ud
      max-msg-length=@ud
  ==
+$  chain-response
  $%  [%pass event=vase]
      [%stop error=@t]
  ==
+$  thread-input
  $:  event=vase
      config=vase
      state=vase
      hook=hook-def
      hitch-id=hitch-id
  ==
+$  invocation-response
  $%  [%run run=run-log]
      [%chain req-id=req-id result=result]
  ==
+$  firehose-sub
  $:  source=firehose-source
      wire=path
      dock=[ship term]
      path=path
      live=?
  ==
+$  pending-kind
  $%  [%run req-id=(unit req-id)]
      [%chain req-id=req-id caller=term remaining=(list hitch-id) event=vase]
      [%test ~]
  ==
+$  pending-run
  $:  id=run-id
      hitch-id=hitch-id
      trigger=trigger
      started-at=@da
      kind=pending-kind
  ==
+$  hook-action
  $%  [%add-hook hook=hook-def]
      [%remove-hook id=hook-id]
      [%update-hook id=hook-id hook=hook-def]
      [%add-hitch hitch=hitch]
      [%remove-hitch id=hitch-id]
      [%update-hitch id=hitch-id patch=hitch-patch]
      [%enable-hitch id=hitch-id]
      [%disable-hitch id=hitch-id]
      [%run id=hitch-id req-id=req-id args=(unit vase)]
      [%run-chain req-id=req-id caller=term hitches=(list hitch-id) event=vase]
      [%test-run id=hitch-id event=vase]
  ==
+$  hook-state-0
  $:  %0
      hooks=(map hook-id hook-def)
      hitches=(map hitch-id hitch)
      runs=(map run-id run-log)
      pending=(map run-id pending-run)
      firehoses=(map path firehose-sub)
      limits=log-limits
  ==
--

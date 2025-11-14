/-  *channels, g=groups, gv=groups-ver, a=activity, ch=chat, co=contacts, m=meta
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
      config=(map nest config)
  ==
::  $hooks: collection of hooks, the order they should be run in, hooks
::          running on a schedule, and any hooks waiting to run
++  hooks
  $:  hooks=(map id-hook hook)
      order=(map nest (list id-hook))
      crons=(map id-hook cron)
      waiting=(map id-wait [=origin waiting-hook])
  ==
+$  origin  $@(~ nest)
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
      [%order =nest seq=(list id-hook)]
      [%config id=id-hook =nest =config]
      [%cron id=id-hook =origin schedule=$@(@dr schedule) =config]
      [%rest id=id-hook =origin]
  ==
::
::  $response: the result of an action on a hook
+$  response
  $%  [%set id=id-hook name=@t src=@t meta=data:m error=(unit tang)]
      [%gone id=id-hook]
      [%order =nest seq=(list id-hook)]
      [%config id=id-hook =nest =config]
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
  $:  channel=(unit [=nest v-channel])
      group=(unit group:v9:gv)
      channels=v-channels
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
  $%  [%add post=v-post]
      [%edit original=v-post =essay]
      [%del original=v-post]
      [%react post=v-post =ship react=(unit react)]
  ==
::
::  $on-reply: a hook event that fires when replies are interacted with
+$  on-reply
  $%  [%add parent=v-post reply=v-reply]
      [%edit parent=v-post original=v-reply =memo]
      [%del parent=v-post original=v-reply]
      [%react parent=v-post reply=v-reply =ship react=(unit react)]
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
::           up the same hook at a later time.
+$  effect
  $%  [%channels =a-channels]
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
  $:  from=nest
      hooks=(map id-hook hook)
      order=(list id-hook)
      crons=(list [id-hook job])
  ==
--

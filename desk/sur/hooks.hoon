/-  *channels, g=groups, a=activity, ch=chat, co=contacts, m=meta
|%
::  $id: a unique identifier for a hook
+$  id  @uv
::
::  $hook: a pure function that runs on triggers in a channel
::
::    $id: a unique identifier for the hook
::    $name: a human-readable name for the hook
::    $version: the version the hook was compiled with
::    $src: the source code of the hook
::    $compiled: the compiled version of the hook
::    $state: the current state of the hook
::    $config: any configuration data for the hook
::
++  hook
  $:  =id
      version=%0
      name=@t
      meta=data:m
      src=@t
      compiled=(unit vase)
      state=vase
      config=(map nest config)
  ==
::  $hooks: collection of hooks, the order they should be run in, and
::          any delayed hooks that need to be run
++  hooks
  $:  hooks=(map id hook)
      order=(map nest (list id))
      crons=(map id (map origin cron))
      delayed=(map delay-id [=origin delayed-hook])
  ==
+$  origin  $@(~ nest)
+$  delay-id  id
+$  schedule  [next=@da repeat=@dr]
+$  cron
  $:  hook=id
      =schedule
      =config
  ==
::  $delayed-hook: metadata for when a delayed hook fires from the timer
+$  delayed-hook
  $:  id=delay-id
      hook=id
      data=vase
      fires-at=time
  ==
::
+$  config  (map @t *)
+$  action
  $%  [%add name=@t src=@t]
      [%edit =id name=(unit @t) src=(unit @t) meta=(unit data:m)]
      [%del =id]
      [%order =nest seq=(list id)]
      [%config =id =nest =config]
      [%wait =id =origin schedule=$@(@dr schedule) =config]
      [%rest =id =origin]
  ==
+$  response
  $%  [%set =id name=@t src=@t meta=data:m error=(unit tang)]
      [%gone =id]
      [%order =nest seq=(list id)]
      [%config =id =nest =config]
      [%wait =id =origin schedule=$@(@dr schedule) =config]
      [%rest =id =origin]
  ==
::  $context: ambient state that a hook should know about not
::            necessarily tied to a specific event
::
::    $channel: the channel that the hook is operating on
::    $group: the group that the channel belongs to
::    $channels: all the channels in the group
::    $hook: the hook that's running
::    $config: the configuration data for this instance of the hook
::    $now: the current time
::    $our: the ship that the hook is running on
::    $src: the ship that triggered the hook
::    $eny: entropy for random number generation or key derivation
::
+$  context
  $:  channel=(unit [=nest v-channel])
      group=(unit group-ui:g)
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
      [%wake delayed-hook]
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
      =context
  ==
::  $outcome: the result of a hook running
+$  outcome  (each return tang)
::
::  $return: the data returned from a hook
::
::    $result: whether the action was allowed or denied and any
::             transformed values
::    $actions: any actions that should be taken on other agents or delay
::    $new-state: the new state of the hook after running
::
+$  return
  $:  $:  =result
          effects=(list effect)
      ==
      new-state=vase
  ==
::
::  $result: whether to allow the action, and any transformations to
::           the event
::
::    $allowed: represents the action being allowed to go through, and
::              the new value of the action
::    $denied: represents the action being denied along with the reason
::             that the action was denied
::
+$  result
  $%  [%allowed new=event]
      [%denied msg=(unit cord)]
  ==
::
::  $effect: an effect that a hook can have, limited to agents in
::           the %groups desk. $delay is a special effect that will wake
::           up the same hook at a later time.
+$  effect
  $%  [%channels =a-channels]
      [%groups =action:g]
      [%activity =action:a]
      [%dm =action:dm:ch]
      [%club =action:club:ch]
      [%contacts =action:co]
      [%wait delayed-hook]
  ==
::
--
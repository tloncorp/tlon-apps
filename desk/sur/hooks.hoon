/-  *channels, g=groups, a=activity, ch=chat, co=contacts
|%
::  $id: a unique identifier for a hook
+$  id  @uv
::
::  $hook: a pure function that runs on triggers in a channel
::
::    $id: a unique identifier for the hook
::    $name: a human-readable name for the hook
::    $origin: whether or not this hook was added by us or came through an update
::    $src: the source code of the hook
::    $compiled: the compiled nock of the hook
::    $cron: the cron schedule for the hook if it has one
::    $state: the current state of the hook
::
++  hook
  $:  =id
      name=@t
      enabled=?
      src=(rev src=(unit @t))
      compiled=(unit nock)
      cron=(unit @dr)
      state=vase
  ==
::  $hooks: collection of hooks, the order they should be run in, and
::  any delayed hooks that need to be run
++  hooks
  $:  hooks=(map id hook)
      order=(rev (list id))
      delayed=(map id delayed-hook)
  ==
::  $delayed-hook: metadata for when a delayed hook fires from the timer
+$  delayed-hook
  $:  =id
      hook=id
      wait=@dr
      data=vase
      fires-at=time
  ==
::
+$  action
  $%  [%add name=@t src=@t cron=(unit @dr)]
      [%edit =id name=@t src=@t cron=(unit @dr)]
      [%del =id]
      [%enable =id]
      [%disable =id]
      [%order seq=(list id)]
  ==
+$  response
  $%  [%set =id name=@t src=(unit @t) error=(unit tang)]
      [%order seq=(list id)]
  ==
::  $context: ambient state that a hook should know about not
::  necessarily tied to a specific event
::
::    $channel: the channel that the hook is operating on
::    $channels: all the channels in the group
::    $group: the group that the channel belongs to
::    $state: the current state of the hook
::    $now: the current time
::    $our: the ship that the hook is running on
::    $src: the ship that triggered the hook
::    $eny: entropy for random number generation or key derivation
::
+$  context
  $:  v-channel
      channels=v-channels
      =group:g
      state=vase
      now=time
      our=ship
      src=ship
      eny=@
  ==
::
::  $on-post: a hook event that fires when posts are interacted with
+$  on-post
  $%  [%add =essay]
      [%edit original=v-post =essay]
      [%del original=v-post]
      [%react post=v-post =ship react=(unit react)]
  ==
::
::  $on-reply: a hook event that fires when replies are interacted with
+$  on-reply
  $%  [%add parent=v-post =memo]
      [%edit parent=v-post original=v-reply =memo]
      [%del parent=v-post original=v-reply]
      [%react parent=v-post reply=v-reply =ship react=(unit react)]
  ==
::  $event-type: the type of event that triggers a hook
+$  event-type  ?(%on-post %on-reply %cron %delay)
::
::  $event: the data associated with the trigger of a hook
::
::    $on-post: a post was added, edited, deleted, or reacted to
::    $on-reply: a reply was added, edited, deleted, or reacted to
::    $cron: a scheduled wake-up
::    $delay: a delayed invocation of the hook called with metadata about
::    when it fired, its id, and the event it should run with
::
+$  event
  $%  [%on-post on-post]
      [%on-reply on-reply]
      [%cron ~]
      [%delay delayed-hook]
  ==
::
::  $args: the arguments passed to a hook
+$  args
  $:  event=event
      context=context
  ==
::
::  $result: the result of a hook running
::
::    $allowed: represents the action being allowed to go through, and the
::    new value of the action
::    $denied: represents the action being denied along with the reason
::    that the action was denied
::    $error: represents an error that occurred while running the hook
::
+$  result
  $%  [%allowed new=event]
      [%denied msg=(unit cord)]
  ==
::
::  $effect: an effect that a hook can have, limited to agents in
::  the %groups desk. $delay is a special effect that will wake up the
::  same hook at a later time.
+$  effect
  $%  [%channels =a-channels]
      [%groups =action:g]
      [%activity =action:a]
      [%dm =action:dm:ch]
      [%club =action:club:ch]
      [%contacts =action:co]
      [%delay =id hook=id wait=@dr data=vase]
  ==
::
::  $return: the data returned from a hook
::
::    $result: whether the action was allowed or denied, any new values,
::    or an error message if something went wrong
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
+$  outcome  (each return tang)
--
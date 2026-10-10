/-  resource
|%
+$  provider-entry
  $:  notify-endpoint=@t
      binding-endpoint=@t
      auth-token=@t
      clients=(map ship binding=(unit @t))
      =whitelist
  ==
+$  provider-state  (map term provider-entry)
+$  provider-action
  $%  [%add service=term notify=@t binding=@t auth-token=@t =whitelist]
      [%remove service=term]
      [%client-join service=term address=@t binding=@t]
      [%client-leave service=term]
  ==
::
::  $push-caps: notification kinds a device's app build knows how to render
::
::    Declared by the client each time it registers its push token. %notify
::    withholds a push whose kind requires a capability that any live device
::    has not declared, because iOS cannot suppress an alert once APNs has
::    delivered it. Kinds that predate this mechanism require nothing, so an
::    old client declaring no capabilities keeps receiving what it does today.
::
+$  push-caps  (set @t)
::
+$  client-action
  $%  [%connect-provider who=@p service=term address=@t]
      $:  %connect-provider-with-binding
          who=@p
          service=term
          address=@t
          binding=@t
          caps=push-caps
      ==
      [%remove-provider who=@p service=term]
      [%send-message message=@t]
  ==
::
+$  uid  @uvH
::
++  notification
  =<  note
  |%
  +$  note     [=bin =body]
  +$  bin      [=path =place]
  +$  place    [=desk =path]
  +$  body     [title=content =content =time binned=path link=path]
  +$  content  (list $%([%ship =ship] [%text =cord]))
  --
::
+$  whitelist
  $:  public=?
      kids=?
      users=(set ship)
      groups=(set resource:resource)
  ==
::
+$  action
  $%  [%notify ~]
      [%dismiss source=@t]
      [%message message=@t]
  ==
::
+$  update
  [notify-count=@ud =uid =action]
++  v0
  |%
  ::
  +$  action  ?(%notify %dismiss)
  +$  update
    [=uid =action]
  --
++  v1  .
--

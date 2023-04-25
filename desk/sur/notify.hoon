/-  hark=hark-store, resource, graph-store
|%
+$  provider-action
  $%  [%add service=term notify=@t binding=@t auth-token=@t =whitelist]
      [%remove service=term]
      [%client-join service=term address=@t binding=@t]
      [%client-leave service=term]
  ==
::
+$  client-action
  $%  [%connect-provider who=@p service=term address=@t]
      [%connect-provider-with-binding who=@p service=term address=@t binding=@t]
      [%remove-provider who=@p service=term]
  ==
::
+$  uid  @uvH
::
+$  notification
  [=bin:hark =body:hark]
::
+$  whitelist
  $:  public=?
      kids=?
      users=(set ship)
      groups=(set resource:resource)
  ==
::
+$  action  ?(%notify %dismiss)
::
+$  update
  [=uid =action]
--

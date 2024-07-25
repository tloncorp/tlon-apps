/-  c=channels
|%
+$  action
  $%  [%create-hook path=(unit path) name=@t =signature-header =whitelist]
      [%update-hook hook]
      [%remove-hook =path]
      command
  ==
+$  orders  (list command)
+$  command
  $%  [%message =nest:c =story:c]
      [%store key=@t =data]
      [%poke =wire =dock =mark =noun]
  ==
+$  response
  $%  [%create-hook =hook]
      [%update-hook =hook]
      [%remove-hook =path]
  ==
+$  hooks  (map path secured-hook)
+$  unsecure-hooks  (map path hook)
+$  secured-hook  [=key hook]
+$  hook
  $:  =path
      name=@t
      =signature-header
      =whitelist
      =logs
      last-request=time
  ==
+$  whitelist  (set address:eyre)
+$  signature-header
  $:  name=@t
      prefix=(unit @t)
  ==
+$  logs  ((mop time inbound-request:eyre) lte)
++  on-logs  ((on time inbound-request:eyre) lte)
+$  key  @uv
+$  collection  (map @t data)
+$  data  (map @t @t)
--
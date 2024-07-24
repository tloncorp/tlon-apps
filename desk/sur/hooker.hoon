/-  c=channels
|%
+$  action
  $%  [%create-hook path=(unit path) =signature-header =whitelist]
      [%update-hook =path =signature-header =whitelist]
      [%remove-hook =path]
      command
  ==
+$  orders  (list command)
+$  command
  $%  [%message =nest:c =story:c]
      [%store key=@t =data]
      [%poke =wire =dock =cage]
  ==
+$  response
  $%  [%create-hook =hook]
      [%remove-hook =path]
  ==
+$  collection  (map @t data)
+$  data  (map @t @t)
+$  hooks  (map path hook)
+$  hook
  $:  =key
      =path
      =signature-header
      =whitelist
  ==
+$  whitelist  (set address:eyre)
+$  signature-header
  $:  name=@t
      prefix=(unit @t)
  ==
+$  key  @uv
--
/-  c=channels
|%
+$  action
  $%  [%create-worker =path =signature-header =transformer]
      [%remove-worker =path]
      command
  ==
+$  command
  $%  [%message =nest:c =story:c]
      [%store key=@t =data]
  ==
+$  update
  $%  [%message =path =nest:c =story:c]
      [%store =path key=@t =data]
  ==
+$  response
  $%  [%create-worker =worker]
      [%remove-worker =path]
      update
  ==
+$  collection  (map @t data)
+$  data  (map @t @t)
+$  workers  (map path worker)
+$  worker
  $:  =key
      =path
      =signature-header
      =transformer
  ==
+$  transformer  ?(%direct %github %linear)
+$  signature-header
  $:  name=@t
      prefix=(unit @t)
  ==
+$  key  @uv
++  github
  |%
  +$  pull-request
    $:  action=?(%opened %closed %reopened)
        number=@ud
        repository=@t
        =pr
    ==
  +$  pr
    $:  url=@t
        title=@t
        body=@t
        draft=?
        user=@t
        reviewers=(list @t)
    ==
  --
--
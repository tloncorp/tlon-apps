::  Harness metadata and in-flight native Notes requests. Accepted document
::  bodies and public HTML belong to %notes, never to these records.
/-  n=notes, w=harness-workspace
|%
+$  reply  $%([%acp connection=@t id=json] [%native id=@t] [%work id=@uv])
+$  link
  $:  note=@ud
      sources=(map @ud (list source:w))
      authors=(map @ud actor:w)
  ==
+$  pending
  $:  id=@uv
      =reply
      action=@t
      args=json
      artifact=@t
      candidate=artifact:w
      value=content:w
      by=actor:w
      proposal=(unit @t)
      stage=?(%book %write)
      sent=?
      command=a-notes:n
      uncertain=?
  ==
+$  state
  $:  book=(unit flag:n)
      folder=@ud
      links=(map @t link)
      pending=(unit pending)
      connected=?
  ==
--

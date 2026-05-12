::  pioneer/create-group-invite: send a direct invite to one or more ships
::
::    arg (json):
::      { "flag":  "~ship/group-name",
::        "ships": ["~target", ...],
::        "note":  "..."                  // optional invitation note text
::      }
::
::    note: the existing groups protocol routes invites by ship identity.
::    if you want a shareable @uv token instead, use create-lure-invite or
::    create-group-lure-invite (those go through %reel).
::
::    return: ~ on success
::
/-  spider, g=groups, gv=groups-ver
/+  *strandio, gj=groups-json
=,  strand=strand:spider
=,  dejs:format
^-  thread:spider
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
;<  our=@p  bind:m  get-our
=+  !<(=json arg)
=/  args=[=flag:g ships=(list ship) note=(unit @t)]
  %.  json
  %-  ot
  :~  flag+flag:dejs:gj
      ships+(ar (se %p))
      note+(mu so)
  ==
=/  ships=(set ship)  (sy ships.args)
=/  =a-invite:v8:gv
  ?~  note.args  [~ ~]
  [~ `[[%inline u.note.args ~] ~]]
=/  =a-groups:v8:gv
  [%invite flag.args ships a-invite]
;<  ~  bind:m  (poke [our %groups] group-action-4+!>(a-groups))
(pure:m !>(~))

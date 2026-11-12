::  The HTTP lifetime covers admission and a sanitized reply, never a login.
/-  spider, hosted=harness-hosted
/+  io=strandio, j=harness-workspace-json
=,  strand=strand:spider
|%
++  call
  |=  [action=@t arg=vase]
  (call-to %harness action arg)
++  call-to
  |=  [agent=@tas action=@t arg=vase]
  =/  m  (strand ,vase)
  ^-  form:m
  =/  input  !<((unit json) arg)
  =/  args=json  (fall input [%o ~])
  ?>  ?=(%o -.args)
  ::  Authoring allows a 64 KiB body, including JSON escape expansion.
  =/  limit  ?:(|(=('soul' action) =('skills' action)) 409.600 16.384)
  ?>  (lte (met 3 (en:json:html args)) limit)
  ;<  our=@p  bind:m  get-our:io
  ;<  now=@da  bind:m  get-time:io
  ;<  entropy=@uvJ  bind:m  get-entropy:io
  =/  id  (scot %uv (sham [our now entropy action]))
  =/  direct-actions
    %-  silt
    ~['settings' 'permissions' 'channels' 'chat-config' 'models' 'soul' 'skills']
  =/  needs-request-id
    ?&  !(~(has in direct-actions) action)
        ?~((optional:j args 'requestId') & |)
    ==
  =?  p.args  needs-request-id
    (~(put by p.args) 'requestId' [%s id])
  ;<  ~  bind:m  (watch:io /response [our agent] /hosted/[id])
  ;<  ~  bind:m  (poke:io [our agent] %harness-hosted !>(`request:hosted`[id action args]))
  ;<  result=cage  bind:m  (take-fact:io /response)
  ?>  =(%json p.result)
  (pure:m !>(!<(json q.result)))
--

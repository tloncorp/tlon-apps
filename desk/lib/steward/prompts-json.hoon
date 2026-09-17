::  steward prompts JSON boundary
::
/-  p=steward-prompts
|%
++  dejs
  =,  dejs:format
  |%
  ++  prompts  (om so)
  ++  ship-files  (op ;~(pfix sig fed:ag) prompts)
  ++  request-id  (se %uv)
  ++  edit
    |=  jon=json
    ^-  edit:v1:p
    ((of set+(ot name+so text+so ~) ~) jon)
  ++  result
    |=  jon=json
    ^-  outcome:v1:p
    =/  body  (response-body jon)
    ?>  !?=(%pending -.body)
    body
  ++  response-body
    |=  jon=json
    ^-  response-body:v1:p
    ?>  ?=([%o *] jon)
    =/  type  (so (~(got by p.jon) 'type'))
    ?:  =('updated' type)  [%updated (so (~(got by p.jon) 'name'))]
    ?:  =('pending' type)
      [%pending ;;(poke-status:v1:p (so (~(got by p.jon) 'status')))]
    ?>  =('error' type)
    :+  %error
      ;;(action-error:v1:p (so (~(got by p.jon) 'errorType')))
    =/  message  (~(get by p.jon) 'message')
    ?~  message  ~
    ((ar (cu |=(t=@t leaf+(trip t)) so)) u.message)
  ++  response
    (ot 'requestId'^request-id body+response-body ~)
  ++  dispatch
    (ot 'requestId'^request-id requester+(se %p) action+edit ~)
  ++  action
    |=  jon=json
    ^-  action:v1:p
    %.  jon
    %-  of
    :~  [%project prompts]
        [%edit (ot 'requestId'^request-id bot+(se %p) action+edit ~)]
        [%finalize (ot 'requestId'^request-id body+result ~)]
    ==
  ++  update
    |=  jon=json
    ^-  update:v1:p
    %.  jon
    %-  of
    :~  [%files ship-files]
        [%set (ot ship+(se %p) name+so text+so ~)]
        [%del (ot ship+(se %p) name+so ~)]
        [%gone (ot ship+(se %p) ~)]
    ==
  --
::
++  enjs
  =,  enjs:format
  |%
  ++  prompts
    |=  files=prompts:v1:p
    ^-  json
    [%o (~(run by files) |=(text=@t s+text))]
  ++  ship-files
    |=  files=(map @p prompts:v1:p)
    ^-  json
    %-  pairs
    %+  turn  ~(tap by files)
    |=  [who=@p files=prompts:v1:p]
    [(scot %p who) (prompts files)]
  ++  request-id
    |=  id=request-id:v1:p
    ^-  json
    s+(scot %uv id)
  ++  edit
    |=  =edit:v1:p
    ^-  json
    (frond 'set' (pairs ~[['name' s+name.edit] ['text' s+text.edit]]))
  ++  tang-json
    |=  ts=(list ^tank)
    ^-  json
    :-  %a
    %+  turn  ts
    |=  t=^tank
    s+(crip (zing (join "\0a" (wash [0 80] t))))
  ++  response-body
    |=  body=response-body:v1:p
    ^-  json
    ?-  -.body
        %updated
      (pairs ~[['type' s+'updated'] ['name' s+name.body]])
        %error
      %-  pairs
      :~  ['type' s+'error']
          ['errorType' s+(scot %tas type.body)]
          ['message' (tang-json message.body)]
      ==
        %pending
      (pairs ~[['type' s+'pending'] ['status' s+(scot %tas status.body)]])
    ==
  ++  response
    |=  =response:v1:p
    ^-  json
    (pairs ~[['requestId' (request-id id.response)] ['body' (response-body body.response)]])
  ++  dispatch
    |=  =dispatch:v1:p
    ^-  json
    %-  pairs
    :~  ['requestId' (request-id id.dispatch)]
        ['requester' s+(scot %p requester.dispatch)]
        ['action' (edit edit.dispatch)]
    ==
  ++  action
    |=  =action:v1:p
    ^-  json
    ?-  -.action
        %project
      (frond 'project' (prompts prompts.action))
        %edit
      %+  frond  'edit'
      %-  pairs
      :~  ['requestId' (request-id request-id.action)]
          ['bot' s+(scot %p bot.action)]
          ['action' (edit edit.action)]
      ==
        %finalize
      %+  frond  'finalize'
      %-  pairs
      :~  ['requestId' (request-id request-id.action)]
          ['body' (response-body body.action)]
      ==
    ==
  ++  update
    |=  =update:v1:p
    ^-  json
    ?-  -.update
        %files
      (frond 'files' (ship-files files.update))
        %set
      %+  frond  'set'
      %-  pairs
      :~  ['ship' s+(scot %p ship.update)]
          ['name' s+name.update]
          ['text' s+text.update]
      ==
        %del
      (frond 'del' (pairs ~[['ship' s+(scot %p ship.update)] ['name' s+name.update]]))
        %gone
      (frond 'gone' (frond 'ship' s+(scot %p ship.update)))
    ==
  --
--

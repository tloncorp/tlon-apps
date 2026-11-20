/-  r=harness-runner
/+  j=harness-workspace-json, wire=harness-provider-wire
|%
::
++  close-streams
  |=  db=state:r
  ^-  (list card:agent:gall)
  %-  zing
  %+  turn  ~(val by registry.db)
  |=  row=runner:r
  ^-  (list card:agent:gall)
  ?~  stream.row  ~
  =/  id  u.stream.row
  :~  [%give %fact ~[/http-response/[id]] %http-response-data !>(`(unit octs)`~)]
      [%give %kick ~[/http-response/[id]] ~]
  ==
::
++  route
  |=  url=@t
  ^-  (unit @t)
  ?.  =('connected://' (end [3 12] url))  ~
  `(rsh [3 12] url)
::
++  valid-id
  |=  id=@t
  ^-  ?
  ?&  (gte (met 3 id) 1)
      (lte (met 3 id) 64)
      %+  levy  (trip id)
      |=  char=@t
      ?|  &((gte char 'a') (lte char 'z'))
          &((gte char '0') (lte char '9'))
          =('-' char)
      ==
  ==
::
++  valid-key
  |=  key=@t
  ^-  ?
  ?&  =(68 (met 3 key))
      =('hrr_' (end [3 4] key))
      %+  levy  (trip (rsh [3 4] key))
      |=  char=@t
      ?|  &((gte char '0') (lte char '9'))
          &((gte char 'a') (lte char 'f'))
      ==
  ==
::
++  header
  |=  [headers=header-list:http name=@t]
  ^-  (unit @t)
  ::  Reject duplicate headers, including differently cased spellings.
  =/  matches
    %+  skim  headers
    |=  [key=@t value=@t]
    =(name (crip (cass (trip key))))
  ?.  =(1 (lent matches))  ~
  `value:(snag 0 matches)
::
++  authenticate
  |=  [db=state:r id=@t headers=header-list:http]
  ^-  ?
  =/  token  (header headers 'authorization')
  =/  runner  (~(get by registry.db) id)
  ?~  token  |
  ?~  runner  |
  ?.  =('Bearer ' (end [3 7] u.token))  |
  =/  key  (rsh [3 7] u.token)
  ?&  !revoked.u.runner
      (valid-key key)
      =((shax key) digest.u.runner)
  ==
::
++  status
  |=  [id=@t runner=runner:r now=@da]
  ^-  json
  =/  state=@t
    ?:  revoked.runner  'revoked'
    ?:  &(?=(^ stream.runner) (lte (sub now seen.runner) ~s45))  'online'
    'offline'
  %-  pairs:enjs:format
  :~  ['id' %s id]
      ['label' %s label.runner]
      ['status' %s state]
      ['created' (stamp:j created.runner)]
  ==
::
++  owner
  |=  [db=state:r action=@t args=json now=@da]
  ^-  (each [db=state:r result=json] @t)
  ?:  =('list' action)
    =/  entries
      %+  turn  ~(tap by registry.db)
      |=  [id=@t runner=runner:r]
      (status id runner now)
    [%& db [%a entries]]
  =/  id  (string:j args 'id')
  ?.  (valid-id id)  [%| 'Use a runner ID of 1–64 lowercase letters, digits, or hyphens']
  =/  found  (~(get by registry.db) id)
  ?:  =('revoke' action)
    ?~  found  [%| 'Runner not found']
    =/  runner  u.found(revoked &)
    [%& db(registry (~(put by registry.db) id runner)) (status id runner now)]
  ?.  =('create' action)  [%| 'Unknown runner operation']
  ?^  found
    ?:  ?&  !revoked.u.found
            =((shax (string:j args 'key')) digest.u.found)
            =((string:j args 'label') label.u.found)
        ==
      [%& db (status id u.found now)]
    [%| 'Runner ID already exists; use a new ID']
  ?.  (lth ~(wyt by registry.db) 64)  [%| 'Runner capacity reached (64 retained identities)']
  =/  key  (string:j args 'key')
  =/  label  (string:j args 'label')
  ?.  (valid-key key)  [%| 'Generate a 256-bit runner key']
  ?.  &((gth (met 3 label) 0) (lte (met 3 label) 128))  [%| 'Use a label of 1–128 UTF-8 bytes']
  ?:  (lien ~(val by registry.db) |=(runner=runner:r =((shax key) digest.runner)))
    [%| 'Generate a distinct key for each runner']
  =/  runner
    %*  .  *runner:r
      label  label
      digest  (shax key)
      revoked  |
      created  now
      seen  now
      next  1
    ==
  [%& db(registry (~(put by registry.db) id runner)) (status id runner now)]
::
++  enqueue
  |=  [runner=runner:r value=json]
  ^-  (each runner:r @t)
  =/  bytes  (queued-bytes runner)
  ?.  ?&  (lth ~(wyt by events.runner) 256)
          (lte (add bytes (met 3 (en:json:html value))) 4.194.304)
      ==
    [%| 'Runner delivery queue is full; reconnect the runner']
  [%& runner(events (~(put by events.runner) next.runner value), next +(next.runner))]
::
++  queued-bytes
  |=  runner=runner:r
  ^-  @ud
  %+  roll  ~(val by events.runner)
  |=  [event=json size=@ud]
  (add size (met 3 (en:json:html event)))
::
++  continuation
  |=  value=json
  =/  choices  (get:j value 'choices')
  ?~  choices  |
  ?.  ?=(%a -.u.choices)  |
  ?~  p.u.choices  |
  =('tool_calls' (str:wire i.p.u.choices 'finish_reason'))
::
++  envelope
  |=  [request=request:r type=@t]
  ^-  json
  %-  pairs:enjs:format
  :~  ['version' (numb:enjs:format 1)]
      ['type' %s type]
      ['conversationId' %s sid.request]
      ['turnId' %s (scot %ud req.request)]
      ['attemptId' %s attempt.request]
      ['kind' %s kind.request]
      ['request' body.request]
  ==
::
++  frame
  |=  [id=@ud value=json]
  ^-  @t
  (rap 3 ~['id: ' (crip (a-co:co id)) '\0aevent: harness\0adata: ' (en:json:html value) '\0a\0a'])
--

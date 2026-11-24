::  Persistent native channel programs. Subscription precedes mutation so a
::  compiler error cannot be mistaken for a successful installation.
/-  h=hooks
/+  spec=harness-tlon-tool, hp=harness-tlon-history-page, paths=harness-tlon-paths
|_  bowl=bowl:gall
+*  read-path  ~(. paths [our now]:bowl)
++  handles
  |=  action=@t
  =/  actions=(list @t)
    :~  'hook_template'
        'list_hooks'
        'get_hook'
        'get_hook_order'
        'add_hook'
        'edit_hook'
        'delete_hook'
        'set_hook_order'
        'configure_hook'
        'schedule_hook'
        'stop_hook'
    ==
  (lien actions |=(item=@t =(item action)))
++  mutates
  |=  action=@t
  =/  actions=(list @t)
    :~  'add_hook'
        'edit_hook'
        'delete_hook'
        'set_hook_order'
        'configure_hook'
        'schedule_hook'
        'stop_hook'
    ==
  (lien actions |=(item=@t =(item action)))
++  snapshot
  ^-  hooks:h
  ?>  .^(? %gu /(scot %p our.bowl)/channels-server/(scot %da now.bowl)/$)
  .^(hooks:h %gx /(scot %p our.bowl)/channels-server/(scot %da now.bowl)/v0/hooks/hook-full)
++  identifier
  |=  raw=@t
  ^-  id-hook:h
  =/  id  (slav %uv raw)
  ?>  &(=(raw (scot %uv id)) (lte (met 0 id) 128))
  id
++  hook-id
  |=  args=json
  (identifier (required:spec args 'hook_id' 128))
++  revision
  |=  hook=hook:h
  (scot %uv (sham [name.hook src.hook meta.hook]))
++  nest-text
  |=  nest=nest:h
  %-  rap
  :-  3
  :~  kind.nest  '/'  (scot %p ship.nest)  '/'  name.nest  ==
++  owned-channel
  |=  args=json
  ^-  nest:h
  =/  nest  (nest:spec (required:spec args 'channel' 256))
  ?>  =(our.bowl ship.nest)
  ?>  .^  ?  %gu
        (channel:read-path %v4 nest)
      ==
  nest
++  config
  |=  args=json
  ^-  config:h
  =/  parsed  (need (de:json:html (string:spec args 'config' '{}' 8.192)))
  ?>  ?=(%o -.parsed)
  ?>  (lte ~(wyt by p.parsed) 64)
  %-  malt
  %+  turn  ~(tap by p.parsed)
  |=  [key=@t value=json]
  ?>  ?&  (gth (met 3 key) 0)
          (lte (met 3 key) 128)
          ?=(%s -.value)
      ==
  [key p.value]
++  order
  |=  args=json
  ^-  (list id-hook:h)
  =/  current  snapshot
  =/  parsed  (need (de:json:html (required:spec args 'hook_ids' 8.192)))
  ?>  ?=(%a -.parsed)
  ?>  (lte (lent p.parsed) 64)
  =/  ids
    %+  turn  p.parsed
    |=  value=json
    (identifier (so:dejs:format value))
  ::  The order contains distinct hooks from the live registry.
  ?>  =((lent ids) ~(wyt in (silt ids)))
  ?>  (levy ids |=(id=id-hook:h (~(has by hooks.current) id)))
  ids
++  command
  |=  args=json
  ^-  action:h
  =/  current  snapshot
  =/  action  (required:spec args 'action' 32)
  =/  confirm  (required:spec args 'confirm' 256)
  ?:  =('add_hook' action)
    =/  title  (required:spec args 'title' 128)
    ?>  =(title confirm)
    ?>  !(lien ~(val by hooks.current) |=(hook=hook:h =(title name.hook)))
    [%add title (required:spec args 'source' 16.384)]
  ?:  =('set_hook_order' action)
    =/  nest  (owned-channel args)
    ?>  =((nest-text nest) confirm)
    [%order nest (order args)]
  =/  id  (hook-id args)
  =/  hook  (~(got by hooks.current) id)
  ?>  =((scot %uv id) confirm)
  ?:  =('edit_hook' action)
    ?>  =((revision hook) (required:spec args 'revision' 128))
    ?>  |((has:spec args 'title') (has:spec args 'source'))
    :*  %edit
        id
        ?:((has:spec args 'title') `(required:spec args 'title' 128) ~)
        ?:((has:spec args 'source') `(required:spec args 'source' 16.384) ~)
        ~
    ==
  ?:  =('delete_hook' action)  [%del id]
  ?:  =('configure_hook' action)  [%config id (owned-channel args) (config args)]
  =/  =origin:h  ?:((has:spec args 'channel') (owned-channel args) ~)
  ?:  =('stop_hook' action)
    ?>  (~(has by (~(got by crons.current) id)) origin)
    [%rest id origin]
  ?>  =('schedule_hook' action)
  ?>  ?=(^ compiled.hook)
  =/  raw  (required:spec args 'schedule' 128)
  =/  repeat  (slav %dr raw)
  ?>  ?&  =(raw (scot %dr repeat))
          (gte repeat ~m1)
          (lte repeat ~d365)
      ==
  [%cron id origin [(add now.bowl repeat) repeat] (config args)]
++  metadata
  |=  hook=hook:h
  %-  pairs:enjs:format
  :~  ['hook_id' %s (scot %uv id.hook)]
      ['title' %s name.hook]
      ['compiled' %b ?=(^ compiled.hook)]
      ['revision' %s (revision hook)]
  ==
++  error-text
  |=  error=tang
  ^-  @t
  =/  render
    |=  item=tank
    ^-  wall
    (wash [0 80] item)
  =/  lines=wall  (zing (turn error render))
  (clip-text:hp (of-wain:format (turn lines |=(line=tape (crip line)))) 1.000)
++  react-example
  %-  rap
  :-  3
  :~  '|=  [=event:h =bowl:h]\0a^-  outcome:h\0a'
      '?.  ?=([%on-post %add *] event)  &+[[[%allowed event] ~] state.hook.bowl]\0a'
      '?~  channel.bowl  &+[[[%allowed event] ~] state.hook.bowl]\0a'
      '=/  effect=effect:h\0a  [%channels %channel nest.u.channel.bowl %post %add-react id.-.post.event our.bowl \'ok\']\0a'
      '&+[[[%allowed event] ~[effect]] state.hook.bowl]\0a'
  ==
++  details
  |=  [args=json current=hooks:h]
  ^-  @t
  =/  id  (hook-id args)
  =/  hook  (~(got by hooks.current) id)
  =/  start  (offset:spec args)
  =/  total  (met 3 src.hook)
  ?>  (lte start total)
  =/  rest  (rsh [3 start] src.hook)
  ::  Offsets count bytes and must begin at a UTF-8 character boundary.
  ?>  ?|  =('' rest)
          (lth (end [3 1] rest) 128)
          (gte (end [3 1] rest) 192)
      ==
  =/  text  (clip-text:hp rest 2.000)
  =/  next-offset  (add start (met 3 text))
  =/  more  (lth next-offset total)
  =/  configs
    %+  turn  ~(tap by config.hook)
    |=  [nest=nest:h values=config:h]
    =/  fields
      %+  turn  ~(tap by values)
      |=  [key=@t value=*]
      [key [%s ?@(value `@t`value (scot %uw (jam value)))]]
    %-  pairs:enjs:format
    :~  ['channel' %s (nest-text nest)]
        ['values' (pairs:enjs:format fields)]
    ==
  =/  jobs
    %+  turn  ~(tap by (~(gut by crons.current) id *cron:h))
    |=  [origin=origin:h job=job:h]
    %-  pairs:enjs:format
    :~  ['channel' ?@(origin ~ [%s (nest-text origin)])]
        ['next' %s (scot %da next.schedule.job)]
        ['repeat' %s (scot %dr repeat.schedule.job)]
    ==
  =/  body
    %-  en:json:html
    %-  pairs:enjs:format
    :~  ['hook' (metadata hook)]
        ['source' %s text]
        ['next_offset' ?:(more [%s (scot %ud next-offset)] ~)]
        ['configurations' %a configs]
        ['schedules' %a jobs]
    ==
  ?:  (gth (met 3 body) 23.000)
    'error: hook configuration exceeds the readable response limit; inspect it in native Tlon'
  body
++  run
  |=  [args=json wire=wire]
  ^-  [body=@t effect=(unit card:agent:gall)]
  =/  action  (required:spec args 'action' 32)
  ?:  =('hook_template' action)
    :-  %-  en:json:html
        %-  pairs:enjs:format
        :~  :*  'source'  %s
                '|=  [=event:h =bowl:h]\0a^-  outcome:h\0a&+[[[%allowed event] ~] state.hook.bowl]\0a'
            ==
            ['on_post_add_example' %s react-example]
            :*  'events'  %s
                'event:h is on-post/add|edit|del|react, on-reply/add|edit|del|react, cron or wake. bowl:h includes optional channel/group, our/src/now, config and hook state.'
            ==
            :*  'note'  %s
                'Native hooks can emit Tlon effects and persist after this conversation ends. There is no CPU sandbox. Install only explicitly requested automation; inspect compiled status and test before activating.'
            ==
        ==
    ~
  =/  current  snapshot
  ?:  =('list_hooks' action)
    [(en:json:html (directory:spec args (turn ~(val by hooks.current) metadata))) ~]
  ?:  =('get_hook_order' action)
    =/  nest  (owned-channel args)
    =/  ids
      %+  turn  (~(gut by order.current) nest ~)
      |=(id=id-hook:h [%s (scot %uv id)])
    :-  %-  en:json:html
        %-  pairs:enjs:format
        :~  ['channel' %s (nest-text nest)]
            ['hook_ids' %a ids]
        ==
    ~
  ?:  =('get_hook' action)  [(details args current) ~]
  ::  Validate before subscribing; validate again at dispatch against live state.
  =/  validated  (command args)
  :-  'pending: subscribing for native hook result'
  `[%pass wire %agent [our.bowl %channels-server] %watch /v0/hooks]
::  Hook facts share a subscription. Only the requested change can settle it.
++  matches
  |=  [args=json result=response:h]
  ^-  ?
  =/  action  (required:spec args 'action' 32)
  ?-  -.result
      %set
    ?:  =('add_hook' action)
      ?&  =(name.result (required:spec args 'title' 128))
          =(src.result (required:spec args 'source' 16.384))
      ==
    ?&  =('edit_hook' action)
        =(id.result (hook-id args))
        ?:((has:spec args 'source') =(src.result (required:spec args 'source' 16.384)) &)
        ?:  &(?=(~ error.result) (has:spec args 'title'))
          =(name.result (required:spec args 'title' 128))
        &
    ==
    %gone  &(=('delete_hook' action) =(id.result (hook-id args)))
      %order
    ?&  =('set_hook_order' action)
        =(nest.result (nest:spec (required:spec args 'channel' 256)))
        =(seq.result (order args))
    ==
      %config
    ?&  =('configure_hook' action)
        =(id.result (hook-id args))
        =(nest.result (nest:spec (required:spec args 'channel' 256)))
        =(config.result (config args))
    ==
      %cron
    ?&  =('schedule_hook' action)
        =(id.result (hook-id args))
        .=  origin.result
        ?:((has:spec args 'channel') (nest:spec (required:spec args 'channel' 256)) ~)
        =(config.result (config args))
        ?^  schedule.result
          =(repeat.schedule.result (slav %dr (required:spec args 'schedule' 128)))
        |
    ==
      %rest
    ?&  =('stop_hook' action)
        =(id.result (hook-id args))
        .=  origin.result
        ?:((has:spec args 'channel') (nest:spec (required:spec args 'channel' 256)) ~)
    ==
  ==
++  response
  |=  [args=json result=response:h]
  ^-  (unit @t)
  ?.  (matches args result)  ~
  ?:  ?=(%set -.result)
    ?^  error.result
      :-  ~
      %:  rap
        3
        'failed: native hook compilation; hook='
        (scot %uv id.result)
        '. Inspect get_hook before retrying. Source may be stored while the previous compiled program remains active. '
        (error-text u.error.result)
        ~
      ==
    %-  some
    %-  en:json:html
    %-  pairs:enjs:format
    :~  ['status' %s 'confirmed']
        ['hook_id' %s (scot %uv id.result)]
        ['compiled' %b &]
    ==
  :-  ~
  'confirmed: native Tlon applied the hook change; hook effects persist independently of Harness permissions'
--

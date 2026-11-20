::  Ephemeral presentation, not a work queue. Many actors and threads share
::  one Tlon context, so aggregate first and clear only when all are settled.
::  A short lease expires on crashes; renewal carries no prompts or tool args.
/-  t=harness-tlon, pr=presence, h=harness
/+  ht=harness-tools
|%
++  names
  |=  view=view:h
  ^-  (set @t)
  ?:  =(~ wait.view)  ~
  =/  items  (flop items.view)
  |-  ^-  (set @t)
      ?~  items  (silt ~['tools'])
      ?.  ?=(%assistant -.i.items)  $(items t.items)
      ::  Only the latest tool batch can own the current wait IDs. Never export
      ::  arbitrary model-supplied names, arguments, server IDs or result bodies.
      %+  roll  calls.i.items
      |=  [call=tool-call:h tools=(set @t)]
      ^-  (set @t)
      ?.  (~(has in wait.view) id.call)  tools
      (~(put in tools) ?~((tool-family:ht name.call) 'tools' name.call))
++  label
  |=  name=@t
  ^-  @t
  ?+  name  (cat 3 'Using ' name)
    %tools  'Using tools...'
    %'http_fetch'  'Fetching a page'
    %'curl'  'Making an HTTP request'
    %'web_search'  'Searching the web'
    %'read_desk_file'  'Reading a file'
    %'list_desk_files'  'Listing files'
    %'list_desk_scopes'  'Checking file access'
    %'current_time'  'Checking the time'
    %'tlon_read_history'  'Reading chat history'
    %'tlon_history_page'  'Reading older messages'
    %'tlon_search_history'  'Searching chat history'
    %'tlon_react'  'Adding a reaction'
    %'tlon_unreact'  'Removing a reaction'
    %'tlon_upload_image'  'Uploading an image'
    %'cron_add'  'Scheduling a task'
    %'reminder_add'  'Setting a reminder'
    %'cron_list'  'Checking schedules'
    %'cron_remove'  'Cancelling a schedule'
    %'call_mcp_tool'  'Using a connected service'
  ==
++  display
  |=  tools=(set @t)
  ^-  display:pr
  =/  tool-names  ~(tap in tools)
  =/  text=@t
    ?~  tool-names  'Thinking...'
    ?~  t.tool-names  (label i.tool-names)
    'Using tools...'
  =/  blob=json
    %-  pairs:enjs:format
    :~  ['protocol' %s 'tlon.computing-status.v1']
        ['thinking' %b =(~ tools)]
        :-  'toolCalls'
        :-  %a
        %+  turn  tool-names
        |=  name=@t
        %-  pairs:enjs:format
        :~  ['toolName' %s name]
            ['label' %s (label name)]
        ==
    ==
  [~ `text `(en:json:html blob)]
++  context
  |=  to=destination:t
  ^-  path
  ?-  -.to
    %dm  /dm/(scot %p who.to)
    %channel  /channel/[kind.nest.to]/(scot %p ship.nest.to)/[name.nest.to]
  ==
++  merge
  |=  [active=(map path (set @t)) to=destination:t tools=(set @t)]
  ^+  active
  =/  target  (context to)
  (~(put by active) target (~(uni in tools) (~(gut by active) target ~)))
++  sync
  |=  [our=@p now=@da leases=(map path presence-lease:t) active=(map path (set @t))]
  ^-  (quip card:agent:gall (map path presence-lease:t))
  =/  cards=(list card:agent:gall)  ~
  =/  renewed=(map path presence-lease:t)  ~
  ::  Clear contexts with no remaining work.
  =^  cards  renewed
    %+  roll  ~(tap by leases)
    |=  $:  [target=path lease=presence-lease:t]
            result=[cards=(list card:agent:gall) renewed=(map path presence-lease:t)]
        ==
    ?:  (~(has by active) target)  result
    =/  action=action-1:pr  [%clear target our %computing]
    :_  renewed.result
    :_  cards.result
    [%pass /presence %agent [our %presence] %poke %presence-action-1 !>(action)]
  ::  Retain fresh leases; renew changed tools or leases at least ten seconds old.
  =/  seed=[cards=(list card:agent:gall) renewed=(map path presence-lease:t)]  [cards renewed]
  %+  roll  ~(tap by active)
  |=  [[target=path tools=(set @t)] result=_seed]
  =/  previous  (~(get by leases) target)
  ?:  ?&  ?=(^ previous)
          =(tools tools.u.previous)
          (lth now (add at.u.previous ~s10))
      ==
    [cards.result (~(put by renewed.result) target u.previous)]
  =/  status  (display tools)
  =/  action=action-1:pr  [%set ~ [target our %computing] `~s30 status]
  :_  (~(put by renewed.result) target [now tools])
  :_  cards.result
  [%pass /presence %agent [our %presence] %poke %presence-action-1 !>(action)]
--

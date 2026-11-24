::  Client-facing JSON projections and command decoding, shared by native
::  JSON marks, ACP and snapshots. These are views of nouns, not stored state.
::  Provider wire messages live separately in harness-provider.
/-  h=harness
/+  hl=harness, routing=harness-model-routing, text=harness-text
|%
++  transcript-json
  |=  log=(list event:h)
  ^-  json
  [%a (turn (transcript:hl log) transcript-row-json)]
++  transcript-row-json
  |=  [at=@ud input-id=(unit input-id:h) =item:h]
  ^-  json
  =/  row  (item-ui-json item)
  ?>  ?=(%o -.row)
  ::  Synthetic cancellation rows share an event position; the call ID separates them.
  =/  row-id
    ?:  &(?=(%tool -.item) (is-cancelled:hl body.item))
      (rap 3 (scot %ud at) ':' call-id.item ~)
    (scot %ud at)
  :-  %o
  %-  ~(gas by p.row)
  :~  ['eventCount' (numb:enjs:format at)]
      ['id' %s row-id]
      ['inputId' ?~(input-id ~ [%s (scot %uv u.input-id)])]
      ['cancelled' %b ?:(?=(%tool -.item) (is-cancelled:hl body.item) %.n)]
  ==
::  +skills-json: the catalog for the ui (bodies withheld)
::
++  skills-json
  |=  skills=(map @t skill:h)
  ^-  json
  :-  %a
  %+  turn  ~(tap by skills)
  |=  [name=@t skill=skill:h]
  ^-  json
  %-  pairs:enjs:format
  :~  ['name' %s name]
      ['desc' %s desc.skill]
  ==
++  skill-json
  |=  [name=@t skill=skill:h]
  ^-  json
  %-  pairs:enjs:format
  :~  ['name' %s name]
      ['desc' %s desc.skill]
      ['body' %s body.skill]
      ['revision' %s (scot %uv (sham skill))]
  ==
::  json for configuration surfaces (key withheld)
::
++  config-json
  |=  config=config:h
  ^-  json
  %-  pairs:enjs:format
  :~  ['zdr' %b zdr.config]
      :-  'fallbacks'
      :-  %a
      %+  turn  fallbacks.config
      |=  choice=model-choice:h
      %-  pairs:enjs:format
      :~  ['provider' %s provider.choice]
          ['model' %s model.choice]
      ==
      ['url' %s url.config]
      ['model' %s model.config]
      ['headers' (headers-json headers.config)]
      ['system' %s system.config]
      ['max-context' (numb:enjs:format max-context.config)]
      ['tools' %a (turn tools.config grant-json)]
  ==
::  json for the ui: full session view (key withheld)
::
++  view-json
  |=  [view=view:h js-timeout=@dr]
  ^-  json
  ::  Configuration has one projection, including its credential redaction.
  =/  base  (config-json config.view)
  ?>  ?=(%o -.base)
  :-  %o
  %-  ~(gas by p.base)
  :~  ['js-timeout' (numb:enjs:format (div js-timeout ~s1))]
      ['summary' ?~(summary.view ~ [%s u.summary.view])]
      ['memory' (memory-json memory.view)]
      :-  'items'
      :-  %a
      %+  turn  (skim items.view |=(item=item:h !?=(%reasoning -.item)))
      item-ui-json
      ['pending' %b !=(~ pending.view)]
      ['wait' %a (turn ~(tap in wait.view) |=(id=@t `json`[%s id]))]
      ['err' ?~(err.view ~ [%s u.err.view])]
      :-  'origin'
      ?~  origin.view  ~
      %-  pairs:enjs:format
      :~  ['sessionId' %s from.u.origin.view]
          ['eventCount' (numb:enjs:format at.u.origin.view)]
      ==
      ['usage' (usage-json total.view)]
  ==
++  headers-json
  |=  headers=(list [name=@t value=@t])
  ^-  json
  :-  %a
  %+  turn  headers
  |=  [name=@t value=@t]
  %-  pairs:enjs:format
  :~  ['name' %s name]
      ['value' %s value]
  ==
++  usage-json
  |=  usage=usage:h
  ^-  json
  %-  pairs:enjs:format
  :~  ['prompt' (numb:enjs:format prompt.usage)]
      ['completion' (numb:enjs:format completion.usage)]
  ==
++  memory-json
  |=  notes=(map @t @t)
  ^-  json
  :-  %a
  %+  turn  ~(tap by notes)
  |=  [name=@t body=@t]
  %-  pairs:enjs:format
  :~  ['name' %s name]
      ['body' %s body]
  ==
::
++  item-ui-json
  |=  item=item:h
  ^-  json
  ?-  -.item
    %reasoning  ~
      %user
    %-  pairs:enjs:format
    :~  ['role' %s 'user']
        ['body' %s body.item]
    ==
  ::
      %assistant
    %-  pairs:enjs:format
    :~  ['role' %s 'assistant']
        ['body' %s body.item]
        :-  'calls'
        :-  %a
        %+  turn  calls.item
        |=  call=tool-call:h
        %-  pairs:enjs:format
        :~  ['id' %s id.call]
            ['name' %s name.call]
            ['args' %s args.call]
        ==
    ==
  ::
      %tool
    %-  pairs:enjs:format
    :~  ['role' %s 'tool']
        ['callId' %s call-id.item]
        ['name' %s name.item]
        ['body' %s (clean:text body.item)]
    ==
  ==
::  json for the ui: one event
::
++  event-json
  |=  event=event:h
  ^-  json
  ?-  -.event
      ?(%input-admitted %input-received %command-completed %memory-set %context-received)
    (input-event-json event)
      ?(%llm-reasoning %llm-requested %llm-routed %llm-completed %llm-failed)
    (llm-event-json event)
      ?(%tool-requested %tool-requested-2 %tool-completed)
    (tool-event-json event)
      $?  %compaction-completed  %lcm-planned  %compaction-planned
          %checkpoint-completed  %compaction-failed
      ==
    (compaction-event-json event)
      %config-replaced
    %-  pairs:enjs:format
    :~  ['type' %s 'config']
        ['model' %s model.config.event]
    ==
      %cancelled
    %-  pairs:enjs:format
    :~  ['type' %s 'cancelled']
        ['reason' %s reason.event]
    ==
      %forked
    %-  pairs:enjs:format
    :~  ['type' %s 'forked']
        ['from' %s from.event]
        ['eventCount' (numb:enjs:format at.event)]
    ==
      %retried
    %-  pairs:enjs:format
    :~  ['type' %s 'retried']
    ==
      %halted
    %-  pairs:enjs:format
    :~  ['type' %s 'halted']
        ['reason' %s reason.event]
    ==
  ==
::
++  input-event-json
  |=  event=event:h
  ^-  json
  ?>  ?=  ?(%input-admitted %input-received %command-completed %memory-set %context-received)
      -.event
  ?-  -.event
      %input-admitted
    %-  pairs:enjs:format
    :~  ['type' %s 'input']
        ['item' (item-ui-json item.event)]
    ==
      %input-received
    %-  pairs:enjs:format
    :~  ['type' %s 'input']
        ['id' %s (scot %uv id.input.event)]
        ['source' (input-source-json source.input.event)]
        ['item' (item-ui-json item.input.event)]
    ==
      %command-completed
    %-  pairs:enjs:format
    :~  ['type' %s 'command-completed']
        ['inputId' %s (scot %uv input-id.event)]
        ['name' %s name.event]
        ['body' %s (clean:text body.event)]
    ==
      %memory-set
    %-  pairs:enjs:format
    :~  ['type' %s 'memory-set']
        ['name' %s name.event]
        ['body' ?~(body.event ~ [%s u.body.event])]
    ==
      %context-received
    %-  pairs:enjs:format
    :~  ['type' %s 'context-received']
        ['inputId' %s (scot %uv input-id.event)]
        ['body' %s body.event]
    ==
  ==
::
++  llm-event-json
  |=  event=event:h
  ^-  json
  ?>  ?=(?(%llm-reasoning %llm-requested %llm-routed %llm-completed %llm-failed) -.event)
  ?-  -.event
      %llm-reasoning
    %-  pairs:enjs:format
    :~  ['type' %s 'llm-reasoning']
        ['req' (numb:enjs:format req.event)]
    ==
      %llm-requested
    %-  pairs:enjs:format
    :~  ['type' %s 'llm-requested']
        ['req' (numb:enjs:format req.event)]
        ['kind' %s kind.event]
    ==
      %llm-routed
    %-  pairs:enjs:format
    :~  ['type' %s 'llm-routed']
        ['model' %s model.config.event]
    ==
      %llm-completed
    %-  pairs:enjs:format
    :~  ['type' %s 'llm-completed']
        ['stop' %s stop.event]
        ['item' (item-ui-json item.event)]
        ['usage' (usage-json usage.event)]
    ==
      %llm-failed
    %-  pairs:enjs:format
    :~  ['type' %s 'llm-failed']
        ['err' %s err.event]
    ==
  ==
::
++  tool-event-json
  |=  event=event:h
  ^-  json
  ?>  ?=(?(%tool-requested %tool-requested-2 %tool-completed) -.event)
  ?-  -.event
      %tool-requested
    %-  pairs:enjs:format
    :~  ['type' %s 'tool-requested']
        ['name' %s name.event]
    ==
      %tool-requested-2
    %-  pairs:enjs:format
    :~  ['type' %s 'tool-requested']
        ['name' %s name.event]
        ['generation' (numb:enjs:format generation.event)]
    ==
      %tool-completed
    %-  pairs:enjs:format
    :~  ['type' %s 'tool']
        ['name' %s name.event]
        ['body' %s body.event]
    ==
  ==
::
++  compaction-event-json
  |=  event=event:h
  ^-  json
  ?>  ?=  $?  %compaction-completed  %lcm-planned  %compaction-planned
              %checkpoint-completed  %compaction-failed
          ==
      -.event
  ?-  -.event
      %compaction-completed
    %-  pairs:enjs:format
    :~  ['type' %s 'compaction']
        ['summary' %s summary.event]
    ==
      %lcm-planned
    (event-json [%compaction-planned req.event checkpoint.plan.event])
      %compaction-planned
    %-  pairs:enjs:format
    :~  ['type' %s 'compaction-planned']
        ['req' (numb:enjs:format req.event)]
        ['through' (numb:enjs:format through.plan.event)]
        ['count' (numb:enjs:format count.plan.event)]
        ['source' %s (scot %uv source.plan.event)]
        ['inputEstimate' (numb:enjs:format input.plan.event)]
        ['outputReserve' (numb:enjs:format output.plan.event)]
        ['model' %s model.plan.event]
    ==
      %checkpoint-completed
    %-  pairs:enjs:format
    :~  ['type' %s 'compaction']
        ['summary' %s summary.event]
        ['reply' ?~(reply.event ~ [%s body.u.reply.event])]
        ['usage' (usage-json usage.event)]
    ==
      %compaction-failed
    %-  pairs:enjs:format
    :~  ['type' %s 'compaction-failed']
        ['err' %s err.event]
        ['usage' (usage-json usage.event)]
    ==
  ==
::  A deliberately compact JSON projection. Native clients can consume the
::  typed event and retain every face without this projection.
::
++  input-source-json
  |=  source=input-source:h
  ^-  json
  ?-  -.source
      %work
    %-  pairs:enjs:format
    :~  ['kind' %s 'work']
        ['request' %s (scot %uv request.source)]
    ==
  ::
      %hand
    %-  pairs:enjs:format
    :~  ['kind' %s 'hand']
        ['binding' %s binding.source]
        ['hand' %s hand.source]
        ['address' %s address.source]
        ['event' %s event.source]
        ['actor' %s actor.source]
    ==
  ::
      %acp
    %-  pairs:enjs:format
    :~  ['kind' %s 'acp']
        ['client' %s client.source]
    ==
  ::
      %poke
    %-  pairs:enjs:format
    :~  ['kind' %s 'poke']
        ['ship' %s (scot %p ship.source)]
    ==
  ::
      %timer
    %-  pairs:enjs:format
    :~  ['kind' %s 'timer']
        ['name' %s name.source]
    ==
  ::
      %webhook
    %-  pairs:enjs:format
    :~  ['kind' %s 'webhook']
        ['path' %s path.source]
    ==
  ::
      %peer
    %-  pairs:enjs:format
    :~  ['kind' %s 'peer']
        ['ship' %s (scot %p ship.source)]
    ==
  ::
      %subagent
    %-  pairs:enjs:format
    :~  ['kind' %s 'subagent']
        ['parent' %s parent.source]
    ==
  ::
      %rehearsal
    %-  pairs:enjs:format
    :~  ['kind' %s 'rehearsal']
        ['parent' %s parent.source]
        ['skill' %s skill.source]
    ==
  ==
::
++  update-json
  |=  update=update:h
  ^-  json
  ?-  -.update
      %event
    %-  pairs:enjs:format
    :~  ['sid' %s sid.update]
        ['event' (event-json event.update)]
    ==
  ==
::  pokes from json (eyre channel / ui)
::
++  json-action
  |=  input=json
  ^-  action:h
  =,  dejs:format
  =/  duration  (cu |=(seconds=@ud `@dr`(mul seconds ~s1)) ni)
  ::  decode [sid config js-timeout] with js-timeout optional (seconds;
  ::  absent -> ~s30). the timeout persists per-session outside config.
  =/  session-config
    |=  object=json
    ^-  [session-id:h config:h @dr]
    ?>  ?=(%o -.object)
    =/  timeout  (~(get by p.object) 'js-timeout')
    :+  (so:dejs:format (~(got by p.object) 'sid'))
      (json-config object)
    ?~(timeout ~s30 (mul (ni:dejs:format u.timeout) ~s1))
  %.  input
  %-  of
  :~  new+session-config
      send+(ot ~[sid+so text+so])
      fork+(ot ~[from+so to+so])
      fork-at+(ot ~[from+so to+so at+ni])
      compact+(ot ~[sid+so])
      cancel+(ot ~[sid+so])
      delete+(ot ~[sid+so])
      retry+(ot ~[sid+so])
      config+session-config
      timer-set+(ot ~[sid+so name+(su sym) in+duration every+(mu duration) prompt+so])
      timer-cancel+(ot ~[sid+so name+(su sym)])
      skill-add+(ot ~[name+so desc+so body+so])
      skill-del+(ot ~[name+so])
      set-key+(ot ~[key+so])
      commit-skill+(ot ~[name+so])
      discard-skill+(ot ~[name+so])
  ==
::
++  json-config
  |=  input=json
  ^-  config:h
  =,  dejs:format
  ?>  ?=(%o -.input)
  =/  zdr  (~(get by p.input) 'zdr')
  =/  decode
    %-  ot
    :~  url+so
        model+so
        key+so
        headers+(ar (ot ~[name+so value+so]))
        system+so
        max-context+ni
        tools+(ar json-grant)
    ==
  =/  fallbacks  (~(get by p.input) 'fallbacks')
  :+  ?~(zdr | (bo u.zdr))
    ?~(fallbacks ~ (parse:routing u.fallbacks))
  (decode input)
++  grant-json
  |=  grant=tool-grant:h
  ^-  json
  ?:  ?=(@ grant)  [%s grant]
  ?:  ?=(%clay -.grant)
    %-  pairs:enjs:format
    :~  ['clay' %s (crip (spud prefix.grant))]
    ==
  %-  pairs:enjs:format
  :~  ['mcp' %s server.grant]
  ==
++  json-grant
  |=  input=json
  ^-  tool-grant:h
  =,  dejs:format
  ?:  ?=(%s -.input)
    =/  family  ((su sym) input)
    ~|  'MCP grants must name a server; Clay grants must name a path prefix.'
    ?>  &(!=(%mcp family) !=(%clay family))
    family
  ?>  ?=(%o -.input)
  ?>  =(1 ~(wyt by p.input))
  =/  clay  (~(get by p.input) 'clay')
  ?^  clay
    ?>  ?=(%s -.u.clay)
    ?>  (lte (met 3 p.u.clay) 2.048)
    =/  prefix  (need (rush p.u.clay stap))
    ?>  !(lien prefix |=(segment=@ta |(=('.' segment) =('..' segment))))
    [%clay prefix]
  =/  server  (~(get by p.input) 'mcp')
  ?>  ?=([~ %s *] server)
  ?>  &(!=('' p.u.server) (lte (met 3 p.u.server) 256))
  [%mcp p.u.server]
++  mcp-server-json
  |=  [id=mcp-server-id:h server=mcp-server:h]
  ^-  json
  %-  pairs:enjs:format
  :~  ['id' %s id]
      ['name' %s name.server]
      ['url' %s url.server]
      ['headers' (headers-json headers.server)]
      ['enabled' %b enabled.server]
  ==
++  json-mcp-servers
  =,  dejs:format
  ^-  $-(json (list [id=mcp-server-id:h server=mcp-server:h]))
  %-  ar
  %-  ot
  :~  id+so
      name+so
      url+so
      headers+(ar (ot ~[name+so value+so]))
      enabled+bo
  ==
--

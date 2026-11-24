::  Read-only, bounded run inspection from immutable journal boundaries.
::  Credentials, transport headers and provider reasoning are never projected.
/-  h=harness, hh=harness-hand
/+  head=harness, text=harness-text, provider=harness-provider
/+  failure=harness-failure
|%
+$  invocation  [request=@ud call=tool-call:h after=(list event:h)]
++  recent
  |=  [=session:h before=(unit @ud)]
  ^-  json
  =/  at  (lent log.session)
  =/  events  log.session
  =|  rows=(list json)
  |-  ^-  json
      ?:  |(?=(~ events) =(24 (lent rows)))
        %-  pairs:enjs:format
        :~  ['runs' %a (flop rows)]
            ['before' ?~(events ~ (numb:enjs:format +(at)))]
        ==
      ?.  ?&  ?=(%input-received -.i.events)
              ?~(before & (lth at u.before))
          ==
        $(events t.events, at (dec at))
      =*  input  input.i.events
      =/  row
        %-  pairs:enjs:format
        :~  ['lensId' %s (scot %uv id.input)]
            ['at' (numb:enjs:format at)]
            ['createdAt' (stamp at.input)]
            ['preview' %s (preview item.input)]
        ==
      $(events t.events, at (dec at), rows [row rows])
::
++  read
  |=  [=session:h id=input-id:h]
  ^-  (unit json)
  ::  The next admission closes this run's event span. Later configuration
  ::  and replies cannot change an earlier run's context or tool results.
  =/  end  log.session
  =/  events  log.session
  |-  ^-  (unit json)
      ?~  events  ~
      ?.  ?=(%input-received -.i.events)  $(events t.events)
      ?.  =(id id.input.i.events)  $(end t.events, events t.events)
      =/  span  (scag (sub (lent end) (lent t.events)) end)
      `(project input.i.events end span)
::
++  project
  |=  [input=admitted-input:h end=(list event:h) span=(list event:h)]
  ^-  json
  =/  view  (play:head end)
  ::  Replay at the first dispatch, including context captured after admission.
  ::  Skill bodies read by tools appear as tool results, not invented sources.
  =/  context  (play:head (first-dispatch end (lent span)))
  =/  model-config  (routed-config config.context span)
  =/  items  (skip items.context |=(it=item:h ?=(%reasoning -.it)))
  =/  calls  (invocations span)
  %-  pairs:enjs:format
  :~  ['lensId' %s (scot %uv id.input)]
      ['messageId' %s ?:(?=(%hand -.source.input) event.source.input (scot %uv id.input))]
      ['chatType' %s 'internal']
      ['runKind' %s 'internal']
      ['visibility' %s 'owner']
      ['trigger' %s 'unknown']
      ['model' %s model.model-config]
      ['provider' %s (provider-for-url:provider url.model-config)]
      ['createdAt' (stamp at.input)]
      ['updatedAt' ~]
      ['status' %s (run-status view)]
      ['error' ?~(err.view ~ [%s (public-message:failure u.err.view)])]
      :*  'truncated'  %b
          |((gth (lent items) 12) (gth (lent calls) 12) (gth ~(wyt by memory.context) 8))
      ==
      :-  'triggerDetails'
      %-  pairs:enjs:format
      :~  ['type' %s 'unknown']
          ['messageId' %s (scot %uv id.input)]
          ['authorShip' ?~(actor.input ~ [%s (scot %p u.actor.input)])]
          ['conversationKind' %s 'internal']
          ['receivedAt' (stamp at.input)]
          ['preview' %s (preview item.input)]
      ==
      :-  'context'
      %-  pairs:enjs:format
      :~  ['currentMessage' %b &]
          ['sources' %a (context-sources context items)]
          :*  'description'  %s
              'Journal context at first dispatch; previews are bounded. Provider reasoning and transport credentials are excluded.'
          ==
      ==
      :-  'persistence'
      %-  pairs:enjs:format
      :~  ['cachesHistory' %b &]
          ['events' %a ~]
      ==
      ['outputs' %a ~]
      :-  'tools'
      %-  pairs:enjs:format
      :~  :*  'called'  %a
              %+  turn
                (scag 12 calls)
              |=(invocation=invocation `json`[%s (clip:text name.call.invocation 160)])
          ==
          ['callCount' (numb:enjs:format (lent calls))]
          ['runs' %a (tool-runs view calls)]
      ==
      :-  'lifecycle'
      %-  pairs:enjs:format
      :~  ['queuedAt' (stamp at.input)]
          ['dispatchStartedAt' ~]
          ['completedAt' ~]
          ['durationMs' ~]
      ==
      :-  'reply'
      =/  outcome  (outcome:head view)
      ?.  ?=([~ %reply *] outcome)  ~
      [%s (clip:text body.u.outcome 2.048)]
  ==
::
++  first-dispatch
  |=  [end=(list event:h) count=@ud]
  ^-  (list event:h)
  =/  dispatch  end
  =/  remaining  end
  |-
  ?:  =(0 count)  dispatch
  ?~  remaining  dispatch
  =?  dispatch  ?=([%llm-requested * %turn] i.remaining)
    remaining
  $(remaining t.remaining, count (dec count))
::
++  routed-config
  |=  [fallback=config:h routes=(list event:h)]
  ^-  config:h
  ?~  routes  fallback
  ?:  ?=(%llm-routed -.i.routes)  config.i.routes
  $(routes t.routes)
::
++  context-sources
  |=  [context=view:h items=(list item:h)]
  ^-  (list json)
  =/  sources=(list json)
    :~  (source 'system' 'System instructions' system.config.context)
    ==
  =?  sources  ?=(^ summary.context)
    (weld sources ~[(source 'memory' 'Conversation summary' (need summary.context))])
  =.  sources
    %+  weld  sources
    %+  turn  (scag 8 ~(tap by memory.context))
    |=  [name=@t body=@t]
    (source 'memory' name body)
  %+  weld  sources
  %+  turn  (scag 12 (flop items))
  |=  it=item:h
  (source ?:(?=(%tool -.it) 'tool_result' 'message') (crip (trip -.it)) (preview it))
::
++  tool-result
  |=  invocation=invocation
  ^-  (unit @t)
  =/  remaining  after.invocation
  |-
  ?~  remaining  ~
  ?:  &(?=(%tool-completed -.i.remaining) =(id.call.invocation call-id.i.remaining))
    `body.i.remaining
  ::  Reused call IDs belong to a new assistant request. An absent receipt
  ::  cannot borrow a result from that later tool exchange.
  ?:  ?&  ?=([%llm-completed * * * %assistant * *] i.remaining)
          (lien calls.item.i.remaining |=(next=tool-call:h =(id.call.invocation id.next)))
      ==
    ~
  $(remaining t.remaining)
::
++  tool-runs
  |=  [view=view:h calls=(list invocation)]
  ^-  (list json)
  =/  bounded  (scag 12 calls)
  =/  index=@ud  1
  |-
  ?~  bounded  ~
  =*  call  call.i.bounded
  =/  result  (tool-result i.bounded)
  =/  row
    %-  pairs:enjs:format
    :~  ['id' %s (rap 3 (scot %ud request.i.bounded) '/' id.call ~)]
        ['toolCallId' %s id.call]
        ['callIndex' (numb:enjs:format index)]
        ['name' %s (clip:text name.call 160)]
        :-  'status'
        :-  %s
        ?~  result
          ?:  |(?=(^ cancelled.view) ?=(^ err.view))  'blocked'
          'running'
        ?:((is-error:head u.result) 'error' 'completed')
        ['startedAt' ~]
        ['completedAt' ~]
        ['durationMs' ~]
        ['argumentDetail' %s (clip:text args.call 768)]
        ['argumentSummary' %s (clip:text args.call 160)]
        ['resultSummary' ?~(result ~ [%s (clip:text u.result 768)])]
    ==
  [row $(bounded t.bounded, index +(index))]
::
++  run-status
  |=  view=view:h
  ^-  @t
  ?^  cancelled.view  'aborted'
  ?^  err.view  'error'
  ?:  !=(~ wait.view)  'tool_running'
  ?^  pending.view  'dispatching'
  =/  outcome  (outcome:head view)
  ?:  ?=([~ %reply *] outcome)  'completed'
  'assembling'
::
++  invocations
  |=  events=(list event:h)
  ^-  (list invocation)
  =|  calls=(list invocation)
  =|  after=(list event:h)
  |-  ^-  (list invocation)
      ?~  events  calls
      =?  calls  ?=([%llm-completed * * * %assistant * *] i.events)
        %+  weld
          %+  turn  calls.item.i.events
          |=(call=tool-call:h `invocation`[req.i.events call after])
        calls
      $(events t.events, after [i.events after])
::
++  stamp
  |=  at=@da
  ^-  json
  (numb:enjs:format (div (mul 1.000 (sub (max at ~1970.1.1) ~1970.1.1)) ~s1))
::
++  with-delivery
  |=  [base=json publication=(unit publication:hh)]
  ^-  json
  ?~  publication  base
  ?>  ?=(%o -.base)
  =*  receipt  u.publication
  =/  delivery
    %-  pairs:enjs:format
    :~  ['status' %s status.receipt]
        ['messageId' %s external.receipt]
        ['conversationId' %s address.receipt]
        :*  'receipts'  %a
            %+  turn
              (scag 8 receipts.receipt)
            |=  item=receipt:hh
            (pairs:enjs:format ~[['at' (stamp at.item)] ['status' %s status.item]])
        ==
    ==
  =.  p.base  (~(put by p.base) 'delivery' delivery)
  ?:  ?=(?(%pending %claimed %uncertain) status.receipt)
    [%o (~(put by p.base) 'status' [%s 'delivering'])]
  base
::
++  preview
  |=  it=item:h
  ^-  @t
  ?-  -.it
    %reasoning  ''
    %user  (clip:text body.it 768)
    %assistant  (clip:text body.it 768)
    %tool  (clip:text body.it 768)
  ==
::
++  source
  |=  [kind=@t label=@t body=@t]
  ^-  json
  %-  pairs:enjs:format
  :~  ['kind' %s kind]
      ['label' %s (clip:text label 160)]
      ['included' %b &]
      ['preview' %s (clip:text body 768)]
  ==
--

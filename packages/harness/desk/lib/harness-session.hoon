::  Pure session services: compose the head with the chosen budget policy and
::  JSON snapshot projection, with no I/O authority or second scheduler.
::
/-  h=harness
/+  head=harness, provider=harness-provider, codec=harness-json,
    failure=harness-failure, context=harness-context, lcm=harness-lcm
|%
::  Keep provider byte accounting out of the semantic reducer. This gate is
::  evaluated only if replay says inference can run, preserving cheap polls.
::
++  next
  |=  [=view:h skills=(map @t skill:h) log=(list event:h)]
  ^-  (unit step:h)
  ::  The current model's window determines the trigger, including after a
  ::  model switch. Idle polls and tool waits never evaluate the lazy estimate.
  ::
  =/  budget  (input-budget:context max-context.config.view)
  =/  next
    %+  decide:head  view(max-context.config budget)
    |=(~ (est-tokens:provider view skills log))
  ?.  ?=([~ %turn *] next)  next
  ::  Finish a ready hierarchy group before the next real model turn, never
  ::  on idle polling. The per-input attempt budget also bounds this work.
  ::
  ?:  &((lth compact-attempts.view 4) !=(~ (group:lcm lcm.view)))  `[%compact ~]
  next
::
++  inspect
  |=  [=session:h skills=(map @t skill:h)]
  ^-  [revision=@ud =view:h next=(unit step:h)]
  =/  =view:h  (play:head log.session)
  [(lent log.session) view (next view skills log.session)]
::
++  branch
  |=  [from=session-id:h =session:h at=@ud]
  ^-  (each session:h @t)
  ?.  &((gth at 0) (lte at (lent log.session)))
    [%| 'Invalid branch point']
  ::  Retain the noun tail directly; no serialization or history rewriting.
  ::
  =/  prefix  (slag (sub (lent log.session) at) log.session)
  =/  complete=?
    ?~  prefix  |
    ?+  -.i.prefix  |
      %command-completed  &
        %checkpoint-completed
      ?&  ?=(^ reply.i.prefix)
          ?=([~ %reply *] (outcome:head (play:head prefix)))
      ==
      %llm-completed  ?=([%assistant * ~] item.i.prefix)
    ==
  ?.  complete  [%| 'Branch after a completed assistant reply']
  [%& [[%forked from at ~ ~] prefix] next-req.session]
::
++  snapshot
  |=  [=session:h since=(unit @ud) =view:h]
  ^-  json
  =/  revision  revision.view
  =/  phase=@t
    ?^  pending.view
      ?:(=(%compaction kind.u.pending.view) 'compacting' 'thinking')
    ?:  !=(~ wait.view)  'tools'
    ?^  err.view  'error'
    'idle'
  =/  page=[entries=json before=json]
    ?:  &(?=(^ since) =(u.since revision))  [~ ~]
    (history session ~)
  |^
    %-  pairs:enjs:format
    :~  ['revision' (numb:enjs:format revision)]
        ['phase' %s phase]
        ['error' ?~(err.view ~ [%s u.err.view])]
        ['failure' ?~(err.view ~ (json:failure u.err.view))]
        ['model' %s model.config.view]
        ['memory' (memory-json:codec memory.view)]
        ['usage' (usage-json total.view)]
        ['compactionUsage' (usage-json compact-usage.view)]
        ['compactions' (numb:enjs:format compactions)]
        :-  'origin'
        ?~  origin.view  ~
        %-  pairs:enjs:format
        :~  ['sessionId' %s from.u.origin.view]
            ['eventCount' (numb:enjs:format at.u.origin.view)]
        ==
        ['entries' entries.page]
        ['before' before.page]
    ==
  ::  Count completion events in the durable log; the active context only
  ::  contains the retained tail and cannot supply this count.
  ::
  ++  compactions
    %-  lent
    %+  skim  log.session
    |=  =event:h
    ?=(?(%compaction-completed %checkpoint-completed) -.event)
  ::
  ++  usage-json
    |=  =usage:h
    ^-  json
    %-  pairs:enjs:format
    :~  ['prompt' (numb:enjs:format prompt.usage)]
        ['completion' (numb:enjs:format completion.usage)]
    ==
  --
::
++  history
  |=  [=session:h before=(unit @ud)]
  ^-  [entries=json before=json]
  ::  Event addresses are immutable. Keep all rows at an address together,
  ::  including synthetic cancellation receipts; pagination never edits history.
  ::
  ?:  =(`0 before)  [[%a ~] ~]
  =/  revision  (lent log.session)
  =/  at  ?~(before revision (min revision (dec u.before)))
  =/  events  (slag (sub revision at) log.session)
  =/  count=@ud  0
  =/  oldest  at
  =/  bytes=@ud  0
  =|  page=(list json)
  |-  ^-  [entries=json before=json]
      ?~  events  [[%a page] ~]
      =/  rows  (transcript-event:head at events)
      ?~  rows  $(events t.events, at (dec at))
      ?:  |((gte count 40) (gte bytes 262.144))
        [[%a page] (numb:enjs:format oldest)]
      =/  projected  (turn rows transcript-row-json:codec)
      %=  $
        events  t.events
        at  (dec at)
        count  (add count (lent projected))
        oldest  at
        bytes
          %+  add  bytes
          %+  roll  projected
          |=  [row=json size=@ud]
          (add size (met 3 (en:json:html row)))
        page  (weld projected page)
      ==
--

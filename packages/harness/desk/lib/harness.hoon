::  The deterministic head: replay, transcript, continuation and loop guards.
::  This module depends only on the Harness noun vocabulary. It knows no JSON,
::  provider, credential, client, Gall bowl, or executor implementation.
::  +decide returns an intention; it never performs the intended operation.
::
/-  h=harness
/+  lcm=harness-lcm, context=harness-context
|%
::  Shared libraries are not private conversation memory. Durable source
::  provenance also protects an operator-created fork of a social transcript.
::
++  social-context
  |=  log=(list event:h)
  ^-  ?
  %+  lien  log
  |=  =event:h
  &(?=(%input-received -.event) ?=(?(%hand %peer) -.source.input.event))
::  Durable lineage survives completion and forks; ephemeral waiter maps do
::  not. The runtime uses it to fence descendants without erasing history.
::
++  delegation
  |=  log=(list event:h)
  ^-  (unit [parent=session-id:h call-id=@t rehearsal=?])
  ?~  log  ~
  ?:  ?=(%input-received -.i.log)
    =*  source  source.input.i.log
    ?:  ?=(%subagent -.source)  `[parent.source call-id.source |]
    ?:  ?=(%rehearsal -.source)  `[parent.source call-id.source &]
    $(log t.log)
  $(log t.log)
++  delegated-id
  |=  [parent=session-id:h call-id=@t rehearsal=? generation=(unit @ud)]
  ^-  session-id:h
  %+  rap  3
  :~  ?:(rehearsal 'rehearse--' '')
      parent  '--'
      ?~(generation '' (cat 3 (scot %ud u.generation) '--'))
      call-id
  ==
::  The newest request marker owns the call ID. A marker without a
::  generation cannot borrow one from a different request with the same ID.
::
++  request-generation
  |=  [=session:h call-id=@t]
  ^-  (unit @ud)
  =/  events  log.session
  |-  ^-  (unit @ud)
      ?~  events  ~
      ?:  &(?=(%tool-requested-2 -.i.events) =(call-id call-id.i.events))
        `generation.i.events
      ?:  &(?=(%tool-requested -.i.events) =(call-id call-id.i.events))
        ~
      $(events t.events)
++  request-current
  |=  [=session:h generation=(unit @ud) call-id=@t]
  ^-  ?
  ?.  (~(has in wait:(play log.session)) call-id)  |
  ?.  =(generation (request-generation session call-id))  |
  ?~  generation  &
  =(u.generation next-req.session)
::  +play: fold the event log (newest first) into a view
::
++  play
  |=  log=(list event:h)
  ^-  view:h
  ::  Accumulate newest first, reversing once instead of copying every prefix.
  ::
  =/  reversed  (roll (flop log) fold)
  reversed(items (flop items.reversed), positions (flop positions.reversed))
::  Advance a chronological view with newly recorded events, in recording
::  order. The same reducer owns full replay and this event-local continuation.
::
++  advance
  |=  [events=(list event:h) =view:h]
  ^-  view:h
  =/  reversed  view(items (flop items.view), positions (flop positions.view))
  =.  reversed
    |-  ^-  view:h
        ?~  events  reversed
        $(events t.events, reversed (fold i.events reversed))
  reversed(items (flop items.reversed), positions (flop positions.reversed))
::  Incremental replay for rebuildable projections. The accumulator keeps
::  items and positions newest-first; +play exposes them chronologically.
::
++  fold
  |=  [=event:h =view:h]
  ^-  view:h
  =.  revision.view  +(revision.view)
  ?-  -.event
    ::  Editing policy is not permission to restart a failed request.
    ::
    %config-replaced  view(config config.event)
    %input-admitted  (admit-item view item.event)
    %input-received  (admit-item view item.input.event)
    %context-received  (append-item view [%user body.event])
    %command-completed  (append-item view [%assistant body.event ~])
    %memory-set  view
    ::  A recorded request is an admitted continuation. Clearing the error
    ::  here also keeps already-recorded config/retry exchanges replayable.
    ::
    %llm-requested  view(pending `[req.event kind.event], err ~)
    %llm-routed  view(route `[req.event config.event])
      %llm-reasoning
    ?.  =(pending.view `[req.event %turn])  view
    (append-item view [%reasoning url.event model.event data.event])
  ::
      %llm-failed
    view(pending ~, compaction ~, lcm-plan ~, err `err.event)
  ::
    %tool-requested  view(wait (~(put in wait.view) call-id.event))
    %tool-requested-2  view(wait (~(put in wait.view) call-id.event))
    %retried  view(err ~, cancelled ~)
    %halted  view(pending ~, err `reason.event)
      %forked
    %=  view
      pending  ~
      compaction  ~
      lcm-plan  ~
      wait  ~
      cancelled  ~
      origin  `[from.event at.event]
    ==
      $?  %compaction-planned  %lcm-planned  %checkpoint-completed
          %compaction-failed  %compaction-completed
      ==
    (fold-compaction event view)
  ::  Cancellation closes the provider exchange as well as the wait set.
  ::  These are cancellation receipts, never claims of external rollback.
  ::  Interpreting the event keeps existing logs intact and replayable.
  ::
      %cancelled
    =/  closed  (cancel-results (flop items.view) reason.event)
    %=  view
      pending  ~
      compaction  ~
      lcm-plan  ~
      wait  ~
      cancelled  `reason.event
      items  (weld (flop closed) items.view)
      positions  (weld (reap (lent closed) revision.view) positions.view)
    ==
  ::
      %tool-completed
    %=  view
      wait  (~(del in wait.view) call-id.event)
      items  [[%tool call-id.event name.event body.event] items.view]
      positions  [revision.view positions.view]
    ==
  ::
      %llm-completed
    %=  view
      pending  ~
      items  [item.event items.view]
      positions  [revision.view positions.view]
      total  (add-usage total.view usage.event)
    ==
  ==
::
++  fold-compaction
  |=  [=event:h =view:h]
  ^-  view:h
  ?>  ?=  $?  %compaction-planned  %lcm-planned  %checkpoint-completed
              %compaction-failed  %compaction-completed
          ==
      -.event
  ?-  -.event
      %compaction-planned
    %=  view
      pending  `[req.event %compaction]
      compaction  `plan.event
      lcm-plan  ~
      err  ~
      compact-attempts  +(compact-attempts.view)
    ==
      %lcm-planned
    %=  view
      pending  `[req.event %compaction]
      compaction  `checkpoint.plan.event
      lcm-plan  `plan.event
      err  ~
      compact-attempts  +(compact-attempts.view)
    ==
    %checkpoint-completed  (complete-checkpoint view event)
      %compaction-failed
    ?.  =(pending.view `[req.event %compaction])  view
    %=  view
      pending  ~
      compaction  ~
      lcm-plan  ~
      err  `err.event
      compact-usage  (add-usage compact-usage.view usage.event)
      total  (add-usage total.view usage.event)
    ==
      %compaction-completed
    =/  kept  (retained (flop items.view))
    =/  count  (sub (lent items.view) (lent kept))
    %=  view
      pending  ~
      summary  `summary.event
      items  (flop kept)
      positions  (scag (lent kept) positions.view)
      lcm
        %:  legacy:lcm
          lcm.view  revision.view  summary.event
          (scag count (flop positions.view))
        ==
    ==
  ==
::  Context items and their event addresses always move together. These
::  helpers use the fold's newest-first order, not +play's public order.
::
++  append-item
  |=  [=view:h it=item:h]
  ^-  view:h
  view(items [it items.view], positions [revision.view positions.view])
::
++  admit-item
  |=  [=view:h it=item:h]
  ^-  view:h
  %=  view
    items  [it items.view]
    positions  [revision.view positions.view]
    err  ~
    cancelled  ~
    compact-attempts  0
  ==
::
++  add-usage
  |=  [total=usage:h added=usage:h]
  ^-  usage:h
  [(add prompt.total prompt.added) (add completion.total completion.added)]
::  Results cannot revive a cancelled or superseded checkpoint. Verify
::  the request and its immutable source span before replacing context.
::
++  complete-checkpoint
  |=  [=view:h result=event:h]
  ^-  view:h
  ?>  ?=(%checkpoint-completed -.result)
  ?.  =(pending.view `[req.result %compaction])  view
  ?~  compaction.view  view
  =*  plan  u.compaction.view
  =/  chronological  (flop items.view)
  =/  addresses  (flop positions.view)
  =/  sources  (scag count.plan addresses)
  ?.  =(source.plan (sham [summary.view (scag count.plan chronological)]))
    view
  ?:  &(?=(^ lcm-plan.view) !=(sources.u.lcm-plan.view sources))
    view
  =/  forest
    ?~  lcm-plan.view
      (legacy:lcm lcm.view revision.view summary.result sources)
    =*  hierarchy  u.lcm-plan.view
    %+  fall
      %:  append:lcm
        lcm.view  revision.view  summary.result
        sources.hierarchy  children.hierarchy
      ==
    lcm.view
  ::  An invalid tree transition cannot accept a provider checkpoint.
  ::
  ?:  &(?=(^ lcm-plan.view) =(forest lcm.view))  view
  =/  tail  (slag count.plan chronological)
  =/  positions  (slag count.plan addresses)
  =/  preserved  (preserved-input:context chronological count.plan)
  =.  tail  (weld (turn preserved |=(at=@ud (snag at chronological))) tail)
  =.  positions  (weld (turn preserved |=(at=@ud (snag at addresses))) positions)
  ::  A manual command's reply belongs at its admitted boundary. Input
  ::  arriving during summarization stays after it and still needs a turn.
  ::
  =?  tail  ?=(^ reply.result)
    =/  at  (add (lent preserved) (sub length.plan count.plan))
    %+  weld  (scag at tail)
    [`item:h`[%assistant body.u.reply.result ~] (slag at tail)]
  =?  positions  ?=(^ reply.result)
    =/  at  (add (lent preserved) (sub length.plan count.plan))
    (weld (scag at positions) [revision.view (slag at positions)])
  %=  view
    pending  ~
    summary  ?~(lcm-plan.view `summary.result (render:lcm forest))
    items  (flop tail)
    positions  (flop positions)
    lcm  forest
    lcm-plan  ~
    compaction  ~
    compact-usage  (add-usage compact-usage.view usage.result)
    total  (add-usage total.view usage.result)
  ==
::  Classify a turn at the settlement boundary. Outstanding effects are not
::  terminal; an idle view without a final answer is not a successful reply.
::  Cancellation is replayed state, not the position of an event in the log:
::  a later config edit must not turn a cancelled turn into apparent success.
::
++  outcome
  |=  =view:h
  ^-  (unit outcome:h)
  ?:  |(?=(^ pending.view) !=(~ wait.view))  ~
  ?^  cancelled.view  `[%cancelled u.cancelled.view]
  ?^  err.view  `[%failure u.err.view]
  =/  last=(unit item:h)  ?~(items.view ~ `(rear items.view))
  ?.  ?=([~ %assistant * ~] last)
    `[%failure 'Session ended without a response']
  `[%reply body.u.last]
::  The human transcript is independent of the provider's compacted context.
::  Event counts are stable message addresses within this session's history.
::
++  transcript
  |=  log=(list event:h)
  ^-  (list [at=@ud input-id=(unit input-id:h) =item:h])
  =/  events  (flop log)
  =/  at=@ud  0
  =|  rows=(list [at=@ud input-id=(unit input-id:h) =item:h])
  |-  ^-  (list [at=@ud input-id=(unit input-id:h) =item:h])
      ?~  events  (flop rows)
      =*  event  i.events
      ?:  ?=(%cancelled -.event)
        =/  before
          =/  remaining  rows
          =|  after=(list item:h)
          |-  ^-  (list item:h)
              ?~  remaining  after
              =/  it  item.i.remaining
              ?:  ?=(%assistant -.it)  [it after]
              $(remaining t.remaining, after [it after])
        =/  closed  (cancel-results before reason.event)
        =/  added
          (turn closed |=(it=item:h [+(at) ~ it]))
        $(events t.events, at +(at), rows (weld (flop added) rows))
      =/  row=(unit [input-id=(unit input-id:h) =item:h])
        ?+  -.event  ~
          %input-admitted  `[~ item.event]
          %input-received  `[`id.input.event item.input.event]
          %command-completed  `[~ [%assistant body.event ~]]
            %checkpoint-completed
          ?~  reply.event  ~
          `[~ [%assistant body.u.reply.event ~]]
          %llm-completed  `[~ item.event]
          %tool-completed  `[~ [%tool call-id.event name.event body.event]]
        ==
      ?~  row  $(events t.events, at +(at))
      $(events t.events, at +(at), rows [[+(at) u.row] rows])
::  Project one event at its immutable address. Cancellation needs only the
::  preceding tool exchange; unrelated history never enters the projection.
::  Rows within an event stay chronological and travel together through pages.
::
++  transcript-event
  |=  [at=@ud log=(list event:h)]
  ^-  (list [at=@ud input-id=(unit input-id:h) =item:h])
  ?~  log  ~
  ?.  ?=(%cancelled -.i.log)
    =/  address  at
    %+  turn  (transcript ~[i.log])
    |=  row=[at=@ud input-id=(unit input-id:h) =item:h]
    row(at address)
  =/  reason  reason.i.log
  =/  events  t.log
  =|  after=(list item:h)
  |-
  ^-  (list [at=@ud input-id=(unit input-id:h) =item:h])
  ?~  events  ~
  ::  A prior cancellation already closes this exchange, even when more
  ::  input or configuration events follow it without another assistant.
  ?:  ?=(%cancelled -.i.events)  ~
  =/  rows  (transcript ~[i.events])
  ?~  rows  $(events t.events)
  =/  it  item.i.rows
  ?.  ?=(%assistant -.it)
    $(events t.events, after [it after])
  %+  turn  (cancel-results [it after] reason)
  |=  it=item:h
  [at ~ it]
++  transcript-items
  |=  log=(list event:h)
  (turn (transcript log) |=([@ud (unit input-id:h) =item:h] item))
::  +unanswered: trailing items with no assistant response yet
::
++  unanswered
  |=  items=(list item:h)
  ^-  (list item:h)
  %-  flop
  =/  reversed  (flop items)
  |-  ^-  (list item:h)
      ?~  reversed  ~
      ?:  ?=(%assistant -.i.reversed)  ~
      [i.reversed $(reversed t.reversed)]
::  +retained: what compaction keeps verbatim: the unanswered tail,
::  plus up to +keep-tail recent items, never splitting a tool flow
::
++  keep-tail  6
++  retained
  |=  items=(list item:h)
  ^-  (list item:h)
  =/  length  (lent items)
  =/  keep  (max (lent (unanswered items)) (min keep-tail length))
  |-  ^-  (list item:h)
      ?:  (gte keep length)  items
      =/  tail  (slag (sub length keep) items)
      ?:  ?=([[%tool *] *] tail)  $(keep +(keep))
      =/  previous  (snag (dec (sub length keep)) items)
      ?:  &(?=([[%assistant *] *] tail) ?=(%reasoning -.previous))  $(keep +(keep))
      tail
::  +last-calls: the last assistant item's tool calls,
::  and the items that came after it
::
++  last-calls
  |=  items=(list item:h)
  ^-  [calls=(list tool-call:h) after=(list item:h)]
  =/  reversed  (flop items)
  =|  after=(list item:h)
  |-  ^-  [calls=(list tool-call:h) after=(list item:h)]
      ?~  reversed  [~ after]
      ?:  ?=(%assistant -.i.reversed)
        [calls.i.reversed after]
      $(reversed t.reversed, after [i.reversed after])
::  Outstanding calls, including calls not yet dispatched. The same gate
::  determines execution and the terminal receipts produced by interruption.
::
++  open-calls
  |=  items=(list item:h)
  ^-  (list tool-call:h)
  =/  exchange  (last-calls items)
  =/  done=(set @t)
    %-  ~(gas in *(set @t))
    %+  murn  after.exchange
    |=(it=item:h ?:(?=(%tool -.it) `call-id.it ~))
  (skip calls.exchange |=(c=tool-call:h (~(has in done) id.c)))
++  is-cancelled
  |=  body=@t
  =('cancelled: ' (end [3 11] body))
++  cancel-results
  |=  [items=(list item:h) reason=@t]
  ^-  (list item:h)
  %+  turn  (open-calls items)
  |=  c=tool-call:h
  :-  %tool
  :+  id.c  name.c
  %+  rap  3
  :~  'cancelled: '  reason
      '. No result was accepted. Execution may already have occurred; '
      'do not assume rollback or repeat the action without checking.'
  ==
::  loop-guard thresholds
::
::  Consecutive failing tool results before halting.
::
++  max-fails  4
::  Assistant turns since the last input before halting.
::
++  max-steps  24
::  +is-error: does a tool result body read as an error, by convention?
::
++  is-error
  |=  body=@t
  ^-  ?
  ?|  =('error: ' (end [3 7] body))
      =('js error: ' (end [3 10] body))
      =('rejected: ' (end [3 10] body))
      =('peer error: ' (end [3 12] body))
  ==
::  +trailing-fails: length of the trailing run of failing tool
::  results (skipping the assistant turns between them)
::
++  trailing-fails
  |=  items=(list item:h)
  ^-  @ud
  =/  reversed  (flop items)
  =|  count=@ud
  |-  ^-  @ud
      ?~  reversed  count
      ?-  -.i.reversed
        %reasoning  $(reversed t.reversed)
        %assistant  $(reversed t.reversed)
        %user  count
          %tool
        ?.  (is-error body.i.reversed)  count
        $(reversed t.reversed, count +(count))
      ==
::  +steps-since-input: assistant turns since the last admitted input
::  (a %user item; tool results do not count as input)
::
++  steps-since-input
  |=  items=(list item:h)
  ^-  @ud
  =/  reversed  (flop items)
  =|  count=@ud
  |-  ^-  @ud
      ?~  reversed  count
      ?:  ?=(%user -.i.reversed)  count
      ?:  ?=(%assistant -.i.reversed)  $(reversed t.reversed, count +(count))
      $(reversed t.reversed)
::  +decide: what happens next; ~ means idle.
::  The caller supplies a pure budget estimate. It is lazy so idle sessions
::  and outstanding tool work need not build a provider request just to decide
::  that nothing can run. A different encoding can supply a different estimate.
::
++  decide
  |=  [=view:h budget=$-(~ @ud)]
  ^-  (unit step:h)
  ?^  cancelled.view  ~
  ?^  pending.view  ~
  ::  async tool results still in flight
  ::
  ?.  =(~ wait.view)  ~
  ::  a failure halts the loop; retry or new input clears it
  ::
  ?^  err.view  ~
  ?~  items.view  ~
  ::  outstanding tool calls from the last assistant turn
  ::
  =/  todo  (open-calls items.view)
  ?^  todo  `[%tools todo]
  =/  last=item:h  (rear items.view)
  ?:  ?=(%assistant -.last)  ~
  ::  loop guards: halt a stuck agent before it burns the budget.
  ::  a run of failing tool results means it is repeating a mistake;
  ::  too many turns since the last input means it is not converging.
  ::  either way, halt with a reason; a new input clears it and resumes
  ::
  =/  fails  (trailing-fails items.view)
  ?:  (gte fails max-fails)
    :-  ~
    :-  %halt
    %+  rap  3
    :~  'loop guard: '  (scot %ud fails)
        ' tool calls in a row failed. stopping so you can rethink or '
        'ask for help — send a new message to continue.'
    ==
  =/  since  (steps-since-input items.view)
  ?:  (gte since max-steps)
    :-  ~
    :-  %halt
    %+  rap  3
    :~  'loop guard: '  (scot %ud since)
        ' turns without resolving the request. stopping to avoid a '
        'runaway — send a new message to continue.'
    ==
  ?.  (gth (budget ~) max-context.config.view)
    `[%turn ~]
  ::  The planner either selects a bounded span or records a useful halt.
  ::  An oversized irreducible request must never be sent optimistically.
  ::
  `[%compact ~]
--

::  Pure context policy. No provider format, credentials, I/O or scheduler.
::  Encoders supply size estimates; this module chooses immutable source spans.
/-  h=harness
|%
::  Conservative policy, not catalog metadata or an exact tokenizer. Keep
::  response headroom separate from a 10% estimation margin. Small windows
::  scale down; unknown/zero windows cannot admit requests.
++  output-budget
  |=(window=@ud (min 4.096 (div window 4)))
++  input-budget
  |=  window=@ud
  (sub window (add (output-budget window) (div window 10)))
::  There is one model-relative trigger, not a second absolute context cap.
::  Compaction leaves a fraction of that budget as raw recent exchanges, so
::  the next request has room to grow instead of immediately compacting again.
++  tail-budget
  |=(window=@ud (div (input-budget window) 3))
++  source-hash
  |=  [view=view:h count=@ud]
  (sham [summary.view (scag count items.view)])
++  item-bytes
  |=  item=item:h
  ^-  @ud
  ?-  -.item
    %reasoning  (met 3 data.item)
    %user  (met 3 body.item)
    %tool  (met 3 body.item)
      %assistant
    %+  add  (met 3 body.item)
    %+  roll  calls.item
    |=  [call=tool-call:h total=@ud]
    (add total (met 3 args.call))
  ==
::  Prefer complete exchanges. Tool batches provide additional safe cuts when
::  an unfinished exchange grows beyond the conversation's working budget.
++  boundaries
  |=  items=(list item:h)
  =|  at=@ud
  =|  reversed-cuts=(list @ud)
  |-  ^-  (list @ud)
      ?~  items  (flop reversed-cuts)
      =?  reversed-cuts  ?=([%assistant * ~] i.items)
        [+(at) reversed-cuts]
      $(items t.items, at +(at))
::  Every call in a batch must have its result before that batch can be cut.
++  tool-boundaries
  |=  items=(list item:h)
  =|  at=@ud
  =|  pending=(set @t)
  =|  cuts=(list @ud)
  |-  ^-  (list @ud)
      ?~  items  (flop cuts)
      =/  item  i.items
      =?  pending  ?=(%assistant -.item)
        (silt (turn calls.item |=(call=tool-call:h id.call)))
      =?  cuts  ?=([%assistant * ~] item)  [+(at) cuts]
      =?  cuts  &(?=(%tool -.item) (~(has in pending) call-id.item) =(1 ~(wyt in pending)))
        [+(at) cuts]
      =?  pending  ?=(%tool -.item)  (~(del in pending) call-id.item)
      $(items t.items, at +(at))
::  A checkpoint inside a turn retains that turn's user input verbatim.
::  These zero-based positions also retain its original source addresses.
++  preserved-input
  |=  [items=(list item:h) count=@ud]
  =|  at=@ud
  =|  keep=(list @ud)
  |-  ^-  (list @ud)
      ?:  |(=(at count) ?=(~ items))  (flop keep)
      =?  keep  ?=(%user -.i.items)  [at keep]
      =?  keep  ?=([%assistant * ~] i.items)  ~
      $(items t.items, at +(at))
::  Walk item sizes once to find the preferred retained-tail boundary. Do not
::  serialize every growing prefix or repeatedly scan every remaining suffix.
++  preferred
  |=  [items=(list item:h) cuts=(list @ud) target=@ud]
  ^-  @ud
  =/  sizes  (turn items item-bytes)
  =/  bytes  (roll sizes add)
  ::  An explicit compact on a short conversation should checkpoint its older
  ::  history, not spend inference on just the first (possibly tiny) exchange.
  ?:  (lte bytes (mul target 4))  (rear cuts)
  =|  at=@ud
  |-  ^-  @ud
      ?>  ?=(^ cuts)
      ?:  =(at i.cuts)
        ?:  |(=(~ t.cuts) (lte bytes (mul target 4)))  at
        $(cuts t.cuts)
      ?>  ?=(^ sizes)
      %=  $
        sizes  t.sizes
        bytes  (sub bytes i.sizes)
        at  +(at)
      ==
++  plan
  |=  $:  view=view:h
          through=@ud
          command=(unit input-id:h)
          estimate=$-(view:h @ud)
      ==
  (plan-for view through command max-context.config.view estimate)
::  The conversation determines the fresh-tail target; the summary model
::  determines how much source can be sent in one request. They may differ.
++  plan-for
  |=  $:  view=view:h
          through=@ud
          command=(unit input-id:h)
          conversation-window=@ud
          estimate=$-(view:h @ud)
      ==
  ^-  (each compaction-plan:h @t)
  ?:  |(?=(^ pending.view) !=(~ wait.view))
    [%| 'Compaction waits for inference and tools to settle.']
  ?:  (gte compact-attempts.view 4)
    [%| 'Compaction attempt limit reached; change the model or reduce the request.']
  =/  cuts  (boundaries items.view)
  ::  Prefer older completed exchanges. If none remain, summarize settled
  ::  tool batches while preserving the current request and all source data.
  =.  cuts
    ?:  (gte (lent cuts) 2)  (scag (dec (lent cuts)) cuts)
    (tool-boundaries items.view)
  ?~  cuts
    [%| 'No completed exchange or settled tool batch is available for compaction.']
  =/  limit  (input-budget max-context.config.view)
  =/  goal  (preferred items.view cuts (tail-budget conversation-window))
  =/  cuts=(list @ud)  (skim `(list @ud)`cuts |=(cut=@ud (lte cut goal)))
  ::  If the desired source prefix cannot fit, halve the number of complete
  ::  exchanges until it can. This is local planning, not provider retries.
  ::  It avoids a quadratic sequence of ever-larger request encodings.
  |-  ^-  (each compaction-plan:h @t)
      ?>  ?=(^ cuts)
      =/  count  (rear cuts)
      =/  size  (estimate view(items (scag count items.view)))
      ?:  (gth size limit)
        ?~  t.cuts
          [%| 'A complete exchange or tool batch exceeds the compaction input budget.']
        $(cuts (scag (div (lent cuts) 2) `(list @ud)`cuts))
      :*  %&
          through
          count
          (lent items.view)
          (source-hash view count)
          size
          (output-budget max-context.config.view)
          url.config.view
          model.config.view
          command
      ==
++  validate
  |=  [view=view:h plan=compaction-plan:h stop=stop-reason:h item=item:h]
  ^-  (unit @t)
  ?.  =(source.plan (source-hash view count.plan))
    `'Compaction source coverage changed; the previous context was retained.'
  ?.  &(?=([%assistant * ~] item) =(%stop stop))
    `'Compaction did not return a complete summary; the previous context was retained.'
  ?:  ?|  =('' body.item)
          (levy (trip body.item) |=(char=@tD |(=(32 char) =(9 char) =(10 char) =(13 char))))
      ==
    `'Compaction returned no usable summary; the previous context was retained.'
  ::  Reject expansion before the next decision, rather than looping on a
  ::  verbose summary. Request-level fit is checked again with the real codec.
  =/  before=@ud
    %+  add  ?~(summary.view 0 (met 3 u.summary.view))
    (roll (turn (scag count.plan items.view) item-bytes) add)
  ?:  (gte (met 3 body.item) before)
    `'Compaction did not reduce the context; the previous context was retained.'
  ~
--

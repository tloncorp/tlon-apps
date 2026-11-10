::  Direct tool calls use the normal executor and ledger, without a serving
::  model turn. A bounded validity window makes receipt eviction replay-safe.
/-  h=harness
/+  hl=harness
|%
::
++  id
  |=  message=peer-rpc:h
  ^-  ask-id:h
  ?-  -.message
    %tools  id.message
    %invoke  id.message
    %result  id.message
  ==
::
++  fresh
  |=  [issued=@da now=@da]
  ^-  ?
  ?&  (lte issued (add now ~s30))
      (gth issued (sub now (min now ~m10)))
  ==
::
++  prune
  |=  [receipts=(map [@p ask-id:h] peer-receipt:h) now=@da]
  ^+  receipts
  ::  Pending work retains its identity even after the admission window closes.
  ::  A completed receipt can expire because its invocation can no longer run.
  %-  malt
  %+  skim  ~(tap by receipts)
  |=  [key=[@p ask-id:h] receipt=peer-receipt:h]
  |(?=(~ result.receipt) (fresh issued.receipt now))
::
++  same
  |=  [receipt=peer-receipt:h issued=@da name=@t args=@t]
  &(=(issued issued.receipt) =(name name.receipt) =(args args.receipt))
::
++  call-id
  |=  [id=ask-id:h issued=@da]
  ^-  @t
  (cat 3 'peer-tool-' (scot %uv (sham [id issued])))
::
++  step
  |=  view=view:h
  ^-  (unit step:h)
  ?:  ?|  ?=(^ pending.view)
          !=(~ wait.view)
          ?=(^ err.view)
          ?=(^ cancelled.view)
      ==
    ~
  =/  calls  (open-calls:hl items.view)
  ?~  calls  ~
  `[%tools calls]
::
++  result
  |=  [events=(list event:h) id=ask-id:h issued=@da]
  ^-  (unit (each @t @t))
  ?~  events  ~
  =/  event  i.events
  ::  Stop at the input boundary so a prior invocation cannot supply a result.
  ?:  ?=(%input-received -.event)  ~
  ?:  ?=(%cancelled -.event)  `[%| reason.event]
  ?:  ?=(%halted -.event)  `[%| reason.event]
  ?:  ?&  ?=(%tool-completed -.event)
          =((call-id id issued) call-id.event)
      ==
    `[%& body.event]
  $(events t.events)
--

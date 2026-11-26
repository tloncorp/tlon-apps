::  The ship's model tokens this UTC month, for the hosted token-usage read.
::  It answers with the body of OpenClaw's gateway report, so hosting relays
::  either runtime's count to Settings unchanged.
/-  h=harness
/+  hl=harness, j=harness-workspace-json, automation=harness-tlon-automation
|%
++  month-start
  |=  now=@da
  ^-  @da
  =/  =date  (yore now)
  (year date(d.t 1, h.t 0, m.t 0, s.t 0, f.t ~))
::  A request in a new month starts that month's count.
++  count
  |=  [ledger=month-usage:h now=@da added=usage:h]
  ^-  month-usage:h
  =/  start  (month-start now)
  =?  ledger  !=(start start.ledger)  [start *usage:h]
  ledger(usage (add-usage:hl usage.ledger added))
++  event-usage
  |=  =event:h
  ^-  usage:h
  ?+  -.event  *usage:h
    %llm-completed  usage.event
    %checkpoint-completed  usage.event
    %compaction-failed  usage.event
  ==
::  Providers report cached input within prompt tokens, so the cache counts
::  are zero, and the count is never partial, so there is no cacheStatus.
++  report
  |=  [ledger=month-usage:h now=@da]
  ^-  json
  =/  start  (month-start now)
  =/  =usage:h  ?:(=(start start.ledger) usage.ledger *usage:h)
  =/  day  |=(at=@da `json`[%s (end [3 10] (stamp:automation at))])
  %-  pairs:enjs:format
  :~  ['updatedAt' (stamp:j now)]
      ['startDate' (day start)]
      ['endDate' (day now)]
      ['keyAttribution' %s 'unavailable']
      :-  'totals'
      %-  pairs:enjs:format
      :~  ['input' (numb:enjs:format prompt.usage)]
          ['output' (numb:enjs:format completion.usage)]
          ['cacheRead' (numb:enjs:format 0)]
          ['cacheWrite' (numb:enjs:format 0)]
          ['totalTokens' (numb:enjs:format (add prompt.usage completion.usage))]
      ==
      ['byProvider' %a ~]
  ==
--

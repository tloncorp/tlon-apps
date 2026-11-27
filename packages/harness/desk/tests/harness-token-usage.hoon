/-  h=harness
/+  *test, ledger=harness-token-usage
|%
++  november  `month-usage:h`[~2026.11.1 [30 12]]
++  test-requests-in-one-month-add-up
  %+  expect-eq
    !>(`month-usage:h`[~2026.11.1 [35 19]])
  !>((count:ledger november ~2026.11.30..23.59.59 [5 7]))
++  test-the-first-request-of-a-month-starts-its-count
  %+  expect-eq
    !>(`month-usage:h`[~2026.12.1 [5 7]])
  !>((count:ledger november ~2026.12.1..00.00.01 [5 7]))
++  test-a-failed-request-counts-nothing
  ;:  weld
      %+  expect-eq  !>(`usage:h`[0 0])
      !>((event-usage:ledger [%llm-failed 1 'http error 500']))
      %+  expect-eq  !>(`usage:h`[4 2])
      !>((event-usage:ledger [%compaction-failed 1 'Invalid summary.' [4 2]]))
  ==
++  test-the-report-is-the-gateway-body-for-this-month
  %+  expect-eq
    !>  %-  need
        %-  de:json:html
        '''
        {"updatedAt":1795996800000,"startDate":"2026-11-01","endDate":"2026-11-30",
         "keyAttribution":"unavailable","byProvider":[],
         "totals":{"input":30,"output":12,"cacheRead":0,"cacheWrite":0,"totalTokens":42}}
        '''
  !>((report:ledger november ~2026.11.30))
++  test-a-month-with-no-requests-reports-zero
  =/  body  (report:ledger november ~2027.1.15)
  ?>  ?=(%o -.body)
  ;:  weld
      (expect-eq !>(`json`[%s '2027-01-01']) !>((~(got by p.body) 'startDate')))
      %+  expect-eq
        !>  %-  pairs:enjs:format
            :~  ['input' (numb:enjs:format 0)]  ['output' (numb:enjs:format 0)]
                ['cacheRead' (numb:enjs:format 0)]  ['cacheWrite' (numb:enjs:format 0)]
                ['totalTokens' (numb:enjs:format 0)]
            ==
      !>((~(got by p.body) 'totals'))
  ==
--

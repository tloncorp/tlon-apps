/-  h=harness
/+  *test, rpc=harness-peer-rpc, hl=harness
|%
++  test-request-window-bounds-replay-and-clock-skew
  =/  now=@da  ~2026.9.8
  %-  expect
  !>  ?&  (fresh:rpc now now)  (fresh:rpc (sub now ~m9) now)  !(fresh:rpc (sub now ~m10) now)
          !(fresh:rpc (add now ~s31) now)
      ==
++  test-pruning-retains-pending-work-and-current-receipts
  =/  now=@da  ~2026.9.8
  =/  old  (sub now ~m11)
  =/  receipts=(map [@p ask-id:h] peer-receipt:h)
    %-  my
    :~  [[~nec 0v1] [old 'tool' '{}' 'a' ~]]  [[~nec 0v2] [old 'tool' '{}' 'a' `[%& 'done']]]
        [[~nec 0v3] [now 'tool' '{}' 'a' `[%& 'done']]]
    ==
  =/  next  (prune:rpc receipts now)
  %-  expect
  !>(&((~(has by next) [~nec 0v1]) !(~(has by next) [~nec 0v2]) (~(has by next) [~nec 0v3])))
++  test-duplicate-id-must-match-the-entire-invocation
  =/  receipt=peer-receipt:h  [~2026.9.8 'tool' '{}' 'a' ~]
  %-  expect
  !>  ?&  (same:rpc receipt ~2026.9.8 'tool' '{}')  !(same:rpc receipt ~2026.9.8 'other' '{}')
          !(same:rpc receipt ~2026.9.8 'tool' '{"x":1}')  !(same:rpc receipt ~2026.9.9 'tool' '{}')
      ==
++  test-direct-execution-never-schedules-a-serving-model
  =/  call=tool-call:h  [(call-id:rpc 0v1 ~2026.9.8) 'current_time' '{}']
  =/  =event:h  [%input-received [0v1 [%peer ~nec 0v1] `~nec ~ ~2026.9.8 [%assistant '' ~[call]]]]
  =/  view  (play:hl ~[event])
  ;:  weld
      (expect-eq !>(`[%tools ~[call]]) !>((step:rpc view)))
      (expect-eq !>(~) !>((step:rpc (play:hl ~[[%tool-completed id.call name.call '[]'] event]))))
      %+  expect-eq
        !>(`[%& '[]'])
      !>((result:rpc ~[[%tool-completed id.call name.call '[]'] event] 0v1 ~2026.9.8))
      %+  expect-eq
        !>(`[%| 'stopped'])
      !>((result:rpc ~[[%cancelled ~ ~ 'stopped'] event] 0v1 ~2026.9.8))
      (expect-eq !>(~) !>((result:rpc ~[event [%cancelled ~ ~ 'old cancellation']] 0v1 ~2026.9.8)))
      (expect !>(!=((call-id:rpc 0v1 ~2026.9.8) (call-id:rpc 0v1 ~2026.9.9))))
  ==
--

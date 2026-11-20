/-  h=harness
/+  *test, hl=harness
|%
++  test-current-generation-is-accepted
  =/  ses=session:h  [~[[%tool-requested-2 7 'same' 'http_fetch']] 7]
  (expect !>((request-current:hl ses `7 'same')))
++  test-old-generation-cannot-borrow-reused-call-id
  =/  ses=session:h
    :*  :~  [%tool-requested-2 8 'same' 'http_fetch']
            [%tool-completed 'same' 'http_fetch' 'cancelled']
            [%tool-requested-2 7 'same' 'http_fetch']
        ==
        8
    ==
  (expect !>(&(!(request-current:hl ses `7 'same') (request-current:hl ses `8 'same'))))
++  test-legacy-receipt-cannot-borrow-new-marker
  =/  ses=session:h
    [~[[%tool-requested-2 8 'same' 'http_fetch'] [%tool-requested 'same' 'http_fetch']] 8]
  (expect !>(!(request-current:hl ses ~ 'same')))
++  test-legacy-inflight-request-remains-readable
  =/  ses=session:h  [~[[%tool-requested 'same' 'http_fetch']] 7]
  (expect !>(&((request-current:hl ses ~ 'same') !(request-current:hl ses `7 'same'))))
++  test-completed-request-has-no-authority
  =/  ses=session:h
    [~[[%tool-completed 'same' 'http_fetch' 'done'] [%tool-requested-2 7 'same' 'http_fetch']] 7]
  (expect !>(!(request-current:hl ses `7 'same')))
++  test-marker-must-match-session-generation
  =/  ses=session:h  [~[[%tool-requested-2 7 'same' 'http_fetch']] 8]
  (expect !>(!(request-current:hl ses `7 'same')))
++  test-cancelled-request-has-no-authority
  =/  ses=session:h  [~[[%cancelled ~ ~ 'stopped'] [%tool-requested-2 7 'same' 'http_fetch']] 7]
  (expect !>(!(request-current:hl ses `7 'same')))
++  test-forked-away-request-has-no-authority
  =/  ses=session:h  [~[[%forked 'parent' 1 ~ ~] [%tool-requested-2 7 'same' 'http_fetch']] 7]
  (expect !>(!(request-current:hl ses `7 'same')))
--

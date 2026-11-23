/-  h=harness
/+  *test, failure=harness-failure, hl=harness
|%
++  test-http-errors-have-safe-categories
  %-  expect
  !>  ?&  =('authentication' kind:(describe:failure 'http error 401: secret'))
          =('credits' kind:(describe:failure 'http error 402: secret'))
          =('rate-limit' kind:(describe:failure 'http error 429: secret'))
          =('permission' kind:(describe:failure 'http error 403: secret'))
      ==
++  test-private-provider-error-is-not-published
  =/  body  (public-message:failure 'http error 401: credential=TOP_SECRET private prompt')
  %-  expect
  !>  ?&  !(contains:failure body 'top_secret')  !(contains:failure body 'private prompt')
          (contains:failure body 'authenticate')
      ==
++  test-structured-provider-error-retains-private-diagnostic
  =/  jon  (need (de:json:html '{"error":{"type":"authentication_error","message":"fixture"}}'))
  =/  raw  (need (wire-error:failure jon))
  (expect-eq !>('authentication') !>(kind:(describe:failure raw)))
::  A loop-guard halt reaches a hand as this text, from either guard.
::
++  asks-again
  ^-  (unit [kind=@t message=@t])
  `['loop-guard' 'I stopped before finishing this. You can ask me to try again in a new message.']
++  rounds
  |=  [count=@ud name=@t body=@t]
  ^-  (list item:h)
  :-  [%user 'Use the tool.']
  %-  zing
  %+  turn  (gulf 1 count)
  |=  n=@ud
  =/  id  (scot %ud n)
  :~  [%assistant '' ~[[id name '{}']]]
      [%tool id name body]
  ==
++  halted
  |=  items=(list item:h)
  ^-  (unit [kind=@t message=@t])
  =/  v=view:h  *view:h
  =/  step  (decide:hl v(items items) |=(~ 0))
  ?.  ?=([~ %halt *] step)  ~
  `(describe:failure reason.u.step)
++  test-four-failed-tool-calls-halt-asks-for-a-new-message
  %+  expect-eq  !>(asks-again)
  !>((halted (rounds 4 'no_such_tool' 'rejected: tool is not granted for this session')))
::  Completed successful rounds, ending on a result with no open call.
::
++  test-step-limit-halt-asks-for-a-new-message
  %+  expect-eq  !>(asks-again)
  !>((halted (rounds 24 'current_time' '2026-10-01T00:00:00Z')))
::  Saved sessions keep these reasons; reads describe them again.
::
++  test-saved-loop-guard-reasons-ask-for-a-new-message
  ;:  weld
    %+  expect-eq  !>((need asks-again))
    !>  (describe:failure 'loop guard: 4 tool calls in a row failed. stopping so you can rethink or ask for help — send a new message to continue.')
    %+  expect-eq  !>((need asks-again))
    !>  (describe:failure 'loop guard: 24 turns without resolving the request. stopping to avoid a runaway — send a new message to continue.')
  ==
++  test-loop-guard-wording-inside-another-error-is-not-a-halt
  %-  expect
  !>  !=('loop-guard' kind:(describe:failure 'provider error: loop guard: 4 tool calls'))
--

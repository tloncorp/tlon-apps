/-  h=harness
/+  *test, hs=harness-session, hj=harness-json
|%
++  test-pages-preserve-addresses
  =/  log=(list event:h)
    (turn (gulf 1 95) |=(n=@ud `event:h`[%command-completed `@uv`n 'fixture' 'reply']))
  =/  ses=session:h  [log 1]
  =/  recent  (history:hs ses ~)
  =/  older  (history:hs ses `56)
  =/  first  (history:hs ses `16)
  ;:  weld
      (expect-eq !>(before.recent) !>(`json`[%n '56']))
      (expect-eq !>(before.older) !>(`json`[%n '16']))
      (expect-eq !>(before.first) !>(`json`~))
      (expect-eq !>(entries:(history:hs ses `0)) !>(`json`[%a ~]))
  ==
++  test-cancellation-receipts-stay-together
  =/  tail=(list event:h)
    :~  [%cancelled ~ (silt ~['a' 'b']) 'cancelled by client']
        :*  %llm-completed  0  %tool-calls  [1 1]
            [%assistant '' ~[['a' 'http_fetch' '{}'] ['b' 'http_fetch' '{}']]]
        ==
    ==
  =/  log
    %+  weld
      (turn (gulf 1 39) |=(n=@ud `event:h`[%command-completed `@uv`n 'fixture' 'reply']))
    tail
  =/  page  (history:hs [log 1] ~)
  ?>  ?=(%a -.entries.page)
  ;:  weld
      (expect-eq !>((lent p.entries.page)) !>(41))
      (expect-eq !>(before.page) !>(`json`[%n '2']))
  ==
++  test-page-cursors-skip-non-transcript-events
  =/  log=(list event:h)
    :~  [%config-replaced *config:h]
        [%command-completed 0v1 'memory' 'latest']
        [%context-received 0v1 'private context']
        [%input-received [0v1 [%acp 'client'] `~zod ~ ~2026.10.2 [%user '/memory']]]
        [%config-replaced *config:h]
    ==
  =/  rows=(list [@ud (unit input-id:h) item:h])
    ~[[2 `0v1 [%user '/memory']] [4 ~ [%assistant 'latest' ~]]]
  =/  expected  [%a (turn rows transcript-row-json:hj)]
  =/  older
    [%a ~[(transcript-row-json:hj [2 `0v1 [%user '/memory']])]]
  ;:  weld
      (expect-eq !>([expected `json`~]) !>((history:hs [log 0] ~)))
      (expect-eq !>([expected `json`~]) !>((history:hs [log 0] `100)))
      (expect-eq !>([older `json`~]) !>((history:hs [log 0] `4)))
      (expect-eq !>([`json`[%a ~] `json`~]) !>((history:hs [log 0] `2)))
      (expect-eq !>([`json`[%a ~] `json`~]) !>((history:hs [~ 0] ~)))
  ==
++  test-byte-budget-keeps-one-large-entry-whole
  =/  body  (rap 3 (reap 262.144 'x'))
  =/  log=(list event:h)
    :~  [%command-completed 0v2 'fixture' body]
        [%config-replaced *config:h]
        [%command-completed 0v1 'fixture' 'older']
    ==
  =/  page  (history:hs [log 0] ~)
  =/  older  (history:hs [log 0] `3)
  ;:  weld
      (expect-eq !>(`json`[%n '3']) !>(before.page))
      %+  expect-eq
        !>(`json`[%a ~[(transcript-row-json:hj [3 ~ [%assistant body ~]])]])
      !>(entries.page)
      %+  expect-eq
        !>(`json`[%a ~[(transcript-row-json:hj [1 ~ [%assistant 'older' ~]])]])
      !>(entries.older)
      (expect-eq !>(`json`~) !>(before.older))
  ==
--

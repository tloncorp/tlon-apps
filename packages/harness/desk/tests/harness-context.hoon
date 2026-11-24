/-  h=harness
/-  c=harness-corpus
/+  *test, ctx=harness-context, hl=harness, hp=harness-provider, hs=harness-session,
    policy=harness-defaults, corpus=harness-corpus
|%
++  fixture
  ^-  view:h
  =/  v=view:h  *view:h
  %=  v  config  builtin-config:policy  items
      :~  [%user 'Remember the old project constraints and decisions.']
          :*  %assistant
              'We decided on a small, modular implementation with retained source history.'  ~
          ==
          [%user 'Recent question']  [%assistant 'Recent answer' ~]  [%user 'Current question']
      ==
  ==
++  planned
  ^-  compaction-plan:h
  =/  p  (plan:ctx fixture 10 ~ |=(v=view:h (estimate:hp v %compaction ~)))
  ?>  ?=(%& -.p)
  p.p
++  test-output-and-margin-are-reserved
  %-  expect
  !>  ?&  =(4.096 (output-budget:ctx 80.000))  =(67.904 (input-budget:ctx 80.000))
          =(0 (input-budget:ctx 0))  =(650 (input-budget:ctx 1.000))
      ==
++  test-trigger-and-tail-scale-with-model-capacity
  %-  expect
  !>  ?&  =(175.904 (input-budget:ctx 200.000))  =(895.904 (input-budget:ctx 1.000.000))
          =(650 (input-budget:ctx 1.000))  =((div 175.904 3) (tail-budget:ctx 200.000))
          =((div 895.904 3) (tail-budget:ctx 1.000.000))
      ==
++  test-same-context-fits-large-model-and-compacts-for-smaller-model
  =/  v  fixture
  =/  body  (rap 3 (reap 110.000 'x'))
  =.  v
    %=  v  items
        :~  [%user body]  [%assistant body ~]  [%user 'recent']  [%assistant 'recent answer' ~]
            [%user 'current']
        ==
    ==
  %-  expect
  !>  ?&  ?=([~ %turn ~] (next:hs v ~ ~))
          ?=([~ %compact ~] (next:hs v(max-context.config 60.000) ~ ~))
          ?=([~ %compact ~] (next:hs v(max-context.config 60.000, compact-attempts 1) ~ ~))
      ==
++  test-plan-protects-recent-exchange-and-current-input
  =/  p  planned
  =/  v  fixture
  %-  expect
  !>  ?&  =(2 count.p)  =(10 through.p)  =(source.p (source-hash:ctx v 2))
          (lte input.p (input-budget:ctx max-context.config.v))
      ==
++  test-plan-refuses-outstanding-tools-or-inference
  =/  v  fixture
  =/  tools  (plan:ctx v(wait (silt ~['call'])) 10 ~ |=(view:h 1))
  =/  llm  (plan:ctx v(pending `[1 %turn]) 10 ~ |=(view:h 1))
  (expect !>(&(?=(%| -.tools) ?=(%| -.llm))))
++  test-tool-group-is-not-a-cut
  =/  items=(list item:h)
    :~  [%user 'ask']  [%assistant '' ~[['call' 'http_fetch' '{}']]]
        [%tool 'call' 'http_fetch' 'result']  [%assistant 'done' ~]
    ==
  (expect-eq !>(`(list @ud)`~[4]) !>((boundaries:ctx items)))
++  test-tool-batches-close-only-after-every-parallel-result
  =/  items=(list item:h)
    :~  [%user 'Read both']  [%assistant '' ~[['a' 'http_fetch' '{}'] ['b' 'http_fetch' '{}']]]
        [%tool 'a' 'http_fetch' 'first']  [%tool 'a' 'http_fetch' 'duplicate']
        [%tool 'b' 'http_fetch' 'second']  [%user 'Next']
    ==
  ;:  weld
      (expect-eq !>(`(list @ud)`~[5]) !>((tool-boundaries:ctx items)))
      (expect-eq !>(`(list @ud)`~) !>((tool-boundaries:ctx (scag 4 items))))
      (expect-eq !>(`(list @ud)`~[0]) !>((preserved-input:ctx items 5)))
  ==
++  test-unfinished-turn-can-compact-settled-tool-batches
  =/  v  fixture
  =/  evidence  (rap 3 (reap 110.000 'x'))
  =.  max-context.config.v  60.000
  =.  items.v
    :~  [%user 'Original request']  [%assistant '' ~[['a' 'http_fetch' '{}']]]
        [%tool 'a' 'http_fetch' evidence]  [%assistant '' ~[['b' 'http_fetch' '{}']]]
        [%tool 'b' 'http_fetch' evidence]  [%user 'Additional constraint']
    ==
  =/  result  (plan:ctx v 20 ~ |=(candidate=view:h (estimate:hp candidate %compaction ~)))
  ?>  ?=(%& -.result)
  ;:  weld
      (expect !>(?=([~ %compact ~] (next:hs v ~ ~))))
      (expect-eq !>(3) !>(count.p.result))
      (expect-eq !>(`(list @ud)`~[0]) !>((preserved-input:ctx items.v count.p.result)))
  ==
++  test-short-history-does-not-summarize-only-a-trivial-prefix
  =/  items=(list item:h)
    :~  [%user '/remember project small']  [%assistant 'Saved' ~]  [%user 'older project evidence']
        [%assistant 'older decision' ~]  [%user 'recent']  [%assistant 'recent answer' ~]
    ==
  (expect-eq !>(`@ud`4) !>((preferred:ctx items ~[2 4] (tail-budget:ctx 80.000))))
++  test-oversized-summary-is-not-dispatched
  =/  result  (plan:ctx fixture 10 ~ |=(v=view:h +(max-context.config.v)))
  (expect !>(?=(%| -.result)))
++  test-irreducible-input-does-not-proceed-over-budget
  =/  v  fixture
  =.  v  v(items ~[[%user 'huge']], max-context.config 1)
  =/  next  (next:hs v ~ ~)
  =/  result  (plan:ctx v 10 ~ |=(view:h 999.999))
  (expect !>(&(?=([~ %compact ~] next) ?=(%| -.result))))
++  test-attempt-limit-is-finite
  =/  v  fixture
  =/  result  (plan:ctx v(compact-attempts 4) 10 ~ |=(view:h 1))
  (expect !>(?=(%| -.result)))
++  test-new-input-does-not-change-selected-coverage
  =/  v  fixture
  =/  newer  v(items (snoc items.v [%user 'Arrived after dispatch']))
  %+  expect-eq
    !>(`(unit @t)`~)
  !>((validate:ctx newer planned %stop [%assistant 'Small checkpoint.' ~]))
++  test-changed-base-checkpoint-is-rejected
  =/  v  fixture
  =/  result
    %:  validate:ctx
      v(summary `'different base')
      planned
      %stop
      [%assistant 'Small checkpoint.' ~]
    ==
  (expect !>(?=(^ result)))
++  test-empty-truncated-tool-and-expanding-results-are-rejected
  =/  empty  (validate:ctx fixture planned %stop [%assistant ' \0a' ~])
  =/  truncated  (validate:ctx fixture planned %length [%assistant 'Small' ~])
  =/  tool  (validate:ctx fixture planned %tool-calls [%assistant '' ~[['call' 'http_fetch' '{}']]])
  =/  expanded  (validate:ctx fixture planned %stop [%assistant (rap 3 (reap 200 'x')) ~])
  (expect !>(&(?=(^ empty) ?=(^ truncated) ?=(^ tool) ?=(^ expanded))))
++  history
  ^-  (list event:h)
  :~  [%compaction-planned 0 planned]
      [%input-admitted [%user 'Current question']]
      [%llm-completed 9 %stop [0 0] [%assistant 'Recent answer' ~]]
      [%input-admitted [%user 'Recent question']]
      :*  %llm-completed  8  %stop  [0 0]
          :*  %assistant
              'We decided on a small, modular implementation with retained source history.'  ~
          ==
      ==
      [%input-admitted [%user 'Remember the old project constraints and decisions.']]
      [%config-replaced builtin-config:policy]
  ==
++  test-checkpoint-replay-keeps-new-tail-and-separate-usage
  =/  log
    [[%checkpoint-completed 0 'Small' [12 3] ~] [%input-admitted [%user 'new input']] history]
  =/  v  (play:hl log)
  %-  expect
  !>  ?&  =(4 (lent items.v))  =(6 (lent (transcript:hl log)))  =([12 3] compact-usage.v)
          =([12 3] total.v)  =(`item:h`[%user 'new input'] (rear items.v))
      ==
++  test-incremental-checkpoint-keeps-context-and-addresses
  =/  events=(list event:h)
    :~  [%input-admitted [%user 'new input']]
        [%checkpoint-completed 0 'Small' [12 3] `[0v1 'Compacted.']]
    ==
  =/  expected  (play:hl (weld (flop events) history))
  (expect-eq !>(expected) !>((advance:hl events (play:hl history))))
++  test-cancelled-checkpoint-cannot-revive
  =/  cancelled  [[%cancelled `0 ~ 'stop'] history]
  =/  before  (play:hl cancelled)
  %+  expect-eq
    !>(before(revision +(revision.before)))
  !>((play:hl [[%checkpoint-completed 0 'late' [12 3] ~] cancelled]))
++  test-manual-acknowledgement-does-not-swallow-new-input
  =/  log=(list event:h)
    :*  [%checkpoint-completed 0 'Small' [12 3] `[0v1 'Compacted.']]
        [%input-admitted [%user 'new input']]  history
    ==
  =/  v  (play:hl log)
  %-  expect
  !>  ?&  =(`item:h`[%user 'new input'] (rear items.v))  ?=([~ %turn ~] (next:hs v ~ log))
          =(7 (lent (transcript:hl log)))
      ==
++  test-replay-rejects-changed-source-coverage
  =/  p  planned
  =/  changed  [[%compaction-planned 0 p(source 0v0)] (slag 1 history)]
  =/  before  (play:hl changed)
  %+  expect-eq
    !>(before(revision +(revision.before)))
  !>((play:hl [[%checkpoint-completed 0 'Small' [12 3] ~] changed]))
++  test-failed-checkpoint-keeps-context-and-accounts-usage
  =/  before  fixture
  =/  v  (play:hl [[%compaction-failed 0 'failed' [12 3]] history])
  %-  expect
  !>  ?&  =(items.before items.v)  =(~ summary.v)  =([12 3] compact-usage.v)  =(`'failed' err.v)
          =(~ pending.v)  =(~ (next:hs v ~ ~))
      ==
++  test-legacy-reduction-counts-the-selected-prior-summary
  =/  v  fixture
  =.  v  v(summary `(rap 3 (reap 1.000 'x')), items ~[[%user 'small'] [%assistant 'pair' ~]])
  =/  p  planned
  =.  p  p(count 2, source (source-hash:ctx v 2))
  %+  expect-eq
    !>(~)
  !>((validate:ctx v p %stop [%assistant 'A reduced checkpoint with the prior decisions.' ~]))
++  test-oversized-prefix-backs-off-at-exchange-boundaries
  =/  v  fixture
  =/  body  (rap 3 (reap 2.000 'x'))
  =/  pair=(list item:h)  ~[[%user body] [%assistant body ~]]
  =.  v  v(items (zing (reap 4 pair)), max-context.config 1.000)
  =/  result  (plan:ctx v 20 ~ |=(candidate=view:h (add 100 (mul 200 (lent items.candidate)))))
  ?>  ?=(%& -.result)
  (expect-eq !>(`@ud`2) !>(count.p.result))
++  test-estimate-uses-dispatched-encoding
  =/  v  fixture
  =.  url.config.v  'https://chatgpt.com/backend-api/codex/responses'
  =/  encoded  (en:json:html (payload:hp v %turn ~))
  (expect-eq !>((div (add 3 (met 3 encoded)) 4)) !>((est-tokens:hp v ~ ~)))
++  test-responses-requires-terminal-event-and-accounts-usage
  =/  item=@t
    'data: {"type":"response.output_item.done","item":{"type":"message","content":[{"text":"Small"}]}}\0a\0a'
  =/  incomplete  (parse-responses-sse:hp item)
  =/  done
    %-  parse-responses-sse:hp
    %^  cat
      3
      item
    'data: {"type":"response.completed","response":{"usage":{"input_tokens":12,"output_tokens":3}}}\0a\0a'
  ?>  ?=(%& -.done)
  (expect !>(&(?=(%| -.incomplete) =([12 3] u.p.done) =(%stop stop.p.done))))
::  A turn that ended with a marked size failure, newest first. Event
::  addresses count from one: the huge input is event 4.
::
++  input
  |=  [id=@uv body=@t]
  ^-  admitted-input:h
  [id [%acp 'test'] `~zod ~ ~2024.1.1 [%user body]]
++  marked
  (overflow:hl 'http error 400: {"error":{"code":"context_length_exceeded"}}')
++  raw-size
  'http error 400: {"error":{"code":"context_length_exceeded"}}'
++  refused
  |=  err=@t
  ^-  (list event:h)
  :~  [%llm-failed 1 err]
      [%llm-routed 1 builtin-config:policy]
      [%llm-requested 1 %turn]
      [%input-received (input 0v2 'HUGE paste')]
      [%llm-completed 0 %stop [0 0] [%assistant 'Earlier answer' ~]]
      [%input-received (input 0v1 'Earlier question')]
      [%config-replaced builtin-config:policy]
  ==
++  answered
  ^-  (list item:h)
  ~[[%user 'Earlier question'] [%assistant 'Earlier answer' ~]]
++  notes
  |=  items=(list item:h)
  (lent (skim items |=(it=item:h =(it [%user left-out:hl]))))
::  The original input event stays in the log and the transcript; only the
::  replayed context replaces it.
::
++  test-overflowed-turn-is-left-out-at-the-next-input
  =/  log=(list event:h)  [[%input-received (input 0v3 'Short')] (refused marked)]
  =/  v  (play:hl log)
  %-  expect
  !>  ?&  =(items.v (weld answered `(list item:h)`~[[%user left-out:hl] [%user 'Short']]))
          =(positions.v ~[2 3 4 8])
          =(~ err.v)
          ?=([~ %turn ~] (next:hs v ~ log))
          (lien log |=(=event:h =(event [%input-received (input 0v2 'HUGE paste')])))
          %+  lien  (transcript:hl log)
          |=([@ud input-id=(unit @uv) =item:h] =(item [%user 'HUGE paste']))
      ==
::  A Tlon input records its context reference first; the note replaces the
::  failed turn at the reference, so the reference stays with its input.
::
++  test-context-reference-before-input-is-kept
  =/  log=(list event:h)
    :*  [%input-received (input 0v3 'Short')]
        [%context-received 0v3 'Reference material']
        (refused marked)
    ==
  =/  v  (play:hl log)
  %+  expect-eq
    !>((weld answered `(list item:h)`~[[%user left-out:hl] [%user 'Reference material'] [%user 'Short']]))
  !>(items.v)
++  test-left-out-turn-keeps-tool-exchanges-whole
  =/  log=(list event:h)
    :~  [%input-admitted [%user 'Short']]
        [%halted marked]
        [%llm-requested 2 %turn]
        [%tool-completed 'call' 'http_fetch' 'A large page']
        [%llm-completed 1 %tool-calls [0 0] [%assistant '' ~[['call' 'http_fetch' '{}']]]]
        [%llm-requested 1 %turn]
        [%input-admitted [%user 'Fetch the page']]
        [%llm-completed 0 %stop [0 0] [%assistant 'Earlier answer' ~]]
        [%input-admitted [%user 'Earlier question']]
        [%config-replaced builtin-config:policy]
    ==
  =/  v  (play:hl log)
  %-  expect
  !>  ?&  =(items.v (weld answered `(list item:h)`~[[%user left-out:hl] [%user 'Short']]))
          =(~ (open-calls:hl items.v))
      ==
::  A summary refused for size keeps its marked reason in the view until the
::  next admission, which leaves the unanswered input out.
::
++  test-summary-failure-keeps-the-size-cause
  =/  log=(list event:h)
    :*  [%input-admitted [%user 'Short']]
        [%compaction-failed 0 marked [0 0]]
        history
    ==
  =/  failed  (play:hl (slag 1 log))
  =/  v  (play:hl log)
  %-  expect
  !>  ?&  =(`marked err.failed)
          =([%user 'Current question'] (rear items.failed))
          =(1 (notes items.v))
          !(lien items.v |=(it=item:h =(it [%user 'Current question'])))
          =([%user 'Short'] (rear items.v))
      ==
::  Failures recorded before the marker existed replay as they always did,
::  including a checkpoint planned over them later.
::
++  test-old-size-failures-replay-unchanged
  =/  base=(list event:h)
    :*  [%input-admitted [%user 'Third']]
        [%halted 'context budget: No completed exchange or settled tool batch is available for compaction.']
        [%input-admitted [%user 'Second']]
        (refused raw-size)
    ==
  =/  before  (play:hl base)
  =/  plan  (plan:ctx before (lent base) ~ |=(view:h 1))
  ?>  ?=(%& -.plan)
  =/  log=(list event:h)  [[%checkpoint-completed 0 'Small' [0 0] ~] [%compaction-planned 0 p.plan] base]
  =/  v  (play:hl log)
  %-  expect
  !>  ?&  =(0 (notes items.before))
          =(items.before (weld answered `(list item:h)`~[[%user 'HUGE paste'] [%user 'Second'] [%user 'Third']]))
          =(`'Small' summary.v)
          =(0 (notes items.v))
          (lien items.v |=(it=item:h =(it [%user 'HUGE paste'])))
      ==
::  Full replay, incremental advance and the corpus fold reach the same
::  context after a substitution and a checkpoint accepted over it.
::
++  test-replay-advance-and-corpus-agree-after-substitution
  =/  substituted=(list event:h)  [[%input-received (input 0v3 'Short')] (refused marked)]
  =/  answer=(list event:h)
    :~  [%llm-completed 2 %stop [0 0] [%assistant 'Short answer' ~]]
        [%llm-requested 2 %turn]
    ==
  =/  middle  (weld answer substituted)
  =/  plan  (plan:ctx (play:hl middle) (lent middle) ~ |=(view:h 1))
  ?>  ?=(%& -.plan)
  =/  later=(list event:h)
    :~  [%input-received (input 0v4 'Later')]
        [%checkpoint-completed 3 'Small' [0 0] ~]
        [%compaction-planned 3 p.plan]
    ==
  =/  log=(list event:h)  (weld later middle)
  =/  played  (play:hl log)
  =/  advanced  (advance:hl (flop (scag 9 log)) (play:hl (slag 9 log)))
  =/  db  (capture:corpus *state:c 'agree' log)
  =/  db
    =/  fuel=@ud  1.000
    |-  ^-  state:c
    ?~  queued.db  db
    ?>  (gth fuel 0)
    $(db (work:corpus db 2 1.024), fuel (dec fuel))
  =/  folded  view:(~(got by scopes.db) (~(got by names.db) 'agree'))
  ;:  weld
    (expect-eq !>(`'Small') !>(summary.played))
    (expect-eq !>(1) !>((notes items.played)))
    (expect-eq !>(items.played) !>(items.advanced))
    (expect-eq !>(positions.played) !>(positions.advanced))
    ::  The corpus keeps the fold's newest-first accumulator.
    (expect-eq !>(items.played) !>((flop items.folded)))
    (expect-eq !>(positions.played) !>((flop positions.folded)))
  ==
::  Retry clears the failure without an admission, so the original is sent.
::
++  test-retry-keeps-the-original
  =/  v  (play:hl [[%retried ~] [%halted marked] (refused marked)])
  %-  expect
  !>  ?&  =(~ err.v)
          =(0 (notes items.v))
          =([%user 'HUGE paste'] (rear items.v))
      ==
::  Huge input A gets an invalid automatic summary, which is not marked, so
::  short B joins it; B's turn then ends marked, and C replaces both.
::
++  test-invalid-automatic-summary-then-two-messages
  =/  start=(list event:h)
    :~  [%input-received (input 0v2 'HUGE A')]
        [%llm-completed 0 %stop [0 0] [%assistant 'Earlier answer' ~]]
        [%input-received (input 0v1 'Earlier question')]
        [%config-replaced builtin-config:policy]
    ==
  =/  plan  (plan:ctx (play:hl start) (lent start) ~ |=(view:h 1))
  ?>  ?=(%& -.plan)
  =/  invalid=(list event:h)
    :*  [%compaction-failed 0 'Compaction did not reduce the context; the previous context was retained.' [0 0]]
        [%compaction-planned 0 p.plan]
        start
    ==
  =/  with-b=(list event:h)  [[%input-received (input 0v3 'Short B')] invalid]
  =/  log=(list event:h)
    :*  [%input-received (input 0v4 'Short C')]
        [%halted (overflow:hl 'No completed exchange or settled tool batch is available for compaction.')]
        with-b
    ==
  =/  b  (play:hl with-b)
  =/  v  (play:hl log)
  %-  expect
  !>  ?&  =(0 (notes items.b))
          =(items.b (weld answered `(list item:h)`~[[%user 'HUGE A'] [%user 'Short B']]))
          =(items.v (weld answered `(list item:h)`~[[%user left-out:hl] [%user 'Short C']]))
      ==
++  test-model-change-keeps-the-note
  =/  other  builtin-config:policy
  =.  other  other(model 'another-model', max-context 2.000.000)
  =/  log=(list event:h)
    :*  [%input-received (input 0v3 'Short')]
        [%config-replaced other]
        (refused marked)
    ==
  =/  v  (play:hl log)
  %-  expect
  !>  ?&  =(1 (notes items.v))
          =('another-model' model.config.v)
          =([%user 'Short'] (rear items.v))
      ==
::  A marked failure with nothing unanswered is consumed at once, so a fresh
::  Tlon reference recorded before the next input is never left out.
::
++  test-marker-with-no-unanswered-turn-keeps-fresh-context
  =/  start=(list event:h)
    :~  [%llm-completed 0 %stop [0 0] [%assistant 'Earlier answer' ~]]
        [%input-received (input 0v1 'Earlier question')]
        [%config-replaced builtin-config:policy]
    ==
  =/  plan  (plan:ctx (play:hl start) (lent start) ~ |=(view:h 1))
  ?>  ?=(%& -.plan)
  =/  log=(list event:h)
    :*  [%input-received (input 0v3 'Short')]
        [%context-received 0v3 'Reference material']
        [%compaction-failed 0 marked [0 0]]
        [%compaction-planned 0 p.plan]
        start
    ==
  =/  v  (play:hl log)
  %-  expect
  !>  ?&  =(items.v (weld answered `(list item:h)`~[[%user 'Reference material'] [%user 'Short']]))
          =(0 (notes items.v))
      ==
--

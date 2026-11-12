/-  h=harness
/+  *test, ctx=harness-context, hl=harness, hp=harness-provider, hs=harness-session,
    policy=harness-defaults
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
--

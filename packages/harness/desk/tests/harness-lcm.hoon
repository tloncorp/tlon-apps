/-  h=harness, l=harness-lcm
/+  *test, hl=harness, lc=harness-lcm, planner=harness-lcm-context, context=harness-context,
    policy=harness-defaults
|%
++  forest
  ^-  forest:l
  =/  out  *forest:l
  %+  roll  `(list @ud)`~[10 20 30 40 50]
  |=  [id=@ud out=forest:l]
  (need (append:lc out id 'Leaf evidence' ~[(dec id)] ~))
++  log
  ^-  (list event:h)
  %-  flop
  ^-  (list event:h)
  :~  [%config-replaced builtin-config:policy]
      [%input-admitted [%user 'First question with original details that must remain recoverable.']]
      :*  %llm-completed  0  %stop  [1 1]
          [%assistant 'First answer and decisions with source references.' ~]
      ==
      [%input-admitted [%user 'Second question with enough material to summarize accurately.']]
      :*  %llm-completed  1  %stop  [1 1]
          [%assistant 'Second answer and the current state of the work.' ~]
      ==
      [%input-admitted [%user 'Newest question stays verbatim.']]
      [%llm-completed 2 %stop [1 1] [%assistant 'Newest answer stays verbatim.' ~]]
  ==
++  planned
  ^-  lcm-plan:h
  =/  v  (play:hl log)
  =/  result
    %:  plan:planner
      v
      (lent log)
      ~
      config.v
      config.v
      |=(candidate=view:h (div (roll (turn items.candidate item-bytes:context) add) 4))
    ==
  ?>  ?=(%& -.result)
  p.result
++  test-leaf-plans-only-addressed-complete-exchanges
  (expect-eq !>(`(list @ud)`~[2 3 4 5]) !>(sources:planned))
++  test-positions-follow-replay-order
  (expect-eq !>(`(list @ud)`~[2 3 4 5 6 7]) !>(positions:(play:hl log)))
++  test-plan-keeps-current-model-and-selects-summary-route-separately
  =/  v  (play:hl log)
  =/  cfg  config.v(model 'summary-only')
  =/  result  (plan:planner v (lent log) ~ cfg cfg |=(candidate=view:h 100))
  ?>  ?=(%& -.result)
  (expect-eq !>('summary-only') !>(model.checkpoint.p.result))
++  test-leaf-request-does-not-resummarize-prior-roots
  =/  v  (play:hl log)
  =.  v  v(lcm forest, summary `(text:lc forest roots:forest))
  =/  req  (request:planner v planned config.v)
  (expect !>(&(=(~ summary.req) =(4 (lent items.req)))))
++  test-leaf-completion-keeps-newly-arrived-input
  =/  p  planned
  =/  events=(list event:h)
    :~  [%checkpoint-completed 3 'Earlier decisions.' [3 2] ~]
        [%input-admitted [%user 'Arrived while summarizing.']]
        [%lcm-planned 3 p]
    ==
  =/  v  (play:hl (weld events log))
  =/  node  (~(got by nodes.lcm.v) revision.v)
  ;:  weld
      (expect-eq !>(`(list @ud)`~[2 3 4 5]) !>(sources.node))
      (expect-eq !>(`item:h`[%user 'Arrived while summarizing.']) !>((rear items.v)))
      (expect-eq !>(`(list @ud)`~[6 7 9]) !>(positions.v))
  ==
++  test-cancelled-checkpoint-cannot-add-a-node
  =/  events=(list event:h)
    :~  [%checkpoint-completed 3 'Late summary.' [3 2] ~]
        [%cancelled `3 ~ 'stop']
        [%lcm-planned 3 planned]
    ==
  (expect-eq !>(`forest:l`*forest:l) !>(lcm:(play:hl (weld events log))))
++  test-invalid-source-addresses-cannot-add-a-node
  =/  p  planned
  =/  bad  p(sources ~[2 3])
  =/  events=(list event:h)
    ~[[%checkpoint-completed 3 'Forged coverage.' [3 2] ~] [%lcm-planned 3 bad]]
  (expect-eq !>(`forest:l`*forest:l) !>(lcm:(play:hl (weld events log))))
++  test-hierarchy-preserves-leaves-and-replaces-one-contiguous-group
  =/  children  (group:lc forest)
  =/  next  (need (append:lc forest 60 'Condensed decisions.' ~ children))
  =/  parent  (~(got by nodes.next) 60)
  ;:  weld
      (expect-eq !>(`(list @ud)`~[10 20 30 40]) !>(children))
      (expect-eq !>(`(list @ud)`~[60 50]) !>(roots.next))
      (expect-eq !>(1) !>(depth.parent))
      (expect-eq !>(6) !>(~(wyt by nodes.next)))
      (expect-eq !>(~) !>(sources.parent))
  ==
++  test-noncontiguous-and-forward-edges-are-rejected
  %-  expect
  !>  ?&  =(~ (append:lc forest 60 'Bad order' ~ ~[10 30]))
          =(~ (append:lc forest 30 'Forward edge' ~ ~[40]))
      ==
++  test-condensation-request-is-bounded-to-four-nodes
  =/  v  (play:hl log)
  =.  v  v(lcm forest, summary `(text:lc forest roots:forest))
  =/  result  (plan:planner v (lent log) ~ config.v config.v |=(candidate=view:h 100))
  ?>  ?=(%& -.result)
  ;:  weld
      (expect-eq !>(0) !>(count.checkpoint.p.result))
      (expect-eq !>(`(list @ud)`~[10 20 30 40]) !>(children.p.result))
      (expect-eq !>(~) !>(sources.p.result))
  ==
++  test-empty-truncated-and-expanding-summaries-retain-context
  =/  v  (play:hl log)
  =/  p  planned
  =/  huge  (rap 3 (reap 500 'expanded'))
  %-  expect
  !>  ?&  ?=(^ (validate:planner v p %stop [%assistant '' ~]))
          ?=(^ (validate:planner v p %length [%assistant 'short' ~]))
          ?=(^ (validate:planner v p %stop [%assistant huge ~]))
      ==
++  test-mid-turn-checkpoint-keeps-request-addresses-and-complete-transcript
  =/  events=(list event:h)
    %-  flop
    ^-  (list event:h)
    :~  [%config-replaced builtin-config:policy]
        [%input-admitted [%user 'Inspect Telegram and write a factual digest.']]
        :*  %llm-completed  0  %tool-calls  [1 1]
            [%assistant '' ~[['a' 'call_mcp_tool' '{}'] ['b' 'call_mcp_tool' '{}']]]
        ==
        :*  %tool-completed  'a'  'call_mcp_tool'
            'First source, with enough evidence to reduce to a short checkpoint.'
        ==
        :*  %tool-completed  'b'  'call_mcp_tool'
            'Second source, with more evidence and references that stay in the transcript.'
        ==
    ==
  =/  v  (play:hl events)
  =/  result  (plan:planner v (lent events) ~ config.v config.v |=(view:h 100))
  ?>  ?=(%& -.result)
  =/  additions=(list event:h)
    :~  [%lcm-planned 1 p.result]
        [%input-admitted [%user 'Keep the reply short.']]
        [%checkpoint-completed 1 'Two sources inspected; write the digest.' [20 4] ~]
    ==
  =/  next-log  (weld (flop additions) events)
  =/  after  (play:hl next-log)
  ;:  weld
      %+  expect-eq
        !>  ^-  (list item:h)
            :~  [%user 'Inspect Telegram and write a factual digest.']
                [%user 'Keep the reply short.']
            ==
      !>(items.after)
      (expect-eq !>(`(list @ud)`~[2 7]) !>(positions.after))
      (expect-eq !>(after) !>((advance:hl additions v)))
      (expect-eq !>(5) !>((lent (transcript:hl next-log))))
      (expect-eq !>(`(list @ud)`~[2 3 4 5]) !>(sources:(~(got by nodes.lcm.after) 8)))
      (expect-eq !>(~) !>((open-calls:hl items.after)))
  ==
--

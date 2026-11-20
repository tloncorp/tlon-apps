::  Pure, source-addressed planning. The head supplies provider estimates and
::  resolved model policy; this module cannot dispatch or obtain credentials.
/-  h=harness
/+  context=harness-context, lcm=harness-lcm
|%
++  plan
  |=  $:  view=view:h
          through=@ud
          command=(unit input-id:h)
          leaf=config:h
          branch=config:h
          estimate=$-(view:h @ud)
      ==
  ^-  (each lcm-plan:h @t)
  ?:  |(?=(^ pending.view) !=(~ wait.view))
    [%| 'Compaction waits for inference and tools to settle.']
  ?:  (gte compact-attempts.view 4)
    [%| 'Compaction attempt limit reached; change the model or reduce the request.']
  =/  children  (group:lcm lcm.view)
  ?:  !=(~ children)
    |-  ^-  (each lcm-plan:h @t)
        =/  source  (text:lcm lcm.view children)
        =/  candidate  view(config branch, summary ~, items ~[[%user source]])
        =/  input  (estimate candidate)
        ?:  (gth input (input-budget:context max-context.branch))
          ?:  (lte (lent children) 2)
            [%| 'Summary nodes exceed the LCM model input budget; choose a larger LCM model.']
          $(children (scag 2 `(list @ud)`children))
        =/  checkpoint=compaction-plan:h
          :*  through
              0
              (lent items.view)
              (source-hash:context view 0)
              input
              (output-budget:context max-context.branch)
              url.branch
              model.branch
              command
          ==
        [%& checkpoint ~ children]
  =/  selected
    (plan-for:context view(config leaf, summary ~) through command max-context.config.view estimate)
  ?:  ?=(%| -.selected)  selected
  =/  checkpoint  p.selected
  =/  sources  (scag count.checkpoint positions.view)
  ?.  =(count.checkpoint (lent sources))
    [%| 'Compaction source addresses are unavailable; the previous context was retained.']
  [%& checkpoint(source (source-hash:context view count.checkpoint)) sources ~]
::  Reconstruct exactly the selected request, using the frozen sources. The
::  provider codec labels the source as reference material and removes tools.
++  request
  |=  [view=view:h plan=lcm-plan:h config=config:h]
  ^-  view:h
  =/  items
    ?~  children.plan  (scag count.checkpoint.plan items.view)
    `(list item:h)`~[[%user (text:lcm lcm.view children.plan)]]
  %=  view
    config  config
    summary  ~
    items  items
    memory  ~
  ==
++  validate
  |=  [view=view:h plan=lcm-plan:h stop=stop-reason:h item=item:h]
  ^-  (unit @t)
  ?.  =(source.checkpoint.plan (source-hash:context view count.checkpoint.plan))
    `'Compaction source coverage changed; the previous context was retained.'
  ?.  =(sources.plan (scag count.checkpoint.plan positions.view))
    `'Compaction source addresses changed; the previous context was retained.'
  =/  source  (request view plan config.view)
  =/  count  (lent items.source)
  ::  Validate reduction against the selected source only, not unrelated
  ::  summaries that happen to share the conversation's active context.
  =/  selected
    %=  checkpoint.plan
      count  count
      source  (source-hash:context source count)
    ==
  (validate:context source selected stop item)
--

/-  h=harness, c=harness-corpus
/+  *test, cj=harness-corpus-json, corpus=harness-corpus, codec=harness-workspace-json
|%
++  ready
  ^-  state:c
  =/  events=(list event:h)  ~[[%input-admitted [%user 'Searchable original evidence.']]]
  =/  db  (capture:corpus *state:c 'first' events)
  |-  ^-  state:c
      ?~  queued.db  db
      $(db (work:corpus db 32 65.536))
++  test-authority-is-required-for-point-read
  =/  result  (read:cj ready ~ 0v1 1 0)
  (expect !>(?=(%| -.result)))
++  test-authorized-source-is-readable
  =/  result  (read:cj ready (silt ~[0v1]) 0v1 1 0)
  (expect !>(?=(%& -.result)))
++  test-cursor-is-query-and-authority-fenced
  =/  token  (cursor-json:cj 'first' [~2024.1.1 1])
  =/  result  (search:cj ready (silt ~[0v1]) 'evidence' `token 16)
  ;:  weld
      (expect-eq !>(`cursor:c`[~2024.1.1 1]) !>((need (parse-cursor:cj token 'first'))))
      (expect-eq !>(~) !>((parse-cursor:cj token 'changed')))
      (expect !>(?=(%| -.result)))
  ==
++  test-query-and-page-bounds
  =/  large  (search:cj ready ~ 'query' ~ 65)
  =/  empty  (search:cj ready ~ 'query' ~ 0)
  (expect !>(&(?=(%| -.large) ?=(%| -.empty))))
++  test-model-recall-explains-spelling-expansion
  =/  result  (search:cj ready (silt ~[0v1]) 'searhable' ~ 1)
  ?>  ?=(%& -.result)
  =/  hits  (need (get:codec p.result 'hits'))
  ?>  ?=([%a ^] hits)
  ;:  weld
      (expect-eq !>('approximate') !>((string:codec i.p.hits 'matchType')))
      (expect-eq !>(`json`[%a ~[[%s 'searchable']]]) !>((need (get:codec i.p.hits 'matchedTerms'))))
      (expect-eq !>('Searchable original evidence.') !>((string:codec i.p.hits 'snippet')))
  ==
++  test-source-chunks-preserve-utf8
  =/  body  (cat 3 (rap 3 (reap 11.999 'a')) 'é end')
  =/  first  (need (chunk:cj body 0))
  =/  rest  (need (chunk:cj body (need next.first)))
  ;:  weld
      (expect-eq !>(body) !>((cat 3 text.first text.rest)))
      (expect-eq !>(~) !>((chunk:cj body 12.000)))
      (expect-eq !>(~) !>((chunk:cj body 99.999)))
  ==
++  test-optional-models-roundtrip-without-secrets
  =/  cfg  *config:h
  =.  cfg  cfg(key 'secret', system 'private', model 'summary-model')
  =/  models=summary-models:h  [`cfg ~]
  =/  decoded  (json-models:cj (models-json:cj models))
  ?>  ?=(^ compaction.decoded)
  ;:  weld
      (expect-eq !>('') !>(key.u.compaction.decoded))
      (expect-eq !>('summary-model') !>(model.u.compaction.decoded))
      (expect-eq !>(~) !>(lcm.decoded))
      %+  expect-eq
        !>(`summary-models:h`*summary-models:h)
      !>((json-models:cj (models-json:cj *summary-models:h)))
  ==
--

/-  m=harness-memory, h=harness
/+  *test, mem=harness-memory, idx=harness-memory-index
|%
++  value
  |=  body=@t
  ^-  value:m
  [`body ~ | | ['source' 0v1 2 ~2026.10.7 '~zod']]
++  saved
  |=  [db=state:m name=@t base=@ud value=value:m]
  ^-  state:m
  =/  result  (save:mem db name base value)
  ?>  ?=(%& -.result)
  p.result
++  fixture
  %-  saved
  [*state:m 'provisioning-privacy' 0 (value 'Provisioning requires zero data retention.')]
++  test-shared-recall-is-relevant-and-budgeted
  =/  db  fixture
  =.  db  (saved db 'android-builds' 0 (value 'Android builds use Java 17.'))
  =/  names  (choose:mem db 'Check provisioning privacy' '~zod')
  =/  unrelated  (choose:mem db 'Paint an ocean landscape' '~zod')
  =.  turns.db  (my ~[['other-channel' [0v2 ~ '~zod' names]]])
  =/  notes  (selected:mem db 'other-channel' 4.096)
  ;:  weld
      (expect-eq !>(~['provisioning-privacy']) !>(names))
      (expect-eq !>(~) !>(unrelated))
      (expect !>((~(has by notes) 'provisioning-privacy')))
      (expect !>((lte (met 3 (reference:mem notes)) 4.096)))
      (expect-eq !>(~) !>((selected:mem db 'other-channel' 32)))
  ==
++  test-correction-updates-existing-selection-without-retrieval
  =/  db  fixture
  =.  turns.db  (my ~[['child' [0v2 ~ '~zod' ~['provisioning-privacy']]]])
  =/  next  (value 'Provisioning requires an explicit privacy choice.')
  =.  db  (saved db 'provisioning-privacy' 1 next(explicit &))
  =/  notes  (selected:mem db 'child' 4.096)
  =/  record  (~(got by records.db) 'provisioning-privacy')
  ;:  weld
      (expect-eq !>(2) !>(revision.record))
      (expect-eq !>(1) !>((lent history.record)))
      (expect !>((~(has by notes) 'provisioning-privacy')))
      (expect-eq !>(~) !>((choose:mem db 'retention' '~zod')))
      (expect-eq !>(~['provisioning-privacy']) !>((choose:mem db 'choice' '~zod')))
  ==
++  test-concurrent-and-automatic-writes-cannot-overwrite-human-edits
  =/  db  fixture
  =/  next  (value 'Provisioning defaults are confirmed by the owner.')
  =.  db  (saved db 'provisioning-privacy' 1 next(explicit &))
  =/  stale  (save:mem db 'provisioning-privacy' 1 next)
  =/  automatic  (save:mem db 'provisioning-privacy' 2 next)
  (expect !>(&(?=(%| -.stale) ?=(%| -.automatic))))
++  test-forgetting-retains-evidence-and-removes-active-postings
  =/  db  fixture
  =/  forgotten  (forget:mem db 'provisioning-privacy' 1 source:(value ''))
  ?>  ?=(%& -.forgotten)
  =.  db  p.forgotten
  =/  record  (~(got by records.db) 'provisioning-privacy')
  =/  rediscovered  (save:mem db 'provisioning-privacy' 2 (value 'Provisioning requires privacy.'))
  ;:  weld
      (expect-eq !>(~) !>((choose:mem db 'provisioning privacy' '~zod')))
      (expect-eq !>(~) !>(body.value.record))
      (expect-eq !>(1) !>((lent history.record)))
      (expect-eq !>(1) !>(barrier.db))
      (expect !>(?=(%| -.rediscovered)))
  ==
++  test-general-preferences-follow-the-person
  =/  v  (value 'Use concise replies.')
  =/  db  (saved *state:m 'zod-style' 0 v(general &, explicit &))
  ;:  weld
      (expect-eq !>(~['zod-style']) !>((choose:mem db 'An unrelated question' '~zod')))
      (expect-eq !>(~) !>((choose:mem db 'An unrelated question' '~nec')))
  ==
++  test-common-postings-have-a-visit-bound-and-no-junk-filler
  =/  db
    %+  roll  (gulf 0 127)
    |=  [at=@ud db=state:m]
    (saved db (cat 3 'record-' (scot %ud at)) 0 (value 'A common subject appears everywhere.'))
  =/  scan  (candidates:idx index.db 'common subject everywhere')
  ;:  weld
      (expect !>((lte visited.scan max-visits:idx)))
      (expect !>((lte ~(wyt in names.scan) max-visits:idx)))
      (expect-eq !>(~) !>((choose:mem db 'common' '~zod')))
      (expect !>((lte (lent (choose:mem db 'common subject' '~zod')) 6)))
  ==
++  test-selection-is-frozen-until-admission-and-optout-follows-children
  =/  =source:m  ['first' 0v1 1 ~2026.10.7 '~zod']
  =/  saved  (save:mem *state:m 'privacy' 0 [`'Provisioning requires privacy.' ~ | & source])
  ?>  ?=(%& -.saved)
  =/  first=event:h
    [%input-received [0v1 [%poke ~zod] `~zod ~ ~2026.10.7 [%user 'Provisioning']]]
  =/  db  (prepare:mem p.saved 'first' ~[first])
  =/  cached  (~(got by turns.db) 'first')
  =/  child=event:h
    [%input-received [0v2 [%subagent 'first' 'call'] ~ ~ ~2026.10.7 [%user 'Provisioning']]]
  =/  forked  (prepare:mem db 'child' ~[child])
  =/  off  forked(disabled (silt ~['first']))
  ;:  weld
      (expect-eq !>(~['privacy']) !>(names.cached))
      %+  expect-eq
        !>(db)
      !>((prepare:mem db 'first' ~[[%tool-completed 'call' 'read_file' 'Different query'] first]))
      (expect-eq !>('~zod') !>(actor:(~(got by turns.forked) 'child')))
      (expect-eq !>(~['privacy']) !>(names:(~(got by turns.forked) 'child')))
      (expect !>(!(enabled:mem off 'child')))
      (expect-eq !>(~) !>((selected:mem off 'child' 4.096)))
  ==
++  test-record-and-reference-bounds-reject-oversized-input
  =/  bad-name  (save:mem *state:m '../name' 0 (value 'A fact.'))
  =/  bad-body  (save:mem *state:m 'fact' 0 (value (rap 3 (reap 1.025 'x'))))
  =/  empty  (save:mem *state:m 'fact' 0 (value ''))
  =/  v  (value (rap 3 (reap 257 'x')))
  =/  general  (save:mem *state:m 'style' 0 v(general &))
  ;:  weld
      (expect !>(?=(%| -.bad-name)))
      (expect !>(?=(%| -.bad-body)))
      (expect !>(?=(%| -.empty)))
      (expect !>(?=(%| -.general)))
  ==
++  test-older-evidence-cannot-replace-a-newer-source-event
  =/  db  fixture
  =/  v  (value 'An older provisioning assertion.')
  =/  result  (save:mem db 'provisioning-privacy' 1 v(event.source 1))
  (expect !>(?=(%| -.result)))
--

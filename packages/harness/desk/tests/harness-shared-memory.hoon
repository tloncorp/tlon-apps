/-  m=harness-memory, h=harness, hh=harness-hand
/+  *test, mem=harness-memory, idx=harness-memory-index, api=harness-memory-json,
    capture=harness-memory-capture, hd=harness-hand, policy=harness-defaults,
    j=harness-provider-wire
|%
++  value
  |=  body=@t
  ^-  value:m
  [`body ~ | | ['source' 0v1 2 ~2026.10.7 '~zod']]
++  saved
  |=  [db=state:m name=@t base=@ud value=value:m]
  ^-  state:m
  =/  result  (save:mem everything:mem db name base value)
  ?>  ?=(%& -.result)
  p.result
++  fixture
  %-  saved
  [*state:m 'provisioning-privacy' 0 (value 'Provisioning requires zero data retention.')]
++  test-shared-recall-is-relevant-and-budgeted
  =/  db  fixture
  =.  db  (saved db 'android-builds' 0 (value 'Android builds use Java 17.'))
  =/  names  (choose:mem everything:mem db 'Check provisioning privacy' '~zod')
  =/  unrelated  (choose:mem everything:mem db 'Paint an ocean landscape' '~zod')
  =.  turns.db  (my ~[['other-channel' [0v2 ~ '~zod' names]]])
  =/  notes  (selected:mem everything:mem db 'other-channel' 4.096)
  ;:  weld
      (expect-eq !>(~['provisioning-privacy']) !>(names))
      (expect-eq !>(~) !>(unrelated))
      (expect !>((~(has by notes) 'provisioning-privacy')))
      (expect !>((lte (met 3 (reference:mem notes)) 4.096)))
      (expect-eq !>(~) !>((selected:mem everything:mem db 'other-channel' 32)))
  ==
++  test-correction-updates-existing-selection-without-retrieval
  =/  db  fixture
  =.  turns.db  (my ~[['child' [0v2 ~ '~zod' ~['provisioning-privacy']]]])
  =/  next  (value 'Provisioning requires an explicit privacy choice.')
  =.  db  (saved db 'provisioning-privacy' 1 next(explicit &))
  =/  notes  (selected:mem everything:mem db 'child' 4.096)
  =/  record  (~(got by records.db) 'provisioning-privacy')
  ;:  weld
      (expect-eq !>(2) !>(revision.record))
      (expect-eq !>(1) !>((lent history.record)))
      (expect !>((~(has by notes) 'provisioning-privacy')))
      (expect-eq !>(~) !>((choose:mem everything:mem db 'retention' '~zod')))
      (expect-eq !>(~['provisioning-privacy']) !>((choose:mem everything:mem db 'choice' '~zod')))
  ==
++  test-concurrent-and-automatic-writes-cannot-overwrite-human-edits
  =/  db  fixture
  =/  next  (value 'Provisioning defaults are confirmed by the owner.')
  =.  db  (saved db 'provisioning-privacy' 1 next(explicit &))
  =/  stale  (save:mem everything:mem db 'provisioning-privacy' 1 next)
  =/  automatic  (save:mem everything:mem db 'provisioning-privacy' 2 next)
  (expect !>(&(?=(%| -.stale) ?=(%| -.automatic))))
++  test-forgetting-retains-evidence-and-removes-active-postings
  =/  db  fixture
  =/  forgotten  (forget:mem everything:mem db 'provisioning-privacy' 1 source:(value ''))
  ?>  ?=(%& -.forgotten)
  =.  db  p.forgotten
  =/  record  (~(got by records.db) 'provisioning-privacy')
  =/  rediscovered  (save:mem everything:mem db 'provisioning-privacy' 2 (value 'Provisioning requires privacy.'))
  ;:  weld
      (expect-eq !>(~) !>((choose:mem everything:mem db 'provisioning privacy' '~zod')))
      (expect-eq !>(~) !>(body.value.record))
      (expect-eq !>(1) !>((lent history.record)))
      (expect-eq !>(1) !>(barrier.db))
      (expect !>(?=(%| -.rediscovered)))
  ==
::  The owner's preference reaches every speaker; another person's own
::  follows only that person.
::
++  test-general-preferences-follow-the-person
  =/  db  (saved *state:m 'zod-style' 0 (preference '' '~zod' 'Use concise replies.'))
  =.  db  (saved db 'nec-style' 0 (preference 'nec-dm' '~nec' 'Call me Nec.'))
  =/  given  |=([=reach:mem who=@t] (choose:mem (owned reach db `~ten) db 'An unrelated question' who))
  ;:  weld
      (expect-eq !>(~['zod-style']) !>((given channel '~zod')))
      (expect-eq !>(~['zod-style']) !>((given bus '~bus')))
      (expect-eq !>(~['zod-style' 'nec-style']) !>((given nec '~nec')))
      (expect-eq !>(~['zod-style']) !>((given channel '~nec')))
  ==
++  test-common-postings-have-a-visit-bound-and-no-junk-filler
  =/  db
    %+  roll  (gulf 0 127)
    |=  [at=@ud db=state:m]
    (saved db (cat 3 'record-' (scot %ud at)) 0 (value 'A common subject appears everywhere.'))
  =/  scan  (candidates:idx index.db 'common subject everywhere' ~)
  ;:  weld
      (expect !>((lte visited.scan max-visits:idx)))
      (expect !>((lte ~(wyt in names.scan) max-visits:idx)))
      (expect-eq !>(~) !>((choose:mem everything:mem db 'common' '~zod')))
      (expect !>((lte (lent (choose:mem everything:mem db 'common subject' '~zod')) 6)))
  ==
++  test-selection-is-frozen-until-admission-and-optout-follows-children
  =/  =source:m  ['first' 0v1 1 ~2026.10.7 '~zod']
  =/  saved  (save:mem everything:mem *state:m 'privacy' 0 [`'Provisioning requires privacy.' ~ | & source])
  ?>  ?=(%& -.saved)
  =/  first=event:h
    [%input-received [0v1 [%poke ~zod] `~zod ~ ~2026.10.7 [%user 'Provisioning']]]
  =/  db  (prepare:mem everything:mem p.saved 'first' ~[first])
  =/  cached  (~(got by turns.db) 'first')
  =/  child=event:h
    [%input-received [0v2 [%subagent 'first' 'call'] ~ ~ ~2026.10.7 [%user 'Provisioning']]]
  =/  forked  (prepare:mem everything:mem db 'child' ~[child])
  =/  off  forked(disabled (silt ~['first']))
  ;:  weld
      (expect-eq !>(~['privacy']) !>(names.cached))
      %+  expect-eq
        !>(db)
      !>((prepare:mem everything:mem db 'first' ~[[%tool-completed 'call' 'read_file' 'Different query'] first]))
      (expect-eq !>('~zod') !>(actor:(~(got by turns.forked) 'child')))
      (expect-eq !>(~['privacy']) !>(names:(~(got by turns.forked) 'child')))
      (expect !>(!(enabled:mem off 'child')))
      (expect-eq !>(~) !>((selected:mem everything:mem off 'child' 4.096)))
  ==
++  test-record-and-reference-bounds-reject-oversized-input
  =/  bad-name  (save:mem everything:mem *state:m '../name' 0 (value 'A fact.'))
  =/  bad-body  (save:mem everything:mem *state:m 'fact' 0 (value (rap 3 (reap 1.025 'x'))))
  =/  empty  (save:mem everything:mem *state:m 'fact' 0 (value ''))
  =/  v  (value (rap 3 (reap 257 'x')))
  =/  general  (save:mem everything:mem *state:m 'style' 0 v(general &))
  ;:  weld
      (expect !>(?=(%| -.bad-name)))
      (expect !>(?=(%| -.bad-body)))
      (expect !>(?=(%| -.empty)))
      (expect !>(?=(%| -.general)))
  ==
++  test-older-evidence-cannot-replace-a-newer-source-event
  =/  db  fixture
  =/  v  (value 'An older provisioning assertion.')
  =/  result  (save:mem everything:mem db 'provisioning-privacy' 1 v(event.source 1))
  (expect !>(?=(%| -.result)))
::  Where facts were learned: the owner's DM with ~ten, a channel, ~nec's DM
::  and ~bus's DM, all on the Tlon hand.
::
++  bindings
  ^-  (list binding:hh)
  :~  ['tlon' 'dm/~ten' 'owner-dm' ~['~ten'] &]
      ['tlon' 'chat/~zod/general' 'chan' ~['~ten' '~nec' '~bus'] &]
      ['tlon' 'chat/~zod/general/~2026.10.7' 'chan-thread' ~['~nec'] &]
      ['tlon' 'dm/~nec' 'nec-dm' ~['~nec'] &]
      ['tlon' 'dm/~bus' 'bus-dm' ~['~bus'] &]
      ['tlon' 'dm/~ten' 'schedule-x' ~['~ten'] &]
  ==
++  owner  `reach:mem`[& 'owner-dm' (lookup-of bindings) ~ nobody:mem]
++  channel  `reach:mem`[| 'chan' (lookup-of bindings) ~ nobody:mem]
++  nec  `reach:mem`[| 'nec-dm' (lookup-of bindings) ~ nobody:mem]
++  bus  `reach:mem`[| 'bus-dm' (lookup-of bindings) ~ nobody:mem]
++  learned
  |=  [sid=@t body=@t]
  ^-  value:m
  [`body ~ | | [sid 0v1 2 ~2026.10.7 '~ten']]
::  An imported fact, one learned in the owner's DM, one in the channel and
::  one in ~nec's DM; every body shares the word falcon.
::
++  places-fixture
  ^-  state:m
  =/  db  (saved *state:m 'imported' 0 (learned '' 'The falcon fixture was imported.'))
  =.  db  (saved db 'owner-note' 0 (learned 'owner-dm' 'The falcon nests at home.'))
  =.  db  (saved db 'team-note' 0 (learned 'chan' 'The falcon team meets on Monday.'))
  (saved db 'nec-note' 0 (learned 'nec-dm' 'The falcon budget is private to nec.'))
++  names-of
  |=  result=(each [db=state:m result=json] @t)
  ^-  (set @t)
  ?>  ?=(%& -.result)
  ?>  ?=(%a -.result.p.result)
  (silt (turn p.result.p.result |=(row=json (str:j row 'name'))))
++  search
  |=  [=reach:mem db=state:m query=@t]
  %-  names-of
  %:  operate:api
    reach  db  ['chan' 0v1 1 ~2026.10.8 '~nec']
    (pairs:enjs:format ~[['operation' %s 'search'] ['query' %s query]])
  ==
::  A session's bindings, as the head reads them through the ledger index.
::
++  lookup-of
  |=  all=(list binding:hh)
  |=  sid=@t
  ^-  (unit (unit place:mem))
  (places:mem (skim all |=(=binding:hh =(sid sid.binding))))
::  The lookup's three answers, read through the ledger's per-session index:
::  unbound; bound with its place unknown; and a resolved place.
::
++  test-the-lookup-says-unbound-unknown-or-the-place
  =/  ledger
    %+  roll
      ^-  (list [@t binding:hh])
      :~  ['b-chan' ['tlon' 'chat/~zod/general' 'chan' ~['~nec'] &]]
          ['b-thread' ['tlon' 'chat/~zod/general/~2026.10.7' 'chan-thread' ~['~nec'] &]]
          ['b-dm' ['tlon' 'dm/~nec' 'nec-dm' ~['~nec'] &]]
          ['b-dm-thread' ['tlon' 'dm/~nec/~bus/~2026.10.7' 'nec-thread' ~['~nec'] &]]
          ['b-dm-off' ['tlon' 'dm/~nec' 'nec-dm' ~['~nec'] |]]
          ['b-both-1' ['tlon' 'chat/~zod/general' 'both' ~['~nec'] &]]
          ['b-both-2' ['tlon' 'dm/~nec' 'both' ~['~nec'] &]]
          ['b-other' ['fixture' 'room' 'other-hand' ~['alice'] &]]
          ['b-mixed-1' ['fixture' 'room' 'mixed' ~['alice'] &]]
          ['b-mixed-2' ['tlon' 'chat/~zod/general' 'mixed' ~['~nec'] &]]
          ['b-old' ['tlon' 'dm/~nec' 'retired-dm' ~['~nec'] &]]
      ==
    |=  [[id=@t config=binding:hh] db=state:hh]
    =/  bound  (apply:hd db [%bind id config] ~2026.10.7)
    ?>  ?=(%& -.bound)
    db.p.bound
  =/  removed  (apply:hd ledger [%remove 'b-old'] ~2026.10.7)
  ?>  ?=(%& -.removed)
  =/  db  db.p.removed
  =/  lookup
    |=  sid=@t
    %-  places:mem
    (turn (session-bindings:hd [db (reindex:hd db)] sid) |=([@t =binding:hh] binding))
  ;:  weld
      (expect-eq !>(``[%channel 'chat' ~zod 'general']) !>((lookup 'chan')))
      (expect-eq !>(``[%channel 'chat' ~zod 'general']) !>((lookup 'chan-thread')))
      (expect-eq !>(``[%dm ~nec]) !>((lookup 'nec-dm')))
      (expect-eq !>(``[%dm ~nec]) !>((lookup 'nec-thread')))
      (expect-eq !>(~) !>((lookup 'local')))
      (expect-eq !>(~) !>((lookup 'retired-dm')))
      (expect-eq !>(`~) !>((lookup 'both')))
      (expect-eq !>(`~) !>((lookup 'other-hand')))
      (expect-eq !>(`~) !>((lookup 'mixed')))
      (expect-eq !>(~) !>((where:mem [| '' lookup ~ nobody:mem] '')))
  ==
++  test-a-conversation-sees-private-facts-only-when-it-is-the-owners
  =/  db  places-fixture
  =/  sees
    |=  =reach:mem
    %-  silt
    %+  skim  `(list @t)`~['imported' 'owner-note' 'team-note' 'nec-note']
    |=(name=@t (seen:mem reach db name))
  ;:  weld
      (expect-eq !>((silt ~['imported' 'owner-note' 'team-note' 'nec-note'])) !>((sees owner)))
      (expect-eq !>((silt ~['team-note'])) !>((sees channel)))
      (expect-eq !>((silt ~['team-note' 'nec-note'])) !>((sees nec)))
      (expect-eq !>((silt ~['team-note'])) !>((sees bus)))
  ==
++  test-recall-chooses-only-facts-the-conversation-sees
  =/  db  places-fixture
  =/  chosen  |=(=reach:mem (silt (choose:mem reach db 'falcon' '~nec')))
  ;:  weld
      (expect-eq !>((silt ~['imported' 'owner-note' 'team-note' 'nec-note'])) !>((chosen owner)))
      (expect-eq !>((silt ~['team-note'])) !>((chosen channel)))
      (expect-eq !>((silt ~['team-note' 'nec-note'])) !>((chosen nec)))
      (expect-eq !>((silt ~['team-note'])) !>((chosen bus)))
  ==
++  test-unseen-general-preferences-are-not-recalled
  =/  v  (learned 'owner-dm' 'Call the owner by first name.')
  =/  db  (saved places-fixture 'owner-style' 0 v(general &, explicit &))
  ;:  weld
      (expect-eq !>(~['owner-style']) !>((choose:mem owner db 'An unrelated question' '~ten')))
      (expect-eq !>(~) !>((choose:mem channel db 'An unrelated question' '~ten')))
  ==
++  test-rendering-checks-a-chosen-fact-again
  =/  db  places-fixture
  =/  all=(list @t)  ~['imported' 'owner-note' 'team-note' 'nec-note']
  ;:  weld
      (expect-eq !>((silt ~['team-note'])) !>(~(key by (pack:mem channel db all 4.096))))
      (expect-eq !>((silt ~['team-note' 'nec-note'])) !>(~(key by (pack:mem nec db all 4.096))))
      (expect-eq !>((silt all)) !>(~(key by (pack:mem owner db all 4.096))))
  ==
++  test-a-selection-made-while-visible-is-not-rendered-after-it-turns-private
  =/  db  places-fixture
  =.  turns.db  (my ~[['chan' [0v2 ~ '~nec' ~['team-note']]]])
  =/  before  (selected:mem channel db 'chan' 4.096)
  =/  v  (learned 'owner-dm' 'The falcon team meets on Tuesday.')
  =.  db  (saved db 'team-note' 3 v(explicit &))
  ;:  weld
      (expect !>((~(has by before) 'team-note')))
      (expect-eq !>(~) !>((selected:mem channel db 'chan' 4.096)))
  ==
++  test-memory-search-sample-and-exact-name-answer-only-what-is-seen
  =/  db  places-fixture
  ;:  weld
      (expect-eq !>((silt ~['team-note'])) !>((search channel db '')))
      (expect-eq !>((silt ~['team-note' 'nec-note'])) !>((search nec db '')))
      (expect-eq !>((silt ~['team-note'])) !>((search channel db 'falcon')))
      (expect-eq !>((silt ~['team-note'])) !>((search bus db 'falcon')))
      (expect-eq !>(~) !>((search channel db 'owner-note')))
      (expect-eq !>(~) !>((search bus db 'nec-note')))
      (expect-eq !>((silt ~['nec-note'])) !>((search nec db 'nec-note')))
      (expect-eq !>((silt ~['owner-note'])) !>((search owner db 'owner-note')))
  ==
++  test-reading-an-unseen-fact-answers-as-if-it-did-not-exist
  =/  db  places-fixture
  =/  read
    |=  [=reach:mem name=@t]
    %:  operate:api
      reach  db  ['chan' 0v1 1 ~2026.10.8 '~nec']
      (pairs:enjs:format ~[['operation' %s 'read'] ['name' %s name]])
    ==
  =/  absent  (read owner 'never-saved')
  ;:  weld
      (expect-eq !>([%| 'No memory has that name.']) !>(absent))
      (expect-eq !>(absent) !>((read channel 'owner-note')))
      (expect-eq !>(absent) !>((read bus 'nec-note')))
      (expect !>(=(%& -:(read nec 'nec-note'))))
      (expect !>(=(%& -:(read bus 'team-note'))))
  ==
::  A live fact, an explicit note and a tombstone, all learned in the
::  owner's DM.
::
++  test-unseen-names-refuse-every-write-the-same-way
  =/  db  places-fixture
  =/  v  (learned 'owner-dm' 'The falcon codeword is secret.')
  =.  db  (saved db 'explicit-note' 0 v(explicit &))
  =/  forgotten  (forget:mem owner db 'owner-note' 2 source:(learned 'owner-dm' ''))
  ?>  ?=(%& -.forgotten)
  =.  db  p.forgotten
  =/  write  (learned 'chan' 'Replaced from the channel.')
  =/  refused  [%| unavailable:mem]
  =/  attempts=(list (each state:m @t))
    :~  (save:mem channel db 'imported' 1 write)
        (save:mem channel db 'imported' 0 write)
        (save:mem channel db 'imported' 7 write)
        (save:mem channel db 'imported' 1 write(explicit &))
        (save:mem channel db 'explicit-note' 5 write(explicit &))
        (save:mem channel db 'explicit-note' 0 write)
        (save:mem channel db 'owner-note' 6 write(explicit &))
        (save:mem channel db 'owner-note' 2 write(explicit &))
        (forget:mem channel db 'imported' 1 source.write)
        (forget:mem channel db 'explicit-note' 5 source.write)
        (forget:mem bus db 'nec-note' 4 source.write)
        (save:mem bus db 'nec-note' 4 write(explicit &))
    ==
  ;:  weld
      (expect !>((levy attempts |=(a=(each state:m @t) =(a refused)))))
      (expect !>(=(%& -:(save:mem nec db 'nec-note' 4 write(explicit &)))))
      (expect !>(=(%& -:(save:mem owner db 'imported' 1 write(explicit &)))))
  ==
++  test-a-schedule-to-the-owners-dm-sees-that-dm-and-not-imports
  =/  db  places-fixture
  =/  schedule  `reach:mem`[| 'schedule-x' (lookup-of bindings) ~ nobody:mem]
  ;:  weld
      (expect !>((seen:mem schedule db 'owner-note')))
      (expect !>(!(seen:mem schedule db 'imported')))
      (expect !>(!(seen:mem schedule db 'nec-note')))
  ==
::  The head gives a subagent its root parent's conversation as .here.
::
++  test-a-subagent-of-a-dm-sees-that-dms-facts
  =/  db  places-fixture
  =/  subagent  `reach:mem`[| 'nec-dm' (lookup-of bindings) ~ nobody:mem]
  ;:  weld
      (expect !>((seen:mem subagent db 'nec-note')))
      (expect !>(!(seen:mem subagent db 'owner-note')))
  ==
++  related-of
  |=  data=@t
  ^-  (set @t)
  =/  parsed  (need (de:json:html data))
  =/  related  (need (get:j parsed 'related'))
  ?>  ?=(%a -.related)
  (silt (turn p.related |=(row=json (str:j row 'name'))))
++  test-capture-is-given-only-related-facts-it-sees
  =/  db  places-fixture
  =/  =job:m  *job:m
  =.  job  job(sid 'chan', evidence ~[[['chan' 0v1 1 ~2026.10.8 '~nec'] 'user' 'falcon plans']])
  =/  chan-plan  (plan:capture channel db 1 job builtin-config:policy ~2026.10.8)
  =/  wide  (plan:capture everything:mem db 1 job builtin-config:policy ~2026.10.8)
  ;:  weld
      (expect-eq !>((silt ~['team-note'])) !>(~(key by bases.chan-plan)))
      (expect-eq !>(4) !>(~(wyt by bases.wide)))
      (expect-eq !>((silt ~['team-note'])) !>((related-of (request-data:capture channel db wide))))
      %+  expect-eq  !>((silt ~['team-note' 'nec-note']))
      !>((related-of (request-data:capture nec db wide)))
  ==
::  .count private facts learned in the owner's DM, newer than one channel
::  fact; every heading starts with falcon.
::
++  crowded
  |=  count=@ud
  ^-  state:m
  =/  db  (saved *state:m 'team-falcon' 0 (learned 'chan' 'Falcon: the team meets on Monday.'))
  %+  roll  (gulf 1 count)
  |=  [n=@ud db=_db]
  =/  name  (cat 3 'private-' (crip (a-co:co n)))
  (saved db name 0 (learned 'owner-dm' (rap 3 'Falcon: private entry ' (crip (a-co:co n)) ~)))
++  test-unseen-rows-do-not-crowd-a-seen-fact-out-of-recall
  =/  db  (crowded 300)
  ;:  weld
      (expect-eq !>(~['team-falcon']) !>((choose:mem channel db 'falcon' '~nec')))
      (expect-eq !>((silt ~['team-falcon'])) !>((search channel db 'falcon')))
      (expect-eq !>((silt ~['team-falcon'])) !>((search channel db '')))
  ==
++  test-a-filtered-recall-walk-examines-at-most-512-rows
  =/  db  (crowded 5.000)
  =/  scan  (candidates:idx index.db 'falcon' (filter:mem channel db))
  =/  sample  (search channel db '')
  ;:  weld
      (expect-eq !>(max-walk:idx) !>(visited.scan))
      (expect-eq !>(~) !>(names.scan))
      (expect-eq !>(~) !>(sample))
  ==
::  The owner is ~ten and the bot ~zod; ~doznec-sampel-palnet stands for a
::  sibling-moon owner, whose preferences are not looked up. 'local' is an unbound session with
::  only local history; 'fork' is an unbound fork of a channel session, and
::  'other-hand' is bound on a hand other than Tlon.
::
++  owned
  |=  [=reach:mem db=state:m owner=(unit @p)]
  ^-  reach:mem
  =/  extra=(list binding:hh)
    :~  ['fixture' 'room' 'other-hand' ~['~ten'] &]
        ['tlon' 'dm/~doznec-sampel-palnet' 'sibling-dm' ~['~doznec-sampel-palnet'] &]
    ==
  =/  all  (weld bindings extra)
  =/  owns
    |=  =source:m
    %:  owner-source:mem
      (lookup-of all)  |=(sid=@t =('local' sid))  owner  ~zod  source
    ==
  reach(owner (preferred:mem db owns owner ~zod), owns owns)
++  preference
  |=  [sid=@t actor=@t body=@t]
  ^-  value:m
  [`body ~ & & [sid 0v1 2 ~2026.10.7 actor]]
++  test-the-owners-preferences-from-each-source-reach-every-conversation
  =/  sources=(list [sid=@t actor=@t])
    ~[['' '~zod'] ['owner-dm' '~ten'] ['local' '~zod']]
  =/  subagent  `reach:mem`[| 'nec-dm' (lookup-of bindings) ~ nobody:mem]
  =/  schedule  `reach:mem`[| 'schedule-x' (lookup-of bindings) ~ nobody:mem]
  %-  zing
  %+  turn  sources
  |=  [sid=@t actor=@t]
  =/  db  (saved *state:m 'style' 0 (preference sid actor 'Answer in one paragraph.'))
  =.  db  (saved db 'private-fact' 0 (learned sid 'The quarterly figure is private.'))
  =/  given
    |=  [=reach:mem who=@t]
    ^-  ?
    =/  names  (choose:mem (owned reach db `~ten) db 'quarterly figure' who)
    =(`'style' ?~(names ~ `i.names))
  ;:  weld
      (expect !>((given channel '~nec')))
      (expect !>((given bus '~bus')))
      (expect !>((given schedule '~ten')))
      (expect !>((given subagent '~nec')))
      (expect !>(!(seen:mem (owned channel db `~ten) db 'private-fact')))
      %+  expect-eq  !>(~['style'])
      !>((choose:mem (owned channel db `~ten) db 'quarterly figure' '~nec'))
  ==
++  test-preferences-from-other-sources-are-not-the-owners
  =/  cases=(list [sid=@t actor=@t])
    :~  ['fork' '~zod']
        ['other-hand' '~ten']
        ['nec-dm' '~nec']
        ['bus-dm' '~bus']
        ['owner-dm' '~nec']
        ['sibling-dm' '~doznec-sampel-palnet']
    ==
  %-  zing
  %+  turn  cases
  |=  [sid=@t actor=@t]
  =/  db  (saved *state:m 'style' 0 (preference sid actor 'Answer in one paragraph.'))
  (expect-eq !>(~) !>(owner:(owned channel db `~ten)))
++  test-the-two-newest-owner-preferences-come-first-across-sources
  =/  db  (saved *state:m 'dm-1' 0 (preference 'owner-dm' '~ten' 'First from the DM.'))
  =.  db  (saved db 'acp-1' 0 (preference '' '~zod' 'First from the editor.'))
  =.  db  (saved db 'dm-2' 0 (preference 'owner-dm' '~ten' 'Second from the DM.'))
  =.  db  (saved db 'acp-2' 0 (preference '' '~zod' 'Second from the editor.'))
  =/  same  (owned channel db `~zod)
  =/  one  (saved *state:m 'dm-1' 0 (preference 'owner-dm' '~ten' 'First from the DM.'))
  =.  one  (saved one 'nec-old' 0 (preference 'chan' '~nec' 'Older own preference.'))
  =.  one  (saved one 'nec-new' 0 (preference 'chan' '~nec' 'Newer own preference.'))
  ;:  weld
      (expect-eq !>(~['acp-2' 'dm-2' 'acp-1' 'dm-1']) !>(owner:(owned channel db `~ten)))
      %+  expect-eq  !>(~['acp-2' 'dm-2'])
      !>((scag 2 (choose:mem (owned channel db `~ten) db 'unrelated' '~nec')))
      (expect-eq !>(~['acp-2' 'acp-1']) !>(owner.same))
      %+  expect-eq  !>(~['dm-1' 'nec-new'])
      !>((choose:mem (owned channel one `~ten) one 'unrelated' '~nec'))
  ==
++  test-the-owners-preference-gives-no-other-access
  =/  db  (saved places-fixture 'owner-style' 0 (preference 'owner-dm' '~ten' 'Be brief.'))
  =/  given  (owned channel db `~ten)
  =/  write  (learned 'chan' 'Be verbose.')
  =/  read
    %:  operate:api
      given  db  ['chan' 0v1 1 ~2026.10.8 '~nec']
      (pairs:enjs:format ~[['operation' %s 'read'] ['name' %s 'owner-style']])
    ==
  ;:  weld
      (expect-eq !>(~['owner-style']) !>(owner.given))
      (expect-eq !>(~) !>((search given db 'owner-style')))
      (expect-eq !>(~) !>((search given db 'brief')))
      (expect !>(!(~(has in (search given db '')) 'owner-style')))
      (expect-eq !>([%| 'No memory has that name.']) !>(read))
      (expect-eq !>([%| unavailable:mem]) !>((save:mem given db 'owner-style' 5 write(explicit &))))
      (expect-eq !>([%| unavailable:mem]) !>((forget:mem given db 'owner-style' 5 source.write)))
  ==
++  test-an-owners-preference-given-by-priority-has-no-source-line
  =/  db  (saved *state:m 'dm-style' 0 (preference 'owner-dm' '~ten' 'Be brief.'))
  =.  db  (saved db 'chan-style' 0 (preference 'chan' '~ten' 'Be kind.'))
  =/  given  (owned channel db `~ten)
  =/  notes  (pack:mem given db ~[':dm-style' ':chan-style'] 4.096)
  ;:  weld
      (expect-eq !>(`'Be brief.') !>((~(get by notes) 'dm-style')))
      %+  expect-eq  !>(`'Be kind. [source: ~ten; chan#2]')
      !>((~(get by notes) 'chan-style'))
  ==
++  test-a-preference-that-stops-qualifying-after-admission-is-not-rendered
  =/  db  (saved *state:m 'dm-style' 0 (preference 'owner-dm' '~ten' 'Be brief.'))
  =.  db  (saved db 'nec-style' 0 (preference 'nec-dm' '~nec' 'Be formal.'))
  =.  turns.db  (my ~[['chan' [0v2 ~ '~bus' (picks:mem (owned channel db `~ten) db 'x' '~bus')]]])
  =/  rendered
    |=  [db=state:m owner=(unit @p)]
    ~(key by (selected:mem (owned channel db owner) db 'chan' 4.096))
  =/  forgotten  (forget:mem everything:mem db 'dm-style' 1 source:(learned '' ''))
  ?>  ?=(%& -.forgotten)
  =/  plain-value  (learned 'owner-dm' 'Be brief.')
  =/  plain  (saved db 'dm-style' 1 plain-value(explicit &))
  =/  dropped-value  (learned 'nec-dm' 'Be formal.')
  =/  dropped  (saved db 'nec-style' 2 dropped-value(explicit &))
  ;:  weld
      (expect-eq !>(~[':dm-style']) !>(names:(~(got by turns.db) 'chan')))
      (expect-eq !>((silt ~['dm-style'])) !>((rendered db `~ten)))
      (expect-eq !>(~) !>((rendered p.forgotten `~ten)))
      (expect-eq !>(~) !>((rendered plain `~ten)))
      (expect-eq !>(~) !>((rendered db `~nec)))
      (expect-eq !>(~['nec-style']) !>(owner:(owned channel db `~nec)))
      (expect-eq !>(~['nec-style']) !>((choose:mem (owned channel db `~nec) db 'x' '~bus')))
      (expect-eq !>(~) !>(owner:(owned channel dropped `~nec)))
  ==
++  test-capture-is-not-given-the-owners-preference-by-priority
  =/  db  (saved places-fixture 'owner-style' 0 (preference 'owner-dm' '~ten' 'Falcon replies stay brief.'))
  =/  =job:m  *job:m
  =.  job  job(sid 'chan', evidence ~[[['chan' 0v1 1 ~2026.10.8 '~nec'] 'user' 'falcon plans']])
  =/  given  (owned channel db `~ten)
  =/  chan-plan  (plan:capture given db 1 job builtin-config:policy ~2026.10.8)
  ;:  weld
      (expect-eq !>(~['owner-style']) !>(owner.given))
      (expect-eq !>((silt ~['team-note'])) !>(~(key by bases.chan-plan)))
  ==
::  A channel turn admits two owner preferences and an ordinary channel
::  fact. The owner then saves that fact from their DM as a general
::  preference: it is not rendered, as the exception covers only the names
::  admitted to the preference slots.
::
++  test-an-ordinary-fact-that-turns-private-mid-turn-is-not-rendered-as-a-preference
  =/  db  (saved *state:m 'acp-1' 0 (preference '' '~zod' 'Answer briefly.'))
  =.  db  (saved db 'acp-2' 0 (preference '' '~zod' 'Answer kindly.'))
  =.  db  (saved db 'team-note' 0 (learned 'chan' 'The falcon team meets on Monday.'))
  =/  admitted  (picks:mem (owned channel db `~ten) db 'falcon' '~nec')
  =.  turns.db  (my ~[['chan' [0v2 ~ '~nec' admitted]]])
  =/  before  ~(key by (selected:mem (owned channel db `~ten) db 'chan' 4.096))
  =.  db  (saved db 'team-note' 3 (preference 'owner-dm' '~ten' 'The falcon budget is secret.'))
  =/  given  (owned channel db `~ten)
  =/  after  ~(key by (selected:mem given db 'chan' 4.096))
  ;:  weld
      (expect-eq !>(~[':acp-2' ':acp-1' 'team-note']) !>(admitted))
      (expect-eq !>((silt ~['acp-1' 'acp-2' 'team-note'])) !>(before))
      (expect !>((lien owner.given |=(n=@t =('team-note' n)))))
      (expect-eq !>((silt ~['acp-1' 'acp-2'])) !>(after))
  ==
--


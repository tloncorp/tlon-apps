/-  m=harness-memory
/+  *test, mem=harness-memory, browser=harness-memory-browser, j=harness-provider-wire
|%
++  source
  ^-  source:m
  ['first' 0v1 7 ~2026.10.7 '~zod']
++  seed
  |=  count=@ud
  ^-  state:m
  =/  db  *state:m
  |-  ^-  state:m
      ?:  =(0 count)  db
      =/  name  (cat 3 'fact-' (decimal:browser count))
      =/  text
        ?:  =(1 (mod count 2))  'Project notes stay concise.'
        'Project plans use milestones.'
      =/  saved  (save:mem db name 0 [`text (silt ~['brief']) | | source])
      ?>  ?=(%& -.saved)
      $(db p.saved, count (dec count))
++  list
  |=  [db=state:m query=@t cursor=@t]
  =/  args  (pairs:enjs:format ~[['query' %s query] ['cursor' %s cursor]])
  =/  result  (operate:browser db source 'list' args)
  ?>  ?=(%& -.result)
  result.p.result
++  items
  |=  page=json
  =/  value  (need (get:j page 'items'))
  ?>  ?=(%a -.value)
  p.value
++  test-pagination-is-complete-and-newest-first
  =/  db  (seed 60)
  =/  first  (list db '' '')
  =/  second  (list db '' (str:j first 'nextCursor'))
  =/  third  (list db '' (str:j second 'nextCursor'))
  =/  names
    (turn (weld (items first) (weld (items second) (items third))) |=(r=json (str:j r 'name')))
  ;:  weld
      (expect-eq !>(25) !>((lent (items first))))
      (expect-eq !>(25) !>((lent (items second))))
      (expect-eq !>(10) !>((lent (items third))))
      (expect-eq !>(60) !>(~(wyt in (silt names))))
      (expect-eq !>('fact-1') !>((snag 0 names)))
      (expect-eq !>(`json`~) !>((need (get:j third 'nextCursor'))))
  ==
++  test-search-requires-all-keywords-and-excludes-forgotten-records
  =/  db  (seed 60)
  =/  forgotten  (forget:mem db 'fact-1' 60 source)
  ?>  ?=(%& -.forgotten)
  =/  result  (list p.forgotten 'concise project' '')
  =/  next  (list p.forgotten 'concise project' (str:j result 'nextCursor'))
  ;:  weld
      (expect-eq !>(29) !>((add (lent (items result)) (lent (items next)))))
      (expect-eq !>(~) !>((items (list db 'project absent' ''))))
      (expect-eq !>(~) !>((items (list db 'the' ''))))
      (expect-eq !>(`json`[%n '59']) !>((need (get:j result 'total'))))
  ==
++  test-manual-edits-retain-sources-aliases-and-reject-stale-revisions
  =/  db  (seed 1)
  =/  args
    (pairs:enjs:format ~[['name' %s 'fact-1'] ['revision' %s '1'] ['text' %s 'Keep notes clear.']])
  =/  owner=source:m  ['' 0v0 0 ~2026.10.7 '~zod']
  =/  saved  (operate:browser db owner 'save' args)
  ?>  ?=(%& -.saved)
  =/  after  (~(got by records.db.p.saved) 'fact-1')
  ?>  ?=(^ history.after)
  =/  stale  (operate:browser db.p.saved owner 'save' args)
  =/  forgotten
    %:  operate:browser
      db.p.saved  owner  'forget'
      (pairs:enjs:format ~[['name' %s 'fact-1'] ['revision' %s '2']])
    ==
  ?>  ?=(%& -.forgotten)
  ;:  weld
      (expect !>(explicit.value.after))
      (expect !>((~(has in aliases.value.after) 'brief')))
      (expect-eq !>('first') !>(sid.source.value.i.history.after))
      (expect !>(?=(%| -.stale)))
      (expect-eq !>(~) !>((items (list db.p.forgotten '' ''))))
      (expect-eq !>(1) !>(barrier.db.p.forgotten))
      (expect-eq !>(~) !>((revision:browser [%o ~])))
  ==
++  test-list-does-not-change-state
  =/  db  (seed 60)
  =/  result  (operate:browser db source 'list' [%o ~])
  ?>  ?=(%& -.result)
  (expect-eq !>(db) !>(db.p.result))
++  test-prefixes-use-full-query-and-remove-superseded-postings
  =/  saved
    (save:mem *state:m 'work-kit' 0 [`'A portable workshop kit.' (silt ~['travel']) | | source])
  ?>  ?=(%& -.saved)
  =/  db  p.saved
  =/  corrected  (save:mem db 'work-kit' 1 [`'A stationary workshop kit.' ~ | & source])
  ?>  ?=(%& -.corrected)
  =/  forgotten  (forget:mem p.corrected 'work-kit' 2 source)
  ?>  ?=(%& -.forgotten)
  ;:  weld
      (expect-eq !>(1) !>((lent (items (list db 'po' '')))))
      (expect-eq !>(1) !>((lent (items (list db 'PORT work' '')))))
      (expect-eq !>(1) !>((lent (items (list db 'portabl trav' '')))))
      (expect-eq !>(~) !>((items (list db 'portrait' ''))))
      (expect-eq !>(~) !>((items (list db 'ort' ''))))
      (expect-eq !>(~) !>((items (list db 'port absent' ''))))
      (expect-eq !>(~) !>((items (list p.corrected 'port' ''))))
      (expect-eq !>(1) !>((lent (items (list p.corrected 'station' '')))))
      (expect-eq !>(~) !>((items (list p.forgotten 'station' ''))))
  ==
++  test-sparse-search-resumes-after-an-empty-bounded-page
  =/  db  *state:m
  =/  common  (save:mem db 'shared' 0 [`'Alpha beta project.' ~ | | source])
  ?>  ?=(%& -.common)
  =.  db  p.common
  =/  count=@ud  400
  =.  db
    |-  ^-  state:m
        ?:  =(0 count)  db
        =/  name  (cat 3 'sparse-' (decimal:browser count))
        =/  text
          ?:  =(0 (mod count 2))  'Alpha project.'
          'Beta project.'
        =/  saved  (save:mem db name 0 [`text ~ | | source])
        ?>  ?=(%& -.saved)
        $(db p.saved, count (dec count))
  =/  first  (list db 'alpha beta' '')
  =/  second  (list db 'alpha beta' (str:j first 'nextCursor'))
  ;:  weld
      (expect-eq !>(~) !>((items first)))
      (expect !>(!=('' (str:j first 'nextCursor'))))
      (expect-eq !>(1) !>((lent (items second))))
      (expect-eq !>('shared') !>((str:j (snag 0 (items second)) 'name')))
      (expect-eq !>(`json`~) !>((need (get:j second 'nextCursor'))))
  ==
++  test-revisions-stay-exact-above-javascript-integer-range
  =/  db  *state:m
  =.  revision.db  9.007.199.254.740.992
  =/  saved  (save:mem db 'precise' 0 [`'Keep this revision exact.' ~ | | source])
  ?>  ?=(%& -.saved)
  =/  page  (list p.saved '' '')
  =/  rev  (str:j (snag 0 (items page)) 'revision')
  ;:  weld
      (expect-eq !>('9007199254740993') !>(rev))
      %+  expect-eq
        !>(`9.007.199.254.740.993)
      !>((revision:browser (pairs:enjs:format ~[['revision' %s rev]])))
  ==
--

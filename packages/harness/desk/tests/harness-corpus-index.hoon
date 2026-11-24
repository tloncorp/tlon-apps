/-  gs=harness-corpus
/+  sidx=harness-corpus-index, *test
|%
++  ref
  |=  [scope=scope:gs at=@ud part=(unit @ud)]
  ^-  ref:gs
  [scope at part]
::
++  test-tokenization
  %+  expect-eq
    !>(`(set @t)`(sy ~['hello' 'world' '~zod' 'fuzzy-search']))
  !>((tokenize:sidx ~['Hello, WORLD!' '~zod fuzzy-search']))
::
++  test-searches-newest-first-and-pages
  =/  one=ref:gs  (ref 0v1 1 ~)
  =/  two=ref:gs  (ref 0v3 2 ~)
  =/  three=ref:gs  (ref 0v2 3 ~)
  =/  idx=index:sidx  *index:sidx
  =.  idx  (put-document:sidx idx one ~2024.1.1 '~zod' ~['hello old world'])
  =.  idx  (put-document:sidx idx two ~2024.1.2 '~nec' ~['hello other'])
  =.  idx  (put-document:sidx idx three ~2024.1.3 '~nec' ~['hello new world'])
  =/  seg=segment:sidx  (need (~(get by segments.idx) 0))
  =/  world=posting:sidx  (need (~(get by postings.seg) 'world'))
  =/  page-one=page:gs  (search:sidx idx 'hello world' ~ 1)
  =/  page-two=page:gs  (search:sidx idx 'hello world' next.page-one 1)
  ;:  weld
      %+  expect-eq  !>(`@ud`2)
      !>((wyt:on-posting:sidx world))
    ::
      %+  expect-eq  !>(`@ud`2)
      !>((lent hits:(search:sidx idx 'hello world' ~ 10)))
    ::
      %+  expect-eq  !>(`(unit cursor:gs)`(some [~2024.1.3 3]))
      !>(next.page-one)
    ::
      %+  expect-eq  !>(`(list ref:gs)`~[three])
      !>((turn hits.page-one |=(=hit:gs ref.hit)))
    ::
      %+  expect-eq  !>(`(list ref:gs)`~[one])
      !>((turn hits.page-two |=(=hit:gs ref.hit)))
    ::
      %+  expect-eq  !>(`?`&)
      !>(complete.page-two)
  ==
::
++  test-searches-across-segments
  =/  old=ref:gs  (ref 0v1 1 ~)
  =/  new=ref:gs  (ref 0v2 2 ~)
  =/  idx=index:sidx  *index:sidx
  =.  idx  (put-document:sidx idx old ~2024.1.1 '~zod' ~['segment term'])
  ::  Force the next insertion into another segment without constructing
  ::  thousands of irrelevant fixtures.
  =.  idx  idx(count segment-size:sidx)
  =.  idx  (put-document:sidx idx new ~2024.1.2 '~nec' ~['segment term'])
  =/  term-segments=(set @ud)
    (need (~(get by directory.idx) 'segment'))
  ;:  weld
      %+  expect-eq  !>(`@ud`2)
      !>(~(wyt by segments.idx))
    ::
      %+  expect-eq  !>(`@ud`2)
      !>(~(wyt in term-segments))
    ::
      %+  expect-eq  !>(`(list ref:gs)`~[new old])
      !>((turn hits:(search:sidx idx 'segment term' ~ 10) |=(=hit:gs ref.hit)))
  ==
::
++  test-empty-and-missing-terms
  =/  idx=index:sidx  *index:sidx
  ;:  weld
      %+  expect-eq  !>(`(list hit:gs)`~)
      !>(hits:(search:sidx idx '' ~ 20))
    ::
      %+  expect-eq  !>(`(list hit:gs)`~)
      !>(hits:(search:sidx idx 'absent' ~ 20))
  ==
::
++  test-bounded-prefix-and-fuzzy-search
  =/  target=ref:gs  (ref 0v1 1 ~)
  =/  idx=index:sidx  *index:sidx
  =.  idx
    (put-document:sidx idx target ~2024.1.1 '~zod' ~['hello searchable world'])
  ;:  weld
      %+  expect-eq  !>(`(list ref:gs)`~[target])
      !>((turn hits:(search:sidx idx 'hell' ~ 10) |=(=hit:gs ref.hit)))
    ::
      %+  expect-eq  !>(`(list ref:gs)`~[target])
      !>((turn hits:(search:sidx idx 'hellp' ~ 10) |=(=hit:gs ref.hit)))
    ::
      %+  expect-eq  !>(`(list ref:gs)`~[target])
      !>((turn hits:(search:sidx idx 'searhable world' ~ 10) |=(=hit:gs ref.hit)))
  ==
::
++  test-snippets-are-bounded
  =/  long=@t  (cat 3 'needle ' (rap 3 (reap 600 'a')))
  %+  expect-eq  !>(`@ud`515)
  !>((met 3 (make-snippet:sidx ~[long])))
::
++  test-replaces-and-deletes-live-documents
  =/  target=ref:gs  (ref 0v1 1 ~)
  =/  reply=ref:gs  (ref 0v1 1 `2)
  =/  idx=index:sidx  *index:sidx
  =.  idx  (put-document:sidx idx target ~2024.1.1 '~zod' ~['old phrase'])
  =.  idx  (put-document:sidx idx reply ~2024.1.2 '~nec' ~['reply phrase'])
  =.  idx  (put-document:sidx idx target ~2024.1.1 '~zod' ~['new phrase'])
  =/  old=(list hit:gs)  hits:(search:sidx idx 'old' ~ 10)
  =/  new=(list hit:gs)  hits:(search:sidx idx 'new' ~ 10)
  =/  idx=index:sidx  (remove-thread:sidx idx [0v1 1])
  ;:  weld
      %+  expect-eq  !>(`(list hit:gs)`~)
      !>(old)
    ::
      %+  expect-eq  !>(`(list ref:gs)`~[target])
      !>((turn new |=(=hit:gs ref.hit)))
    ::
      %+  expect-eq  !>(`@ud`0)
      !>(live-count.idx)
    ::
      %+  expect-eq  !>(`(list hit:gs)`~)
      !>(hits:(search:sidx idx 'reply' ~ 10))
  ==
++  test-and-search-requires-every-term
  =/  idx=index:sidx  *index:sidx
  =.  idx  (put-document:sidx idx [0v1 1 ~] ~2024.1.1 '' ~['alpha'])
  =.  idx  (put-document:sidx idx [0v1 2 ~] ~2024.1.2 '' ~['beta'])
  =.  idx  (put-document:sidx idx [0v1 3 ~] ~2024.1.3 '' ~['alpha beta'])
  %+  expect-eq  !>(`(list ref:gs)`~[[0v1 3 ~]])
  !>((turn hits:(search:sidx idx 'alpha beta' ~ 10) |=(=hit:gs ref.hit)))
++  test-scope-is-checked-before-taking-the-page
  =/  idx=index:sidx  *index:sidx
  =.  idx  (put-document:sidx idx [0v1 1 ~] ~2024.1.1 '' ~['shared phrase'])
  =.  idx  (put-document:sidx idx [0v2 1 ~] ~2024.1.2 '' ~['shared phrase'])
  =/  page  (search-scoped:sidx idx 'shared' ~ 1 `(silt ~[0v1]))
  %+  expect-eq  !>(`(list ref:gs)`~[[0v1 1 ~]])
  !>((turn hits.page |=(=hit:gs ref.hit)))
++  test-literal-utf8-and-ascii-folding
  =/  idx  (put-document:sidx *index:sidx [0v1 1 ~] ~2024.1.1 '' ~['Résumé CAFÉ 東京'])
  (expect-eq !>(1) !>((lent hits:(search:sidx idx 'résumé 東京' ~ 10))))
++  test-zero-and-empty-scope-return-no-results
  =/  idx  (put-document:sidx *index:sidx [0v1 1 ~] ~2024.1.1 '' ~['needle'])
  %-  expect
  !>  ?&  =(~ hits:(search:sidx idx 'needle' ~ 0))
          =(~ hits:(search-scoped:sidx idx 'needle' ~ 10 `~))
      ==
++  test-exact-term-suppresses-newer-spelling-matches
  =/  idx  (put-document:sidx *index:sidx [0v1 1 ~] ~2024.1.1 '' ~['Reid'])
  =.  idx  (put-document:sidx idx [0v1 2 ~] ~2024.1.2 '' ~['read refid'])
  ;:  weld
      %+  expect-eq
        !>(`(list ref:gs)`~[[0v1 1 ~]])
      !>((turn hits:(search:sidx idx 'reid' ~ 1) |=(=hit:gs ref.hit)))
      (expect-eq !>(0) !>((match-rank:sidx 'reid' (query-terms:sidx idx 'reid'))))
  ==
++  test-preview-finds-whole-terms-in-later-fields
  =/  terms  (silt ~['reid'])
  =/  preview  (match-preview:sidx ~['unrelated title' 'freid does not match; Reid does.'] terms)
  ;:  weld
      (expect-eq !>(`(unit @ud)`~) !>((first-match:sidx 'freid' terms)))
      (expect-eq !>('freid does not match; Reid does.') !>(snippet.preview))
      (expect-eq !>(`(list @t)`~['reid']) !>(matched.preview))
  ==
++  test-match-preview-keeps-distant-utf8-text
  =/  prefix  (rap 3 (reap 900 'é '))
  =/  body  (cat 3 prefix (cat 3 'Reid ' (rap 3 (reap 600 'é '))))
  =/  preview  (match-preview:sidx ~[body] (silt ~['reid']))
  ;:  weld
      (expect !>((gth offset.preview 2.000)))
      (expect !>((lte (met 3 snippet.preview) 518)))
      (expect-eq !>(`(list @t)`~['reid']) !>(matched.preview))
      %-  expect
      !>(|((lth (cut 3 [offset.preview 1] body) 128) (gth (cut 3 [offset.preview 1] body) 191)))
  ==
++  test-replacement-across-segments-keeps-only-live-postings
  =/  target=ref:gs  [0v1 1 ~]
  =/  other=ref:gs  [0v2 1 ~]
  =/  idx  (put-document:sidx *index:sidx target ~2024.1.1 '' ~['alpha beta'])
  =.  count.idx  segment-size:sidx
  =.  idx  (put-document:sidx idx target ~2024.1.1 '' ~['alpha gamma'])
  =.  idx  (put-document:sidx idx other ~2024.1.2 '' ~['alpha beta'])
  =/  cleared  (put-document:sidx idx target ~2024.1.3 '' ~[''])
  ;:  weld
      (expect-eq !>(2) !>(live-count.idx))
      %+  expect-eq
        !>(`(list ref:gs)`~[other])
      !>((turn hits:(search:sidx idx 'alpha beta' ~ 10) |=(=hit:gs ref.hit)))
      %+  expect-eq
        !>(`(list ref:gs)`~[target])
      !>((turn hits:(search:sidx idx 'alpha gamma' ~ 10) |=(=hit:gs ref.hit)))
      (expect-eq !>(1) !>(live-count.cleared))
      (expect-eq !>(`(list hit:gs)`~) !>(hits:(search:sidx cleared 'gamma' ~ 10)))
      (expect-eq !>(count.idx) !>(count.cleared))
  ==
++  test-remove-source-keeps-other-scopes-and-document-ids
  =/  idx  (put-document:sidx *index:sidx [0v1 1 ~] ~2024.1.1 '' ~['shared'])
  =.  idx  (put-document:sidx idx [0v1 2 ~] ~2024.1.2 '' ~['shared'])
  =.  idx  (put-document:sidx idx [0v2 1 ~] ~2024.1.3 '' ~['shared'])
  =/  removed  (remove-source:sidx idx 0v1)
  ;:  weld
      (expect-eq !>(1) !>(live-count.removed))
      %+  expect-eq
        !>(`(list ref:gs)`~[[0v2 1 ~]])
      !>((turn hits:(search:sidx removed 'shared' ~ 10) |=(=hit:gs ref.hit)))
      (expect-eq !>(count.idx) !>(count.removed))
      (expect-eq !>(removed) !>((remove-source:sidx removed 0v1)))
  ==
++  test-bounded-term-walk-preserves-left-to-right-order
  =/  terms  (silt ~['alpha' 'beta' 'gamma' 'delta' 'epsilon' 'zeta' 'eta'])
  =/  limits=(list @ud)  ~[0 1 3 7 10]
  %-  zing
  %+  turn  limits
  |=  limit=@ud
  (expect-eq !>((scag limit (flop ~(tap in terms)))) !>((take-terms:sidx terms limit)))
--

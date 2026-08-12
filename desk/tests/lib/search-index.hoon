/-  gs=global-search
/+  sidx=search-index, *test
|%
++  ref
  |=  [source=source:gs top=time reply=(unit time)]
  ^-  ref:gs
  [source top reply]
::
++  test-tokenization
  %+  expect-eq
    !>(`(set @t)`(sy ~['hello' 'world' '~zod' 'fuzzy-search']))
  !>((tokenize:sidx ~['Hello, WORLD!' '~zod fuzzy-search']))
::
++  test-searches-newest-first-and-pages
  =/  one=ref:gs  (ref [%dm ~zod] ~2024.1.1 ~)
  =/  two=ref:gs  (ref [%club 0v7] ~2024.1.2 ~)
  =/  three=ref:gs  (ref [%dm ~nec] ~2024.1.3 ~)
  =/  idx=index:sidx  *index:sidx
  =.  idx  (put-document:sidx idx one ~2024.1.1 ~zod ~['hello old world'])
  =.  idx  (put-document:sidx idx two ~2024.1.2 ~nec ~['hello other'])
  =.  idx  (put-document:sidx idx three ~2024.1.3 ~nec ~['hello new world'])
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
  =/  old=ref:gs  (ref [%dm ~zod] ~2024.1.1 ~)
  =/  new=ref:gs  (ref [%dm ~nec] ~2024.1.2 ~)
  =/  idx=index:sidx  *index:sidx
  =.  idx  (put-document:sidx idx old ~2024.1.1 ~zod ~['segment term'])
  ::  Force the next insertion into another segment without constructing
  ::  thousands of irrelevant fixtures.
  =.  idx  idx(count segment-size:sidx)
  =.  idx  (put-document:sidx idx new ~2024.1.2 ~nec ~['segment term'])
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
  =/  target=ref:gs  (ref [%dm ~zod] ~2024.1.1 ~)
  =/  idx=index:sidx  *index:sidx
  =.  idx
    (put-document:sidx idx target ~2024.1.1 ~zod ~['hello searchable world'])
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
  =/  target=ref:gs  (ref [%dm ~zod] ~2024.1.1 ~)
  =/  reply=ref:gs  (ref [%dm ~zod] ~2024.1.1 `~2024.1.2)
  =/  idx=index:sidx  *index:sidx
  =.  idx  (put-document:sidx idx target ~2024.1.1 ~zod ~['old phrase'])
  =.  idx  (put-document:sidx idx reply ~2024.1.2 ~nec ~['reply phrase'])
  =.  idx  (put-document:sidx idx target ~2024.1.1 ~zod ~['new phrase'])
  =/  old=(list hit:gs)  hits:(search:sidx idx 'old' ~ 10)
  =/  new=(list hit:gs)  hits:(search:sidx idx 'new' ~ 10)
  =/  idx=index:sidx  (remove-thread:sidx idx [[%dm ~zod] ~2024.1.1])
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
    %+  expect-eq  !>(`@ud`0)
    !>(dms.sources.idx)
  ::
    %+  expect-eq  !>(`(list hit:gs)`~)
    !>(hits:(search:sidx idx 'reply' ~ 10))
  ==
--

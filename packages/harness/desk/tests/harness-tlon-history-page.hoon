/+  *test, p=harness-tlon-history-page
|%
++  fixture
  |=  [count=@ud text=@t]
  ^-  (list row:p)
  %+  turn  (gulf 1 count)
  |=  index=@ud
  [(add ~2026.9.6 index) `[(scot %ud index) ~lux ~2026.9.1 text |]]
++  test-page-uses-local-position-not-author-sent-time
  =/  page  (scan:p (fixture 21 'message') '')
  ?>  ?=(^ messages.page)
  %-  expect
  !>  ?&  =(20 (lent messages.page))  =(20 scanned.page)  =(`(add ~2026.9.6 2) before.page)
          =('2' id.i.messages.page)
      ==
++  test-last-page-has-no-cursor
  =/  page  (scan:p (fixture 20 'message') '')
  (expect !>(&(=(20 (lent messages.page)) =(~ before.page))))
++  test-empty-search-page-still-advances
  =/  page  (scan:p (fixture 65 'message') 'absent')
  (expect !>(&(=(~ messages.page) =(64 scanned.page) =(`(add ~2026.9.6 2) before.page))))
++  test-search-stops-at-hit-limit-without-skipping-the-remainder
  =/  page  (scan:p (fixture 65 'MiXeD needle') 'mixed')
  (expect !>(&(=(20 (lent messages.page)) =(20 scanned.page) =(`(add ~2026.9.6 46) before.page))))
++  test-tombstones-advance-without-returning-deleted-content
  =/  rows  (turn (fixture 21 'message') |=(r=row:p r(message ~)))
  =/  page  (scan:p rows '')
  (expect !>(&(=(~ messages.page) =(20 scanned.page) =(`(add ~2026.9.6 2) before.page))))
++  test-cursors-are-scoped-and-bounded
  =/  token  (cursor:p 0v1 ~2026.9.6)
  %-  expect
  !>  ?&  =(`~2026.9.6 (position:p 0v1 token))  =(~ (mole |.((position:p 0v2 token))))
          =(~ (position:p 0v1 ''))  =(~ (mole |.((position:p 0v1 (crip (reap 257 'a'))))))
      ==
++  test-query-validation-and-normalization
  =/  make  |=(text=@t (pairs:enjs:format ~[['query' %s text]]))
  %-  expect
  !>  ?&  =('needle' (query:p (make 'NEEDLE')))  =(~ (mole |.((query:p (make '   ')))))
          =(~ (mole |.((query:p (make (crip (reap 129 'a')))))))
      ==
++  test-cursor-rejects-zero-position-and-unknown-version
  =/  zero  (cursor:p 0v1 `@da`0)
  =/  future  (scot %uv (jam [%2 0v1 ~2026.9.6]))
  (expect !>(&(=(~ (mole |.((position:p 0v1 zero)))) =(~ (mole |.((position:p 0v1 future)))))))
++  test-json-budget-does-not-consume-the-first-unreturned-hit
  =/  page  (scan:p (fixture 21 (crip (reap 800 `@t`1))) '')
  =/  json  (encode:p 0v1 page ~ '')
  %-  expect
  !>  ?&  =(3 (lent messages.page))  =(3 scanned.page)  =(`(add ~2026.9.6 19) before.page)
          (lth (met 3 (en:json:html json)) 24.000)
      ==
++  test-text-limit-preserves-utf8-without-searchable-synthetic-suffix
  =/  prefix  (crip (reap 799 'a'))
  =/  text  (cat 3 prefix '👍tail')
  %-  expect
  !>  ?&  =(prefix (clip-text:p text 800))  =(800 (met 3 (clip-text:p (crip (reap 801 'a')) 800)))
          =('👍' (clip-text:p '👍tail' 4))  =('' (clip-text:p '👍tail' 3))
      ==
--

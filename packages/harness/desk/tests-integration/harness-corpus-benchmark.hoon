::  Native benchmark and correctness check over eight populated segments.
::  Opt-in: -test /=harness=/tests-integration/harness-corpus-benchmark
::  %bout measures the actual production operations, with ordinary jets on.
/-  c=harness-corpus
/+  *test, idx=harness-corpus-index
|%
++  test-segmented-index-at-thirty-two-thousand-documents
  =/  db
    ~>  %bout.[1 'corpus-build-32768']
    =/  db  *index:c
    =/  at=@ud  1
    |-  ^-  index:c
        ?:  (gth at 32.768)  db
        =/  scope=@uv  ?:(=(0 (mod at 2)) 0v1 0v2)
        =/  body
          ?:  =(at 16.385)
            'commonalpha sharedword rareevidence'
          'commonalpha sharedword othermaterial'
        $(at +(at), db (put-document:idx db [scope at ~] (add ~2024.1.1 at) 'fixture' ~[body]))
  =/  rare
    ~>  %bout.[1 'corpus-rare-and-query']
    (search:idx db 'rareevidence sharedword' ~ 16)
  =/  common
    ~>  %bout.[1 'corpus-common-first-page']
    (search:idx db 'commonalpha sharedword' ~ 16)
  =/  scoped
    ~>  %bout.[1 'corpus-authorized-first-page']
    (search-scoped:idx db 'commonalpha' ~ 16 `(silt ~[0v1]))
  =/  fuzzy
    ~>  %bout.[1 'corpus-prefix-query']
    (search:idx db 'rareevid' ~ 16)
  ;:  weld
      (expect-eq !>(1) !>((lent hits.rare)))
      (expect-eq !>(16) !>((lent hits.common)))
      (expect-eq !>(16) !>((lent hits.scoped)))
      (expect !>((levy hits.scoped |=(hit=hit:c =(0v1 scope.ref.hit)))))
      (expect-eq !>(1) !>((lent hits.fuzzy)))
      (expect !>(?=(^ next.common)))
  ==
--

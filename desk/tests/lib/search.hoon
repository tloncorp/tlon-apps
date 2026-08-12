::  tests for the %search tokenizer and index core
::
/-  se=search
/+  sl=search, *test
|%
++  sid  ~sidwyn-nimnev-nocsyx-lassul
::  +book-target: a note target, the cheapest shape to build in tests
::
++  bt
  |=  id=@ud
  ^-  target:v1:se
  [%note [sid %notebook] id]
::
++  ent
  |=  [id=@ud title=@t text=@t]
  ^-  entry:v1:se
  [(bt id) title 'Notebook' text `sid ~2026.1.1]
::  +msg: a chat entry, for tests that need a second source
::
++  msg
  |=  [t=@da text=@t]
  ^-  entry:v1:se
  [[%chat [%ship sid] [sid t] ~] '' 'DM' text `sid t]
::  +rep: a chat reply hanging off the message sent at .t
::
++  rep
  |=  [t=@da r=@da text=@t]
  ^-  entry:v1:se
  [[%chat [%ship sid] [sid t] `[sid r]] '' 'DM' text `sid r]
::  +index-of: an index holding the given entries
::
++  index-of
  |=  entries=(list entry:v1:se)
  ^-  index:v1:se
  =|  ix=index:v1:se
  |-  ^-  index:v1:se
  ?~  entries  ix
  $(entries t.entries, ix (~(catalog dex:sl ix) i.entries))
::
++  hit-ids
  |=  hits=(list hit:v1:se)
  ^-  (list @ud)
  %+  turn  hits
  |=  h=hit:v1:se
  ?>(?=([%note *] target.doc.h) id.target.doc.h)
::
++  seek-ids
  |=  [ix=index:v1:se query=@t]
  ^-  (list @ud)
  (hit-ids (~(seek dex:sl ix) query ~))
::
++  test-tokens-splits-and-lowercases
  %+  expect-eq
    !>(`(list @t)`~['freeze' 'checklist' 'kelvin-9'])
  !>((tokens:sl 'Freeze, CHECKLIST kelvin-9!'))
::
++  test-tokens-drops-stopwords
  %+  expect-eq
    !>(`(list @t)`~['quick' 'brown' 'fox'])
  !>((tokens:sl 'the quick and a brown fox'))
::
::  a message of nothing but stopwords and punctuation has no terms at all
::
++  test-tokens-empty
  %+  expect-eq
    !>(`(list @t)`~)
  !>((tokens:sl 'the and of !!! ...'))
::
++  test-grams-ordered-slices
  ;:  weld
    %+  expect-eq
      !>(`(list @t)`~['cha' 'han' 'ann' 'nne' 'nel'])
    !>((grams:sl 'channel'))
  ::
    ::  terms under three bytes have no trigrams; exact match still finds them
    %+  expect-eq
      !>(`(list @t)`~)
    !>((grams:sl 'ok'))
  ==
::
::  +clip must not split a utf-8 sequence: cutting "héllo" at 3 bytes has to
::  stop before the two-byte "é" rather than halfway through it
::
++  test-clip-respects-utf8
  ;:  weld
    %+  expect-eq  !>('h')  !>((clip:sl 2 'héllo'))
    %+  expect-eq  !>('hé')  !>((clip:sl 3 'héllo'))
    %+  expect-eq  !>('héllo')  !>((clip:sl 99 'héllo'))
  ==
::
++  test-catalog-and-exact-match
  =/  ix  (index-of ~[(ent 1 'Freeze plan' 'verify the sunrise ordering')])
  ;:  weld
    %+  expect-eq  !>(`(list @ud)`~[1])  !>((seek-ids ix 'sunrise'))
    %+  expect-eq  !>(`(list @ud)`~[1])  !>((seek-ids ix 'freeze'))
    %+  expect-eq  !>(`(list @ud)`~)     !>((seek-ids ix 'wombat'))
  ==
::
::  a title match must outrank a body match for the same term
::
++  test-title-outranks-body
  =/  ix
    %-  index-of
    :~  (ent 1 'unrelated' 'kelvin appears in the body only')
        (ent 2 'kelvin' 'unrelated body text here')
    ==
  %+  expect-eq  !>(`(list @ud)`~[2 1])  !>((seek-ids ix 'kelvin'))
::
::  matching more of the query's distinct terms wins regardless of weights
::
++  test-more-terms-matched-wins
  =/  ix
    %-  index-of
    :~  (ent 1 '' 'kelvin kelvin kelvin kelvin kelvin')
        (ent 2 '' 'kelvin freeze')
    ==
  %+  expect-eq  !>(`(list @ud)`~[2 1])  !>((seek-ids ix 'kelvin freeze'))
::
::  a prefix reaches the full term through the trigram index
::
++  test-prefix-match
  =/  ix  (index-of ~[(ent 1 '' 'the migration plan')])
  %+  expect-eq  !>(`(list @ud)`~[1])  !>((seek-ids ix 'migrat'))
::
::  and so does a typo, at 60% trigram overlap
::
++  test-fuzzy-match
  =/  ix  (index-of ~[(ent 1 '' 'the channel is busy')])
  %+  expect-eq  !>(`(list @ud)`~[1])  !>((seek-ids ix 'chanel'))
::
::  re-cataloging the same target replaces it rather than accumulating:
::  the old text stops matching and the document is still counted once
::
++  test-recatalog-replaces
  =/  ix  (index-of ~[(ent 1 '' 'the original wording')])
  =.  ix  (~(catalog dex:sl ix) (ent 1 '' 'the replacement wording'))
  ;:  weld
    %+  expect-eq  !>(`(list @ud)`~)     !>((seek-ids ix 'original'))
    %+  expect-eq  !>(`(list @ud)`~[1])  !>((seek-ids ix 'replacement'))
    %+  expect-eq  !>(1)  !>(~(wyt by docs.ix))
  ==
::
::  erasing retracts the document and, with it, every term only it used —
::  otherwise vocabulary would leak as content churns
::
++  test-erase-retracts-terms
  =/  ix  (index-of ~[(ent 1 '' 'solitary vocabulary')])
  =.  ix  (~(erase dex:sl ix) (bt 1))
  ;:  weld
    %+  expect-eq  !>(`(list @ud)`~)  !>((seek-ids ix 'solitary'))
    %+  expect-eq  !>(0)  !>(~(wyt by docs.ix))
    %+  expect-eq  !>(0)  !>(~(wyt by terms.ix))
    %+  expect-eq  !>(0)  !>(~(wyt by grams.ix))
    %+  expect-eq  !>(0)  !>(~(wyt by trail.ix))
  ==
::
::  a term shared with a surviving document must not be dropped with it
::
++  test-erase-keeps-shared-terms
  =/  ix
    %-  index-of
    ~[(ent 1 '' 'shared wording') (ent 2 '' 'shared phrasing')]
  =.  ix  (~(erase dex:sl ix) (bt 1))
  ;:  weld
    %+  expect-eq  !>(`(list @ud)`~[2])  !>((seek-ids ix 'shared'))
    %+  expect-eq  !>(`(list @ud)`~)     !>((seek-ids ix 'wording'))
  ==
::
::  deleting a message takes its replies with it — a reply is its own
::  document, and leaving it behind means a hit pointing at nothing
::
++  test-erase-cascades-to-replies
  =/  ix
    %-  index-of
    :~  (msg ~2026.1.1 'parent wording')
        (rep ~2026.1.1 ~2026.1.2 'reply wording')
    ==
  ;:  weld
    %+  expect-eq  !>(2)  !>(~(wyt by docs.ix))
    ::
    =.  ix  (~(erase dex:sl ix) [%chat [%ship sid] [sid ~2026.1.1] ~])
    ;:  weld
      %+  expect-eq  !>(0)  !>(~(wyt by docs.ix))
      %+  expect-eq  !>(0)  !>(~(wyt by terms.ix))
      %+  expect-eq  !>(0)  !>(~(wyt by kids.ix))
    ==
  ==
::
::  editing a message must not: a re-index keeps the replies in place
::
++  test-recatalog-keeps-replies
  =/  ix
    %-  index-of
    :~  (msg ~2026.1.1 'parent wording')
        (rep ~2026.1.1 ~2026.1.2 'reply wording')
    ==
  =.  ix  (~(catalog dex:sl ix) (msg ~2026.1.1 'edited parent wording'))
  ;:  weld
    %+  expect-eq  !>(2)  !>(~(wyt by docs.ix))
    %+  expect-eq  !>(1)  !>((lent (~(seek dex:sl ix) 'reply' ~)))
    %+  expect-eq  !>(1)  !>((lent (~(seek dex:sl ix) 'edited' ~)))
  ==
::
::  erasing a reply on its own leaves the parent alone
::
++  test-erase-reply-keeps-parent
  =/  ix
    %-  index-of
    :~  (msg ~2026.1.1 'parent wording')
        (rep ~2026.1.1 ~2026.1.2 'reply wording')
    ==
  =.  ix  (~(erase dex:sl ix) [%chat [%ship sid] [sid ~2026.1.1] `[sid ~2026.1.2]])
  ;:  weld
    %+  expect-eq  !>(1)  !>(~(wyt by docs.ix))
    %+  expect-eq  !>(1)  !>((lent (~(seek dex:sl ix) 'parent' ~)))
    %+  expect-eq  !>(0)  !>((lent (~(seek dex:sl ix) 'reply' ~)))
    %+  expect-eq  !>(0)  !>(~(wyt by kids.ix))
  ==
::
::  a document with no indexable terms is dropped rather than stored:
::  nothing could ever match it
::
++  test-textless-document-not-stored
  =/  ix  (index-of ~[(ent 1 '' 'the and of')])
  %+  expect-eq  !>(0)  !>(~(wyt by docs.ix))
::
::  a stopword-only query matches nothing rather than everything
::
++  test-stopword-query-matches-nothing
  =/  ix  (index-of ~[(ent 1 '' 'the quick brown fox')])
  %+  expect-eq  !>(`(list @ud)`~)  !>((seek-ids ix 'the and of'))
::
::  +purge drops one source and leaves the others intact
::
++  test-purge-by-source
  =/  ix
    %-  index-of
    :~  (ent 1 '' 'kelvin in a note')
        (msg ~2026.1.1 'kelvin in a message')
    ==
  =.  ix  (~(purge dex:sl ix) %notes)
  ;:  weld
    %+  expect-eq  !>(1)  !>(~(wyt by docs.ix))
    %+  expect-eq  !>(`(list @ud)`~)  !>((seek-ids ix 'note'))
  ==
::
::  the source filter restricts results without changing the index
::
++  test-seek-source-filter
  =/  ix
    %-  index-of
    :~  (ent 1 '' 'kelvin in a note')
        (msg ~2026.1.1 'kelvin in a message')
    ==
  ;:  weld
    %+  expect-eq  !>(2)  !>((lent (~(seek dex:sl ix) 'kelvin' ~)))
    %+  expect-eq  !>(1)  !>((lent (~(seek dex:sl ix) 'kelvin' `%notes)))
    %+  expect-eq  !>(1)  !>((lent (~(seek dex:sl ix) 'kelvin' `%chat)))
    %+  expect-eq  !>(0)  !>((lent (~(seek dex:sl ix) 'kelvin' `%channels)))
  ==
--

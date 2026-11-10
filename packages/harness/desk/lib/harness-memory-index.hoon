::  Bounded exact recall. Standard maps and ordered mops retain native jets;
::  custom Hoon visits only a fixed number of terms, postings and candidates.
/-  m=harness-memory
/+  corpus=harness-corpus-index
|%
++  on-posting  ((on @ud @t) lte)
++  max-terms  8
++  max-visits  64
++  words
  |=  text=@t
  ^-  (set @t)
  %-  silt
  %+  skim  (take-terms:corpus (tokenize-text:corpus text) 64)
  |=  word=@t
  ?&  (gte (met 3 word) 3)
      (lte (met 3 word) 64)
      !(~(has in ignored) word)
  ==
++  ignored
  %-  silt
  ^-  (list @t)
  :~  'the'  'and'  'for'  'that'  'this'  'with'  'from'  'have'  'has'
      'are'  'was'  'were'  'will'  'would'  'should'  'could'  'can'
      'you'  'your'  'they'  'their'  'them'  'our'  'its'  'not'  'but'
      'what'  'when'  'where'  'which'  'how'  'please'  'some'  'about'
      'then'  'than'  'also'  'just'  'only'  'want'  'need'  'into'
  ==
++  terms
  |=  [name=@t value=value:m]
  ^-  (set @t)
  (~(put in (~(uni in aliases.value) (words (rap 3 name ' ' (fall body.value '') ~)))) '')
++  prefix-key
  |=  word=@t
  (cat 3 ':' (term-prefix:corpus word))
++  posting-terms
  |=  terms=(set @t)
  ^-  (set @t)
  %-  ~(uni in terms)
  %+  roll  (take-terms:corpus terms 80)
  |=  [word=@t keys=(set @t)]
  ?:  =('' word)  keys
  (~(put in keys) (prefix-key word))
++  replace
  |=  [index=(map @t bucket:m) name=@t before=(unit record:m) after=record:m]
  ^+  index
  =.  index  (~(put by index) ':prefix-index' *bucket:m)
  =?  index  ?=(^ before)
    %+  roll  (take-terms:corpus (posting-terms terms.u.before) 160)
    |=  [word=@t index=_index]
    =/  bucket  (~(get by index) word)
    ?~  bucket  index
    =/  removed  (del:on-posting rows.u.bucket revision.u.before)
    ?~  -.removed  index
    =/  rows  +.removed
    ?~  rows  (~(del by index) word)
    (~(put by index) word [(dec count.u.bucket) rows])
  ?~  body.value.after  index
  %+  roll  (take-terms:corpus (posting-terms terms.after) 160)
  |=  [word=@t index=_index]
  =/  bucket  (fall (~(get by index) word) *bucket:m)
  (~(put by index) word [+(count.bucket) (put:on-posting rows.bucket revision.after name)])
::  Sort at most eight terms by their maintained posting counts. Never count
::  a posting tree, enumerate a directory, or expand spelling on this path.
++  needles
  |=  [index=(map @t bucket:m) query=@t]
  ^-  (list [word=@t count=@ud])
  =/  selected
    %+  murn  (take-terms:corpus (words query) max-terms)
    |=  word=@t
    ^-  (unit [word=@t count=@ud])
    =/  bucket  (~(get by index) word)
    ?~  bucket  ~
    `[word count.u.bucket]
  %+  sort  selected
  |=  [a=[word=@t count=@ud] b=[word=@t count=@ud]]
  (lth count.a count.b)
::  The visit budget counts nodes, including rejected candidates. Collection
::  never constructs a union of whole postings or visits historical segments.
++  candidates
  |=  [index=(map @t bucket:m) query=@t]
  ^-  [names=(set @t) visited=@ud terms=(list [word=@t count=@ud])]
  =/  terms  (needles index query)
  =/  remaining  terms
  =/  found=[names=(set @t) left=@ud]  [~ max-visits]
  |-  ^-  [names=(set @t) visited=@ud terms=(list [word=@t count=@ud])]
      ?:  |(?=(~ remaining) =(0 left.found))
        [names.found (sub max-visits left.found) terms]
      =/  bucket  (~(got by index) word.i.remaining)
      =/  portion  (min 16 left.found)
      =/  part  (take rows.bucket [names.found portion])
      %=  $
        remaining  t.remaining
        found  [names.part (sub left.found (sub portion left.part))]
      ==
++  take
  |=  [tree=posting:m found=[names=(set @t) left=@ud]]
  ^+  found
  ?:  |(?=(~ tree) =(0 left.found))  found
  =.  found  found(left (dec left.found))
  =.  names.found  (~(put in names.found) val.n.tree)
  =.  found  (take r.tree found)
  (take l.tree found)
++  score
  |=  [record=record:m needles=(list [word=@t count=@ud])]
  ^-  @ud
  ?~  body.value.record  0
  =/  matches
    (skim needles |=([word=@t count=@ud] (~(has in terms.record) word)))
  ?~  matches  0
  ::  One distinctive term is enough; common words require corroboration.
  ?:  &(=(1 (lent matches)) (gth count.i.matches 8))  0
  %+  roll  `(list [word=@t count=@ud])`matches
  |=  [[word=@t count=@ud] total=@ud]
  (add total (add 1 (div 64 (max 1 count))))
--

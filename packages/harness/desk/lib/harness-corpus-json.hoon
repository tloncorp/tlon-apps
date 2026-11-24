::  Bounded corpus projections shared by ACP, the GUI and model-side recall.
::  The caller supplies current authority. Neither cursors nor source IDs
::  grant access, and search never obtains source content from another app.
/-  h=harness, c=harness-corpus
/+  idx=harness-corpus-index, hj=harness-json
|%
::
++  status
  |=  [db=state:c allowed=(set scope:c)]
  ^-  json
  =/  total
    %+  roll  ~(tap in allowed)
    |=  [scope=scope:c total=@ud]
    =/  source  (~(get by scopes.db) scope)
    ?~(source total (add total count.u.source))
  %-  pairs:enjs:format
  :~  ['indexed' (numb:enjs:format total)]
      ['conversations' (numb:enjs:format ~(wyt in (~(int in allowed) ~(key by scopes.db))))]
      ['indexing' %b !=(~ (~(int in allowed) queued.db))]
      ['epoch' %s ?~(built-at.index.db '' (scot %da u.built-at.index.db))]
  ==
::
++  cursor-json
  |=  [fence=@t next=cursor:c]
  ^-  @t
  %-  en:json:html
  %-  pairs:enjs:format
  :~  ['fence' %s fence]
      ['sent' %s (scot %da sent.next)]
      ['id' (numb:enjs:format id.next)]
  ==
::
++  parse-cursor
  |=  [raw=@t fence=@t]
  ^-  (unit cursor:c)
  ?.  (lte (met 3 raw) 2.048)  ~
  %-  mole
  |.
  =/  value  (need (de:json:html raw))
  =,  dejs:format
  =/  saved=[fence=@t sent=@t id=@ud]
    ((ot ~[fence+so sent+so id+ni]) value)
  ?>  =(fence fence.saved)
  [(need (slaw %da sent.saved)) id.saved]
::
++  search
  |=  [db=state:c allowed=(set scope:c) query=@t cursor=(unit @t) limit=@ud]
  ^-  (each json @t)
  ?.  ?&  (lte (met 3 query) 512)
          (lte limit 64)
          (gth limit 0)
      ==
    [%| 'Search accepts at most 512 query bytes and 1–64 results per page.']
  =/  fence  (scot %uv (sham [query allowed built-at.index.db]))
  =/  after  ?~(cursor ~ (parse-cursor u.cursor fence))
  ?:  &(?=(^ cursor) ?=(~ after))
    [%| 'Search changed or the index was rebuilt. Restart from the first page.']
  =/  page  (search-scoped:idx index.db query after limit `allowed)
  =/  terms  (query-terms:idx index.db query)
  =/  rank  (match-rank:idx query terms)
  =/  hits
    %+  turn  hits.page
    |=  hit=hit:c
    (search-record db scope.ref.hit at.ref.hit terms rank)
  :-  %&
  %-  pairs:enjs:format
  :~  ['hits' %a hits]
      ['cursor' ?~(next.page ~ [%s (cursor-json fence u.next.page)])]
      ['complete' %b complete.page]
      ['status' (status db allowed)]
  ==
::
++  search-record
  |=  [db=state:c scope=scope:c at=@ud terms=(set @t) rank=@ud]
  ^-  json
  =/  value  (record-json db scope at)
  ?>  ?=(%o -.value)
  =/  source  (~(got by scopes.db) scope)
  =/  record  (~(got by records.source) at)
  =/  preview  (match-preview:idx ~[body.record] terms)
  =.  p.value  (~(put by p.value) 'snippet' [%s snippet.preview])
  =.  p.value  (~(put by p.value) 'snippetOffset' (numb:enjs:format offset.preview))
  =.  p.value  (~(put by p.value) 'matchedTerms' [%a (turn matched.preview |=(word=@t [%s word]))])
  =.  p.value  (~(put by p.value) 'matchType' [%s ?:(=(0 rank) 'exact' 'approximate')])
  value
::
++  record-json
  |=  [db=state:c scope=scope:c at=@ud]
  ^-  json
  =/  source  (~(get by scopes.db) scope)
  ?~  source  ~
  =/  record  (~(get by records.u.source) at)
  ?~  record  ~
  =/  entry  u.record
  =/  sent
    ?:  (lth sent.entry ~1970.1.1)  ~
    (numb:enjs:format (div (mul 1.000 (sub sent.entry ~1970.1.1)) ~s1))
  =/  hand=@t
    ?~  source.entry  'legacy'
    ?:  ?=(%hand -.u.source.entry)  hand.u.source.entry
    (scot %tas -.u.source.entry)
  %-  pairs:enjs:format
  :~  ['scope' %s (scot %uv scope)]
      ['sessionId' %s sid.u.source]
      ['eventCount' (numb:enjs:format at)]
      ['kind' %s kind.entry]
      ['role' %s role.entry]
      ['hand' %s hand]
      ['author' %s author.entry]
      ['source' ?~(source.entry ~ (input-source-json:hj u.source.entry))]
      ['sent' sent]
      ['snippet' %s (make-snippet:idx ~[body.entry])]
  ==
::  Slice only at UTF-8 boundaries. Clients use the returned byte offset;
::  arbitrary offsets inside a codepoint are rejected instead of corrupted.
::
++  chunk
  |=  [body=@t offset=@ud]
  ^-  (unit [text=@t next=(unit @ud)])
  =/  length  (met 3 body)
  ?.  (lte offset length)  ~
  =/  byte  (cut 3 [offset 1] body)
  ?:  &((gte byte 128) (lte byte 191))  ~
  =/  end  (min length (add offset 12.000))
  |-
  ^-  (unit [text=@t next=(unit @ud)])
  =/  next  (cut 3 [end 1] body)
  ?:  &((gte next 128) (lte next 191))  $(end (dec end))
  `[(cut 3 [offset (sub end offset)] body) ?:(=(end length) ~ `end)]
::
++  read
  |=  [db=state:c allowed=(set scope:c) scope=scope:c at=@ud offset=@ud]
  ^-  (each json @t)
  ?.  (~(has in allowed) scope)  [%| 'Source is not available in this recall scope.']
  =/  source  (~(get by scopes.db) scope)
  ?~  source  [%| 'Source is no longer available.']
  =/  record  (~(get by records.u.source) at)
  ?~  record  [%| 'Source is not indexed yet or does not contain searchable content.']
  =/  part  (chunk body.u.record offset)
  ?~  part  [%| 'Invalid source byte offset.']
  :-  %&
  %-  pairs:enjs:format
  :~  ['record' (record-json db scope at)]
      ['body' %s text.u.part]
      ['offset' (numb:enjs:format offset)]
      ['nextOffset' ?~(next.u.part ~ (numb:enjs:format u.next.u.part))]
      ['referenceOnly' %b &]
  ==
::
++  expand
  |=  [db=state:c allowed=(set scope:c) scope=scope:c at=@ud offset=@ud]
  ^-  (each json @t)
  ?.  (~(has in allowed) scope)  [%| 'Source is not available in this recall scope.']
  =/  source  (~(get by scopes.db) scope)
  ?~  source  [%| 'Source is no longer available.']
  =/  node  (~(get by nodes.lcm.view.u.source) at)
  ?~  node  [%| 'Summary is not indexed yet or this address is not a summary.']
  =/  edges  (weld children.u.node sources.u.node)
  ?.  (lte offset (lent edges))  [%| 'Invalid expansion offset.']
  =/  page  (scag 16 (slag offset edges))
  =/  through  (add offset (lent page))
  :-  %&
  %-  pairs:enjs:format
  :~  ['record' (record-json db scope at)]
      ['depth' (numb:enjs:format depth.u.node)]
      ['sources' %a (turn page |=(id=@ud (record-json db scope id)))]
      ['nextOffset' ?:((gte through (lent edges)) ~ (numb:enjs:format through))]
      ['referenceOnly' %b &]
  ==
::
++  models-json
  |=  models=summary-models:h
  ^-  json
  %-  pairs:enjs:format
  :~  ['compaction' ?~(compaction.models ~ (config-json:hj u.compaction.models))]
      ['lcm' ?~(lcm.models ~ (config-json:hj u.lcm.models))]
  ==
::
++  json-models
  |=  value=json
  ^-  summary-models:h
  ?>  ?=(%o -.value)
  =/  decode
    |=  key=@t
    ^-  (unit config:h)
    =/  raw  (~(get by p.value) key)
    ?>  ?=(^ raw)
    ?~  u.raw  ~
    ?>  ?=(%o -.u.raw)
    ::  Reads deliberately omit credentials. Accept that redacted projection
    ::  unchanged on save/restore, and never import a caller-supplied key.
    =/  config  (json-config:hj [%o (~(put by p.u.raw) 'key' [%s ''])])
    `config(key '', system '', tools ~)
  [(decode 'compaction') (decode 'lcm')]
--

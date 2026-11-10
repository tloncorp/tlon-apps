::  Owner search merges two disposable indexes. Grouping is native and happens
::  before pagination; a cursor is a position, never permission to read a note.
/-  c=harness-corpus, w=harness-workspace, s=harness-workspace-search
/+  ci=harness-corpus-index, cj=harness-corpus-json,
    wi=harness-workspace-search, wj=harness-workspace-json,
    work=harness-workspace
|%
+$  cursor
  $:  rank=@ud
      sent=@da
      kind=?(%conversation %artifact %project %task)
      id=@t
      ordinal=@ud
  ==
+$  hit  [position=cursor value=json]
::
++  before
  |=  [a=cursor b=cursor]
  ^-  ?
  ?:  =(a b)  |
  ?:  !=(rank.a rank.b)  (lth rank.a rank.b)
  ?:  !=(sent.a sent.b)  (gth sent.a sent.b)
  ?:  !=(=(%conversation kind.a) =(%conversation kind.b))  =(%conversation kind.a)
  ?:  =(%conversation kind.a)  (gth ordinal.a ordinal.b)
  (gor [kind.a id.a] [kind.b id.b])
::
++  insert
  |=  [row=hit rows=(list hit) limit=@ud]
  ^-  (list hit)
  ?:  =(0 limit)  ~
  ?~  rows  ~[row]
  ?:  (before position.row position.i.rows)
    [row (scag (dec limit) `(list hit)`rows)]
  [i.rows $(rows t.rows, limit (dec limit))]
::
++  token
  |=  [corpus=state:c index=state:s workspace=state:w allowed=(set scope:c) query=@t available=?]
  ^-  @t
  (scot %uv (sham [query allowed built-at.index.corpus epoch.index writes.workspace available]))
::
++  encode
  |=  [fence=@t position=cursor]
  ^-  @t
  %-  en:json:html
  %-  pairs:enjs:format
  :~  ['fence' %s fence]
      ['rank' (numb:enjs:format rank.position)]
      ['sent' %s (scot %da sent.position)]
      ['kind' %s kind.position]
      ['id' %s id.position]
      ['ordinal' (numb:enjs:format ordinal.position)]
  ==
::
++  decode
  |=  [fence=@t raw=@t]
  ^-  (unit cursor)
  ?.  (lte (met 3 raw) 4.096)  ~
  %-  mole
  |.
  =/  json  (need (de:json:html raw))
  ?>  =((string:wj json 'fence') fence)
  =/  kind  (string:wj json 'kind')
  ?>  %+  lien
        `(list @t)`~['conversation' 'artifact' 'project' 'task']
      |=(item=@t =(item kind))
  =/  rank  (number:wj json 'rank' 2)
  ?>  (lte rank 1)
  :*  rank
      (slav %da (string:wj json 'sent'))
      ;;(?(%conversation %artifact %project %task) kind)
      (string:wj json 'id')
      (number:wj json 'ordinal' 0)
  ==
::
++  status
  |=  [corpus=state:c index=state:s allowed=(set scope:c) available=?]
  ^-  json
  =/  base  (status:cj corpus allowed)
  ?>  ?=(%o -.base)
  =.  p.base  (~(put by p.base) 'workspaceRecords' (numb:enjs:format ~(wyt by documents.index)))
  =.  p.base  (~(put by p.base) 'workspaceAvailable' [%b available])
  =.  p.base  (~(put by p.base) 'workspaceIndexing' [%b |(!initialized.index ?=(^ queued.index))])
  base
::
++  versions
  |=  [index=state:s workspace=state:w authority=authority:w key=key:s matches=(set @ud)]
  ^-  (set @ud)
  =/  permitted
    ?:  =(%artifact kind.key)
      =/  artifact  (~(get by artifacts.workspace) id.key)
      ?~(artifact | (can-read:work workspace authority u.artifact))
    ?:  =(%project kind.key)
      &((~(has by projects.workspace) id.key) |(owner.authority !=(0 access.authority)))
    =/  task  (~(get by tasks.workspace) id.key)
    ?~(task | |(owner.authority !=(0 access.authority)))
  ?.  permitted  ~
  %-  silt
  %+  skim  ~(tap in matches)
  |=(revision=@ud (live:wi index workspace [key revision]))
::
++  workspace-hit
  |=  $:  index=state:s  workspace=state:w  authority=authority:w  key=key:s  matches=(set @ud)
          fence=@t  rank=@ud
      ==
  ^-  (unit hit)
  ::  Group only live, readable revisions before choosing the representative.
  =/  matches  (versions index workspace authority key matches)
  ?~  matches  ~
  ::  Set operations need the full mold after the nonempty check.
  =/  available=(set @ud)  matches
  =/  number  (roll ~(tap in available) max)
  =/  indexed  (~(got by documents.index) [key number])
  =/  texts  (need (source:wi workspace [key number]))
  =/  title  ?~(texts '' i.texts)
  =/  project=(unit @t)  ~
  =/  head=@ud  0
  =/  archived=?  |
  =?  title  =(%artifact kind.key)  label:(~(got by artifacts.workspace) id.key)
  =?  project  =(%artifact kind.key)  project:(~(got by artifacts.workspace) id.key)
  =?  project  =(%task kind.key)  `project:(~(got by tasks.workspace) id.key)
  =?  head  =(%artifact kind.key)  head:(~(got by artifacts.workspace) id.key)
  =?  archived  =(%artifact kind.key)  archived:(~(got by artifacts.workspace) id.key)
  =?  archived  =(%project kind.key)  archived:(~(got by projects.workspace) id.key)
  =/  value
    %-  pairs:enjs:format
    :~  ['kind' %s kind.key]
        ['id' %s id.key]
        ['title' %s title]
        ['project' (nullable:wj project)]
        ['head' (numb:enjs:format head)]
        ['revision' (numb:enjs:format number)]
        ['matchCount' (numb:enjs:format ~(wyt in available))]
        ['currentMatches' %b (~(has in available) head)]
        ['archived' %b archived]
        ['sent' (stamp:wj at.indexed)]
        ['searchToken' %s fence]
    ==
  `[[rank at.indexed kind.key id.key 0] value]
::
++  workspace-preview
  |=  [workspace=state:w value=json terms=(set @t) rank=@ud]
  ^-  json
  ?>  ?=(%o -.value)
  =/  =key:s  [;;(?(%artifact %project %task) (string:wj value 'kind')) (string:wj value 'id')]
  =/  texts  (need (source:wi workspace [key (number:wj value 'revision' 0)]))
  =/  preview  (match-preview:ci texts terms)
  =.  p.value  (~(put by p.value) 'snippet' [%s snippet.preview])
  =.  p.value  (~(put by p.value) 'matchedTerms' [%a (turn matched.preview |=(word=@t [%s word]))])
  =.  p.value  (~(put by p.value) 'matchType' [%s ?:(=(0 rank) 'exact' 'approximate')])
  value
::
++  search
  |=  $:  corpus=state:c
          index=state:s
          workspace=state:w
          allowed=(set scope:c)
          authority=authority:w
          available=?
          query=@t
          cursor=(unit @t)
          limit=@ud
      ==
  ^-  (each json @t)
  ?.  ?&  (lte (met 3 query) 512)
          (gth limit 0)
          (lte limit 32)
      ==
    [%| 'Search accepts at most 512 query bytes and 1–32 results per page.']
  =/  fence  (token corpus index workspace allowed query available)
  =/  after  ?~(cursor ~ (decode fence u.cursor))
  ?:  &(?=(^ cursor) ?=(~ after))
    [%| 'Search content or access changed. Run the search again from the first page.']
  =/  corpus-terms  (query-terms:ci index.corpus query)
  =/  corpus-rank  (match-rank:ci query corpus-terms)
  =/  work-terms  (query-terms:wi index query)
  =/  work-rank  (match-rank:ci query work-terms)
  =/  corpus-after=(unit cursor:c)
    ?~  after  ~
    ?.  =(corpus-rank rank.u.after)  ~
    `[sent.u.after ?:(=(%conversation kind.u.after) ordinal.u.after 0)]
  ::  Fetch one extra hit to decide whether the merged page needs a cursor.
  ::  Skip the conversation rank when the cursor has already passed it.
  =/  conversation-page
    ?:  ?~(after | (lth corpus-rank rank.u.after))  *page:c
    (search-scoped:ci index.corpus query corpus-after +(limit) `allowed)
  =/  rows=(list hit)
    %+  turn  hits.conversation-page
    |=  item=hit:c
    :-  [corpus-rank sent.cursor.item %conversation '' id.cursor.item]
    (search-record:cj corpus scope.ref.item at.ref.item corpus-terms corpus-rank)
  =?  rows  available
    %+  roll  ~(tap by (search:wi index query))
    |=  [[key=key:s matches=(set @ud)] rows=_rows]
    =/  row  (workspace-hit index workspace authority key matches fence work-rank)
    ?~  row  rows
    ?:  ?~(after | !(before u.after position.u.row))  rows
    (insert u.row rows +(limit))
  =/  more  (gth (lent rows) limit)
  =/  selected  (scag limit rows)
  =/  next=(unit @t)
    ?.  more  ~
    `(encode fence position:(rear selected))
  =/  hits
    %+  turn  selected
    |=  row=hit
    ?:  =(%conversation kind.position.row)  value.row
    (workspace-preview workspace value.row work-terms work-rank)
  :-  %&
  %-  pairs:enjs:format
  :~  ['hits' %a hits]
      ['cursor' (nullable:wj next)]
      ['complete' %b !more]
      ['status' (status corpus index allowed available)]
  ==
::
++  expand
  |=  $:  corpus=state:c
          index=state:s
          workspace=state:w
          allowed=(set scope:c)
          authority=authority:w
          available=?
          args=json
      ==
  ^-  (each json @t)
  ?.  available  [%| 'Native Notes is unavailable; no cached revision was returned.']
  =/  query  (string:wj args 'query')
  =/  fence  (token corpus index workspace allowed query available)
  ?.  =(fence (string:wj args 'searchToken'))
    [%| 'Search content or access changed. Run the search again to inspect matching revisions.']
  =/  id  (string:wj args 'id')
  =/  =key:s  [%artifact id]
  =/  matches
    %:  versions
      index
      workspace
      authority
      key
      (fall (~(get by (search:wi index query)) key) *(set @ud))
    ==
  =/  numbers  (sort ~(tap in matches) gth)
  =/  offset  (number:wj args 'offset' 0)
  =/  limit  (number:wj args 'limit' 16)
  ?.  ?&  (gth limit 0)
          (lte limit 32)
          (lte offset (lent numbers))
      ==
    [%| 'Invalid matching-revision offset or limit.']
  =/  selected  (scag limit (slag offset numbers))
  =/  items
    %+  turn  selected
    |=  number=@ud
    =/  revision  (~(got by revisions:(~(got by artifacts.workspace) id)) number)
    %-  pairs:enjs:format
    :~  ['revision' (numb:enjs:format number)]
        ['title' %s title.value.revision]
        ['at' (stamp:wj at.revision)]
        ['by' (actor-json:wj by.revision)]
    ==
  =/  through  (add offset (lent selected))
  :-  %&
  %-  pairs:enjs:format
  :~  ['items' %a items]
      ['nextOffset' ?:((gte through (lent numbers)) ~ (numb:enjs:format through))]
      ['searchToken' %s fence]
  ==
::
++  read
  |=  $:  corpus=state:c
          index=state:s
          workspace=state:w
          allowed=(set scope:c)
          authority=authority:w
          available=?
          args=json
      ==
  ^-  (each json @t)
  ?.  available  [%| 'Native Notes is unavailable; no cached workspace content was returned.']
  =/  query  (string:wj args 'query')
  ?.  =((token corpus index workspace allowed query available) (string:wj args 'searchToken'))
    [%| 'Search content or access changed. Run the search again before opening this result.']
  =/  kind  (string:wj args 'kind')
  ?>  |(=('artifact' kind) =('project' kind) =('task' kind))
  =/  id  (string:wj args 'id')
  =/  =key:s  [;;(?(%artifact %project %task) kind) id]
  =/  revision  ?:(=('artifact' kind) (number:wj args 'revision' 0) 0)
  =/  matches
    %:  versions
      index
      workspace
      authority
      key
      (fall (~(get by (search:wi index query)) key) *(set @ud))
    ==
  ?.  (~(has in matches) revision)
    [%| 'This record no longer matches the search or is no longer available.']
  [%& (read:wj workspace authority ?:(=('artifact' kind) 'revision' kind) args)]
--

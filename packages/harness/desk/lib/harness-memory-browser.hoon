::  Owner memory management. Reads use the live index and never enqueue capture.
/-  m=harness-memory
/+  memory=harness-memory, idx=harness-memory-index, wire=harness-memory-json,
    corpus=harness-corpus-index,
    j=harness-provider-wire
|%
++  decimal
  |=  n=@ud
  =/  value  (numb:enjs:format n)
  ?>  ?=(%n -.value)
  p.value
++  row
  |=  [name=@t record=record:m]
  ^-  json
  =/  base  (wire-row name record)
  [%o (~(put by p.base) 'revision' [%s (decimal revision.record)])]
++  wire-row
  |=  [name=@t record=record:m]
  ^-  [%o p=(map @t json)]
  =/  base  (row:wire name record)
  ?>  ?=(%o -.base)
  =/  at  at.source.value.record
  =/  millis  (div (mul 1.000 (sub (max at ~1970.1.1) ~1970.1.1)) ~s1)
  [%o (~(put by p.base) 'updatedAt' (numb:enjs:format millis))]
++  detail
  |=  [name=@t record=record:m]
  ^-  json
  =/  base  (row name record)
  ?>  ?=(%o -.base)
  =/  history
    %+  turn  (scag 6 history.record)
    |=  prior=[revision=@ud value=value:m]
    (row name [revision.prior value.prior ~ ~])
  [%o (~(put by p.base) 'history' [%a history])]
++  page
  |=  [db=state:m query=@t before=@ud]
  ^-  json
  =/  all  (fall (~(get by index.db) '') *bucket:m)
  =/  words  (tokenize-text:corpus query)
  =/  needles
    %+  sort  ~(tap in words)
    |=  [a=@t b=@t]
    =/  ca  (fall (~(get by index.db) (prefix-key:idx a)) *bucket:m)
    =/  cb  (fall (~(get by index.db) (prefix-key:idx b)) *bucket:m)
    (lth count.ca count.cb)
  =/  tree
    ?:  =('' query)  rows.all
    ?~  needles  *posting:m
    rows:(fall (~(get by index.db) (prefix-key:idx i.needles)) *bucket:m)
  =/  found  (scan db tree words before)
  %-  pairs:enjs:format
  :~  ['items' %a items.found]
      ['total' (numb:enjs:format count.all)]
      ['nextCursor' ?~(next.found ~ [%s (decimal u.next.found)])]
  ==
::  Descending revisions give stable keyset pages without enumerating records.
::  At most 128 candidates and 25 results; seeks traverse only balanced paths.
++  scan
  |=  [db=state:m tree=posting:m words=(set @t) before=@ud]
  ^-  [items=(list json) next=(unit @ud)]
  =|  stack=(list posting:m)
  =|  items=(list json)
  =/  left=@ud  128
  =/  slots=@ud  25
  =/  cursor  before
  |-  ^-  [items=(list json) next=(unit @ud)]
      ?^  tree
        ?:  (gte key.n.tree before)  $(tree l.tree)
        $(tree r.tree, stack [tree stack])
      ?~  stack  [(flop items) ~]
      ?:  |(=(0 left) =(0 slots))  [(flop items) `cursor]
      =/  node  i.stack
      ?>  ?=(^ node)
      =/  name  val.n.node
      =/  record  (~(got by records.db) name)
      =/  matches
        %+  levy  ~(tap in words)
        |=  word=@t
        %+  lien  ~(tap in terms.record)
        |=(term=@t (prefix-match:corpus word term))
      %=  $
        tree  l.node
        stack  t.stack
        cursor  key.n.node
        left  (dec left)
        slots  ?:(matches (dec slots) slots)
        items  ?:(matches [(row name record) items] items)
      ==
++  revision
  |=  args=json
  ^-  (unit @ud)
  =/  raw  (get:j args 'revision')
  ?.  ?=([~ %s *] raw)  ~
  ?:  (gth (met 3 p.u.raw) 40)  ~
  (rush p.u.raw dem)
++  operate
  |=  [db=state:m source=source:m operation=@t args=json]
  ^-  (each [db=state:m result=json] @t)
  ?.  ?=(%o -.args)  [%| 'Memory arguments must be an object.']
  ?:  =('list' operation)
    =/  query  (str:j args 'query')
    ?:  (gth (met 3 query) 512)  [%| 'Search is limited to 512 UTF-8 bytes.']
    =/  words  (tokenize-text:corpus query)
    ?:  (gth ~(wyt in words) 8)  [%| 'Search with up to eight keywords.']
    ?.  (levy ~(tap in words) |=(word=@t (gte (met 3 word) fuzzy-prefix-size:corpus)))
      [%| 'Use at least two characters per search term.']
    =/  cursor  (str:j args 'cursor')
    ?:  (gth (met 3 cursor) 40)  [%| 'Invalid memory cursor.']
    =/  before=(unit @ud)
      ?:  =('' cursor)  `+(revision.db)
      (rush cursor dem)
    ?~  before  [%| 'Invalid memory cursor.']
    [%& db (page db query u.before)]
  =/  name  (str:j args 'name')
  ?.  (valid-name:memory name)  [%| 'Use a valid memory name.']
  =/  found  (~(get by records.db) name)
  ?:  =('read' operation)
    ?~  found  [%| 'No memory has that name.']
    [%& db (detail name u.found)]
  ?.  |(=('save' operation) =('forget' operation))
    [%| 'Use list, read, save or forget.']
  =/  base  (revision args)
  ?~  base  [%| 'A current revision is required.']
  =/  result
    ?:  =('forget' operation)  (forget:memory db name u.base source)
    =/  text  (get:j args 'text')
    ?.  ?=([~ %s *] text)  [%| 'A memory needs text.']
    %:  save:memory
      db  name  u.base
      :*  `p.u.text  ?~(found ~ aliases.value.u.found)
          =(`[%b &] (get:j args 'general'))  &  source
      ==
    ==
  ?:  ?=(%| -.result)  result
  [%& p.result (detail name (~(got by records.p.result) name))]
--

/-  w=harness-workspace, s=harness-workspace-search
/+  words=harness-corpus-index
|%
++  source
  |=  [workspace=state:w address=address:s]
  ^-  (unit (list @t))
  ?:  =(%artifact kind.key.address)
    =/  artifact  (~(get by artifacts.workspace) id.key.address)
    ?~  artifact  ~
    =/  revision  (~(get by revisions.u.artifact) revision.address)
    ?~  revision  ~
    =/  value  value.u.revision
    =/  sources
      %+  turn  sources.value
      |=  ref=source:w
      (cat 3 label.ref (cat 3 ' ' url.ref))
    `[title.value body.value sources]
  ?:  =(%project kind.key.address)
    =/  project  (~(get by projects.workspace) id.key.address)
    ?~  project  ~
    `~[title.u.project description.u.project]
  =/  task  (~(get by tasks.workspace) id.key.address)
  ?~  task  ~
  `~[title.u.task description.u.task outcome.u.task]
++  fingerprint
  |=  [workspace=state:w address=address:s]
  ^-  (unit @uv)
  =/  value  (source workspace address)
  ?~(value ~ `(sham u.value))
++  queue
  |=  [index=state:s address=address:s at=@da]
  ^-  state:s
  =?  back.index  !(~(has by queued.index) address)  [address back.index]
  index(queued (~(put by queued.index) address at))
++  sync
  |=  [index=state:s before=state:w after=state:w at=@da]
  ^-  state:s
  =?  before  |(!initialized.index &(?=(~ documents.index) ?=(~ queued.index)))  *state:w
  =.  initialized.index  &
  =.  index
    %+  roll  ~(tap in (~(uni in ~(key by artifacts.before)) ~(key by artifacts.after)))
    |=  [id=@t updated=_index]
    =/  previous  (~(get by artifacts.before) id)
    =/  current  (~(get by artifacts.after) id)
    =/  before-revisions=(map @ud revision:w)  ?~(previous ~ revisions.u.previous)
    =/  after-revisions=(map @ud revision:w)  ?~(current ~ revisions.u.current)
    ?:  =(before-revisions after-revisions)  updated
    %+  roll  ~(tap in (~(uni in ~(key by before-revisions)) ~(key by after-revisions)))
    |=  [revision=@ud updated=_updated]
    =/  =address:s  [[%artifact id] revision]
    ?:  =((fingerprint before address) (fingerprint after address))  updated
    (queue updated address at)
  =.  index
    %+  roll  ~(tap in (~(uni in ~(key by projects.before)) ~(key by projects.after)))
    |=  [id=@t updated=_index]
    =/  =address:s  [[%project id] 0]
    ?:  =((fingerprint before address) (fingerprint after address))  updated
    (queue updated address at)
  %+  roll  ~(tap in (~(uni in ~(key by tasks.before)) ~(key by tasks.after)))
  |=  [id=@t updated=_index]
  =/  =address:s  [[%task id] 0]
  ?:  =((fingerprint before address) (fingerprint after address))  updated
  (queue updated address at)
++  remove
  |=  [index=state:s address=address:s]
  ^-  state:s
  =/  previous  (~(get by documents.index) address)
  ?~  previous  index
  =.  documents.index  (~(del by documents.index) address)
  %+  roll  ~(tap in words.u.previous)
  |=  [word=@t updated=_index]
  =/  matches  (~(got by terms.updated) word)
  =/  versions  (~(got by matches) key.address)
  =.  versions  (~(del in versions) revision.address)
  =.  matches
    ?~  versions  (~(del by matches) key.address)
    (~(put by matches) key.address versions)
  ?^  matches  updated(terms (~(put by terms.updated) word matches))
  =/  prefix  (term-prefix:words word)
  =/  bucket  (~(del in (~(got by prefixes.updated) prefix)) word)
  %=  updated
    terms  (~(del by terms.updated) word)
    prefixes
      ?~  bucket  (~(del by prefixes.updated) prefix)
      (~(put by prefixes.updated) prefix bucket)
  ==
++  put
  |=  [index=state:s address=address:s texts=(list @t) at=@da]
  ^-  state:s
  =.  index  (remove index address)
  =/  tokens  (tokenize:words texts)
  =.  documents.index  (~(put by documents.index) address [(sham texts) tokens at])
  %+  roll  ~(tap in tokens)
  |=  [word=@t updated=_index]
  =/  matches  (fall (~(get by terms.updated) word) *matches:s)
  =/  versions  (fall (~(get by matches) key.address) *(set @ud))
  =.  matches  (~(put by matches) key.address (~(put in versions) revision.address))
  =/  prefix  (term-prefix:words word)
  =/  bucket  (fall (~(get by prefixes.updated) prefix) *(set @t))
  %=  updated
    terms  (~(put by terms.updated) word matches)
    prefixes  (~(put by prefixes.updated) prefix (~(put in bucket) word))
  ==
++  work
  |=  [index=state:s workspace=state:w limit=@ud budget=@ud]
  ^-  state:s
  ?:  |(=(0 limit) =(0 budget))  index
  =?  index  ?=(~ front.index)  index(front (flop back.index), back ~)
  ?~  front.index  index
  =/  address  i.front.index
  =/  at  (~(got by queued.index) address)
  =/  saved=state:s  index
  =/  next
    %=  saved
      front  t.front.index
      queued  (~(del by queued.index) address)
      epoch  +(epoch.index)
    ==
  =/  texts  (source workspace address)
  ?~  texts  $(index (remove next address), limit (dec limit))
  =/  bytes  (roll u.texts |=([text=@t updated=@ud] (add updated (met 3 text))))
  =?  at  =(%artifact kind.key.address)
    at:(~(got by revisions:(~(got by artifacts.workspace) id.key.address)) revision.address)
  =?  at  =(%task kind.key.address)
    updated:(~(got by tasks.workspace) id.key.address)
  %=  $
    index  (put next address u.texts at)
    limit  (dec limit)
    budget  (sub budget (min budget bytes))
  ==
++  alternatives
  |=  [index=state:s needle=@t]
  ^-  (list @t)
  ?:  (~(has by terms.index) needle)  ~[needle]
  ?:  (lth (met 3 needle) 2)  ~
  =/  bucket  (~(get by prefixes.index) (term-prefix:words needle))
  ?~  bucket  ~
  %-  scag
  :-  32
  %+  skim  (take-terms:words u.bucket 4.096)
  |=(word=@t |((prefix-match:words needle word) (one-edit:words needle word)))
++  union
  |=  [a=matches:s b=matches:s]
  ^-  matches:s
  %+  roll  ~(tap by b)
  |=  [[key=key:s versions=(set @ud)] updated=_a]
  (~(put by updated) key (~(uni in versions) (fall (~(get by updated) key) *(set @ud))))
++  query-terms
  |=  [index=state:s query=@t]
  ^-  (set @t)
  %+  roll  ~(tap in (tokenize-text:words query))
  |=  [needle=@t updated=(set @t)]
  (~(uni in updated) (silt (alternatives index needle)))
++  intersect
  |=  [a=matches:s b=matches:s]
  ^-  matches:s
  %+  roll  ~(tap by a)
  |=  [[key=key:s versions=(set @ud)] updated=matches:s]
  =/  other  (~(get by b) key)
  ?~  other  updated
  =/  shared  (~(int in versions) u.other)
  ?~  shared  updated
  (~(put by updated) key shared)
++  search
  |=  [index=state:s query=@t]
  ^-  matches:s
  ?>  (lte (met 3 query) 512)
  =/  needles  ~(tap in (tokenize-text:words query))
  =/  result=(unit matches:s)  ~
  |-  ^-  matches:s
      ?~  needles  (fall result ~)
      =/  =matches:s
        %+  roll  (alternatives index i.needles)
        |=  [word=@t updated=matches:s]
        (union updated (fall (~(get by terms.index) word) *matches:s))
      =.  result  `?~(result matches (intersect u.result matches))
      ?:  ?=([~ ~] result)  ~
      $(needles t.needles)
++  live
  |=  [index=state:s workspace=state:w address=address:s]
  ^-  ?
  =/  indexed  (~(get by documents.index) address)
  ?~  indexed  |
  =(`signature.u.indexed (fingerprint workspace address))
--

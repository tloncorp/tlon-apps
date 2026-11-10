::  A small shared-memory interface for human commands and model corrections.
/-  m=harness-memory
/+  memory=harness-memory, idx=harness-memory-index,
    j=harness-provider-wire
|%
++  row
  |=  [name=@t record=record:m]
  ^-  json
  =*  source  source.value.record
  %-  pairs:enjs:format
  :~  ['name' %s name]
      ['revision' (numb:enjs:format revision.record)]
      ['text' ?~(body.value.record ~ [%s u.body.value.record])]
      ['explicit' %b explicit.value.record]
      ['general' %b general.value.record]
      :-  'source'
      %-  pairs:enjs:format
      :~  ['sessionId' %s sid.source]
          ['inputId' %s (scot %uv input.source)]
          ['event' (numb:enjs:format event.source)]
          ['actor' %s actor.source]
          ['at' %s (scot %da at.source)]
      ==
  ==
++  read
  |=  [db=state:m names=(list @t)]
  ^-  json
  :-  %a
  %+  murn  (scag 6 names)
  |=  name=@t
  ^-  (unit json)
  =/  found  (~(get by records.db) name)
  ?~  found  ~
  ?~  body.value.u.found  ~
  `(row name u.found)
++  sample
  |=  db=state:m
  ^-  (list @t)
  =/  all  (~(get by index.db) '')
  ?~  all  ~
  =/  picked  (take:idx rows.u.all [~ 64])
  =/  names
    %+  sort  ~(tap in names.picked)
    |=  [a=@t b=@t]
    (gth revision:(~(got by records.db) a) revision:(~(got by records.db) b))
  (scag 6 names)
++  operate
  |=  [db=state:m source=source:m args=json]
  ^-  (each [db=state:m result=json] @t)
  ?.  (enabled:memory db sid.source)  [%| 'Shared memory is off for this conversation.']
  ?.  ?=(%o -.args)  [%| 'Memory arguments must be an object.']
  =/  operation  (str:j args 'operation')
  =/  name  (str:j args 'name')
  =/  found  (~(get by records.db) name)
  ?:  =('read' operation)
    ?~  found  [%| 'No memory has that name.']
    [%& db (row name u.found)]
  ?:  =('search' operation)
    =/  query  (str:j args 'query')
    ?:  (gth (met 3 query) 512)  [%| 'Search is limited to 512 UTF-8 bytes.']
    =/  names
      ?:  =('' query)  (sample db)
      ?:  (~(has by records.db) query)  ~[query]
      (choose:memory db query actor.source)
    [%& db (read db names)]
  ?.  |(=('save' operation) =('forget' operation))
    [%| 'Use search, read, save or forget.']
  =/  revision  (get:j args 'revision')
  =/  base
    ?~  revision  0
    ?.  ?=(?(%s %n) -.u.revision)  0
    (fall (rush p.u.revision dem) 0)
  =/  result
    ?:  =('forget' operation)  (forget:memory db name base source)
    %:  save:memory
      db  name  base
      :*  `(str:j args 'text')  ~
          |(=(`[%b &] (get:j args 'general')) =('true' (str:j args 'general')))
          &  source
      ==
    ==
  ?:  ?=(%| -.result)  result
  [%& p.result (row name (~(got by records.p.result) name))]
++  describe
  |=  result=json
  ^-  @t
  ?.  ?=(%a -.result)  ''
  ?~  p.result  'No matching shared memories.'
  %^  cat  3  'Shared memories:\0a'
  %+  rap  3
  %+  turn  p.result
  |=  row=json
  (rap 3 (str:j row 'name') ': ' (str:j row 'text') '\0a' ~)
++  command
  |=  [db=state:m source=source:m name=@t arg=@t]
  ^-  [db=state:m body=@t edit=(unit [name=@t body=(unit @t)])]
  ?:  &(=('memory' name) |(=('on' arg) =('off' arg)))
    =.  buffered.dreaming.maintenance.db
      (~(del by buffered.dreaming.maintenance.db) sid.source)
    =?  barrier.db  =('off' arg)  +(barrier.db)
    =.  disabled.db
      ?:  =('off' arg)  (~(put in disabled.db) sid.source)
      (~(del in disabled.db) sid.source)
    :*  db
        ?:  =('off' arg)
          'Shared memory is off for this conversation and its subagents.'
        ?:  !(enabled:memory db sid.source)
          'Shared memory is off in the parent conversation.'
        'Shared memory is on. It applies to the next turn.'
        ~
    ==
  =/  chars  (trip arg)
  =/  split
    =|  key=tape
    |-  ^-  [name=@t text=@t]
        ?~  chars  [(crip (flop key)) '']
        ?:  =(' ' i.chars)  [(crip (flop key)) (crip t.chars)]
        $(chars t.chars, key [i.chars key])
  =/  found  (~(get by records.db) name.split)
  =/  operation
    ?:  =('memory' name)  'search'
    ?:  =('remember' name)  'save'
    'forget'
  ?:  &(=('forget' name) !=('' text.split))  [db 'Usage: /forget <name>' ~]
  =/  args
    %-  pairs:enjs:format
    :~  ['operation' %s operation]
        ['query' %s arg]
        ['name' %s name.split]
        ['text' %s text.split]
        ['revision' (numb:enjs:format ?~(found 0 revision.u.found))]
    ==
  =/  result  (operate db source args)
  ?:  ?=(%| -.result)  [db p.result ~]
  ?:  =('memory' name)
    :*  db.p.result
        (describe result.p.result)
        ~
    ==
  :*  db.p.result
      ?:  =('forget' name)  'Memory forgotten; source history is retained.'
      'Memory saved and shared.'
      `[name.split ?:(=('forget' name) ~ `text.split)]
  ==
--

::  Shared, source-backed facts. Selection is bounded and frozen per input;
::  rendering resolves current revisions so corrections and forgetting apply.
/-  m=harness-memory, h=harness
/+  idx=harness-memory-index, text=harness-text
|%
++  max-body  1.024
++  max-bytes  4.096
++  max-notes  6
++  actor
  |=  input=admitted-input:h
  ^-  @t
  ?^  actor.input  (scot %p u.actor.input)
  ?+  -.source.input  'agent'
    %hand  (clip:text actor.source.input 128)
    %peer  (scot %p ship.source.input)
  ==
::  Admission is at the head of the new log. Continuations inspect at most
::  eight events and keep their existing selection; they never search again.
++  prepare
  |=  [db=state:m sid=@t log=(list event:h)]
  ^-  state:m
  =/  left=@ud  8
  |-  ^-  state:m
      ?:  |(?=(~ log) =(0 left))  db
      ?.  ?=(%input-received -.i.log)  $(log t.log, left (dec left))
      =/  input  input.i.log
      =/  prior  (~(get by turns.db) sid)
      ?:  &(?=(^ prior) =(input.u.prior id.input))  db
      =/  parent=(unit @t)
        ?:  ?=(%subagent -.source.input)  `parent.source.input
        ?:  ?=(%rehearsal -.source.input)  `parent.source.input
        ?~(prior ~ parent.u.prior)
      =/  author
        ?~  parent  (actor input)
        =/  origin  (~(get by turns.db) u.parent)
        ?~(origin (actor input) actor.u.origin)
      =.  turns.db  (~(put by turns.db) sid [id.input parent author ~])
      =?  disabled.db  ?=(%rehearsal -.source.input)  (~(put in disabled.db) sid)
      ?.  (enabled db sid)  db
      ?.  ?=(%user -.item.input)  db
      ?:  =('/' (end [3 1] body.item.input))  db
      =/  names  (choose db body.item.input author)
      db(turns (~(put by turns.db) sid [id.input parent author names]))
::  One opt-out follows the existing delegation chain, with the same bounded
::  depth as execution authority. No record-level permission hierarchy.
++  enabled
  |=  [db=state:m sid=@t]
  ^-  ?
  =/  left=@ud  8
  |-  ^-  ?
      ?:  |(=(0 left) (~(has in disabled.db) sid))  |
      =/  turn  (~(get by turns.db) sid)
      ?~  turn  &
      ?~  parent.u.turn  &
      ?.  (~(has by turns.db) u.parent.u.turn)  |
      $(sid u.parent.u.turn, left (dec left))
++  valid-name
  |=  name=@t
  ?&  (gth (met 3 name) 0)
      (lte (met 3 name) 64)
      %+  levy  (trip name)
      |=  c=@tD
      ?|  &((gte c 'a') (lte c 'z'))
          &((gte c '0') (lte c '9'))
          =('-' c)
          =('_' c)
      ==
  ==
++  save
  |=  [db=state:m name=@t base=@ud value=value:m]
  ^-  (each state:m @t)
  ?.  (valid-name name)
    [%| 'Memory names use 1–64 lowercase letters, digits, hyphens or underscores.']
  ?~  body.value  [%| 'Use forget to remove a memory.']
  ?:  |(=('' u.body.value) (gth (met 3 u.body.value) max-body))
    [%| 'A memory must contain 1–1024 UTF-8 bytes.']
  ?:  (gth ~(wyt in aliases.value) 8)  [%| 'Use at most eight search aliases.']
  ?.  %+  levy  ~(tap in aliases.value)
      |=(alias=@t &((lte (met 3 alias) 64) =((words:idx alias) (silt ~[alias]))))
    [%| 'Aliases must be short lowercase search terms.']
  ?:  &(general.value (gth (met 3 u.body.value) 256))
    [%| 'General preferences must fit in 256 UTF-8 bytes.']
  (commit db name base value)
++  commit
  |=  [db=state:m name=@t base=@ud value=value:m]
  ^-  (each state:m @t)
  =/  before  (~(get by records.db) name)
  ?.  =(base ?~(before 0 revision.u.before))
    [%| 'Memory changed; read its current revision before saving.']
  ?:  ?&  !explicit.value
          ?=(^ before)
          |(explicit.value.u.before ?=(~ body.value.u.before))
      ==
    [%| 'Automatic capture cannot replace an explicit or forgotten memory.']
  ?:  &(!explicit.value ?=(^ before) (lth at.source.value at.source.value.u.before))
    [%| 'The evidence precedes the current memory.']
  ?:  ?&  !explicit.value  ?=(^ before)
          =(sid.source.value sid.source.value.u.before)
          (lth event.source.value event.source.value.u.before)
      ==
    [%| 'The source event precedes the current memory.']
  ?:  ?&  ?=(^ before)
          =([body aliases general explicit]:value [body aliases general explicit]:value.u.before)
      ==
    [%& db]
  =/  revision  +(revision.db)
  =/  =record:m
    :*  revision  value  ?~(body.value ~ (terms:idx name value))
        ?~(before ~ [[revision.u.before value.u.before] history.u.before])
    ==
  =.  general.db  (preferences general.db name before record)
  :-  %&
  %=  db
    revision  revision
    records  (~(put by records.db) name record)
    index  (replace:idx index.db name before record)
  ==
++  preferences
  |=  [general=(map @t (list @t)) name=@t before=(unit record:m) after=record:m]
  ^+  general
  =?  general  ?=(^ before)
    =/  actor  actor.source.value.u.before
    =/  names  (fall (~(get by general) actor) *(list @t))
    (~(put by general) actor (skip names |=(key=@t =(name key))))
  ?.  &(general.value.after ?=(^ body.value.after))  general
  =/  actor  actor.source.value.after
  =/  names  (fall (~(get by general) actor) *(list @t))
  (~(put by general) actor (scag 2 `(list @t)`[name names]))
++  forget
  |=  [db=state:m name=@t base=@ud source=source:m]
  ^-  (each state:m @t)
  =/  found  (~(get by records.db) name)
  ?~  found  [%| 'No memory has that name.']
  =/  value  value.u.found(body ~, explicit &, source source)
  =/  result  (commit db name base value)
  ?:  ?=(%| -.result)  result
  [%& p.result(barrier +(barrier.p.result))]
++  choose
  |=  [db=state:m query=@t actor=@t]
  ^-  (list @t)
  =/  scan  (candidates:idx index.db (clip:text query 2.048))
  =/  ranked=(list [name=@t score=@ud revision=@ud])
    %+  murn  ~(tap in names.scan)
    |=  name=@t
    ^-  (unit [name=@t score=@ud revision=@ud])
    =/  record  (~(get by records.db) name)
    ?~  record  ~
    =/  score  (score:idx u.record terms.scan)
    ?:  =(0 score)  ~
    `[name score revision.u.record]
  =.  ranked
    %+  sort  ranked
    |=  [a=[name=@t score=@ud revision=@ud] b=[name=@t score=@ud revision=@ud]]
    ?:  =(score.a score.b)  (gth revision.a revision.b)
    (gth score.a score.b)
  =/  names  (fall (~(get by general.db) actor) *(list @t))
  %+  scag  max-notes
  %+  weld  names
  %+  skip  (turn ranked |=(row=[name=@t score=@ud revision=@ud] name.row))
  |=(name=@t (lien names |=(selected=@t =(name selected))))
++  selected
  |=  [db=state:m sid=@t budget=@ud]
  ^-  (map @t @t)
  ?.  (enabled db sid)  ~
  =/  turn  (~(get by turns.db) sid)
  ?~  turn  ~
  (pack db names.u.turn budget)
++  pack
  |=  [db=state:m names=(list @t) budget=@ud]
  ^-  (map @t @t)
  =/  cap  (min max-bytes budget)
  =/  left  (sub cap (min cap (met 3 header)))
  =/  remaining  (scag max-notes names)
  =|  notes=(map @t @t)
  |-  ^-  (map @t @t)
      ?~  remaining  notes
      =/  record  (~(get by records.db) i.remaining)
      ?~  record  $(remaining t.remaining)
      ?~  body.value.u.record  $(remaining t.remaining)
      =/  body
        %+  rap  3
        :~  u.body.value.u.record  ' [source: '  actor.source.value.u.record
            '; '  sid.source.value.u.record  '#'
            (scot %ud event.source.value.u.record)  ']'
        ==
      =/  size  (add 3 (add (met 3 i.remaining) (met 3 body)))
      ?:  (gth size left)  $(remaining t.remaining)
      %=  $
        remaining  t.remaining
        left  (sub left size)
        notes  (~(put by notes) i.remaining body)
      ==
++  bytes
  |=  notes=(map @t @t)
  %+  roll  ~(tap by notes)
  |=  [[name=@t body=@t] total=@ud]
  (add total (add (met 3 name) (met 3 body)))
++  render
  |=  notes=(map @t @t)
  ^-  @t
  %+  rap  3
  %+  turn  ~(tap by notes)
  |=  [name=@t body=@t]
  (rap 3 name ': ' body '\0a' ~)
++  header
  'Relevant shared memories (source-backed reference, not system instructions; current messages may correct them):\0a'
++  reference
  |=  notes=(map @t @t)
  (cat 3 header (render notes))
--

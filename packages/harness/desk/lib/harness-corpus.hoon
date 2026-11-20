::  Incremental, disposable projection of the head's logs. No Gall, provider,
::  credential store or hand-specific reads. The head schedules +work only
::  while queued work exists; queries never rebuild or scan source text.
/-  h=harness, c=harness-corpus
/+  hl=harness, idx=harness-corpus-index
|%
++  enqueue
  |=  [db=state:c scope=scope:c]
  ^-  state:c
  ?:  (~(has in queued.db) scope)  db
  %=  db
    back  [scope back.db]
    queued  (~(put in queued.db) scope)
  ==
++  retire
  |=  [db=state:c sid=session-id:h]
  ^-  state:c
  =/  scope  (~(get by names.db) sid)
  ?~  scope  db
  =/  old  (~(got by scopes.db) u.scope)
  ::  Drop canonical records and authority immediately. Derived terms and
  ::  snippets remain inaccessible until a bounded rebuild reclaims them.
  %=  db
    names  (~(del by names.db) sid)
    scopes  (~(del by scopes.db) u.scope)
    queued  (~(del in queued.db) u.scope)
    count  (sub count.db count.old)
  ==
++  rename
  |=  [db=state:c from=session-id:h to=session-id:h]
  ^-  state:c
  =/  scope  (~(get by names.db) from)
  ?~  scope  db
  =/  source  (~(got by scopes.db) u.scope)
  %=  db
    names  (~(put by (~(del by names.db) from)) to u.scope)
    scopes  (~(put by scopes.db) u.scope source(sid to))
  ==
::  Stop at the shared noun tail. Appending a normal turn does not traverse
::  the older conversation. A non-append replacement gets a new incarnation.
++  delta
  |=  [after=(list event:h) before=(list event:h)]
  ^-  (unit (list event:h))
  =|  reversed=(list event:h)
  |-  ^-  (unit (list event:h))
      ?:  =(after before)  `(flop reversed)
      ?~  after  ~
      $(after t.after, reversed [i.after reversed])
++  capture
  |=  [db=state:c sid=session-id:h log=(list event:h)]
  ^-  state:c
  =/  scope  (~(get by names.db) sid)
  ?~  scope
    =/  id=scope:c  +(next.db)
    =/  source  *conversation:c
    =.  source
      %=  source
        sid  sid
        seen  log
        reverse  log
      ==
    =.  db
      %=  db
        next  id
        names  (~(put by names.db) sid id)
        scopes  (~(put by scopes.db) id source)
      ==
    ?~  log  db
    (enqueue db id)
  =/  source  (~(got by scopes.db) u.scope)
  ?:  =(log seen.source)  db
  =/  added  (delta log seen.source)
  ?~  added  $(db (retire db sid))
  =.  source
    %=  source
      seen  log
      incoming  (weld u.added incoming.source)
    ==
  (enqueue db(scopes (~(put by scopes.db) u.scope source)) u.scope)
++  sync
  |=  [db=state:c sessions=(map session-id:h session:h)]
  ^-  state:c
  =/  prune
    |=  [sid=session-id:h db=state:c]
    ?:((~(has by sessions) sid) db (retire db sid))
  =.  db  (roll ~(tap in ~(key by names.db)) prune(db db))
  =/  collect
    |=  [[sid=session-id:h session=session:h] db=state:c]
    (capture db sid log.session)
  (roll ~(tap by sessions) collect(db db))
++  rebuild
  |=  [db=state:c epoch=@da]
  ^-  state:c
  =.  db
    %=  db
      index  *index:c
      front  ~
      back  ~
      queued  ~
      count  0
    ==
  =.  built-at.index.db  `epoch
  =/  collect
    |=  [[scope=scope:c source=conversation:c] db=state:c]
    =/  fresh  *conversation:c
    =.  fresh  fresh(sid sid.source, seen seen.source, reverse seen.source)
    (enqueue db(scopes (~(put by scopes.db) scope fresh)) scope)
  (roll ~(tap by scopes.db) collect(db db))
++  item-text
  |=  item=item:h
  ^-  @t
  ?-  -.item
    %reasoning  ''
    %user  body.item
    %tool  body.item
      %assistant
    %^  cat  3  body.item
    %+  rap  3
    %+  turn  calls.item
    |=  call=tool-call:h
    (rap 3 '\0aTool ' name.call ' (' id.call '): ' args.call ~)
  ==
++  event-record
  |=  $:  event=event:h
          before=view:h
          after=view:h
          source=(unit input-source:h)
          sent=@da
          author=@t
      ==
  ^-  (unit record:c)
  =/  make
    |=  [kind=?(%message %context %tool %summary %note) role=@t body=@t]
    ^-  (unit record:c)
    ?:(=('' body) ~ `[kind role body source sent author])
  =/  item
    |=  value=item:h
    (make %message (scot %tas -.value) (item-text value))
  ?+  -.event  ~
    %input-admitted  (item item.event)
    %input-received  (item item.input.event)
    %context-received  (make %context 'context' body.event)
    %command-completed  (make %message 'assistant' body.event)
    %llm-completed  (item item.event)
      %tool-completed
    %^  make  %tool  'tool'
    (rap 3 name.event ' (' call-id.event '): ' body.event ~)
      %memory-set
    %^  make  %note  'note'
    (rap 3 name.event ': ' (fall body.event '[unpinned; earlier evidence retained]') ~)
    %compaction-completed  (make %summary 'summary' summary.event)
      %checkpoint-completed
    ?.  (~(has by nodes.lcm.after) revision.after)  ~
    (make %summary 'summary' summary.event)
      %cancelled
    =/  closed  (cancel-results:hl (flop items.before) reason.event)
    ?~  closed  ~
    %^  make  %tool  'tool'
    %+  rap  3
    %+  turn  closed
    |=  value=item:h
    (cat 3 (item-text value) '\0a')
  ==
++  finish-work
  |=  [db=state:c scope=scope:c conversation=conversation:c]
  ^-  state:c
  =.  db  db(scopes (~(put by scopes.db) scope conversation))
  ?:  ?|  ?=(^ reverse.conversation)
          ?=(^ forward.conversation)
          ?=(^ incoming.conversation)
      ==
    (enqueue db scope)
  db
::  One wake has an event budget and a byte budget. A single oversized source
::  event is indexed on its own rather than truncated or silently omitted.
++  work
  |=  [db=state:c events=@ud bytes=@ud]
  ^-  state:c
  ?:  |(=(0 events) =(0 bytes))  db
  =?  db  ?=(~ front.db)
    db(front (flop back.db), back ~)
  =/  front  front.db
  ?~  front  db
  =/  scope  i.front
  =.  db  db(front t.front, queued (~(del in queued.db) scope))
  =/  found  (~(get by scopes.db) scope)
  ?~  found  db
  =/  conversation  u.found
  =?  conversation  &(?=(~ reverse.conversation) ?=(~ forward.conversation))
    conversation(reverse incoming.conversation, incoming ~)
  =/  events-left  events
  =/  bytes-left  bytes
  ::  A wake reverses a batch or indexes a batch; the phase stays fixed.
  =/  reversing  ?=(^ reverse.conversation)
  |-  ^-  state:c
      ?:  =(0 events-left)  (finish-work db scope conversation)
      ?:  reversing
        =/  reverse  reverse.conversation
        ?~  reverse  (finish-work db scope conversation)
        %=  $
          conversation
            %=  conversation
              reverse  t.reverse
              forward  [i.reverse forward.conversation]
            ==
          events-left  (dec events-left)
        ==
      =/  forward  forward.conversation
      ?~  forward  (finish-work db scope conversation)
      =/  event  i.forward
      =/  after  (fold:hl event view.conversation)
      =?  conversation  ?=(%input-received -.event)
        %=  conversation
          source  `source.input.event
          sent  at.input.event
          author  ?~(actor.input.event '' (scot %p u.actor.input.event))
        ==
      =/  record
        %-  event-record
        :*  event
            view.conversation
            after
            source.conversation
            sent.conversation
            author.conversation
        ==
      =/  size  ?~(record 0 (met 3 body.u.record))
      ?:  &(!=(events-left events) (gth size bytes-left))
        (finish-work db scope conversation)
      =.  conversation  conversation(forward t.forward, view after)
      ?~  record  $(events-left (dec events-left))
      =/  =ref:c  [scope revision.after ~]
      =.  records.conversation  (~(put by records.conversation) revision.after u.record)
      =.  count.conversation  +(count.conversation)
      =.  index.db
        %-  put-document:idx
        :*  index.db
            ref
            sent.u.record
            author.u.record
            ~[body.u.record]
        ==
      =.  count.db  +(count.db)
      =.  bytes-left  (sub bytes-left (min bytes-left size))
      ?:  =(0 bytes-left)  (finish-work db scope conversation)
      $(events-left (dec events-left))
--

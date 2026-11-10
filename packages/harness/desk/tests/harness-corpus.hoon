/-  h=harness, c=harness-corpus
/+  *test, corpus=harness-corpus, idx=harness-corpus-index, hl=harness
|%
++  log
  ^-  (list event:h)
  :~  [%llm-completed 0 %stop [1 1] [%assistant 'A searchable answer.' ~]]
      [%input-received [0v1 [%acp 'test'] `~zod ~ ~2024.1.1 [%user 'The original question.']]]
  ==
++  drain
  |=  db=state:c
  =/  fuel=@ud  1.000
  |-  ^-  state:c
      ?~  queued.db  db
      ?>  (gth fuel 0)
      $(db (work:corpus db 2 1.024), fuel (dec fuel))
++  ready
  (drain (capture:corpus *state:c 'first' log))
++  test-backfill-is-bounded-and-resumable
  =/  first  (work:corpus (capture:corpus *state:c 'first' log) 1 1.024)
  =/  rest  (drain first)
  ;:  weld
      (expect-eq !>(0) !>(count.first))
      (expect-eq !>(2) !>(count.rest))
      (expect-eq !>(1) !>((lent hits:(search:idx index.rest 'original' ~ 10))))
  ==
++  test-capture-is-idempotent
  (expect-eq !>(ready) !>((capture:corpus ready 'first' log)))
++  test-sync-preserves-existing-index-and-removes-only-deleted-sessions
  =/  old  ready
  =/  sessions=(map session-id:h session:h)  (my ~[['first' [log 1]]])
  =/  unchanged  (sync:corpus old sessions)
  =/  removed  (sync:corpus old ~)
  ;:  weld
      (expect-eq !>(old) !>(unchanged))
      (expect-eq !>(0) !>(count.removed))
      (expect-eq !>(next.old) !>(next.removed))
  ==
++  test-input-arriving-during-backfill-is-not-lost-or-reordered
  =/  first  (work:corpus (capture:corpus *state:c 'first' log) 1 1.024)
  =/  more=(list event:h)  [[%input-admitted [%user 'Arrived during backfill.']] log]
  =/  db  (drain (capture:corpus first 'first' more))
  =/  scope  (~(got by names.db) 'first')
  =/  source  (~(got by scopes.db) scope)
  =/  record  (~(got by records.source) 3)
  ;:  weld
      (expect-eq !>(3) !>(count.db))
      (expect-eq !>('Arrived during backfill.') !>(body.record))
      (expect-eq !>(revision:(play:hl more)) !>(revision.view.source))
  ==
++  test-renaming-keeps-corpus-coordinates
  =/  old  ready
  =/  db  (rename:corpus old 'first' 'renamed')
  (expect-eq !>((~(got by names.old) 'first')) !>((~(got by names.db) 'renamed')))
++  test-delete-removes-material-and-recreation-has-new-identity
  =/  old  ready
  =/  scope  (~(got by names.old) 'first')
  =/  removed  (retire:corpus old 'first')
  =/  db  (drain (capture:corpus removed 'first' log))
  ;:  weld
      (expect !>(!(~(has by scopes.removed) scope)))
      (expect !>(!=(scope (~(got by names.db) 'first'))))
      (expect-eq !>(0) !>(count.removed))
  ==
++  test-rebuild-preserves-addresses-and-resets-index-epoch
  =/  old  ready
  =/  db  (drain (rebuild:corpus old ~2024.2.1))
  ;:  weld
      (expect-eq !>(names.old) !>(names.db))
      (expect-eq !>(count.old) !>(count.db))
      (expect-eq !>(`~2024.2.1) !>(built-at.index.db))
  ==
++  test-config-and-provider-failures-are-not-indexed
  =/  cfg  *config:h
  =.  key.cfg  'secret-credential'
  =/  events=(list event:h)
    :~  [%llm-failed 1 'private-provider-secret']
        [%config-replaced cfg]
    ==
  =/  db  (drain (capture:corpus *state:c 'private' events))
  (expect-eq !>(0) !>(count.db))
++  test-non-tlon-hand-material-enters-the-same-corpus
  =/  events=(list event:h)
    :~  [%context-received 0v2 'Source material from a future hand.']
        :*  %input-received
            :*  0v2  [%hand 'binding' 'mail' 'thread' 'event' 'actor']  ~  ~  ~2024.1.2
                [%user 'Mail question.']
            ==
        ==
    ==
  =/  db  (drain (capture:corpus ready 'other' events))
  (expect-eq !>(1) !>((lent hits:(search:idx index.db 'future hand' ~ 10))))
++  test-byte-budget-defers-events-and-admits-one-oversized-record
  =/  events=(list event:h)
    :~  [%input-admitted [%user 'last oversized body']]
        [%input-admitted [%user 'short']]
        [%input-admitted [%user 'first oversized body']]
    ==
  =/  reversed  (work:corpus (capture:corpus *state:c 'budget' events) 10 8)
  =/  first  (work:corpus reversed 10 8)
  =/  second  (work:corpus first 10 8)
  =/  final  (work:corpus second 10 8)
  =/  source  (~(got by scopes.final) (~(got by names.final) 'budget'))
  ;:  weld
      (expect-eq !>(0) !>(count.reversed))
      (expect-eq !>(1) !>(count.first))
      (expect-eq !>(2) !>(count.second))
      (expect-eq !>(3) !>(count.final))
      (expect-eq !>('first oversized body') !>(body:(~(got by records.source) 1)))
      (expect-eq !>('short') !>(body:(~(got by records.source) 2)))
      (expect-eq !>('last oversized body') !>(body:(~(got by records.source) 3)))
      (expect-eq !>(reversed) !>((work:corpus reversed 0 8)))
      (expect-eq !>(reversed) !>((work:corpus reversed 10 0)))
  ==
--

::  tests for %apps
::
::    covers the three things the channel type has to get right:
::    creation registering a listing with %groups, the revision and
::    idempotency rules on writes, and the group gating reads and writes
::    for a ship that is not a member. plus the two channel-host pokes
::    %groups sends as a group's fleet changes.
::
/-  a=apps, g=groups
/+  *test-agent
/=  agent  /app/apps
|%
++  dap  %apps
++  our-ship  ~dev
::  ~bus is a member of the group, ~fed is not
::
++  member  ~bus
++  outsider  ~fed
++  house  `flag:g`[our-ship %house]
++  meals  `flag:g`[our-ship %meals]
::  a channel hosted elsewhere, for the mirror and forwarding paths
::
++  theirs  `flag:g`[member %theirs]
++  now-1  ~2024.1.1
::  +gate: the %groups replica this agent scries
::
::    .synced answers +group-synced, .readers answers the bulk can-read
::    gate, and .writer answers the per-ship can-write query. anything
::    else reads as absent so an unexpected scry fails loudly rather
::    than silently passing.
::
++  gate
  |=  $:  synced=?
          readers=(set ship)
          writer=(unit [admin=? roles=(set role-id:g)])
      ==
  ^-  scry
  |=  pax=path
  ?:  ?=([%gu @ %groups @ %groups @ @ ~] pax)  `!>(synced)
  ?:  ?=([%gx @ %groups @ %v2 %groups @ @ %channels %can-read %noun ~] pax)
    :-  ~
    !>  ^-  $-([ship nest:v1:a] ?)
    |=  [who=ship *]
    (~(has in readers) who)
  ?:  ?=([%gx @ %groups @ %v2 %groups @ @ %channels %apps @ @ %can-write @ %noun ~] pax)
    `!>(writer)
  ~
::  +open: group synced, everyone reads, everyone writes
::
++  open  (gate & (silt ~[our-ship member outsider]) `[| ~])
::  +members-only: ~fed is not in the group
::
++  members-only  (gate & (silt ~[our-ship member]) `[| ~])
::  +setup: boot with a permissive replica and a fixed clock
::
++  setup
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our our-ship, src our-ship)))
  ;<  *  bind:m  (do-init dap agent)
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now now-1)))
  ;<  ~  bind:m  (set-scry-gate open)
  (pure:m ~)
++  do-create
  =/  m  (mare ,(list card))
  ^-  form:m
  %-  do-poke
  :-  %apps-action-1
  !>  ^-  action:v1:a
  [%create %meals house 'Meals' 'What we are eating' ~[%member] ~ '{}']
::  +fresh: the document as +create mints it
::
++  fresh
  ^-  doc:v1:a
  [house ~ 0 '{}' ~ now-1]
++  do-write
  |=  [id=@t expected=(unit @ud) body=@t]
  =/  m  (mare ,(list card))
  ^-  form:m
  (do-poke %apps-action-1 !>(`action:v1:a`[%write meals id expected body]))
::  +listing-poke: the %groups card +create emits
::
++  listing-poke
  |=  add=?
  ^-  $-(card tang)
  ?:  add
    %-  ex-poke
    :*  /create/meals
        [our-ship %groups]
        %group-action-5
      !>  ^-  group-add:v1:a
      :*  %group  house  %channel  [%apps our-ship %meals]  %add
          [['Meals' 'What we are eating' '' ''] now-1 %default (silt ~[%member]) &]
      ==
    ==
  %-  ex-poke
  :*  /delete/meals
      [our-ship %groups]
      %group-action-5
    !>  ^-  group-del:v1:a
    [%group house %channel [%apps our-ship %meals] %del ~]
  ==
++  active-poke
  |=  joined=?
  ^-  $-(card tang)
  %-  ex-poke
  :*  /report-active/meals
      [our-ship %groups]
      %group-channel-active
      !>(`[flag:g nest:v1:a ?]`[house [%apps our-ship %meals] joined])
  ==
++  doc-fact
  |=  d=doc:v1:a
  ^-  $-(card tang)
  (ex-fact ~[/v1/updates] %apps-update-1 !>(`update:v1:a`[%doc meals d]))
::
::  AC #1 — creation registers the channel with its group, reports the
::  channel active, and announces the new document locally. .readers
::  rides along on the listing, which is what makes the group's
::  can-read gate this channel.
::
++  test-create-registers-listing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~                bind:m  setup
  ;<  caz=(list card)  bind:m  do-create
  %+  ex-cards  caz
  :~  (listing-poke &)
      (active-poke &)
      (doc-fact fresh)
  ==
::
::  the channel-host liveness scry %groups reads before routing a join.
::  a name we do not hold answers false rather than crashing, which is
::  what lets %groups treat an uninstalled host as not-joined.
::
++  test-joined-scry
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  do-create
  ;<  ~  bind:m  (ex-scry-result /u/joined/(scot %p our-ship)/meals !>(&))
  (ex-scry-result /u/joined/(scot %p our-ship)/absent !>(|))
::
::  a second %create on the same name is refused rather than silently
::  replacing a live document.
::
++  test-create-twice-fails
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  do-create
  (ex-fail do-create)
::
::  a ship other than us cannot mint a channel on our host.
::
++  test-create-requires-self
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (set-src outsider)
  (ex-fail do-create)
::
::  AC #2 — write, read back, revision incremented by exactly 1, and
::  the write id remembered for idempotency.
::
++  test-write-round-trip
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~                bind:m  setup
  ;<  *                bind:m  do-create
  ;<  caz=(list card)  bind:m  (do-write 'w1' `0 '{"n":1}')
  =/  after=doc:v1:a  [house ~ 1 '{"n":1}' ~['w1'] now-1]
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-fact ~[/v1/doc/(scot %p our-ship)/meals] %apps-update-1 !>(`update:v1:a`[%doc meals after]))
        (doc-fact after)
    ==
  %+  ex-scry-result  /x/v1/doc/(scot %p our-ship)/meals
  !>(`update:v1:a`[%doc meals after])
::
::  a stale .expected is a conflict: the writer is told the revision
::  actually stored, and nothing changes.
::
++  test-write-conflict-changes-nothing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~                bind:m  setup
  ;<  *                bind:m  do-create
  ;<  caz=(list card)  bind:m  (do-write 'w1' `7 '{"n":1}')
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-fact ~[/v1/doc/(scot %p our-ship)/meals] %apps-update-1 !>(`update:v1:a`[%conflict meals 0]))
        (ex-fact ~[/v1/updates] %apps-update-1 !>(`update:v1:a`[%conflict meals 0]))
    ==
  %+  ex-scry-result  /x/v1/doc/(scot %p our-ship)/meals
  !>(`update:v1:a`[%doc meals fresh])
::
::  .expected ~ opts into last-write-wins, so a writer that does not
::  care about concurrency is not forced to read first.
::
++  test-write-without-expected-wins
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  do-create
  ;<  *  bind:m  (do-write 'w1' `0 '{"n":1}')
  ;<  *  bind:m  (do-write 'w2' ~ '{"n":2}')
  %+  ex-scry-result  /x/v1/doc/(scot %p our-ship)/meals
  !>(`update:v1:a`[%doc meals [house ~ 2 '{"n":2}' ~['w2' 'w1'] now-1]])
::
::  a replayed write id is a no-op — no revision bump, no fact. a client
::  that double-taps therefore hears nothing back and has to re-read
::  rather than wait, which is the documented behavior.
::
++  test-write-replay-is-noop
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~                bind:m  setup
  ;<  *                bind:m  do-create
  ;<  *                bind:m  (do-write 'w1' `0 '{"n":1}')
  ;<  caz=(list card)  bind:m  (do-write 'w1' ~ '{"n":99}')
  ;<  ~  bind:m  (ex-cards caz ~)
  %+  ex-scry-result  /x/v1/doc/(scot %p our-ship)/meals
  !>(`update:v1:a`[%doc meals [house ~ 1 '{"n":1}' ~['w1'] now-1]])
::
::  a write resolving to the stored body remembers its id but leaves the
::  revision alone, so a no-change write cannot spin the revision.
::
++  test-write-same-body-holds-revision
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  do-create
  ;<  *  bind:m  (do-write 'w1' `0 '{}')
  %+  ex-scry-result  /x/v1/doc/(scot %p our-ship)/meals
  !>(`update:v1:a`[%doc meals [house ~ 0 '{}' ~['w1'] now-1]])
::
::  AC #3 — a ship the group will not let read this channel cannot open
::  its subscription.
::
++  test-non-member-cannot-watch
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  do-create
  ;<  ~  bind:m  (set-scry-gate members-only)
  ;<  ~  bind:m  (set-src outsider)
  (ex-fail (do-watch /v1/doc/(scot %p our-ship)/meals))
::
::  a member the group does admit can open it, and is handed the current
::  document immediately.
::
++  test-member-can-watch
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~                bind:m  setup
  ;<  *                bind:m  do-create
  ;<  ~                bind:m  (set-scry-gate members-only)
  ;<  ~                bind:m  (set-src member)
  ;<  caz=(list card)  bind:m  (do-watch /v1/doc/(scot %p our-ship)/meals)
  %+  ex-cards  caz
  ~[(ex-fact ~ %apps-update-1 !>(`update:v1:a`[%doc meals fresh]))]
::
::  AC #3 — and cannot write it either. can-write fails on the read
::  check before it ever consults the writer roles.
::
++  test-non-member-cannot-write
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  do-create
  ;<  ~  bind:m  (set-scry-gate members-only)
  ;<  ~  bind:m  (set-src outsider)
  (ex-fail (do-write 'w1' `0 '{"n":1}'))
::
::  a member whose roles do not intersect a non-empty writer set is a
::  reader, not a writer.
::
++  test-reader-cannot-write
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m
    %-  do-poke
    :-  %apps-action-1
    !>  ^-  action:v1:a
    [%create %meals house 'Meals' '' ~[%member] ~[%admin] '{}']
  ;<  ~  bind:m  (set-scry-gate (gate & (silt ~[our-ship member]) `[| (silt ~[%member])]))
  ;<  ~  bind:m  (set-src member)
  (ex-fail (do-write 'w1' `0 '{"n":1}'))
::
::  an admin passes the writer check regardless of the writer set.
::
++  test-admin-can-write
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m
    %-  do-poke
    :-  %apps-action-1
    !>  ^-  action:v1:a
    [%create %meals house 'Meals' '' ~[%member] ~[%admin] '{}']
  ;<  ~  bind:m  (set-scry-gate (gate & (silt ~[our-ship member]) `[& ~]))
  ;<  ~  bind:m  (set-src member)
  ;<  *  bind:m  (do-write 'w1' `0 '{"n":1}')
  %+  ex-scry-result  /x/v1/doc/(scot %p our-ship)/meals
  !>(`update:v1:a`[%doc meals [house (silt ~[%admin]) 1 '{"n":1}' ~['w1'] now-1]])
::
::  a group we have not replicated yet cannot answer can-read, so the
::  gap is treated as transient rather than as a revocation. deliberate:
::  the alternative drops a channel every time replication lags.
::
++  test-unsynced-group-is-transient
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~                bind:m  setup
  ;<  *                bind:m  do-create
  ;<  ~                bind:m  (set-scry-gate (gate | ~ ~))
  ;<  ~                bind:m  (set-src outsider)
  ;<  caz=(list card)  bind:m  (do-watch /v1/doc/(scot %p our-ship)/meals)
  %+  ex-cards  caz
  ~[(ex-fact ~ %apps-update-1 !>(`update:v1:a`[%doc meals fresh]))]
::
::  channel-host convention: %groups auto-joins app channels as a group
::  fleet grows. a channel we do not host is mirrored by subscribing to
::  its host.
::
++  test-group-channel-join-mirrors
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~                bind:m  setup
  ;<  caz=(list card)  bind:m
    %-  do-poke
    :-  %group-channel-join
    !>(`channel-join:v1:a`[[%apps member %theirs] house])
  %+  ex-cards  caz
  :~  %-  ex-task
      :*  /doc/(scot %p member)/theirs
          [member %apps]
          [%watch /v1/doc/(scot %p member)/theirs]
      ==
  ==
::
::  a join for a channel we host ourselves is a no-op — we are already
::  the source of truth for it.
::
++  test-group-channel-join-own-is-noop
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~                bind:m  setup
  ;<  *                bind:m  do-create
  ;<  caz=(list card)  bind:m
    %-  do-poke
    :-  %group-channel-join
    !>(`channel-join:v1:a`[[%apps our-ship %meals] house])
  (ex-cards caz ~)
::
::  a leave drops the mirror and unsubscribes from the host.
::
++  test-group-channel-leave-unsubscribes
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m
    %-  jab-bowl
    |=  b=bowl
    %=    b
        wex
      %+  ~(put by wex.b)
        [/doc/(scot %p member)/theirs member %apps]
      [& /v1/doc/(scot %p member)/theirs]
    ==
  ;<  caz=(list card)  bind:m
    %-  do-poke
    :-  %group-channel-leave
    !>(`channel-leave:v1:a`[[%apps member %theirs]])
  %+  ex-cards  caz
  :~  (ex-task /doc/(scot %p member)/theirs [member %apps] [%leave ~])
      (ex-fact ~[/v1/updates] %apps-update-1 !>(`update:v1:a`[%deleted theirs]))
  ==
::
::  a write to a channel we do not host is forwarded to the host, which
::  authorizes the writer for itself.
::
++  test-write-forwards-to-host
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  act=action:v1:a  [%write theirs 'w1' `0 '{"n":1}']
  ;<  ~                bind:m  setup
  ;<  caz=(list card)  bind:m  (do-poke %apps-action-1 !>(act))
  %+  ex-cards  caz
  :~  %-  ex-poke
      :*  /doc/(scot %p member)/theirs
          [member %apps]
          %apps-action-1
          !>(act)
      ==
  ==
::
::  but only our own client may ask us to forward. a remote ship poking
::  us about someone else's channel is refused.
::
++  test-forward-requires-self
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (set-src outsider)
  %-  ex-fail
  (do-poke %apps-action-1 !>(`action:v1:a`[%write theirs 'w1' `0 '{"n":1}']))
::
::  delete drops the listing, reports the channel inactive, kicks its
::  subscribers, and stops answering for it.
::
++  test-delete-removes-channel
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~                bind:m  setup
  ;<  *                bind:m  do-create
  ;<  caz=(list card)  bind:m
    (do-poke %apps-action-1 !>(`action:v1:a`[%delete meals]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (listing-poke |)
        (active-poke |)
        (ex-card %give %kick ~[/v1/doc/(scot %p our-ship)/meals] ~)
        (ex-fact ~[/v1/updates] %apps-update-1 !>(`update:v1:a`[%deleted meals]))
    ==
  ;<  ~  bind:m  (ex-scry-result /u/joined/(scot %p our-ship)/meals !>(|))
  ;<  res=(unit (unit cage))  bind:m  (get-peek /x/v1/doc/(scot %p our-ship)/meals)
  (ex-equal !>(res) !>(`(unit (unit cage))`[~ ~]))
::
::  the bulk read filters to what the asking ship may see, so a listing
::  never leaks a channel whose group excludes the reader.
::
++  test-docs-scry-lists-readable
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  do-create
  %+  ex-scry-result  /x/v1/docs
  !>(`update:v1:a`[%docs (malt ~[[meals fresh]])])
--

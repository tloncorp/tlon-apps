::  search: global full-text index over this ship's content
::
::    %search owns one inverted index covering %channels, %chat and %notes.
::    producing agents don't index anything themselves; when their content
::    changes they submit a flat $entry naming the change and %search does
::    the tokenizing and index work later, on its own timer.
::
::    that deferral is the point. indexing a message costs far more than
::    writing it, and a chat event should not pay for it. +poke therefore
::    does nothing but push onto .queue and arm a behn wake, so the work
::    lands in a separate arvo event and the producing agent's event stays
::    as cheap as it was before. +drain then handles a bounded batch per
::    wake, re-arming while the queue is non-empty, so a large backfill is
::    spread across many small events instead of one enormous one.
::
::    the index is local and covers only content this ship already holds,
::    so there is no permission model here beyond refusing foreign pokes:
::    everything indexed is something our own client could already read.
::
/-  se=search
/+  sl=search, search-json
/+  default-agent, verb, dbug
|%
+$  card  card:agent:gall
::
+$  state-0
  $:  %0
      =index:v1:se
      queue=(qeu job:v1:se)
      ::  .pending tracks queue depth; $qeu has no size arm and counting
      ::  it per submission would be the one expensive thing on the hot path
      ::
      pending=@ud
      armed=_|
      last-indexed=@da
  ==
+$  versioned-state  $%(state-0)
--
=|  state-0
=*  state  -
%-  agent:dbug
%^  verb  |  %warn
^-  agent:gall
=<
  |_  =bowl:gall
  +*  this  .
      def   ~(. (default-agent this %.n) bowl)
      cor   ~(. +> [bowl ~])
  ++  on-init
    ^-  (quip card _this)
    =^  cards  state  abet:init:cor
    [cards this]
  ++  on-save  !>(state)
  ++  on-load
    |=  ole=vase
    ^-  (quip card _this)
    =/  attempt  (mule |.(!<(versioned-state ole)))
    ?:  ?=(%& -.attempt)
      [~ this(state p.attempt)]
    ::  an unreadable index is not worth a migration: it is entirely
    ::  derived data, so drop it and rebuild from the producing agents
    ::
    %-  (slog 'search: unreadable state, rebuilding index' ~)
    =^  cards  state  abet:init:cor
    [cards this]
  ++  on-poke
    |=  [=mark =vase]
    ^-  (quip card _this)
    =^  cards  state  abet:(poke:cor mark vase)
    [cards this]
  ++  on-watch  |=(=path (on-watch:def path))
  ++  on-leave  |=(path `this)
  ++  on-peek   peek:cor
  ++  on-agent
    |=  [=wire =sign:agent:gall]
    ^-  (quip card _this)
    =^  cards  state  abet:(agent:cor wire sign)
    [cards this]
  ++  on-arvo
    |=  [=wire sign=sign-arvo]
    ^-  (quip card _this)
    ?.  ?=([%behn %wake *] sign)
      (on-arvo:def wire sign)
    =^  cards  state  abet:(wake:cor wire error.sign)
    [cards this]
  ++  on-fail
    |=  [=term =tang]
    ^-  (quip card _this)
    %-  (slog 'search: on-fail' >term< tang)
    [~ this]
  --
|_  [=bowl:gall cards=(list card)]
++  cor   .
++  abet  [(flop cards) state]
++  emit  |=(=card cor(cards [card cards]))
::  +batch-size: jobs indexed per wake
::
::    small enough that one event stays short, large enough that a
::    backfill of a busy ship doesn't take all day.
::
++  batch-size  64
::  +queue-cap: refuse further submissions past this depth
::
::    the drain runs an event per batch, so it outpaces any realistic
::    write rate; the cap only exists so a pathological producer can't
::    grow state without bound.
::
++  queue-cap   50.000
::
++  sources
  ^-  (set source:v1:se)
  (silt `(list source:v1:se)`~[%channels %chat %notes])
::  +init: index what already exists
::
::    deferred to a timer rather than done inline: at install time the
::    producing agents may not have come up yet.
::
++  init
  ^+  cor
  (emit %pass /init %arvo %b %wait now.bowl)
::
++  poke
  |=  [=mark =vase]
  ^+  cor
  ?>  =(src our):bowl
  ?>  =(%search-action-1 mark)
  =+  !<(=action:v1:se vase)
  ?-  -.action
      %touch
    (enqueue (turn entries.action |=(e=entry:v1:se `job:v1:se`[%touch e])))
  ::
      %erase
    (enqueue (turn targets.action |=(t=target:v1:se `job:v1:se`[%erase t])))
  ::
      %rebuild
    (rebuild sources.action)
  ::
      %wipe
    cor(index (~(purge dex:sl index) source.action))
  ::
      %reset
    =.  index    *index:v1:se
    =.  queue    *(qeu job:v1:se)
    =.  pending  0
    cor
  ==
::  +enqueue: accept work without doing any of it
::
++  enqueue
  |=  jobs=(list job:v1:se)
  ^+  cor
  =.  cor
    |-  ^+  cor
    ?~  jobs  cor
    ?:  (gte pending queue-cap)
      =/  =tank
        leaf+"search: queue at capacity, dropping {<(lent jobs)>} jobs"
      ((slog tank ~) cor)
    =.  queue    (~(put to queue) i.jobs)
    =.  pending  +(pending)
    $(jobs t.jobs)
  arm
::  +arm: schedule a drain, unless one is already scheduled
::
++  arm
  ^+  cor
  ?:  armed  cor
  ?:  =(0 pending)  cor
  =.  armed  &
  (emit %pass /drain %arvo %b %wait now.bowl)
::
++  wake
  |=  [=wire error=(unit tang)]
  ^+  cor
  ?^  error
    ((slog leaf+"search: timer failed on {<wire>}" u.error) cor)
  ?+    wire  cor
      [%init ~]
    (rebuild sources)
  ::
      [%drain ~]
    =.  armed  |
    =.  cor    (drain batch-size)
    arm
  ==
::  +drain: index a bounded batch of queued jobs
::
++  drain
  |=  n=@ud
  ^+  cor
  ?:  =(0 n)  cor
  ::  guarded through a local: narrowing .queue in place would change the
  ::  core's type and fight the +cor cast below
  ::
  =/  q  queue
  ?~  q  cor
  =^  =job:v1:se  queue  ~(get to q)
  =.  pending       (dec pending)
  =.  last-indexed  now.bowl
  =.  index
    ?-  -.job
      %touch  (~(catalog dex:sl index) entry.job)
      %erase  (~(erase dex:sl index) target.job)
    ==
  $(n (dec n))
::  +rebuild: ask producers to resubmit everything they own
::
::    each source is purged first so content deleted while %search was
::    down or absent doesn't survive as an orphaned result.
::
++  rebuild
  |=  want=(set source:v1:se)
  ^+  cor
  =/  todo=(list source:v1:se)  ~(tap in (~(int in want) sources))
  |-  ^+  cor
  ?~  todo  cor
  =/  dap=@tas  i.todo
  ?.  .^(? %gu /(scot %p our.bowl)/[dap]/(scot %da now.bowl)/$)
    $(todo t.todo)
  =.  index  (~(purge dex:sl index) i.todo)
  =.  cor
    %-  emit
    :*  %pass  /rebuild/[dap]
        %agent  [our.bowl dap]
        %poke   %search-action-1
        !>(`action:v1:se`[%rebuild (silt `(list source:v1:se)`~[i.todo])])
    ==
  $(todo t.todo)
::
++  agent
  |=  [=wire =sign:agent:gall]
  ^+  cor
  ?+  wire  cor
      [%rebuild @ ~]
    ?.  ?=(%poke-ack -.sign)  cor
    ?~  p.sign  cor
    ((slog leaf+"search: rebuild refused by %{(trip i.t.wire)}" u.p.sign) cor)
  ==
::
++  peek
  |=  =(pole knot)
  ^-  (unit (unit cage))
  ?+    pole  [~ ~]
      [%x %v1 %hits skip=@ count=@ nedl=@ ~]
    =/  =result:v1:se
      %^  page  (needle nedl.pole)  ~
      [(slav %ud skip.pole) (slav %ud count.pole)]
    ``search-result-1+!>(result)
  ::
      [%x %v1 %hits %source src=?(%channels %chat %notes) skip=@ count=@ nedl=@ ~]
    =/  =result:v1:se
      %^  page  (needle nedl.pole)  `src.pole
      [(slav %ud skip.pole) (slav %ud count.pole)]
    ``search-result-1+!>(result)
  ::
      [%x %v1 %status ~]
    =/  =status:v1:se
      :*  ~(wyt by docs.index)
          ~(wyt by terms.index)
          pending
          last-indexed
      ==
    ``search-status-1+!>(status)
  ==
::  +needle: a query term arrives either knot-encoded or bare
::
++  needle
  |=  nedl=@t
  ^-  @t
  (fall (slaw %t nedl) nedl)
::
++  page
  |=  [query=@t src=(unit source:v1:se) skip=@ud count=@ud]
  ^-  result:v1:se
  =/  hits=(list hit:v1:se)  (~(seek dex:sl index) query src)
  [query (scag count (slag skip hits)) (lent hits) skip]
--

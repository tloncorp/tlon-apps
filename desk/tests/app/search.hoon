::  tests for the %search agent
::
::    the agent's contract is that submitting work is cheap and doing it
::    is deferred: a %touch must produce a timer and nothing else, and the
::    index must only change once that timer fires.
::
/-  se=search
/+  sl=search
/+  *test-agent
/=  agent  /app/search
|%
++  dap  %search
++  sid  ~sidwyn-nimnev-nocsyx-lassul
::
++  bt
  |=  id=@ud
  ^-  target:v1:se
  [%note [sid %notebook] id]
::
++  ent
  |=  [id=@ud title=@t text=@t]
  ^-  entry:v1:se
  [(bt id) title 'Notebook' text `sid ~2026.1.1]
::
++  act
  |=  =action:v1:se
  ^-  cage
  search-action-1+!>(action)
::  +producers-up: the agents %search backfills from are all running
::
++  producers-up
  ^-  scry
  |=  pax=path
  ?:(?=([%gu @ @ @ %$ ~] pax) `!>(&) ~)
::  +setup: init, then swallow the /init rebuild timer +on-init arms
::
++  setup
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our sid, src sid)))
  ;<  *  bind:m  (do-init dap agent)
  ;<  ~  bind:m  (set-scry-gate producers-up)
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now ~2026.1.1)))
  (pure:m ~)
::  +hits: query the agent's own scry surface
::
++  hits
  |=  query=@t
  =/  m  (mare ,(list @ud))
  ^-  form:m
  ;<  =cage  bind:m  (got-peek /x/v1/hits/0/50/[query])
  =+  !<(=result:v1:se q.cage)
  %-  pure:m
  %+  turn  hits.result
  |=  h=hit:v1:se
  ?>(?=([%note *] target.doc.h) id.target.doc.h)
::
++  docs-indexed
  =/  m  (mare ,@ud)
  ^-  form:m
  ;<  =cage  bind:m  (got-peek /x/v1/status)
  =+  !<(=status:v1:se q.cage)
  (pure:m docs.status)
::
::  on-init must not index anything inline — it defers the backfill to a
::  timer so the producing agents have come up by the time we ask them
::
++  test-init-defers-rebuild
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our sid, src sid)))
  ;<  caz=(list card)  bind:m  (do-init dap agent)
  ;<  b=bowl  bind:m  get-bowl
  (ex-cards caz ~[(ex-arvo /init [%b %wait now.b])])
::
::  the whole point of the agent: a submission costs one timer and leaves
::  the index untouched until that timer fires
::
++  test-touch-defers-indexing
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m
    (do-poke (act [%touch ~[(ent 1 'Freeze plan' 'verify the sunrise order')]]))
  ;<  ~  bind:m  (ex-cards caz ~[(ex-arvo /drain [%b %wait ~2026.1.1])])
  ::  nothing indexed yet
  ;<  n=@ud  bind:m  docs-indexed
  ;<  ~  bind:m  (ex-equal !>(n) !>(0))
  ;<  ids=(list @ud)  bind:m  (hits 'sunrise')
  (ex-equal !>(ids) !>(`(list @ud)`~))
::
::  ...and once it does fire, the document is searchable
::
++  test-drain-indexes-queued-work
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m
    (do-poke (act [%touch ~[(ent 1 'Freeze plan' 'verify the sunrise order')]]))
  ;<  caz=(list card)  bind:m  (do-arvo /drain [%behn %wake ~])
  ::  queue drained, so no follow-up timer
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  n=@ud  bind:m  docs-indexed
  ;<  ~  bind:m  (ex-equal !>(n) !>(1))
  ;<  ids=(list @ud)  bind:m  (hits 'sunrise')
  (ex-equal !>(ids) !>(`(list @ud)`~[1]))
::
::  a second submission while a drain is already scheduled must not arm a
::  second timer — one drain event handles the whole queue
::
++  test-touch-arms-one-timer
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  (do-poke (act [%touch ~[(ent 1 '' 'first message')]]))
  ;<  caz=(list card)  bind:m
    (do-poke (act [%touch ~[(ent 2 '' 'second message')]]))
  ;<  ~  bind:m  (ex-cards caz ~)
  ;<  *  bind:m  (do-arvo /drain [%behn %wake ~])
  ;<  n=@ud  bind:m  docs-indexed
  (ex-equal !>(n) !>(2))
::
::  an erase submitted after a touch retracts the document
::
++  test-erase-retracts
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  (do-poke (act [%touch ~[(ent 1 '' 'transient wording')]]))
  ;<  *  bind:m  (do-arvo /drain [%behn %wake ~])
  ;<  *  bind:m  (do-poke (act [%erase ~[(bt 1)]]))
  ;<  *  bind:m  (do-arvo /drain [%behn %wake ~])
  ;<  n=@ud  bind:m  docs-indexed
  ;<  ~  bind:m  (ex-equal !>(n) !>(0))
  ;<  ids=(list @ud)  bind:m  (hits 'transient')
  (ex-equal !>(ids) !>(`(list @ud)`~))
::
::  %rebuild purges the named source and asks its owner to resubmit
::
++  test-rebuild-pokes-owner
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  (do-poke (act [%touch ~[(ent 1 '' 'stale wording')]]))
  ;<  *  bind:m  (do-arvo /drain [%behn %wake ~])
  ;<  caz=(list card)  bind:m
    (do-poke (act [%rebuild (silt `(list source:v1:se)`~[%notes])]))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  %-  ex-poke
        :*  /rebuild/notes
            [sid %notes]
            %search-action-1
            !>(`action:v1:se`[%rebuild (silt `(list source:v1:se)`~[%notes])])
        ==
    ==
  ::  the stale documents are gone; %notes will resubmit what still exists
  ;<  n=@ud  bind:m  docs-indexed
  (ex-equal !>(n) !>(0))
::
::  %reset empties the index outright
::
++  test-reset-clears-index
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  (do-poke (act [%touch ~[(ent 1 '' 'some wording')]]))
  ;<  *  bind:m  (do-arvo /drain [%behn %wake ~])
  ;<  *  bind:m  (do-poke (act [%reset ~]))
  ;<  n=@ud  bind:m  docs-indexed
  (ex-equal !>(n) !>(0))
::
::  the index is local: a foreign ship can't submit into it
::
++  test-foreign-poke-rejected
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(src ~bus)))
  ;<  ~  bind:m
    (ex-fail (do-poke (act [%touch ~[(ent 1 '' 'injected wording')]])))
  (pure:m ~)
--

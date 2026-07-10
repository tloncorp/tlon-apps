::  tests/app/notes.hoon — behavior-level regression suite for %notes agent
::  Tests poke via %notes-action (a-notes) and assert via on-peek scry paths.
::  All pokes use the nested ACUR shape: top-level a-notes or
::  [%notebook =flag =a-notebook].
::
::  Multi-ship scenarios are NOT covered: test-agent.hoon is a single-bowl
::  harness with no cross-agent sign exchange.
::
/-  n=notes
/+  *test-agent
/=  notes-json  /lib/notes/json
/=  notes-agent  /app/notes
|%
++  dap  %notes
::  Self-poke draining, notes-specific. Lives here (not in /lib/test-agent)
::  because re-delivering self-directed pokes in-harness can't reproduce Gall's
::  real move/effect ordering in the general case — it's only sound for %notes,
::  whose local actions loop back through a single self-poke. See +do-poke-drain.
::
::  +drain-self-pokes: re-deliver self-directed %poke cards through on-poke,
::  recursively until fixpoint or depth=16. A "self-poke" matches
::  [%pass * %agent [our.bowl dap.bowl] %poke *].
::
++  drain-self-pokes
  |=  [pending=(list card) acc=(list card) st=state depth=@ud]
  ^-  (each [(list card) state] (list tank))
  ?:  =(depth 16)  [%& acc st]
  ::  find self-pokes in pending
  =/  self-pokes=(list card)
    %+  skim  pending
    |=  =card
    ?.  ?=([%pass * %agent * %poke *] card)  |
    ?&  =(our.bowl.st ship.q.card)
        =(dap.bowl.st name.q.card)
    ==
  ?~  self-pokes  [%& acc st]
  ::  process self-pokes one at a time via helper
  (drain-loop self-pokes ~ acc st depth)
::  +drain-loop: deliver one self-poke at a time, tail-recurse into drain-self-pokes
::
++  drain-loop
  |=  [queue=(list card) next-pending=(list card) acc=(list card) st=state depth=@ud]
  ^-  (each [(list card) state] (list tank))
  ?~  queue
    (drain-self-pokes next-pending acc st +(depth))
  =*  sp  i.queue
  ?>  ?=([%pass * %agent * %poke *] sp)
  =/  mk=mark  p.cage.task.q.sp
  =/  mv=vase  q.cage.task.q.sp
  =/  pb=bowl:gall  bowl.st(src our.bowl.st)
  =/  toon-res=toon
    %+  mock
      [. !=((~(on-poke agent.st pb) mk mv))]
    |=  [ref=* pax=*]
    ^-  (unit (unit *))
    ?>  ?=(^ ref)
    ?>  =(hoon-version -.ref)
    =+  ;;(pax=path pax)
    =/  rv=(unit vase)  (scry.st pax)
    %.  ?~(rv ~ ``q.u.rv)
    =+  !<(typ=type [-:!>(*type) +.ref])
    same
  ?.  ?=(%0 -.toon-res)
    [%| ~[leaf+"self-poke failed or blocked"]]
  =/  pair=[(list card) agent:gall]
    !<([(list card) agent:gall] [-:!>(*[(list card) agent:gall]) p.toon-res])
  =^  new-caz=(list card)  agent.st  pair
  =.  st  st(bowl (play-cards bowl.st new-caz))
  (drain-loop t.queue (welp next-pending new-caz) (welp acc new-caz) st depth)
::  +do-poke-drain: like +do-poke, but simulates Gall's move loopback by
::  re-delivering any self-directed %poke cards until fixpoint. %notes routes
::  local actions through a self-poke and only mutates state on the redelivered
::  event, so callers that inspect state after a poke must use this.
::
++  do-poke-drain
  |=  [=mark =vase]
  =/  m  (mare ,(list card))
  ^-  form:m
  ::  advance eny before the event: %notes synthesizes request-ids from
  ::  bowl.eny, and the harness (correctly) doesn't touch eny between events,
  ::  so without this successive pokes in one test would mint the same id.
  ::  done here rather than in test-agent so the shared harness stays pristine.
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(eny (shaz eny.bowl))))
  ;<  base-caz=(list card)  bind:m
    %-  do
    |=  s=state
    (~(on-poke agent.s bowl.s) mark vase)
  |=  s=state
  =/  res=(each [(list card) state] (list tank))
    (drain-self-pokes base-caz base-caz s 0)
  ?:  ?=(%| -.res)  [%| p.res]
  &+[-.p.res +.p.res]
::  +do-agent-drain: like +do-agent, but drains self-directed %poke cards
::  emitted by the on-agent handler (see +do-poke-drain).
::
++  do-agent-drain
  |=  [=wire =gill:gall =sign:agent:gall]
  =/  m  (mare ,(list card))
  ^-  form:m
  ::  advance eny per event (see +do-poke-drain) — on-agent can also mint
  ::  request-ids (e.g. join-remote responses).
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(eny (shaz eny.bowl))))
  ;<  base-caz=(list card)  bind:m
    %-  do
    |=  s=state
    =.  bowl.s  (play-sign bowl.s wire gill sign)
    (~(on-agent agent.s bowl.s(src p.gill)) wire sign)
  |=  s=state
  =/  res=(each [(list card) state] (list tank))
    (drain-self-pokes base-caz base-caz s 0)
  ?:  ?=(%| -.res)  [%| p.res]
  &+[-.p.res +.p.res]
::  +poke-a: poke via %notes-action with a-notes value
::
++  poke-a
  |=  a=action:n
  (do-poke-drain %notes-action !>(a))
::  +poke-a-v1: poke via %notes-action-1 with a request-id wrapped action
::
++  poke-a-v1
  |=  a=action:v1:n
  (do-poke-drain %notes-action-1 !>(a))
::  +poke-c-v1: poke via %notes-command-1 with a request-id wrapped command
::
++  poke-c-v1
  |=  c=command:v1:n
  (do-poke-drain %notes-command-1 !>(c))
::  +http-post-v1: simulate an eyre %handle-http-request poke targeting
::  /notes/~/v1. authenticated=| so the only thing that can let it past
::  the agent's auth gate is a valid X-Api-Key header.
::
++  http-post-v1
  |=  [hdrs=(list [@t @t]) body=@t]
  =/  req=request:http
    :*  %'POST'
        '/notes/~/v1'
        hdrs
        `[(met 3 body) body]
    ==
  =/  inbound=inbound-request:eyre
    [authenticated=| secure=| address=[%ipv4 .0.0.0.0] request=req]
  (do-poke-drain %handle-http-request !>([`@ta`'test-eyre-1' inbound]))
::  +http-get-v1: simulate an unauthenticated eyre %handle-http-request
::  GET targeting an arbitrary /notes/* url.
::
++  http-get-v1
  |=  [hdrs=(list [@t @t]) url=@t]
  =/  req=request:http
    [%'GET' url hdrs ~]
  =/  inbound=inbound-request:eyre
    [authenticated=| secure=| address=[%ipv4 .0.0.0.0] request=req]
  (do-poke-drain %handle-http-request !>([`@ta`'test-eyre-get' inbound]))
::  +http-req-v1: simulate an eyre %handle-http-request with arbitrary
::  method + url + body (empty body = no octs). For the first-class REST
::  write endpoints.
::
++  http-req-v1
  |=  [method=method:http hdrs=(list [@t @t]) url=@t body=@t]
  =/  req=request:http
    [method url hdrs ?:(=('' body) ~ `[(met 3 body) body])]
  =/  inbound=inbound-request:eyre
    [authenticated=| secure=| address=[%ipv4 .0.0.0.0] request=req]
  (do-poke-drain %handle-http-request !>([`@ta`'test-eyre-w' inbound]))
::  +http-status: extract HTTP status code from a %http-response-header
::  fact card, if any. Cards from http-error and give-http-response carry
::  a response-header:http vase; axis +>+- of the card is the cage mark,
::  axis +.+>+ is the vase. !< on a small vase is fast.
::
++  http-status
  |=  caz=(list card)
  ^-  (unit @ud)
  |-  ^-  (unit @ud)
  ?~  caz  ~
  ?.  ?=([%give %fact * *] i.caz)  $(caz t.caz)
  ?.  =(`mark`-.+>+.i.caz %http-response-header)
    $(caz t.caz)
  =/  rh=response-header:http  !<(response-header:http +.+>+.i.caz)
  `status-code.rh
::  Card introspection helpers. Hoon's `?=` narrowing on a $% card type
::  doesn't propagate inner `=face` shorthand through the union, so we
::  reach into the card by axis lark and compare raw nouns. (`;;` casts
::  would also work but recursively clam vases — that single test takes
::  ~90s, vs <1s with raw noun equality.)
::
::  Card layouts:
::    [%give %fact paths cage]    fact gift: axis 14=paths, 30=mark, 31=vase
::    [%pass wire %agent gill %watch path]   axis 6=wire, 63=path
::    [%pass wire %agent gill %poke cage]    axis 6=wire, 62=mark, 63=vase
::    [%pass wire %arvo vane task]           axis 6=wire
::
::  +has-fact-mark: any %give %fact card carries the given mark
::
++  has-fact-mark
  |=  [caz=(list card) m=mark]
  ^-  ?
  %+  lien  caz
  |=  c=card
  ?.  ?=([%give %fact * *] c)  |
  =(-.+>+.c m)
::  +has-watch-on-path: any %pass %agent %watch card targets `pax`
::
++  has-watch-on-path
  |=  [caz=(list card) pax=path]
  ^-  ?
  %+  lien  caz
  |=  c=card
  ?.  ?=([%pass * %agent * %watch *] c)  |
  =(+>+>+.c pax)
::  +has-poke-mark: any %pass %agent %poke card carries the given mark
::
++  has-poke-mark
  |=  [caz=(list card) m=mark]
  ^-  ?
  %+  lien  caz
  |=  c=card
  ?.  ?=([%pass * %agent * %poke *] c)  |
  =(-.+>+>+.c m)
::  +has-wait-on-wire: any %pass %arvo %b %wait card on the given wire
::
++  has-wait-on-wire
  |=  [caz=(list card) wir=wire]
  ^-  ?
  %+  lien  caz
  |=  c=card
  ?.  ?=([%pass * %arvo %b %wait *] c)  |
  =(+<.c wir)
::  +find-poke-wire: first %pass %agent %poke card's wire, if any.
::  Used by failure-recovery tests to feed a synthetic nack back
::  through on-agent without hard-coding wire reconstruction details.
::
++  find-poke-wire
  |=  caz=(list card)
  ^-  (unit wire)
  |-  ^-  (unit wire)
  ?~  caz  ~
  ?:  ?=([%pass * %agent * %poke *] i.caz)
    `+<.i.caz
  $(caz t.caz)
::  +find-poke-vase: vase of the first %pass %agent %poke card whose cage
::  carries the given mark, if any. cage is +>+>+.c (cf. +has-poke-mark,
::  which reads its mark via -.); the vase is the cage tail, +..
::
++  find-poke-vase
  |=  [caz=(list card) m=mark]
  ^-  (unit vase)
  ?~  caz  ~
  ?:  ?&  ?=([%pass * %agent * %poke *] i.caz)
          =(-.+>+>+.i.caz m)
      ==
    `+.+>+>+.i.caz
  $(caz t.caz)
::
::  +init-zod: init agent as ~zod; discard cards
::
++  init-zod
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(=bowl bowl(our ~zod)))
  ;<  *  bind:m  (do-init dap notes-agent)
  (pure:m ~)
::  +nb-flag: flag for notebook with title+nid under ship who
::  Applies the same slug algorithm as ++slugify in app/notes.hoon.
::
++  nb-flag
  |=  [who=ship title=@t nid=@ud]
  ^-  flag:n
  [who (slugify-test title nid)]
::  +slugify-test: mirror of ++slugify in app/notes.hoon (same algorithm)
::
++  slugify-test
  |=  [t=@t suffix=@ud]
  ^-  @tas
  =/  chars=tape  (trip t)
  =/  mapped=tape
    %+  turn  chars
    |=  c=@t
    ^-  @t
    ?:  &((gte c 'a') (lte c 'z'))  c
    ?:  &((gte c 'A') (lte c 'Z'))  (add c 32)
    ?:  &((gte c '0') (lte c '9'))  c
    '-'
  =/  collapsed=tape
    %-  flop
    =|  acc=tape
    |-  ^+  acc
    ?~  mapped  acc
    ?:  &(=('-' i.mapped) ?=(^ acc) =('-' i.acc))
      $(mapped t.mapped)
    $(mapped t.mapped, acc [i.mapped acc])
  =/  ltrimmed=tape
    |-  ^-  tape
    ?~  collapsed  ~
    ?:  =('-' i.collapsed)
      $(collapsed t.collapsed)
    collapsed
  =/  trimmed=tape
    =/  rev=tape  (flop ltrimmed)
    =/  rtrimmed=tape
      |-  ^-  tape
      ?~  rev  ~
      ?:  =('-' i.rev)
        $(rev t.rev)
      rev
    (flop rtrimmed)
  =/  capped=tape  (scag 32 trimmed)
  =/  base=tape  ?~(capped "note" capped)
  =/  prefixed=tape
    ?.  &(?=(^ base) (gte i.base '0') (lte i.base '9'))
      base
    (weld "n-" base)
  =/  raw-suf=tape  (trip (scot %ud suffix))
  =/  suf-tape=tape
    %+  skim  raw-suf
    |=(c=@t !=(c '.'))
  `@tas`(crip (weld (weld prefixed "-") suf-tape))
::  peek helpers — no return type annotation (avoids form:(mare ,cage) issue)
::
++  peek-fld
  |=  [=flag:n fid=@ud]
  =/  pax=path  /x/v0/folder/(scot %p ship.flag)/[name.flag]/(scot %ud fid)
  (got-peek pax)
::
++  peek-nt
  |=  [=flag:n nid=@ud]
  =/  pax=path  /x/v0/note/(scot %p ship.flag)/[name.flag]/(scot %ud nid)
  (got-peek pax)
::
++  peek-mbrs
  |=  =flag:n
  =/  pax=path  /x/v0/members/(scot %p ship.flag)/[name.flag]
  (got-peek pax)
::
++  peek-history
  |=  [=flag:n nid=@ud]
  =/  m  (mare ,(list note-revision:n))
  =/  pax=path
    /x/v0/note-history/(scot %p ship.flag)/[name.flag]/(scot %ud nid)
  ^-  form:m
  |=  s=state
  =/  peek=(unit (unit cage))  (~(on-peek agent.s bowl.s) pax)
  ?~  peek  |+~['scry path invalid: history']
  ?~  u.peek  |+~['scry path empty: history']
  =/  cag=cage  u.u.peek
  ?.  =(p.cag %notes-note-history)  |+~['expected notes-note-history mark for history scry']
  &+[!<((list note-revision:n) q.cag) s]
::
++  ex-history-len
  |=  [=flag:n nid=@ud expected=@ud]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  items=(list note-revision:n)  bind:m  (peek-history flag nid)
  |=  s=state
  =/  got=@ud  (lent items)
  ?:  =(got expected)
    &+[~ s]
  |+~[(crip "expected {<expected>} history entries, got {<got>}")]
::
++  get-history-bodies
  |=  items=(list note-revision:n)
  ^-  (list @t)
  %+  turn  items
  |=  nr=note-revision:n
  body-md.nr
::
++  get-history-revs
  |=  items=(list note-revision:n)
  ^-  (list @ud)
  %+  turn  items
  |=  nr=note-revision:n
  rev.nr
::  +ex-cards-ne: assert at least one card was emitted
::
++  ex-cards-ne
  |=  caz=(list card)
  =/  m  (mare ,~)
  ^-  form:m
  |=  s=state
  ?~  caz
    |+['expected cards but got none']~
  &+[~ s]
::  +ex-json: assert cage has mark %json
::
++  ex-json
  |=  cag=cage
  =/  m  (mare ,~)
  ^-  form:m
  (ex-equal !>(p.cag) !>(`mark`%json))
::  +ex-mark: assert cage has the given mark
::
++  ex-mark
  |=  [cag=cage expected=@tas]
  =/  m  (mare ,~)
  ^-  form:m
  (ex-equal !>(p.cag) !>(`@tas`expected))
::  +ex-gone: assert scry returns outer-null (item deleted/missing)
::
++  ex-gone
  |=  res=(unit (unit cage))
  =/  m  (mare ,~)
  ^-  form:m
  |=  s=state
  ?~  res
    &+[~ s]
  |+['expected outer-null scry result for deleted item']~
::  ====  test-create-notebook  ====
::  Creates notebook (id=1, root-folder=2); verifies folder and membership exist.
::
++  test-create-notebook
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  caz=(list card)  b  (poke-a [%create-notebook 'My Notebook'])
  ;<  ~  b  (ex-cards-ne caz)
  =/  f=flag:n  (nb-flag our.bowl 'My Notebook' 1)
  ;<  root=cage  b  (peek-fld f 2)
  ;<  ~  b  (ex-mark root %notes-folder)
  ;<  mbrs=cage  b  (peek-mbrs f)
  (ex-mark mbrs %notes-members)
::  ====  test-create-group-notebook-readers  ====
::  group-mode create registers the channel with %groups via a
::  group-action-4 poke that carries the group role-readers verbatim —
::  the privacy fix: readers must not be dropped (else the channel is
::  created group-wide readable, defeating the group's can-read gate).
::
++  test-create-group-notebook-readers
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  =/  gf=flag:n  [~zod 'my-group']
  =/  rdrs=(set @tas)  (silt `(list @tas)`~[%admin %member])
  ;<  caz=(list card)  b  (poke-a [%create-group-notebook 'Group NB' gf rdrs])
  |=  s2=state
  ?.  (has-poke-mark caz %group-action-4)
    |+['group-mode create did not poke %groups']~
  =/  van=(unit vase)  (find-poke-vase caz %group-action-4)
  ?~  van
    |+['no group-action-4 poke vase found']~
  =/  act=group-create:n  !<(group-create:n u.van)
  ?.  =(readers.channel.act rdrs)
    |+['group channel-add dropped readers']~
  &+[~ s2]
::  ====  test-rename-notebook  ====
::
++  test-rename-notebook
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'Original'])
  =/  f=flag:n  (nb-flag our.bowl 'Original' 1)
  ;<  caz=(list card)  b  (poke-a [%notebook f [%rename 'Renamed']])
  ;<  ~  b  (ex-cards-ne caz)
  ;<  nb=cage  b  (got-peek /x/v0/notebook/(scot %p ship.f)/[name.f])
  (ex-mark nb %notes-notebook)
::  ====  test-delete-notebook  ====
::
++  test-delete-notebook
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'ToDelete'])
  =/  f=flag:n  (nb-flag our.bowl 'ToDelete' 1)
  ;<  caz=(list card)  b  (poke-a [%notebook f [%delete ~]])
  ;<  ~  b  (ex-cards-ne caz)
  ;<  res=(unit (unit cage))  b
    (get-peek /x/v0/notebook/(scot %p ship.f)/[name.f])
  (ex-gone res)
::  ====  test-set-visibility-public  ====
::
++  test-set-visibility-public
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'NB'])
  =/  f=flag:n  (nb-flag our.bowl 'NB' 1)
  ;<  caz=(list card)  b  (poke-a [%notebook f [%visibility %public]])
  (ex-cards-ne caz)
::  ====  test-join-public-accepts  ====
::  Non-member ~bus sends [%notes-command [flag [%member-join ~]]] to host (~zod);
::  must succeed and add ~bus as %editor.
::
++  test-join-public-accepts
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'Open NB'])
  =/  f=flag:n  (nb-flag our.bowl 'Open NB' 1)
  ;<  *  b  (poke-a [%notebook f [%visibility %public]])
  ;<  *  b  (set-src ~bus)
  ;<  caz=(list card)  b
    (do-poke-drain %notes-command-1 !>(`command:v1:n`[`@uv`0v1 [%notebook f [%member-join ~]]]))
  ;<  ~  b  (ex-cards-ne caz)
  ;<  *  b  (set-src our.bowl)
  ;<  mbrs=cage  b  (peek-mbrs f)
  (ex-mark mbrs %notes-members)
::  ====  test-join-private-rejects-non-member  ====
::  Non-member ~bus tries joining a private notebook — must crash.
::
++  test-join-private-rejects-non-member
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'Private NB'])
  =/  f=flag:n  (nb-flag our.bowl 'Private NB' 1)
  ;<  *  b  (set-src ~bus)
  (ex-fail (do-poke-drain %notes-command !>(`command:n`[%notebook f [%member-join ~]])))
::  ====  test-group-edit-revoked-rejects  ====
::  A group member recorded as %editor must lose write access when their group
::  access is revoked. se-can-edit re-checks the group's live can-read, since
::  the members map isn't pruned on revocation (recheck-group-access only kicks
::  subscriptions). Regression for the Codex P1 finding.
::
++  test-group-edit-revoked-rejects
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  =/  gf=flag:n  [~zod 'grp']
  ::  mock the group can-read GATE scry: ~bus permitted.
  =/  can-read-allow=scry
    |=  pax=path
    ?.  ?=([%gx @ %groups @ %v2 %groups @ @ %channels %can-read %noun ~] pax)  ~
    `!>(|=([who=ship =nest:n] =(who ~bus)))
  ::  revoked: can-read denies everyone (host self-shortcuts in group-can-read).
  =/  can-read-deny=scry
    |=  pax=path
    ?.  ?=([%gx @ %groups @ %v2 %groups @ @ %channels %can-read %noun ~] pax)  ~
    `!>(|=([who=ship =nest:n] |))
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  ~  b  (set-scry-gate can-read-allow)
  ;<  *  b  (poke-a [%create-group-notebook 'GNB' gf ~])
  =/  f=flag:n  (nb-flag our.bowl 'GNB' 1)
  ::  ~bus joins while group access holds → recorded %editor
  ;<  *  b  (set-src ~bus)
  ;<  jz=(list card)  b
    (do-poke-drain %notes-command-1 !>(`command:v1:n`[`@uv`0v1 [%notebook f [%member-join ~]]]))
  ;<  ~  b  (ex-cards-ne jz)
  ::  with access, ~bus can create a note
  ;<  ez=(list card)  b
    (do-poke-drain %notes-command-1 !>(`command:v1:n`[`@uv`0v2 [%notebook f [%create-note 2 'T' 'B']]]))
  ;<  ~  b  (ex-cards-ne ez)
  ::  revoke ~bus's group access; the same edit must now be rejected
  ;<  ~  b  (set-scry-gate can-read-deny)
  ;<  *  b  (set-src ~bus)
  (ex-fail (do-poke-drain %notes-command !>(`command:n`[%notebook f [%create-note 2 'T2' 'B2']])))
::  ====  test-create-folder-at-root  ====
::
++  test-create-folder-at-root
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'NB'])
  =/  f=flag:n  (nb-flag our.bowl 'NB' 1)
  ;<  caz=(list card)  b  (poke-a [%notebook f [%create-folder 2 'Docs']])
  ;<  ~  b  (ex-cards-ne caz)
  ;<  fld=cage  b  (peek-fld f 3)
  (ex-mark fld %notes-folder)
::  ====  test-create-folder-nested  ====
::  Sub-folder under Docs (id=3); new folder gets id=4.
::
++  test-create-folder-nested
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'NB'])
  =/  f=flag:n  (nb-flag our.bowl 'NB' 1)
  ;<  *  b  (poke-a [%notebook f [%create-folder 2 'Docs']])
  ;<  caz=(list card)  b  (poke-a [%notebook f [%create-folder 3 'Sub']])
  ;<  ~  b  (ex-cards-ne caz)
  ;<  sub=cage  b  (peek-fld f 4)
  (ex-mark sub %notes-folder)
::  ====  test-create-folder-bad-parent-rejected  ====
::  parent points at an id that doesn't exist → crash. ex-fail ensures
::  the poke failed AND folders.notebook-state is unchanged.
::
++  test-create-folder-bad-parent-rejected
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'NB'])
  =/  f=flag:n  (nb-flag our.bowl 'NB' 1)
  ;<  ~  b  (ex-fail (poke-a [%notebook f [%create-folder 999 'Bad']]))
  ;<  sv=vase  b  get-save
  =/  s=state-15:n  !<(state-15:n sv)
  |=  s2=state
  ?~  entry=(~(get by books.s) f)  |+['notebook missing']~
  ?.  =(1 ~(wyt by folders.notebook-state.u.entry))
    |+['rejected poke should not have created a folder']~
  &+[~ s2]
::  ====  test-rename-folder  ====
::
++  test-rename-folder
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'NB'])
  =/  f=flag:n  (nb-flag our.bowl 'NB' 1)
  ;<  *  b  (poke-a [%notebook f [%create-folder 2 'OldName']])
  ;<  caz=(list card)  b  (poke-a [%notebook f [%folder 3 [%rename 'NewName']]])
  (ex-cards-ne caz)
::  ====  test-move-folder  ====
::  FolderA(3) at root, FolderB(4) at root; move B under A.
::
++  test-move-folder
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'NB'])
  =/  f=flag:n  (nb-flag our.bowl 'NB' 1)
  ;<  *  b  (poke-a [%notebook f [%create-folder 2 'FolderA']])
  ;<  *  b  (poke-a [%notebook f [%create-folder 2 'FolderB']])
  ;<  caz=(list card)  b  (poke-a [%notebook f [%folder 4 [%move 3]]])
  (ex-cards-ne caz)
::  ====  test-delete-empty-folder-succeeds  ====
::
++  test-delete-empty-folder-succeeds
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'NB'])
  =/  f=flag:n  (nb-flag our.bowl 'NB' 1)
  ;<  *  b  (poke-a [%notebook f [%create-folder 2 'Empty']])
  ;<  caz=(list card)  b  (poke-a [%notebook f [%folder 3 [%delete %.n]]])
  ;<  ~  b  (ex-cards-ne caz)
  ;<  res=(unit (unit cage))  b
    =/  pax=path  /x/v0/folder/(scot %p ship.f)/[name.f]/(scot %ud 3)
    (get-peek pax)
  (ex-gone res)
::  ====  test-delete-nonempty-folder-nonrecursive-rejects  ====
::
++  test-delete-nonempty-folder-nonrecursive-rejects
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'NB'])
  =/  f=flag:n  (nb-flag our.bowl 'NB' 1)
  ;<  *  b  (poke-a [%notebook f [%create-folder 2 'HasNote']])
  ;<  *  b  (poke-a [%notebook f [%create-note 3 'Note' 'body']])
  (ex-fail (poke-a [%notebook f [%folder 3 [%delete %.n]]]))
::  ====  test-delete-nonempty-folder-recursive-succeeds  ====
::
++  test-delete-nonempty-folder-recursive-succeeds
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'NB'])
  =/  f=flag:n  (nb-flag our.bowl 'NB' 1)
  ;<  *  b  (poke-a [%notebook f [%create-folder 2 'HasNote']])
  ;<  *  b  (poke-a [%notebook f [%create-note 3 'Note' 'body']])
  ;<  caz=(list card)  b  (poke-a [%notebook f [%folder 3 [%delete %.y]]])
  ;<  ~  b  (ex-cards-ne caz)
  ;<  fld-res=(unit (unit cage))  b
    =/  pax=path  /x/v0/folder/(scot %p ship.f)/[name.f]/(scot %ud 3)
    (get-peek pax)
  ;<  ~  b  (ex-gone fld-res)
  ;<  nt-res=(unit (unit cage))  b
    =/  pax=path  /x/v0/note/(scot %p ship.f)/[name.f]/(scot %ud 4)
    (get-peek pax)
  (ex-gone nt-res)
::  ====  test-create-note  ====
::
++  test-create-note
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'NB'])
  =/  f=flag:n  (nb-flag our.bowl 'NB' 1)
  ;<  caz=(list card)  b  (poke-a [%notebook f [%create-note 2 'Hello' '# Hello']])
  ;<  ~  b  (ex-cards-ne caz)
  ;<  nt=cage  b  (peek-nt f 3)
  (ex-mark nt %notes-note)
::  ====  test-rename-note  ====
::
++  test-rename-note
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'NB'])
  =/  f=flag:n  (nb-flag our.bowl 'NB' 1)
  ;<  *  b  (poke-a [%notebook f [%create-note 2 'OldTitle' 'body']])
  ;<  caz=(list card)  b  (poke-a [%notebook f [%note 3 [%rename 'NewTitle']]])
  (ex-cards-ne caz)
::  ====  test-move-note  ====
::  FolderA=id=3, note=id=4, FolderB=id=5; moves note from A to B.
::
++  test-move-note
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'NB'])
  =/  f=flag:n  (nb-flag our.bowl 'NB' 1)
  ;<  *  b  (poke-a [%notebook f [%create-folder 2 'FolderA']])
  ;<  *  b  (poke-a [%notebook f [%create-note 3 'MyNote' 'body']])
  ;<  *  b  (poke-a [%notebook f [%create-folder 2 'FolderB']])
  ;<  caz=(list card)  b  (poke-a [%notebook f [%note 4 [%move 5]]])
  (ex-cards-ne caz)
::  ====  test-update-note-matching-revision-succeeds  ====
::  Correct expected-revision: first edit (0→1) and second (1→2); both succeed.
::
++  test-update-note-matching-revision-succeeds
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'NB'])
  =/  f=flag:n  (nb-flag our.bowl 'NB' 1)
  ;<  *  b  (poke-a [%notebook f [%create-note 2 'Note' 'v1']])
  ;<  caz=(list card)  b  (poke-a [%notebook f [%note 3 [%update 'v2' 0]]])
  ;<  ~  b  (ex-cards-ne caz)
  ;<  caz=(list card)  b  (poke-a [%notebook f [%note 3 [%update 'v3' 1]]])
  (ex-cards-ne caz)
::  ====  test-delete-note-clears-history  ====
::  Deleting a note must drop its archived revision history, so a deleted
::  note can't be recovered via the history read path (Codex regression).
::
++  test-delete-note-clears-history
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'NB'])
  =/  f=flag:n  (nb-flag our.bowl 'NB' 1)
  ;<  *  b  (poke-a [%notebook f [%create-note 2 'Note' 'v1']])
  ::  update archives the prior revision — history[3] now has one entry
  ;<  *  b  (poke-a [%notebook f [%note 3 [%update 'v2' 0]]])
  ;<  ~  b  (ex-history-len f 3 1)
  ;<  *  b  (poke-a [%notebook f [%note 3 [%delete ~]]])
  (ex-history-len f 3 0)
::  ====  test-delete-group-notebook-removes-channel  ====
::  Deleting a group-mode notebook must poke %groups to remove the channel
::  (mirror of the %add on create), so the group stops listing it (Codex).
::
++  test-delete-group-notebook-removes-channel
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  =/  gf=flag:n  [~zod 'grp']
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-group-notebook 'GNB' gf ~])
  =/  f=flag:n  (nb-flag our.bowl 'GNB' 1)
  ;<  caz=(list card)  b  (poke-a [%notebook f [%delete ~]])
  |=  s2=state
  ?.  (has-poke-mark caz %group-action-4)
    |+['group-notebook delete did not poke %groups']~
  =/  van=(unit vase)  (find-poke-vase caz %group-action-4)
  ?~  van
    |+['no group-action-4 poke vase found']~
  ::  !< nest-checks the payload against the %group … %channel … %del shape;
  ::  a different group action (e.g. the %add) would fail to extract here.
  =+  !<(group-channel-del:n u.van)
  &+[~ s2]
::  ====  test-update-note-mismatched-revision-rejects  ====
::  Stale expected-revision crashes; note still readable after.
::
++  test-update-note-mismatched-revision-rejects
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'NB'])
  =/  f=flag:n  (nb-flag our.bowl 'NB' 1)
  ;<  *  b  (poke-a [%notebook f [%create-note 2 'Note' 'v1']])
  ;<  *  b  (poke-a [%notebook f [%note 3 [%update 'v2' 0]]])
  ;<  *  b  (poke-a [%notebook f [%note 3 [%update 'v3' 1]]])
  ::  revision is now 2; expected-revision=1 is stale — must crash
  ;<  ~  b  (ex-fail (poke-a [%notebook f [%note 3 [%update 'v4' 1]]]))
  ;<  nt=cage  b  (peek-nt f 3)
  (ex-mark nt %notes-note)
::  ====  test-update-note-stale-zero-rejects  ====
::  expected-revision=0 on a note with revision>0 must crash (strict, no force-update).
::
++  test-update-note-stale-zero-rejects
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'NB'])
  =/  f=flag:n  (nb-flag our.bowl 'NB' 1)
  ;<  *  b  (poke-a [%notebook f [%create-note 2 'Note' 'v1']])
  ;<  *  b  (poke-a [%notebook f [%note 3 [%update 'v2' 0]]])
  ::  revision is now 1; expected-revision=0 is stale — must crash
  ;<  ~  b  (ex-fail (poke-a [%notebook f [%note 3 [%update 'clobbered' 0]]]))
  ;<  nt=cage  b  (peek-nt f 3)
  (ex-mark nt %notes-note)
::  ====  test-update-note-at-revision-zero-succeeds  ====
::  First edit (revision=0, expected=0) must succeed.
::
++  test-update-note-at-revision-zero-succeeds
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'NB'])
  =/  f=flag:n  (nb-flag our.bowl 'NB' 1)
  ;<  *  b  (poke-a [%notebook f [%create-note 2 'Note' 'initial']])
  ;<  caz=(list card)  b  (poke-a [%notebook f [%note 3 [%update 'first-edit' 0]]])
  (ex-cards-ne caz)
::  ====  test-delete-note  ====
::
++  test-delete-note
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'NB'])
  =/  f=flag:n  (nb-flag our.bowl 'NB' 1)
  ;<  *  b  (poke-a [%notebook f [%create-note 2 'ToDelete' 'body']])
  ;<  caz=(list card)  b  (poke-a [%notebook f [%note 3 [%delete ~]]])
  ;<  ~  b  (ex-cards-ne caz)
  ;<  res=(unit (unit cage))  b
    =/  pax=path  /x/v0/note/(scot %p ship.f)/[name.f]/(scot %ud 3)
    (get-peek pax)
  (ex-gone res)
::  ====  test-batch-import  ====
::  Imports 3 notes into root folder; ids 3, 4, 5 all exist.
::
++  test-batch-import
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'NB'])
  =/  f=flag:n  (nb-flag our.bowl 'NB' 1)
  =/  items=(list [title=@t body=@t])
    ~[['Note1' 'body1'] ['Note2' 'body2'] ['Note3' 'body3']]
  ;<  caz=(list card)  b  (poke-a [%notebook f [%batch-import 2 items]])
  ;<  ~  b  (ex-cards-ne caz)
  ;<  n3=cage  b  (peek-nt f 3)
  ;<  ~  b  (ex-mark n3 %notes-note)
  ;<  n4=cage  b  (peek-nt f 4)
  ;<  ~  b  (ex-mark n4 %notes-note)
  ;<  n5=cage  b  (peek-nt f 5)
  (ex-mark n5 %notes-note)
::  ====  test-batch-import-tree  ====
::  Subfolder Sub (id=3), NoteA (id=4), NoteB (id=5), Root (id=6).
::
++  test-batch-import-tree
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'NB'])
  =/  f=flag:n  (nb-flag our.bowl 'NB' 1)
  =/  tree=(list import-node:n)
    :~  [%folder 'Sub' ~[[%note 'NoteA' 'bodyA'] [%note 'NoteB' 'bodyB']]]
        [%note 'Root' 'rootbody']
    ==
  ;<  caz=(list card)  b  (poke-a [%notebook f [%batch-import-tree 2 tree]])
  ;<  ~  b  (ex-cards-ne caz)
  ;<  sub=cage   b  (peek-fld f 3)
  ;<  ~  b  (ex-mark sub %notes-folder)
  ;<  na=cage    b  (peek-nt f 4)
  ;<  ~  b  (ex-mark na %notes-note)
  ;<  nb-c=cage  b  (peek-nt f 5)
  ;<  ~  b  (ex-mark nb-c %notes-note)
  ;<  nr=cage    b  (peek-nt f 6)
  (ex-mark nr %notes-note)
::  ====  test-publish-note  ====
::
++  test-publish-note
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'NB'])
  =/  f=flag:n  (nb-flag our.bowl 'NB' 1)
  ;<  *  b  (poke-a [%notebook f [%create-note 2 'Article' '# Hello']])
  ;<  *  b  (poke-a [%notebook f [%note 3 [%publish '<h1>Hello</h1>']]])
  ;<  pub=cage  b  (got-peek /x/v0/published)
  ;<  ~  b  (ex-mark pub %notes-published)
  ;<  *  b  (poke-a [%notebook f [%note 3 [%unpublish ~]]])
  ;<  pub2=cage  b  (got-peek /x/v0/published)
  (ex-mark pub2 %notes-published)
::  ====  test-publish-note-rejects-non-self  ====
::  ~zod creates a notebook + note. ~bus pokes a publish action — must
::  crash because the +poke %notes-action handler asserts =(our src):bowl.
::  (Cross-ship state changes go through %notes-command, not %notes-action.)
::
++  test-publish-note-rejects-non-self
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'NB'])
  =/  f=flag:n  (nb-flag our.bowl 'NB' 1)
  ;<  *  b  (poke-a [%notebook f [%create-note 2 'Article' '# Hello']])
  ;<  *  b  (set-src ~bus)
  (ex-fail (poke-a [%notebook f [%note 3 [%publish '<h1>Bad</h1>']]]))
::  ====  test-publish-note-rejects-unknown-notebook  ====
::  Publishing under a flag with no books entry must crash via no-abed.
::
++  test-publish-note-rejects-unknown-notebook
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  =/  f=flag:n  [our.bowl 'no-such-notebook']
  (ex-fail (poke-a [%notebook f [%note 1 [%publish '<h1>Ghost</h1>']]]))
::  ====  test-create-and-update-archives-prior-rev  ====
::  After a single update, history has exactly one entry containing
::  the prior body. The archive's rev is the rev the snapshot was at (0).
::
++  test-create-and-update-archives-prior-rev
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'NB'])
  =/  f=flag:n  (nb-flag our.bowl 'NB' 1)
  ;<  *  b  (poke-a [%notebook f [%create-note 2 'Note' 'v1']])
  ;<  *  b  (poke-a [%notebook f [%note 3 [%update 'v2' 0]]])
  ;<  ~  b  (ex-history-len f 3 1)
  ;<  items=(list note-revision:n)  b  (peek-history f 3)
  =/  bodies=(list @t)  (get-history-bodies items)
  =/  revs=(list @ud)  (get-history-revs items)
  |=  s=state
  ?.  =(['v1' ~] bodies)
    |+~[(crip "expected ['v1'], got {<bodies>}")]
  ?.  =(`(list @ud)`~[0] revs)
    |+~[(crip "expected revs=[0], got {<revs>}")]
  &+[~ s]
::  ====  test-multiple-updates-newest-first  ====
::
++  test-multiple-updates-newest-first
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'NB'])
  =/  f=flag:n  (nb-flag our.bowl 'NB' 1)
  ;<  *  b  (poke-a [%notebook f [%create-note 2 'Note' 'v1']])
  ;<  *  b  (poke-a [%notebook f [%note 3 [%update 'v2' 0]]])
  ;<  *  b  (poke-a [%notebook f [%note 3 [%update 'v3' 1]]])
  ;<  *  b  (poke-a [%notebook f [%note 3 [%update 'v4' 2]]])
  ;<  ~  b  (ex-history-len f 3 3)
  ;<  items=(list note-revision:n)  b  (peek-history f 3)
  =/  bodies=(list @t)  (get-history-bodies items)
  =/  revs=(list @ud)  (get-history-revs items)
  |=  s=state
  ?.  =(['v3' 'v2' 'v1' ~] bodies)
    |+~[(crip "expected ['v3' 'v2' 'v1'], got {<bodies>}")]
  ?.  =(`(list @ud)`~[2 1 0] revs)
    |+~[(crip "expected revs=[2 1 0], got {<revs>}")]
  &+[~ s]
::  ====  test-noop-update-does-not-archive  ====
::
++  test-noop-update-does-not-archive
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'NB'])
  =/  f=flag:n  (nb-flag our.bowl 'NB' 1)
  ;<  *  b  (poke-a [%notebook f [%create-note 2 'Note' 'same']])
  ;<  *  b  (poke-a [%notebook f [%note 3 [%update 'same' 0]]])
  (ex-history-len f 3 0)
::  ====  test-restore-via-update-archives-current  ====
::  "Restore" is an update with old content. After restoring 'v1' from
::  a v3 note, history has [v3, v2, v1].
::
++  test-restore-via-update-archives-current
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'NB'])
  =/  f=flag:n  (nb-flag our.bowl 'NB' 1)
  ;<  *  b  (poke-a [%notebook f [%create-note 2 'Note' 'v1']])
  ;<  *  b  (poke-a [%notebook f [%note 3 [%update 'v2' 0]]])
  ;<  *  b  (poke-a [%notebook f [%note 3 [%update 'v3' 1]]])
  ;<  *  b  (poke-a [%notebook f [%note 3 [%update 'v1' 2]]])
  ;<  ~  b  (ex-history-len f 3 3)
  ;<  items=(list note-revision:n)  b  (peek-history f 3)
  =/  bodies=(list @t)  (get-history-bodies items)
  |=  s=state
  ?.  =(['v3' 'v2' 'v1' ~] bodies)
    |+~[(crip "expected ['v3' 'v2' 'v1'], got {<bodies>}")]
  &+[~ s]
::  ====  test-rename-does-not-bump-revision  ====
::  rename-note must not bump the body-md revision counter, otherwise an
::  autoSave sequence that fires update-note then rename-note silently
::  desyncs the client's expected-revision from the server's actual rev,
::  causing later saves to fail with revision-mismatch and lose work.
::
++  test-rename-does-not-bump-revision
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'NB'])
  =/  f=flag:n  (nb-flag our.bowl 'NB' 1)
  ;<  *  b  (poke-a [%notebook f [%create-note 2 'Original' 'body']])
  ;<  *  b  (poke-a [%notebook f [%note 3 [%update 'edited' 0]]])
  ::  body update advanced rev to 1; rename must keep it at 1
  ;<  *  b  (poke-a [%notebook f [%note 3 [%rename 'Renamed']]])
  ;<  nt=cage  b
    (got-peek /x/v0/note/(scot %p ship.f)/[name.f]/'3')
  |=  s=state
  ?.  =(p.nt %notes-note)
    |+['expected notes-note mark']~
  =/  nt-val=note:n  !<(note:n q.nt)
  ?.  =(revision.nt-val 1)
    |+~[(crip "expected rev=1 after update+rename, got rev={<revision.nt-val>}")]
  &+[~ s]
::  ====  test-history-empty-on-fresh-note  ====
::
++  test-history-empty-on-fresh-note
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'NB'])
  =/  f=flag:n  (nb-flag our.bowl 'NB' 1)
  ;<  *  b  (poke-a [%notebook f [%create-note 2 'Note' 'body']])
  (ex-history-len f 3 0)
::  ====  test-restore-action  ====
::  %restore looks up the archived body at rev=0 and re-applies it.
::
++  test-restore-action
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'NB'])
  =/  f=flag:n  (nb-flag our.bowl 'NB' 1)
  ;<  *  b  (poke-a [%notebook f [%create-note 2 'Note' 'v1']])
  ;<  *  b  (poke-a [%notebook f [%note 3 [%update 'v2' 0]]])
  ;<  *  b  (poke-a [%notebook f [%note 3 [%update 'v3' 1]]])
  ::  restore to rev=0 (body 'v1')
  ;<  caz=(list card)  b  (poke-a [%notebook f [%note 3 [%restore 0]]])
  ;<  ~  b  (ex-cards-ne caz)
  ::  history should now have 3 entries (v1, v2, v3 archived)
  (ex-history-len f 3 3)
::  ====  test-accept-invite  ====
::  Seed a state-14 with an invite for a remote flag; accept clears the
::  invite and emits a join-remote card.
::
++  test-accept-invite
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  =/  remote-flag=flag:n  [~bus 'remote-nb']
  =/  inv=(map flag:n invite-info:n)
    (~(put by *(map flag:n invite-info:n)) remote-flag [~bus now.bowl 'RemoteNB'])
  =/  s15=state-15:n  [%15 ~ 0 ~ inv ~ ~]
  ;<  *  b  (do-load notes-agent `!>(s15))
  ::  accept: fires join-remote (emits a card) and removes invite
  ;<  caz=(list card)  b  (poke-a [%accept-invite remote-flag])
  ;<  ~  b  (ex-cards-ne caz)
  ::  invites map is now empty
  ;<  sv=vase  b  get-save
  =/  s14-after=state-15:n  !<(state-15:n sv)
  |=  s=state
  ?.  =(~ invites.s14-after)
    |+['expected empty invites map after accept-invite']~
  &+[~ s]
::  ====  test-decline-invite  ====
::
++  test-decline-invite
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  =/  remote-flag=flag:n  [~bus 'remote-nb']
  =/  inv=(map flag:n invite-info:n)
    (~(put by *(map flag:n invite-info:n)) remote-flag [~bus now.bowl 'RemoteNB'])
  =/  s15=state-15:n  [%15 ~ 0 ~ inv ~ ~]
  ;<  *  b  (do-load notes-agent `!>(s15))
  ;<  *  b  (poke-a [%decline-invite remote-flag])
  ;<  sv=vase  b  get-save
  =/  s14-after=state-15:n  !<(state-15:n sv)
  |=  s=state
  ?.  =(~ invites.s14-after)
    |+['expected empty invites map after decline-invite']~
  &+[~ s]
::  ====  test-migrate-state-14-to-15  ====
::  A state-14 save (carried rid-counter) must load through the 14→15
::  migration, which drops rid-counter and preserves every other field.
::
++  test-migrate-state-14-to-15
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  =/  inv=(map flag:n invite-info:n)
    (~(put by *(map flag:n invite-info:n)) [~bus 'nb'] [~bus now.bowl 'RemoteNB'])
  ::  [%14 books next-id published invites requests api-key rid-counter]
  =/  s14=state-14:n  [%14 ~ 5 ~ inv ~ `'0v1.abc' 42]
  ;<  *  b  (do-load notes-agent `!>(s14))
  ;<  sv=vase  b  get-save
  ::  molds as state-15 (a stale rid-counter field would nest-fail here)
  =/  s15=state-15:n  !<(state-15:n sv)
  |=  s2=state
  ?.  =(5 next-id.s15)
    |+['expected next-id preserved across 14→15 migration']~
  ?.  =(1 ~(wyt by invites.s15))
    |+['expected invite preserved across 14→15 migration']~
  ?.  =(`'0v1.abc' api-key.s15)
    |+['expected api-key preserved across 14→15 migration']~
  &+[~ s2]
::  ====  JSON wire-format tests  ============================================
::  These hit notes-json directly without booting the agent. They guard the
::  UI ↔ agent contract (field names, nesting, envelope shape).
::
::  +mk-pairs / +mk-num / +mk-str / +mk-arr — concise json builders.
::
++  mk-str  |=(s=@t [%s s])
++  mk-num  |=(n=@ud (numb:enjs:format n))
++  mk-arr  |=(items=(list json) [%a items])
++  mk-obj  |=(kvs=(list [@t json]) (pairs:enjs:format kvs))
::  ====  test-json-decode-create-notebook  ====
::
++  test-json-decode-create-notebook
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  jon=json
    %-  mk-obj
    :~  ['type' [%s 'create-notebook']]
        ['title' [%s 'My Book']]
    ==
  =/  parsed=action:n  (action:dejs:notes-json jon)
  =/  expected=action:n  [%create-notebook 'My Book']
  (ex-equal !>(parsed) !>(expected))
::  ====  test-json-decode-join  ====
::
++  test-json-decode-join
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  jon=json
    %-  mk-obj
    :~  ['type' [%s 'join']]
        ['ship' [%s '~zod']]
        ['name' [%s 'foo']]
    ==
  =/  parsed=action:n  (action:dejs:notes-json jon)
  =/  expected=action:n  [%join [~zod %foo]]
  (ex-equal !>(parsed) !>(expected))
::  ====  test-json-decode-accept-invite  ====
::
++  test-json-decode-accept-invite
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  jon=json
    %-  mk-obj
    :~  ['type' [%s 'accept-invite']]
        ['ship' [%s '~bus']]
        ['name' [%s 'shared']]
    ==
  =/  parsed=action:n  (action:dejs:notes-json jon)
  =/  expected=action:n  [%accept-invite [~bus %shared]]
  (ex-equal !>(parsed) !>(expected))
::  Note: %notify-invite moved from a-notes to c-notes (it's a cross-ship
::  message, not a local UI action). Commands aren't JSON-decoded —
::  they're noun-encoded between agents — so there's no test-agent
::  decode test for notify-invite here. The cross-ship-invite Playwright
::  spec exercises the round-trip end-to-end.
::
::  ====  test-json-decode-notebook-rename  ====
::
++  test-json-decode-notebook-rename
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  inner=json
    %-  mk-obj
    :~  ['type' [%s 'rename']]
        ['title' [%s 'New Name']]
    ==
  =/  jon=json
    %-  mk-obj
    :~  ['type' [%s 'notebook']]
        ['flag' [%s '~zod/foo']]
        ['action' inner]
    ==
  =/  parsed=action:n  (action:dejs:notes-json jon)
  =/  expected=action:n  [%notebook [~zod %foo] [%rename 'New Name']]
  (ex-equal !>(parsed) !>(expected))
::  ====  test-json-decode-folder-rename-nested  ====
::  Three-level nesting: notebook → folder id → folder action.
::
++  test-json-decode-folder-rename-nested
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  fld=json
    %-  mk-obj
    :~  ['type' [%s 'rename']]
        ['name' [%s 'docs']]
    ==
  =/  inner=json
    %-  mk-obj
    :~  ['type' [%s 'folder']]
        ['id' (mk-num 7)]
        ['action' fld]
    ==
  =/  jon=json
    %-  mk-obj
    :~  ['type' [%s 'notebook']]
        ['flag' [%s '~zod/foo']]
        ['action' inner]
    ==
  =/  parsed=action:n  (action:dejs:notes-json jon)
  =/  expected=action:n
    [%notebook [~zod %foo] [%folder 7 [%rename 'docs']]]
  (ex-equal !>(parsed) !>(expected))
::  ====  test-json-decode-note-update-nested  ====
::
++  test-json-decode-note-update-nested
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  nt=json
    %-  mk-obj
    :~  ['type' [%s 'update']]
        ['body' [%s '# Hello']]
        ['expectedRevision' (mk-num 3)]
    ==
  =/  inner=json
    %-  mk-obj
    :~  ['type' [%s 'note']]
        ['id' (mk-num 12)]
        ['action' nt]
    ==
  =/  jon=json
    %-  mk-obj
    :~  ['type' [%s 'notebook']]
        ['flag' [%s '~zod/foo']]
        ['action' inner]
    ==
  =/  parsed=action:n  (action:dejs:notes-json jon)
  =/  expected=action:n
    [%notebook [~zod %foo] [%note 12 [%update '# Hello' 3]]]
  (ex-equal !>(parsed) !>(expected))
::  ====  test-json-decode-batch-import-flat  ====
::  Notes use `body` (not `bodyMd`) on the wire.
::
++  test-json-decode-batch-import-flat
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  n1=json
    (mk-obj ~[['title' [%s 'a']] ['body' [%s 'A body']]])
  =/  n2=json
    (mk-obj ~[['title' [%s 'b']] ['body' [%s 'B body']]])
  =/  inner=json
    %-  mk-obj
    :~  ['type' [%s 'batch-import']]
        ['folder' (mk-num 2)]
        ['notes' (mk-arr ~[n1 n2])]
    ==
  =/  jon=json
    %-  mk-obj
    :~  ['type' [%s 'notebook']]
        ['flag' [%s '~zod/foo']]
        ['action' inner]
    ==
  =/  parsed=action:n  (action:dejs:notes-json jon)
  =/  expected=action:n
    :*  %notebook
        [~zod %foo]
        :*  %batch-import
            2
            ~[[title='a' body='A body'] [title='b' body='B body']]
        ==
    ==
  (ex-equal !>(parsed) !>(expected))
::  ====  test-json-decode-batch-import-tree  ====
::  REGRESSION: tree note nodes use `body` (not `bodyMd`). Bug shipped briefly
::  where the tree builder sent bodyMd while the decoder expected body.
::
++  test-json-decode-batch-import-tree
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  leaf=json
    (mk-obj ~[['title' [%s 'README']] ['body' [%s 'hello']]])
  =/  sub-folder=json
    %-  mk-obj
    :~  ['name' [%s 'sub']]
        ['children' (mk-arr ~[leaf])]
    ==
  =/  inner=json
    %-  mk-obj
    :~  ['type' [%s 'batch-import-tree']]
        ['parent' (mk-num 2)]
        ['tree' (mk-arr ~[sub-folder])]
    ==
  =/  jon=json
    %-  mk-obj
    :~  ['type' [%s 'notebook']]
        ['flag' [%s '~zod/foo']]
        ['action' inner]
    ==
  =/  parsed=action:n  (action:dejs:notes-json jon)
  =/  expected=action:n
    :*  %notebook
        [~zod %foo]
        :*  %batch-import-tree
            2
            ~[[%folder 'sub' ~[[%note 'README' 'hello']]]]
        ==
    ==
  (ex-equal !>(parsed) !>(expected))
::  ====  test-json-decode-create-folder-no-parent  ====
::  parent is required; a create-folder without it must fail to decode
::  (the HTTP boundary turns that into a 400) rather than silently
::  defaulting a parent.
::
++  test-json-decode-create-folder-no-parent
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  inner=json
    %-  mk-obj
    :~  ['type' [%s 'create-folder']]
        ['name' [%s 'docs']]
    ==
  =/  jon=json
    %-  mk-obj
    :~  ['type' [%s 'notebook']]
        ['flag' [%s '~zod/foo']]
        ['action' inner]
    ==
  |=  s2=state
  =/  res  (mule |.((action:dejs:notes-json jon)))
  ?:  ?=(%& -.res)
    |+['expected create-folder decode to fail without parent']~
  &+[~ s2]
::  ====  test-json-decode-create-folder-with-parent  ====
::
++  test-json-decode-create-folder-with-parent
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  =/  inner=json
    %-  mk-obj
    :~  ['type' [%s 'create-folder']]
        ['parent' (mk-num 2)]
        ['name' [%s 'subdir']]
    ==
  =/  jon=json
    %-  mk-obj
    :~  ['type' [%s 'notebook']]
        ['flag' [%s '~zod/foo']]
        ['action' inner]
    ==
  =/  parsed=action:n  (action:dejs:notes-json jon)
  =/  expected=action:n
    [%notebook [~zod %foo] [%create-folder 2 'subdir']]
  (ex-equal !>(parsed) !>(expected))
::  ====  v1 / request-id surface tests  ====================================
::
::  ====  test-v1-create-notebook-returns-summary  ====
::  Top-level v1 %create-notebook: the request must finalize with a
::  %notebook body carrying the new notebook's flag + metadata, so a
::  caller learns the slugified flag without re-scrying.
::
++  test-v1-create-notebook-returns-summary
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  =/  rid=request-id:v1:n  0v1
  ;<  caz=(list card)  b  (poke-a-v1 [rid [%create-notebook 'V1 NB']])
  ;<  ~  b  (ex-cards-ne caz)
  ;<  sv=vase  b  get-save
  =/  s=state-15:n  !<(state-15:n sv)
  =/  f=flag:n  (nb-flag our.bowl 'V1 NB' 1)
  |=  s2=state
  ?~  req=(~(get by requests.s) rid)
    |+['expected requests entry after v1 poke']~
  ?~  result.u.req
    |+['expected result on terminal request']~
  ?.  ?=(%notebook -.u.result.u.req)
    |+~[(crip "expected %notebook result, got {<-.u.result.u.req>}")]
  ?.  =(flag.summary.u.result.u.req f)
    |+['response summary carries the wrong flag']~
  ?~  final-at.u.req
    |+['expected final-at set on terminal request']~
  ?.  (~(has by books.s) f)
    |+['expected notebook to be created via v1 poke']~
  &+[~ s2]
::  ====  test-v1-post-omitted-requestid-mints-one  ====
::  A POST with no requestId (common for LLM tool-callers) must NOT 500
::  — the server mints one, creates the notebook, returns 200.
::
++  test-v1-post-omitted-requestid-mints-one
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  sv0=vase  b  get-save
  =/  s0=state-15:n  !<(state-15:n sv0)
  =/  key=@t  ?~(api-key.s0 '' u.api-key.s0)
  =/  body=@t  '{"action":{"type":"create-notebook","title":"NoRid"}}'
  ;<  caz=(list card)  b  (http-post-v1 ~[['x-api-key' key]] body)
  =/  f=flag:n  (nb-flag our.bowl 'NoRid' 1)
  ;<  sv=vase  b  get-save
  =/  s=state-15:n  !<(state-15:n sv)
  |=  s2=state
  ?~  api-key.s0  |+['no api-key after init']~
  ::  must not have 500'd — header card present, status 200
  =/  st=(unit @ud)  (http-status caz)
  ?.  =(st `200)
    |+~[(crip "expected 200 for requestId-less POST, got {<st>}")]
  ?.  (~(has by books.s) f)
    |+['notebook not created from requestId-less POST']~
  &+[~ s2]
::  ====  test-v1-post-garbage-requestid-no-500  ====
::  A non-@uv requestId must be tolerated (server mints), not crash.
::
++  test-v1-post-garbage-requestid-no-500
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  sv0=vase  b  get-save
  =/  s0=state-15:n  !<(state-15:n sv0)
  =/  key=@t  ?~(api-key.s0 '' u.api-key.s0)
  =/  body=@t
    '{"requestId":"not-a-valid-uv-!!","action":{"type":"create-notebook","title":"Garbage"}}'
  ;<  caz=(list card)  b  (http-post-v1 ~[['x-api-key' key]] body)
  =/  f=flag:n  (nb-flag our.bowl 'Garbage' 1)
  ;<  sv=vase  b  get-save
  =/  s=state-15:n  !<(state-15:n sv)
  |=  s2=state
  ?~  api-key.s0  |+['no api-key after init']~
  =/  st=(unit @ud)  (http-status caz)
  ?.  =(st `200)
    |+~[(crip "expected 200 for garbage requestId, got {<st>}")]
  ?.  (~(has by books.s) f)
    |+['notebook not created from garbage-requestId POST']~
  &+[~ s2]
::  ====  test-rest-create-notebook  ====
::  POST /notes/~/v1/notebooks {title} → 200 + notebook created.
::
++  test-rest-create-notebook
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  sv0=vase  b  get-save
  =/  s0=state-15:n  !<(state-15:n sv0)
  =/  key=@t  ?~(api-key.s0 '' u.api-key.s0)
  ;<  caz=(list card)  b
    (http-req-v1 %'POST' ~[['x-api-key' key]] '/notes/~/v1/notebooks' '{"title":"RestNB"}')
  =/  f=flag:n  (nb-flag our.bowl 'RestNB' 1)
  ;<  sv=vase  b  get-save
  =/  s=state-15:n  !<(state-15:n sv)
  |=  s2=state
  ?~  api-key.s0  |+['no api-key']~
  ?.  =((http-status caz) `200)
    |+~[(crip "create-notebook POST not 200: {<(http-status caz)>}")]
  ?.  (~(has by books.s) f)
    |+['notebook not created via REST POST']~
  &+[~ s2]
::  ====  test-rest-create-update-delete-note  ====
::  Full note lifecycle through the first-class endpoints (state-asserted;
::  the held-open HTTP response doesn't finalize in test-agent since fact
::  delivery isn't simulated, but the drained self-poke mutates state).
::
++  test-rest-create-update-delete-note
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  sv0=vase  b  get-save
  =/  s0=state-15:n  !<(state-15:n sv0)
  =/  key=@t  ?~(api-key.s0 '' u.api-key.s0)
  =/  hdr=(list [@t @t])  ~[['x-api-key' key]]
  ::  notebook id=1, root folder id=2
  ;<  *  b  (poke-a [%create-notebook 'NoteLife'])
  =/  f=flag:n  (nb-flag our.bowl 'NoteLife' 1)
  =/  base=@t  (crip "/notes/~/v1/notebooks/{<`@p`our.bowl>}/{(trip name.f)}")
  ::  create note (folder 2) → note id 3
  ;<  *  b  (http-req-v1 %'POST' hdr (cat 3 base '/notes') '{"folder":2,"title":"L","body":"v0"}')
  ;<  svc=vase  b  get-save
  =/  sc=state-15:n  !<(state-15:n svc)
  =/  entry-c  (~(get by books.sc) f)
  ::  update body via PUT (no expectedRevision)
  ;<  *  b  (http-req-v1 %'PUT' hdr (cat 3 base '/notes/3') '{"body":"v1"}')
  ;<  svu=vase  b  get-save
  =/  su=state-15:n  !<(state-15:n svu)
  ::  delete via DELETE
  ;<  *  b  (http-req-v1 %'DELETE' hdr (cat 3 base '/notes/3') '')
  ;<  svd=vase  b  get-save
  =/  sd=state-15:n  !<(state-15:n svd)
  |=  s2=state
  ?~  api-key.s0  |+['no api-key']~
  ?~  entry-c  |+['notebook gone after create-note']~
  ?.  (~(has by notes.notebook-state.u.entry-c) 3)
    |+['note not created via REST POST']~
  =/  entry-u  (~(get by books.su) f)
  ?~  entry-u  |+['notebook gone after PUT']~
  ?~  note-u=(~(get by notes.notebook-state.u.entry-u) 3)
    |+['note gone after PUT']~
  ?.  =(body-md.u.note-u 'v1')
    |+~[(crip "PUT didn't update body: {<body-md.u.note-u>}")]
  =/  entry-d  (~(get by books.sd) f)
  ?~  entry-d  |+['notebook gone after DELETE']~
  ?:  (~(has by notes.notebook-state.u.entry-d) 3)
    |+['note still present after DELETE']~
  &+[~ s2]
::  ====  test-rest-put-folder-rename-and-move  ====
::  PUT /folders/{id} with both name and parent applies both changes
::  in one update. Setup: notebook 1, root 2; create sub-A=3 under root,
::  sub-B=4 under root; PUT folder 3 with new name + new parent=4. Expect
::  folder 3 to be renamed and re-parented under 4.
::
++  test-rest-put-folder-rename-and-move
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'PutFld'])
  =/  f=flag:n  (nb-flag our.bowl 'PutFld' 1)
  ;<  *  b  (poke-a [%notebook f [%create-folder 2 'A']])
  ;<  *  b  (poke-a [%notebook f [%create-folder 2 'B']])
  ;<  sv0=vase  b  get-save
  =/  s0=state-15:n  !<(state-15:n sv0)
  =/  key=@t  ?~(api-key.s0 '' u.api-key.s0)
  =/  hdr=(list [@t @t])  ~[['x-api-key' key]]
  =/  base=@t  (crip "/notes/~/v1/notebooks/{<`@p`our.bowl>}/{(trip name.f)}")
  ;<  *  b
    (http-req-v1 %'PUT' hdr (cat 3 base '/folders/3') '{"folderName":"A2","parent":4}')
  ;<  svu=vase  b  get-save
  =/  su=state-15:n  !<(state-15:n svu)
  |=  s2=state
  ?~  api-key.s0  |+['no api-key']~
  ?~  entry=(~(get by books.su) f)  |+['notebook gone']~
  ?~  fld=(~(get by folders.notebook-state.u.entry) 3)
    |+['folder 3 gone']~
  ?.  =('A2' name.u.fld)
    |+~[(crip "PUT didn't rename: {<name.u.fld>}")]
  ?.  =(`4 parent-folder-id.u.fld)
    |+~[(crip "PUT didn't move: parent={<parent-folder-id.u.fld>}")]
  &+[~ s2]
::  ====  test-rest-put-note-rename-and-move  ====
::  PUT /notes/{id} with title + folder (no body) renames and moves the
::  note in one atomic edit. Setup: notebook 1, root 2, sub=3 under root,
::  note=4 under root. PUT note 4 → new title + parent 3.
::
++  test-rest-put-note-rename-and-move
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'PutNote'])
  =/  f=flag:n  (nb-flag our.bowl 'PutNote' 1)
  ;<  *  b  (poke-a [%notebook f [%create-folder 2 'sub']])
  ;<  *  b  (poke-a [%notebook f [%create-note 2 'old' 'b']])
  ;<  sv0=vase  b  get-save
  =/  s0=state-15:n  !<(state-15:n sv0)
  =/  key=@t  ?~(api-key.s0 '' u.api-key.s0)
  =/  hdr=(list [@t @t])  ~[['x-api-key' key]]
  =/  base=@t  (crip "/notes/~/v1/notebooks/{<`@p`our.bowl>}/{(trip name.f)}")
  ;<  *  b
    (http-req-v1 %'PUT' hdr (cat 3 base '/notes/4') '{"title":"new","folder":3}')
  ;<  svu=vase  b  get-save
  =/  su=state-15:n  !<(state-15:n svu)
  |=  s2=state
  ?~  api-key.s0  |+['no api-key']~
  ?~  entry=(~(get by books.su) f)  |+['notebook gone']~
  ?~  note=(~(get by notes.notebook-state.u.entry) 4)
    |+['note 4 gone']~
  ?.  =('new' title.u.note)
    |+~[(crip "PUT didn't rename: {<title.u.note>}")]
  ?.  =(3 folder-id.u.note)
    |+~[(crip "PUT didn't move: folder={<folder-id.u.note>}")]
  &+[~ s2]
::  ====  test-rest-delete-folder-recursive  ====
::  DELETE /folders/{id}?recursive=true removes folder + descendants.
::  Setup: A=3 under root, leaf=4 under A. DELETE A with ?recursive=true.
::
++  test-rest-delete-folder-recursive
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'DelFld'])
  =/  f=flag:n  (nb-flag our.bowl 'DelFld' 1)
  ;<  *  b  (poke-a [%notebook f [%create-folder 2 'A']])
  ;<  *  b  (poke-a [%notebook f [%create-folder 3 'leaf']])
  ;<  sv0=vase  b  get-save
  =/  s0=state-15:n  !<(state-15:n sv0)
  =/  key=@t  ?~(api-key.s0 '' u.api-key.s0)
  =/  hdr=(list [@t @t])  ~[['x-api-key' key]]
  =/  base=@t  (crip "/notes/~/v1/notebooks/{<`@p`our.bowl>}/{(trip name.f)}")
  ;<  *  b
    (http-req-v1 %'DELETE' hdr (cat 3 base '/folders/3?recursive=true') '')
  ;<  svd=vase  b  get-save
  =/  sd=state-15:n  !<(state-15:n svd)
  |=  s2=state
  ?~  entry=(~(get by books.sd) f)  |+['notebook gone']~
  ?:  (~(has by folders.notebook-state.u.entry) 3)
    |+['folder 3 still present after recursive DELETE']~
  ?:  (~(has by folders.notebook-state.u.entry) 4)
    |+['leaf folder still present after recursive DELETE']~
  &+[~ s2]
::  ====  test-v1-regenerate-returns-key  ====
::  %regenerate-api-key must finalize with the new key in an %api-key body.
::
++  test-v1-regenerate-returns-key
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  =/  rid=request-id:v1:n  0v5.aaaaa
  ;<  *  b  (poke-a-v1 [rid [%regenerate-api-key ~]])
  ;<  sv=vase  b  get-save
  =/  s=state-15:n  !<(state-15:n sv)
  |=  s2=state
  ?~  req=(~(get by requests.s) rid)
    |+['expected requests entry']~
  ?~  result.u.req
    |+['expected result']~
  ?.  ?=(%api-key -.u.result.u.req)
    |+~[(crip "expected %api-key result, got {<-.u.result.u.req>}")]
  ?~  key.u.result.u.req
    |+['expected non-null key in response']~
  ?.  =(key.u.result.u.req api-key.s)
    |+['response key does not match stored key']~
  &+[~ s2]
::  ====  test-v1-read-notebooks  ====
::  GET /notes/~/v1/notebooks with a matching X-Api-Key returns 200 +
::  a JSON array of notebook summaries.
::
++  test-v1-read-notebooks
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  *  b  (poke-a [%create-notebook 'Readable'])
  ;<  sv=vase  b  get-save
  =/  s=state-15:n  !<(state-15:n sv)
  =/  key=@t  ?~(api-key.s '' u.api-key.s)
  ;<  caz=(list card)  b
    (http-get-v1 ~[['x-api-key' key]] '/notes/~/v1/notebooks')
  |=  s2=state
  ?~  api-key.s
    |+['no api-key after init']~
  =/  st=(unit @ud)  (http-status caz)
  ?.  =(st `200)
    |+~[(crip "expected 200 from notebooks read, got {<st>}")]
  &+[~ s2]
::  ====  test-v1-read-requires-auth  ====
::  GET read endpoints reject unauthenticated callers.
::
++  test-v1-read-requires-auth
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  caz=(list card)  b  (http-get-v1 ~ '/notes/~/v1/notebooks')
  |=  s=state
  =/  st=(unit @ud)  (http-status caz)
  ?.  =(st `401)
    |+~[(crip "expected 401 from unauthenticated read, got {<st>}")]
  &+[~ s]
::  +ex-get-200: GET a v1 read url with the given headers and assert 200.
::  A 200 confirms routing matched, auth passed, and no-read-json returned
::  data (a 404 would mean the path shape wasn't recognized).
::
++  ex-get-200
  |=  [hdrs=(list [@t @t]) url=@t]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  caz=(list card)  bind:m  (http-get-v1 hdrs url)
  |=  s=state
  ?.  =((http-status caz) `200)
    |+~[(crip "GET {(trip url)} expected 200, got {<(http-status caz)>}")]
  &+[~ s]
::  ====  test-v1-read-all-endpoints  ====
::  Exercises every GET read shape (+ POST folders write) in one go. A
::  notebook (id 1, root folder 2), a note (id 3) and a sub-folder (id 4)
::  are set up, then each read endpoint must 200.
::
++  test-v1-read-all-endpoints
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'AllReads'])
  =/  f=flag:n  (nb-flag our.bowl 'AllReads' 1)
  ;<  sv0=vase  b  get-save
  =/  s0=state-15:n  !<(state-15:n sv0)
  =/  key=@t  ?~(api-key.s0 '' u.api-key.s0)
  =/  hdr=(list [@t @t])  ~[['x-api-key' key]]
  =/  base=@t  (crip "/notes/~/v1/notebooks/{<`@p`our.bowl>}/{(trip name.f)}")
  ::  POST note (folder 2 = root) → id 3
  ;<  *  b  (http-req-v1 %'POST' hdr (cat 3 base '/notes') '{"folder":2,"title":"N","body":"b"}')
  ::  POST sub-folder (parent 2) → id 4  [covers POST .../folders]
  ;<  *  b  (http-req-v1 %'POST' hdr (cat 3 base '/folders') '{"parent":2,"folderName":"sub"}')
  ;<  svw=vase  b  get-save
  =/  sw=state-15:n  !<(state-15:n svw)
  ::  GET every read shape
  ;<  ~  b  (ex-get-200 hdr '/notes/~/v1/notebooks')
  ;<  ~  b  (ex-get-200 hdr base)
  ;<  ~  b  (ex-get-200 hdr (cat 3 base '/folders'))
  ;<  ~  b  (ex-get-200 hdr (cat 3 base '/folders/2'))
  ;<  ~  b  (ex-get-200 hdr (cat 3 base '/notes'))
  ;<  ~  b  (ex-get-200 hdr (cat 3 base '/notes/3'))
  ;<  ~  b  (ex-get-200 hdr (cat 3 base '/notes/3/history'))
  ;<  ~  b  (ex-get-200 hdr (cat 3 base '/members'))
  ;<  ~  b  (ex-get-200 hdr '/notes/~/v1/invites')
  |=  s2=state
  ?~  api-key.s0  |+['no api-key']~
  ?~  entry=(~(get by books.sw) f)  |+['notebook gone']~
  ::  POST .../folders created folder id 4
  ?.  (~(has by folders.notebook-state.u.entry) 4)
    |+['POST .../folders did not create the sub-folder']~
  &+[~ s2]
::  ====  test-rest-write-requires-auth  ====
::  Write endpoints reject unauthenticated callers — POST /notebooks with
::  no cookie/key → 401 and no notebook created.
::
++  test-rest-write-requires-auth
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  caz=(list card)  b
    (http-req-v1 %'POST' ~ '/notes/~/v1/notebooks' '{"title":"NoAuthNB"}')
  =/  f=flag:n  (nb-flag our.bowl 'NoAuthNB' 1)
  ;<  sv=vase  b  get-save
  =/  s=state-15:n  !<(state-15:n sv)
  |=  s2=state
  ?.  =((http-status caz) `401)
    |+~[(crip "expected 401 for unauth write, got {<(http-status caz)>}")]
  ?:  (~(has by books.s) f)
    |+['unauthorized write created a notebook']~
  &+[~ s2]
::  ====  test-v1-notebook-action-emits-cards  ====
::  Notebook-scoped v1 action routes through no-action-v1: must emit a host
::  %watch on the per-request path, a %poke with notes-command-1, and a behn
::  %wait for the per-request timeout.
::
++  test-v1-notebook-action-emits-cards
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'V1 Cards'])
  =/  f=flag:n  (nb-flag our.bowl 'V1 Cards' 1)
  =/  rid=request-id:v1:n  0v2
  ;<  caz=(list card)  b
    (poke-a-v1 [rid [%notebook f [%create-note 2 'V1 Note' 'body']]])
  |=  s=state
  =/  exp-watch-path=path
    :+  %v1  %notes
    /(scot %p ship.f)/[name.f]/request/(scot %p our.bowl)/(scot %uv rid)
  =/  exp-wait-wire=wire
    /notes/req/(scot %p ship.f)/[name.f]/(scot %uv rid)/wake
  ?.  (has-watch-on-path caz exp-watch-path)
    |+~[(crip "v1: missing watch card on {<exp-watch-path>}")]
  ?.  (has-poke-mark caz %notes-command-1)
    |+['v1: missing %notes-command-1 poke card']~
  ?.  (has-wait-on-wire caz exp-wait-wire)
    |+~[(crip "v1: missing behn wait on {<exp-wait-wire>}")]
  &+[~ s]
::  ====  test-v1-command-emits-response-update-fact  ====
::  Host-side: poke notes-command-1 from owner; expect se-emit-final-response
::  to give a %fact with mark notes-response-update-1. (Path scoping by src
::  is covered in app code, not asserted here — keeps the test resilient to
::  internal path tweaks.)
::
++  test-v1-command-emits-response-update-fact
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  *  b  (poke-a [%create-notebook 'V1 Cmd'])
  =/  f=flag:n  (nb-flag our.bowl 'V1 Cmd' 1)
  =/  rid=request-id:v1:n  0v3
  ;<  caz=(list card)  b
    (poke-c-v1 [rid [%notebook f [%create-note 2 'V1 Note' 'b']]])
  |=  s=state
  ?.  (has-fact-mark caz %notes-response-update-1)
    |+['v1: missing notes-response-update-1 fact after command']~
  &+[~ s]
::  ====  test-v1-action-json-decode  ====
::  Parse a JSON v1 action and assert request-id + nested a-notes decode.
::
++  test-v1-action-json-decode
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  |=  s=state
  =/  src=@t
    '{"requestId":"0v1","action":{"type":"create-notebook","title":"From JSON"}}'
  =/  jon=(unit json)  (de:json:html src)
  ?~  jon
    |+['failed to parse json source']~
  =/  act=action:v1:n  (action:v1:dejs:notes-json u.jon)
  ?.  =(request-id.act 0v1)
    |+~[(crip "expected request-id 0v1, got {<request-id.act>}")]
  ?.  ?=(%create-notebook -.a-notes.act)
    |+['expected %create-notebook a-notes tag']~
  ?.  =(title.a-notes.act 'From JSON')
    |+['expected title preserved through v1 json decode']~
  &+[~ s]
::  ====  X-Api-Key auth tests  ============================================
::
::  ====  test-api-key-minted-on-init  ====
::  Fresh install should populate api-key so the bypass is usable.
::
++  test-api-key-minted-on-init
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  sv=vase  b  get-save
  =/  s=state-15:n  !<(state-15:n sv)
  |=  s2=state
  ?~  api-key.s
    |+['expected api-key generated on init']~
  &+[~ s2]
::  ====  test-api-key-regenerate-changes-value  ====
::  %regenerate-api-key should replace the stored key with a fresh one.
::
++  test-api-key-regenerate-changes-value
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  sv1=vase  b  get-save
  =/  s1=state-15:n  !<(state-15:n sv1)
  =/  old-key=(unit @t)  api-key.s1
  ::  bump eny so the new key differs deterministically
  ;<  ~  b  (jab-bowl |=(=bowl bowl(eny ^~((shaz 'regen-test')))))
  ;<  *  b  (poke-a-v1 [0v1.aaaaa [%regenerate-api-key ~]])
  ;<  sv2=vase  b  get-save
  =/  s2=state-15:n  !<(state-15:n sv2)
  |=  s3=state
  ?~  old-key
    |+['no api-key after init']~
  ?~  api-key.s2
    |+['api-key cleared instead of regenerated']~
  ?:  =(u.old-key u.api-key.s2)
    |+['api-key unchanged after regenerate']~
  &+[~ s3]
::  ====  test-register-mcp-emits-cards  ====
::  %register-mcp emits two pokes at [%mcp-proxy our] carrying the
::  mcp-proxy-action mark: first %add-server, then %refresh-spec.
::  Mints the api-key on the way through if missing.
::
++  test-register-mcp-emits-cards
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  *  b  (poke-a-v1 [0v2.bbbbb [%clear-api-key ~]])
  ;<  caz=(list card)  b
    (poke-a-v1 [0v3.ccccc [%register-mcp `'http://localhost:8080']])
  ;<  sv=vase  b  get-save
  =/  s=state-15:n  !<(state-15:n sv)
  |=  s2=state
  ?:  =(0 (lent (skim caz |=(c=card ?=([%pass * %agent * %poke %mcp-proxy-action *] c)))))
    |+['no mcp-proxy-action poke emitted']~
  ?.  ?=(^ api-key.s)
    |+['api-key not minted by register-mcp']~
  &+[~ s2]
::  ====  test-api-key-clear-disables-bypass  ====
::
++  test-api-key-clear-disables-bypass
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  *  b  (poke-a-v1 [0v1.aaaaa [%clear-api-key ~]])
  ;<  sv=vase  b  get-save
  =/  s=state-15:n  !<(state-15:n sv)
  |=  s2=state
  ?^  api-key.s
    |+['expected api-key cleared']~
  &+[~ s2]
::  ====  test-x-api-key-bypasses-cookie  ====
::  POST without eyre auth but with the matching X-Api-Key creates the
::  notebook end-to-end.
::
++  test-x-api-key-bypasses-cookie
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  ;<  sv1=vase  b  get-save
  =/  s1=state-15:n  !<(state-15:n sv1)
  =/  maybe-key=(unit @t)  api-key.s1
  =/  key=@t  ?~(maybe-key '' u.maybe-key)
  =/  body=@t  '{"requestId":"0v9.aaaaa","action":{"type":"create-notebook","title":"VKey"}}'
  ;<  caz=(list card)  b  (http-post-v1 ~[['x-api-key' key]] body)
  =/  f=flag:n  (nb-flag our.bowl 'VKey' 1)
  ;<  sv2=vase  b  get-save
  =/  s2=state-15:n  !<(state-15:n sv2)
  |=  s3=state
  ?~  maybe-key
    |+['no api-key after init']~
  ?~  caz
    |+['no cards emitted from http-post']~
  ?.  (~(has by books.s2) f)
    |+['expected notebook created via X-Api-Key auth']~
  &+[~ s3]
::  ====  test-x-api-key-wrong-rejects  ====
::  POST with a non-matching X-Api-Key must NOT apply the action. We
::  rely on state inspection rather than http-response status extraction
::  since the agent emits the 401 as %give cards and the assert is the
::  same either way (action didn't take).
::
++  test-x-api-key-wrong-rejects
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  =/  body=@t  '{"requestId":"0v9.bbbbb","action":{"type":"create-notebook","title":"WrongKey"}}'
  ;<  *  b  (http-post-v1 ~[['x-api-key' 'definitely-not-the-key']] body)
  =/  f=flag:n  (nb-flag our.bowl 'WrongKey' 1)
  ;<  sv=vase  b  get-save
  =/  s=state-15:n  !<(state-15:n sv)
  |=  s2=state
  ?:  (~(has by books.s) f)
    |+['unauthorized request created a notebook']~
  &+[~ s2]
::  ====  test-v1-get-request-requires-auth  ====
::  GET /notes/~/v1/request/<uv> must NOT return a request's body to an
::  unauthenticated caller. The request-id is not a capability.
::
++  test-v1-get-request-requires-auth
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ::  pre-register a request directly via poke so we know the rid
  ;<  *  b  (poke-a-v1 [0v1.deadc.0ffee [%create-notebook 'PriorPost']])
  ;<  caz=(list card)  b
    (http-get-v1 ~ '/notes/~/v1/request/0v1.deadc.0ffee')
  |=  s=state
  =/  st=(unit @ud)  (http-status caz)
  ?~  st
    |+['expected http response header card']~
  ?:  =(u.st 200)
    |+~[(crip "auth bypassed: 200 to unauthenticated GET /v1/request/<uv>")]
  ?.  =(u.st 401)
    |+~[(crip "unexpected GET status {<u.st>}, want 401")]
  &+[~ s]
::  ====  test-v1-get-request-honors-api-key  ====
::  GET with a matching X-Api-Key must succeed (200) — sanity check
::  that the auth gate isn't blocking the legitimate poll path.
::
++  test-v1-get-request-honors-api-key
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  *  b  (poke-a-v1 [0v2.aaaaa.bbbbb [%create-notebook 'KeyPoll']])
  ;<  sv=vase  b  get-save
  =/  s=state-15:n  !<(state-15:n sv)
  =/  maybe-key=(unit @t)  api-key.s
  =/  key=@t  ?~(maybe-key '' u.maybe-key)
  ;<  caz=(list card)  b
    (http-get-v1 ~[['x-api-key' key]] '/notes/~/v1/request/0v2.aaaaa.bbbbb')
  |=  s2=state
  ?~  maybe-key
    |+['no api-key after init']~
  =/  st=(unit @ud)  (http-status caz)
  ?~  st
    |+['expected http response header card']~
  ?.  =(u.st 200)
    |+~[(crip "expected 200 with valid api-key, got {<u.st>}")]
  &+[~ s2]
::  ====  test-failed-join-cleans-up-placeholder  ====
::  Pre-join writes a placeholder to books before sending the v1 request.
::  If the host nacks the poke, the placeholder must be rolled back so
::  the user isn't stuck with a ghost notebook they can't re-join.
::
::  We extract the actual poke-wire from the cards emitted by the join
::  (rather than reconstructing it from rid synthesis details) so the
::  test stays aligned with the agent if the wire encoding ever changes.
::
++  test-failed-join-cleans-up-placeholder
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  init-zod
  ;<  =bowl:gall  b  get-bowl
  =/  remote-flag=flag:n  [~bus %ghost-test]
  ;<  caz=(list card)  b  (poke-a [%join remote-flag])
  ;<  sv1=vase  b  get-save
  =/  s1=state-15:n  !<(state-15:n sv1)
  =/  pre-has=?  (~(has by books.s1) remote-flag)
  =/  poke-wire=(unit wire)  (find-poke-wire caz)
  ::  Crash the test if no poke wire was emitted — that itself would be
  ::  a regression in the cross-ship send path.
  ~|  %no-poke-wire-emitted-by-join
  ?>  ?=(^ poke-wire)
  =/  nack-sign=sign:agent:gall
    [%poke-ack `~[leaf+"host rejected"]]
  ;<  *  b  (do-agent-drain u.poke-wire [~bus %notes] nack-sign)
  ;<  sv2=vase  b  get-save
  =/  s2=state-15:n  !<(state-15:n sv2)
  |=  s3=state
  ?.  pre-has
    |+['placeholder missing after join initiated']~
  ?:  (~(has by books.s2) remote-flag)
    |+['placeholder not cleaned up after failed join']~
  &+[~ s3]
::  ====  JSON encoder tests  ===============================================
::
::  ====  test-json-encode-snapshot-carries-visibility  ====
::  Regression: snapshot must include visibility so subscribers can seed it.
::
++  test-json-encode-snapshot-carries-visibility
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  |=  s=state
  =/  nb=notebook:n
    [1 'Test' ~zod ~1970.1.1 ~1970.1.1 ~zod]
  =/  nb-s=notebook-state:n  [nb ~ %private ~ ~ ~ ~]
  =/  res=response:n  [%snapshot [~zod %foo] %public nb-s]
  =/  jon=json  (response:enjs:notes-json res)
  ?.  ?=([%o *] jon)
    |+['expected json object']~
  =/  vis=(unit json)  (~(get by p.jon) 'visibility')
  ?~  vis
    |+['snapshot missing visibility field']~
  &+[~ s]
::
--

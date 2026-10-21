::  tests for %presence
::
::    expiry timers on the subscriber's ship: every incoming %set fact
::    arms its own expiry timer without cancelling prior ones, so a wake
::    from a stale timer must not delete presence that fresher %sets have
::    kept alive.
::
::    subscription nacks on the subscriber's ship: we retry with backoff,
::    the retry wake drops a channel we can no longer read (deleted from
::    its group, or we lost access), and we give up after +max-tries.
::    a nack is a crash on the host's end, so it is reported with +fail
::    at a volume that says how much it matters: %info while retrying,
::    %warn on giving up. dropping a context is +tell; nothing crashed.
::
::    participant checks on the host's ship: a context watch by a ship
::    that cannot read the channel is rejected, with a hint saying why.
::
/-  p=presence, gv=groups-ver, cv=channels-ver, l=logs
/+  *test-agent
/=  agent  /app/presence
|%
++  dap   %presence
++  t0    ~2024.1.1
++  host  ~ten
::  we are ~zod, in a dm with ~ten. the host (~ten) keys the dm context
::  by the subscriber, /dm/~zod; on receipt we translate it to /dm/~ten.
::
++  sub-wire     `wire`/context-2/dm/(scot %p ~zod)
++  expire-wire  `wire`/expire/(scot %p host)/computing/dm/(scot %p host)
++  key-theirs   `key:p`[/dm/(scot %p ~zod) host %computing]
++  key-ours     `key:p`[/dm/(scot %p host) host %computing]
++  display      `display:p`[~ `'Thinking...' ~]
::
++  setup
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our ~zod, src ~zod)))
  ;<  *  bind:m  (do-init dap agent)
  ::  register our outgoing subscription to the dm host,
  ::  so the harness accepts incoming %facts on the context wire
  ::
  ;<  ~  bind:m
    %-  jab-bowl
    |=  b=bowl
    b(now t0, wex (~(put by wex.b) [sub-wire host dap] [& /v1/(scot %p ~zod)]))
  (pure:m ~)
::
::  an incoming %set fact from the host, timeout ~ (default %computing ~m1)
::
++  do-set-fact
  |=  since=@da
  =/  m  (mare ,(list card))
  ^-  form:m
  %+  do-agent  sub-wire
  :-  [host dap]
  [%fact %presence-update-1 !>(`update-1:p`[%set key-theirs [since ~] display])]
::
++  do-wake
  (do-arvo expire-wire [%behn %wake ~])
::
::  a %set fact stores the (translated) entry, gives %here, arms a timer
::
++  test-set-fact-stores-and-arms-timer
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  caz=(list card)  bind:m  (do-set-fact t0)
  %+  ex-cards  caz
  :~  (ex-fact ~[/v1] %presence-response-1 !>(`response-1:p`[%here key-ours [t0 ~] display]))
      (ex-arvo expire-wire [%b %wait (add t0 ~m1)])
  ==
::
::  a stale timer's wake must not delete presence refreshed by a later %set;
::  once the entry has truly expired, the wake deletes it and gives %gone
::
++  test-stale-expire-preserves-fresh-presence
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  *  bind:m  (do-set-fact t0)
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now (add t0 ~s30))))
  ;<  *  bind:m  (do-set-fact (add t0 ~s30))
  ::  first timer fires at t0+60s. the second %set keeps the entry
  ::  fresh until t0+90s, so this wake must be a no-op.
  ::
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now (add t0 ~s61))))
  ;<  caz=(list card)  bind:m  do-wake
  ;<  ~  bind:m  (ex-cards caz ~)
  ::  second timer fires at t0+90s. the entry has truly expired,
  ::  so this wake deletes it and notifies subscribers.
  ::
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now (add t0 ~s91))))
  ;<  caz=(list card)  bind:m  do-wake
  %+  ex-cards  caz
  [(ex-fact ~[/v1] %presence-response-1 !>(`response-1:p`[%gone key-ours]))]~
::
::  a wake for an entry we no longer have (eg cleared early) is a no-op
::
++  test-expire-wake-without-entry-is-noop
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(now (add t0 ~m5))))
  ;<  caz=(list card)  bind:m  do-wake
  (ex-cards caz ~)
::
::  virtual-identity (bot moon) presence.
::  ~doznec-sampel-palnet is a moon sponsored by ~sampel-palnet.
++  vhost   ~sampel-palnet
++  vmoon   ~doznec-sampel-palnet
++  human   ~zod
++  vctx    `context:p`/vouched/(scot %p vmoon)/dm/(scot %p human)
++  vkey    `key:p`[vctx vmoon %computing]
++  vsub    `path`/context/(scot %p human)/vouched/(scot %p vmoon)/dm/(scot %p human)
::  a second moon (same sponsor as .vmoon, but a distinct ship), used where
::  a test needs a moon that %vouch classifies %real instead of %bot.
++  rmoon   `ship`(add (bex 32) vhost)
::  a plain (non-moon) ship, for contrast with .vmoon/.rmoon in routing tests
++  splanet  ~bus
::  scry mock for %vouch/status of a single moon, used by the host-gate
::  tests below (+is-participant's vouched arm).
::
++  host-vouch-scries
  |=  status=?(%unknown %real %bot)
  |=  =path
  ^-  (unit vase)
  ?:  ?=([%gx @ %vouch @ %status @ *] path)
    `!>(`?(%unknown %real %bot)`status)
  ~
::  the moon's host (us) fans the moon's %computing presence to a human who
::  subscribed to us for it, attributing it to the moon.
++  test-vouched-presence-host-fans
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our vhost, src vhost, now t0)))
  ;<  *  bind:m  (do-init dap agent)
  ::  %vouch classifies the moon a bot, so the host will serve the watch
  ::
  ;<  ~  bind:m  (set-scry-gate (host-vouch-scries %bot))
  ::  the human subscribes to the moon's presence via us (its sponsor)
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(src human)))
  ;<  *  bind:m  (do-watch vsub)
  ::  openclaw (running on us) sets the moon's computing presence
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(src vhost, now t0)))
  ;<  caz=(list card)  bind:m
    %+  do-poke  %presence-command-1
    !>(`command-1:p`[%set ~ vkey [t0 ~] display])
  %+  ex-cards  caz
  :~  (ex-fact ~[/v1] %presence-response-1 !>(`response-1:p`[%here vkey [t0 ~] display]))
      %+  ex-arvo
        `wire`/expire/(scot %p vmoon)/computing/vouched/(scot %p vmoon)/dm/(scot %p human)
      [%b %wait (add t0 ~m1)]
      (ex-fact ~[vsub] %presence-update-1 !>(`update-1:p`[%set vkey [t0 ~] display]))
  ==
::  the human hears the moon's presence from the host and re-keys it to the
::  moon's dm, so it displays like any other dm presence for that moon.
++  test-vouched-presence-receipt
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our human, src human, now t0)))
  ;<  *  bind:m  (do-init dap agent)
  ::  register our outgoing sub to the host for the moon's presence
  ;<  ~  bind:m
    %-  jab-bowl
    |=  b=bowl
    =/  w=wire  /context-2/vouched/(scot %p vmoon)/dm/(scot %p human)
    b(now t0, wex (~(put by wex.b) [w vhost dap] [& vsub]))
  =/  ours  `key:p`[/dm/(scot %p vmoon) vmoon %computing]
  ;<  caz=(list card)  bind:m
    %+  do-agent  `wire`/context-2/vouched/(scot %p vmoon)/dm/(scot %p human)
    :-  [vhost dap]
    [%fact %presence-update-1 !>(`update-1:p`[%set vkey [t0 ~] display])]
  %+  ex-cards  caz
  :~  (ex-fact ~[/v1] %presence-response-1 !>(`response-1:p`[%here ours [t0 ~] display]))
      %+  ex-arvo
        `wire`/expire/(scot %p vmoon)/computing/dm/(scot %p vmoon)
      [%b %wait (add t0 ~m1)]
  ==
::  a watch for the vouched context is only served when our own %vouch store
::  actually classifies the moon a bot -- a moon that has turned out to be
::  real (or that we simply don't know about yet) gets nothing to relay.
::  the subscriber's normal watch-nack retry (and the next setup cycle, once
::  the contacts resolver's %vouch-real redirect updates the store) is
::  expected to re-decide from there.
::
++  test-vouched-presence-host-rejects-real
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our vhost, src vhost, now t0)))
  ;<  *  bind:m  (do-init dap agent)
  ;<  ~  bind:m  (set-scry-gate (host-vouch-scries %real))
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(src human)))
  (ex-fail (do-watch vsub))
::
++  test-vouched-presence-host-rejects-unknown
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our vhost, src vhost, now t0)))
  ;<  *  bind:m  (do-init dap agent)
  ;<  ~  bind:m  (set-scry-gate (host-vouch-scries %unknown))
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(src human)))
  (ex-fail (do-watch vsub))
::  +setup-scries: mocks for a full %setup inflate -- chat's dm-partner set
::  (a single .partner), an empty channels map (so +channel-contexts
::  contributes nothing), and %vouch's classification of .partner.
::
++  setup-scries
  |=  [partner=ship status=?(%unknown %real %bot)]
  |=  =path
  ^-  (unit vase)
  ?:  ?=([%gu @ ?(%groups %channels %chat) @ *] path)
    `!>(&)
  ?:  ?=([%gx @ %chat @ %dm %ships ~] path)
    `!>(`(set ship)`(silt ~[partner]))
  ?:  ?=([%gx @ %channels @ %v4 %channels %channels-4 ~] path)
    `!>(*channels:v9:cv)
  ?:  ?=([%gx @ %vouch @ %status @ *] path)
    `!>(`?(%unknown %real %bot)`status)
  ~
::  +exp-watch: the card +watch-context emits, subscribing .human to .ship
::  for .context.
::
++  exp-watch
  |=  [=ship context=context:p]
  %^  ex-task  [%context-2 context]  [ship %presence]
  [%watch-as %presence-update-1 [%context (scot %p human) context]]
::  a %setup inflate re-derives dm routing from %vouch on every cycle: a
::  moon classified %bot is watched via its sponsor on the vouched context
::  (it never boots); a moon already classified %real, or a plain ship, is
::  watched directly. each scenario runs against a fresh outgoing-sub set
::  (.wex reset between them) so the single dm partner is unambiguous.
::
++  test-setup-routes-by-vouch-status
  %-  eval-mare
  =/  m  (mare ,~)
  =*  b  bind:m
  ^-  form:m
  ;<  ~  b  (jab-bowl |=(byl=bowl byl(our human, src human, now t0)))
  ;<  *  b  (do-init dap agent)
  ::  a bot moon: routed through its sponsor on the vouched context
  ::
  ;<  ~  b  (set-scry-gate (setup-scries vmoon %bot))
  ;<  caz=(list card)  b  (do-arvo /setup [%behn %wake ~])
  ;<  ~  b
    %+  ex-cards  caz
    :~  (exp-watch vhost /vouched/(scot %p vmoon)/dm/(scot %p human))
        (ex-task /activity/all [human %activity] %watch /v4)
    ==
  ;<  ~  b  (jab-bowl |=(byl=bowl byl(wex ~)))
  ::  a moon %vouch already classifies %real: routed directly
  ::
  ;<  ~  b  (set-scry-gate (setup-scries rmoon %real))
  ;<  caz=(list card)  b  (do-arvo /setup [%behn %wake ~])
  ;<  ~  b
    %+  ex-cards  caz
    :~  (exp-watch rmoon /dm/(scot %p human))
        (ex-task /activity/all [human %activity] %watch /v4)
    ==
  ;<  ~  b  (jab-bowl |=(byl=bowl byl(wex ~)))
  ::  a plain (non-moon) ship: routed directly, %vouch never consulted
  ::
  ;<  ~  b  (set-scry-gate (setup-scries splanet %unknown))
  ;<  caz=(list card)  b  (do-arvo /setup [%behn %wake ~])
  ;<  ~  b
    %+  ex-cards  caz
    :~  (exp-watch splanet /dm/(scot %p human))
        (ex-task /activity/all [human %activity] %watch /v4)
    ==
  ;<  ~  b  (jab-bowl |=(byl=bowl byl(wex ~)))
  ::  OUR OWN moon that %vouch says is %real: watched directly like any
  ::  ship -- the self-hosted vouched route would be skipped by +inflate's
  ::  self-watch guard and we'd never see its presence
  ::
  ;<  ~  b  (jab-bowl |=(byl=bowl byl(our vhost, src vhost)))
  ;<  ~  b  (set-scry-gate (setup-scries vmoon %real))
  ;<  caz=(list card)  b  (do-arvo /setup [%behn %wake ~])
  %+  ex-cards  caz
  :~  %^  ex-task  [%context-2 /dm/(scot %p vhost)]  [vmoon %presence]
      [%watch-as %presence-update-1 [%context (scot %p vhost) /dm/(scot %p vhost)]]
      (ex-task /activity/all [vhost %activity] %watch /v4)
  ==
::
::  "any traffic from a moon is real": a moon watching our presence
::  directly (not via a sponsor's vouched context) is genuine network
::  traffic -- a bot moon never boots -- so we learn it %real organically,
::  even though %vouch doesn't yet know. a watch from a plain ship emits
::  no such card.
::
++  test-context-watch-from-moon-learns-real
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(our human, src human, now t0)))
  ;<  *  bind:m  (do-init dap agent)
  ;<  ~  bind:m  (set-scry-gate (host-vouch-scries %unknown))
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(src vmoon)))
  ;<  caz=(list card)  bind:m
    (do-watch `path`/context/(scot %p vmoon)/dm/(scot %p vmoon))
  ;<  ~  bind:m
    %+  ex-cards  caz
    :~  (ex-poke /vouch-learn [human %vouch] %vouch-learn !>([vmoon %real]))
    ==
  ::  a watch from a plain (non-moon) ship never emits a vouch-learn card
  ::
  ;<  ~  bind:m  (jab-bowl |=(b=bowl b(src splanet)))
  ;<  caz=(list card)  bind:m
    (do-watch `path`/context/(scot %p splanet)/dm/(scot %p splanet))
  (ex-cards caz ~)
::
++  test-state-2-resub
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m
    %-  jab-bowl
    |=  b=bowl
    =-  b(wex (~(gas by wex.b) -))
    :~  [[/context/dm/~zod ~fus dap] [| /context/~zod/dm/~zod]]
        [[/context/dm/~zod ~fun dap] [& /context/~zod/dm/~zod]]
    ==
  ;<  caz=(list card)  bind:m
    %+  do-load  agent
    %-  some  !>
    [%1 *places:p want=*(set [ship context:p]) subs=*(jug context:p ship) tries=*(map [ship context:p] @ud)]
  %+  ex-cards  caz
  :~  (ex-arvo /setup %b %wait t0)
      (ex-task /context/dm/~zod [~fus dap] %leave ~)
      (ex-task /context-2/dm/~zod [~fus dap] %watch-as %presence-update-1 /context/~zod/dm/~zod)
  ==
::
::  channel contexts. the channel /channel/chat/~ten/general belongs to
::  group ~ten/grp. the agent consults its local %channels (for the
::  channel's group) and %groups (for readability), which we mock.
::
++  group-flag    `flag:gv`[host %grp]
++  chan-context  `context:p`/channel/chat/(scot %p host)/general
++  chan-wire     `wire`[%context-2 chan-context]
++  chan-setup    `wire`[%setup (scot %p host) chan-context]
++  chan-watch    `path`[%context (scot %p ~zod) chan-context]
::  the same shape of channel, hosted by us
::
++  host-context  `context:p`/channel/chat/(scot %p ~zod)/general
::
::  mocked %channels and %groups: every channel is in .group-flag, the
::  seats are .seats, and readability is whatever the test's gate says
::
++  seats  (sy ~[~zod host ~fun])
++  gate-scry
  |=  [seats=(set ship) can-read=$-([ship nest:gv] ?)]
  ^-  scry
  |=  =path
  ^-  (unit vase)
  ?+  path  ~
    [%gu @ %channels @ %$ ~]           `!>(&)
    [%gu @ %channels @ %v4 @ @ @ ~]    `!>(&)
    [%gu @ %groups @ %$ ~]             `!>(&)
    [%gu @ %groups @ %groups @ @ ~]    `!>(&)
  ::
      [%gx @ %channels @ %v4 @ @ @ %perm %channel-perm ~]
    `!>(`perm:v9:cv`[~ group-flag])
  ::
      [%gx @ %groups @ %v2 %groups @ @ %seats %ships %ships ~]
    `!>(seats)
  ::
      [%gx @ %groups @ %groups @ @ %seats @ %noun ~]
    =/  who  (slav %p (snag 8 `(list @ta)`path))
    `!>(`(unit seat:v7:gv)`?:((~(has in seats) who) `*seat:v7:gv ~))
  ::
      [%gx @ %groups @ %v2 %groups @ @ %channels %can-read %noun ~]
    `!>(can-read)
  ==
::
++  chan-scry
  |=  readable=?
  ^-  scry
  (gate-scry seats |=([ship nest:gv] readable))
::
::  we (~zod) want ~ten's channel, our subscription to it is pending,
::  and we have been nacked .tries times before
::
++  setup-chan
  |=  [readable=? tries=@ud]
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (set-scry-gate (chan-scry readable))
  ;<  ~  bind:m
    %-  jab-bowl
    |=  b=bowl
    b(wex (~(put by wex.b) [chan-wire host dap] [| chan-watch]))
  ;<  *  bind:m
    %+  do-load  agent
    %-  some  !>
    :*  %2  *places:p
        want=(sy ~[[host chan-context]])
        subs=*(jug context:p ship)
        tries=(~(put by *(map [ship context:p] @ud)) [host chan-context] tries)
    ==
  (pure:m ~)
::
++  do-chan-nack
  (do-agent chan-wire [host dap] %watch-ack `~[leaf+"nope"])
::
++  do-chan-wake
  (do-arvo chan-setup [%behn %wake ~])
::
::  +ex-cards, but keeping the cards going to the %logs agent
::
++  ex-cards-with-logs
  =/  ex  ex-cards
  ex(drop-logs |)
::
::  a log poke of the given kind, volume, and leading message
::
++  ex-log
  |=  [kind=?(%tell %fail) vol=volume:l msg=@t]
  |=  =card
  ^-  tang
  ?.  ?=([%pass [%logs ~] %agent [@ %logs] %poke %log-action-1 *] card)
    ['expected a log poke' >card< ~]
  =+  !<(act=a-log:l q.cage.task.q.card)
  ?.  ?=(%log -.act)  ['expected a %log action' >act< ~]
  ?.  =(kind -.event.act)  ['log kind mismatch' >-.event.act< ~]
  ?.  =(vol vol.event.act)  ['log volume mismatch' >vol.event.act< ~]
  =/  =echo:l  ?-(-.event.act %fail echo.event.act, %tell echo.event.act)
  ?.  ?&(?=(^ echo) =(msg i.echo))
    ['log message mismatch' >echo< ~]
  ~
::
::  a nack for a channel we can still read is retried with backoff,
::  and reported as a %fail at %info
::
++  test-chan-nack-readable-retries
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (setup-chan & 0)
  ;<  caz=(list card)  bind:m  do-chan-nack
  ;<  ~  bind:m
    %+  ex-cards-with-logs  caz
    :~  (ex-arvo chan-setup %b %wait (add t0 ~m5))
        (ex-log %fail %info 'context sub nacked, will retry')
    ==
  ::  when the retry timer fires, we resubscribe
  ::
  ;<  ~  bind:m  (wait ~m5)
  ;<  caz=(list card)  bind:m  do-chan-wake
  %+  ex-cards  caz
  [(ex-task chan-wire [host dap] %watch-as %presence-update-1 chan-watch)]~
::
::  a nack for a channel we can no longer read is still retried once (our
::  %groups may simply not have caught up yet), but the retry wake drops
::  the desire instead of resubscribing, and a later wake is a no-op
::
++  test-chan-nack-unreadable-drops-at-retry
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (setup-chan | 0)
  ;<  caz=(list card)  bind:m  do-chan-nack
  ;<  ~  bind:m
    %+  ex-cards-with-logs  caz
    :~  (ex-arvo chan-setup %b %wait (add t0 ~m5))
        (ex-log %fail %info 'context sub nacked, will retry')
    ==
  ;<  ~  bind:m  (wait ~m5)
  ;<  caz=(list card)  bind:m  do-chan-wake
  ;<  ~  bind:m
    %+  ex-cards-with-logs  caz
    [(ex-log %tell %info 'context sub no longer readable, dropping')]~
  ;<  caz=(list card)  bind:m  do-chan-wake
  (ex-cards caz ~)
::
::  after +max-tries consecutive nacks we give up, with a single %warn
::
++  test-chan-nack-gives-up-after-max-tries
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  (setup-chan & 5)
  ;<  caz=(list card)  bind:m  do-chan-nack
  ;<  ~  bind:m
    %+  ex-cards-with-logs  caz
    [(ex-log %fail %warn 'context sub nacked, giving up')]~
  ;<  caz=(list card)  bind:m  do-chan-wake
  (ex-cards caz ~)
::
::  a full setup only wants the channels we can read. our %channels
::  has two of ~ten's channels, but only /general is still readable.
::
++  setup-scry
  |=  =path
  ^-  (unit vase)
  ?+  path  ((gate-scry seats |=([* n=nest:gv] =(%general q.q.n))) path)
      [%gx @ %chat @ %dm %ships ~]
    `!>(`(set ship)`(sy ~[host]))
  ::
      [%gx @ %channels @ %v4 %channels %channels-4 ~]
    =/  chan=channel:v9:cv  *channel:v9:cv
    =.  perm.chan  [~ group-flag]
    :-  ~  !>  ^-  channels:v9:cv
    (my ~[[[%chat host %general] chan] [[%chat host %old] chan]])
  ==
::
++  test-setup-skips-unreadable-channels
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (set-scry-gate setup-scry)
  ;<  caz=(list card)  bind:m  (do-arvo /setup [%behn %wake ~])
  %+  ex-cards  caz
  :~  (ex-task chan-wire [host dap] %watch-as %presence-update-1 chan-watch)
      (ex-task /activity/all [~zod %activity] %watch /v4)
  ==
::
::  as a host, we reject context watches from ships that cannot read
::  the channel, and from ships watching someone else's path
::
++  test-watch-rejects-unreadable
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (set-scry-gate (chan-scry |))
  ;<  ~  bind:m  (set-src host)
  (ex-fail (do-watch [%context (scot %p host) host-context]))
::
++  test-watch-rejects-impersonation
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (set-scry-gate (chan-scry &))
  ;<  ~  bind:m  (set-src host)
  (ex-fail (do-watch [%context (scot %p ~fun) host-context]))
::
::  a watch for a context we don't host, or with a shape we don't know,
::  is rejected before any membership check
::
++  test-watch-rejects-foreign-context
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (set-scry-gate (chan-scry &))
  ;<  ~  bind:m  (set-src host)
  ;<  ~  bind:m  (ex-fail (do-watch [%context (scot %p host) chan-context]))
  (ex-fail (do-watch [%context (scot %p host) %bogus ~]))
::
::  the read gate alone admits anyone to a public group's open channels,
::  so a ship without a seat is rejected even when the gate says yes
::
++  test-watch-rejects-seatless
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (set-scry-gate (gate-scry (sy ~[~zod]) |=([ship nest:gv] &)))
  ;<  ~  bind:m  (set-src host)
  (ex-fail (do-watch [%context (scot %p host) host-context]))
::
::  with %groups not running, a watch is rejected with a clear reason
::  rather than crashing on a blocked scry
::
++  test-watch-rejects-when-groups-down
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m
    %-  set-scry-gate
    |=  =path
    ?:  ?=([%gu @ %groups @ %$ ~] path)  `!>(|)
    ((chan-scry &) path)
  ;<  ~  bind:m  (set-src host)
  (ex-fail (do-watch [%context (scot %p host) host-context]))
::
++  test-watch-accepts-readable
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (set-scry-gate (chan-scry &))
  ;<  ~  bind:m  (set-src host)
  ;<  caz=(list card)  bind:m  (do-watch [%context (scot %p host) host-context])
  (ex-cards caz ~)
::
::  as a host, when fanning out we kick and forget subscribers that can no
::  longer read the channel. ~ten can still read, ~fun cannot.
::
++  who-scry  (gate-scry seats |=([who=ship nest:gv] =(who host)))
::
++  test-set-kicks-subscribers-that-lost-access
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (set-scry-gate who-scry)
  ;<  *  bind:m
    %+  do-load  agent
    %-  some  !>
    :*  %2  *places:p
        want=*(set [ship context:p])
        subs=(~(put ju (~(put ju *(jug context:p ship)) host-context host)) host-context ~fun)
        tries=*(map [ship context:p] @ud)
    ==
  ;<  ~  bind:m  (set-src host)
  =/  =key:p  [host-context host %typing]
  ;<  caz=(list card)  bind:m
    %+  do-poke  %presence-command-1
    !>(`command-1:p`[%set ~ key [t0 ~] display])
  %+  ex-cards  caz
  :~  (ex-card [%give %kick ~[[%context (scot %p ~fun) host-context]] ~])
      (ex-fact ~[/v1] %presence-response-1 !>(`response-1:p`[%here key [t0 ~] display]))
      (ex-arvo [%expire (scot %p host) %typing host-context] [%b %wait (add t0 ~s30)])
  ==
::
::  the channel host can set presence in its own channel even when its
::  group roles would not let it read it. ~zod hosts; who-scry says only
::  ~ten can read.
::
++  test-host-sets-presence-without-reader-role
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (set-scry-gate who-scry)
  =/  =key:p  [host-context ~zod %typing]
  ;<  caz=(list card)  bind:m
    %+  do-poke  %presence-command-1
    !>(`command-1:p`[%set ~ key [t0 ~] display])
  %+  ex-cards  caz
  :~  (ex-fact ~[/v1] %presence-response-1 !>(`response-1:p`[%here key [t0 ~] display]))
      (ex-arvo [%expire (scot %p ~zod) %typing host-context] [%b %wait (add t0 ~s30)])
  ==
--

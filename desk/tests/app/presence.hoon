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
::    none of that is a crash, so we only ever +tell.
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
::  mocked %channels and %groups: every channel is in .group-flag,
::  and readability is whatever the test says
::
++  chan-scry
  |=  readable=?
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
      [%gx @ %groups @ %groups @ @ %channels @ @ @ %can-read @ %loob ~]
    `!>(readable)
  ==
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
::  and only logged as a %tell
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
        (ex-log %tell %info 'context sub nacked, will retry')
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
        (ex-log %tell %info 'context sub nacked, will retry')
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
    [(ex-log %tell %warn 'context sub nacked, giving up')]~
  ;<  caz=(list card)  bind:m  do-chan-wake
  (ex-cards caz ~)
::
::  a full setup only wants the channels we can read. our %channels
::  has two of ~ten's channels, but only /general is still readable.
::
++  setup-scry
  |=  =path
  ^-  (unit vase)
  ?+  path  ((chan-scry &) path)
      [%gx @ %chat @ %dm %ships ~]
    `!>(`(set ship)`(sy ~[host]))
  ::
      [%gx @ %channels @ %v4 %channels %channels-4 ~]
    =/  chan=channel:v9:cv  *channel:v9:cv
    =.  perm.chan  [~ group-flag]
    :-  ~  !>  ^-  channels:v9:cv
    (my ~[[[%chat host %general] chan] [[%chat host %old] chan]])
  ::
      [%gx @ %groups @ %groups @ @ %channels @ @ %general %can-read @ %loob ~]
    `!>(&)
  ::
      [%gx @ %groups @ %groups @ @ %channels @ @ @ %can-read @ %loob ~]
    `!>(|)
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
++  test-watch-accepts-readable
  %-  eval-mare
  =/  m  (mare ,~)
  ^-  form:m
  ;<  ~  bind:m  setup
  ;<  ~  bind:m  (set-scry-gate (chan-scry &))
  ;<  ~  bind:m  (set-src host)
  ;<  caz=(list card)  bind:m  (do-watch [%context (scot %p host) host-context])
  (ex-cards caz ~)
--

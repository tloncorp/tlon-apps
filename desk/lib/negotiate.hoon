::  negotiate: hands-off version negotiation
::
::      v1.0.0: greenhorn ambassador
::
::    automates negotiating poke & watch interface versions, letting the
::    underlying agent focus on talking to the outside world instead of
::    figuring out whether it can.
::
::      usage
::
::    to use this library, you must supply it with three things:
::    - a flag specifying whether the inner agent should be notified of version
::      negotiation events (matching & unmatching of external agents)
::    - a map of, per protocol your agent exposes, a version noun
::    - a map of, per agent name, a map of, per protocol, the version we expect
::    call this library's +agent arm with those three arguments, and then call
::    the resulting gate with your agent's door.
::
::    this library will "capture" watches, leaves and pokes emitted by the
::    underlying agent.
::    watches will be registered as intent to subscribe. leaves rescind that
::    intent. when first attempting to open a subscription to another agent (a
::    specific $gill:gall), the library will start version negotiation with
::    that agent for each protocol configured for it. only once it has heard a
::    matching version from the remote agent for *all* protocols will the
::    library establish the subscriptions for which intent has been signalled.
::    if it hears a changed, non-matching version from a remote agent, it will
::    automatically close the subscriptions to that agent (and re-open them
::    whenever versions match again).
::    sending pokes will crash the agent if no version match has been
::    established. to avoid crashing when trying to send pokes, the inner agent
::    must take care to call +can-poke or +read-status to check, and +initiate
::    to explicitly initiate version negotiation if necessary.
::    once the library start negotiating versions with another agent, it never
::    stops listening to their versions.
::
::    subsequent changes to the arguments given to this library will result in
::    similar subscription management behavior: we temporarily close
::    subscriptions for agents we have version mismatches with, and open ones
::    where we now do have matching versions. in upgrade scenarios, changing
::    the library arguments should generally suffice.
::
::    if the flag at the start of the sample is set to true then, whenever we
::    start to match or stop matching with a specific gill, we send a poke to
::    the inner agent, marked %negotiate-notification, containing both a flag
::    indicating whether we now match, and the gill for which the notification
::    applies.
::    (the initial state, of not having negotiated at all, counts as "not
::    matching".)
::
::    if an agent was previously using epic, it can trivially upgrade into
::    this library by making the following changes:
::    - change its own epic version number
::    - keep exposing that on the /epic subscription endpoint
::    - remove all other epic-related negotiation logic
::    - use this library as normal
::
/+  dbug, verb
::
|%
+$  protocol  @ta
+$  version   *
+$  config    (map dude:gall (map protocol version))
::
++  initiate
  |=  =gill:gall
  ^-  card:agent:gall
  [%give %fact [/~/negotiate/initiate]~ %negotiate-initiate-version !>(gill)]
::
++  read-status
  |=  [bowl:gall =gill:gall]
  .^  ?(%match %clash %await %unmet)
    %gx  (scot %p our)  dap  (scot %da now)
    /~/negotiate/status/(scot %p p.gill)/[q.gill]/noun
  ==
::
++  can-poke
  |=  [=bowl:gall =gill:gall]
  ?=(%match (read-status bowl gill))
::
++  agent
  |=  [notify=? our-versions=(map protocol version) =our=config]
  ^-  $-(agent:gall agent:gall)
  |^  agent
  ::
  +$  state-0
    $:  %0
        ours=(map protocol version)
        know=config
        heed=(map [gill:gall protocol] (unit version))
        want=(map gill:gall (map wire path))  ::  unpacked wires
    ==
  ::
  +$  card  card:agent:gall
  ::
  ++  helper
    |_  [=bowl:gall state-0]
    +*  state  +<+
    ++  match
      |=  =gill:gall
      ^-  ?
      ?~  need=(~(get by know) q.gill)  &  ::  unversioned
      %-  ~(rep by u.need)  ::NOTE  +all:by is w/o key
      |=  [[p=protocol v=version] o=_&]
      &(o =(``v (~(get by heed) [gill p])))  :: negotiated & matches
    ::  +inflate: update state & manage subscriptions to be self-consistent
    ::
    ::    get previously-unregistered subs from the bowl, put them in .want,
    ::    kill subscriptions for non-known-matching gills, and start version
    ::    negotiation where needed.
    ::
    ++  inflate
      |=  knew=(unit config)
      ^-  (quip card _state)
      =*  boat=boat:gall  wex.bowl
      ::  establish subs from .want where versions match
      ::
      =/  open=(list card)
        %-  zing
        %+  turn  ~(tap by want)
        |=  [=gill:gall m=(map wire path)]
        ?.  (match gill)  ~
        %+  murn  ~(tap by m)
        |=  [=wire =path]
        =.  wire  (pack-wire gill wire)
        ?:  (~(has by boat) [wire gill])  ~  ::  already established
        (some %pass wire %agent gill %watch path)
      ::  manage subs for new or non-matching gills
      ::
      =^  [init=(set [gill:gall protocol]) kill=(set [=wire =gill:gall])]  want
        %+  roll  ~(tap by boat)
        |=  $:  [[=wire =gill:gall] [? =path]]
                [init=(set [gill:gall protocol]) kill=(set [=wire =gill:gall])]
                =_want
            ==
        ^+  [[init kill] want]
        ::  for library-managed subs, ignore all but the wrapped-watch ones
        ::
        ?:  &(?=([%~.~ %negotiate @ *] wire) !=(%inner-watch i.t.t.wire))
          [[init kill] want]
        ::  always track the subscriptions we (want to) have,
        ::  but don't track subs already managed by the library
        ::
        :_  ?:  ?=([%~.~ %negotiate *] wire)  want
            =/  wan  (~(gut by want) gill ~)
            %+  ~(put by want)  gill
            (~(put by wan) wire path)
        ::  if we don't need a specific version, leave the sub as-is
        ::
        =/  need=(list [p=protocol v=version])
          ~(tap by (~(gut by know) q.gill ~))
        |-
        ?~  need  [init kill]
        ::  if we haven't negotiated yet, we should start doing so
        ::
        =/  hail=(unit (unit version))
          (~(get by heed) [gill p.i.need])
        ?~  hail
          =.  init  (~(put in init) [gill p.i.need])
          =.  kill  (~(put in kill) [wire gill])
          $(need t.need)
        ::  kill the subscription if the versions don't match
        ::
        =?  kill  !=(u.hail `v.i.need)
          (~(put in kill) [wire gill])
        $(need t.need)
      ::
      =^  inis  state
        =|  caz=(list card)
        =/  inz=(list [gill:gall protocol])  ~(tap in init)
        |-
        ?~  inz  [caz state]
        =^  car  state  (negotiate i.inz)
        $(caz (weld car caz), inz t.inz)
      ::
      =/  notes=(list card)
        ?.  notify  ~
        ?~  knew    ~
        %+  murn  ~(tap in `(set gill:gall)`(~(run in ~(key by heed)) head))
        |=  =gill:gall
        ^-  (unit card)
        =/  did=?  (match(know u.knew) gill)
        =/  now=?  (match gill)
        ?:  =(did now)  ~
        `(notify-inner now gill)
      ::
      :_  state
      %+  weld  notes
      %+  weld  open
      %+  weld  inis
      %+  turn  ~(tap in kill)
      |=  [=wire =gill:gall]
      ^-  card
      ::NOTE  kill wires come straight from the boat, don't modify them
      [%pass wire %agent gill %leave ~]
    ::  +play-card: handle watches, leaves and pokes specially
    ::
    ++  play-card
      |=  =card
      ^-  (quip ^card _state)
      =*  pass  [[card]~ state]
      ::  handle cards targetted at us (the library) first
      ::
      ?:  ?=([%give %fact [[%~.~ %negotiate *] ~] *] card)
        ~|  [%negotiate %unknown-inner-card card]
        ::  only supported card right now is for initiating negotiation
        ::
        ?>  =([/~/negotiate/initiate]~ paths.p.card)
        ?>  =(%negotiate-initiate-version p.cage.p.card)
        =+  !<(=gill:gall q.cage.p.card)
        (negotiate-missing gill)
      ::  only capture agent cards
      ::
      ?.  ?=([%pass * %agent *] card)
        pass
      ::  always track the subscriptions we want to have
      ::
      =*  gill=gill:gall  [ship name]:q.card
      =?  want  ?=(%watch -.task.q.card)
        =/  wan  (~(gut by want) gill ~)
        ?:  (~(has by wan) p.card)
          ~&  [%duplicate-wire dap=dap.bowl wire=p.card path=path.task.q.card]
          want
        %+  ~(put by want)  gill
        (~(put by wan) p.card path.task.q.card)
      =?  want  ?=(%leave -.task.q.card)
        =/  wan  (~(gut by want) gill ~)
        =.  wan  (~(del by wan) p.card)
        ?~  wan  (~(del by want) gill)
        (~(put by want) gill wan)
      ::  stick the gill in the wire for watches and leaves,
      ::  so we can retrieve it later if needed
      ::
      =?  p.card  ?=(?(%watch %leave) -.task.q.card)
        (pack-wire gill p.card)
      ::  if we don't require versions for the target agent, let the card go
      ::
      =*  dude=dude:gall  name.q.card
      ?.  (~(has by know) dude)
        pass
      ::  %leave is always free to happen
      ::
      ?:  ?=(%leave -.task.q.card)
        pass
      ::  if we know our versions match, we are free to emit the card
      ::
      ?:  (match gill)
        pass
      ::  pokes may not happen if we don't know we match
      ::
      ?:  ?=(?(%poke %poke-as) -.task.q.card)
        ::TODO  if heed was (map gill (map protocol (u v))) we could reasonably
        ::      look up where the mismatch was...
        ~|  [%negotiate %poke-to-mismatching-gill gill]
        !!
      ::  watches will get reestablished once our versions match, but if we
      ::  haven't started negotiation yet, we should do that now
      ::
      (negotiate-missing gill)
    ::
    ++  play-cards
      |=  cards=(list card)
      ^-  (quip card _state)
      =|  out=(list card)
      |-
      ?~  cards  [out state]
      =^  caz  state  (play-card i.cards)
      $(out (weld out caz), cards t.cards)
    ::
    ++  negotiate-missing
      |=  =gill:gall
      ^-  (quip card _state)
      =/  need=(list protocol)
        ~(tap in ~(key by (~(gut by know) q.gill ~)))
      =|  out=(list card)
      |-
      ?~  need  [out state]
      ?:  (~(has by heed) [gill i.need])  $(need t.need)
      =^  caz  state  (negotiate gill i.need)
      $(out (weld out caz), need t.need)
    ::
    ++  negotiate
      |=  for=[gill:gall protocol]
      ^-  (quip card _state)
      ?<  (~(has by heed) for)
      :-  [(watch-version for)]~
      state(heed (~(put by heed) for ~))
    ::
    ++  ours-changed
      |=  [ole=(map protocol version) neu=(map protocol version)]
      ^-  (list card)
      ::  kick incoming subs for protocols we no longer support
      ::
      %+  weld
        %+  turn  ~(tap by (~(dif by ole) neu))
        |=  [=protocol =version]
        [%give %kick [/~/negotiate/version/[protocol]]~ ~]
      ::  give updates for protocols whose supported version changed
      ::
      %+  murn  ~(tap by neu)
      |=  [=protocol =version]
      ^-  (unit card)
      ?:  =(`version (~(get by ole) protocol))  ~
      `[%give %fact [/~/negotiate/version/[protocol]]~ %noun !>(version)]
    ::
    ++  heed-changed
      |=  [for=[=gill:gall protocol] new=(unit version)]
      ^-  (quip card _state)
      =/  hav=(unit version)
        ~|  %unrequested-heed
        (~(got by heed) for)
      ?:  =(new hav)  [~ state]
      =/  did=?  &(notify (match gill.for))
      =.  heed   (~(put by heed) for new)
      ::  we may need to notify the inner agent
      ::
      =/  nos=(list card)
        ?.  notify  ~
        =/  now=?  (match gill.for)
        ?:  =(did now)  ~
        [(notify-inner now gill.for)]~
      =^  caz  state  (inflate ~)
      [(weld caz nos) state]
    ::
    ++  pack-wire
      |=  [=gill:gall =wire]
      ^+  wire
      [%~.~ %negotiate %inner-watch (scot %p p.gill) q.gill wire]
    ::
    ++  trim-wire
      |=  =wire
      ^-  [gill=(unit gill:gall) =_wire]
      ?.  ?=([%~.~ %negotiate %inner-watch @ @ *] wire)  [~ wire]
      =,  t.t.t.wire
      [`[(slav %p i) i.t] t.t]
    ::
    ++  notify-inner
      |=  event=[match=? =gill:gall]
      ^-  card
      :+  %pass  /~/negotiate/notify
      [%agent [our dap]:bowl %poke %negotiate-notification !>(event)]
    ::
    ++  watch-version
      |=  [=gill:gall =protocol]
      ^-  card
      :+  %pass  /~/negotiate/heed/(scot %p p.gill)/[q.gill]/[protocol]
      [%agent gill %watch /~/negotiate/version/[protocol]]
    ::
    ++  retry-timer
      |=  [t=@dr p=path]
      ^-  card
      :+  %pass  [%~.~ %negotiate %retry p]
      [%arvo %b %wait (add now.bowl t)]
    ::  +inner-bowl: partially-faked bowl for the inner agent
    ::
    ::    the bowl as-is, but with library-internal subscriptions removed,
    ::    and temporarily-held subscriptions added in artificially.
    ::
    ++  inner-bowl
      %_  bowl
          sup
        ::  hide subscriptions coming in to this library
        ::
        %-  ~(gas by *bitt:gall)
        %+  skip  ~(tap by sup.bowl)
        |=  [* * =path]
        ?=([%~.~ %negotiate *] path)
      ::
          wex
        %-  ~(gas by *boat:gall)
        %+  weld
          ::  make sure all the desired subscriptions are in the bowl,
          ::  even if that means we have to simulate an un-acked state
          ::
          ^-  (list [[wire ship term] ? path])
          %-  zing
          %+  turn  ~(tap by want)
          |=  [=gill:gall m=(map wire path)]
          %+  turn  ~(tap by m)
          |=  [=wire =path]
          :-  [wire gill]
          (~(gut by wex.bowl) [wire gill] [| path])
        ::  hide subscriptions going out from this library.
        ::  because these go into the +gas:by call _after_ the faked entries
        ::  generated above, these (the originals) take precedence in the
        ::  resulting bowl.
        ::
        %+  murn  ~(tap by wex.bowl)
        |=  a=[[=wire gill:gall] ? path]
        =^  g  wire.a  (trim-wire wire.a)
        ?^  g  (some a)
        ?:(?=([%~.~ %negotiate *] wire.a) ~ (some a))
      ==
    --
  ::
  ++  agent
    |=  inner=agent:gall
    =|  state-0
    =*  state  -
    %+  verb  |
    %-  agent:dbug
    ^-  agent:gall
    |_  =bowl:gall
    +*  this    .
        def   ~(. (default-agent this %|) bowl)
        up    ~(. helper bowl state)
        og    ~(. inner inner-bowl:up)
    ++  on-init
      ^-  (quip card _this)
      =.  ours   our-versions
      =.  know   our-config
      =^  cards  inner  on-init:og
      =^  cards  state  (play-cards:up cards)
      [cards this]
    ::
    ++  on-save  !>([[%negotiate state] on-save:og])
    ++  on-load
      |=  ole=vase
      ^-  (quip card _this)
      ?.  ?=([[%negotiate *] *] q.ole)
        =.  ours   our-versions
        =.  know   our-config
        =^  caz    state  (inflate:up ~)
        =^  cards  inner  (on-load:og ole)
        =^  cards  state  (play-cards:up cards)
        [(weld caz cards) this]
      ::
      |^  =+  !<([[%negotiate old=state-any] ile=vase] ole)
          ?>  ?=(%0 -.old)
          =.  state  old
          =/  caz1
            ?:  =(ours our-versions)  ~
            (ours-changed:up ours our-versions)
          =.  ours   our-versions
          =/  knew   know
          =.  know   our-config
          =^  caz2   state  (inflate:up `knew)
          =^  cards  inner  (on-load:og ile)
          =^  cards  state  (play-cards:up cards)
          [:(weld caz1 caz2 cards) this]
      ::
      +$  state-any  state-0
      --
    ::
    ++  on-watch
      |=  =path
      ^-  (quip card _this)
      ?.  ?=([%~.~ %negotiate *] path)
        =^  cards  inner  (on-watch:og path)
        =^  cards  state  (play-cards:up cards)
      [cards this]
      ::  /~/negotiate/version/[protocol]
      ?>  ?=([%version @ ~] t.t.path)
      ::  it is important that we nack if we don't expose this protocol
      ::
      [[%give %fact ~ %noun !>((~(got by ours) i.t.t.t.path))]~ this]
    ::
    ++  on-agent
      |=  [=wire =sign:agent:gall]
      ^-  (quip card _this)
      =^  gill=(unit gill:gall)  wire
        (trim-wire:up wire)
      ?.  ?=([%~.~ %negotiate *] wire)
        =?  want  ?=(?([%kick ~] [%watch-ack ~ *]) sign)
          =/  gill  (need gill)
          =/  wan  (~(gut by want) gill ~)
          =.  wan  (~(del by wan) wire)
          ?~  wan  (~(del by want) gill)
          (~(put by want) gill wan)
        =^  cards  inner  (on-agent:og wire sign)
        =^  cards  state  (play-cards:up cards)
        [cards this]
      ::
      ~|  wire=t.t.wire
      ?+  t.t.wire  ~|([%negotiate %unexpected-wire] !!)
        [%notify ~]  [~ this]
      ::
          [%heed @ @ @ ~]
        =/  for=[=gill:gall =protocol]
          =*  w  t.t.t.wire
          [[(slav %p i.w) i.t.w] i.t.t.w]
        ?-  -.sign
            %fact
          =*  mark  p.cage.sign
          =*  vase  q.cage.sign
          ?.  =(%noun mark)
            ~&  [negotiate+dap.bowl %ignoring-unexpected-fact mark=mark]
            [~ this]
          =+  !<(=version vase)
          =^  cards  state  (heed-changed:up for `version)
          [cards this]
        ::
            %watch-ack
          ?~  p.sign  [~ this]
          ::  if we no longer care about this particular version, drop it
          ::
          ?.  (~(has by (~(gut by know) q.gill.for ~)) protocol.for)
            =.  heed  (~(del by heed) for)
            [~ this]  ::NOTE  don't care, so shouldn't need to inflate
          ::  if we still care, consider the version "unknown" for now,
          ::  and try re-subscribing later
          ::
          =^  caz  state  (heed-changed:up for ~)
          ::  30 minutes might cost us some responsiveness but in return we
          ::  save both ourselves and others from a lot of needless retries.
          ::
          [[(retry-timer:up ~m30 [%watch t.t.wire]) caz] this]
        ::
            %kick
          :_  this
          ::  to prevent pathological kicks from exploding, we always
          ::  wait a couple seconds before resubscribing.
          ::  perhaps this is overly careful, but we cannot tell the
          ::  difference between "clog" kicks and "unexpected crash" kicks,
          ::  so we cannot take more accurate/appropriate action here.
          ::
          [(retry-timer:up ~s15 [%watch t.t.wire])]~
        ::
            %poke-ack
          ~&  [negotiate+dap.bowl %unexpected-poke-ack wire]
          [~ this]
        ==
      ==
    ::
    ++  on-peek
      |=  =path
      ^-  (unit (unit cage))
      ?:  =(/x/whey path)
        :+  ~  ~
        :-  %mass
        !>  ^-  (list mass)
        :-  %negotiate^&+state
        =/  dat  (on-peek:og path)
        ?:  ?=(?(~ [~ ~]) dat)  ~
        (fall ((soft (list mass)) q.q.u.u.dat) ~)
      ?:  =(/x/dbug/state path)
        ``noun+(slop on-save:og !>(negotiate=state))
      ?.  ?=([@ %~.~ %negotiate *] path)
        (on-peek:og path)
      ?.  ?=(%x i.path)  [~ ~]
      ?+  t.t.t.path  [~ ~]
        [%version ~]  ``noun+!>(ours)
      ::
          [%version @ @ @ ~]
        =/  for=[gill:gall protocol]
          =*  p  t.t.t.t.path
          [[(slav %p i.p) i.t.p] i.t.t.p]
        :^  ~  ~  %noun
        !>  ^-  (unit version)
        (~(gut by heed) for ~)
      ::
          [%status @ @ ~]
        ::TODO  mb also expose over subscription interface? useful for fe
        =/  for=gill:gall
          =*  p  t.t.t.t.path
          [(slav %p i.p) i.t.p]
        :^  ~  ~  %noun
        !>  ^-  ?(%match %clash %await %unmet)
        =/  need  (~(gut by know) q.for ~)
        ?:  =(~ need)  %match
        =/  need  ~(tap in ~(key by need))
        ?.  (levy need |=(p=protocol (~(has by heed) for p)))
          %unmet
        ?:  (lien need |=(p=protocol =(~ (~(got by heed) for p))))
          %await
        ?:((match:up for) %match %clash)
      ==
    ::
    ++  on-leave
      |=  =path
      ^-  (quip card _this)
      ?:  ?=([%~.~ %negotiate *] path)
        [~ this]
      =^  cards  inner  (on-leave:og path)
      =^  cards  state  (play-cards:up cards)
      [cards this]
    ::
    ++  on-arvo
      |=  [=wire sign=sign-arvo:agent:gall]
      ^-  (quip card _this)
      ?.  ?=([%~.~ %negotiate *] wire)
        =^  cards  inner  (on-arvo:og wire sign)
        =^  cards  state  (play-cards:up cards)
        [cards this]
      ~|  wire=t.t.wire
      ?+  t.t.wire  !!
          [%retry *]
        ?>  ?=(%wake +<.sign)
        ?+  t.t.t.wire  !!
            [%watch %heed @ @ @ ~]
          =/  for=[gill:gall protocol]
            =*  w  t.t.t.t.t.wire
            [[(slav %p i.w) i.t.w] i.t.t.w]
          [[(watch-version:up for)]~ this]
        ==
      ==
    ::
    ++  on-poke
      |=  [=mark =vase]
      ^-  (quip card _this)
      =^  cards  inner  (on-poke:og +<)
      =^  cards  state  (play-cards:up cards)
      [cards this]
    ::
    ++  on-fail
      |=  [term tang]
      ^-  (quip card _this)
      =^  cards  inner  (on-fail:og +<)
      =^  cards  state  (play-cards:up cards)
      [cards this]
    --
  --
--

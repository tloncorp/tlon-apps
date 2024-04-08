::  negotiate: hands-off version negotiation
::
::      v1.0.1: greenhorn ambassador
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
::    regardless of the value of the notify flag, subscription updates about
::    version compatibility will always be given on the following paths:
::    /~/negotiate/notify       %negotiate-notifcation; [match=? =gill:gall]
::    /~/negotiate/notify/json  %json; {'gill': '~ship/dude', 'match': true}
::
::    if an agent was previously using epic, it can trivially upgrade into
::    this library by making the following changes:
::    - change its own epic version number
::    - keep exposing that on the /epic subscription endpoint
::    - remove all other epic-related negotiation logic
::    - use this library as normal
::
|%
+$  protocol  @ta
+$  version   *
+$  config    (map dude:gall (map protocol version))
+$  status    ?(%match %clash %await %unmet)
::
++  initiate
  |=  =gill:gall
  ^-  card:agent:gall
  [%give %fact [/~/negotiate/initiate]~ %negotiate-initiate-version !>(gill)]
::
++  read-status
  |=  [bowl:gall =gill:gall]
  .^  status
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
  +$  state-1
    $:  %1
        ours=(map protocol version)
        know=config
        heed=(map [gill:gall protocol] (unit version))
        want=(map gill:gall (map wire path))  ::  un-packed wires
    ==
  ::
  +$  card  card:agent:gall
  ::
  ++  helper
    |_  [=bowl:gall state-1]
    +*  state  +<+
    ++  match
      |=  =gill:gall
      ^-  ?
      ?:  =([our dap]:bowl gill)  &
      ?~  need=(~(get by know) q.gill)  &  ::  unversioned
      %-  ~(rep by u.need)  ::NOTE  +all:by is w/o key
      |=  [[p=protocol v=version] o=_&]
      &(o =(``v (~(get by heed) [gill p])))  :: negotiated & matches
    ::
    ++  certain-mismatch
      |=  =gill:gall
      ^-  ?
      ?:  =([our dap]:bowl gill)  |
      ?~  need=(~(get by know) q.gill)  |  ::  unversioned
      %-  ~(rep by u.need)
      |=  [[p=protocol v=version] o=_|]
      =+  h=(~(get by heed) [gill p])
      |(o &(?=([~ ~ *] h) !=(v u.u.h)))  ::  negotiated & non-matching
    ::
    ++  get-status
      |=  =gill:gall
      ^-  status
      ?:  =([our dap]:bowl gill)  %match
      =/  need  (~(gut by know) q.gill ~)
      ?:  =(~ need)  %match
      =/  need  ~(tap in ~(key by need))
      ?.  (levy need |=(p=protocol (~(has by heed) gill p)))
        %unmet
      ?:  (lien need |=(p=protocol =(~ (~(got by heed) gill p))))
        %await
      ?:((match gill) %match %clash)
    ::  +inflate: update state & manage subscriptions to be self-consistent
    ::
    ::    get previously-unregistered subs from the bowl, put them in .want,
    ::    kill subscriptions for non-known-matching gills, and start version
    ::    negotiation where needed.
    ::
    ++  inflate
      |=  knew=(unit config)
      ^-  [[caz=(list card) kik=(list [wire gill:gall])] _state]
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
        =.  wire  (pack-wire wire gill)
        ?:  (~(has by boat) [wire gill])  ~  ::  already established
        (some %pass wire %agent gill %watch path)
      ::  manage subs for new or non-matching gills
      ::
      =/  [init=(set [gill:gall protocol]) kill=(set [=wire =gill:gall])]
        %+  roll  ~(tap by boat)
        |=  $:  [[=wire =gill:gall] [? =path]]
                [init=(set [gill:gall protocol]) kill=(set [=wire =gill:gall])]
            ==
        ^+  [init kill]
        ::  all subscriptions should be fully library-managed
        ::
        ?>  ?=([%~.~ %negotiate *] wire)
        ::  ignore library-internal subscriptions
        ::
        ?:  &(?=([%~.~ %negotiate @ *] wire) !=(%inner-watch i.t.t.wire))
          [init kill]
        ::  if we don't need a specific version, leave the sub as-is
        ::
        ?:  =([our dap]:bowl gill)  [init kill]
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
        ?~  knew    ~
        %-  zing
        %+  turn  ~(tap in `(set gill:gall)`(~(run in ~(key by heed)) head))
        |=  =gill:gall
        ^-  (list card)
        =/  did=?  (match(know u.knew) gill)
        =/  now=?  (match gill)
        ?:  =(did now)  ~
        %+  weld  (notify-outer now gill)
        ?.  notify  ~
        [(notify-inner now gill)]~
      ::
      =^  leaves=(list card)  want
        %^  spin  ~(tap in kill)  want
        |=  [[=wire =gill:gall] =_want]
        ^-  [card _want]
        ::  kill wires come straight from the boat, so we don't modify them
        ::  for leaves, but _must_ trim them for .want
        ::
        :-  [%pass wire %agent gill %leave ~]
        =/  wan  (~(gut by want) gill ~)
        =.  wan  (~(del by wan) +:(trim-wire wire))
        ?~  wan  (~(del by want) gill)
        (~(put by want) gill wan)
      ::
      =/  kik=(list [wire gill:gall])
        %+  turn  ~(tap in kill)
        |=  [w=wire g=gill:gall]
        [+:(trim-wire w) g]
      ::
      [[:(weld leaves notes open inis) kik] state]
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
        (pack-wire p.card gill)
      ::  if the target agent is ourselves, always let the card go
      ::
      ?:  =([our dap]:bowl [ship name]:q.card)
        pass
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
      ::  pokes may not happen if we know we mismatch
      ::
      ?:  ?=(?(%poke %poke-as) -.task.q.card)
        ?:  (certain-mismatch gill)
          ::TODO  if heed was (map gill (map protocol (u v))) we could
          ::      reasonably look up where the mismatch was...
          ~|  [%negotiate %poke-to-mismatching-gill gill]
          !!
        ::  if we aren't certain of a match, ensure we've started negotiation
        ::
        =^  caz  state  (negotiate-missing gill)
        [[card caz] state]
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
      ?:  =([our dap]:bowl gill)  [~ state]
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
      ^-  [[caz=(list card) kik=(list [wire gill:gall])] _state]
      =/  hav=(unit version)
        ~|  %unrequested-heed
        (~(got by heed) for)
      ?:  =(new hav)  [[~ ~] state]
      =/  did=?  (match gill.for)
      =.  heed   (~(put by heed) for new)
      =/  now=?  (match gill.for)
      ::  we need to notify subscribers,
      ::  and we may need to notify the inner agent
      ::
      =/  nos=(list card)
        ?:  =(did now)  ~
        %+  weld  (notify-outer now gill.for)
        ?.  notify  ~
        [(notify-inner now gill.for)]~
      =^  a  state  (inflate ~)
      [[(weld caz.a nos) kik.a] state]
    ::
    ++  pack-wire
      |=  [=wire =gill:gall]
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
    ++  simulate-kicks
      |=  [kik=(list [=wire gill:gall]) inner=agent:gall]
      ^-  [[(list card) _inner] _state]
      =|  cards=(list card)
      |-
      ?~  kik  [[cards inner] state]
      =.  wex.bowl  (~(del by wex.bowl) (pack-wire i.kik) +.i.kik)
      =^  caz  inner
        %.  [wire.i.kik %kick ~]
        %~  on-agent  inner
        inner-bowl(src.bowl p.i.kik)
      =^  caz  state  (play-cards caz)
      $(kik t.kik, cards (weld cards caz))
    ::
    ++  notify-outer
      |=  event=[match=? =gill:gall]
      ^-  (list card)
      =/  =path  /~/negotiate/notify
      =/  =json
        :-  %o
        %-  ~(gas by *(map @t json))
        =,  event
        :~  'match'^b+match
            'gill'^s+(rap 3 (scot %p p.gill) '/' q.gill ~)
        ==
      :~  [%give %fact [path]~ %negotiate-notification !>(event)]
          [%give %fact [(snoc path %json)]~ %json !>(json)]
      ==
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
    =|  state-1
    =*  state  -
    ^-  agent:gall
    !.  ::  we hide all the "straight into the inner agent" paths from traces
    |_  =bowl:gall
    +*  this    .
        up    ~(. helper bowl state)
        og    ~(. inner inner-bowl:up)
    ++  on-init
      ^-  (quip card _this)
      =.  ours   our-versions
      =.  know   our-config
      =^  cards  inner  on-init:og  !:
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
        ::  upgrade the inner agent as normal, handling any new subscriptions
        ::  it creates like we normally do
        ::
        =^  cards  inner  (on-load:og ole)  !:
        =^  cards  state  (play-cards:up cards)
        ::  but then, for every subscription that was established prior to
        ::  using this library, simulate a kick, forcing the inner agent to
        ::  re-establish those subscriptions, letting us wrap them like we
        ::  will do for all its subs going forward.
        ::  this way, after this +on-load call finishes, we should never again
        ::  see %watch-ack, %kick or %fact signs with non-wrapped wires.
        ::
        =/  suz=(list [[=wire =gill:gall] [ack=? =path]])
          ~(tap by wex.bowl)
        |-
        ?~  suz         [cards this]
        =*  sub         i.suz
        =.  cards       (snoc cards [%pass wire.sub %agent gill.sub %leave ~])
        =.  wex.bowl    (~(del by wex.bowl) -.sub)
        =^  caz  inner  (on-agent:og wire.sub %kick ~)
        =^  caz  state  (play-cards:up caz)
        $(cards (weld cards caz), suz t.suz)
      ::
      |^  =+  !<([[%negotiate old=state-any] ile=vase] ole)
          ?:  ?=(%0 -.old)
            ::  version 0 didn't wrap all subscriptions, so we must simulate
            ::  kicks for those that weren't wrapped.
            ::NOTE  at the time of writing, we know the very bounded set of
            ::      ships running version %0 of this library, and we know no
            ::      version numbers are changing during this upgrade, so we
            ::      simply don't worry about calling +inflate, similar to the
            ::      "initial +on-load" case.
            ::TODO  that means we should probably obliterate the %0 type &
            ::      code branch once this has been deployed to the known ships.
            ::
            =.  state  old(- %1)
            !:
            ?>  =(ours our-versions)
            ?>  =(know our-config)
            =^  cards  inner  (on-load:og ile)
            =^  cards  state  (play-cards:up cards)
            =/  suz=(list [[=wire =gill:gall] [ack=? =path]])
              ~(tap by wex.bowl)
            |-
            ?~  suz  [cards this]
            =*  sub  i.suz
            ?:  ?=([%~.~ %negotiate *] wire.sub)
              $(suz t.suz)
            ~&  [%negotiate dap.bowl %re-doing-sub sub]
            =.  cards       (snoc cards [%pass wire.sub %agent gill.sub %leave ~])
            =.  wex.bowl    (~(del by wex.bowl) -.sub)
            =^  caz  inner  (on-agent:og wire.sub %kick ~)
            =^  caz  state  (play-cards:up caz)
            $(cards (weld cards caz), suz t.suz)
          ?>  ?=(%1 -.old)
          =.  state  old
          =/  caz1
            ?:  =(ours our-versions)  ~
            (ours-changed:up ours our-versions)
          =.  ours   our-versions
          =/  knew   know
          =.  know   our-config
          =^  a      state  (inflate:up `knew)
          =^  caz2   inner  (on-load:og ile)  !:
          =^  caz2   state  (play-cards:up caz2)
          =^  [caz3=(list card) nin=_inner]  state
            (simulate-kicks:up kik.a inner)
          =.  inner  nin
          [:(weld caz1 caz.a caz2 caz3) this]
      ::
      +$  state-any  $%(state-0 state-1)
      +$  state-0
        $:  %0
            ours=(map protocol version)
            know=config
            heed=(map [gill:gall protocol] (unit version))
            want=(map gill:gall (map wire path))  ::  unpacked wires
        ==
      --
    ::
    ++  on-watch
      |=  =path
      ^-  (quip card _this)
      ?.  ?=([%~.~ %negotiate *] path)
        =^  cards  inner  (on-watch:og path)  !:
        =^  cards  state  (play-cards:up cards)
        [cards this]
      !:
      ?+  t.t.path  !!
          [%version @ ~]  ::  /~/negotiate/version/[protocol]
        ::  it is important that we nack if we don't expose this protocol
        ::
        [[%give %fact ~ %noun !>((~(got by ours) i.t.t.t.path))]~ this]
      ::
          [%notify ?([%json ~] ~)]  ::  /~/negotiate/notify(/json)
        ?>  =(our src):bowl
        [~ this]
      ==
    ::
    ++  on-agent
      |=  [=wire =sign:agent:gall]
      ^-  (quip card _this)
      =^  gill=(unit gill:gall)  wire
        (trim-wire:up wire)
      ?.  ?=([%~.~ %negotiate *] wire)
        =?  want  ?=(?([%kick ~] [%watch-ack ~ *]) sign)
          !:  ~|  wire
          =/  gill  (need gill)
          =/  wan  (~(gut by want) gill ~)
          =.  wan  (~(del by wan) wire)
          ?~  wan  (~(del by want) gill)
          (~(put by want) gill wan)
        =^  cards  inner  (on-agent:og wire sign)  !:
        =^  cards  state  (play-cards:up cards)
        [cards this]
      !:
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
          =^  a  state  (heed-changed:up for `version)
          =^  [caz=(list card) nin=_inner]  state
            (simulate-kicks:up kik.a inner)
          =.  inner  nin
          [(weld caz.a caz) this]
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
          =^  a  state  (heed-changed:up for ~)
          =^  [caz=(list card) nin=_inner]  state
            (simulate-kicks:up kik.a inner)
          =.  inner  nin
          ::  30 minutes might cost us some responsiveness but in return we
          ::  save both ourselves and others from a lot of needless retries.
          ::
          [[(retry-timer:up ~m30 [%watch t.t.wire]) (weld caz.a caz)] this]
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
        ``noun+!>((slop on-save:og !>(negotiate=state)))
      ?.  ?=([@ %~.~ %negotiate *] path)
        (on-peek:og path)
      !:
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
          [%status ?([%json ~] ~)]
        :+  ~  ~
        =/  stas=(list [gill:gall status])
          %+  turn  ~(tap in `(set gill:gall)`(~(run in ~(key by heed)) head))
          |=(=gill:gall [gill (get-status:up gill)])
        ?~  t.t.t.t.path
          noun+!>((~(gas by *(map gill:gall status)) stas))
        ?>  ?=([%json ~] t.t.t.t.path)
        :-  %json
        !>  ^-  json
        :-  %o
        %-  ~(gas by *(map @t json))
        %+  turn  stas
        |=  [=gill:gall =status]
        [(rap 3 (scot %p p.gill) '/' q.gill ~) s+status]
      ::
          [%status @ @ ?([%json ~] ~)]
        =/  for=gill:gall
          =*  p  t.t.t.t.path
          [(slav %p i.p) i.t.p]
        =/  res=status
          (get-status:up for)
        ?~  t.t.t.t.t.t.path  ``noun+!>(res)
        ?>  ?=([%json ~] t.t.t.t.t.t.path)
        ``json+!>(`json`s+res)
      ::
          [%matching ?(~ [%json ~])]
        :+  ~  ~
        =/  mats=(list [gill:gall ?])
          %+  turn  ~(tap in `(set gill:gall)`(~(run in ~(key by heed)) head))
          |=(=gill:gall [gill (match:up gill)])
        ?~  t.t.t.t.path
          noun+!>((~(gas by *(map gill:gall ?)) mats))
        ?>  ?=([%json ~] t.t.t.t.path)
        :-  %json
        !>  ^-  json
        :-  %o
        %-  ~(gas by *(map @t json))
        %+  turn  mats
        |=  [=gill:gall match=?]
        [(rap 3 (scot %p p.gill) '/' q.gill ~) b+match]
      ==
    ::
    ++  on-leave
      |=  =path
      ^-  (quip card _this)
      ?:  ?=([%~.~ %negotiate *] path)  !:
        [~ this]
      =^  cards  inner  (on-leave:og path)  !:
      =^  cards  state  (play-cards:up cards)
      [cards this]
    ::
    ++  on-arvo
      |=  [=wire sign=sign-arvo:agent:gall]
      ^-  (quip card _this)
      ?.  ?=([%~.~ %negotiate *] wire)
        =^  cards  inner  (on-arvo:og wire sign)  !:
        =^  cards  state  (play-cards:up cards)
        [cards this]
      !:
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
      =^  cards  inner  (on-poke:og +<)  !:
      =^  cards  state  (play-cards:up cards)
      [cards this]
    ::
    ++  on-fail
      |=  [term tang]
      ^-  (quip card _this)
      =^  cards  inner  (on-fail:og +<)  !:
      =^  cards  state  (play-cards:up cards)
      [cards this]
    --
  --
--

::  negotiate: hands-off version negotiation
::
::      v0.0.0: premature babe
::
::    automates negotiating poke & watch interface versions, letting the
::    underlying agent focus on talking to the outside world instead of
::    figuring out whether it can.
::
::      usage
::
::    to use this library, call its +agent arm with your own version and a map
::    of, per target agent, the version we expect them to be, then call the
::    resulting gate with the agent's door.
::
::    this library will "capture" watches, leaves and pokes emitted by the
::    underlying agent.
::    watches will be registered as intent to subscribe. leaves rescind that
::    intent. when first attempting to open a subscription to another agent (a
::    specific $gill:gall), the library will start version negotiation. only
::    once it has heard a matching version from the remote agent will the
::    library establish subscriptions for which intent has been signalled. if
::    it hears a changed, non-matching version from a remote agent, it will
::    automatically close the subscriptions to that agent (and re-open them
::    whenever versions match again).
::    sending pokes will crash the agent if no version match has been
::    established. to avoid crashing when trying to send pokes, the inner agent
::    must take care to call +can-poke or +read-status to check, and +initiate
::    to explicitly initiate version negotiation if necessary.
::    once the library start negotiating versions with another agent, it never
::    stops listening to their version.
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
+$  version  *
+$  config   (map dude:gall version)  ::TODO  support multiple supported versions?
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
::TODO  want to +notify-me to subscribe to self about heed changes
::
++  agent
  |=  [=our=version =our=config]
  ^-  $-(agent:gall agent:gall)
  |^  agent
  ::
  +$  state-0
    $:  %0
        ours=version
        know=config
        heed=(map gill:gall (unit version))
        want=(map gill:gall (map wire path))
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
      =(`need (~(get by heed) gill))  :: negotiated & matches
    ::  +inflate: update state & manage subscriptions to be self-consistent
    ::
    ::    get previously-unregistered subs from the bowl, put them in .want,
    ::    kill subscriptions for non-known-matching gills, and start version
    ::    negotiation where needed.
    ::
    ++  inflate
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
        ?.  (~(has by boat) [wire gill])  ~  ::  already established
        (some %pass wire %agent gill %watch path)
      ::  manage subs for new or non-matching gills
      ::
      =^  [init=(set gill:gall) kill=(set [=wire =gill:gall])]  want
        %+  roll  ~(tap by boat)
        |=  $:  [[=wire =gill:gall] [? =path]]
                [init=(set gill:gall) kill=(set [=wire =gill:gall])]
                =_want
            ==
        ^+  [[init kill] want]
        ::  always track the subscriptions we (want to) have
        ::
        :_  =/  wan  (~(gut by want) gill ~)
            %+  ~(put by want)  gill
            (~(put by wan) wire path)
        ::  if we don't need a specific version, leave the sub as-is
        ::
        =/  need=(unit version)  (~(get by know) q.gill)
        ?~  need  [init kill]
        ::  if we haven't negotiated yet, we should start doing so
        ::
        =/  hail=(unit (unit version))  (~(get by heed) gill)
        ?~  hail  [(~(put in init) gill) (~(put in kill) [wire gill])]
        :-  init
        ::  only keep the subscription if the versions match
        ::
        ?:  =(u.hail need)  kill
        (~(put in kill) [wire gill])
      ::
      =^  inis  state
        =|  caz=(list card)
        =/  inz=(list gill:gall)  ~(tap in init)
        |-
        ?~  inz  [caz state]
        =^  car  state  (negotiate i.inz)
        $(caz (weld car caz), inz t.inz)
      :_  state
      %+  weld  open
      %+  weld  inis
      %+  turn  ~(tap in kill)
      |=  [=wire =gill:gall]
      ^-  card
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
        ?:  (~(has by heed) gill)  [~ state]
        (negotiate gill)
      ::  only capture agent cards
      ::
      ?.  ?=([%pass * %agent *] card)
        pass
      ::  if we don't require a version for the target agent, let the card go
      ::
      =*  dude=dude:gall  name.q.card
      ?.  (~(has by know) dude)
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
      ::  %leave is always free to happen
      ::
      ?:  ?=(%leave -.task.q.card)
        pass
      ::  if we know our versions match, we are free to emit the card
      ::
      =/  hail=(unit (unit version))  (~(get by heed) gill)
      ?:  =(hail ``(~(got by know) dude))
        pass
      ::  pokes may not happen if we don't know we match
      ::
      ?:  ?=(?(%poke %poke-as) -.task.q.card)
        ~|  ?~  hail
              [%negotiate %poke-to-unnegotiated-gill gill]
            [%negotiate %poke-to-mismatching-gill gill them=u.hail ours=`(~(got by know) dude)]
        !!
      ::  watches will get reestablished once our versions match, but if we
      ::  haven't started negotiation yet, we should do that now
      ::
      ?^  hail  [~ state]
      (negotiate gill)
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
    ++  negotiate
      |=  =gill:gall
      ^-  (quip card _state)
      ?<  (~(has by heed) gill)
      :-  [(watch-gill gill)]~
      state(heed (~(put by heed) gill ~))
    ::
    ++  ours-changed
      |=  [ole=version neu=version]
      ^-  (list card)
      [%give %fact [/~/negotiate/version]~ %noun !>(neu)]~
    ::
    ++  heed-changed
      |=  [=gill:gall new=version]
      ^-  (quip card _state)
      =/  hav=(unit version)
        ~|  %unrequested-heed
        (~(got by heed) gill)
      ?:  =(`new hav)  [~ state]
      =.  heed  (~(put by heed) gill `new)
      inflate
    ::
    ++  watch-gill
      |=  =gill:gall
      ^-  card
      :+  %pass  /~/negotiate/heed/(scot %p p.gill)/[q.gill]
      [%agent gill %watch /~/negotiate/version]
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
          ::  hide subscriptions going out from this library
          ::
          %+  skip  ~(tap by wex.bowl)
          |=  [[=wire *] *]
          ?=([%~.~ %negotiate *] wire)
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
        pals  ~(. lp bowl)
        def   ~(. (default-agent this %|) bowl)
        up    ~(. helper bowl state)
        og    ~(. inner inner-bowl:up)
    ++  on-init
      ^-  (quip card _this)
      =.  ours  our-version
      =.  know  our-config
      =^  cards   inner  on-init:og
      =^  cards   state  (play-cards:up cards)
      [cards this]
    ::
    ++  on-save  !>([[%negotiate state] on-save:og])
    ++  on-load
      |=  ole=vase
      ^-  (quip card _this)
      ?.  ?=([[%negotiate *] *] q.ole)
        =.  ours    our-version
        =.  know    our-config
        =^  caz     state  inflate:up
        =^  cards   inner  (on-load:og ole)
        =^  cards   state  (play-cards:up cards)
        [(weld caz cards) this]
      ::
      |^  =+  !<([[%negotiate old=state-any] ile=vase] ole)
          ?>  ?=(%0 -.old)
          =.  state  old
          =/  caz1
            ?:  =(ours our-version)  ~
            (ours-changed:up ours our-version)
          =.  ours   our-version
          =.  know   our-config
          =^  caz2   state  inflate:up
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
      ::  /~/negotiate/version
      ?>  =(/version t.t.path)
      [[%give %fact ~ %noun !>(ours)]~ this]
    ::
    ++  on-agent
      |=  [=wire =sign:agent:gall]
      ^-  (quip card _this)
      ?.  ?=([%~.~ %negotiate *] wire)
        =^  cards  inner  (on-agent:og wire sign)
        =^  cards  state  (play-cards:up cards)
        [cards this]
      ::
      ?+  t.t.wire  ~|([%negotiate %unexpected-wire wire] !!)
          [%heed @ @ ~]
        ~|  t.t.wire
        =/  =gill:gall
          [(slav %p i.t.t.t.wire) i.t.t.t.t.wire]
        ?-  -.sign
            %fact
          =*  mark  p.cage.sign
          =*  vase  q.cage.sign
          ?.  =(%noun mark)
            ~&  [negotiate+dap.bowl %ignoring-unexpected-fact mark=mark]
            [~ this]
          =+  !<(=version vase)
          =^  cards  state  (heed-changed:up gill version)
          [cards this]
        ::
            %watch-ack
          :_  this
          ?~  p.sign  ~
          ::  30 minutes might cost us some responsiveness but in return we
          ::  save both ourselves and others from a lot of needless retries.
          ::
          [(retry-timer:up ~m30 [%watch t.t.wire])]~
        ::
            %kick
          :_  this
          ::  to prevent pathological kicks from exploding, we always
          ::  wait a couple seconds before resubscribing.
          ::  perhaps this is overly careful, but we cannot tell the
          ::  difference between "clog" kicks and "unexpected crash" kicks,
          ::  so we cannot take more accurate/appropriate action here.
          ::  (notably, "do we still care" check also lives in %wake logic.)
          ::
          [(retry-timer:up ~s15 /watch/(scot %p src.bowl))]~
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
          [%version @ @ ~]
        =/  =gill:gall
          [(slav %p i.t.t.t.t.path) i.t.t.t.t.t.path]
        :^  ~  ~  %noun
        !>  ^-  (unit version)
        (~(gut by heed) gill ~)
      ::
          [%status @ @ ~]
        =/  =gill:gall
          [(slav %p i.t.t.t.t.path) i.t.t.t.t.t.path]
        :^  ~  ~  %noun
        !>  ^-  ?(%match %clash %await %unmet)
        =/  hav=(unit (unit version))
          (~(get by heed) gill)
        ?~  hav    %unmet
        ?~  u.hav  %await
        ?:  =(u.u.hav ours)  %match
        %clash
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
      ?+  t.t.wire  ~|(wire !!)
          [%retry *]
        ?>  ?=(%wake +<.sign)
        ?+  t.t.t.wire  ~|(wire !!)
            [%watch %heed @ @ ~]
          =/  =gill:gall
            [(slav %p i.t.t.t.t.t.wire) i.t.t.t.t.t.t.wire]
          [[(watch-gill:up gill)]~ this]
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

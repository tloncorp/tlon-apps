/-  v=vitals
/+  vitals-lib=vitals
/+  dbug, def=default-agent, verb
^-  agent:gall
=>
  |%
  +$  card  card:agent:gall
  +$  versioned-state
    $%  current-state
    ==
  +$  current-state
    $:  %0
        connections=(map ship result:v)
    ==
  --
=|  current-state
=*  state  -
=<
  %+  verb  |
  %-  agent:dbug
  |_  =bowl:gall
  +*  this  .
      def   ~(. (default-agent this %|) bowl)
      cor   ~(. +> [bowl ~])
  ++  on-init   on-init:def
  ::
  ++  on-save
    !>(state)
  ::
  ++  on-load
    |=  =vase
    ^-  (quip card _this)
    =^  cards  state
      abet:(load:cor vase)
    [cards this]
  ::
  ++  on-poke
    |=  [=mark =vase]
    ^-  (quip card _this)
    =^  cards  state
      abet:(poke:cor mark vase)
    [cards this]
  ++  on-watch
    |=  =path
    ^-  (quip card _this)
    =^  cards  state
      abet:(watch:cor path)
    [cards this]
  ::
  ++  on-peek   peek:cor
  ::
  ++  on-leave  on-leave:def
  ::
  ++  on-fail   on-fail:def
  ::
  ++  on-agent  on-agent:def
  ::
  ++  on-arvo
    |=  [=wire sign=sign-arvo]
    ^-  (quip card _this)
    =^  cards  state
      abet:(arvo:cor wire sign)
    [cards this]
  --
|_  [=bowl:gall cards=(list card)]
+*  our   our.bowl
    now   now.bowl
    src   src.bowl
++  cor   .
++  abet  [(flop cards) state]
++  emit  |=(=card cor(cards [card cards]))
++  emil  |=(caz=(list card) cor(cards (welp (flop caz) cards)))    ::  XX
++  give  |=(=gift:agent:gall (emit %give gift))                    ::  XX
++  load
  |=  =vase
  =/  loaded-state  !<(versioned-state vase)
  ?-  -.loaded-state
    %0  cor(connections connections.loaded-state)
  ==
++  poke
  |=  [=mark =vase]
  |^  ^+  cor
  ?+    mark  (on-poke:def mark vase)
  ::
  ::  private pokes
  ::
      %example
    =+  !<(flags=(set flag:c) vase)
    =.  imp  %-  ~(gas by *(map flag:c ?))
      ^-  (list [flag:c ?])
      %+  turn
        ~(tap in flags)
      |=(=flag:c [flag |])
    cor
  ::
      %update-status
    ?>  =(our src)
    =+  !<(=update:v vase)
    cor(connections (~(put by connections) update))
  ::
      %run-check
    ?>  =(our src)
    ::  XX: launch thread
    !!
  ==
++  watch
  ::  XX: SSS
  !!
++  peek
  |=  =path
  ^-  (unit (unit cage))
  ?+  path  [~ ~]
  ::
      [%x %sponsor ~]
    ?<  ?=(%czar (clan:title our))
    =/  sponsor-state
      %-  simplified-qos:vitals-lib
      .^  ship-state:ames
        %ax
      :~  (scot %p our)
          %$
          (scot %da now)
          %peers
          (scot %p (sein:title our now our))
      ==
    ?:  =(%live +.sponsor-state)
      ::  XX: need mark name
      ``temp-name+!>([%yes *@dr])     ::  XX: need ping
    ``temp-name+!>([%no-our-sponsor -.sponsor-state])
  ::
      [%x %galaxy ~]
    ?<  ?=(%czar (clan:title our))
    =/  sponsor  (sein:title our now our)
    |-
    ?.  ?=(%czar (clan:title sponsor))
      $(sponsor (sein:title our now sponsor))
    =/  galaxy-state
      %-  simplified-qos:vitals-lib
      .^  ship-state:ames
        %ax
      :~  (scot %p our)
          %$
          (scot %da now)
          %peers
          (scot %p (sein:title our now sponsor))
      ==
    ?:  =(%live +.galaxy-state)
      ::  XX: need mark name
      ``temp-name+!>([%yes *@dr])     ::  XX: need ping
    ``temp-name+!>([%no-our-galaxy -.galaxy-state])
  ::
      [%x %ship @tas ~]
    %-  some
    %-  some
    :-  %temp-name-2
    !>
    %+  fall  (~(get by connections) (slav %p i.t.t.path))
    [*@da %complete %no-data ~]
  ==
++  arvo
  ::  XX: If no crash, update result as is, otherwise update ship status to crash
  !!
--

:: Philosophy:
:: This app provides a batteries-included view of your connectivity with
:: any ship.  An interface should be able to get all relevant information
:: directly from this app and display it to the user.  For this reason, it
:: includes many "pending" states and reasons for failure.
::
:: To access these statuses, subscribe to /ship/~sampel-palnet for each
:: ship you care about, and then send pokes of the form [%run-check
:: ~sampel-palnet] to kick off the connectivity check.
::
:: You can also scry to these paths to get the latest information (with
:: timestamp), but you must poke to actively test the state.  The special
:: scry paths /sponsor and /galaxy give immediate access to connectivity
:: state with our direct sponsor or our galaxy, and this will always be
:: up-to-date (within the last minute).
::
:: Internally, when we receive a %run-check poke, we start a thread to
:: attempt to contact that ship, and if it is taking too long, we will
:: investigate and report possible reasons.  As the thread progresses, it
:: will give updates on its investigation by poking the app with
:: `%update-status`, and these updates will immediately go out to
:: subscribers.

:: thread:
::
:: + set pending to %trying-dns
:: - check if we can fetch example.com
::   - else %no-dns
:: + set pending to %trying-target
:: - check if we can contact our own sponsor (passive)
::   - else %no-my-galaxy
:: - check if we can contact target
::   - passive (check if last-contact in last ~m1)
::   - active (ping them, wait for ~s10)
::   - if successful, [%yes ping-time]
:: - if moon, check if we can contact our own planet (passive)
::   - else %no-my-planet
::   - (do this after the initial contact check because if your planet is
::     down, you moon might still be useful to talk to ships that you've
::     already contacted.  so, wait until we know we can't contact that
::     ship to try this)
:: - ask their sponsor if they can talk to them
::   + set pending to [%trying-sponsor ~sponsor]
::   - if no response, recur and try their next sponsor
::     - if no more sponsors, %no-their-galaxy
::   - if positive response, [%sponsor-has-heard ~sponsor]
::   - if negative response, [%sponsor-hasnt-heard ~sponsor]
:: - if thread crashes, [%check-crashed trace]
::
:: as a later optimization, these checks can happen mostly in parallel.  In
:: that case, don't immediately return when any of them respond, only
:: record the result, and then after ~s30 check all the results and give
:: the answer.
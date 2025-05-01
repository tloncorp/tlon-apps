/-  spider, c=channels, co=contacts, ci=cite
/+  strandio, cu=channel-utils, cj=channel-json
=,  strand=strand:spider
^-  thread:spider
::
=/  timeout=@dr  ~s20  ::TODO  tweak
::
|=  arg=vase
=/  m  (strand ,vase)
^-  form:m
=+  !<([~ who=ship] arg)
;<  =bowl:spider  bind:m  get-bowl:strandio
::  if the relevant agents aren't running, we can't get results
::
;<  can-contacts=?  bind:m
  (scry:strandio ? %gu %contacts /$)
;<  can-channels=?  bind:m
  (scry:strandio ? %gu %channels /$)
?.  &(can-contacts can-channels)
  (pure:m !>(`json`a+~))
::  get their contacts profile, extract pinned reference pointers
::
;<  profile=contact:co  bind:m
  =/  m  (strand ,contact:co)
  ;<  hav=?  bind:m
    =/  m  (strand ,?)
    ?:  =(who our.bowl)  (pure:m &)
    %+  scry:strandio  ?
    [%gu %contacts /v1/contact/(scot %p who)]
  ?.  hav  (pure:m *contact:co)
  %+  scry:strandio  contact:co
  :+  %gx  %contacts
  ?:  =(who our.bowl)
    /v1/self/contact-1
  /v1/contact/(scot %p who)/contact-1
=/  refs=(list [=nest:c =plan:c])
  ?~  cis=(~(get by profile) %expose-cites)   ~
  ?.  ?=(%set -.u.cis)                        ~
  %+  murn  ~(tap in p.u.cis)
  |=  val=value:co
  ^-  (unit [nest:c plan:c])
  ?.  ?=([%text @] val)                       ~
  ?~  pax=(rush p.val stap)                   ~
  ?~  cit=(purse:ci u.pax)                    ~
  ?~  pon=(ref-to-pointer:cite:cu u.cit)      ~
  ?.  ?=(?(%chat %diary %heap) p.nest.u.pon)  ~
  pon
=+  all-refs=refs
=+  ref-count=(lent all-refs)
::  we're going to accumulate results in this map
::
=|  pins=(map [nest:c plan:c] (unit said:c))
=/  plan-path
  |=  [=nest:c =plan:c]
  ^-  path
  :*  kind.nest  (scot %p ship.nest)  name.nest
      %post  (scot %ud p.plan)  ?~(q.plan ~ /(scot %ud u.q.plan))
  ==
::  pre-load cache entries into the results
::
|-  =*  loop  $
?^  refs
  ;<  res=(unit (unit said:c))  bind:m
    %+  scry:strandio  (unit (unit said:c))
    :+  %gx  %channels
    =,  i.refs
    [%v3 %said (snoc (plan-path i.refs) %noun)]
  ?~  res  loop(refs t.refs)
  loop(refs t.refs, pins (~(put by pins) i.refs u.res))
::  open subscriptions to try and retrieve latest of everything
::
;<  ~  bind:m
  ::TODO  include timeout timer?
  %-  send-raw-cards:strandio
  ::  always set a timeout timer
  :-  [%pass /timeout %arvo %b %wait (add now.bowl timeout)]
  ::  for each reference, open one or more subscriptions
  ::
  %-  zing
  %+  turn  all-refs
  |=  [=nest:c =plan:c]
  ^-  (list card:agent:gall)
  %+  turn
    ^-  (list path)
    =/  =path  (plan-path nest plan)
    ::  always ask the contact themselves
    ::
    :-  [%v3 %said (scot %p who) path]
    ::  also ask the host, if that's different from the contact
    ::
    ?:  =(ship.nest who)  ~
    [%v3 %said (scot %p ship.nest) path]~
  |=  p=path
  :+  %pass
    ::  just jam the key into the wire for convenience
    ::
    /said/(scot %uw (jam [nest plan]))
  [%agent [our.bowl %channels] %watch p]
::  await all retrievals until we have at least _some_ result for each
::
;<  pins=_pins  bind:m
  =/  m  (strand ,_pins)
  ::  +handle-input will be re-evaluated and passed as the continuation,
  ::  after putting subject changes into the context,
  ::  so that we can carry "state" changes across invocations.
  ::
  |^  ^-  form:m
      check-done
  ++  handle-input
    |=  tin=strand-input:strand
    ^-  output:m
    :-  ~  ::  we never emit effects
    ?~  in.tin
      ::  we are called as the continuation; await the next input
      ::
      [%wait ~]
    ::  we are called with the timeout, early-out
    ::
    ?:  ?=([%sign [%timeout ~] %behn %wake *] u.in.tin)
      [%done pins]
    ::  we are called with a new input event.
    ::
    ?.  ?=  [%agent [%said @ ~] ?([%watch-ack *] [%fact *] [%kick ~])]
        u.in.tin
      [%skip ~]
    =/  key  ;;([nest:c plan:c] (cue (slav %uw i.t.wire.u.in.tin)))
    ?-  -.sign.u.in.tin
        %watch-ack
      ?~  p.sign.u.in.tin  [%wait ~]
      %-  (slog u.p.sign.u.in.tin)
      =?  pins  !(~(has by pins) key)
        (~(put by pins) key ~)
      [%cont check-done]
    ::
        %fact
      ?+  p.cage.sign.u.in.tin
        [%wait ~]
      ::
          %channel-denied
        =?  pins  !(~(has by pins) key)
          (~(put by pins) key ~)
        [%cont check-done]
      ::
          %channel-said-1
        ::TODO  only overwrite if fresher... but can we know?
        =.  pins  (~(put by pins) key `!<(said:c q.cage.sign.u.in.tin))
        [%cont check-done]
      ==
    ::
        %kick
      [%skip ~]  ::REVIEW  if we only get kicks, we never finish...
    ==
  ::  +check-done: called after modifying the subject, sets up continuation
  ::
  ++  check-done
    |=  tin=strand-input:strand
    ^-  output:m
    ~?  !=(~ in.tin)  %contact-pins-check-done-with-input
    ?:  =(ref-count ~(wyt by pins))
      [~ %done pins]
    [~ %cont handle-input]
  --
::  produce all results as json
::
%-  pure:m
!>  ^-  json
:-  %a
%+  turn  all-refs  ::NOTE  .all-refs is ordered
|=  key=[=nest:c =plan:c]
^-  json
~?  !(~(has by pins) key)  [%contact-pins-sad-ref key]
?~  sad=(~(gut by pins) key ~)  ~
(said:enjs:cj u.sad)

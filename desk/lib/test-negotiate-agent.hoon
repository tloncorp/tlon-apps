::  test-agent-negotiate: like /lib/test-agent, but negotiation transparency
::
::    use this as you would /lib/test-agent. this library will hide most
::    /lib/negotiate behavior and side-effects, letting you write tests against
::    your agent's logic without having to simulate version negotation.
::
::    caveats:
::    - the bowl will still contain /~/negotiate wires
::
/+  *test-agent, negotiate
::
|%
+$  card  card:agent:gall
::TODO  +get-bowl
++  do
  |=  call=$-(state [(list card) agent:gall])
  =/  m  (mare ,(list card))
  ::NOTE  ^do will play the cards with their negotiate wires
  ;<  caz=(list card)  bind:m  (^do call)
  ::  simulate immediate matching versions for everywhere we negotiate
  ::
  ;<  res=cage  bind:m  (got-peek /x/~/negotiate/config)
  =+  !<(=config:negotiate q.res)
  =|  cards=(list card)
  |-  =*  loop  $
  ?^  caz
    ?.  ?=([%pass [%~.~ %negotiate %heed @ @ @ ~] *] i.caz)
      loop(caz t.caz, cards (snoc cards i.caz))
    =*  who  (slav %p i.t.t.t.p.i.caz)
    =*  dud         i.t.t.t.t.p.i.caz
    =*  pro       i.t.t.t.t.t.p.i.caz
    ::NOTE  at time of writing, /lib/negotiate no-ops on watch acks,
    ::      so we can get away with not processing the cards here.
    ;<  *  bind:m  (^do-agent p.i.caz [who dud] %watch-ack ~)
    ;<  c=(list card)  bind:m
      %^  do-agent  p.i.caz
        [who dud]
      :+  %fact  %noun
      !>((~(got by (~(got by config) dud)) pro))
    loop(caz t.caz, cards (weld cards c))
  ::  filter out /lib/negotiate internal effects,
  ::  and clean up wrapped wires
  ::
  %-  pure:m
  %+  murn  cards
  |=  =card
  ^-  (unit ^card)
  ?+  card  `card
      [%pass [%~.~ %negotiate %inner-watch @ @ *] *]
    `card(p t.t.t.t.t.p.card)
  ::
    [%give ?(%kick %fact) [[%~.~ %negotiate *] ~] *]  ~
    [%pass [%~.~ %negotiate *] *]  ~
  ==
::
++  do-agent
  |=  [=wire =gill:gall =sign:agent:gall]
  =/  m  (mare ,(list card))
  ^-  form:m
  ::  if this is subscription-related, for a negotiated agent,
  ::  put the lib negotiate wire on
  ::
  ;<  res=cage  bind:m  (got-peek /x/~/negotiate/config)
  =+  !<(=config:negotiate q.res)
  =?  wire  &((~(has by config) q.gill) !?=(%poke-ack -.sign) !?=([%~.~ %negotiate *] wire))
    [%~.~ %negotiate %inner-watch (scot %p p.gill) q.gill wire]
  |=  s=state
  ^-  output:m
  =.  bowl.s  (play-sign bowl.s wire gill sign)
  %.  s  %-  do
  |=  s=state
  (~(on-agent agent.s bowl.s(src p.gill)) wire sign)
::
::NOTE  all of the below copied directly from /lib/test-agent
::TODO  if test-agent was factored differently _maybe_ it'd be possible
::      to wrap these as ++  do-poke  (cork poke do) or similar?
::      but what would you do about the "pre and post logic" cases like +do-init?
::
++  do-init
  =+  scry-warn=&
  |=  [dap=term =agent]
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  old-scry=scry  bind:m  |=(s=state &+[scry.s s])
  ;<  ~              bind:m  %-  set-scry-gate
                             |=  p=path
                             ~?  >>  scry-warn
                               ['scrying during +on-init... careful!' p]
                             (old-scry p)
  ;<  b=bowl         bind:m  get-bowl
  ;<  ~              bind:m  (set-bowl %*(. *bowl dap dap, our our.b, src our.b))
  ;<  c=(list card)  bind:m  (do |=(s=state ~(on-init agent bowl.s)))
  ;<  ~              bind:m  (set-scry-gate old-scry)
  (pure:m c)
::
++  do-load
  =+  scry-warn=&
  |=  [=agent vase=(unit vase)]
  =/  m  (mare ,(list card))
  ^-  form:m
  ;<  old-scry=scry  bind:m  |=(s=state &+[scry.s s])
  ;<  ~              bind:m  %-  set-scry-gate
                             |=  p=path
                             ~?  >>  scry-warn
                               ['scrying during +on-load... careful!' p]
                             (old-scry p)
  ;<  c=(list card)  bind:m  %-  do  |=  s=state
                             %-  ~(on-load agent bowl.s)
                             ?^  vase  u.vase
                             ~(on-save agent.s bowl.s)
  ;<  ~              bind:m  (set-scry-gate old-scry)
  (pure:m c)
::
++  do-poke
  |=  [=mark =vase]
  %-  do
  |=  s=state
  (~(on-poke agent.s bowl.s) mark vase)
::
++  do-watch
  |=  =path
  =/  m  (mare ,(list card))
  ^-  form:m
  |=  s=state
  =.  sup.bowl.s
    =/  =duct  [%test-sub (scot %p src.bowl.s) path]~
    ~_  leaf+"sub on {(spud path)} already made by {(scow %p src.bowl.s)}"
    ?<  (~(has by sup.bowl.s) duct)
    (~(put by sup.bowl.s) duct [src.bowl.s path])
  %.  s  %-  do
  |=  s=state
  (~(on-watch agent.s bowl.s) path)
::
++  do-leave
  |=  =path
  =/  m  (mare ,(list card))
  ^-  form:m
  |=  s=state
  =.  sup.bowl.s
    =/  =duct  [%test-sub (scot %p src.bowl.s) path]~
    ~_  leaf+"sub on {(spud path)} not yet made by {(scow %p src.bowl.s)}"
    ?>  (~(has by sup.bowl.s) duct)
    (~(del by sup.bowl.s) duct [src.bowl.s path])
  %.  s  %-  do
  |=  s=state
  (~(on-leave agent.s bowl.s) path)
::
++  do-arvo
  |=  [=wire sign=sign-arvo]
  %-  do
  |=  s=state
  (~(on-arvo agent.s bowl.s) wire sign)
::
++  do-fail
  |=  [=term =tang]
  %-  do
  |=  s=state
  (~(on-fail agent.s bowl.s) term tang)
--

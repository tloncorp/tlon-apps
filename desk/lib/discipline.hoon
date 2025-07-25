::  discipline: enforce mark sanity
::
::    guards the inner agent's egress against mark shenanigans.
::    set it up by wrapping it around an agent, providing known marks and
::    their types (and whether to hard-prevent changing their types),
::    and specifying which subscription and scry paths are allowed to produce
::    which marks.
::    on agent reload, will check to ensure mark types have not changed.
::    whenever the agent emits facts, or gets scried into, will check that
::    the output lines up with what was specified, and if we know the relevant
::    mark types, that the data actually fits in those.
::
::    watch and scry paths may use the empty path element to indicate
::    "wildcard" spots where any value is matched. the first matching prefix
::    is used.
::REVIEW  or do we want to enforce "longest matching prefix"?
::    for subscription paths, specify any number of marks. zero marks means
::    anything goes. for scry paths, specify the mark that should be produced.
::    the empty string mark means anything goes, but is mostly intended for
::    stubbing out recognition of dev tooling scries.
::
::    mismatches are reported as priority debug prints and, when possible,
::    logged to posthog as criticals.
::
::    usage example:
::      /%  m-my-mark  %my-mark
::      %-  %-  discipline
::          :+  ::  marks
::              ::
::              :~  [%my-mark strict=& -:!>(*vale:m-my-mark)]
::              ==
::            ::  facts
::            ::
::            :~  [/some/path/$/details %my-mark ~]
::                [/some/more/things %my-mark %noun ~]
::            ==
::          ::  scries
::          ::
::          :~  [/x/stuff %my-mark]
::          ==
::      rest-of-the-agent
::
/+  logs
::
/%  m-noun  %noun
::
|=  $:  marks=(list [=mark strict=? =type])
        facts=(list [=path marks=(list mark)])  ::  first matching is used, ~ for any
        scries=(list [=path =mark])
    ==
::  take care of common marks, libraries
::
=.  marks
  =-  (weld - marks)
  :~  [%noun & -:!>(*vale:m-noun)]
  ==
=.  facts
  %+  weld
    ^-  (list [path (list mark)])
    :~  [/verb ~]
        [/~/negotiate ~]
    ==
  facts
=.  scries
  %+  weld  scries
  ^-  (list [path mark])
  :~  [/u %loob]
      [/x/~/negotiate %$]
  ==
::  sort arguments such that we always encounter/test the most specific ones first
::
=/  por
  |=  [[a=path *] [b=path *]]
  ?~  a  |
  ?~  b  &
  ?:  =(i.a i.b)  $(a t.a, b t.b)
  ?:  =(%$ i.a)  |
  ?:  =(%$ i.b)  &
  (aor i.a i.b)
=.  facts   (sort facts por)
=.  scries  (sort scries por)
::
=/  mark-map=(map mark [strict=? =type])
  (~(gas by *(map mark [? type])) marks)
=/  mark-types=(map mark type)
  (~(run by mark-map) tail)
::
|=  inner=agent:gall
|^  agent
::
+$  card  card:agent:gall
::  +match-path: is .test a template-prefix of .real?
::
++  match-path
  |=  [test=path real=path]
  ^-  ?
  ?|  ?=(~ test)
  ?&  ?=(^ real)
      |(=(%$ i.test) =(i.test i.real))
      $(test t.test, real t.real)
  ==  ==
::  +expected-fact-marks: marks from the first path in .facts matching .path
::
++  expected-fact-marks
  |=  =path
  ^-  (unit (list mark))
  ?~  facts  ~
  ?:  (match-path path.i.facts path)
    `marks.i.facts
  $(facts t.facts)
::
::  +expected-scry-mark: marks from the first path in .scries matching .path
::
++  expected-scry-mark
  |=  =path
  ^-  (unit mark)
  ?~  scries  ~
  ?:  (match-path path.i.scries path)
    `mark.i.scries
  $(scries t.scries)
::
++  helper
  |_  [=bowl:gall marks=(map mark type)]
  ++  log  ~(. logs our.bowl /~/discipline/logs)
  ::  +inner-bowl: bowl without /~/discipline subs
  ::
  ++  inner-bowl
    %_  bowl
        wex
      %-  ~(gas by *boat:gall)
      %+  skip  ~(tap by wex.bowl)
      |=  [[=wire *] *]
      ?=([%~.~ %discipline *] wire)
    ==
  ::  +check-cards: check facts among cards
  ::
  ++  check-cards
    |=  [watch-path=(unit path) cards=(list card)]
    ^+  cards
    (zing (turn cards (cury check-card watch-path)))
  ::  +check-card: check facts for mismatching marks, log if so
  ::
  ++  check-card
    |=  [watch-path=(unit path) =card]
    ^-  (list ^card)
    :-  card
    ?.  ?=([%give %fact *] card)  ~
    =?  paths.p.card  ?=(~ paths.p.card)
      ~?  >>  ?=(~ watch-path)  [%discipline dap=dap.bowl %initial-fact-but-no-watch-path]
      (drop watch-path)
    %+  murn  paths.p.card
    |=  =path
    ^-  (unit ^card)
    ?~  ex-marks=(expected-fact-marks path)
      ~&  >>  [%discipline dap=dap.bowl %unknown-path path=path]
      `(tell:log %warn ~['discipline: unknown path' >path<] ~)
    ?.  ?|  =(~ u.ex-marks)  ::  empty list allows any mark
            ?=(^ (find ~[p.cage.p.card] u.ex-marks))
        ==
      =+  n=[path=path mark=p.cage.p.card allowed=u.ex-marks]
      ~&  >>>  [%discipline dap=dap.bowl %bad-fact-mark n]
      `(tell:log %crit ~['discipline: bad fact mark' >n<] ~)
    ?~  type=(~(get by marks) p.cage.p.card)
      ::NOTE  if we don't have a type for this mark,
      ::      ignore it, since we can't test it
      ~
    ?:  (~(nest ut u.type) | p.q.cage.p.card)
      ~
    =+  n=[on-path=path with-mark=p.cage.p.card %nest-fail]
    ~&  >>>  [%discipline dap=dap.bowl %bad-fact-data n]
    `(tell:log %crit ~['discipline: bad fact data' >n<] ~)
  ::  +check-scry: validate result against known marks
  ::
  ++  check-scry
    |=  [=path result=(unit (unit cage))]
    ^-  ?
    ?.  ?=([~ ~ *] result)  &
    ?~  want=(expected-scry-mark path)
      ~&  [%discipline dap=dap.bowl %unknown-scry-path path=path mark=p.u.u.result]
      &
    ?:  =(%$ u.want)
      ::NOTE  easy-out
      &
    ?.  =(p.u.u.result u.want)
      ~&  >>>  [%discipline dap=dap.bowl %bad-scry-mark path=path want=want got=p.u.u.result]
      |
    ?~  type=(~(get by marks) p.u.u.result)
      ::NOTE  if we don't have a type for this mark,
      ::      ignore it, since we can't test it
      &
    ?:  (~(nest ut u.type) | p.q.u.u.result)
      &
    ~&  >>>  [%discipline dap=dap.bowl %bad-scry-data on-path=path with-mark=p.u.u.result %nest-fail]
    |
  ::  +check-marks: for marks where we know both sides, check equivalence
  ::
  ::    produces the marks that aren't equivalent
  ::
  ++  check-marks
    |=  [ole=(map mark type) neu=(map mark [strict=? =type])]
    ^-  (list mark)
    %+  murn  ~(tap by ole)
    |=  old=[=mark =type]
    ^-  (unit mark)
    ?~  new=(~(get by neu) mark.old)  ~
    ?.  strict.u.new  ~
    =;  match=?
      ?:(match ~ `mark.old)
    ?&  (~(nest ut type.old) | type.u.new)
        (~(nest ut type.u.new) | type.old)
    ==
  --
::
+$  state-0
  $:  %0
      last-marks=(map mark type)
  ==
::
++  agent
  =|  state-0
  =*  state  -
  ^-  agent:gall
  !.  ::  we hide all the "straight into the inner agent" paths from traces
  |_  =bowl:gall
  +*  this    .
      help    ~(. helper bowl last-marks)
      og      ~(. inner inner-bowl:help)
  ::
  ++  on-init
    ^-  (quip card _this)
    =.  last-marks  mark-types
    =^  cards  inner  on-init:og  !:
    =.  cards  (check-cards:help ~ cards)
    [cards this]
  ::
  ++  on-save  (slop !>([%discipline state]) on-save:og)
  ++  on-load
    |=  ole=vase
    ^-  (quip card _this)
    ?.  ?=([[%discipline *] *] q.ole)
      =.  last-marks  mark-types
      =^  cards  inner  (on-load:og ole)  !:
      =.  cards  (check-cards:help ~ cards)
      [cards this]
    =+  !<([%discipline old=state-0] (slot 2 ole))
    =.  state  old
    ?^  bad=(check-marks:help last-marks mark-map)
      ~|  [%discipline dap=dap.bowl %mark-types-changed marks=;;((list mark) bad)]
      !!
    =.  last-marks  mark-types
    =^  cards  inner  (on-load:og (slot 3 ole))  !:
    =.  cards  (check-cards:help ~ cards)
    [cards this]
  ::
  ++  on-watch
    |=  =path
    ^-  (quip card _this)
    =^  cards  inner  (on-watch:og path)
    =.  cards  (check-cards:help `path cards)
    [cards this]
  ::
  ++  on-peek
    |=  =path
    ^-  (unit (unit cage))
    =/  res=(unit (unit cage))
      (on-peek:og path)
    =+  (check-scry:help path res)
    res
  ::
  ++  on-poke
    |=  [=mark =vase]
    ^-  (quip card _this)
    ?.  ?&  ?=(%egg-any mark)
            !:
              =+  !<(=egg-any:gall vase)
          ?&  ?=(%live +<.egg-any)
              ?=([[%discipline *] *] q.old-state.egg-any)
          ==  ==
      =^  cards  inner  (on-poke:og mark vase)
      =.  cards  (check-cards:help ~ cards)
      [cards this]
    ::  strip the negotiate state out of the egg,
    ::  and pass it on to the inner agent
    ::
    =/  =cage  !:
      :-  mark
      !>  ^-  egg-any:gall
      =+  !<(=egg-any:gall vase)
      ?>  ?=(%live +<.egg-any)
      %_  egg-any
        +.old-state  (slot 3 +.old-state.egg-any)
      ==
    =^  cards  inner  (on-poke:og cage)  !:
    =.  cards  (check-cards:help ~ cards)
    [cards this]
  ::
  ++  on-leave
    |=  =path
    ^-  (quip card _this)
    =^  cards  inner  (on-leave:og path)
    =.  cards  (check-cards:help ~ cards)
    [cards this]
  ::
  ++  on-agent
    |=  [=wire =sign:agent:gall]
    ^-  (quip card _this)
    ?:  ?=([%~.~ %discipline *] wire)
      ?:  ?=([%logs ~] t.t.wire)  [~ this]
      ~&  [%discipline dap=dap.bowl bad-wire=wire]
      [~ this]
    =^  cards  inner  (on-agent:og wire sign)
    =.  cards  (check-cards:help ~ cards)
    [cards this]
  ::
  ++  on-arvo
    |=  [=wire sign=sign-arvo]
    ^-  (quip card _this)
    =^  cards  inner  (on-arvo:og wire sign)
    =.  cards  (check-cards:help ~ cards)
    [cards this]
  ::
  ++  on-fail
    |=  [=term =tang]
    ^-  (quip card _this)
    =^  cards  inner  (on-fail:og term tang)
    =.  cards  (check-cards:help ~ cards)
    [cards this]
  --
--
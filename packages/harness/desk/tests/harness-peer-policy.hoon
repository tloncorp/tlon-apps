/-  h=harness, t=harness-tlon
/+  *test, peers=harness-peer-policy, tlon=harness-tlon-policy, defaults=harness-defaults,
    hj=harness-json
|%
++  test-outgoing-collaboration-requires-current-incoming-trust
  =/  trusted=peer-grant:h  [~[%web] ~ 0 ~]
  =/  work  trusted(tools ~[%workspace])
  ;:  weld
      (expect !>(!(can-send:peers ~ ~)))
      (expect !>((can-send:peers `trusted ~)))
      (expect !>(!(can-send:peers `trusted `'workspace')))
      (expect !>((can-send:peers `work `'workspace')))
      (expect !>(!(can-send:peers ~ `'workspace')))
  ==
++  test-token-count-starts-at-lifetime-and-reset-only-changes-baseline
  ;:  weld
      (expect-eq !>(1.234) !>((used:peers 1.234 0)))
      (expect-eq !>(0) !>((used:peers 1.234 1.234)))
      (expect-eq !>(66) !>((used:peers 1.300 1.234)))
      (expect-eq !>(0) !>((used:peers 0 1.234)))
  ==
++  test-trusted-peers-are-unlimited-and-sender-scoped
  =/  =policy:t  [| `~bud (my ~[[~nec ~[%web]] [~zod ~]]) %mentions ~ ~]
  =/  grants  (peer-grants:tlon policy)
  =/  trusted  (need (~(get by grants) ~nec))
  =/  owner  (need (~(get by grants) ~bud))
  =/  other  (need (~(get by grants) ~zod))
  ;:  weld
      (expect-eq !>(0) !>(budget.trusted))
      (expect-eq !>(~[%web]) !>(tools.trusted))
      (expect-eq !>(`(list tool-grant:h)`~) !>(tools.owner))
      (expect-eq !>(`(list tool-grant:h)`~) !>(tools.other))
      (expect-eq !>(`(set @t)`~) !>(inflows.trusted))
  ==
++  test-explicit-peer-limit-overrides-trusted-default
  =/  =policy:t  [& ~ (my ~[[~nec ~[%web]]]) %mentions ~ ~]
  =/  trusted  (peer-grants:tlon policy)
  =/  grant=peer-grant:h  [~ `'custom-model' 12.345 ~]
  =/  explicit=(map @p peer-grant:h)  (my ~[[~nec grant]])
  =/  effective  (effective:peers explicit trusted ~)
  (expect-eq !>(`grant) !>((~(get by effective) ~nec)))
++  test-removing-trust-does-not-leave-an-inherited-grant
  =/  before=policy:t  [& ~ (my ~[[~nec ~]]) %mentions ~ ~]
  =/  after  before(trusted ~)
  =/  first  (effective:peers ~ (peer-grants:tlon before) ~)
  =/  second  (effective:peers ~ (peer-grants:tlon after) ~)
  (expect !>(&((~(has by first) ~nec) !(~(has by second) ~nec))))
++  test-peer-grant-json-roundtrip-keeps-model-budget-and-inflows
  =/  grant=peer-grant:h  [~[%web [%mcp 'calendar']] `'model-name' 100 (silt ~['reading'])]
  =/  json  [%a ~[(grant-json:peers ~nec grant)]]
  =/  decoded  (json-grants:peers json)
  (expect-eq !>(`grant) !>((~(get by decoded) ~nec)))
++  test-zero-limit-is-unlimited
  =/  decoded
    %-  json-grants:peers
    (need (de:json:html '[{"ship":"~nec","tools":[],"model":null,"budget":0,"inflows":[]}]'))
  (expect-eq !>(0) !>(budget:(need (~(get by decoded) ~nec))))
++  test-invalid-peer-policy-is-rejected
  %-  zing
  %+  turn
    :~  '[{"ship":"bad","tools":[],"model":null,"budget":0,"inflows":[]}]'
        '[{"ship":"~nec","tools":[],"model":null,"budget":-1,"inflows":[]}]'
        '[{"ship":"~nec","tools":[],"model":null,"budget":0.5,"inflows":[]}]'
        '[{"ship":"~nec","tools":["invented"],"model":null,"budget":0,"inflows":[]}]'
    ==
  |=  raw=@t
  =/  out  (mule |.((json-grants:peers (need (de:json:html raw)))))
  (expect !>(?=(%| -.out)))
++  test-duplicate-peer-ships-are-rejected
  =/  row  (grant-json:peers ~nec [~ ~ 0 ~])
  =/  out  (mule |.((json-grants:peers [%a ~[row row]])))
  (expect !>(?=(%| -.out)))
++  test-serving-defaults-need-no-separate-configuration
  (expect-eq !>(`(unit config:h)`~) !>((json-config:peers ~)))
++  test-serving-config-never-imports-a-key-or-default-tools
  =/  base=config:h  builtin-config:defaults
  =/  config  base(key 'fixture-secret', tools ~[%code])
  =/  raw  (config-json:hj config)
  ?>  ?=(%o -.raw)
  =/  imported  (json-config:peers [%o (~(put by p.raw) 'key' [%s 'injected-secret'])])
  ?>  ?=(^ imported)
  (expect !>(&(=('' key.u.imported) =(~ tools.u.imported))))
++  test-peer-revisions-fence-grants-trust-and-model-changes
  =/  empty  (revision:peers ~ ~ ~ ~)
  =/  grants=(map @p peer-grant:h)  (my ~[[~nec [~ ~ 0 ~]]])
  ;:  weld
      (expect !>(!=(empty (revision:peers grants ~ ~ ~))))
      (expect !>(!=(empty (revision:peers ~ grants ~ ~))))
      (expect !>(!=(empty (revision:peers ~ ~ `builtin-config:defaults ~))))
      (expect !>(!=(empty (revision:peers ~ ~ ~ (my ~[[~nec 1]])))))
  ==
++  test-trusted-limit-does-not-create-independent-access
  =/  trusted=(map @p peer-grant:h)  (my ~[[~nec [~[%web] ~ 0 ~]]])
  =/  limits=(map @p @ud)  (my ~[[~nec 1.000]])
  =/  with-limit  (effective:peers ~ trusted limits)
  =/  removed  (effective:peers ~ ~ limits)
  (expect !>(&(=(1.000 budget:(need (~(get by with-limit) ~nec))) !(~(has by removed) ~nec))))
--

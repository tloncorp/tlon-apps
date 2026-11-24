/-  t=harness-tlon, h=harness
/+  *test, p=harness-tlon-policy, c=harness-tlon-continuity, permissions=harness-tlon-permissions
|%
++  policy
  ^-  policy:t
  [& `~nec ~ %mentions (silt ~[~bud]) ~ ~ ~]
++  test-allowed-ships-have-web-without-peer-trust
  ;:  weld
      (expect-eq !>(`(unit (list tool-grant:h))`[~ ~[%web]]) !>((grants:p policy ~bud ~)))
      (expect !>(!(~(has by (peer-grants:p policy)) ~bud)))
      (expect-eq !>(`(unit (list tool-grant:h))`~) !>((grants:p policy ~zod ~)))
  ==
++  test-channel-only-access-does-not-grant-dms
  =/  policy  policy
  =.  policy  policy(channels (my ~[[[%chat ~nec %test] [%mentions &]]]))
  ;:  weld
      (expect !>(?=(^ (destination-grants:p policy ~zod [%channel [%chat ~nec %test] ~] ~ |))))
      (expect !>(?=(~ (destination-grants:p policy ~zod [%dm ~zod ~] ~ |))))
      (expect !>(?=(~ (destination-grants:p policy ~zod [%channel [%chat ~nec %elsewhere] ~] ~ |))))
  ==
++  test-off-blocks-owners-and-allowed-ships-in-that-channel
  =/  policy  policy
  =.  policy  policy(channels (my ~[[[%chat ~nec %test] [%off &]]]))
  ;:  weld
      (expect !>(?=(~ (destination-grants:p policy ~nec [%channel [%chat ~nec %test] ~] ~ &))))
      (expect !>(?=(~ (destination-grants:p policy ~bud [%channel [%chat ~nec %test] ~] ~ |))))
      (expect !>(?=(^ (destination-grants:p policy ~bud [%dm ~bud ~] ~ |))))
  ==
++  test-a-channel-rule-change-resets-that-channel-only
  =/  policy  policy
  =/  next  policy(channels (my ~[[[%chat ~nec %test] [%off |]]]))
  ;:  weld
      (expect !>((affected:c policy next [[%channel [%chat ~nec %test] ~] 1 ~[%web]])))
      (expect !>((affected:c policy next [[%channel [%chat ~nec %test] `~2026.9.1] 1 ~[%web]])))
      (expect !>(!(affected:c policy next [[%channel [%chat ~nec %elsewhere] ~] 1 ~[%web]])))
      (expect !>(!(affected:c policy next [[%dm ~bud ~] 1 ~[%web]])))
  ==
++  test-policy-roundtrip
  =/  policy  policy
  =.  policy  policy(channels (my ~[[[%chat ~nec %test] [%all &]]]))
  (expect-eq !>(policy) !>((json-policy:p *policy:t (policy-json:p policy))))
++  test-channel-cutoffs-preserve-unrelated-input
  =/  policy  policy
  =/  next  policy(channels (my ~[[[%chat ~nec %test] [%off |]]]))
  =/  cuts  (channel-cutoffs:c policy next (my ~[[[%chat ~nec %other] ~2026.9.1]]) ~2026.9.2)
  ;:  weld
      (expect-eq !>(`@da`~2026.9.1) !>((~(got by cuts) [%chat ~nec %other])))
      (expect-eq !>(`@da`~2026.9.2) !>((~(got by cuts) [%chat ~nec %test])))
      (expect !>(!(~(has by cuts) [%chat ~nec %untouched])))
  ==
++  test-permission-save-rejects-stale-revisions
  =/  args  (pairs:enjs:format ~[['revision' %s 'stale']])
  =/  result  (apply:permissions policy 1 args)
  ?>  ?=(%| -.result)
  (expect-eq !>(409) !>(status.p.result))
++  test-permission-save-preserves-explicit-tools-without-granting-new-peer-access
  =/  policy  policy
  =.  policy  policy(trusted (my ~[[~bud ~[%skills]]]))
  =/  args
    %-  pairs:enjs:format
    :~  ['revision' %s (revision:permissions policy 1)]  ['enabled' %b &]
        ['allowedShips' %a ~[[%s '~bud'] [%s '~zod']]]  ['response' %s 'mentions']
        ['channels' %a ~]
    ==
  =/  result  (apply:permissions policy 1 args)
  ?>  ?=(%& -.result)
  ;:  weld
      (expect-eq !>(~[%skills]) !>((~(got by trusted.p.result) ~bud)))
      (expect !>(!(~(has by trusted.p.result) ~zod)))
      (expect !>((~(has in allowed.p.result) ~zod)))
  ==
++  test-mobile-format-reads-and-saves-the-native-policy
  =/  policy  policy
  =/  initial  policy(allowed (silt ~[~nec ~bud]), channels (my ~[[[%chat ~nec %test] [%all |]]]))
  =/  body  (chat-view:permissions initial)
  ?>  ?=(%o -.body)
  =.  p.body  (~(del by p.body) 'fromDefaults')
  =/  result  (chat-apply:permissions initial body)
  ?>  ?=(%& -.result)
  (expect-eq !>(initial) !>(p.result))
++  test-mobile-removal-disables-channel-and-keeps-unrelated-policy
  =/  policy  policy
  =/  initial  policy(channels (my ~[[[%chat ~nec %test] [%all |]]]))
  =/  result  (chat-apply:permissions initial (pairs:enjs:format ~[['channelRules' %o ~]]))
  ?>  ?=(%& -.result)
  (expect-eq !>(initial(channels (my ~[[[%chat ~nec %test] [%off |]]]))) !>(p.result))
++  test-mobile-does-not-promote-channel-only-ships-to-global-access
  =/  body
    %-  need
    %-  de:json:html
    '{"channelRules":{"chat/~nec/test":{"mode":"allowlist","allowedShips":["~zod"]}}}'
  =/  result  (chat-apply:permissions policy body)
  (expect !>(?=(%| -.result)))
++  test-mobile-does-not-pretend-to-save-independent-lists
  =/  body  (need (de:json:html '{"dmAllowlist":["~nec"],"defaultAuthorizedShips":["~zod"]}'))
  =/  result  (chat-apply:permissions policy body)
  (expect !>(?=(%| -.result)))
++  test-mobile-channel-update-retains-modes-and-disables-omissions
  =/  initial  policy
  =.  channels.initial
    %-  my
    :~  [[%chat ~nec %retained] [%all |]]
        [[%chat ~nec %omitted] [%mentions &]]
    ==
  =/  open-rule  (pairs:enjs:format ~[['mode' %s 'open']])
  =/  allow-rule
    %-  pairs:enjs:format
    :~  ['mode' %s 'allowlist']
        ['allowedShips' %a ~[[%s '~nec'] [%s '~bud']]]
    ==
  =/  rules
    %-  pairs:enjs:format
    :~  ['chat/~nec/retained' open-rule]
        ['chat/~nec/new' allow-rule]
    ==
  =/  result  (chat-apply:permissions initial (pairs:enjs:format ~[['channelRules' rules]]))
  ?>  ?=(%& -.result)
  =/  expected  initial
  =.  channels.expected
    %-  my
    :~  [[%chat ~nec %retained] [%all &]]
        [[%chat ~nec %omitted] [%off &]]
        [[%chat ~nec %new] [%mentions |]]
    ==
  (expect-eq !>(expected) !>(p.result))
++  test-mobile-omitted-channel-rules-preserve-policy
  =/  initial  policy
  =.  channels.initial
    (my ~[[[%chat ~nec %test] [%all |]]])
  =/  result  (chat-apply:permissions initial [%o ~])
  ?>  ?=(%& -.result)
  (expect-eq !>(initial) !>(p.result))
++  test-mobile-invalid-channel-rules-fail-closed
  =/  cases=(list @t)
    :~
      '{"channelRules":[]}'
      '{"channelRules":{"chat/~nec/test":{"mode":"unknown"}}}'
      '{"channelRules":{"chat/~nec/test":{"mode":"allowlist"}}}'
      '{"channelRules":{"chat/~nec/test":{"mode":"allowlist","allowedShips":["~zod"]}}}'
      '{"channelRules":{"chat/~nec":{"mode":"open"}}}'
      '{"channelRules":{"other/~nec/test":{"mode":"open"}}}'
    ==
  %-  zing
  %+  turn  cases
  |=  body=@t
  =/  result  (chat-apply:permissions policy (need (de:json:html body)))
  ?>  ?=(%| -.result)
  (expect-eq !>(400) !>(status.p.result))
::  ~zod has a grant for chat/~nec/test only, ~bus for its DM only. Neither
::  is on a ship-wide list.
::
++  placed
  ^-  policy:t
  =/  placed  policy
  %=  placed
    dm-grants  (silt ~[~bus])
    channel-grants  (my ~[[[%chat ~nec %test] (silt ~[~zod])]])
  ==
++  room  `destination:t`[%channel [%chat ~nec %test] ~]
++  test-a-channel-grant-answers-there-and-nowhere-else
  ;:  weld
      (expect !>(?=(^ (destination-grants:p placed ~zod room ~ |))))
      (expect !>(?=(^ (destination-grants:p placed ~zod [%channel [%chat ~nec %test] `~2026.9.1] ~ |))))
      (expect !>(?=(~ (destination-grants:p placed ~zod [%channel [%chat ~nec %other] ~] ~ |))))
      (expect !>(?=(~ (destination-grants:p placed ~zod [%dm ~zod ~] ~ |))))
  ==
++  test-a-dm-grant-answers-in-the-dm-and-in-no-channel
  ;:  weld
      (expect !>(?=(^ (destination-grants:p placed ~bus [%dm ~bus ~] ~ |))))
      (expect !>(?=(~ (destination-grants:p placed ~bus room ~ |))))
      (expect !>(?=(~ (destination-grants:p placed ~bus [%channel [%chat ~nec %other] ~] ~ |))))
  ==
++  test-a-place-grant-gives-web-and-no-other-tool
  ;:  weld
      %+  expect-eq  !>(`(unit (list tool-grant:h))`[~ ~[%web]])
      !>((destination-grants:p placed ~zod room ~[%tlon %code] |))
      %+  expect-eq  !>(`(unit (list tool-grant:h))`[~ ~[%web]])
      !>((destination-grants:p placed ~bus [%dm ~bus ~] ~[%tlon %code] |))
      ::  A per-place grant is not ship-wide access.
      (expect-eq !>(`(unit (list tool-grant:h))`~) !>((grants:p placed ~zod ~)))
      (expect-eq !>(`(unit (list tool-grant:h))`~) !>((grants:p placed ~bus ~)))
      (expect !>(!(~(has by (peer-grants:p placed)) ~zod)))
  ==
++  test-an-off-channel-answers-nobody-and-an-open-one-everybody-despite-grants
  =/  placed  placed
  =/  off  placed(channels (my ~[[[%chat ~nec %test] [%off |]]]))
  =/  open  placed(channels (my ~[[[%chat ~nec %test] [%mentions &]]]))
  ;:  weld
      (expect !>(?=(~ (destination-grants:p off ~zod room ~ |))))
      (expect !>(?=(^ (destination-grants:p open ~dev room ~ |))))
  ==
++  test-a-channel-grant-moves-only-that-place-cutoff
  =/  placed  placed
  =/  next  placed(channel-grants (~(put by channel-grants.placed) [%chat ~nec %other] (silt ~[~bus])))
  =/  prior  (my ~[[[~bus ~] ~2026.9.1]])
  =/  ship-cuts  (my ~[[~bus ~2026.9.1]])
  =/  place-cuts  (place-cutoffs:c placed next prior ~2026.9.2)
  ;:  weld
      (expect-eq !>(`~2026.9.2) !>((~(get by place-cuts) [~bus `[%chat ~nec %other]])))
      (expect-eq !>(`~2026.9.1) !>((~(get by place-cuts) [~bus ~])))
      %+  expect-eq  !>(ship-cuts)
      !>((cutoffs:c placed next ~ (silt ~[~bus]) ship-cuts ~2026.9.2))
  ==
++  test-a-dm-grant-does-not-move-a-channel-cutoff
  =/  placed  placed
  =/  next  placed(dm-grants (~(put in dm-grants.placed) ~zod))
  =/  prior  (my ~[[[~zod `[%chat ~nec %test]] ~2026.9.1]])
  =/  place-cuts  (place-cutoffs:c placed next prior ~2026.9.2)
  ;:  weld
      (expect-eq !>(`~2026.9.2) !>((~(get by place-cuts) [~zod ~])))
      (expect-eq !>(`~2026.9.1) !>((~(get by place-cuts) [~zod `[%chat ~nec %test]])))
      (expect-eq !>(~) !>((cutoffs:c placed next ~ (silt ~[~zod]) ~ ~2026.9.2)))
  ==
++  test-removing-a-dm-grant-retires-that-dm-only
  =/  placed  placed
  =/  next  placed(dm-grants ~)
  ;:  weld
      (expect !>((affected:c placed next [[%dm ~bus ~] 1 ~[%web]])))
      (expect !>(!(affected:c placed next [[%dm ~zod ~] 1 ~[%web]])))
      (expect !>(!(affected:c placed next [room 1 ~[%web]])))
      (expect !>((place-changed:c placed next ~bus ~)))
      (expect !>(!(place-changed:c placed next ~zod `[%chat ~nec %test])))
  ==
++  test-a-place-grant-beside-ship-wide-access-changes-nothing
  =/  placed  placed
  =/  wide  placed(allowed (silt ~[~zod ~bud]))
  =/  next  wide(channel-grants ~)
  ;:  weld
      (expect !>(!(place-changed:c wide next ~zod `[%chat ~nec %test])))
      (expect-eq !>(~) !>((place-cutoffs:c wide next ~ ~2026.9.2)))
  ==
++  test-place-grants-roundtrip-through-policy-json
  (expect-eq !>(placed) !>((json-policy:p *policy:t (policy-json:p placed))))
++  test-configure-json-without-place-grants-keeps-them
  =/  encoded  (policy-json:p policy)
  ?>  ?=(%o -.encoded)
  =/  older  [%o (~(del by (~(del by p.encoded) 'dmGrants')) 'channelGrants')]
  =/  emptied
    [%o (~(put by (~(put by p.encoded) 'dmGrants' [%a ~])) 'channelGrants' [%a ~])]
  ;:  weld
      (expect-eq !>(placed) !>((json-policy:p placed older)))
      (expect-eq !>(policy) !>((json-policy:p placed emptied)))
  ==
++  many-ships
  ^-  (list @p)
  (turn (gulf 0 99) |=(n=@ud `@p`(add ~marzod n)))
++  test-more-than-64-allowed-ships-save-and-are-enforced
  =/  policy  policy
  =/  wide  policy(allowed (silt many-ships))
  =/  saved  (json-policy:p *policy:t (policy-json:p wide))
  =/  last  (add ~marzod 99)
  ;:  weld
      (expect-eq !>(100) !>(~(wyt in allowed.saved)))
      (expect !>(?=(^ (destination-grants:p saved last [%dm last ~] ~ |))))
      (expect !>(?=(~ (destination-grants:p saved (add ~marzod 100) [%dm (add ~marzod 100) ~] ~ |))))
  ==
++  test-more-than-64-ships-save-through-both-settings-formats
  =/  ships=json  [%a (turn many-ships |=(who=@p [%s (scot %p who)]))]
  =/  native
    %-  pairs:enjs:format
    :~  ['revision' %s (revision:permissions policy 1)]  ['enabled' %b &]
        ['allowedShips' ships]  ['response' %s 'mentions']  ['channels' %a ~]
    ==
  =/  first  (apply:permissions policy 1 native)
  =/  second  (chat-apply:permissions policy (pairs:enjs:format ~[['dmAllowlist' ships]]))
  ?>  ?=(%& -.first)
  ?>  ?=(%& -.second)
  ;:  weld
      (expect-eq !>(100) !>(~(wyt in allowed.p.first)))
      (expect-eq !>(100) !>(~(wyt in allowed.p.second)))
  ==
++  test-saving-the-app-settings-keeps-place-grants
  =/  placed  placed
  =/  initial  placed(allowed (silt ~[~nec ~bud]))
  =/  body  (chat-view:permissions initial)
  ?>  ?=(%o -.body)
  =.  p.body  (~(del by p.body) 'fromDefaults')
  =/  same  (chat-apply:permissions initial body)
  =/  fewer
    (chat-apply:permissions initial (pairs:enjs:format ~[['dmAllowlist' %a ~[[%s '~nec']]]]))
  =/  rules  (chat-apply:permissions initial (pairs:enjs:format ~[['channelRules' %o ~]]))
  ?>  ?=(%& -.same)
  ?>  ?=(%& -.fewer)
  ?>  ?=(%& -.rules)
  ;:  weld
      (expect-eq !>(initial) !>(p.same))
      %+  expect-eq  !>([dm-grants channel-grants]:initial)
      !>([dm-grants channel-grants]:p.fewer)
      %+  expect-eq  !>([dm-grants channel-grants]:initial)
      !>([dm-grants channel-grants]:p.rules)
      ::  The app's format reports the ship-wide list alone.
      %+  expect-eq  !>((chat-view:permissions initial(dm-grants ~, channel-grants ~)))
      !>((chat-view:permissions initial))
  ==
--

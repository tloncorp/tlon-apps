/-  t=harness-tlon, h=harness
/+  *test, p=harness-tlon-policy, c=harness-tlon-continuity, permissions=harness-tlon-permissions
|%
++  policy
  ^-  policy:t
  [& `~nec ~ %mentions (silt ~[~bud]) ~]
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
++  test-channel-revocation-fences-only-affected-lanes
  =/  policy  policy
  =/  next  policy(channels (my ~[[[%chat ~nec %test] [%off |]]]))
  ;:  weld
      (expect !>((affected:c policy next [~bud [%channel [%chat ~nec %test] ~] 1 ~[%web]])))
      (expect !>(!(affected:c policy next [~bud [%channel [%chat ~nec %elsewhere] ~] 1 ~[%web]])))
      (expect !>(!(affected:c policy next [~bud [%dm ~bud ~] 1 ~[%web]])))
  ==
++  test-policy-roundtrip
  =/  policy  policy
  =.  policy  policy(channels (my ~[[[%chat ~nec %test] [%all &]]]))
  (expect-eq !>(policy) !>((json-policy:p (policy-json:p policy))))
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
--

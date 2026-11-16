/-  t=harness-tlon, h=harness, cr=harness-cron, hh=harness-hand
/+  *test, c=harness-tlon-continuity
|%
++  test-detached-route-keeps-receipts-and-starts-a-fresh-conversation
  =/  saved=state-2:t  *state-2:t
  =.  saved
    %=  saved  epoch  7  lanes  (my ~[['s' dm] ['other' dm]])  routes
        (my ~[['s' ['binding' %ready]] ['other' ['other-binding' %ready]]])  identities
        (my ~[[[~bud [%dm ~bud ~]] 's']])  deliveries  (my ~[[0v1 [1 %send %uncertain 'external']]])
    ==
  =.  jobs.saved  (my ~[[0v1 [[~bud 'event' [%dm ~bud ~] 'Hello'] 's' %observe '']]])
  =/  db=state:hh  *state:hh
  =.  bindings.db
    %-  my
    :~  ['binding' ['tlon' 'dm/~bud' 's' ~['~bud'] |]]
        ['other-binding' ['tlon' 'dm/~bud' 'other' ~['~bud'] &]]
    ==
  =/  next  (detach-routes:c saved db)
  ;:  weld
      (expect-eq !>(8) !>(epoch.next))
      (expect !>(!=('s' (~(got by identities.next) [~bud [%dm ~bud ~]]))))
      (expect-eq !>(1) !>(~(wyt by identities.next)))
      (expect-eq !>(deliveries.saved) !>(deliveries.next))
      (expect-eq !>(~) !>(jobs.next))
      (expect-eq !>((my ~[['other' dm]])) !>(lanes.next))
      (expect !>(!(~(has by routes.next) 's')))
      (expect-eq !>(next) !>((detach-routes:c next db)))
      (expect !>(!=((binding:c 's' 7) (binding:c 's' epoch.next))))
  ==
++  policy
  ^-  policy:t
  [& `~lux (my ~[[~bud ~[%web]]]) %mentions ~ ~]
++  dm
  ^-  lane:t
  [~bud [%dm ~bud ~] 7 ~[%web]]
++  test-unrelated-grant-change-preserves-conversation
  =/  policy  policy
  =/  next  policy(trusted (~(put by trusted.policy) ~zod ~[%skills]))
  (expect !>(!(affected:c policy next dm)))
++  test-grant-order-is-not-a-revocation
  =/  policy  policy
  =/  before  policy(trusted (my ~[[~bud ~[%web %skills]]]))
  =/  after  policy(trusted (my ~[[~bud ~[%skills %web %web]]]))
  (expect !>(!(affected:c before after dm)))
++  test-actor-grant-change-retires-its-authorization
  =/  policy  policy
  =/  next  policy(trusted (my ~[[~bud ~[%skills]]]))
  (expect !>((affected:c policy next dm)))
++  test-removal-and-regrant-are-not-the-same-authority
  =/  policy  policy
  =/  revoked  policy(trusted ~)
  (expect !>(&((affected:c policy revoked dm) (affected:c revoked policy dm))))
++  test-owner-handoff-preserves-unrelated-trusted-actor
  =/  policy  policy
  (expect !>(!(affected:c policy policy(owner `~nec) dm)))
++  test-promotion-changes-authority-even-with-same-tools
  =/  policy  policy
  (expect !>((affected:c policy policy(owner `~bud) dm)))
++  test-mentions-change-affects-channels-not-dms
  =/  policy  policy
  =/  dm  dm
  =/  next  policy(response %all)
  =/  channel  dm(to [%channel [%chat ~nec %test] ~])
  (expect !>(&(!(affected:c policy next dm) (affected:c policy next channel))))
++  test-disable-and-enable-fence-all-actors
  =/  policy  policy
  =/  disabled  policy(enabled |)
  (expect !>(&((affected:c policy disabled dm) (affected:c disabled policy dm))))
++  test-binding-generation-is-separate-from-identity
  =/  dm  dm
  =/  sid  (identity:c ~bud to.dm)
  (expect !>(&(!=((binding:c sid 7) (binding:c sid 8)) =(sid (identity:c ~bud to.dm)))))
++  test-unrelated-edit-keeps-existing-admission-cutoff
  =/  policy  policy
  =/  new  policy(trusted (~(put by trusted.policy) ~zod ~[%skills]))
  =/  cuts  (cutoffs:c policy new ~ (my ~[[~bud ~2026.9.5]]) ~2026.9.6)
  (expect !>(&(=(~2026.9.5 (~(got by cuts) ~bud)) =(~2026.9.6 (~(got by cuts) ~zod)))))
++  test-cutoff-tombstones-are-bounded
  =/  cuts  (cutoffs:c policy policy ~ (my ~[[~nec ~2026.9.5]]) ~2026.9.6)
  (expect !>(!(~(has by cuts) ~nec)))
++  test-identities-separate-actors-and-exact-threads
  =/  dm  dm
  =/  sid  (identity:c ~bud to.dm)
  %-  expect
  !>(&(!=(sid (identity:c ~lux to.dm)) !=(sid (identity:c ~bud [%dm ~bud `[~bud ~2026.9.6]]))))
--

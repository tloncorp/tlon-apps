/-  t=harness-tlon, h=harness, cr=harness-cron, hh=harness-hand
/+  *test, c=harness-tlon-continuity
|%
++  test-detached-route-keeps-receipts-and-starts-a-fresh-conversation
  =/  saved=state-4:t  *state-4:t
  =.  saved
    %=  saved  epoch  7  lanes  (my ~[['s' dm] ['other' dm]])  routes
        (my ~[['s' ['binding' %ready]] ['other' ['other-binding' %ready]]])  identities
        (my ~[[[%dm ~bud ~] 's']])  deliveries  (my ~[[0v1 [1 %send %uncertain 'external']]])
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
      (expect !>(!=('s' (~(got by identities.next) [%dm ~bud ~]))))
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
  [[%dm ~bud ~] 7 ~[%web]]
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
::  Only the owner can use %tlon and %code, so adding them for a trusted ship
::  is not a permission change. Removing one is, and so is any other grant.
++  test-adding-tlon-or-code-is-not-a-permission-change
  =/  policy  policy
  =/  next  policy(trusted (my ~[[~bud ~[%web %tlon %code]]]))
  (expect !>(&(!(actor-changed:c policy next ~bud) !(affected:c policy next dm))))
++  test-removing-tlon-or-code-is-a-permission-change
  =/  policy  policy
  =/  tlon  policy(trusted (my ~[[~bud ~[%web %tlon]]]))
  =/  code  policy(trusted (my ~[[~bud ~[%web %code]]]))
  =/  both  policy(trusted (my ~[[~bud ~[%web %tlon %code]]]))
  ;:  weld
      (expect !>((actor-changed:c tlon policy ~bud)))
      (expect !>((actor-changed:c code policy ~bud)))
      (expect !>((affected:c both policy dm)))
  ==
++  test-adding-another-grant-is-still-a-permission-change
  =/  policy  policy
  =/  next  policy(trusted (my ~[[~bud ~[%web %workspace]]]))
  (expect !>(&((actor-changed:c policy next ~bud) (affected:c policy next dm))))
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
  =/  channel  channel
  =/  next  policy(response %all)
  (expect !>(&(!(affected:c policy next dm) (affected:c policy next channel))))
++  channel
  ^-  lane:t
  [[%channel [%chat ~nec %test] ~] 7 ~[%web]]
::  A channel is shared: no one speaker's change resets it, not even the
::  owner's, only its rule or the adapter's enabled switch.
::
++  test-one-speakers-change-never-affects-a-channel
  =/  policy  policy
  =/  channel  channel
  ;:  weld
      (expect !>(!(affected:c policy policy(trusted ~) channel)))
      (expect !>(!(affected:c policy policy(owner `~bud) channel)))
      (expect !>(!(affected:c policy policy(allowed (silt ~[~zod])) channel)))
      (expect !>((affected:c policy policy(enabled |) channel)))
  ==
++  test-disable-and-enable-fence-all-actors
  =/  policy  policy
  =/  disabled  policy(enabled |)
  (expect !>(&((affected:c policy disabled dm) (affected:c disabled policy dm))))
++  test-binding-generation-is-separate-from-identity
  =/  dm  dm
  =/  sid  (identity:c to.dm)
  (expect !>(&(!=((binding:c sid 7) (binding:c sid 8)) =(sid (identity:c to.dm)))))
++  test-unrelated-edit-keeps-existing-admission-cutoff
  =/  policy  policy
  =/  new  policy(trusted (~(put by trusted.policy) ~zod ~[%skills]))
  =/  cuts  (cutoffs:c policy new ~ ~ (my ~[[~bud ~2026.9.5]]) ~2026.9.6)
  (expect !>(&(=(~2026.9.5 (~(got by cuts) ~bud)) =(~2026.9.6 (~(got by cuts) ~zod)))))
++  test-cutoff-tombstones-are-bounded
  =/  cuts  (cutoffs:c policy policy ~ ~ (my ~[[~nec ~2026.9.5]]) ~2026.9.6)
  (expect !>(!(~(has by cuts) ~nec)))
::  A channel identity names no speaker, so a channel speaker's cutoff is
::  kept through its pending input, and a DM partner's through its identity.
::
++  test-cutoffs-keep-dm-partners-and-pending-speakers
  =/  policy  policy
  =.  trusted.policy  (my ~[[~bud ~[%web]] [~nec ~[%web]] [~zod ~[%web]]])
  =/  new  policy(trusted ~)
  =/  known  (my ~[[[%dm ~bud ~] 'dm'] [[%channel [%chat ~nec %test] ~] 'room']])
  =/  prior  (my ~[[~bud ~2026.9.5] [~nec ~2026.9.5]])
  =/  kept  (cutoffs:c policy policy known (silt ~[~nec]) prior ~2026.9.6)
  =/  cut  (cutoffs:c new new known (silt ~[~nec]) prior ~2026.9.6)
  ;:  weld
      (expect-eq !>(prior) !>(kept))
      (expect-eq !>(prior) !>(cut))
      (expect-eq !>(~) !>((cutoffs:c new new ~ ~ prior ~2026.9.6)))
  ==
++  test-a-thread-has-its-own-identity
  =/  dm  dm
  =/  room=$>(%channel destination:t)  [%channel [%chat ~nec %test] ~]
  =/  sid  (identity:c room)
  ;:  weld
      (expect !>(!=(sid (identity:c room(parent `~2026.9.6)))))
      (expect !>(!=(sid (identity:c [%channel [%chat ~nec %other] ~]))))
      (expect !>(!=((identity:c to.dm) (identity:c [%dm ~bud `[~bud ~2026.9.6]]))))
  ==
++  test-dm-identity-is-unchanged
  =/  to=destination:t  [%dm ~bud ~]
  ::  The formula before sessions were keyed by destination, with the partner
  ::  as the actor.
  =/  old
    =/  scope  (scot %uv (end 7^1 (sham [0 ~bud to])))
    (cat 3 (rap 3 (rsh 3^1 (scot %p ~bud)) '-' 'dm' '-' scope ~) '-stable')
  (expect-eq !>(old) !>((identity:c to)))
--

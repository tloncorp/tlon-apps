/-  h=harness, *harness-store
/+  *test, access=harness-peer-access, storage=harness-store
|%
++  test-remote-reports-never-create-incoming-grants
  =/  saved=state-0  *state-0
  =.  remote-access.saved  (remember:access ~ ~nec `[~[%web] ~ 1.000 ~] ~2024.1.1)
  =/  loaded  (load:storage !>(saved))
  ;:  weld
      (expect-eq !>(remote-access.saved) !>(remote-access.loaded))
      (expect-eq !>(loaded) !>((load:storage !>(loaded))))
      (expect-eq !>(~) !>(peers.loaded))
      (expect-eq !>(`[~[%web] ~ 1.000 ~]) !>(grant:(~(got by remote-access.loaded) ~nec)))
  ==
++  test-revocation-replaces-prior-report
  =/  known  (remember:access ~ ~nec `[~ ~ 0 ~] ~2024.1.1)
  =/  next  (remember:access known ~nec ~ ~2024.1.2)
  (expect-eq !>([~ ~2024.1.2]) !>((~(got by next) ~nec)))
++  test-changed-grants-and-revocations-are-announced-once
  =/  old=(map @p peer-grant:h)  (my ~[[~nec [~ ~ 0 ~]] [~bud [~ ~ 0 ~]]])
  =/  new=(map @p peer-grant:h)  (my ~[[~nec [~[%web] ~ 100 ~]] [~zod [~ ~ 0 ~]]])
  =/  out  (malt (changes:access old new))
  ;:  weld
      (expect-eq !>(3) !>(~(wyt by out)))
      (expect-eq !>(~) !>((~(got by out) ~bud)))
      (expect-eq !>(`[~[%web] ~ 100 ~]) !>((~(got by out) ~nec)))
      (expect-eq !>(~) !>((changes:access new new)))
  ==
++  test-unknown-tool-reports-are-ignored
  =/  known  (remember:access ~ ~nec `[~ ~ 0 ~] ~2024.1.1)
  (expect-eq !>(known) !>((remember:access known ~nec `[~[%invented] ~ 0 ~] ~2024.1.2)))
--

/-  h=harness, *harness-store
/+  *test, welcome=harness-onboarding, storage=harness-store, hl=harness, defaults=harness-defaults
|%
++  test-first-open-is-a-normal-assistant-message-without-inference
  =/  saved=state-0  *state-0
  =.  defaults.saved  builtin-config:defaults
  =/  out  (ensure:welcome saved)
  =/  ses  (~(got by sessions.+.out) 'welcome')
  =/  view  (play:hl log.ses)
  ;:  weld
      (expect-eq !>(`'welcome') !>(-.out))
      (expect-eq !>(~[[%assistant message:welcome ~]]) !>(items.view))
      (expect-eq !>(0) !>(next-req.ses))
      (expect-eq !>(~) !>(pending.view))
      (expect-eq !>(~) !>((decide:hl view |=(~ 0))))
  ==
++  test-open-is-idempotent-and-deletion-survives-reload
  =/  out  (ensure:welcome (migrate-memory-prefixes:storage *state-0))
  =/  saved  +.out
  =/  again  (ensure:welcome saved)
  =/  deleted  saved(sessions ~)
  =/  reopened  (ensure:welcome (load:storage !>(deleted)))
  ;:  weld
      (expect-eq !>([~ saved]) !>(again))
      (expect-eq !>([~ deleted]) !>(reopened))
  ==
++  test-existing-users-are-not-interrupted
  =/  saved=state-0  *state-0
  =.  peer-budget-resets.saved  (my ~[[~nec 123]])
  =.  sessions.saved  (my ~[['existing' [~[[%config-replaced builtin-config:defaults]] 0]]])
  =/  out  (ensure:welcome (load:storage !>(saved)))
  ;:  weld
      (expect-eq !>(~) !>(-.out))
      (expect-eq !>(sessions.saved) !>(sessions.+.out))
      (expect-eq !>(peer-budget-resets.saved) !>(peer-budget-resets.+.out))
      (expect-eq !>(1) !>(welcome-seen.+.out))
  ==
--

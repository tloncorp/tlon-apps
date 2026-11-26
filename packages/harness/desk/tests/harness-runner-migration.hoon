/-  *harness-store, r=harness-runner
/+  *test, storage=harness-store
|%
++  test-runner-migration-preserves-every-persisted-field
  =/  old=state-r0  *state-r0
  =.  old
    %=  old  api-key  'retained'  js-timeouts  (my ~[['channel' ~s45]])  provider-keys
        (my ~[['openai' 'retained-key']])
    ==
  ::  The memory index marker is added by the load after the upgrade.
  =/  migrated  (migrate-memory-prefixes:storage (envelope:storage !>(old)))
  ::  The fixture saves no schedule; compare in the frozen schedule type.
  =/  frozen  migrated(schedules *(map @uv schedule-s0))
  ::  Older shapes lack the token-usage ledger; compare without it.
  =/  frozen  [%0 +>.frozen]
  ;:  weld
      (expect-eq !>(+.old) !>(+>+>+.frozen))
      (expect-eq !>(*state:r) !>(runners.migrated))
      (expect-eq !>(migrated) !>((envelope:storage !>(migrated))))
  ==
--

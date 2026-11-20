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
  ;:  weld
      (expect-eq !>(+.old) !>(+.+.+>.migrated))
      (expect-eq !>(*state:r) !>(runners.migrated))
      (expect-eq !>(migrated) !>((envelope:storage !>(migrated))))
  ==
--

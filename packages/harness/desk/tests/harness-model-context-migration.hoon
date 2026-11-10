/-  *harness-store, h=harness
/+  *test, storage=harness-store, policy=harness-defaults
|%
++  test-model-capacity-cache-migration-preserves-all-saved-fields
  =/  old=state-c0  *state-c0
  =/  config  builtin-config:policy
  =.  config  config(max-context 123.456, zdr &, fallbacks ~[['openrouter' 'backup']])
  =.  old
    %=  old
      defaults  config
      sessions  %-  my
                :~  :*  'retained'
                        [~[[%input-admitted [%user 'Keep my work']] [%config-replaced config]] 7]
                    ==
                ==
      provider-keys  (my ~[['openrouter' 'fixture-key']])
      js-timeouts  (my ~[['retained' ~s45]])
    ==
  ::  The memory index marker is added by the load after the upgrade.
  =/  migrated  (migrate-memory-prefixes:storage (envelope:storage !>(old)))
  ;:  weld
      (expect-eq !>(+.old) !>(+.+>.migrated))
      (expect-eq !>(~) !>(model-contexts.migrated))
      (expect-eq !>(migrated) !>((envelope:storage !>(migrated))))
  ==
--

/-  t=harness-tlon
/+  *test, migrate=harness-tlon-migrate
|%
++  test-state-zero-preserves-policy-and-evidence
  =/  old  *state-0:migrate
  =.  old
    %=  old  policy  [& `~nec (my ~[[~bud ~[%web]]]) |]  epoch  17  next-notice  9  identities
        (my ~[[[~bud [%dm ~bud ~]] 'retained']])
    ==
  =/  current  (load:migrate !>(old))
  ;:  weld
      (expect-eq !>(`policy:t`[& `~nec (my ~[[~bud ~[%web]]]) %all ~ ~]) !>(policy.current))
      %+  expect-eq
        !>([epoch.old next-notice.old identities.old])
      !>([epoch.current next-notice.current identities.current])
      (expect-eq !>(current) !>((load:migrate !>((save:migrate current)))))
  ==
::
++  test-browser-handoff-roundtrips-in-the-existing-state-version
  =/  old  *state-2:t
  =.  policy.old  [& `~nec ~ %mentions ~ ~]
  =/  pending=tool-receipt:t
    [['dm' 1 ['call' 'browser_secure_entry' '{}']] %sending '' ~2026.11.1]
  =/  done=tool-receipt:t  pending(stage %done, body 'finished')
  =.  tool-receipts.old  (my ~[[0v1 pending] [0v2 done]])
  =/  live  (load:migrate !>(old))
  =/  form=browser-entry:t
    [~2026.11.2 [%wait [%form 'http://127.0.0.1/credential-result/fixture']]]
  =.  browser-entries.live  (my ~[[0v1 form]])
  =/  saved  (save:migrate live)
  ;:  weld
      (expect-eq !>(old) !>((save:migrate (load:migrate !>(old)))))
      (expect-eq !>(old) !>(saved(tool-receipts tool-receipts.old)))
      (expect-eq !>(live) !>((load:migrate !>(saved))))
  ==
--

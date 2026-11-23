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
      (expect-eq !>(current) !>((load:migrate !>(current))))
  ==
::
++  test-state-two-loads-with-no-pending-browser-handoff
  =/  old  *state-2:migrate
  =.  policy.old  [& `~nec ~ %mentions ~ ~]
  =.  epoch.old  17
  =.  tool-receipts.old
    (my ~[[0v1 `tool-receipt:t`[['dm' 1 ['call' 'tlon_react' '{}']] %sending '' ~2026.11.1]]])
  =/  current  (load:migrate !>(old))
  ;:  weld
      (expect !>(=(%3 -.current)))
      (expect !>(=(~ browser-entries.current)))
      (expect !>(=(+.old +>.current)))
  ==
::
++  test-pending-browser-handoff-loads-unchanged
  =/  current  *state-3:t
  =.  policy.current  [& `~nec ~ %mentions ~ ~]
  =.  tool-receipts.current
    %-  my
    ~[[0v1 `tool-receipt:t`[['dm' 1 ['call' 'browser_secure_entry' '{}']] %sending '' ~2026.11.1]]]
  =.  browser-entries.current
    %-  my
    ~[[0v1 `browser-entry:t`[~2026.11.2 [%wait [%form 'http://127.0.0.1/credential-result/fixture']]]]]
  (expect-eq !>(current) !>((load:migrate !>(current))))
--

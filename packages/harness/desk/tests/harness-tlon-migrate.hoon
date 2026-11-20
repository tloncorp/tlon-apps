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
--

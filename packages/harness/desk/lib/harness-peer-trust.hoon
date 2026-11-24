::  Optional trust-source binding. The peer policy consumes ordinary grants,
::  not Tlon state. Read current trust so removing it leaves no stale grant.
/-  h=harness, t=harness-tlon
/+  p=harness-tlon-policy
|_  =bowl:gall
+$  trust  peer-trust:t
++  snapshot
  ^-  trust
  =/  base  /(scot %p our.bowl)/harness-tlon/(scot %da now.bowl)
  ?.  .^(? %gu (weld base /$))  [[| ~ ~ %mentions ~ ~] |]
  .^(trust %gx (weld base /peer-trust/noun))
++  grants-from
  |=  current=trust
  ^-  (map @p peer-grant:h)
  (peer-grants:p policy.current)
++  grants
  ^-  (map @p peer-grant:h)
  (grants-from snapshot)
++  owner
  ^-  (unit @p)
  =/  current  snapshot
  owner.policy.current
++  siblings
  ^-  ?
  =/  current  snapshot
  siblings.current
--

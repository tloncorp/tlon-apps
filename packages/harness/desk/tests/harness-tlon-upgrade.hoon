::  Every saved Tlon hand value survives each accepted upgrade path, or
::  changes by a named transformation.
/-  t=harness-tlon
/+  *test, migrate=harness-tlon-migrate
/=  up  /tests/harness-upgrade
|%
::  Historical shapes, each a projection of the populated hand state.
::
++  project-2
  ^-  state-2:migrate
  =/  p  populated-3:up
  [%2 +>.p]
++  project-1
  ^-  state-1:migrate
  =/  p  populated-3:up
  [%1 +>+.p]
::  The first shape kept one mention flag in place of a response mode.
++  project-0
  ^-  state-0:migrate
  =/  p  populated-3:up
  :*  %0
      owner-initialized.p  sibling-moon-owners.p  sibling-owner-after.p  activity-through.p
      catching-up.p  identities.p  routes.p  cuts.p  channel-after.p  uploads.p  last-sent.p
      tool-receipts.p  computing.p
      [enabled.policy.p owner.policy.p trusted.policy.p =(%mentions response.policy.p)]
      epoch.p  after.p  lanes.p  jobs.p  deliveries.p  notices.p  next-notice.p
      listeners.p  watching.p  wake.p  error.p
  ==
::  The same shape when the hand answered only mentions.
++  project-0-mentions
  ^-  state-0:migrate
  =/  p  project-0
  p(mentions.policy &)
::
::  Expected values, one per path: the input with the path's transformations.
::
++  expected-3
  ^-  state-3:t
  populated-3:up
::  No browser handoff is pending.
++  expected-2
  ^-  state-3:t
  =/  e  expected-3
  e(browser-entries ~)
::  Lens sync starts unconfigured.
++  expected-1
  ^-  state-3:t
  =/  e  expected-2
  e(lens *lens-sync:t)
::  Channel cuts and the allowed and channel policies start empty. The
::  fixture's %all response survives conversion through mentions=|.
++  expected-0
  ^-  state-3:t
  =/  e  expected-1
  e(channel-cuts ~, allowed.policy ~, channels.policy ~)
++  expected-0-mentions
  ^-  state-3:t
  =/  e  expected-0
  e(response.policy %mentions)
::
++  test-tlon-state-0-upgrade-keeps-every-field
  (expect-reload !>(project-0) expected-0)
++  test-tlon-state-0-mentions-upgrade-keeps-every-field
  (expect-reload !>(project-0-mentions) expected-0-mentions)
++  test-tlon-state-1-upgrade-keeps-every-field
  (expect-reload !>(project-1) expected-1)
++  test-tlon-state-2-upgrade-keeps-every-field
  (expect-reload !>(project-2) expected-2)
++  test-tlon-state-3-reload-keeps-every-field
  (expect-reload !>(populated-3:up) expected-3)
::
++  expect-reload
  |=  [saved=vase expected=state-3:t]
  ^-  tang
  =/  once  (load:migrate saved)
  %+  weld  (expect-same:up !>(expected) !>(once))
  (expect-same:up !>(once) !>((load:migrate !>(once))))
--

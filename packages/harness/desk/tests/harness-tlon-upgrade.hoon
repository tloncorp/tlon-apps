::  Every saved Tlon hand value survives each accepted upgrade path, or
::  changes by a named transformation.
/-  t=harness-tlon
/+  *test, migrate=harness-tlon-migrate
/=  up  /tests/harness-upgrade
|%
::  Historical shapes, each a projection of the populated hand state.
::
++  project-1
  ^-  state-1:migrate
  =/  p  populated-2:up
  [%1 +>.p]
::  The first shape kept one mention flag in place of a response mode.
++  project-0
  ^-  state-0:migrate
  =/  p  populated-2:up
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
++  expected-6
  ^-  state-6:t
  populated-6:up
::  Approval requests start empty.
++  expected-5
  ^-  state-6:t
  =/  e  expected-6
  e(approvals *approvals:t)
::  Per-place grants and their cutoffs start empty; the ship-wide lists and
::  channel rules are kept.
++  expected-4
  ^-  state-6:t
  =/  e  expected-5
  e(place-cuts ~, dm-grants.policy ~, channel-grants.policy ~)
::  No browser handoff is pending.
++  expected-3
  ^-  state-6:t
  =/  e  expected-4
  e(browser-entries ~)
::  The channel's per-speaker conversation is dropped; the DM is kept.
++  expected-2
  ^-  state-6:t
  expected-3
::  Lens sync starts unconfigured.
++  expected-1
  ^-  state-6:t
  =/  e  expected-2
  e(lens *lens-sync:t)
::  Channel cuts and the allowed and channel policies start empty. The
::  fixture's %all response survives conversion through mentions=|.
++  expected-0
  ^-  state-6:t
  =/  e  expected-1
  e(channel-cuts ~, allowed.policy ~, channels.policy ~)
++  expected-0-mentions
  ^-  state-6:t
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
  (expect-reload !>(populated-2:up) expected-2)
++  test-tlon-state-3-upgrade-keeps-every-field
  (expect-reload !>(populated-3:up) expected-3)
++  test-tlon-state-4-upgrade-keeps-every-field
  (expect-reload !>(populated-4:up) expected-4)
++  test-tlon-state-5-upgrade-keeps-every-field-and-opens-no-requests
  (expect-reload !>(populated-5:up) expected-5)
++  test-tlon-state-6-reload-keeps-every-field
  (expect-reload !>(populated-6:up) expected-6)
::
++  expect-reload
  |=  [saved=vase expected=state-6:t]
  ^-  tang
  =/  once  (load:migrate saved)
  %+  weld  (expect-same:up !>(expected) !>(once))
  (expect-same:up !>(once) !>((load:migrate !>(once))))
--

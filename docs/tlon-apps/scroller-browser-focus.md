# Browser focus during scroller tests

Scroller Playwright configs default to headless Chromium. They open no browser
window, including when a failed test starts
a replacement worker. The Send interaction config inherits this default.

Visible Chromium is explicit: use `SCROLLER_HEADED=1` or Playwright's `--headed`
only for a deliberately attended visible run. Playwright's `--debug` or an enabled
`PWDEBUG` also forces a visible browser. Do not enable these overrides automatically
in background test commands. The earlier recordings retain their original
headed mode and evidence; this default does not rewrite their provenance.

Assertions and capture thresholds are unchanged. Existing evidence readers that
require headed acquisition still reject headless evidence as incomplete. Routine
headless results do not qualify those visible-rendering or presented-frame gates.
The earlier headless cadence limitation remains a measured constraint to check,
not a reason to steal focus or widen sampling tolerances.

The normal app flags, local test accounts, selected scenarios, retries and
browser channel are unchanged by this execution preference.

The default was corrected in six configs: input, input-product, keyboard,
reading, reading-product and product. Config-only inspection confirmed default
headless mode, `SCROLLER_HEADED=1` and `--headed` without opening a headed
browser. Actual preparation metadata records the resolved launch mode.

The separate ordinary Send check passed both actual-app cases in 25.924 seconds
with a verified `--headless` launch, clean browser exit and unchanged source.
Evidence: `/private/tmp/scroller-send-headless-r1-20260907`. This is functional
Send/keyboard accessibility evidence, not continuous presentation proof.

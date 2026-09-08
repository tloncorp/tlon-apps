# Component-fixture navigation ownership

Declared before the corrected setup and its controls run, 2026-09-07.

The first refactor native batch positioned history through the diagnostic raw
LegendList handle. That bypassed the production renderer's FOLLOW/READ owner.
Later content changes therefore moved the still-following list to latest, and
the required reading row left the native hierarchy. The acquisition rejection
was correct. Preserve those raw failures/incomplete attempts.

Fixture navigation must use the exact public PostListMethods object exposed to
production callers. The raw LegendList handle is for reading metrics only. No
test-only mode setter or synthetic drag callback may substitute for the public
command. Expose that handle only through the opt-in diagnostics context.

Latest uses scrollToEnd; top uses scrollToStart. Near/history choose the post
whose measured or estimated center is closest to the requested history location,
then use scrollToPost at center. Near requests roughly 220 points above latest;
history requests three list viewports. Actual acquired preconditions decide
whether setup was sufficient. Exact old absolute offsets are not preserved.
Record the chosen post and public-command setup source in the positioned event.

This is controlled imperative component setup, not a real user gesture or real
product send. Keep the existing product-coverage labels and missing-gesture
qualification. The changed setup cannot retroactively qualify the older traces.

Controls require the public handle to receive the selected command, permit
revocation to stop setup across an asynchronous wait, malformed/no candidate
metrics to fail setup, and no mutation through the raw diagnostic handle. The
same production handle is attached to both diagnostics and the imperative ref.

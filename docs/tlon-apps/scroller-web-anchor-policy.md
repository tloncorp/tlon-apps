# Desktop unread landing policy correction

Declared before the controls run. The accepted matrix at docs/tlon-apps/scroller-test-matrix.md:92 explicitly preserves desktop unread and selected centering, while native unread remains top-aligned. The refactor mistakenly changed desktop unread to top and a newly authored controlled-geometry assertion repeated that mistake. No later accepted policy supersedes this difference.

Restore the existing desktop center contract for both initial anchor types. Keep native top alignment, legal range clamping, the 1px tolerance and missing-target behavior unchanged. Verify independently derived center offsets with a viewport border, a tall target, and an ordinary target; missing targets remain null. These are policy/geometry controls, not a real browser unread or durable-read test. The full42 run lacks an initial unread route case and cannot establish that path even if all its assertions pass. Preserve its frozen source and raw results; apply only after it completes.


## Reading-anchor deletion fallback

Declared before the new multi-row controls. The accepted matrix's anchor-removed policy requires the next surviving visible row at its saved position, then the previous surviving visible row, then legal boundary clamping. The nearest text block to the viewport center is useful for initial acquisition; it must not reorder deletion fallbacks across message rows.

Keep all bounded interior candidates for the primary acquired row ahead of that row's saved boundary. If that row disappears, try the originally visible next rows in forward visual order, then originally visible previous rows in reverse visual order. Each candidate retains its old position; do not reacquire a new point after deletion. A row containing media or no text remains an eligible saved fallback. Existing row caps and binary search remain unchanged, so this does not scan an entire long conversation.

Controls use actual multi-row DOM identity/order and declared geometry: the previous row's text is closer to center than the next row's text; remove the primary alone, then primary plus the next row, then all next rows, then every witness. Assert the selected row and unchanged saved point (or minimum legal clamp), not just a plausible final scroll offset. Preserve interior preference while the primary row survives, including a surviving second block and a same-row boundary after its text is removed. These controlled DOM/owner cases do not prove actual renderer cadence or presented frames. The completed full42 run predates this correction and remains immutable.

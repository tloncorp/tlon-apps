# Desktop textarea measurement must preserve occupied layout

Declared before implementation and focused checks. Ordinary typing and
programmatic draft sizing currently set the live textarea height to zero before
reading its natural height. The latest-keyboard recording retains an 11.5 px gap
after the next character even though captured viewport height is unchanged.
A measurement-only shrink and browser range clamp is consistent with that raw
sequence; its intermediate layout was not directly recorded.

Measure within the explicitly owned textarea frame. Reserve that frame's
current used CSS height as its temporary minimum while reading the textarea's
natural height, assign the final input height, then restore the exact prior
frame minimum and priority. Respect content-box/border-box sizing. Restore the
original input height and priority if measurement fails. Only genuine final
growth/shrink should change the sibling conversation's extent.

Both typing and programmatic sizing use this operation. Queued draft sizing must
be cancelled on unmount or input-scope change and reject replaced input/frame
references. It must not change text, focus, selection or scrolling authority.
Existing READ remains READ; unexplained movement cannot regain FOLLOW.

Before implementation, controlled layout models using the real scroll owner
recorded five passes/two failures for the old sequence and seven passes for the
reservation candidate. Preserve these at
`/private/tmp/scroller-web-textarea-measurement-20260907`. They model browser
clamping, not actual presentation. Focused controls additionally cover frame
padding/borders, textarea box sizing, style restoration, failed measurement and
retired RAF callbacks. The unchanged strict keyboard latest/history cases still
require real-app recapture before this is considered a runtime fix.

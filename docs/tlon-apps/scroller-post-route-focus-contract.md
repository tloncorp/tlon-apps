# Retained post route focus: acceptance before controls

Prepared outside the checkout during the native wrapper source freeze; applied
after the completed native journey and final snapshot verification.

The actual Post navigation screen remains mounted beneath sibling MediaViewer,
UserProfile, or a subsequently opened Post route. Carousel focusedPost identifies
a selected child only; native useIsUserActive is always true and does not observe
navigation focus. The view must obtain useIsFocused from its enclosing navigator.
FixtureWrapper already provides a NavigationContainer for the presentational
fixture, so this adds no new optional authority fallback.

Required policy:
- Current-thread permission requires enclosing navigation focus AND carousel
  child focus. Existing channel/parent visit identity remains part of ownership.
- Covering a route retires already captured read and send-follow work permanently.
  A return with identical IDs cannot revive the old completion or queued frame.
- New unread/reply data while covered cannot acknowledge that unread activity.
  Return starts a fresh full 150ms interval for the current latest reply.
- An already dispatched send completes once for its original parent; only its
  late scroll authority is retired. A hidden callback must not start a new send.
- A fresh visible send after return works. Web idle remains read eligibility,
  not send permission, preserving the existing legitimate idle-send control.
- Keep composer and draft owner mounted across cover/return; do not key, clear,
  reset or recreate the draft merely to retire scroll authority.

Bounded implementation: PostScreenView.tsx imports useIsFocused and includes its
result in the existing focused-post predicate, which already owns visit, highlight,
read and send-follow permits. No navigator, renderer, database or transport changes.

Five added integration cases (including two completion orders) exercise the actual
production view callbacks with controlled navigation focus, transport, and list
boundaries: old/new unread while covered; send resolves covered or after return;
forced old dequeued RAF after cover/return; retained stateful composer draft with
old callback rejected and fresh visible send accepted. These are lifecycle and
mounted draft-ownership controls, not native text-entry or painted-frame proof.
All 38 existing PostScreenView assertions are retained unchanged.

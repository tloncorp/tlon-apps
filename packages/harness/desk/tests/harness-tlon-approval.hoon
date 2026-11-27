/-  t=harness-tlon, c=channels
/+  *test, ask=harness-tlon-approval
|%
++  room  `nest:c`[%chat ~lux %test]
++  two
  ^-  approvals:t
  =/  one  (open:ask *approvals:t 'd1234' [~dev ~ ~2026.9.9])
  (open:ask one 'c5678' [~dev `room ~2026.9.9])
::  The ship's DM and one channel are two places, each with one request.
::
++  test-a-request-is-found-by-ship-and-place-and-by-id
  ;:  weld
      (expect-eq !>(`'d1234') !>((find:ask two ~dev ~)))
      (expect-eq !>(`'c5678') !>((find:ask two ~dev `room)))
      (expect-eq !>(~) !>((find:ask two ~bus ~)))
      (expect-eq !>(`[~dev `room ~2026.9.9]) !>((~(get by by-id:two) 'c5678')))
  ==
++  test-closing-a-request-removes-it-by-id-and-by-place
  =/  closed  (close:ask two 'd1234')
  ;:  weld
      (expect-eq !>(~(key by by-id.closed)) !>((silt ~['c5678'])))
      %+  expect-eq
        !>(~(key by by-place.closed))
      !>((silt `(list [@p place:t])`~[[~dev `room]]))
      (expect-eq !>(closed) !>((close:ask closed 'd1234')))
  ==
++  test-keeping-some-requests-drops-the-rest-from-both-indexes
  =/  kept  (keep:ask two |=(=approval:t ?=(~ place.approval)))
  %+  expect-eq
    !>(kept)
  !>(`approvals:t`[(my ~[['d1234' [~dev ~ ~2026.9.9]]]) (my ~[[[~dev ~] 'd1234']])])
::  As OpenClaw's: the place's initial and four hex digits, never an id
::  that is already open.
::
++  test-request-ids-are-short-and-unique-among-open-requests
  =/  first  (fresh-id:ask *approvals:t ~ 0v1)
  =/  taken  (open:ask *approvals:t first [~dev ~ ~2026.9.9])
  =/  second  (fresh-id:ask taken ~ 0v1)
  =/  channel  (fresh-id:ask *approvals:t `room 0v1)
  ;:  weld
      (expect-eq !>(5) !>((met 3 first)))
      (expect-eq !>('d') !>((cut 3 [0 1] first)))
      (expect-eq !>('c') !>((cut 3 [0 1] channel)))
      (expect !>(?=(^ (rush (rsh 3 first) (star hit)))))
      (expect !>(!=(first second)))
      (expect-eq !>(5) !>((met 3 second)))
  ==
::  A hundred characters, not bytes: a multibyte character is never split.
::
++  test-a-preview-keeps-the-first-hundred-characters
  =/  long  (crip (reap 150 'a'))
  =/  wide  (crip (weld (reap 99 'a') "éé"))
  ;:  weld
      (expect-eq !>((crip (reap 100 'a'))) !>((preview:ask long)))
      (expect-eq !>((crip (weld (reap 99 'a') "é"))) !>((preview:ask wide)))
      (expect-eq !>('short') !>((preview:ask 'short')))
  ==
--

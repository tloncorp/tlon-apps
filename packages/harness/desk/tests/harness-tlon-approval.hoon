/-  t=harness-tlon, c=channels
/+  *test, ask=harness-tlon-approval
|%
++  room  `nest:c`[%chat ~lux %test]
++  two
  ^-  approvals:t
  =/  one  (open:ask *approvals:t 'd1234' [~dev [%place ~] ~2026.9.9])
  (open:ask one 'c5678' [~dev [%place `room] ~2026.9.9])
::  The ship's DM and one channel are two places, each with one request.
::
++  test-a-request-is-found-by-ship-and-place-and-by-id
  ;:  weld
      (expect-eq !>(`'d1234') !>((find:ask two ~dev ~)))
      (expect-eq !>(`'c5678') !>((find:ask two ~dev `room)))
      (expect-eq !>(~) !>((find:ask two ~bus ~)))
      (expect-eq !>(`[~dev [%place `room] ~2026.9.9]) !>((~(get by by-id:two) 'c5678')))
  ==
++  test-closing-a-request-removes-it-by-id-and-by-place
  =/  closed  (close:ask two 'd1234')
  ;:  weld
      (expect-eq !>(~(key by by-id.closed)) !>((silt ~['c5678'])))
      %+  expect-eq
        !>(~(key by by-topic.closed))
      !>((silt `(list [@p topic:t])`~[[~dev %place `room]]))
      (expect-eq !>(closed) !>((close:ask closed 'd1234')))
  ==
++  test-keeping-some-requests-drops-the-rest-from-both-indexes
  =/  kept  (keep:ask two |=(=approval:t =([%place ~] topic.approval)))
  %+  expect-eq
    !>(kept)
  !>(`approvals:t`[(my ~[['d1234' [~dev [%place ~] ~2026.9.9]]]) (my ~[[[~dev %place ~] 'd1234']]) ~])
::  ~dev's DM request opened a second before its channel request.
::
++  staggered
  ^-  approvals:t
  =/  one  (open:ask *approvals:t 'd1234' [~dev [%place ~] ~2026.9.9])
  (open:ask one 'c5678' [~dev [%place `room] ~2026.9.9..00.00.01])
++  test-a-request-expires-48-hours-after-it-opened-and-one-a-second-younger-is-kept
  ;:  weld
      %+  expect-eq
        !>(`(list [@t approval:t])`~[['d1234' [~dev [%place ~] ~2026.9.9]]])
      !>((expired:ask staggered ~2026.9.11))
      %+  expect-eq
        !>(`(list [@t approval:t])`~)
      !>((expired:ask staggered ~2026.9.10..23.59.59))
      (expect-eq !>((close:ask staggered 'd1234')) !>((live:ask staggered ~2026.9.11)))
      (expect-eq !>(staggered) !>((live:ask staggered ~2026.9.10..23.59.59)))
  ==
++  test-the-next-expiry-is-the-oldest-requests
  ;:  weld
      (expect-eq !>(`~2026.9.11) !>((next-expiry:ask staggered)))
      %+  expect-eq
        !>(`~2026.9.11..00.00.01)
      !>((next-expiry:ask (close:ask staggered 'd1234')))
      (expect-eq !>(~) !>((next-expiry:ask *approvals:t)))
  ==
++  test-a-ships-requests-are-counted-across-its-places
  =/  more  (open:ask staggered 'd9999' [~bus [%place ~] ~2026.9.9])
  ;:  weld
      (expect-eq !>(2) !>((held:ask more ~dev)))
      (expect-eq !>(1) !>((held:ask more ~bus)))
      (expect-eq !>(0) !>((held:ask more ~bel)))
  ==
::  As OpenClaw's: one notice per ten minutes.
::
++  test-the-full-queue-notice-is-sent-at-most-once-per-ten-minutes
  =/  told=(list notice:t)  ~[[0 ~2026.9.9 'approval-cap' ~dev '~dev' '100']]
  =/  other=(list notice:t)  ~[[0 ~2026.9.9 'permission-denied' ~dev '~dev' 'x']]
  ;:  weld
      (expect-eq !>(&) !>((full-allowed:ask ~2026.9.9 ~)))
      (expect-eq !>(&) !>((full-allowed:ask ~2026.9.9 other)))
      (expect-eq !>(|) !>((full-allowed:ask ~2026.9.9..00.09.59 told)))
      (expect-eq !>(&) !>((full-allowed:ask ~2026.9.9..00.10.00 told)))
      %+  expect-eq
        !>('Pending approval queue is full (100). New requests are dropped until existing ones are approved, denied, or blocked.')
      !>((full-text:ask 100))
  ==
::  As OpenClaw's: the initial of a DM, a channel or a group and four hex
::  digits, never an id that is already open.
::
++  test-request-ids-are-short-and-unique-among-open-requests
  =/  first  (fresh-id:ask *approvals:t [%place ~] 0v1)
  =/  taken  (open:ask *approvals:t first [~dev [%place ~] ~2026.9.9])
  =/  second  (fresh-id:ask taken [%place ~] 0v1)
  =/  channel  (fresh-id:ask *approvals:t [%place `room] 0v1)
  =/  group  (fresh-id:ask *approvals:t [%group ~lux %club] 0v1)
  ;:  weld
      (expect-eq !>(5) !>((met 3 first)))
      (expect-eq !>('d') !>((cut 3 [0 1] first)))
      (expect-eq !>('c') !>((cut 3 [0 1] channel)))
      (expect-eq !>('g') !>((cut 3 [0 1] group)))
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
::  As OpenClaw reads them: the argument trimmed, as typed, and none when
::  absent; a token after one space, as a button sends, is the request's.
::  Other commands and ordinary text are not orders.
::
++  test-the-approval-commands-are-read-with-their-trimmed-id
  ;:  weld
      (expect-eq !>(`[%allow `'d1234' ~]) !>((read-order:ask '/allow d1234')))
      (expect-eq !>(`[%reject `'c5678' ~]) !>((read-order:ask '  /reject   c5678 ')))
      (expect-eq !>(`[%ban `'D1234' ~]) !>((read-order:ask '/ban D1234')))
      (expect-eq !>(`[%allow ~ ~]) !>((read-order:ask '/allow')))
      (expect-eq !>(`[%ban `'d1 d2' ~]) !>((read-order:ask '/ban d1 d2')))
      (expect-eq !>(`[%allow `'d1234' `0v1.2abcd]) !>((read-order:ask '/allow d1234 0v1.2abcd')))
      (expect-eq !>(`[%allow `'d1234 ~dev' ~]) !>((read-order:ask '/allow d1234 ~dev')))
      (expect-eq !>(`[%ban `'d1234 dev' ~]) !>((read-order:ask '/ban d1234 dev')))
      (expect-eq !>(~) !>((read-order:ask '/allowed d1234')))
      (expect-eq !>(~) !>((read-order:ask '/help')))
      (expect-eq !>(~) !>((read-order:ask 'allow d1234')))
      (expect-eq !>(~) !>((read-order:ask '/Allow d1234')))
  ==
::  The listings take nothing after them; an unban's ship is read with or
::  without its sig, in any case, and ~ when the text is no ship.
::
++  test-the-listings-and-unban-are-read-with-their-ship
  ;:  weld
      (expect-eq !>(`[%pending ~]) !>((read-order:ask ' /pending ')))
      (expect-eq !>(`[%banned ~]) !>((read-order:ask '/banned')))
      (expect-eq !>(~) !>((read-order:ask '/pending d1234')))
      (expect-eq !>(~) !>((read-order:ask '/banned ~dev')))
      (expect-eq !>(`[%unban `~sampel-palnet]) !>((read-order:ask '/unban ~sampel-palnet')))
      (expect-eq !>(`[%unban `~dev]) !>((read-order:ask '/unban  Dev ')))
      (expect-eq !>(`[%unban ~]) !>((read-order:ask '/unban')))
      (expect-eq !>(`[%unban ~]) !>((read-order:ask '/unban ~dev ~bus')))
      (expect-eq !>(`[%unban ~]) !>((read-order:ask '/unban d1234')))
  ==
::  Exact first, then the one id the text begins, case as typed; no id is
::  the only open request, and none of several. With a token, the exact id
::  of the request that token was made for only.
::
++  test-an-order-finds-its-request-as-openclaw-does
  =/  three  (open:ask staggered 'c5699' [~bus [%place `room] ~2026.9.9..00.00.02])
  =/  one  (open:ask *approvals:t 'c5699' [~bus [%place `room] ~2026.9.9..00.00.02])
  =/  dm  (button-token:ask 'd1234' [~dev [%place ~] ~2026.9.9])
  =/  older  (button-token:ask 'd1234' [~dev [%place ~] ~2026.9.8])
  ;:  weld
      (expect-eq !>(`['d1234' [~dev [%place ~] ~2026.9.9]]) !>((pick:ask three `'d1234' ~)))
      (expect-eq !>(`['d1234' [~dev [%place ~] ~2026.9.9]]) !>((pick:ask three `'d1' ~)))
      (expect-eq !>(~) !>((pick:ask three `'c56' ~)))
      (expect-eq !>(~) !>((pick:ask three `'D1234' ~)))
      (expect-eq !>(~) !>((pick:ask three `'d9999' ~)))
      (expect-eq !>(~) !>((pick:ask three ~ ~)))
      (expect-eq !>(`['c5699' [~bus [%place `room] ~2026.9.9..00.00.02]]) !>((pick:ask one ~ ~)))
      (expect-eq !>(~) !>((pick:ask *approvals:t ~ ~)))
      (expect-eq !>(`['d1234' [~dev [%place ~] ~2026.9.9]]) !>((pick:ask three `'d1234' `dm)))
      (expect-eq !>(~) !>((pick:ask three `'d1234' `older)))
      (expect-eq !>(~) !>((pick:ask three `'d1' `dm)))
  ==
++  test-several-open-requests-are-listed-oldest-first
  %+  expect-eq
    !>  %+  rap  3
        :~  'More than one approval is pending. Send the command again with an ID:'
            '\0ad1234 ~dev dm/~dev'
            '\0ac5678 ~dev chat/~lux/test'
        ==
  !>((choices:ask staggered))
++  test-the-replies-to-the-owner-are-openclaws
  ;:  weld
      %+  expect-eq
        !>('Approved DM access for ~dev. They will be able to message the bot.')
      !>((confirmation:ask %allow ~dev ~))
      %+  expect-eq
        !>('Approved ~dev for Room (chat/~lux/test). They will be able to interact in this channel.')
      !>((confirmation:ask %allow ~dev `'Room (chat/~lux/test)'))
      (expect-eq !>('Denied DM request from ~dev.') !>((confirmation:ask %reject ~dev ~)))
      %+  expect-eq
        !>('Denied ~dev for chat/~lux/test.')
      !>((confirmation:ask %reject ~dev `'chat/~lux/test'))
      %+  expect-eq
        !>('Blocked ~dev. They will no longer be able to contact the bot.')
      !>((confirmation:ask %ban ~dev `'chat/~lux/test'))
      (expect-eq !>('No pending approval found for ID: #d1234') !>((unknown:ask `'d1234')))
      (expect-eq !>('No pending approval found.') !>((unknown:ask ~)))
      %+  expect-eq
        !>('Could not block ~dev: block failed. Request stays pending, try again.')
      !>((block-failed:ask ~dev))
  ==
++  test-a-channel-is-named-by-its-titles-and-nest-as-openclaw-names-it
  =/  nest  'chat/~lux/test'
  ;:  weld
      (expect-eq !>(nest) !>((channel-label:ask nest 'test' ~)))
      (expect-eq !>(nest) !>((channel-label:ask nest 'test' `['test' ~])))
      (expect-eq !>('Room (chat/~lux/test)') !>((channel-label:ask nest 'test' `['Room' ~])))
      %+  expect-eq
        !>('Lux (chat/~lux/test)')
      !>((channel-label:ask nest 'test' `['test' `'Lux']))
      %+  expect-eq
        !>('Room in Lux (chat/~lux/test)')
      !>((channel-label:ask nest 'test' `['Room' `'Lux']))
  ==
++  test-a-group-is-named-by-its-title-and-flag-as-openclaw-names-it
  ;:  weld
      (expect-eq !>('~lux/club') !>((group-label:ask [~lux %club] ~)))
      (expect-eq !>('~lux/club') !>((group-label:ask [~lux %club] `'~lux/club')))
      (expect-eq !>('Club (~lux/club)') !>((group-label:ask [~lux %club] `'Club')))
  ==
++  test-the-replies-to-a-group-request-are-openclaws
  ;:  weld
      %+  expect-eq
        !>('Approved group invite from ~dev to Club (~lux/club). Joining group...')
      !>((group-confirmation:ask %allow ~dev 'Club (~lux/club)'))
      %+  expect-eq
        !>('Denied group invite from ~dev to ~lux/club.')
      !>((group-confirmation:ask %reject ~dev '~lux/club'))
      %+  expect-eq
        !>('Could not decline ~lux/club: invite decline failed. Request stays pending, try again.')
      !>((decline-failed:ask [~lux %club]))
      %+  expect-eq
        !>('Pending requests (1):\0a\0a  #g1234 - Group invite from ~dev to Club (~lux/club)\0a\0aUse /allow, /reject, or /ban with the ID.')
      !>((pending-text:ask ~[['g1234' [~dev [%group ~lux %club] ~2026.9.9] `'Club (~lux/club)']] 1))
  ==
::  Characters, not bytes, are counted.
::
++  test-a-title-over-eighty-characters-is-cut-to-seventy-seven-and-an-ellipsis
  =/  eighty  (crip (reap 80 'a'))
  =/  e  (snag 0 (tuba "é"))
  ;:  weld
      (expect-eq !>(eighty) !>((bounded:ask eighty)))
      %+  expect-eq
        !>((cat 3 (crip (reap 77 'a')) '...'))
      !>((bounded:ask (cat 3 eighty 'b')))
      %+  expect-eq
        !>((cat 3 (crip (tufa (reap 77 e))) '...'))
      !>((bounded:ask (crip (tufa (reap 81 e)))))
  ==
--

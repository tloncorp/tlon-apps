/+  *test, onboarding=harness-tlon-onboarding
|%
++  test-mobile-introduction-carries-bounded-context
  =/  request
    '[{"type":"tlon-agent-intro-request","version":1,"groupId":"~nec/tlon","isFirstGroup":true,"clientTimezone":"America/Chicago","clientLocale":"en-US"}]'
  =/  result  (request:onboarding ~nec `request)
  (expect !>(?=(^ result)))
++  test-no-request-is-not-an-introduction
  ;:  weld
      (expect-eq !>(`(unit @t)`~) !>((request:onboarding ~nec ~)))
      (expect-eq !>(`(unit @t)`~) !>((request:onboarding ~nec `'[]')))
      (expect-eq !>(`(unit @t)`~) !>((request:onboarding ~nec `'not json')))
  ==
++  test-other-owners-groups-and-versions-are-not-setup
  ;:  weld
      %+  expect-eq
        !>(`(unit @t)`~)
      !>  %+  request:onboarding
            ~bud
          `'[{"type":"tlon-agent-intro-request","version":1,"groupId":"~nec/tlon"}]'
      %+  expect-eq
        !>(`(unit @t)`~)
      !>  %+  request:onboarding
            ~nec
          `'[{"type":"tlon-agent-intro-request","version":2,"groupId":"~nec/tlon"}]'
      %+  expect-eq
        !>(`(unit @t)`~)
      !>  %+  request:onboarding
            ~nec
          `'[{"type":"tlon-agent-intro-request","version":1,"groupId":"~nec/tlon/extra"}]'
  ==
++  test-duplicate-requests-and-provisioning-are-not-introductions
  =/  item  '{"type":"tlon-agent-intro-request","version":1,"groupId":"~nec/tlon"}'
  ;:  weld
      (expect-eq !>(`(unit @t)`~) !>((request:onboarding ~nec `(rap 3 '[' item ',' item ']' ~))))
      %+  expect-eq
        !>(`(unit @t)`~)
      !>  %+  request:onboarding
            ~nec
          `'[{"type":"tlon-agent-provision-request","version":1,"groupId":"~nec/tlon"}]'
  ==
--

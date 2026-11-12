/-  c=harness-cron
/+  *test, cron=harness-cron
|%
++  test-every-minute-is-strictly-after-now
  (expect-eq !>(`~2026.9.5..12.01.00) !>((next:cron (parse:cron '* * * * *') ~2026.9.5..12.00.00)))
++  test-partial-minute-rounds-forward
  (expect-eq !>(`~2026.9.5..12.01.00) !>((next:cron (parse:cron '* * * * *') ~2026.9.5..12.00.30)))
++  test-daily-crosses-month
  %+  expect-eq
    !>(`~2026.10.1..09.00.00)
  !>((next:cron (parse:cron '0 9 * * *') ~2026.9.30..10.00.00))
++  test-leap-day-and-impossible-date-are-bounded
  (expect-eq !>(`~2028.2.29) !>((next:cron (parse:cron '0 0 29 2 *') ~2026.9.5)))
++  test-impossible-date-has-no-next-time
  (expect-eq !>(`(unit @da)`~) !>((next:cron (parse:cron '0 0 31 2 *') ~2026.9.5)))
++  test-restricted-weekday-and-monthday-use-cron-or-semantics
  (expect-eq !>(`~2026.9.7..09.00.00) !>((next:cron (parse:cron '0 9 1 * 1') ~2026.9.5)))
++  test-ranges-steps-and-lists
  %+  expect-eq
    !>(`~2026.9.5..12.20.00)
  !>((next:cron (parse:cron '10-30/10,50 12 * * *') ~2026.9.5..12.11.00))
++  test-invalid-expressions-never-become-wildcards
  =/  invalid=(list @t)
    :~  '*/0 * * * *'  'wat * * * *'  '60 * * * *'  '0 24 * * *'  '0 0 0 * *'  '0 0 * 13 *'
        '0 0 * * 7'  '1,,2 * * * *'  '1-0 * * * *'  '* * * *'  '* * * * * *'  '*/x * * * *'
    ==
  =/  rejected
    %+  levy  invalid
    |=  expr=@t
    =/  result  (mule |.((parse:cron expr)))
    ?=(%| -.result)
  (expect !>(rejected))
++  test-repeated-fire-identity-is-stable
  %-  expect
  !>  ?&  =((event:cron 0v1 ~2026.9.5) (event:cron 0v1 ~2026.9.5))
          !=((event:cron 0v1 ~2026.9.5) (event:cron 0v1 ~2026.9.6))
      ==
--

/-  c=harness-cron
/+  *test, tz=harness-timezone, cron=harness-cron
|%
++  test-valid-accepts-iana-names-and-rejects-abbreviations-and-offsets
  =/  accepted=(list @t)
    :~  'UTC'  'Etc/UTC'  'America/Los_Angeles'  'America/New_York'
        'Europe/London'  'Europe/Dublin'  'Asia/Tokyo'  'Asia/Kolkata'
        'Asia/Calcutta'  'Australia/Sydney'  'Australia/Lord_Howe'
        'Pacific/Chatham'  'US/Pacific'  'America/Argentina/Buenos_Aires'
    ==
  =/  rejected=(list @t)
    :~  ''  'PST'  'EST'  'GMT'  'Z'  'utc'  '+09:00'  '-08:00'
        'UTC-08:00'  'America/Not_A_City'  ' America/Los_Angeles'
    ==
  ;:  weld
      (expect !>((levy accepted valid:tz)))
      (expect !>((levy rejected |=(z=@t !(valid:tz z)))))
  ==
++  test-los-angeles-dst-transitions-spring-forward-and-fall-back
  =/  rule  (need (lookup:tz 'America/Los_Angeles'))
  ;:  weld
      ::  2026-03-08 02:00 PST -> 03:00 PDT at 10:00:00Z
      (expect-eq !>(-480) !>((offset-at:tz rule ~2026.3.8..09.59.59)))
      (expect-eq !>(-420) !>((offset-at:tz rule ~2026.3.8..10.00.00)))
      ::  2026-11-01 02:00 PDT -> 01:00 PST at 09:00:00Z
      (expect-eq !>(-420) !>((offset-at:tz rule ~2026.11.1..08.59.59)))
      (expect-eq !>(-480) !>((offset-at:tz rule ~2026.11.1..09.00.00)))
  ==
++  test-southern-hemisphere-negative-dst-and-unusual-offsets
  =/  sydney  (need (lookup:tz 'Australia/Sydney'))
  =/  dublin  (need (lookup:tz 'Europe/Dublin'))
  =/  lord-howe  (need (lookup:tz 'Australia/Lord_Howe'))
  =/  chatham  (need (lookup:tz 'Pacific/Chatham'))
  =/  kolkata  (need (lookup:tz 'Asia/Kolkata'))
  =/  jerusalem  (need (lookup:tz 'Asia/Jerusalem'))
  =/  nuuk  (need (lookup:tz 'America/Nuuk'))
  ;:  weld
      ::  Sydney: +11 in Jan (summer), +10 in Jul (winter)
      (expect-eq !>(--660) !>((offset-at:tz sydney ~2026.1.15..12.00.00)))
      (expect-eq !>(--600) !>((offset-at:tz sydney ~2026.7.15..12.00.00)))
      ::  Dublin: negative DST (IST +1 in summer, GMT 0 in winter)
      (expect-eq !>(--0) !>((offset-at:tz dublin ~2026.1.15..12.00.00)))
      (expect-eq !>(--60) !>((offset-at:tz dublin ~2026.7.15..12.00.00)))
      ::  Lord Howe: 30-minute DST (+10:30 winter, +11:00 summer)
      (expect-eq !>(--660) !>((offset-at:tz lord-howe ~2026.1.15..12.00.00)))
      (expect-eq !>(--630) !>((offset-at:tz lord-howe ~2026.7.15..12.00.00)))
      ::  Chatham: +13:45 summer, +12:45 winter
      (expect-eq !>(--825) !>((offset-at:tz chatham ~2026.1.15..12.00.00)))
      (expect-eq !>(--765) !>((offset-at:tz chatham ~2026.7.15..12.00.00)))
      ::  Kolkata: fixed +05:30
      (expect-eq !>(--330) !>((offset-at:tz kolkata ~2026.7.15..12.00.00)))
      ::  Jerusalem: 26:00 Thursday -> Friday 00:00Z transition (2026-03-27)
      (expect-eq !>(--120) !>((offset-at:tz jerusalem ~2026.3.26..23.59.59)))
      (expect-eq !>(--180) !>((offset-at:tz jerusalem ~2026.3.27..00.00.00)))
      ::  Nuuk: -01:00 Sunday transition -> 01:00Z (2026-03-29)
      (expect-eq !>(-120) !>((offset-at:tz nuuk ~2026.3.29..00.59.59)))
      (expect-eq !>(-60) !>((offset-at:tz nuuk ~2026.3.29..01.00.00)))
  ==
++  test-local-clock-crosses-utc-midnight-accurately
  ::  2026-09-06T02:30:09Z (Sunday UTC) is 2026-09-05T19:30:09-07:00 (Saturday) in LA
  =/  la  (need (clock:tz 'America/Los_Angeles' ~2026.9.6..02.30.09))
  ::  2026-09-05T20:00:00Z (Saturday UTC) is 2026-09-06T05:00:00+09:00 (Sunday) in Tokyo
  =/  tokyo  (need (clock:tz 'Asia/Tokyo' ~2026.9.5..20.00.00))
  ;:  weld
      (expect-eq !>('2026-09-05T19:30:09-07:00') !>(local.la))
      (expect-eq !>('2026-09-05') !>(date.la))
      (expect-eq !>('19:30:09') !>(time.la))
      (expect-eq !>('-07:00') !>(offset.la))
      (expect-eq !>('Saturday') !>(weekday.la))
      (expect-eq !>('2026-09-06T05:00:00+09:00') !>(local.tokyo))
      (expect-eq !>('Sunday') !>(weekday.tokyo))
  ==
++  test-weekly-schedule-keeps-local-wall-time-across-dst
  =/  rule  (need (lookup:tz 'America/Los_Angeles'))
  =/  pattern  (parse:cron '0 9 * * 1')
  ::  Monday 2026-03-02 09:00 PST = 17:00Z
  =/  before-spring  (need (next-in-zone:tz pattern rule ~2026.3.1))
  ::  Monday 2026-03-09 09:00 PDT = 16:00Z (DST began 2026-03-08)
  =/  after-spring  (need (next-in-zone:tz pattern rule before-spring))
  ::  Monday 2026-10-26 09:00 PDT = 16:00Z
  =/  before-fall  (need (next-in-zone:tz pattern rule ~2026.10.25))
  ::  Monday 2026-11-02 09:00 PST = 17:00Z (DST ended 2026-11-01)
  =/  after-fall  (need (next-in-zone:tz pattern rule before-fall))
  ;:  weld
      (expect-eq !>(~2026.3.2..17.00.00) !>(before-spring))
      (expect-eq !>(~2026.3.9..16.00.00) !>(after-spring))
      (expect-eq !>(~2026.10.26..16.00.00) !>(before-fall))
      (expect-eq !>(~2026.11.2..17.00.00) !>(after-fall))
  ==
++  test-dst-gap-fires-at-transition-and-overlap-fires-once
  =/  rule  (need (lookup:tz 'America/Los_Angeles'))
  ::  Spring forward: 02:30 on 2026-03-08 does not exist; fires at 10:00Z (03:00 PDT),
  ::  then advances to Monday 02:30 PDT (09:30Z).
  =/  gap-pat  (parse:cron '30 2 * * *')
  =/  gap-first  (need (next-in-zone:tz gap-pat rule ~2026.3.8..09.00.00))
  =/  gap-next  (need (next-in-zone:tz gap-pat rule gap-first))
  ::  Fall back: 01:30 on 2026-11-01 occurs twice; fires once at 08:30Z (01:30 PDT),
  ::  skips the repeated 09:30Z (01:30 PST), and advances to Monday 01:30 PST (09:30Z).
  =/  dup-pat  (parse:cron '30 1 * * *')
  =/  dup-first  (need (next-in-zone:tz dup-pat rule ~2026.11.1..08.00.00))
  =/  dup-next  (need (next-in-zone:tz dup-pat rule dup-first))
  ;:  weld
      (expect-eq !>(~2026.3.8..10.00.00) !>(gap-first))
      (expect-eq !>(~2026.3.9..09.30.00) !>(gap-next))
      (expect-eq !>(~2026.11.1..08.30.00) !>(dup-first))
      (expect-eq !>(~2026.11.2..09.30.00) !>(dup-next))
  ==
++  test-tzdata-release-is-recorded
  (expect-eq !>('2026e') !>(tzdata-release:tz))
--

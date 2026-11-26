/+  *test, zones=harness-zones, reminder=harness-reminder
|%
::  Zones without daylight saving keep these offsets whenever the table is
::  regenerated. Etc/GMT+5 is five hours west: POSIX inverts the sign.
::
++  test-zone-names-map-to-their-fixed-offsets
  ;:  weld
      (expect-eq !>(`'+05:30') !>((offset:zones 'Asia/Kolkata')))
      (expect-eq !>(`'+05:30') !>((offset:zones 'Asia/Calcutta')))
      (expect-eq !>(`'+05:45') !>((offset:zones 'Asia/Kathmandu')))
      (expect-eq !>(`'-07:00') !>((offset:zones 'America/Phoenix')))
      (expect-eq !>(`'+14:00') !>((offset:zones 'Pacific/Kiritimati')))
      (expect-eq !>(`'-05:00') !>((offset:zones 'Etc/GMT+5')))
      (expect-eq !>(`'+00:00') !>((offset:zones 'Etc/UTC')))
      (expect-eq !>(`(unit @t)`~) !>((offset:zones 'Mars/Olympus_Mons')))
  ==
::  The scheduler stores whatever the table names, so a value its offset
::  parser refuses would fail every create in that zone.
::
++  test-every-zone-offset-parses-as-a-scheduler-offset
  =/  refused
    %+  skip  zones:zones
    |=  [name=@t offset=@t]
    =/  parsed  (mule |.((offset:reminder offset)))
    ?=(%& -.parsed)
  (expect-eq !>(`(list [@t @t])`~) !>(refused))
--

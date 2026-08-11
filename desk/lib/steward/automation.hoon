::  Time conversions for the %steward automation protocol.
::
::  OpenClaw represents absolute dates and durations as integer milliseconds.
::  These wrappers use the standard conversions supplied by zuse.
::
=*  z  ..zuse
|%
::  Convert integer milliseconds to an Urbit duration.
::
++  milliseconds-to-duration
  |=  milliseconds=@ud
  ^-  @dr
  `@dr`(div (mul milliseconds ~s1) 1.000)
::  Convert an Urbit duration to integer milliseconds.
::
++  duration-to-milliseconds
  |=  duration=@dr
  ^-  @ud
  (msec:milly:z duration)
::  Convert Unix epoch milliseconds to an Urbit date.
::
++  unix-milliseconds-to-date
  |=  milliseconds=@ud
  ^-  @da
  (from-unix-ms:chrono:userlib:z milliseconds)
::  Convert an Urbit date to Unix epoch milliseconds.
::
++  date-to-unix-milliseconds
  |=  date=@da
  ^-  @ud
  (unm:chrono:userlib:z date)
--

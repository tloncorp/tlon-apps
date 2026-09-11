::  time conversions for the steward automation protocol
::
::  task definitions from OpenClaw represent absolute dates and durations as
::  integer milliseconds. these wrappers use the standard conversions supplied
::  by zuse.
::
|%
::  +milliseconds-to-duration: convert integer milliseconds to an Urbit duration
::
++  milliseconds-to-duration
  |=  milliseconds=@ud
  ^-  @dr
  `@dr`(div (mul milliseconds ~s1) 1.000)
::  +duration-to-milliseconds: convert an Urbit duration to integer milliseconds
::
++  duration-to-milliseconds
  |=  duration=@dr
  ^-  @ud
  (msec:milly duration)
::  +unix-milliseconds-to-date: convert Unix epoch milliseconds to an Urbit date
::
++  unix-milliseconds-to-date
  |=  milliseconds=@ud
  ^-  @da
  (from-unix-ms:chrono:userlib milliseconds)
::  +date-to-unix-milliseconds: convert an Urbit date to Unix epoch milliseconds
::
++  date-to-unix-milliseconds
  |=  date=@da
  ^-  @ud
  (unm:chrono:userlib date)
--

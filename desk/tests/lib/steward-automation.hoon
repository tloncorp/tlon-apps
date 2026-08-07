::  steward automation time conversion tests
::
/+  *test, au=steward-automation
|%
++  test-unix-epoch-to-date
  %+  expect-eq
    !>(~1970.1.1)
  !>((unix-milliseconds-to-date:au 0))
::
++  test-date-to-unix-epoch
  %+  expect-eq
    !>(`@ud`0)
  !>((date-to-unix-milliseconds:au ~1970.1.1))
::
++  test-known-unix-date
  ;:  weld
    %+  expect-eq
      !>(~2024.1.1)
    !>((unix-milliseconds-to-date:au 1.704.067.200.000))
  ::
    %+  expect-eq
      !>(`@ud`1.704.067.200.000)
    !>((date-to-unix-milliseconds:au ~2024.1.1))
  ==
::
++  test-milliseconds-to-duration
  ;:  weld
    %+  expect-eq
      !>(`@dr`~s1)
    !>((milliseconds-to-duration:au 1.000))
  ::
    %+  expect-eq
      !>(`@ud`1.000)
    !>((duration-to-milliseconds:au ~s1))
  ==
::
++  test-millisecond-duration-roundtrip
  %+  expect-eq
    !>(`@ud`1)
  !>  (duration-to-milliseconds:au (milliseconds-to-duration:au 1))
--

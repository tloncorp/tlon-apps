::  Steward automation time conversion tests.
::
/+  *test, au=steward-automation
|%
++  test-duration-boundaries-and-roundtrips
  ;:  weld
    %+  expect-eq
      !>(`@dr`~s0)
    !>((milliseconds-to-duration:au 0))
  ::
    %+  expect-eq
      !>(`@ud`0)
    !>((duration-to-milliseconds:au (milliseconds-to-duration:au 0)))
  ::
    %+  expect-eq
      !>(`@ud`1)
    !>((duration-to-milliseconds:au (milliseconds-to-duration:au 1)))
  ::
    %+  expect-eq
      !>(`@dr`~s1)
    !>((milliseconds-to-duration:au 1.000))
  ::
    %+  expect-eq
      !>(`@ud`5.000)
    !>((duration-to-milliseconds:au (milliseconds-to-duration:au 5.000)))
  ::
    %+  expect-eq
      !>(`@ud`1.234)
    !>((duration-to-milliseconds:au (milliseconds-to-duration:au 1.234)))
  ==
::
++  test-unix-date-boundaries-and-roundtrips
  ;:  weld
    %+  expect-eq
      !>(~1970.1.1)
    !>((unix-milliseconds-to-date:au 0))
  ::
    %+  expect-eq
      !>(`@ud`0)
    !>((date-to-unix-milliseconds:au ~1970.1.1))
  ::
    %+  expect-eq
      !>(`@ud`1)
    !>  (date-to-unix-milliseconds:au (unix-milliseconds-to-date:au 1))
  ::
    %+  expect-eq
      !>(~2024.1.1)
    !>((unix-milliseconds-to-date:au 1.704.067.200.000))
  ::
    %+  expect-eq
      !>(`@ud`1.704.067.200.000)
    !>  (date-to-unix-milliseconds:au (unix-milliseconds-to-date:au 1.704.067.200.000))
  ==
--

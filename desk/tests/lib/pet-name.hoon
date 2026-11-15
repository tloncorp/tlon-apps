/+  pet-name, *test
|%
++  test-name-galaxy
  %+  expect-eq  !>("@aurora")  !>((name:pet-name ~zod))
::
++  test-name-star
  %+  expect-eq  !>("@bright.otter")  !>((name:pet-name ~marzod))
::
++  test-name-planet
  %+  expect-eq
    !>("@brightly.tireless.butter.dhole")
  !>((name:pet-name ~sampel-palnet))
::
++  test-name-moon
  %+  expect-eq
    !>("@brave.badger \c2\b7 brightly.tireless.butter.dhole")
  !>((name:pet-name ~doznec-sampel-palnet))
::
++  test-name-comet
  %+  expect-eq
    !>("@?yoyo.bonnet.bookend.charm")
  !>((name:pet-name ~lodlec-larrep-walnyt-dibsyl--soghec-torder-pansym-ronter))
--

::  unicode unit tests
::
/+  *test, unicode
|%
++  test-confusables
  ;:  weld
    %+  expect-eq
      !>('~zod')
      !>((norm-p:confusable:unicode '～ᴢ𝗈𝘥'))
  ::
    %+  expect-eq
      !>('~zod')
      !>((norm-p:confusable:unicode '∼ᴢ𝗈𝘥'))
  ::
  %+  expect-eq
    !>('~zod')
    !>((norm-p:confusable:unicode '～zｏd'))
  ::
    %+  expect-eq
      !>('~fed')
      !>((norm-p:confusable:unicode '~fℯԁ'))
  ::
    %+  expect-eq
      !>('~sampel-palnet')
      !>((norm-p:confusable:unicode '~ｓaｍρｅl-pаｌｎeｔ'))
  ==
--

/+  kol, *test
::
=*  ol  (kol gte)
|%
++  test-put
  =|  l=(list [key=@ux val=@ud])
  =.  l  (~(put ol l) 0xa 3)  ::  base list
  =.  l  (~(put ol l) 0xb 6)  ::  insert head
  =.  l  (~(put ol l) 0xc 1)  ::  insert tail
  =.  l  (~(put ol l) 0xd 2)  ::  insert center
  =.  l  (~(put ol l) 0xa 1)  ::  update towards tail
  =.  l  (~(put ol l) 0xa 5)  ::  update towards head
  %+  expect-eq
    !>  ^-  (list [key=@ux val=@ud])
    ~[0xb^6 0xa^5 0xd^2 0xc^1]
  !>(l)
::
++  test-del
  =/  l=(list [key=@ux val=@ud])
    ~[0xb^6 0xa^5 0xd^2 0xc^1]
  ;:  weld
    %+  expect-eq  !>((~(del ol l) 0xb))  ::  head
    !>(`_l`~[0xa^5 0xd^2 0xc^1])
  ::
    %+  expect-eq  !>((~(del ol l) 0xd))  ::  middle
    !>(`_l`~[0xb^6 0xa^5 0xc^1])
  ::
    %+  expect-eq  !>((~(del ol l) 0xc))  ::  tail
    !>(`_l`~[0xb^6 0xa^5 0xd^2])
  ==
::
++  test-top
  =/  l=(list [key=@ux val=@ud])
    ~[0xb^6 0xa^5 0xd^2 0xc^1]
  ;:  weld
    %+  expect-eq  !>((~(top ol l) 7))  ::  ahead empty
    !>(`_l`~)
  ::
    %+  expect-eq  !>((~(top ol l) 3))  ::  cut in middle
    !>(`_l`~[0xb^6 0xa^5])
  ::
    %+  expect-eq  !>((~(top ol l) 0))  ::  beyond tail
    !>(l)
  ==
::
++  test-bot
  =/  l=(list [key=@ux val=@ud])
    ~[0xb^6 0xa^5 0xd^2 0xc^1]
  ;:  weld
    %+  expect-eq  !>((~(bot ol l) 7))  ::  beyond head
    !>(l)
  ::
    %+  expect-eq  !>((~(bot ol l) 3))  ::  cut in middle
    !>(`_l`~[0xd^2 0xc^1])
  ::
    %+  expect-eq  !>((~(bot ol l) 0))  ::  tail empty
    !>(`_l`~)
  ==
--

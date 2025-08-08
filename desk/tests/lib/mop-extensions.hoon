::  tests for our mop extensions
::
/+  *test, mo=mop-extensions
::
|%
+$  newval  [@ @]
+$  mop-a  ((mop @ @) lth)
++  on-a   ((on @ @) lth)
++  mo-a   ((mo @ @) lth)
+$  mop-b  ((mop @ newval) lth)
++  on-b   ((on @ newval) lth)
++  mo-b   ((mo @ newval) lth)
::
++  test-dyp-transforms-in-order
  ::  must process leaf nodes in the correct order
  ::
  %+  expect-eq
    !>  ^-  mop-b
    %+  gas:on-b  ~
    ~[0^[0 1] 1^[1 2] 2^[2 3] 3^[3 4] 5^[5 5] 7^[7 6] 8^[8 7] 9^[9 8]]
  !>  ^-  mop-b
  =<  +
  %^    (dyp:mo-a newval @ud)
      (gas:on-a ~ 0^0 1^1 2^2 3^3 5^5 7^7 8^8 9^9 ~)
    1
  |=  [n=@ud [k=@ v=@]]
  ^-  [(unit newval) _n]
  [`[v n] +(n)]
::
++  test-dyp-handles-deletions
  ::  must balance the tree properly when deletions happen
  ::
  %+  expect-eq
    !>  ^-  mop-b
    %+  gas:on-b  ~
    ~[1^[1 1] 2^[2 2] 3^[3 3] 5^[5 4] 7^[7 5] 9^[9 6]]
  !>  ^-  mop-b
  =<  +
  %^    (dyp:mo-a newval @ud)
      (gas:on-a ~ 0^0 1^1 2^2 3^3 5^5 7^7 8^8 9^9 ~)
    1
  |=  [n=@ud [k=@ v=@]]
  ^-  [(unit newval) _n]
  ?:  =(0 (mod k 4))  [~ n]
  [`[v n] +(n)]
::
++  test-urn
  %+  expect-eq
    !>  ^-  mop-b
    %+  gas:on-b  ~
    ~[0^[0 0] 1^[1 1] 2^[2 2] 3^[3 3] 5^[5 5] 7^[7 7] 8^[8 8] 9^[9 9]]
  !>  ^-  mop-b
  %+  urn:mo-a
    (gas:on-a ~ 0^0 1^1 2^2 3^3 5^5 7^7 8^8 9^9 ~)
  |=  [k=@ v=@]
  ^-  [@ @]
  [v v]
--
